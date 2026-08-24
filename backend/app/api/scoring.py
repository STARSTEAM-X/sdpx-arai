"""endpoint ของการคำนวณ ประกาศ และดูคะแนน — US-13, US-15, US-16

route บาง: โหลด assignment, ตรวจสิทธิ์, เรียก scoring_service (pure), บันทึกผ่าน
PgScoringRepository กฎว่า finalize ได้เมื่อไรอยู่ใน finalize_service ซึ่งทดสอบได้โดยไม่ต้องมี DB
"""

import csv
import io
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from app.auth import CurrentUser
from app.db import transaction
from app.domain.access import Capability, ClassroomAccess
from app.domain.anonymity import pseudonymize_evaluators
from app.domain.audit import AuditAction, AuditEvent
from app.domain.assignment_service import Assignment, AssignmentStatus
from app.domain.errors import NotFoundError, ValidationError
from app.domain.finalize_service import (
    assert_before_finalize,
    assert_can_override,
    assert_finalizable,
    assert_reopenable,
)
from app.domain.pairing import Side
from app.domain.scoring_service import (
    LOW_CONFIDENCE,
    compute_final_personal_score,
    compute_item_component,
    compute_participation,
)
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_audit_repo import PgAuditRepository
from app.repositories.pg_classroom_repo import PgClassroomRepository
from app.repositories.pg_scoring_repo import ComparisonExportRow, PgScoringRepository

router = APIRouter(prefix="/api/assignments", tags=["scoring"])

# k-anonymity threshold (FR-ANON-02) — PRD ไม่มีคอลัมน์แยกสำหรับค่านี้ ใช้ min_comparisons
# ของ assignment ตัวเดียวกัน เพราะทั้งคู่มีความหมายเดียวกัน: "ต้องมีอย่างน้อย N observation
# ก่อนถึงจะเชื่อ/แสดงผลลัพธ์ได้"


def _load_for_instructor(conn, assignment_id: str, user_email: str) -> Assignment:
    repo = PgAssignmentRepository(conn)
    assignment = repo.get(assignment_id)
    if assignment is None:
        raise NotFoundError("ไม่พบงานประเมินนี้")
    ClassroomAccess(PgClassroomRepository(conn)).require(
        assignment.classroom_id, user_email, Capability.MANAGE_ASSIGNMENT
    )
    return assignment


def _run_recompute(conn, assignment: Assignment, *, is_final: bool, now: datetime) -> bool:
    """คำนวณทุก item ทุกฝั่งแล้วบันทึก คืนว่ามี LOW_CONFIDENCE item หลงเหลือไหม (S8)"""
    scoring_repo = PgScoringRepository(conn)
    has_low_confidence = False

    sides = [Side.GROUP]
    if assignment.has_individual_side:
        sides.append(Side.INDIVIDUAL)

    for side in sides:
        comparisons = scoring_repo.submitted_comparisons(assignment.id, side)
        criteria = scoring_repo.criteria_for(assignment.id, side)
        items = scoring_repo.items_for_side(assignment.classroom_id, side)
        max_score = assignment.group_max_score if side is Side.GROUP else assignment.individual_max_score

        components = [
            compute_item_component(
                comparisons, item_id, side, criteria,
                max_score_side=max_score,
                floor=assignment.score_floor,
                ceiling=assignment.score_ceiling,
                instructor_weight=assignment.instructor_weight,
                min_comparisons=assignment.min_comparisons,
            )
            for item_id in items
        ]
        scoring_repo.save_computed_scores(assignment.id, components, is_final=is_final, now=now)
        if any(LOW_CONFIDENCE in c.flags for c in components):
            has_low_confidence = True

    return has_low_confidence


class RecomputeOut(BaseModel):
    hasLowConfidenceItems: bool
    computedAt: datetime


@router.post("/{assignment_id}:recompute", response_model=RecomputeOut)
def recompute_scores(assignment_id: str, user_email: CurrentUser) -> RecomputeOut:
    """คำนวณคะแนนชั่วคราวใหม่ (`is_final=false`) — เรียกได้ตลอดหลัง publish ไม่ต้องรอ deadline
    ใช้ดูความคืบหน้าระหว่างทาง (FR-SCORE-06 บอกว่าคำนวณใหม่ทุกวัน + on-demand)
    """
    with transaction() as conn:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        now = datetime.now(UTC)
        has_low_confidence = _run_recompute(conn, assignment, is_final=False, now=now)

    return RecomputeOut(hasLowConfidenceItems=has_low_confidence, computedAt=now)


