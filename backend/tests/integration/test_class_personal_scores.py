"""`/scores` ทั้งห้องต้องได้ตัวเลขเดียวกับ `/my-score` รายคน และจำนวน query ต้องไม่โตตามจำนวนนักศึกษา

ที่มา: load test บน staging (run 39307566940) วัด `GET /scores` ฝั่ง server ได้ 408–915ms
เพราะ `class_personal_scores` เรียก `personal_score` ทีละคน = 4 query ต่อคน (241 query ที่ 60 คน)
test ชุดนี้ล็อกสองเรื่อง:
1. ตัวเลข — ใช้ `personal_score` (ทางที่ `/my-score` ใช้) เป็นตัวเทียบ ทั้งค่าและ scale ของ Decimal
   ครอบ override ทั้ง item, override รายเกณฑ์, ผู้ประเมินที่ถูกตัดออก, คนไม่มีกลุ่ม และคนถอนรายวิชา
2. จำนวน query — เท่ากันไม่ว่าห้องจะมี 12 หรือ 28 คน
"""

import uuid
from contextlib import nullcontext
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from psycopg import Cursor
from starlette.requests import Request

from app.api import assignments as assignments_api
from app.domain.anonymity import K_MIN_FLOOR
from app.domain.assignment_service import Assignment, Criterion
from app.domain.models import Classroom, ClassroomMember, MemberRole, RosterRow
from app.domain.pairing import Side
from app.personal_score import class_personal_scores, personal_score
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_classroom_repo import PgClassroomRepository
from app.repositories.pg_comparison_repo import PgComparisonRepository
from app.repositories.pg_scoring_repo import PgScoringRepository
from app.scoring_orchestrator import run_recompute

pytestmark = pytest.mark.integration

NOW = datetime(2026, 10, 20, 3, 0, tzinfo=UTC)


