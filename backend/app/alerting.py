"""แจ้งเตือนตาม PRD §13 NFR-OBS-02 — error rate > 1% ต่อเนื่อง 5 นาที หรือ p95 latency เกินเป้า 2 เท่า

นับในหน่วยความจำของ process (ระบบรัน instance เดียวบน Render — เหตุผลเดียวกับ rate_limit.py)
middleware ใน app/main.py เรียก `record` ทุก request · `alert_loop` ตรวจทุกนาที

เมื่อเข้าเงื่อนไข: log event `alert` ระดับ ERROR ทุกครั้ง และ POST JSON ไปที่ `ALERT_WEBHOOK_URL` ถ้าตั้งไว้
(Slack / Discord / Better Stack รับ JSON webhook ได้) · แจ้งครั้งเดียวตอนเริ่มผิดปกติ และอีกครั้งตอนกลับปกติ
"""

import asyncio
import json
import logging
import math
import time
import urllib.request
from collections import deque
from dataclasses import dataclass, field

from app.config import ALERT_WEBHOOK_URL
from app.observability import log_event

log = logging.getLogger("paireval.alert")

WINDOW_MINUTES = 5
ERROR_RATE_THRESHOLD = 0.01
LATENCY_FACTOR = 2
# p95 จากตัวอย่างน้อยเกินไปแกว่งจนไม่มีความหมาย — ต่ำกว่านี้ไม่ตัดสิน
MIN_LATENCY_SAMPLES = 20

# เป้า p95 ต่อ endpoint จาก NFR-PERF-02/03 (ms)
# NFR-PERF-01 (หน้า Evaluation p95 ≤ 2.0 วิ) เป็นเวลาโหลดหน้าทั้งหน้า วัดเต็มได้ฝั่งเบราว์เซอร์เท่านั้น
# server เตือนได้แค่ส่วนของตัวเอง: ให้ API หลักของหน้านี้ใช้งบครึ่งหนึ่ง (1,000 ms) — alert ดังที่ 2 เท่า
# = 2,000 ms คือ API ตัวเดียวกินงบทั้งหน้าไปแล้ว หน้าเกินเป้าแน่นอน (GAP-10)
P95_TARGET_MS: dict[tuple[str, str], float] = {
    ("PUT", "/api/comparisons/{pair_assignment_id}"): 300,
    ("POST", "/api/assignments/{assignment_id}/submissions"): 800,
    ("GET", "/api/assignments/{assignment_id}/my-evaluations"): 1000,
}


@dataclass
class _Minute:
    total: int = 0
    errors: int = 0
    durations: dict[tuple[str, str], list[float]] = field(default_factory=dict)


def p95(values: list[float]) -> float:
    """nearest-rank percentile — ค่าที่ 95% ของตัวอย่างไม่เกิน"""
    ordered = sorted(values)
    return ordered[max(0, math.ceil(0.95 * len(ordered)) - 1)]


