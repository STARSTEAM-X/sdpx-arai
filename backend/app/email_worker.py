"""ส่ง notification ในเว็บออกเป็นอีเมลด้วย (GAP-03 / PRD §7.9 FR-NOTIF-01..06)

ต้นทางคือ PgNotificationRepository.list_for_user ตัวเดียวกับกระดิ่งในเว็บ ข้อความกับลิงก์จึงตรงกันเสมอ
และไม่มีคะแนนของใครในเนื้อความ (FR-NOTIF-06) เพราะ notification_text ไม่ใส่อยู่แล้ว

กันส่งซ้ำด้วย email_delivery (user_id, event_key) — claim ก่อนส่ง commit แยกจากการส่ง
ไม่ส่งย้อนหลัง: ส่งเฉพาะ event หลังเวลาที่ worker เริ่มครั้งแรก (email_worker_state) และไม่เก่ากว่า LOOKBACK
"""

import asyncio
import logging
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from app.api.notifications import notification_href, notification_text
from app.config import (
    EMAIL_DAILY_CAP,
    EMAIL_ENABLED,
    EMAIL_FROM,
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN,
    WEB_BASE_URL,
)
from app.db import transaction
from app.gmail_sender import GmailAuthError, GmailSender, GmailSendError, build_message
from app.observability import log_event
from app.repositories.pg_notification_repo import PgNotificationRepository

log = logging.getLogger("paireval.email")

TICK_SECONDS = 300
# event "เหลือ 48 ชม." เกิดก่อน deadline 48 ชม. — ย้อนดู 3 วันพอให้ฉบับที่ติดเพดานรายวันได้ส่งวันถัดไป
LOOKBACK = timedelta(days=3)
MAX_ATTEMPTS = 3


def render_email(event: dict, *, to: str, web_base_url: str, sender: str = ""):
    title, message = notification_text(event)
    link = f"{web_base_url}{notification_href(event)}"
    body = (
        f"{title}\n\n{message}\n\n"
        f"เปิดในระบบ: {link}\n\n"
        f"— PairEval · {event['classroom_name']}\n"
        "อีเมลนี้ส่งอัตโนมัติจากการแจ้งเตือนในระบบ ตอบกลับอีเมลนี้จะไม่มีผู้อ่าน\n"
    )
    return build_message(to=to, subject=f"[PairEval] {title}", body=body, sender=sender)


def _since(cur, now: datetime) -> datetime:
    cur.execute("INSERT INTO email_worker_state (id) VALUES (true) ON CONFLICT DO NOTHING")
    cur.execute("SELECT started_at FROM email_worker_state")
    return max(cur.fetchone()["started_at"], now - LOOKBACK)


def _recipients(cur) -> list[dict]:
    # สมาชิกที่ยังเรียนอยู่ในห้องที่ยังใช้งาน · ผู้ใช้ที่ถูกปิด (DISABLED) ไม่ได้รับ
    cur.execute(
        "SELECT DISTINCT u.id, u.email_normalized, u.email_raw FROM app_user u "
        "JOIN classroom_member m ON m.user_id = u.id AND m.enrollment_status = 'ACTIVE' "
        "JOIN classroom c ON c.id = m.classroom_id AND c.status = 'ACTIVE' "
        "WHERE u.status != 'DISABLED'"
    )
    return list(cur.fetchall())


def _sent_last_day(cur, now: datetime) -> int:
    cur.execute("SELECT count(*) AS n FROM email_delivery WHERE status = 'SENT' AND sent_at > %s",
                (now - timedelta(days=1),))
    return cur.fetchone()["n"]


def _claim(user_id, event_key: str) -> bool:
    """จองสิทธิ์ส่ง — คืน False ถ้ามีคนส่ง/กำลังส่งแล้ว หรือส่งพลาดครบ MAX_ATTEMPTS แล้ว"""
    with transaction() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO email_delivery (user_id, event_key) VALUES (%s, %s) "
            "ON CONFLICT (user_id, event_key) DO UPDATE "
            "SET status = 'PENDING', attempts = email_delivery.attempts + 1, claimed_at = now() "
            "WHERE email_delivery.status = 'FAILED' AND email_delivery.attempts < %s "
            "RETURNING attempts",
            (user_id, event_key, MAX_ATTEMPTS),
        )
        return cur.fetchone() is not None


def _finish(user_id, event_key: str, error: str | None) -> None:
    with transaction() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE email_delivery SET status = %s, last_error = %s, "
            "sent_at = CASE WHEN %s THEN now() END WHERE user_id = %s AND event_key = %s",
            ("FAILED" if error else "SENT", error, error is None, user_id, event_key),
        )


def run_email_tick(send: Callable, *, now: datetime | None = None,
                   daily_cap: int = EMAIL_DAILY_CAP, web_base_url: str = WEB_BASE_URL) -> int:
    """ส่งอีเมลของ event ใหม่ทั้งหมดหนึ่งรอบ · คืนจำนวนฉบับที่ส่งสำเร็จ"""
    now = now or datetime.now(UTC)
    with transaction() as conn, conn.cursor() as cur:
        since = _since(cur, now)
        budget = daily_cap - _sent_last_day(cur, now)
        recipients = _recipients(cur)
    sent = 0
    for user in recipients:
        if budget <= 0:
            log_event(log, "email_daily_cap_reached", level=logging.WARNING, cap=daily_cap)
            break
        with transaction() as conn:
            events = PgNotificationRepository(conn).list_for_user(user["email_normalized"])
        for event in sorted(events, key=lambda item: item["occurred_at"]):
            if event["occurred_at"] < since or event["occurred_at"] > now or budget <= 0:
                continue
            if not _claim(user["id"], event["event_key"]):
                continue
            try:
                send(render_email(event, to=user["email_raw"] or user["email_normalized"],
                                  web_base_url=web_base_url, sender=EMAIL_FROM))
            except GmailAuthError:
                _finish(user["id"], event["event_key"], "auth")
                raise
            except GmailSendError as exc:
                _finish(user["id"], event["event_key"], str(exc)[:200])
                log_event(log, "email_failed", level=logging.WARNING, kind=event["kind"], error=str(exc))
                continue
            _finish(user["id"], event["event_key"], None)
            sent += 1
            budget -= 1
    if sent:
        log_event(log, "email_sent", count=sent)
    return sent


async def email_loop() -> None:
    if not EMAIL_ENABLED:
        log_event(log, "email_disabled", reason="GMAIL_* not set")
        return
    sender = GmailSender(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)
    while True:
        try:
            await asyncio.to_thread(run_email_tick, sender.send)
        except GmailAuthError:
            # refresh token ใช้ไม่ได้แล้ว ต้องออกใหม่ (docs/email-notifications.md) — ERROR จึงเข้า alert
            log_event(log, "email_auth_failed", level=logging.ERROR)
        except Exception:
            log.exception("email tick failed")
        await asyncio.sleep(TICK_SECONDS)
