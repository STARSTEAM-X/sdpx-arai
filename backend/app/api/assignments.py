"""endpoint ของงานประเมิน — US-04, US-05, US-06

route ที่นี่บาง: อ่าน input, ตรวจสิทธิ์, เปิด transaction, แปลงผลเป็น JSON
กฎว่า publish ได้เมื่อไรอยู่ใน assignment_service · การจัดคู่อยู่ใน pairing
ทั้งสองอย่างทดสอบได้โดยไม่ต้องมี HTTP หรือ DB
"""

import secrets
import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from app.auth import CurrentUser
from app.db import transaction
from app.domain.access import Capability, ClassroomAccess
from app.domain.audit import AuditAction, AuditEvent
from app.domain.assignment_service import (
    Assignment,
    AssignmentStatus,
    Criterion,
    assert_editable,
    assert_publishable,
    validate_new_assignment,
)
from app.domain.errors import NotFoundError, ValidationError
from app.domain.pairing import (
    Side,
    generate_group_pairs,
    generate_individual_pairs,
    solve_group_feasibility,
    solve_individual_feasibility,
)
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_audit_repo import PgAuditRepository
from app.repositories.pg_classroom_repo import PgClassroomRepository

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


class CriterionIn(BaseModel):
    side: Side
    name: str = Field(min_length=1)
    weightPct: Decimal = Field(ge=0, le=100)
    displayOrder: int = 0


class AssignmentIn(BaseModel):
    classroomId: str
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    artifactUrl: str | None = None
    groupMaxScore: Decimal = Field(ge=0)
    individualMaxScore: Decimal = Field(ge=0)
    groupDeadlineUtc: datetime
    individualDeadlineUtc: datetime | None = None
    targetCoverage: int = Field(default=5, ge=1, le=20)
    maxWorkload: int = Field(default=8, ge=1, le=30)
    criteria: list[CriterionIn] = Field(min_length=1)


class CriteriaIn(BaseModel):
    criteria: list[CriterionIn] = Field(min_length=1)


class CriterionOut(BaseModel):
    id: str
    side: str
    name: str
    weightPct: Decimal
    displayOrder: int


class AssignmentOut(BaseModel):
    id: str
    classroomId: str
    name: str
    status: str
    groupDeadlineUtc: datetime
    individualDeadlineUtc: datetime | None
    criteria: list[CriterionOut]

    @staticmethod
    def of(a: Assignment) -> "AssignmentOut":
        return AssignmentOut(
            id=a.id,
            classroomId=a.classroom_id,
            name=a.name,
            status=str(a.status),
            groupDeadlineUtc=a.group_deadline_utc,
            individualDeadlineUtc=a.individual_deadline_utc,
            criteria=[
                CriterionOut(
                    id=c.id,
                    side=str(c.side),
                    name=c.name,
                    weightPct=c.weight_pct,
                    displayOrder=c.display_order,
                )
                for c in a.criteria
            ],
        )


class FeasibilityOut(BaseModel):
    side: str
    requestedCoverage: int
    achievableCoverage: int
    workloadPerEvaluator: int
    totalComparisons: int
    feasible: bool
    reason: str | None


class FeasibilityReport(BaseModel):
    items: list[FeasibilityOut]


class PublishOut(BaseModel):
    assignmentId: str
    status: str
    pairsCreated: int
    pairingSeed: int


def _to_criteria(items: list[CriterionIn]) -> list[Criterion]:
    return [
        Criterion(
            id=str(uuid.uuid4()),
            side=c.side,
            name=c.name,
            weight_pct=c.weightPct,
            display_order=c.displayOrder or order,
        )
        for order, c in enumerate(items)
    ]


def _load_for_instructor(conn, assignment_id: str, user_email: str) -> Assignment:
    """โหลด assignment แล้วยืนยันว่าผู้เรียกจัดการ assignment ของห้องนั้นได้

    ลำดับสำคัญ: ถ้าไม่มี assignment ตอบ 404 · ถ้ามีแต่ไม่ใช่ห้องของเรา
    `require` จะตอบ 404 เช่นกัน (ผ่าน require_member) — สองกรณีนี้
    ต้องแยกไม่ออกจากภายนอก ไม่งั้นคนนอกจะไล่ยิง id เพื่อดูว่าอันไหนมีจริง (US-11)
    """
    repo = PgAssignmentRepository(conn)
    assignment = repo.get(assignment_id)
    if assignment is None:
        raise NotFoundError("ไม่พบงานประเมินนี้")

    ClassroomAccess(PgClassroomRepository(conn)).require(
        assignment.classroom_id, user_email, Capability.MANAGE_ASSIGNMENT
    )
    return assignment