def _scenario(db, monkeypatch, *, students: int, individual: bool) -> Assignment:
    """ห้องที่มีคะแนนชั่วคราวแล้ว พร้อมกรณีขอบที่สูตรรายคนต้องจัดการ"""
    owner = f"owner-{uuid.uuid4().hex}@example.com"
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO app_user (id, email_normalized, email_raw, status) VALUES (%s,%s,%s,'ACTIVE')",
            (str(uuid.uuid4()), owner, owner),
        )
    rooms = PgClassroomRepository(db)
    room = rooms.save(Classroom(
        id=str(uuid.uuid4()), name="Batch scores", slug=uuid.uuid4().hex, timezone="Asia/Bangkok",
        created_by=owner, created_at=NOW,
    ))
    rooms.save_member(ClassroomMember(room.id, owner, MemberRole.OWNER))
    rows = [
        RosterRow(i + 2, f"s{i}-{uuid.uuid4().hex}@example.com", f"raw{i}@example.com", f"Group-{i // 4}")
        for i in range(students)
    ]
    rooms.replace_roster(room.id, rows)

    criteria = [
        Criterion(str(uuid.uuid4()), Side.GROUP, "UX", Decimal(60)),
        Criterion(str(uuid.uuid4()), Side.GROUP, "Code", Decimal(40)),
    ]
    if individual:
        criteria.append(Criterion(str(uuid.uuid4()), Side.INDIVIDUAL, "Teamwork", Decimal(100)))
    repo = PgAssignmentRepository(db)
    assignment = repo.create(Assignment(
        id=str(uuid.uuid4()), classroom_id=room.id, name="Batch", group_max_score=Decimal(15),
        individual_max_score=Decimal(5) if individual else Decimal(0),
        group_deadline_utc=datetime(2099, 1, 1, tzinfo=UTC),
        individual_deadline_utc=datetime(2099, 1, 1, tzinfo=UTC) if individual else None,
        created_by=owner, target_coverage=2, criteria=criteria,
    ))
    monkeypatch.setattr(assignments_api, "transaction", lambda: nullcontext(db))
    assignments_api.publish_assignment(assignment.id, owner, Request({"type": "http", "client": ("127.0.0.1", 1)}), 7)

    # นักศึกษาส่งคำตอบไม่เท่ากัน — participation และจำนวนผู้ประเมินจึงต่างกันรายคน
    answers = PgComparisonRepository(db)
    sides = [Side.GROUP, Side.INDIVIDUAL] if individual else [Side.GROUP]
    for index, row in enumerate(rows):
        for side in sides:
            pairs = repo.my_pairs(assignment.id, side=side, evaluator_email=row.email_normalized)
            # ฝั่งรายบุคคลตอบครบทุกคู่: กลุ่ม 4 คนได้คู่ครบทุกคนในกลุ่ม (C(3,2) = 3 คู่) จำนวนผู้ประเมินรายคน
            # จึงเท่ากับจำนวนเพื่อนในกลุ่มที่กดส่งเสมอ ไม่ขึ้นกับลำดับคู่ที่สุ่มจาก uuid
            # (ถ้าตอบแค่บางคู่ บางรอบไม่มีใครได้ถึง 3 คน แล้วทุกคนถูกซ่อนตามเกณฑ์ขั้นต่ำของ GAP-01)
            answered = pairs if side is Side.INDIVIDUAL else pairs[: index % 3 + 1]
            for n, pair in enumerate(answered):
                answers.save(pair.pair_assignment_id, choice=1 + (index + n) % 6, time_on_task_ms=6000, now=NOW)
            if index % 4 != 3:  # ทุกคนที่สี่ตอบไว้แต่ไม่กดส่ง
                answers.submit_all(assignment_id=assignment.id, side=side, evaluator_email=row.email_normalized, now=NOW)

    assignment = repo.get(assignment.id)
    run_recompute(db, assignment, is_final=False, now=NOW)

    scoring = PgScoringRepository(db)
    groups = {g.name: g.id for g in repo.groups_with_members(room.id)}
    # override ทั้ง item ของกลุ่มแรก + override รายเกณฑ์ของกลุ่มที่สอง
    scoring.create_override(
        assignment_id=assignment.id, side=Side.GROUP, item_id=groups["Group-0"], criterion_id=None,
        original_value=Decimal(0), override_value=Decimal("12.50"), reason="ปรับตามหลักฐาน",
        created_by_email=owner, now=NOW,
    )
    scoring.create_override(
        assignment_id=assignment.id, side=Side.GROUP, item_id=groups["Group-1"], criterion_id=criteria[0].id,
        original_value=Decimal(0), override_value=Decimal("7.25"), reason="ปรับเกณฑ์ UX",
        created_by_email=owner, now=NOW,
    )
    with db.cursor() as cur:
        cur.execute("SELECT id, email_normalized FROM app_user WHERE email_normalized = ANY(%s)", ([r.email_normalized for r in rows],))
        ids = {r["email_normalized"]: str(r["id"]) for r in cur.fetchall()}
        # ผู้ประเมินที่อาจารย์ตัดออก — ไม่นับเป็นผู้ประเมินของ item แต่ participation ยังได้
        cur.execute(
            "INSERT INTO assignment_exclusion (assignment_id, evaluator_user_id, excluded, reason) VALUES (%s,%s,true,'ตัดออก')",
            (assignment.id, ids[rows[1].email_normalized]),
        )
        if individual:
            # override คะแนนรายบุคคลของคนหนึ่ง
            scoring.create_override(
                assignment_id=assignment.id, side=Side.INDIVIDUAL, item_id=ids[rows[2].email_normalized],
                criterion_id=None, original_value=Decimal(0), override_value=Decimal("4.00"),
                reason="ปรับรายบุคคล", created_by_email=owner, now=NOW,
            )
        # คนไม่มีกลุ่ม (คะแนนกลุ่มต้องเป็น 0) และคนถอนรายวิชา (ต้องไม่อยู่ในรายงาน)
        cur.execute(
            "UPDATE classroom_member SET group_id = NULL WHERE classroom_id = %s AND user_id = %s",
            (room.id, ids[rows[-1].email_normalized]),
        )
        cur.execute(
            "UPDATE classroom_member SET enrollment_status = 'WITHDRAWN' WHERE classroom_id = %s AND user_id = %s",
            (room.id, ids[rows[-2].email_normalized]),
        )
        if individual:
            # ตั้ง k ให้อยู่ที่ค่าสูงสุดที่เกิดจริง ห้องจึงมีทั้งคนที่ถูกซ่อนคะแนน (< k) และไม่ถูกซ่อน (= k)
            # k_min ไม่ต่ำกว่า K_MIN_FLOOR เสมอ (GAP-01) จึงต้องมีคนที่ได้ผู้ประเมินถึงเกณฑ์นั้นจริง
            counts = [
                scoring.evaluator_count_for_item(assignment.id, Side.INDIVIDUAL, ids[r.email_normalized])
                for r in rows[:-2]
            ]
            assert min(counts) < max(counts), f"scenario ต้องมีจำนวนผู้ประเมินต่างกัน: {counts}"
            assert max(counts) >= K_MIN_FLOOR, f"scenario ต้องมีคนที่ได้ผู้ประเมินถึง {K_MIN_FLOOR}: {counts}"
            cur.execute("UPDATE assignment SET min_comparisons = %s WHERE id = %s", (max(counts), assignment.id))
    return repo.get(assignment.id)


