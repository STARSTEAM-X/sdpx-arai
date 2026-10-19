"""Figma J24: ประกาศผลอัตโนมัติ 14 วันหลังปิดรับ — ตรวจ SQL และการ rollback กับ Postgres จริง"""
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from app import auto_finalize
from app.domain.assignment_service import Assignment, Criterion
from app.domain.models import Classroom, ClassroomMember, MemberRole
from app.domain.pairing import Side
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_classroom_repo import PgClassroomRepository
from app.repositories.pg_notification_repo import PgNotificationRepository

pytestmark = pytest.mark.integration


def _assignment(db, *, closed_days_ago: int) -> tuple[str, str]:
    owner = f"auto-{uuid.uuid4().hex}@example.com"
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO app_user (id, email_normalized, email_raw, status) VALUES (%s,%s,%s,'ACTIVE')",
            (str(uuid.uuid4()), owner, owner),
        )
    rooms = PgClassroomRepository(db)
    room = rooms.save(Classroom(id=str(uuid.uuid4()), name="Auto", slug=uuid.uuid4().hex, timezone="Asia/Bangkok",
                                created_by=owner, created_at=datetime.now(UTC)))
    rooms.save_member(ClassroomMember(room.id, owner, MemberRole.OWNER))
    criterion = Criterion(str(uuid.uuid4()), Side.GROUP, "UX", Decimal(100))
    assignment = PgAssignmentRepository(db).create(Assignment(
        id=str(uuid.uuid4()), classroom_id=room.id, name="งานกลุ่มครั้งที่ 1", group_max_score=Decimal(15),
        individual_max_score=Decimal(0), group_deadline_utc=datetime.now(UTC) - timedelta(days=closed_days_ago),
        created_by=owner, criteria=[criterion], score_floor=Decimal("0.5"), score_ceiling=Decimal("0.95"),
        instructor_weight=Decimal("2"), completion_threshold=Decimal("0.8"),
    ))
    with db.cursor() as cur:
        cur.execute("UPDATE assignment SET status = 'CLOSED' WHERE id = %s", (assignment.id,))
    return assignment.id, owner


@pytest.fixture
def savepoints(db, monkeypatch):
    """ให้แต่ละ transaction ของ job เป็น savepoint ใน connection ของ test — rollback ภายในยังเกิดจริง"""
    @contextmanager
    def nested():
        with db.transaction():
            yield db
    monkeypatch.setattr(auto_finalize, "transaction", nested)


def _status(db, assignment_id):
    with db.cursor() as cur:
        cur.execute("SELECT status, finalized_at FROM assignment WHERE id = %s", (assignment_id,))
        return cur.fetchone()


def test_finalizes_after_fourteen_days_and_audits_as_system(db, savepoints, monkeypatch):
    assignment_id, _ = _assignment(db, closed_days_ago=15)
    monkeypatch.setattr(auto_finalize, "has_submitted_answers", lambda *a: True)
    monkeypatch.setattr(auto_finalize, "run_recompute", lambda *a, **k: False)
    assert auto_finalize.run_due_auto_finalizes() >= 1
    assert _status(db, assignment_id)["status"] == "FINALIZED"
    with db.cursor() as cur:
        cur.execute("SELECT actor_email, actor_user_id, after_state FROM audit_log WHERE resource_id = %s", (assignment_id,))
        audit = cur.fetchone()
    assert audit["actor_email"] == "system" and audit["actor_user_id"] is None
    assert audit["after_state"]["automatic"] is True


def test_skips_assignment_without_any_submitted_answer(db, savepoints):
    # ไม่มีคำตอบเลย = ข้อมูลไม่พอทั้งงาน → ไม่ประกาศ
    assignment_id, _ = _assignment(db, closed_days_ago=15)
    auto_finalize.run_due_auto_finalizes()
    row = _status(db, assignment_id)
    assert row["status"] == "CLOSED" and row["finalized_at"] is None


def test_low_confidence_skips_and_rolls_back_the_final_recompute(db, savepoints, monkeypatch):
    assignment_id, _ = _assignment(db, closed_days_ago=15)
    monkeypatch.setattr(auto_finalize, "has_submitted_answers", lambda *a: True)

    def recompute_with_low_confidence(conn, assignment, **_):
        # แทนผลคำนวณ final ที่ถูกเขียนก่อนรู้ว่ามีรายการข้อมูลไม่พอ — ต้องถูก rollback ทิ้ง
        with conn.cursor() as cur:
            cur.execute("UPDATE assignment SET name = 'เขียนค้าง' WHERE id = %s", (assignment.id,))
        return True

    monkeypatch.setattr(auto_finalize, "run_recompute", recompute_with_low_confidence)
    auto_finalize.run_due_auto_finalizes()
    with db.cursor() as cur:
        cur.execute("SELECT status, name FROM assignment WHERE id = %s", (assignment_id,))
        row = cur.fetchone()
    assert row["status"] == "CLOSED" and row["name"] == "งานกลุ่มครั้งที่ 1"


def test_not_before_fourteen_days_nor_after_reopen(db, savepoints, monkeypatch):
    monkeypatch.setattr(auto_finalize, "run_recompute", lambda *a, **k: False)
    monkeypatch.setattr(auto_finalize, "has_submitted_answers", lambda *a: True)
    early, _ = _assignment(db, closed_days_ago=13)
    reopened, _ = _assignment(db, closed_days_ago=30)
    with db.cursor() as cur:
        cur.execute("UPDATE assignment SET finalized_at = now() - interval '10 days' WHERE id = %s", (reopened,))
    auto_finalize.run_due_auto_finalizes()
    assert _status(db, early)["status"] == "CLOSED"
    assert _status(db, reopened)["status"] == "CLOSED"


def test_owner_is_warned_three_days_before(db):
    warned, owner = _assignment(db, closed_days_ago=12)
    quiet, quiet_owner = _assignment(db, closed_days_ago=10)
    kinds = [(e["assignment_id"], e["kind"]) for e in PgNotificationRepository(db).list_for_user(owner)]
    assert (uuid.UUID(warned), "auto_finalize") in [(uuid.UUID(str(a)), k) for a, k in kinds]
    assert not [e for e in PgNotificationRepository(db).list_for_user(quiet_owner) if e["kind"] == "auto_finalize"]
    assert quiet