@router.post("", response_model=AssignmentOut, status_code=201)
def create_assignment(
    body: AssignmentIn, user_email: CurrentUser, response: Response
) -> AssignmentOut:
    criteria = _to_criteria(body.criteria)
    validate_new_assignment(
        name=body.name, group_deadline_utc=body.groupDeadlineUtc, criteria=criteria
    )

    with transaction() as conn:
        # ต้องเป็นผู้สอนของห้องนั้น — คนนอกได้ 404 ไม่ใช่ 403
        ClassroomAccess(PgClassroomRepository(conn)).require(
            body.classroomId, user_email, Capability.MANAGE_ASSIGNMENT
        )

        assignment = Assignment(
            id=str(uuid.uuid4()),
            classroom_id=body.classroomId,
            name=body.name.strip(),
            description=body.description,
            artifact_url=body.artifactUrl,
            group_max_score=body.groupMaxScore,
            individual_max_score=body.individualMaxScore,
            group_deadline_utc=body.groupDeadlineUtc,
            individual_deadline_utc=body.individualDeadlineUtc,
            target_coverage=body.targetCoverage,
            max_workload=body.maxWorkload,
            created_by=user_email,
            status=AssignmentStatus.DRAFT,
            criteria=criteria,
        )
        PgAssignmentRepository(conn).create(assignment)

    response.headers["Location"] = f"/api/assignments/{assignment.id}"
    return AssignmentOut.of(assignment)


@router.get("/{assignment_id}", response_model=AssignmentOut)
def get_assignment(assignment_id: str, user_email: CurrentUser) -> AssignmentOut:
    with transaction() as conn:
        return AssignmentOut.of(_load_for_instructor(conn, assignment_id, user_email))


@router.put("/{assignment_id}/criteria", response_model=AssignmentOut)
def replace_criteria(
    assignment_id: str, body: CriteriaIn, user_email: CurrentUser
) -> AssignmentOut:
    """แก้เกณฑ์ทั้งชุด — ทำได้เฉพาะตอนยังเป็น DRAFT

    งานที่ประกาศไปแล้วอาจมีคนเริ่มประเมินตามเกณฑ์ชุดเดิม การเปลี่ยนน้ำหนักกลางคัน
    ทำให้คะแนนจากคำตอบเก่ากับใหม่เทียบกันไม่ได้ (ตอบ 409 พร้อมบอกว่าต้องถอยก่อน)
    """
    with transaction() as conn:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        assert_editable(assignment)

        criteria = _to_criteria(body.criteria)
        validate_new_assignment(
            name=assignment.name,
            group_deadline_utc=assignment.group_deadline_utc,
            criteria=criteria,
        )

        repo = PgAssignmentRepository(conn)
        repo.replace_criteria(assignment_id, criteria)
        assignment.criteria = criteria

    return AssignmentOut.of(assignment)


@router.get("/{assignment_id}/feasibility", response_model=FeasibilityReport)
def get_feasibility(assignment_id: str, user_email: CurrentUser) -> FeasibilityReport:
    """ดูว่าตั้งค่าที่ขอไว้เป็นไปได้จริงไหม ก่อนกด publish (US-05)

    รายงานทั้งสองฝั่งเสมอเมื่อฝั่งบุคคลเปิดอยู่ เพราะข้อจำกัดของสองฝั่งคนละเรื่องกัน
    ฝั่งกลุ่มถูกบีบด้วยจำนวนกลุ่มและ workload · ฝั่งบุคคลถูกบีบด้วยขนาดกลุ่มล้วน ๆ (D4)
    """
    with transaction() as conn:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        groups = PgAssignmentRepository(conn).groups_with_members(assignment.classroom_id)

    items = [
        solve_group_feasibility(
            groups,
            target_coverage=assignment.target_coverage,
            max_workload=assignment.max_workload,
        )
    ]
    if assignment.has_individual_side:
        items.append(
            solve_individual_feasibility(groups, target_coverage=assignment.target_coverage)
        )

    return FeasibilityReport(
        items=[
            FeasibilityOut(
                side=str(f.side),
                requestedCoverage=f.requested_coverage,
                achievableCoverage=f.achievable_coverage,
                workloadPerEvaluator=f.workload_per_evaluator,
                totalComparisons=f.total_comparisons,
                feasible=f.feasible,
                reason=f.reason,
            )
            for f in items
        ]
    )


