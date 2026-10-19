"""Own in-app notifications, with membership checked again when marking an event read."""
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Response
from pydantic import BaseModel

from app.auth import CurrentUser
from app.db import transaction
from app.domain.errors import NotFoundError
from app.repositories.pg_notification_repo import PgNotificationRepository

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: str
    title: str
    message: str
    href: str
    occurredAt: datetime
    read: bool


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unreadCount: int


_TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

_HREF_SUFFIX = {
    "finalized": "score", "published": "evaluate", "regenerated": "evaluate",
    "assigned": "evaluate", "appeal": "appeal", "due": "evaluate",
}


def _short_deadline(value: datetime | None, timezone: str | None) -> str:
    """"20 ต.ค. 23:59" ตามเขตเวลาของห้อง — รูปแบบเดียวกับ Figma ST12"""
    if value is None:
        return ""
    try:
        local = value.astimezone(ZoneInfo(timezone or "Asia/Bangkok"))
    except ZoneInfoNotFoundError:
        local = value
    return f"{local.day} {_TH_MONTHS[local.month - 1]} {local:%H:%M}"


def _text(event: dict) -> tuple[str, str]:
    """หัวข้อและบรรทัดรองของแต่ละประเภท — บอกสิ่งที่ต้องทำ ไม่มีคะแนนของใครในข้อความ"""
    kind = event["kind"]
    name = event["assignment_name"]
    if kind == "published":
        parts = []
        if event.get("assigned_count"):
            parts.append(f'ต้องประเมิน {event["assigned_count"]} ข้อ')
        if event.get("deadline"):
            parts.append(f'ปิดรับ {_short_deadline(event["deadline"], event.get("timezone"))}')
        return f"เปิดให้ประเมินแล้ว — {name}", " · ".join(parts) or event["classroom_name"]
    if kind == "due":
        total = event.get("total") or 0
        done = total - (event.get("remaining") or 0)
        level = "ระดับกลุ่ม" if event.get("side") == "GROUP" else "รายบุคคล"
        return "เหลือเวลา 48 ชั่วโมง", f"คุณยังส่งไม่ครบ · ตอบแล้ว {done} / {total} ข้อ ({level}) · {name}"
    if kind == "regenerated":
        return "คู่ประเมินถูกจัดใหม่", f"อาจารย์แก้งานและเผยแพร่ใหม่ · คำตอบเดิมไม่นับ ต้องประเมินใหม่ · {name}"
    if kind == "assigned":
        return "ได้รับมอบหมายให้ประเมินเพิ่ม", f'คู่ใหม่ {event.get("new_count", 1)} คู่ใน{name}'
    if kind == "finalized":
        return "ประกาศผลคะแนนแล้ว", f"ดูคะแนนของคุณในระบบ · ยื่นอุทธรณ์ได้ภายใน 7 วัน · {name}"
    return "ผู้สอนตอบคำร้องอุทธรณ์แล้ว", f'{name} · {event["classroom_name"]}'


@router.get("", response_model=NotificationList)
def notifications(user_email: CurrentUser) -> NotificationList:
    with transaction() as conn:
        events = PgNotificationRepository(conn).list_for_user(user_email)
    items = []
    for event in events:
        title, message = _text(event)
        items.append(NotificationOut(
            id=event["event_key"], title=title, message=message,
            href=f'/classrooms/{event["classroom_id"]}/assignments/{event["assignment_id"]}/{_HREF_SUFFIX[event["kind"]]}',
            occurredAt=event["occurred_at"], read=event["read_at"] is not None,
        ))
    return NotificationList(items=items, unreadCount=sum(not item.read for item in items))


@router.post("/{notification_id}:read", status_code=204)
def mark_read(notification_id: str, user_email: CurrentUser) -> Response:
    with transaction() as conn:
        repo = PgNotificationRepository(conn)
        if not any(event["event_key"] == notification_id for event in repo.list_for_user(user_email)):
            raise NotFoundError("ไม่พบการแจ้งเตือนนี้")
        repo.mark_read(user_email, notification_id)
    return Response(status_code=204)