class AlertMonitor:
    def __init__(self) -> None:
        self._minutes: deque[tuple[int, _Minute]] = deque()
        self._firing: set[str] = set()

    def _bucket(self, minute: int) -> _Minute:
        if not self._minutes or self._minutes[-1][0] != minute:
            self._minutes.append((minute, _Minute()))
        while self._minutes and self._minutes[0][0] <= minute - WINDOW_MINUTES - 1:
            self._minutes.popleft()
        return self._minutes[-1][1]

    def record(self, *, method: str, route: str, status_code: int, duration_ms: float, now: float) -> None:
        bucket = self._bucket(int(now // 60))
        bucket.total += 1
        if status_code >= 500:  # 4xx คือ client ส่งผิด ไม่ใช่ระบบเสีย
            bucket.errors += 1
        key = (method, route)
        if key in P95_TARGET_MS:
            bucket.durations.setdefault(key, []).append(duration_ms)

    def breaches(self, now: float) -> dict[str, dict]:
        """เงื่อนไขที่ผิดปกติอยู่ ณ ตอนนี้ — ดูเฉพาะ 5 นาทีเต็มล่าสุด (ไม่รวมนาทีที่ยังไม่จบ)"""
        current = int(now // 60)
        window = {m: b for m, b in self._minutes if current - WINDOW_MINUTES <= m < current}
        found: dict[str, dict] = {}

        # "ต่อเนื่อง 5 นาที" = ทุกนาทีในหน้าต่างมี request และ error เกิน 1% — นาทีเดียวที่พุ่งยังไม่นับ
        rates = [window[m].errors / window[m].total if m in window and window[m].total else None
                 for m in range(current - WINDOW_MINUTES, current)]
        if all(rate is not None and rate > ERROR_RATE_THRESHOLD for rate in rates):
            total = sum(b.total for b in window.values())
            errors = sum(b.errors for b in window.values())
            found["error_rate"] = {"errorRate": round(errors / total, 4), "requests": total, "threshold": ERROR_RATE_THRESHOLD}

        for (method, route), target in P95_TARGET_MS.items():
            samples = [d for b in window.values() for d in b.durations.get((method, route), [])]
            if len(samples) >= MIN_LATENCY_SAMPLES and (value := p95(samples)) > LATENCY_FACTOR * target:
                found[f"p95:{method} {route}"] = {"route": f"{method} {route}", "p95Ms": round(value, 1),
                                                  "targetMs": target, "samples": len(samples)}
        return found

    def evaluate(self, now: float) -> list[dict]:
        """การเปลี่ยนสถานะตั้งแต่รอบก่อน — `firing` เมื่อเริ่มผิดปกติ `resolved` เมื่อกลับปกติ"""
        current = self.breaches(now)
        changes = [{"alert": name, "state": "firing", **detail}
                   for name, detail in current.items() if name not in self._firing]
        changes += [{"alert": name, "state": "resolved"} for name in sorted(self._firing - current.keys())]
        self._firing = set(current)
        return changes


monitor = AlertMonitor()


def webhook_body(url: str, payload: dict) -> dict:
    """รูปแบบข้อความตามปลายทาง — Discord อ่านช่อง `content` เท่านั้น ส่วน Slack / Better Stack อ่าน `text`"""
    details = ", ".join(f"{k}={v}" for k, v in payload.items() if k not in {"alert", "state"})
    text = f"[PairEval] {payload['state']}: {payload['alert']}" + (f" ({details})" if details else "")
    if "discord.com/api/webhooks" in url or "discordapp.com/api/webhooks" in url:
        return {"content": text}
    return {"text": text, **payload}


def _post_webhook(payload: dict) -> None:
    body = json.dumps(webhook_body(ALERT_WEBHOOK_URL, payload), ensure_ascii=False).encode()
    # Discord (ผ่าน Cloudflare) ตอบ 403 กับ User-Agent ค่าเริ่มต้นของ urllib จึงต้องระบุเอง
    request = urllib.request.Request(ALERT_WEBHOOK_URL, data=body, headers={
        "Content-Type": "application/json", "User-Agent": "PairEval-Alert/1.0",
    })
    with urllib.request.urlopen(request, timeout=5):
        pass


def notify(changes: list[dict]) -> None:
    for change in changes:
        log_event(log, "alert", level=logging.ERROR if change["state"] == "firing" else logging.WARNING, **change)
        if ALERT_WEBHOOK_URL:
            try:
                _post_webhook(change)
            except Exception:
                # ส่งไม่ออกต้องไม่ทำให้ loop ตาย — log event ด้านบนยังอยู่ให้ค้นย้อนหลังได้
                log.exception("alert webhook failed")


async def alert_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(notify, monitor.evaluate(time.time()))
        except Exception:
            log.exception("alert evaluation failed")
        await asyncio.sleep(60)
