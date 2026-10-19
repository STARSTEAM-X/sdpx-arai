"""ประกอบคะแนนส่วนตัวของนักศึกษา (PRD §9.4 / FR-REPORT-02) ให้ทุกทางใช้ชุดเดียวกัน

`/my-score` ของนักศึกษา, `/scores` ของอาจารย์ และ sheet Individual Summary ของ XLSX ต้องได้ตัวเลขเดียวกัน
ไฟล์นี้จึงอ่านข้อมูลจาก repository แล้วส่งเข้าสูตรใน `domain/scoring_service.py` เท่านั้น — ไม่มีสูตรของตัวเอง (AR-01)
"""

from dataclasses import dataclass
from decimal import Decimal

from psycopg import Connection

from app.domain.anonymity import individual_hidden
from app.domain.assignment_service import Assignment
from app.domain.pairing import Side
from app.domain.scoring_service import (
    compute_final_personal_score,
    compute_participation,
)
from app.repositories.pg_scoring_repo import ParticipationCount, PgScoringRepository


@dataclass(frozen=True)
class PersonalScore:
    user_id: str
    email: str
    label: str
    group_id: str | None
    group_label: str | None
    group_component: Decimal
    # คะแนนรายบุคคลจริงเสมอ — การซ่อนตาม k-anonymity เป็นเรื่องของผู้ดู (นักศึกษา) ไม่ใช่ของการคำนวณ
    individual_component: Decimal
    evaluator_count: int | None
    # True = นักศึกษาคนนี้ไม่เห็นคะแนนรายบุคคล/คะแนนรวมของตัวเอง เพราะผู้ประเมิน < k_min (US-15)
    individual_hidden: bool
    assigned: int
    submitted: int
    participation_ratio: Decimal
    participation_multiplier: Decimal
    final_score: Decimal


def personal_score(
    conn: Connection, assignment: Assignment, *, user_id: str, email: str, label: str,
    group_id: str | None, group_label: str | None, is_final: bool,
) -> PersonalScore:
    """คะแนนของนักศึกษาคนเดียว (`/my-score`) — ดึงเฉพาะแถวของคนนี้"""
    repo = PgScoringRepository(conn)
    group_component = (
        repo.effective_component_for_item(assignment.id, Side.GROUP, group_id, is_final=is_final)
        if group_id else Decimal(0)
    )
    individual_component = Decimal(0)
    evaluator_count: int | None = None
    if assignment.has_individual_side:
        evaluator_count = repo.evaluator_count_for_item(assignment.id, Side.INDIVIDUAL, user_id, is_final=is_final)
        individual_component = repo.effective_component_for_item(
            assignment.id, Side.INDIVIDUAL, user_id, is_final=is_final
        )
    return _assemble(
        assignment, user_id=user_id, email=email, label=label, group_id=group_id, group_label=group_label,
        group_component=group_component, individual_component=individual_component, evaluator_count=evaluator_count,
        group_p=repo.participation(assignment.id, Side.GROUP, email),
        indiv_p=repo.participation(assignment.id, Side.INDIVIDUAL, email),
    )


def class_personal_scores(conn: Connection, assignment: Assignment, *, is_final: bool) -> list[PersonalScore]:
    """ทุกนักศึกษาที่ยังลงทะเบียนอยู่ในห้อง — Individual Summary ของ FR-REPORT-02 (ผู้ถอนรายวิชาไม่แสดง)

    ดึงข้อมูลของทั้งงานเป็นชุด (สูงสุด 6 query ไม่ว่าห้องจะใหญ่แค่ไหน) แล้วประกอบด้วย `_assemble` ตัวเดียวกับ
    `personal_score` — เดิมเรียก `personal_score` ทีละคน = 4–7 query ต่อคน ทำให้ `/scores` ของห้อง 60 คน
    ใช้ 241 query และช้า 400–900ms บน staging (WS-07); test คุมไว้ที่ tests/integration/test_class_personal_scores.py
    """
    with conn.cursor() as cur:
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
    if not members:
        return []
    repo = PgScoringRepository(conn)
    group_components = repo.effective_components_by_item(assignment.id, Side.GROUP, is_final=is_final)
    group_participation = repo.participation_by_evaluator(assignment.id, Side.GROUP)
    indiv_participation = repo.participation_by_evaluator(assignment.id, Side.INDIVIDUAL)
    indiv_components: dict[str, Decimal] = {}
    evaluator_counts: dict[str, int] = {}
    if assignment.has_individual_side:
        indiv_components = repo.effective_components_by_item(assignment.id, Side.INDIVIDUAL, is_final=is_final)
        evaluator_counts = repo.evaluator_counts_by_item(assignment.id, Side.INDIVIDUAL)

    scores = []
    for m in members:
        user_id, email = str(m["id"]), m["email_normalized"]
        group_id = str(m["group_id"]) if m["group_id"] else None
        scores.append(_assemble(
            assignment, user_id=user_id, email=email, label=m["label"], group_id=group_id,
            group_label=m["group_name"],
            # ค่า default ตรงกับที่ query รายคนคืนเมื่อไม่มีแถว: คะแนน 0, ผู้ประเมิน 0, คู่ 0/0
            group_component=group_components.get(group_id, Decimal(0)) if group_id else Decimal(0),
            individual_component=indiv_components.get(user_id, Decimal(0)),
            evaluator_count=evaluator_counts.get(user_id, 0) if assignment.has_individual_side else None,
            group_p=group_participation.get(email, _NO_PAIRS),
            indiv_p=indiv_participation.get(email, _NO_PAIRS),
        ))
    return scores


_NO_PAIRS = ParticipationCount(assigned=0, submitted=0)


def _assemble(
    assignment: Assignment, *, user_id: str, email: str, label: str, group_id: str | None, group_label: str | None,
    group_component: Decimal, individual_component: Decimal, evaluator_count: int | None,
    group_p: ParticipationCount, indiv_p: ParticipationCount,
) -> PersonalScore:
    """ส่วนที่เป็นสูตรล้วน — ทั้งรายคนและทั้งห้องผ่านตรงนี้ ตัวเลขจึงออกมาชุดเดียวกันเสมอ"""
    # US-15: นักศึกษาไม่เห็นคะแนนรายบุคคลของตัวเองถ้าผู้ประเมินยังน้อยกว่า k_min (ไม่ต่ำกว่า 3 · GAP-01)
    hidden = evaluator_count is not None and individual_hidden(
        evaluator_count=evaluator_count, min_comparisons=assignment.min_comparisons)
    multiplier = compute_participation(
        assigned_group=group_p.assigned, submitted_group=group_p.submitted,
        assigned_individual=indiv_p.assigned, submitted_individual=indiv_p.submitted,
        completion_threshold=assignment.completion_threshold,
    )
    assigned = group_p.assigned + indiv_p.assigned
    submitted = group_p.submitted + indiv_p.submitted
    return PersonalScore(
        user_id=user_id, email=email, label=label, group_id=group_id, group_label=group_label,
        group_component=group_component, individual_component=individual_component,
        evaluator_count=evaluator_count, individual_hidden=hidden,
        assigned=assigned, submitted=submitted,
        # สัดส่วนที่แสดงผล — ตัวคูณจริงมาจาก compute_participation ด้านบน
        participation_ratio=Decimal(submitted) / Decimal(assigned) if assigned else Decimal(1),
        participation_multiplier=multiplier,
        final_score=compute_final_personal_score(
            group_component=group_component, individual_component=individual_component,
            participation_multiplier=multiplier,
        ),
    )