def _oracle(db, assignment: Assignment) -> list:
    """คำนวณทีละคนด้วยทางของ `/my-score` — ลำดับตาม query รายชื่อเดิม"""
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT u.id, u.email_normalized, COALESCE(u.display_name, u.email_normalized) AS label,
                   m.group_id, g.name AS group_name
            FROM classroom_member m JOIN app_user u ON u.id = m.user_id
            LEFT JOIN group_entity g ON g.id = m.group_id
            WHERE m.classroom_id = %s AND m.role = 'STUDENT' AND m.enrollment_status = 'ACTIVE'
            ORDER BY g.name NULLS LAST, label
            """,
            (assignment.classroom_id,),
        )
        members = cur.fetchall()
    return [
        personal_score(
            db, assignment, user_id=str(m["id"]), email=m["email_normalized"], label=m["label"],
            group_id=str(m["group_id"]) if m["group_id"] else None, group_label=m["group_name"], is_final=False,
        )
        for m in members
    ]


@pytest.mark.parametrize("individual", [False, True], ids=["group-only", "group+individual"])
def test_ทั้งห้องได้ตัวเลขเดียวกับรายคนทุกช่อง(db, monkeypatch, individual):
    assignment = _scenario(db, monkeypatch, students=12, individual=individual)

    batch = class_personal_scores(db, assignment, is_final=False)
    expected = _oracle(db, assignment)

    assert batch == expected
    # dataclass เทียบ Decimal ด้วยค่า (8 == 8.00) — แต่ JSON ที่ส่งออกใช้ str จึงต้องตรง scale ด้วย
    assert [repr(p) for p in batch] == [repr(p) for p in expected]
    # ให้แน่ใจว่า scenario ครอบกรณีขอบจริง ไม่ใช่เทียบศูนย์กับศูนย์
    assert any(p.group_id is None and p.group_component == 0 for p in batch)
    assert len({p.group_component for p in batch}) > 2
    assert len({p.participation_multiplier for p in batch}) > 1
    if individual:
        assert any(p.individual_hidden for p in batch) and any(not p.individual_hidden for p in batch)
        assert any(p.individual_component == Decimal("4.00") for p in batch), [
            (p.label[:4], p.individual_component, p.evaluator_count) for p in batch
        ]


def _count_queries(monkeypatch) -> dict:
    counter = {"n": 0}
    original = Cursor.execute

    def counting(self, *args, **kwargs):
        counter["n"] += 1
        return original(self, *args, **kwargs)

    monkeypatch.setattr(Cursor, "execute", counting)
    return counter


@pytest.mark.parametrize("individual", [False, True], ids=["group-only", "group+individual"])
def test_จำนวน_query_ไม่โตตามจำนวนนักศึกษา(db, monkeypatch, individual):
    small = _scenario(db, monkeypatch, students=12, individual=individual)
    large = _scenario(db, monkeypatch, students=28, individual=individual)

    counts = []
    for assignment in (small, large):
        counter = _count_queries(monkeypatch)
        result = class_personal_scores(db, assignment, is_final=False)
        counts.append(counter["n"])
        monkeypatch.undo()
        assert result

    assert counts[0] == counts[1], f"query โตตามจำนวนคน: 12 คน={counts[0]}, 28 คน={counts[1]}"
    assert counts[1] <= 6
