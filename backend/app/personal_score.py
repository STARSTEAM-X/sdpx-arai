"""ประกอบคะแนนส่วนตัวของนักศึกษา (PRD §9.4 / FR-REPORT-02) ให้ทุกทางใช้ชุดเดียวกัน

`/my-score` ของนักศึกษา, `/scores` ของอาจารย์ และ sheet Individual Summary ของ XLSX ต้องได้ตัวเลขเดียวกัน
ไฟล์นี้จึงอ่านข้อมูลจาก repository แล้วส่งเข้าสูตรใน `domain/scoring_service.py` เท่านั้น — ไม่มีสูตรของตัวเอง (AR-01)
"""

from dataclasses import dataclass
from decimal import Decimal

from psycopg import Connection

from app.domain.assignment_service import Assignment
from app.domain.pairing import Side
from app.domain.scoring_service import (
    compute_final_personal_score,
    compute_participation,
)
from app.repositories.pg_scoring_repo import PgScoringRepository


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
    repo = PgScoringRepository(conn)
    group_component = (
        repo.effective_component_for_item(assignment.id, Side.GROUP, group_id, is_final=is_final)
        if group_id else Decimal(0)
    )
    individual_component = Decimal(0)
    evaluator_count: int | None = None
    hidden = False
    if assignment.has_individual_side:
        evaluator_count = repo.evaluator_count_for_item(assignment.id, Side.INDIVIDUAL, user_id, is_final=is_final)
        hidden = evaluator_count < assignment.min_comparisons
        individual_component = repo.effective_component_for_item(
            assignment.id, Side.INDIVIDUAL, user_id, is_final=is_final
        )
    group_p = repo.participation(assignment.id, Side.GROUP, email)
    indiv_p = repo.participation(assignment.id, Side.INDIVIDUAL, email)
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


def class_personal_scores(conn: Connection, assignment: Assignment, *, is_final: bool) -> list[PersonalScore]:
    """ทุกนักศึกษาที่ยังลงทะเบียนอยู่ในห้อง — Individual Summary ของ FR-REPORT-02 (ผู้ถอนรายวิชาไม่แสดง)"""
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
    return [
        personal_score(
            conn, assignment, user_id=str(m["id"]), email=m["email_normalized"], label=m["label"],
            group_id=str(m["group_id"]) if m["group_id"] else None, group_label=m["group_name"], is_final=is_final,
        )
        for m in members
    ]