class FinalizeIn(BaseModel):
    confirmLowConfidence: bool = False


class FinalizeOut(BaseModel):
    status: str
    finalizedAt: datetime
    hadLowConfidenceItems: bool


@router.post("/{assignment_id}:finalize", response_model=FinalizeOut)
def finalize_assignment(
    assignment_id: str, body: FinalizeIn, user_email: CurrentUser, request: Request
) -> FinalizeOut:
    """ตัดสินและประกาศคะแนน (US-13) — เฉพาะ OWNER (`FINALIZE_SCORES`), ต้องเลย deadline แล้ว

    คำนวณด้วย `is_final=True` ทับ interim เดิม แล้ว snapshot ไว้เป็นคะแนนที่เชื่อถือได้
    ตรวจย้อนหลังได้แม้สูตรจะเปลี่ยนไปแล้ว (FR-SCORE-09) เพราะ `computed_score` เก็บ
    `formula_version` และค่าที่คำนวณได้ ณ ตอนนั้นไว้ตรง ๆ ไม่ใช่สูตรที่คำนวณสด
    """
    with transaction() as conn:
        repo = PgAssignmentRepository(conn)
        assignment = repo.get(assignment_id)
        if assignment is None:
            raise NotFoundError("ไม่พบงานประเมินนี้")

        # FINALIZE_SCORES เป็นของ OWNER เท่านั้น (คนละ capability กับ MANAGE_ASSIGNMENT
        # ที่ CO_TEACHER ก็มี) — การตัดสินคะแนนสุดท้ายย้อนกลับไม่ได้
        ClassroomAccess(PgClassroomRepository(conn)).require(
            assignment.classroom_id, user_email, Capability.FINALIZE_SCORES
        )

        now = datetime.now(UTC)
        assert_finalizable(now=now, deadline=assignment.group_deadline_utc, status=str(assignment.status))

        has_low_confidence = _run_recompute(conn, assignment, is_final=True, now=now)
        assert_before_finalize(
            has_low_confidence_items=has_low_confidence, confirmed=body.confirmLowConfidence
        )

        repo.mark_finalized(assignment_id, at=now)

        PgAuditRepository(conn).record(
            AuditEvent(
                actor_email=user_email,
                action=AuditAction.SCORES_FINALIZED,
                resource_type="assignment",
                resource_id=assignment_id,
                classroom_id=assignment.classroom_id,
                before_state={"status": str(assignment.status)},
                after_state={"status": "FINALIZED", "hadLowConfidenceItems": has_low_confidence},
                ip=request.client.host if request.client else None,
            )
        )

    return FinalizeOut(status="FINALIZED", finalizedAt=now, hadLowConfidenceItems=has_low_confidence)


class ReopenIn(BaseModel):
    reason: str = Field(min_length=1)


class ReopenOut(BaseModel):
    status: str


@router.post("/{assignment_id}:reopen", response_model=ReopenOut)
def reopen_assignment(
    assignment_id: str, body: ReopenIn, user_email: CurrentUser, request: Request
) -> ReopenOut:
    """เปิดคะแนนที่ finalize แล้วกลับมาแก้ — ต้องมีเหตุผลเสมอ (ACTIONS_REQUIRING_REASON)
    เพราะการทำ FINALIZED ที่นักศึกษาเห็นแล้วกลับไปเป็นชั่วคราวใหม่กระทบความเชื่อมั่นโดยตรง
    """
    with transaction() as conn:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        ClassroomAccess(PgClassroomRepository(conn)).require(
            assignment.classroom_id, user_email, Capability.FINALIZE_SCORES
        )
        assert_reopenable(status=str(assignment.status))
        reason = body.reason.strip()
        if not reason:
            raise ValidationError("ต้องระบุเหตุผลก่อน reopen", field="reason")

        PgAssignmentRepository(conn).mark_reopened(assignment_id)

        PgAuditRepository(conn).record(
            AuditEvent(
                actor_email=user_email,
                action=AuditAction.SCORES_REOPENED,
                resource_type="assignment",
                resource_id=assignment_id,
                classroom_id=assignment.classroom_id,
                before_state={"status": "FINALIZED"},
                after_state={"status": "CLOSED"},
                reason=reason,
                ip=request.client.host if request.client else None,
            )
        )

    return ReopenOut(status="CLOSED")


