"""ข้อมูลบัญชีของตัวเอง — ประกาศความเป็นส่วนตัวและคำขอสำเนาข้อมูล (Figma ST03, ST07, T12b)

ทุก endpoint ทำกับบัญชีของ session เท่านั้น ไม่มี path ที่รับ user id จากภายนอก
จึงไม่มีทางอ่านหรือยื่นคำขอแทนคนอื่น
"""

from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.auth import CurrentUser
from app.db import transaction

router = APIRouter(prefix="/api/me", tags=["account"])


class PrivacyAck(BaseModel):
    privacyAcknowledgedAt: datetime


class DataRequestOut(BaseModel):
    id: int
    requestedAt: datetime
    status: str


class DataRequestList(BaseModel):
    items: list[DataRequestOut]


def _user_id(cur, email: str) -> str:
    cur.execute("SELECT id FROM app_user WHERE email_normalized = %s", (email,))
    row = cur.fetchone()
    if row is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "ไม่พบผู้ใช้ของ session นี้"},
        )
    return row["id"]


@router.post("/privacy-ack", response_model=PrivacyAck)
def acknowledge_privacy(user_email: CurrentUser) -> PrivacyAck:
    # COALESCE เก็บเวลาที่รับทราบครั้งแรกไว้ — กดซ้ำไม่ทำให้หลักฐานเดิมหาย
    with transaction() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE app_user SET privacy_acknowledged_at = COALESCE(privacy_acknowledged_at, now()) "
            "WHERE email_normalized = %s RETURNING privacy_acknowledged_at",
            (user_email,),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "ไม่พบผู้ใช้ของ session นี้"},
        )
    return PrivacyAck(privacyAcknowledgedAt=row["privacy_acknowledged_at"])


@router.get("/data-requests", response_model=DataRequestList)
def list_data_requests(user_email: CurrentUser) -> DataRequestList:
    with transaction() as conn, conn.cursor() as cur:
        user_id = _user_id(cur, user_email)
        cur.execute(
            "SELECT id, requested_at, status FROM data_copy_request "
            "WHERE user_id = %s ORDER BY requested_at DESC, id DESC",
            (user_id,),
        )
        rows = cur.fetchall()
    return DataRequestList(items=[
        DataRequestOut(id=r["id"], requestedAt=r["requested_at"], status=r["status"]) for r in rows
    ])


@router.post("/data-requests", response_model=DataRequestOut, status_code=201)
def create_data_request(user_email: CurrentUser) -> DataRequestOut:
    with transaction() as conn, conn.cursor() as cur:
        user_id = _user_id(cur, user_email)
        cur.execute(
            "INSERT INTO data_copy_request (user_id) VALUES (%s) RETURNING id, requested_at, status",
            (user_id,),
        )
        row = cur.fetchone()
    return DataRequestOut(id=row["id"], requestedAt=row["requested_at"], status=row["status"])
