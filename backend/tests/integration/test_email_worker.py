"""SQL จริงของ worker ส่งอีเมล (GAP-03): ส่งครั้งเดียว ไม่ส่งย้อนหลัง ลองใหม่เมื่อพลาด และเคารพเพดานรายวัน"""
import uuid
from contextlib import nullcontext
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from app import email_worker
from app.domain.assignment_service import Assignment, Criterion
from app.domain.models import Classroom, ClassroomMember, MemberRole, RosterRow
from app.domain.pairing import Side
from app.gmail_sender import GmailAuthError, GmailSendError
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_classroom_repo import PgClassroomRepository

pytestmark = pytest.mark.integration


@pytest.fixture
def room(db, monkeypatch):
    monkeypatch.setattr(email_worker, "transaction", lambda: nullcontext(db))
    owner = f"mail-owner-{uuid.uuid4().hex}@example.com"
    student = f"mail-student-{uuid.uuid4().hex}@example.com"
    with db.cursor() as cur:
        # ห้องอื่นใน database ของ dev ต้องไม่ถูกส่งระหว่าง test — ทุกอย่าง rollback เมื่อจบ test
        cur.execute("DELETE FROM email_worker_state")
        cur.execute("UPDATE classroom SET status = 'ARCHIVED' WHERE status = 'ACTIVE'")
        cur.execute("INSERT INTO email_worker_state (started_at) VALUES (now() - interval '1 hour')")
        cur.execute("INSERT INTO app_user (id, email_normalized, email_raw, status) VALUES (%s,%s,%s,'ACTIVE')",
                    (str(uuid.uuid4()), owner, owner))
    rooms = PgClassroomRepository(db)
    classroom = rooms.save(Classroom(id=str(uuid.uuid4()), name="Mail", slug=uuid.uuid4().hex,
                                    timezone="Asia/Bangkok", created_by=owner, created_at=datetime.now(UTC)))
    rooms.save_member(ClassroomMember(classroom.id, owner, MemberRole.OWNER))
    rooms.replace_roster(classroom.id, [RosterRow(2, student, student, "S")])
    assignments = PgAssignmentRepository(db)
    assignment = assignments.create(Assignment(
        id=str(uuid.uuid4()), classroom_id=classroom.id, name="Sprint", group_max_score=Decimal(15),
        individual_max_score=Decimal(0), group_deadline_utc=datetime(2099, 1, 1, tzinfo=UTC), created_by=owner,
        criteria=[Criterion(str(uuid.uuid4()), Side.GROUP, "UX", Decimal(100))]))
    return {"db": db, "student": student, "assignment": assignment, "assignments": assignments}


def publish(room, at):
    room["assignments"].mark_published(room["assignment"].id, seed=1, at=at)


def test_published_event_is_emailed_once_with_direct_link(room):
    publish(room, datetime.now(UTC) - timedelta(minutes=5))
    outbox = []
    assert email_worker.run_email_tick(outbox.append, web_base_url="https://web.example") == 1
    assert email_worker.run_email_tick(outbox.append, web_base_url="https://web.example") == 0
    assert [m["To"] for m in outbox] == [room["student"]]
    assert f"https://web.example/classrooms/{room['assignment'].classroom_id}/assignments/" \
           f"{room['assignment'].id}/evaluate" in outbox[0].get_content()


def test_events_before_worker_started_are_not_backfilled(room):
    publish(room, datetime.now(UTC) - timedelta(hours=2))
    outbox = []
    assert email_worker.run_email_tick(outbox.append) == 0
    assert outbox == []


def test_failed_send_is_retried_until_max_attempts(room):
    publish(room, datetime.now(UTC) - timedelta(minutes=5))

    def failing(_message):
        raise GmailSendError("Gmail API ตอบ 500")

    for _ in range(email_worker.MAX_ATTEMPTS + 2):
        assert email_worker.run_email_tick(failing) == 0
    with room["db"].cursor() as cur:
        cur.execute("SELECT d.status, d.attempts, d.last_error FROM email_delivery d JOIN app_user u ON u.id = d.user_id "
                    "WHERE u.email_normalized = %s", (room["student"],))
        assert cur.fetchall() == [{"status": "FAILED", "attempts": email_worker.MAX_ATTEMPTS,
                                   "last_error": "Gmail API ตอบ 500"}]
    outbox = []
    assert email_worker.run_email_tick(outbox.append) == 0


def test_failure_then_success_on_next_tick(room):
    publish(room, datetime.now(UTC) - timedelta(minutes=5))
    calls = []

    def flaky(message):
        calls.append(message)
        if len(calls) == 1:
            raise GmailSendError("timeout")

    assert email_worker.run_email_tick(flaky) == 0
    assert email_worker.run_email_tick(flaky) == 1
    assert len(calls) == 2


def test_auth_error_stops_the_tick_and_is_retried_later(room):
    publish(room, datetime.now(UTC) - timedelta(minutes=5))

    def revoked(_message):
        raise GmailAuthError("token endpoint ตอบ 400")

    with pytest.raises(GmailAuthError):
        email_worker.run_email_tick(revoked)
    outbox = []
    assert email_worker.run_email_tick(outbox.append) == 1


def test_daily_cap_defers_sending(room):
    publish(room, datetime.now(UTC) - timedelta(minutes=5))
    outbox = []
    assert email_worker.run_email_tick(outbox.append, daily_cap=0) == 0
    assert email_worker.run_email_tick(outbox.append, daily_cap=1) == 1


def test_withdrawn_student_gets_nothing(room):
    publish(room, datetime.now(UTC) - timedelta(minutes=5))
    with room["db"].cursor() as cur:
        cur.execute("UPDATE classroom_member SET enrollment_status = 'WITHDRAWN' WHERE user_id = "
                    "(SELECT id FROM app_user WHERE email_normalized = %s)", (room["student"],))
    outbox = []
    assert email_worker.run_email_tick(outbox.append) == 0