def _rows_to_csv(rows: list[ComparisonExportRow], *, evaluator_column: dict[str, str]) -> str:
    """CSV ดิบของ comparison — FR-EXPORT-03

    `evaluator_column` คือ map `evaluator_user_id → ค่าที่จะโชว์ในคอลัมน์นั้นจริง ๆ`
    ผู้เรียกเป็นคนตัดสินว่าจะส่ง pseudonym หรืออีเมลจริงเข้ามา ฟังก์ชันนี้แค่ประกอบ CSV
    ไม่รู้ด้วยซ้ำว่ากำลังเขียนตัวตนจริงหรือรหัสลับ — privacy decision อยู่ที่ผู้เรียกทั้งหมด

    ใช้ UTF-8 BOM (`﻿`) ตาม FR-EXPORT-01 กันข้อความไทยเพี้ยนตอนเปิดด้วย Excel
    """
    buf = io.StringIO()
    buf.write("﻿")
    writer = csv.writer(buf)
    writer.writerow(
        ["side", "criterion", "item_a", "item_b", "shown_left", "choice", "evaluator", "submitted_at"]
    )
    for r in rows:
        writer.writerow(
            [
                str(r.side),
                r.criterion_name,
                r.item_a_label,
                r.item_b_label,
                r.item_a_label if r.display_left_item_id == r.item_a_id else r.item_b_label,
                r.choice,
                evaluator_column[r.evaluator_user_id],
                r.submitted_at.isoformat(),
            ]
        )
    return buf.getvalue()


@router.get("/{assignment_id}/comparisons:export")
def export_comparisons(assignment_id: str, user_email: CurrentUser) -> Response:
    """ส่งออก raw comparison เป็น CSV — ค่าเริ่มต้นซ่อนตัวตนผู้ประเมิน (FR-EXPORT-03)

    ผู้ประเมินแสดงเป็นรหัส `E1, E2, ...` ที่สุ่มลำดับใหม่ทุกครั้งที่ export (ดู
    `pseudonymize_evaluators`) ไม่ใช่ตัวตนจริงหรือ uuid ดิบ — เปิดดูตัวตนจริงต้องเรียก
    `:export-identified` แทน ซึ่งจำกัดไว้เฉพาะ OWNER และบันทึก audit ทุกครั้ง (FR-EXPORT-04)
    """
    with transaction() as conn:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        rows = PgScoringRepository(conn).export_comparisons(assignment_id)

    pseudonyms = pseudonymize_evaluators([r.evaluator_user_id for r in rows])
    csv_text = _rows_to_csv(rows, evaluator_column=pseudonyms)

    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="comparisons_{assignment_id}.csv"'
        },
    )


class ExportIdentifiedIn(BaseModel):
    reason: str = Field(min_length=1)


@router.post("/{assignment_id}/comparisons:export-identified")
def export_comparisons_identified(
    assignment_id: str, body: ExportIdentifiedIn, user_email: CurrentUser, request: Request
) -> Response:
    """ส่งออก raw comparison พร้อมอีเมลจริงของผู้ประเมิน — เฉพาะ OWNER (FR-EXPORT-04)

    ต้องระบุเหตุผลเสมอ (คือการ "ยืนยันเจตนา" ตาม AC — สอดคล้องกับ pattern เดียวกับ
    reopen/score-override ที่ endpoint อื่นในไฟล์นี้ใช้) และถูกบันทึกลง audit log ทุกครั้ง
    ไม่มีทางเรียกสำเร็จแล้วไม่มีร่องรอยเลย (`AuditAction.IDENTIFIED_EXPORT`)
    """
    with transaction() as conn:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        ClassroomAccess(PgClassroomRepository(conn)).require(
            assignment.classroom_id, user_email, Capability.VIEW_EVALUATOR_IDENTITY
        )

        rows = PgScoringRepository(conn).export_comparisons(assignment_id)
        evaluator_ids = {r.evaluator_user_id for r in rows}

        emails: dict[str, str] = {}
        if evaluator_ids:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, email_normalized FROM app_user WHERE id = ANY(%s)",
                    (list(evaluator_ids),),
                )
                emails = {str(row["id"]): row["email_normalized"] for row in cur.fetchall()}

        csv_text = _rows_to_csv(rows, evaluator_column=emails)

        PgAuditRepository(conn).record(
            AuditEvent(
                actor_email=user_email,
                action=AuditAction.IDENTIFIED_EXPORT,
                resource_type="assignment",
                resource_id=assignment_id,
                classroom_id=assignment.classroom_id,
                before_state=None,
                after_state={"rowCount": len(rows)},
                reason=body.reason.strip(),
                ip=request.client.host if request.client else None,
            )
        )

    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                f'attachment; filename="comparisons_identified_{assignment_id}.csv"'
            )
        },
    )


