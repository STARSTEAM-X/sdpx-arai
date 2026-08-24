"""endpoint ของคำตอบต่อคู่ประเมิน — US-08

route บาง: โหลด pair แล้วตรวจสิทธิ์สามชั้นตามลำดับ (เป็นสมาชิกห้องไหม → เป็น evaluator
ของคู่นี้ไหม → เลยเวลาไหม) กฎทั้งหมดอยู่ใน comparison_service ซึ่งทดสอบได้โดยไม่ต้องมี DB
"""

from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.auth import CurrentUser
from app.db import transaction
from app.domain.access import ClassroomAccess
from app.domain.comparison_service import (
    assert_before_deadline,
    assert_is_evaluator,
    validate_choice,
)
from app.domain.errors import NotFoundError
from app.domain.pairing import Side
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_classroom_repo import PgClassroomRepository
from app.repositories.pg_comparison_repo import PgComparisonRepository

router = APIRouter(prefix="/api/comparisons", tags=["evaluation"])


class ComparisonSaveIn(BaseModel):
    choice: int = Field(ge=1, le=6)
    # ยังไม่มีใครอ่านค่านี้จนถึง M3 (QS-05) แต่รับไว้ตั้งแต่ตอนนี้เพราะย้อนเก็บย้อนหลังไม่ได้
    timeOnTaskMs: int | None = Field(default=None, ge=0)


class ComparisonOut(BaseModel):
    id: str
    pairAssignmentId: str
    choice: int
    status: str
    savedAt: datetime


@router.put("/{pair_assignment_id}", response_model=ComparisonOut)
def save_comparison(
    pair_assignment_id: str, body: ComparisonSaveIn, user_email: CurrentUser
) -> ComparisonOut:
    """autosave — idempotent ตาม FR-API-01 เรียกซ้ำด้วย choice เดิมได้ผลเดิมเสมอ"""
    validate_choice(body.choice)

    with transaction() as conn:
        comparison_repo = PgComparisonRepository(conn)
        pair = comparison_repo.find_pair(pair_assignment_id)
        if pair is None:
            raise NotFoundError("ไม่พบคู่ประเมินนี้")

        assignment = PgAssignmentRepository(conn).get(pair.assignment_id)
        if assignment is None:
            raise NotFoundError("ไม่พบคู่ประเมินนี้")

        # ต้องเป็นสมาชิกห้องนั้นก่อนเสมอ — คนนอกได้ 404 ไม่ใช่ 403 (US-11)
        ClassroomAccess(PgClassroomRepository(conn)).require_member(
            assignment.classroom_id, user_email
        )

        # เป็นสมาชิกห้องแล้ว แต่ pair นี้ไม่ได้มอบหมายให้เขา — 403 คนละเรื่องกับไม่ใช่สมาชิก
        assert_is_evaluator(pair_evaluator_email=pair.evaluator_email, caller_email=user_email)

        deadline = (
            assignment.group_deadline_utc
            if pair.side is Side.GROUP
            else assignment.individual_deadline_utc
        )
        if deadline is not None:
            assert_before_deadline(now=datetime.now(UTC), deadline=deadline)

        saved = comparison_repo.save(
            pair_assignment_id,
            choice=body.choice,
            time_on_task_ms=body.timeOnTaskMs,
            now=datetime.now(UTC),
        )

    return ComparisonOut(
        id=saved.id,
        pairAssignmentId=saved.pair_assignment_id,
        choice=saved.choice,
        status=saved.status,
        savedAt=saved.saved_at,
    )
