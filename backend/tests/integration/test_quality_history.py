"""FR-QS-03 — หาเกณฑ์เดียวกันจากงานก่อนหน้าในห้องเดียวกัน เพื่อดูว่า QS-07 ต่ำติดต่อกันหรือไม่

ตรวจ SQL จริง เพราะเงื่อนไขที่ผิดง่ายคือ "งานก่อนหน้า" (published_at), "เกณฑ์เดียวกัน" (side + ชื่อ)
และขอบเขตห้องเรียน — fake repository พิสูจน์สามข้อนี้ไม่ได้
"""
import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from app.domain.assignment_service import Assignment, Criterion
from app.domain.models import Classroom, ClassroomMember, MemberRole
from app.domain.pairing import Side
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_classroom_repo import PgClassroomRepository
from app.repositories.pg_quality_repo import PgQualityRepository

pytestmark = pytest.mark.integration


def _room(db, owner: str) -> str:
    rooms = PgClassroomRepository(db)
    room = rooms.save(Classroom(id=str(uuid.uuid4()), name='QS-03', slug=uuid.uuid4().hex,
                                timezone='Asia/Bangkok', created_by=owner, created_at=datetime.now(UTC)))
    rooms.save_member(ClassroomMember(room.id, owner, MemberRole.OWNER))
    return room.id


def _assignment(db, room_id: str, owner: str, criteria: list[tuple[Side, str]], *, published: datetime | None,
                status: str = 'PUBLISHED') -> tuple[str, list[str]]:
    ids = [str(uuid.uuid4()) for _ in criteria]
    assignment = PgAssignmentRepository(db).create(Assignment(
        id=str(uuid.uuid4()), classroom_id=room_id, name='งาน', group_max_score=Decimal(15),
        individual_max_score=Decimal(5), group_deadline_utc=datetime(2099, 1, 1, tzinfo=UTC), created_by=owner,
        criteria=[Criterion(cid, side, name, Decimal(100)) for cid, (side, name) in zip(ids, criteria, strict=True)],
    ))
    with db.cursor() as cur:
        cur.execute('UPDATE assignment SET status = %s, published_at = %s WHERE id = %s',
                    (status, published, assignment.id))
    return assignment.id, ids


def test_earlier_criteria_match_side_and_name_newest_first_within_room(db):
    owner = f'qs03-{uuid.uuid4().hex}@example.com'
    with db.cursor() as cur:
        cur.execute("INSERT INTO app_user (id, email_normalized, email_raw, status) VALUES (%s,%s,%s,'ACTIVE')",
                    (str(uuid.uuid4()), owner, owner))
    room, other_room = _room(db, owner), _room(db, owner)
    day = lambda d: datetime(2026, 9, d, tzinfo=UTC)  # noqa: E731

    oldest, (oldest_ux,) = _assignment(db, room, owner, [(Side.GROUP, 'UX')], published=day(1))
    middle, (middle_ux, _) = _assignment(db, room, owner, [(Side.GROUP, '  ux '), (Side.INDIVIDUAL, 'UX')],
                                         published=day(8))
    _assignment(db, room, owner, [(Side.GROUP, 'Innovation')], published=day(10))
    _assignment(db, room, owner, [(Side.GROUP, 'UX')], published=None, status='DRAFT')
    _assignment(db, other_room, owner, [(Side.GROUP, 'UX')], published=day(9))
    current, _ = _assignment(db, room, owner, [(Side.GROUP, 'UX')], published=day(15))
    _assignment(db, room, owner, [(Side.GROUP, 'UX')], published=day(20))

    found = PgQualityRepository(db).earlier_criteria(current, Side.GROUP, 'UX')

    assert found == [(middle, middle_ux), (oldest, oldest_ux)]