class ScoreOverrideIn(BaseModel):
    side: Side
    itemId: str
    criterionId: str | None = None
    overrideValue: Decimal
    reason: str = Field(min_length=1)


class ScoreOverrideOut(BaseModel):
    id: str
    originalValue: Decimal
    overrideValue: Decimal


@router.post("/{assignment_id}/score-overrides", response_model=ScoreOverrideOut, status_code=201)
def create_score_override(
    assignment_id: str, body: ScoreOverrideIn, user_email: CurrentUser, request: Request
) -> ScoreOverrideOut:
    with transaction() as conn:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        ClassroomAccess(PgClassroomRepository(conn)).require(
            assignment.classroom_id, user_email, Capability.FINALIZE_SCORES
        )
        assert_can_override(reason=body.reason)

        scoring_repo = PgScoringRepository(conn)
        original = scoring_repo.latest_override_value(
            assignment_id, body.side, body.itemId, body.criterionId
        )
        if original is None:
            original = scoring_repo.component_for_item(
                assignment_id, body.side, body.itemId, is_final=True
            )

        now = datetime.now(UTC)
        override_id = scoring_repo.create_override(
            assignment_id=assignment_id, side=body.side, item_id=body.itemId,
            criterion_id=body.criterionId, original_value=original,
            override_value=body.overrideValue, reason=body.reason.strip(),
            created_by_email=user_email, now=now,
        )

        # FR-AUDIT-02 — ต้องมี actor, ก่อน/หลัง, เหตุผล, เวลา UTC ครบ
        PgAuditRepository(conn).record(
            AuditEvent(
                actor_email=user_email,
                action=AuditAction.SCORE_OVERRIDDEN,
                resource_type="score_override",
                resource_id=override_id,
                classroom_id=assignment.classroom_id,
                before_state={"value": str(original)},
                after_state={"value": str(body.overrideValue)},
                reason=body.reason.strip(),
                ip=request.client.host if request.client else None,
            )
        )

    return ScoreOverrideOut(id=override_id, originalValue=original, overrideValue=body.overrideValue)


class ComputedScoreOut(BaseModel):
    itemId: str
    side: Side
    itemLabel: str
    component: Decimal
    flags: list[str]


class ScoresOut(BaseModel):
    isFinal: bool
    items: list[ComputedScoreOut]


@router.get("/{assignment_id}/scores", response_model=ScoresOut)
def list_scores(assignment_id: str, user_email: CurrentUser) -> ScoresOut:
    """คะแนนที่คำนวณล่าสุดของทุก item ในงานนี้ — ให้อาจารย์เห็นก่อนตัดสินใจ finalize (US-13)

    คืนคะแนน**ชั่วคราว** (`is_final=false`) เสมอถ้างานยังไม่ FINALIZED และคืนคะแนน**สุดท้าย**
    เมื่อ FINALIZED แล้ว — ฝั่งหน้าเว็บเป็นคนติด label "ชั่วคราว — อาจเปลี่ยนแปลงได้" ตาม `isFinal`
    ที่ตอบกลับมา (AC ของ US-13 บังคับให้ label นี้ต้องกำกับคะแนนที่ยังไม่ finalize ทุกที่ที่แสดง)

    จำกัดไว้ฝั่งอาจารย์เท่านั้น — ไม่เปิดให้นักศึกษาเรียก เพราะคะแนนชั่วคราวรายบุคคลระหว่างทาง
    ขัดกับ AC ของ US-15 ที่ห้ามนักศึกษาเห็นค่าก่อน/หลังที่จะอนุมานได้ว่าใครเพิ่งประเมิน
    (`my-score` ของนักศึกษาจึงยังคงล็อกไว้ที่ FINALIZED เท่านั้นเหมือนเดิม ไม่เกี่ยวกับ endpoint นี้)
    """
    with transaction() as conn:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        is_final = assignment.status == AssignmentStatus.FINALIZED
        rows = PgScoringRepository(conn).list_computed_scores(assignment_id, is_final=is_final)

    return ScoresOut(
        isFinal=is_final,
        items=[
            ComputedScoreOut(
                itemId=r.item_id, side=r.side, itemLabel=r.item_label,
                component=r.component, flags=list(r.flags),
            )
            for r in rows
        ],
    )


