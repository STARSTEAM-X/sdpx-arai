"""จำกัดอัตราการเรียก API ต่อผู้ใช้ (PRD §12 FR-API-04)

120 request ต่อนาทีต่อผู้ใช้ · endpoint ส่งออก 5 ครั้งต่อนาที · เกินแล้วตอบ 429 พร้อม `Retry-After`
นับแบบ sliding window ในหน่วยความจำของ process — ระบบรันบน instance เดียว (Render) จึงไม่ต้องใช้ Redis
ถ้าวันหนึ่งขยายเป็นหลาย instance ตัวนับต้องย้ายไปที่เก็บกลาง ไม่งั้นแต่ละเครื่องจะนับแยกกัน
"""

import math
import threading
import time
from collections import deque

import jwt

from app.config import SESSION_SECRET

WINDOW_SECONDS = 60.0


def is_export(path: str) -> bool:
    """endpoint ที่สร้างไฟล์ส่งออก — หนักกว่าปกติจึงมีเพดานแยก"""
    return path.endswith((":export", ":export-identified", "/reports:export"))


def is_exempt(path: str) -> bool:
    """health check ของ load balancer และ endpoint ทดสอบ (มีเฉพาะนอก production) ไม่นับ"""
    return path == "/api/health" or path.startswith("/api/test/") or not path.startswith("/api/")


class SlidingWindowLimiter:
    def __init__(self, limit: int, window: float = WINDOW_SECONDS):
        self.limit = limit
        self.window = window
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, now: float | None = None) -> float | None:
        """บันทึกการเรียกหนึ่งครั้ง — คืน None ถ้าผ่าน หรือจำนวนวินาทีที่ต้องรอถ้าเกินเพดาน"""
        now = time.monotonic() if now is None else now
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= now - self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return max(0.0, hits[0] + self.window - now)
            hits.append(now)
            # ล้าง key ที่ว่างแล้ว กันหน่วยความจำโตตามจำนวนผู้ใช้ที่เคยเข้า
            if len(self._hits) > 10_000:
                for stale in [k for k, v in self._hits.items() if not v or v[-1] <= now - self.window]:
                    del self._hits[stale]
            return None


def client_key(authorization: str | None, client_ip: str | None) -> str:
    """ผู้ใช้ที่ล็อกอินนับตามอีเมลใน token · ไม่มี token หรือ token เสียนับตาม IP

    ไม่ตรวจวันหมดอายุตรงนี้ — แค่ต้องการรู้ว่าใครเรียก การตรวจสิทธิ์จริงอยู่ที่ `current_user_email`
    """
    if authorization and authorization.lower().startswith("bearer "):
        try:
            payload = jwt.decode(authorization[7:], SESSION_SECRET, algorithms=["HS256"],
                                 options={"verify_exp": False})
            if payload.get("sub"):
                return f"user:{payload['sub']}"
        except jwt.InvalidTokenError:
            pass
    return f"ip:{client_ip or 'unknown'}"


def retry_after_header(wait: float) -> str:
    return str(max(1, math.ceil(wait)))
