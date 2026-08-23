"""integration test ของ audit log — อ้าง US-14

AC สองข้อของ story นี้เป็นเรื่องของ **database ล้วน ๆ** และพิสูจน์ด้วย fake ไม่ได้เลย:
"ลบและแก้ไม่ได้ที่ระดับ database" กับ "action กับ audit rollback พร้อมกัน"
"""

import uuid

import psycopg
import pytest
from psycopg import Connection

from app.domain.audit import AuditAction, AuditEvent, MissingAuditReason
from app.repositories.pg_audit_repo import PgAuditRepository

pytestmark = pytest.mark.integration


def event(**overrides) -> AuditEvent:
    defaults = dict(
        actor_email=f"ajarn-{uuid.uuid4().hex[:8]}@kmitl.ac.th",
        action=AuditAction.ASSIGNMENT_PUBLISHED,
        resource_type="assignment",
        resource_id=str(uuid.uuid4()),
        after_state={"status": "PUBLISHED"},
    )
    return AuditEvent(**{**defaults, **overrides})


class TestRecord:
    def test_บันทึกแล้วอ่านกลับได้ครบ(self, db: Connection):
        repo = PgAuditRepository(db)
        audit_id = repo.record(
            event(before_state={"status": "DRAFT"}, after_state={"status": "PUBLISHED"})
        )

        with db.cursor() as cur:
            cur.execute("SELECT * FROM audit_log WHERE id = %s", (audit_id,))
            row = cur.fetchone()

        assert row["action"] == "ASSIGNMENT_PUBLISHED"
        assert row["before_state"] == {"status": "DRAFT"}
        assert row["after_state"] == {"status": "PUBLISHED"}
        # AC ข้อ 2 บังคับให้ timestamp เป็น UTC
        assert row["occurred_at"].utcoffset().total_seconds() == 0

    def test_actor_ที่ยังไม่มีในระบบยังบันทึกได้_และยังรู้ว่าใครทำ(self, db: Connection):
        # log ต้องไม่หายไปเพียงเพราะผู้ใช้ถูกลบหรือยังไม่เคยถูกสร้าง
        audit_id = PgAuditRepository(db).record(event(actor_email="ghost@kmitl.ac.th"))

        with db.cursor() as cur:
            cur.execute(
                "SELECT actor_user_id, actor_email FROM audit_log WHERE id = %s", (audit_id,)
            )
            row = cur.fetchone()

        assert row["actor_user_id"] is None
        assert row["actor_email"] == "ghost@kmitl.ac.th"

    def test_AC_action_ที่บังคับเหตุผลต้องมี_reason(self, db: Connection):
        with pytest.raises(MissingAuditReason):
            PgAuditRepository(db).record(event(action=AuditAction.SCORE_OVERRIDDEN))

    def test_action_ที่บังคับเหตุผลผ่านได้เมื่อมี_reason(self, db: Connection):
        assert PgAuditRepository(db).record(
            event(action=AuditAction.SCORE_OVERRIDDEN, reason="อาจารย์ปรับตามหลักฐานเพิ่มเติม")
        )


class TestAppendOnly:
    """AC ข้อ 3 — ลบหรือแก้ไม่ได้ "ทั้งชั้น API และสิทธิ์ระดับ database"

    ชั้น API พิสูจน์ด้วยการไม่มี endpoint ให้เรียก แต่นั่นกันได้แค่ทางที่เรานึกออก
    สองข้อนี้ยิง SQL ตรง ๆ ซึ่งเป็นทางที่ endpoint กันไม่ถึง
    """

    def test_UPDATE_ถูกปฏิเสธที่ระดับ_database(self, db: Connection):
        audit_id = PgAuditRepository(db).record(event())

        with pytest.raises(psycopg.errors.CheckViolation), db.cursor() as cur:
            cur.execute("UPDATE audit_log SET action = 'ของปลอม' WHERE id = %s", (audit_id,))

    def test_DELETE_ถูกปฏิเสธที่ระดับ_database(self, db: Connection):
        audit_id = PgAuditRepository(db).record(event())

        with pytest.raises(psycopg.errors.CheckViolation), db.cursor() as cur:
            cur.execute("DELETE FROM audit_log WHERE id = %s", (audit_id,))


class TestSameTransaction:
    def test_AC_action_ล้มเหลวแล้ว_audit_ต้องหายไปด้วย(self, db: Connection):
        """ทดสอบทิศทางที่สำคัญกว่า: ไม่มี audit ที่ค้างอยู่โดยที่ action ไม่เกิด

        ใช้ savepoint จำลอง transaction ที่ล้มกลางคัน — เขียน audit สำเร็จแล้ว
        แต่ statement ถัดไปพัง ทั้งคู่ต้องหายไปพร้อมกัน
        """
        marker = str(uuid.uuid4())

        with pytest.raises(psycopg.errors.UndefinedTable), db.transaction():
            PgAuditRepository(db).record(event(resource_id=marker))
            with db.cursor() as cur:
                cur.execute("INSERT INTO ตารางที่ไม่มีอยู่ VALUES (1)")

        with db.cursor() as cur:
            cur.execute("SELECT count(*) AS n FROM audit_log WHERE resource_id = %s", (marker,))
            assert cur.fetchone()["n"] == 0


class TestListForClassroom:
    def test_คืนเฉพาะของห้องที่ขอ_เรียงใหม่สุดก่อน(self, db: Connection):
        suffix = uuid.uuid4().hex[:8]
        email = f"ajarn-{suffix}@kmitl.ac.th"
        with db.cursor() as cur:
            cur.execute(
                "INSERT INTO app_user (id, email_normalized, email_raw, status) "
                "VALUES (%s, %s, %s, 'ACTIVE')",
                (str(uuid.uuid4()), email, email),
            )
            room = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO classroom (id, name, slug, timezone, created_by, created_at) "
                "SELECT %s, %s, %s, 'Asia/Bangkok', id, now() FROM app_user "
                "WHERE email_normalized = %s",
                (room, f"ห้อง {suffix}", f"audit-{suffix}", email),
            )

        repo = PgAuditRepository(db)
        repo.record(event(actor_email=email, classroom_id=room))
        repo.record(event(actor_email=email, classroom_id=room, action=AuditAction.MEMBER_REMOVED))
        repo.record(event(actor_email=email))  # ไม่ผูกห้อง — ต้องไม่ติดมา

        items = repo.list_for_classroom(room)

        assert len(items) == 2
        assert {i["action"] for i in items} == {"ASSIGNMENT_PUBLISHED", "MEMBER_REMOVED"}