def test_earlier_criteria_respects_limit(db):
    owner = f'qs03-limit-{uuid.uuid4().hex}@example.com'
    with db.cursor() as cur:
        cur.execute("INSERT INTO app_user (id, email_normalized, email_raw, status) VALUES (%s,%s,%s,'ACTIVE')",
                    (str(uuid.uuid4()), owner, owner))
    room = _room(db, owner)
    earlier = [_assignment(db, room, owner, [(Side.GROUP, 'UX')], published=datetime(2026, 9, d, tzinfo=UTC))
               for d in (1, 2, 3)]
    current, _ = _assignment(db, room, owner, [(Side.GROUP, 'UX')], published=datetime(2026, 9, 4, tzinfo=UTC))

    found = PgQualityRepository(db).earlier_criteria(current, Side.GROUP, 'UX', limit=2)

    assert [assignment_id for assignment_id, _ in found] == [earlier[2][0], earlier[1][0]]


def _split_votes(db, assignment_id: str, criterion_id: str, *, agree: bool) -> None:
    """คู่เดียว ผู้ประเมิน 5 คน · agree=False → 3 เลือก A 2 เลือก B (u = −0.2 ติด QS-07) · agree=True → ทุกคนเลือก A"""
    item_a, item_b = str(uuid.uuid4()), str(uuid.uuid4())
    with db.cursor() as cur:
        for k in range(5):
            email = f'rater-{uuid.uuid4().hex}@example.com'
            user_id = str(uuid.uuid4())
            cur.execute("INSERT INTO app_user (id, email_normalized, email_raw, status) VALUES (%s,%s,%s,'ACTIVE')",
                        (user_id, email, email))
            pair_id = str(uuid.uuid4())
            cur.execute('''INSERT INTO pair_assignment (id, assignment_id, criterion_id, side, item_a_id, item_b_id,
                           evaluator_user_id, display_left_item_id) VALUES (%s,%s,%s,'GROUP',%s,%s,%s,%s)''',
                        (pair_id, assignment_id, criterion_id, item_a, item_b, user_id, item_a))
            choice = 2 if agree or k < 3 else 5
            cur.execute('''INSERT INTO comparison (id, pair_assignment_id, evaluator_user_id, choice, status, submitted_at)
                           VALUES (%s,%s,%s,%s,'SUBMITTED', now())''', (str(uuid.uuid4()), pair_id, user_id, choice))


def _quality(db, monkeypatch, assignment_id: str, owner: str):
    from contextlib import nullcontext

    from app.api import quality
    monkeypatch.setattr(quality, 'transaction', lambda: nullcontext(db))
    return quality.quality_report(assignment_id, owner)


@pytest.mark.parametrize(('earlier_agree', 'expected_streak', 'expected_flags'), [
    (False, 2, ['QS-07', 'QS-07-REPEATED']),
    (True, 1, ['QS-07']),
])
def test_quality_report_flags_criterion_low_in_consecutive_assignments(
    db, monkeypatch, earlier_agree, expected_streak, expected_flags,
):
    owner = f'qs03-report-{uuid.uuid4().hex}@example.com'
    with db.cursor() as cur:
        cur.execute("INSERT INTO app_user (id, email_normalized, email_raw, status) VALUES (%s,%s,%s,'ACTIVE')",
                    (str(uuid.uuid4()), owner, owner))
    room = _room(db, owner)
    earlier, (earlier_ux,) = _assignment(db, room, owner, [(Side.GROUP, 'UX')], published=datetime(2026, 9, 1, tzinfo=UTC))
    current, (current_ux,) = _assignment(db, room, owner, [(Side.GROUP, 'UX')], published=datetime(2026, 9, 8, tzinfo=UTC))
    _split_votes(db, earlier, earlier_ux, agree=earlier_agree)
    _split_votes(db, current, current_ux, agree=False)

    criterion = _quality(db, monkeypatch, current, owner).criteria[0]

    assert criterion['agreement'] == -0.2
    assert criterion['lowAgreementStreak'] == expected_streak
    assert criterion['flags'] == expected_flags
