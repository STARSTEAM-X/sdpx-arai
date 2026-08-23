"""endpoint ที่มีไว้ให้ E2E ใช้เท่านั้น

## ทำไมต้องมี

E2E ต้องเริ่มจาก state ที่รู้แน่ ไม่งั้น test จะให้ผลต่างกันตามลำดับการรัน
และ Playwright login ผ่าน Google จริงไม่ได้เพราะ Google บล็อก automated login

## ทำไมถึงอันตราย

`POST /api/test/cleanup` ลบข้อมูลทั้งหมด และ `POST /api/test/session`
ออก session ให้ใครก็ได้โดยไม่ต้องมีรหัสผ่าน
ถ้าสองอันนี้หลุดขึ้น production = ใครก็ล้าง database และปลอมเป็นใครก็ได้ผ่าน internet

## กันอย่างไร

router ทั้งชุดนี้จะถูก **ไม่ลงทะเบียนเลย** ถ้า ENVIRONMENT เป็น production
(ดู app/main.py) และยังมี guard ซ้ำในทุก handler เป็นชั้นที่สอง
ค่า default ของ ENVIRONMENT คือ "production" — การลืมตั้ง env จึงเป็นการปิด ไม่ใช่เปิด
"""

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.auth import issue_session
from app.config import IS_PRODUCTION
from app.db import transaction
from app.domain.email import normalize_email

router = APIRouter(prefix="/api/test", tags=["test-support"])


def _guard() -> None:
    """ชั้นป้องกันที่สอง — ต่อให้มีคนเผลอ include router นี้ใน production ก็ยังไม่ทำงาน"""
    if IS_PRODUCTION:
        raise HTTPException(status_code=404, detail="Not found")


class SeedUser(BaseModel):
    email: EmailStr
    displayName: str | None = None


class SeedRequest(BaseModel):
    users: list[SeedUser] = Field(default_factory=list)


class SessionRequest(BaseModel):
    email: EmailStr


@router.post("/seed")
def seed(body: SeedRequest | None = None) -> dict:
    """ตั้ง state ตั้งต้น: ล้างของเก่าแล้วใส่ user ตัวอย่าง

    ล้างก่อนเสมอเพื่อให้ seed เป็น idempotent — เรียกซ้ำกี่ครั้งก็ได้ state เดิม
    """
    _guard()
    users = body.users if body and body.users else [SeedUser(email="ajarn@uni.ac.th")]

    with transaction() as conn, conn.cursor() as cur:
        cur.execute("TRUNCATE classroom_member, classroom, app_user RESTART IDENTITY CASCADE")
        for u in users:
            cur.execute(
                """
                INSERT INTO app_user (id, email_normalized, email_raw, display_name, status)
                VALUES (%s, %s, %s, %s, 'ACTIVE')
                """,
                (str(uuid.uuid4()), normalize_email(str(u.email)), str(u.email), u.displayName),
            )

    return {"seeded": len(users)}


@router.post("/cleanup")
def cleanup() -> dict:
    _guard()
    with transaction() as conn, conn.cursor() as cur:
        cur.execute("TRUNCATE classroom_member, classroom, app_user RESTART IDENTITY CASCADE")
    return {"cleaned": True}


@router.post("/session")
def test_session(body: SessionRequest) -> dict:
    """ออก session ให้โดยไม่ต้องผ่าน Google — สำหรับ E2E เท่านั้น

    ผู้ใช้ต้องมีอยู่ใน database แล้ว (มาจาก seed) เพื่อไม่ให้กลายเป็นช่องสร้าง user ลอย ๆ
    """
    _guard()
    email = normalize_email(str(body.email))

    with transaction() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM app_user WHERE email_normalized = %s", (email,))
        if cur.fetchone() is None:
            raise HTTPException(
                status_code=404,
                detail={"code": "USER_NOT_SEEDED", "message": f"ยังไม่มีผู้ใช้ {email} ใน seed"},
            )

    token, expires_at = issue_session(email)
    return {"accessToken": token, "expiresAt": expires_at.isoformat(), "email": email}
