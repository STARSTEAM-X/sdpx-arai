"""integration test ของ PgUserRepository — อ้าง US-01

ทุก test ในไฟล์นี้ตรวจสิ่งที่ **SQL** ทำ ไม่ใช่สิ่งที่ Python ทำ
จึงใช้ fake แทนไม่ได้ — คำสั่ง ON CONFLICT ที่เขียนผิดจะดูถูกต้องทุกประการ
เมื่ออ่านผ่าน ๆ แต่ทำสิ่งที่ต่างออกไปโดยสิ้นเชิงตอนรันจริง
"""

import uuid

import pytest
from psycopg import Connection

from app.google_oidc import GoogleIdentity
from app.repositories.pg_user_repo import PgUserRepository

pytestmark = pytest.mark.integration


def identity(email: str, *, name: str | None = "สมชาย ใจดี", sub: str = "") -> GoogleIdentity:
    return GoogleIdentity(
        google_sub=sub or f"sub-{uuid.uuid4()}",
        email_raw=email,
        email_normalized=email.lower(),
        display_name=name,
    )


class TestUpsertFromGoogle:
    def test_login_ครั้งแรกสร้าง_user_เป็น_ACTIVE(self, db: Connection):
        repo = PgUserRepository(db)
        email = f"new-{uuid.uuid4().hex[:8]}@uni.ac.th"

        user = repo.upsert_from_google(identity(email))

        assert user.status == "ACTIVE"
        assert user.email_normalized == email

    def test_AC_user_PENDING_จาก_roster_กลายเป็น_ACTIVE_ตอน_login(self, db: Connection):
        """AC ข้อ 4 ของ US-01 — เส้นทางที่ทำให้ roster กับ login เชื่อมกัน"""
        email = f"pending-{uuid.uuid4().hex[:8]}@uni.ac.th"
        with db.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_user (id, email_normalized, email_raw, status)
                VALUES (%s, %s, %s, 'PENDING')
                """,
                (str(uuid.uuid4()), email, email),
            )

        user = PgUserRepository(db).upsert_from_google(identity(email, sub="sub-abc"))

        assert user.status == "ACTIVE"

        with db.cursor() as cur:
            cur.execute("SELECT google_sub FROM app_user WHERE email_normalized = %s", (email,))
            assert cur.fetchone()["google_sub"] == "sub-abc"

    def test_บัญชีที่ถูกระงับต้องไม่ถูกปลุกคืนด้วยการ_login_ใหม่(self, db: Connection):
        """กันบั๊กที่ guard USER_DISABLED ใน api/auth.py เคยเป็น dead code

        ก่อนแก้ ON CONFLICT เขียน status = 'ACTIVE' ตรง ๆ ทุกครั้ง
        คนที่ถูกแบนจึงแค่กด login ซ้ำก็กลับมาใช้งานได้ และไม่มี test ตัวไหนจับได้เลย
        """
        email = f"banned-{uuid.uuid4().hex[:8]}@uni.ac.th"
        with db.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_user (id, email_normalized, email_raw, status)
                VALUES (%s, %s, %s, 'DISABLED')
                """,
                (str(uuid.uuid4()), email, email),
            )

        user = PgUserRepository(db).upsert_from_google(identity(email))

        assert user.status == "DISABLED"

    def test_login_ซ้ำไม่สร้าง_user_ใหม่(self, db: Connection):
        repo = PgUserRepository(db)
        email = f"repeat-{uuid.uuid4().hex[:8]}@uni.ac.th"

        first = repo.upsert_from_google(identity(email))
        second = repo.upsert_from_google(identity(email))

        assert first.id == second.id

    def test_display_name_เดิมไม่ถูกลบทิ้งเมื่อ_Google_ไม่ส่งชื่อมา(self, db: Connection):
        repo = PgUserRepository(db)
        email = f"named-{uuid.uuid4().hex[:8]}@uni.ac.th"

        repo.upsert_from_google(identity(email, name="ชื่อเดิม"))
        user = repo.upsert_from_google(identity(email, name=None))

        assert user.display_name == "ชื่อเดิม"
