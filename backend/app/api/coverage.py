"""Additional student evaluations and an instructor's own recorded comparison."""
import random
import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.api.assignments import _load_for_instructor
from app.auth import CurrentUser
from app.coverage_orchestrator import available_evaluators
from app.db import transaction
from app.domain.audit import AuditAction, AuditEvent
from app.domain.comparison_service import assert_before_deadline
from app.domain.errors import ConflictError, ValidationError
from app.domain.extra_pairs import eligible_evaluators
from app.domain.pairing import Pair, Side
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_audit_repo import PgAuditRepository
from app.repositories.pg_classroom_repo import require_writable_classroom
from app.repositories.pg_comparison_repo import PgComparisonRepository
from app.repositories.pg_quality_repo import PgQualityRepository
from app.scoring_orchestrator import run_recompute

router = APIRouter(prefix='/api/assignments', tags=['evaluation'])


class PairIn(BaseModel):
    criterionId: str
    itemAId: str
    itemBId: str
    reason: str = Field(min_length=1, max_length=2000)


class ExtraIn(PairIn):
    count: int = Field(ge=1, le=20)


class InstructorComparisonIn(PairIn):
    choice: int = Field(ge=1, le=6)
    timeOnTaskMs: int | None = Field(default=None, ge=0)


class CoverageActionOut(BaseModel):
    pairsAdded: int


def _load(conn, assignment_id, body, user_email):
    assignment = _load_for_instructor(conn, assignment_id, user_email)
    require_writable_classroom(conn, assignment.classroom_id)
    assignment = PgAssignmentRepository(conn).lock(assignment_id)
    if assignment.status not in {'PUBLISHED', 'OPEN', 'CLOSED'}:
        raise ConflictError('ต้องเผยแพร่งาน และเปิดผลใหม่ก่อนแก้การประเมินที่ประกาศผลแล้ว')
    criterion = next((criterion for criterion in assignment.criteria if criterion.id == body.criterionId), None)
    if criterion is None:
        raise ValidationError('ไม่พบเกณฑ์ในงานนี้ กรุณาโหลดรายงานใหม่', field='criterionId')
    groups = PgAssignmentRepository(conn).groups_with_members(assignment.classroom_id)
    eligible_evaluators(groups, criterion.side, body.itemAId, body.itemBId)
    if not body.reason.strip():
        raise ValidationError('กรุณาระบุเหตุผล', field='reason')
    return assignment, criterion, groups


@router.post('/{assignment_id}/additional-evaluations', response_model=CoverageActionOut, status_code=201)
def assign_additional(assignment_id: str, body: ExtraIn, user_email: CurrentUser, request: Request) -> CoverageActionOut:
    with transaction() as conn, conn.cursor() as cur:
        assignment, criterion, groups = _load(conn, assignment_id, body, user_email)
        deadline = assignment.group_deadline_utc if criterion.side is Side.GROUP else assignment.individual_deadline_utc or assignment.group_deadline_utc
        assert_before_deadline(now=datetime.now(UTC), deadline=deadline)
        available = available_evaluators(groups, PgQualityRepository(conn).rows(assignment_id), criterion, body.itemAId, body.itemBId, assignment.max_workload)
        if len(available) < body.count:
            raise ConflictError(f'เหลือผู้มีสิทธิ์ {len(available)} คน ไม่สามารถส่งเพิ่มให้ {body.count} คนได้', field='count')
        seed = secrets.randbelow(2**31)
        rng = random.Random(seed)
        a, b = sorted((body.itemAId, body.itemBId))
        selected = rng.sample(available, body.count)
        pairs = [Pair(criterion.side, a, b, user_id, rng.choice((a, b))) for user_id in selected]
        cur.execute('UPDATE assignment SET generation = generation + 1, published_at = now() WHERE id = %s', (assignment_id,))
        PgAssignmentRepository(conn).append_pairs(assignment_id, pairs, criterion_id=criterion.id, source='INSTRUCTOR_EXTRA')
        cur.execute('DELETE FROM submission_idempotency_scope WHERE assignment_id = %s', (assignment_id,))
        PgAuditRepository(conn).record(AuditEvent(actor_email=user_email, action=AuditAction.EXTRA_EVALUATIONS_ASSIGNED,
            resource_type='assignment', resource_id=assignment_id, classroom_id=assignment.classroom_id,
            after_state={'criterionId': criterion.id, 'pairsAdded': len(pairs), 'seed': seed}, reason=body.reason.strip(), ip=request.client.host if request.client else None))
    return CoverageActionOut(pairsAdded=len(pairs))


@router.post('/{assignment_id}/instructor-comparisons', response_model=CoverageActionOut, status_code=201)
def instructor_comparison(assignment_id: str, body: InstructorComparisonIn, user_email: CurrentUser, request: Request) -> CoverageActionOut:
    with transaction() as conn, conn.cursor() as cur:
        assignment, criterion, _ = _load(conn, assignment_id, body, user_email)
        cur.execute('SELECT id FROM app_user WHERE email_normalized = %s', (user_email,))
        evaluator_id = str(cur.fetchone()['id'])
        a, b = sorted((body.itemAId, body.itemBId))
        cur.execute('SELECT id, display_left_item_id FROM pair_assignment WHERE assignment_id = %s AND criterion_id = %s AND evaluator_user_id = %s AND item_a_id = %s AND item_b_id = %s AND retired_at IS NULL', (assignment_id, criterion.id, evaluator_id, a, b))
        existing = cur.fetchone()
        created = existing is None
        if existing is None:
            PgAssignmentRepository(conn).append_pairs(assignment_id, [Pair(criterion.side, a, b, evaluator_id, body.itemAId)], criterion_id=criterion.id, source='INSTRUCTOR_EXTRA')
            cur.execute('SELECT id, display_left_item_id FROM pair_assignment WHERE criterion_id = %s AND evaluator_user_id = %s AND item_a_id = %s AND item_b_id = %s AND retired_at IS NULL', (criterion.id, evaluator_id, a, b))
            existing = cur.fetchone()
        choice = body.choice if str(existing['display_left_item_id']) == body.itemAId else 7 - body.choice
        saved = PgComparisonRepository(conn).save(str(existing['id']), choice=choice, time_on_task_ms=body.timeOnTaskMs, now=datetime.now(UTC))
        cur.execute("UPDATE comparison SET status = 'SUBMITTED', submitted_at = now() WHERE id = %s", (saved.id,))
        cur.execute("INSERT INTO comparison_revision (id, comparison_id, choice, status, revision_no, submitted_at) SELECT %s, %s, %s, 'SUBMITTED', COALESCE(MAX(revision_no), 0) + 1, now() FROM comparison_revision WHERE comparison_id = %s", (str(uuid.uuid4()), saved.id, choice, saved.id))
        run_recompute(conn, assignment, is_final=False, now=datetime.now(UTC))
        PgAuditRepository(conn).record(AuditEvent(actor_email=user_email, action=AuditAction.INSTRUCTOR_COMPARISON_SUBMITTED,
            resource_type='assignment', resource_id=assignment_id, classroom_id=assignment.classroom_id,
            after_state={'criterionId': criterion.id, 'pairId': str(existing['id'])}, reason=body.reason.strip(), ip=request.client.host if request.client else None))
    return CoverageActionOut(pairsAdded=1 if created else 0)
