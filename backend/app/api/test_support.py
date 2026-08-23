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


@router.get("/pairs/{assignment_id}")
def dump_pairs(assignment_id: str) -> dict:
    """คืนคู่ประเมินทั้งหมดของงานหนึ่ง — ให้ E2E ตรวจ invariant กับข้อมูลที่บันทึกจริง

    ทำไมต้องมี: unit test ของ pairing engine พิสูจน์ว่า *ตรรกะ* ถูก แต่พิสูจน์ไม่ได้ว่า
    การ map กลุ่มกับสมาชิกจาก database เข้าไปหา engine นั้นถูก — ถ้า group_id
    ผูกผิดคน กฎ "ห้ามประเมินกลุ่มตัวเอง" จะยังเขียวใน unit test ทั้งที่ของจริงพัง

    ปิดใน production เหมือน endpoint อื่นในไฟล์นี้ เพราะเปิดเผยว่าใครประเมินอะไร
    ซึ่งเป็นข้อมูลที่ผู้ประเมินเองก็ไม่ควรเห็นของคนอื่น
    """
    _guard()
    with transaction() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.side, p.item_a_id, p.item_b_id, p.display_left_item_id,
                   u.email_normalized AS evaluator,
                   m.group_id        AS evaluator_group_id
            FROM pair_assignment p
            JOIN app_user u ON u.id = p.evaluator_user_id
            JOIN assignment a ON a.id = p.assignment_id
            LEFT JOIN classroom_member m
                   ON m.user_id = p.evaluator_user_id AND m.classroom_id = a.classroom_id
            WHERE p.assignment_id = %s
            ORDER BY p.criterion_id, u.email_normalized, p.item_a_id, p.item_b_id
            """,
            (assignment_id,),
        )
        rows = cur.fetchall()

    return {
        "count": len(rows),
        "items": [
            {
                "side": r["side"],
                "itemA": str(r["item_a_id"]),
                "itemB": str(r["item_b_id"]),
                "displayLeft": str(r["display_left_item_id"]),
                "evaluator": r["evaluator"],
                "evaluatorGroupId": str(r["evaluator_group_id"]) if r["evaluator_group_id"] else None,
            }
            for r in rows
        ],
    }
