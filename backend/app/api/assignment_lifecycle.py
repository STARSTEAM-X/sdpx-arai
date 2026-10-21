"""Instructor lifecycle operations with transactional audit and preserved answers."""
import uuid
from dataclasses import replace
from datetime import UTC, datetime

from fastapi import APIRouter, Request
from pydantic import AwareDatetime, BaseModel, Field

from app.api.assignments import AssignmentOut, _load_for_instructor
from app.auth import CurrentUser
from app.db import transaction
from app.domain.assignment_service import AssignmentStatus, assert_deadline_change
from app.domain.audit import AuditAction, AuditEvent
from app.domain.errors import ConflictError, ValidationError
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_audit_repo import PgAuditRepository
from app.repositories.pg_classroom_repo import require_writable_classroom

router = APIRouter(prefix='/api/assignments', tags=['assignments'])


class ExtendIn(BaseModel):
    groupDeadlineUtc: AwareDatetime
    individualDeadlineUtc: AwareDatetime | None = None
    reason: str = Field(min_length=1, max_length=2000)


class CopyIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    groupDeadlineUtc: AwareDatetime
    individualDeadlineUtc: AwareDatetime | None = None


class UnpublishIn(BaseModel):
    confirmInvalidate: bool = False
    reason: str = Field(min_length=1, max_length=2000)


class UnpublishImpact(BaseModel):
    submittedEvaluators: int
    submittedComparisons: int
    assignedComparisons: int


@router.get('/{assignment_id}/unpublish-impact', response_model=UnpublishImpact)
def unpublish_impact(assignment_id: str, user_email: CurrentUser) -> UnpublishImpact:
    with transaction() as conn, conn.cursor() as cur:
        _load_for_instructor(conn, assignment_id, user_email)
        cur.execute("SELECT count(*) AS assigned, count(c.id) FILTER (WHERE c.status = 'SUBMITTED') AS submitted, count(DISTINCT c.evaluator_user_id) FILTER (WHERE c.status = 'SUBMITTED') AS evaluators FROM pair_assignment p LEFT JOIN comparison c ON c.pair_assignment_id = p.id WHERE p.assignment_id = %s AND p.retired_at IS NULL", (assignment_id,))
        row = cur.fetchone()
        return UnpublishImpact(submittedEvaluators=row['evaluators'], submittedComparisons=row['submitted'], assignedComparisons=row['assigned'])


@router.post('/{assignment_id}:unpublish', response_model=AssignmentOut)
def unpublish_assignment(assignment_id: str, body: UnpublishIn, user_email: CurrentUser, request: Request) -> AssignmentOut:
    if not body.confirmInvalidate or not body.reason.strip():
        raise ValidationError('ต้องยืนยันว่าคำตอบเดิมจะไม่ใช้คำนวณและระบุเหตุผล', field='confirmInvalidate')
    with transaction() as conn, conn.cursor() as cur:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        require_writable_classroom(conn, assignment.classroom_id)
        assignment = PgAssignmentRepository(conn).lock(assignment_id)
        if assignment.status not in {AssignmentStatus.PUBLISHED, AssignmentStatus.OPEN, AssignmentStatus.CLOSED}:
            raise ConflictError('ยกเลิกเผยแพร่ได้เฉพาะงานที่ยังไม่ประกาศผล ต้องเปิดผลใหม่ก่อนหากประกาศแล้ว')
        cur.execute("SELECT count(*) AS n FROM comparison c JOIN pair_assignment p ON p.id = c.pair_assignment_id WHERE p.assignment_id = %s AND p.retired_at IS NULL AND c.status = 'SUBMITTED'", (assignment_id,))
        submitted = cur.fetchone()['n']
        cur.execute('UPDATE pair_assignment SET retired_at = now() WHERE assignment_id = %s AND retired_at IS NULL', (assignment_id,))
        cur.execute('UPDATE score_override SET retired_at = now() WHERE assignment_id = %s AND retired_at IS NULL', (assignment_id,))
        cur.execute('UPDATE assignment_exclusion SET excluded = false, updated_at = now() WHERE assignment_id = %s', (assignment_id,))
        cur.execute('DELETE FROM computed_score WHERE assignment_id = %s AND is_final = false', (assignment_id,))
        # Cached acknowledgements belong to the invalidated generation, not the next one.
        cur.execute('DELETE FROM submission_idempotency_scope WHERE assignment_id = %s', (assignment_id,))
        cur.execute("UPDATE assignment SET status = 'DRAFT', published_at = NULL, generation = generation + 1 WHERE id = %s RETURNING generation", (assignment_id,))
        generation = cur.fetchone()['generation']
        PgAuditRepository(conn).record(AuditEvent(
            actor_email=user_email, action=AuditAction.ASSIGNMENT_UNPUBLISHED, resource_type='assignment',
            resource_id=assignment_id, classroom_id=assignment.classroom_id,
            before_state={'status': str(assignment.status), 'submittedCount': submitted},
            after_state={'status': 'DRAFT', 'generation': generation}, reason=body.reason.strip(),
            ip=request.client.host if request.client else None,
        ))
        return AssignmentOut.of(PgAssignmentRepository(conn).get(assignment_id))