class MyScoreOut(BaseModel):
    finalized: bool
    message: str | None = None
    groupComponent: Decimal | None = None
    individualComponent: Decimal | None = None
    individualHidden: bool = False
    participationRatio: Decimal | None = None
    participationMultiplier: Decimal | None = None
    finalScore: Decimal | None = None


@router.get("/{assignment_id}/my-score", response_model=MyScoreOut)
def get_my_score(assignment_id: str, user_email: CurrentUser) -> MyScoreOut:
    """คะแนนของฉันเอง — US-10 ภายใต้กฎ anonymity ของ US-15

    ไม่มี field ไหนระบุตัวผู้ประเมินเลยทั้งในเส้นทางนี้และทุกจุดที่มัน query — ตรวจสอบได้จาก
    signature ของ query ทุกตัวที่เรียก ไม่มีการ join ไปหา evaluator เพื่อคืนกลับไปเลย (FR-ANON-01)
    """
    with transaction() as conn:
        assignment = PgAssignmentRepository(conn).get(assignment_id)
        if assignment is None:
            raise NotFoundError("ไม่พบงานประเมินนี้")

        # แค่เป็นสมาชิกห้องก็เรียกได้ — คำตอบจะบอกเองว่ายังไม่ประกาศผลถ้ายังไม่ FINALIZED
        ClassroomAccess(PgClassroomRepository(conn)).require_member(assignment.classroom_id, user_email)

        if assignment.status is not AssignmentStatus.FINALIZED:
            return MyScoreOut(finalized=False, message="ยังไม่ประกาศผลคะแนน")

        scoring_repo = PgScoringRepository(conn)
        group_id = scoring_repo.group_id_for_student(assignment.classroom_id, user_email)

        group_component = Decimal(0)
        if group_id:
            group_component = scoring_repo.component_for_item(
                assignment_id, Side.GROUP, group_id, is_final=True
            )
            override = scoring_repo.latest_override_value(assignment_id, Side.GROUP, group_id, None)
            if override is not None:
                group_component = override

        individual_component: Decimal | None = None
        individual_hidden = False

        # ต้องใช้ user_id ของนักศึกษาเอง (ไม่ใช่ group_id) เป็น item_id ฝั่ง INDIVIDUAL
        # US-15 AC — ผู้ประเมิน < k_min (ใช้ min_comparisons ร่วมกัน) ต้องไม่เห็นตัวเลขรายบุคคล
        my_user_id = None
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM app_user WHERE email_normalized = %s", (user_email,))
            row = cur.fetchone()
            my_user_id = str(row["id"]) if row else None

        if assignment.has_individual_side and my_user_id:
            evaluator_count = scoring_repo.evaluator_count_for_item(
                assignment_id, Side.INDIVIDUAL, my_user_id, is_final=True
            )
            if evaluator_count < assignment.min_comparisons:
                individual_hidden = True
            else:
                individual_component = scoring_repo.component_for_item(
                    assignment_id, Side.INDIVIDUAL, my_user_id, is_final=True
                )
                override = scoring_repo.latest_override_value(
                    assignment_id, Side.INDIVIDUAL, my_user_id, None
                )
                if override is not None:
                    individual_component = override
        elif not assignment.has_individual_side:
            individual_component = Decimal(0)

        group_p = scoring_repo.participation(assignment_id, Side.GROUP, user_email)
        indiv_p = scoring_repo.participation(assignment_id, Side.INDIVIDUAL, user_email)
        m = compute_participation(
            assigned_group=group_p.assigned, submitted_group=group_p.submitted,
            assigned_individual=indiv_p.assigned, submitted_individual=indiv_p.submitted,
            completion_threshold=assignment.completion_threshold,
        )
        p_total = (group_p.assigned + indiv_p.assigned)
        p_ratio = (
            Decimal(group_p.submitted + indiv_p.submitted) / Decimal(p_total)
            if p_total > 0 else Decimal(1)
        )

        final_score = None
        if not individual_hidden:
            final_score = compute_final_personal_score(
                group_component=group_component,
                individual_component=individual_component or Decimal(0),
                participation_multiplier=m,
            )

    return MyScoreOut(
        finalized=True,
        groupComponent=group_component,
        individualComponent=None if individual_hidden else individual_component,
        individualHidden=individual_hidden,
        participationRatio=p_ratio,
        participationMultiplier=m,
        finalScore=final_score,
    )
