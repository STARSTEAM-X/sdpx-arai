"""Own in-app notifications, with membership checked again when marking an event read."""
from datetime import datetime

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


@router.get("", response_model=NotificationList)
def notifications(user_email: CurrentUser) -> NotificationList:
    with transaction() as conn:
        events = PgNotificationRepository(conn).list_for_user(user_email)
    items = [NotificationOut(
        id=event["event_key"],
        title={"finalized": "ประกาศผลคะแนนแล้ว", "published": "เปิดงานประเมินแล้ว", "regenerated": "มีการปรับชุดคู่ประเมิน กรุณาตรวจสอบรายการ", "assigned": "คุณได้รับคู่ประเมินใหม่", "appeal": "ผู้สอนตอบคำร้องอุทธรณ์แล้ว", "due": "ใกล้ครบกำหนดส่งใน 48 ชั่วโมง"}[event["kind"]],
        message=f'{event["assignment_name"]} · {event["classroom_name"]}' + (f' · ยังไม่ส่ง {event["remaining"]} คู่' if event["kind"] == 'due' else ''),
        href=f'/classrooms/{event["classroom_id"]}/assignments/{event["assignment_id"]}/'
             + {"finalized": "score", "published": "evaluate", "regenerated": "evaluate", "assigned": "evaluate", "appeal": "appeal", "due": "evaluate"}[event["kind"]],
        occurredAt=event["occurred_at"], read=event["read_at"] is not None,
    ) for event in events]
    return NotificationList(items=items, unreadCount=sum(not item.read for item in items))


@router.post("/{notification_id}:read", status_code=204)
def mark_read(notification_id: str, user_email: CurrentUser) -> Response:
    with transaction() as conn:
        repo = PgNotificationRepository(conn)
        if not any(event["event_key"] == notification_id for event in repo.list_for_user(user_email)):
            raise NotFoundError("ไม่พบการแจ้งเตือนนี้")
        repo.mark_read(user_email, notification_id)
    return Response(status_code=204)