@router.post('/{assignment_id}:extend-deadline', response_model=AssignmentOut)
def extend_deadline(assignment_id: str, body: ExtendIn, user_email: CurrentUser, request: Request) -> AssignmentOut:
    with transaction() as conn, conn.cursor() as cur:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        require_writable_classroom(conn, assignment.classroom_id)
        cur.execute('SELECT id FROM assignment WHERE id = %s FOR UPDATE', (assignment_id,))
        assignment = PgAssignmentRepository(conn).get(assignment_id)
        if assignment.status not in {AssignmentStatus.PUBLISHED, AssignmentStatus.OPEN, AssignmentStatus.CLOSED}:
            raise ConflictError('ขยายกำหนดส่งได้เฉพาะงานที่เปิดประเมินหรือปิดรับแล้ว')
        individual_deadline = body.individualDeadlineUtc or assignment.individual_deadline_utc
        now = datetime.now(UTC)
        # FR-ASSIGN-04 — ขยายได้ทุกเมื่อ · ร่นเข้าได้เฉพาะก่อนถึงกำหนดเดิม (กฎอยู่ใน assert_deadline_change)
        assert_deadline_change(current=assignment.group_deadline_utc, new=body.groupDeadlineUtc, now=now, field='groupDeadlineUtc')
        if body.individualDeadlineUtc:
            assert_deadline_change(
                current=assignment.individual_deadline_utc or assignment.group_deadline_utc,
                new=body.individualDeadlineUtc, now=now, field='individualDeadlineUtc',
            )
        if not body.reason.strip():
            raise ValidationError('กรุณาระบุเหตุผล', field='reason')
        shortened = body.groupDeadlineUtc < assignment.group_deadline_utc or bool(
            body.individualDeadlineUtc and assignment.individual_deadline_utc
            and body.individualDeadlineUtc < assignment.individual_deadline_utc
        )
        before = {'groupDeadlineUtc': assignment.group_deadline_utc.isoformat(), 'individualDeadlineUtc': assignment.individual_deadline_utc.isoformat() if assignment.individual_deadline_utc else None}
        cur.execute("UPDATE assignment SET group_deadline_utc = %s, individual_deadline_utc = %s, status = 'PUBLISHED' WHERE id = %s", (body.groupDeadlineUtc, individual_deadline, assignment_id))
        PgAuditRepository(conn).record(AuditEvent(
            actor_email=user_email,
            action=AuditAction.DEADLINE_SHORTENED if shortened else AuditAction.DEADLINE_EXTENDED,
            resource_type='assignment',
            resource_id=assignment_id, classroom_id=assignment.classroom_id, before_state=before,
            after_state={'groupDeadlineUtc': body.groupDeadlineUtc.isoformat(), 'individualDeadlineUtc': individual_deadline.isoformat() if individual_deadline else None},
            reason=body.reason.strip(), ip=request.client.host if request.client else None,
        ))
        return AssignmentOut.of(PgAssignmentRepository(conn).get(assignment_id))


@router.post('/{assignment_id}:copy', response_model=AssignmentOut, status_code=201)
def copy_assignment(assignment_id: str, body: CopyIn, user_email: CurrentUser, request: Request) -> AssignmentOut:
    if not body.name.strip():
        raise ValidationError('ชื่องานห้ามว่าง', field='name')
    with transaction() as conn, conn.cursor() as cur:
        source = _load_for_instructor(conn, assignment_id, user_email)
        require_writable_classroom(conn, source.classroom_id)
        draft = replace(source, id=str(uuid.uuid4()), name=body.name.strip(), status=AssignmentStatus.DRAFT,
                        created_by=user_email, group_deadline_utc=body.groupDeadlineUtc,
                        individual_deadline_utc=body.individualDeadlineUtc, opens_at_utc=None,
                        finalized_at=None, pairing_seed=None,
                        generation=1,
                        criteria=[replace(criterion, id=str(uuid.uuid4())) for criterion in source.criteria])
        PgAssignmentRepository(conn).create(draft)
        cur.execute('INSERT INTO assignment_artifact (assignment_id, group_id, url) SELECT %s, group_id, url FROM assignment_artifact WHERE assignment_id = %s', (draft.id, assignment_id))
        PgAuditRepository(conn).record(AuditEvent(
            actor_email=user_email, action=AuditAction.ASSIGNMENT_COPIED, resource_type='assignment',
            resource_id=draft.id, classroom_id=source.classroom_id,
            after_state={'copiedFrom': assignment_id, 'status': 'DRAFT'},
            ip=request.client.host if request.client else None,
        ))
        return AssignmentOut.of(draft)