@router.post("/{assignment_id}:publish", response_model=PublishOut)
def publish_assignment(
    assignment_id: str,
    user_email: CurrentUser,
    request: Request,
    seed: int | None = None,
) -> PublishOut:
    """สร้างคู่ประเมินทั้งหมดแล้วเปลี่ยนสถานะเป็น PUBLISHED (US-06)

    ทุกอย่างอยู่ใน transaction เดียว — ถ้าคู่ของเกณฑ์สุดท้ายเขียนไม่สำเร็จ
    สถานะจะไม่เปลี่ยนตามไปด้วย ไม่มีทางได้งานที่ประกาศแล้วแต่คู่ไม่ครบ
    """
    # seed ที่ส่งมาใช้ตอนอยากได้ผลเดิมซ้ำ · ไม่ส่งมาก็สุ่มให้แล้วเก็บไว้ (FR-PAIR-09)
    chosen_seed = seed if seed is not None else secrets.randbelow(2**31)

    with transaction() as conn:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        assert_publishable(assignment)

        repo = PgAssignmentRepository(conn)
        groups = repo.groups_with_members(assignment.classroom_id)

        group_plan = solve_group_feasibility(
            groups,
            target_coverage=assignment.target_coverage,
            max_workload=assignment.max_workload,
        )
        if not group_plan.feasible:
            # 422 ไม่ใช่ 404 — งานมีอยู่จริงและผู้เรียกมีสิทธิ์ แค่ตั้งค่าไว้แบบที่ทำไม่ได้
            # ข้อความจาก feasibility มีตัวเลขกำกับอยู่แล้วว่าติดตรงไหน (FR-PAIR-05)
            raise ValidationError(
                group_plan.reason or "ตั้งค่าปัจจุบันสร้างคู่ประเมินไม่ได้", field="targetCoverage"
            )

        created = 0
        for criterion in assignment.criteria_for(Side.GROUP):
            pairs = generate_group_pairs(
                groups,
                criterion_id=criterion.id,
                coverage=group_plan.achievable_coverage,
                workload=group_plan.workload_per_evaluator,
                seed=chosen_seed,
                assignment_id=assignment.id,
            )
            repo.save_pairs(assignment.id, pairs, criterion_id=criterion.id)
            created += len(pairs)

        # P10 — ปิดฝั่งบุคคลแล้วต้องไม่มี pair ฝั่งนั้นเลย
        if assignment.has_individual_side:
            for criterion in assignment.criteria_for(Side.INDIVIDUAL):
                pairs = generate_individual_pairs(
                    groups,
                    criterion_id=criterion.id,
                    seed=chosen_seed,
                    assignment_id=assignment.id,
                )
                repo.save_pairs(assignment.id, pairs, criterion_id=criterion.id)
                created += len(pairs)

        repo.mark_published(assignment.id, seed=chosen_seed, at=datetime.now(UTC))

        # publish คือ event แรกที่ FR-AUDIT-01 บังคับให้บันทึก และอยู่ใน transaction
        # เดียวกับการสร้างคู่ — ถ้าเขียน log ไม่สำเร็จ การ publish ถูก rollback ตามไปด้วย
        PgAuditRepository(conn).record(
            AuditEvent(
                actor_email=user_email,
                action=AuditAction.ASSIGNMENT_PUBLISHED,
                resource_type="assignment",
                resource_id=assignment.id,
                classroom_id=assignment.classroom_id,
                before_state={"status": str(AssignmentStatus.DRAFT)},
                after_state={
                    "status": str(AssignmentStatus.PUBLISHED),
                    "pairsCreated": created,
                    "pairingSeed": chosen_seed,
                },
                ip=request.client.host if request.client else None,
            )
        )

    return PublishOut(
        assignmentId=assignment.id,
        status=str(AssignmentStatus.PUBLISHED),
        pairsCreated=created,
        pairingSeed=chosen_seed,
    )
