"""Auditable quality review; flags do not change scores until the owner acts."""
import hmac
from collections import defaultdict
from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from app.api.assignments import _load_for_instructor
from app.auth import CurrentUser
from app.config import SESSION_SECRET
from app.coverage_orchestrator import coverage_rows
from app.db import transaction
from app.domain.access import Capability, ClassroomAccess
from app.domain.audit import AuditAction, AuditEvent
from app.domain.errors import ConflictError, NotFoundError, ValidationError
from app.domain.quality import evaluator_key, signals
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_audit_repo import PgAuditRepository
from app.repositories.pg_classroom_repo import (
    PgClassroomRepository,
    require_writable_classroom,
)
from app.repositories.pg_quality_repo import PgQualityRepository
from app.repositories.pg_scoring_repo import PgScoringRepository
from app.scoring_orchestrator import run_recompute

router = APIRouter(prefix='/api/assignments', tags=['scoring'])


class QualityOut(BaseModel):
    evaluators: list[dict]
    coverage: list[dict]
    limitations: list[str]
    pairCoverage: list[dict]


class ReasonIn(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)


class ExclusionIn(ReasonIn):
    excluded: bool


class IdentityOut(BaseModel):
    displayName: str | None
    email: str


class ReviewedOut(BaseModel):
    reviewedAt: datetime


class ExclusionOut(BaseModel):
    excluded: bool
    computedAt: datetime


def _resolve(rows: list[dict], assignment_id: str, key: str) -> str:
    for user_id in {str(row['evaluator_user_id']) for row in rows}:
        if hmac.compare_digest(evaluator_key(assignment_id, user_id, SESSION_SECRET), key):
            return user_id
    raise NotFoundError('ไม่พบผู้ประเมินในชุดคู่นี้ กรุณาโหลดรายงานใหม่')


@router.get('/{assignment_id}/quality', response_model=QualityOut)
def quality_report(assignment_id: str, user_email: CurrentUser) -> QualityOut:
    with transaction() as conn:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        repo = PgQualityRepository(conn)
        rows, labels = repo.rows(assignment_id), repo.labels(assignment.classroom_id)
        by_evaluator = defaultdict(list)
        # คำตอบที่อาจารย์ประเมินเอง (J26b) ไม่ใช่ผู้ประเมินที่ต้องตรวจสัญญาณ — นับแยกใน coverage แทน
        for row in rows:
            if not row['by_instructor']:
                by_evaluator[str(row['evaluator_user_id'])].append(row)
        ordered = sorted((evaluator_key(assignment_id, user_id, SESSION_SECRET), answers) for user_id, answers in by_evaluator.items())
        evaluators = [dict(key=key, label=f'E{index + 1}', excluded=any(row['excluded'] for row in answers),
                           reviewedAt=answers[0]['reviewed_at'], **signals(answers)) for index, (key, answers) in enumerate(ordered)]
        criteria_names = {criterion.id: criterion.name for criterion in assignment.criteria}
        for result, (_, answers) in zip(evaluators, ordered, strict=True):
            result['answers'] = [{
                'criterionName': criteria_names.get(str(row['criterion_id']), ''), 'side': row['side'],
                'leftLabel': labels.get(str(row['display_left_item_id']), str(row['display_left_item_id'])),
                'rightLabel': labels.get(str(row['item_b_id'] if row['display_left_item_id'] == row['item_a_id'] else row['item_a_id']), ''),
                'choice': row['choice'], 'timeOnTaskMs': row['time_on_task_ms'], 'status': row['status'],
            } for row in answers if row['status'] == 'SUBMITTED' and row['choice'] is not None]
        coverage = []
        counts = defaultdict(lambda: [0, 0])
        for row in rows:
            for item_id in (row['item_a_id'], row['item_b_id']):
                count = counts[(str(row['criterion_id']), str(item_id))]
                count[0] += 1
                count[1] += row['status'] == 'SUBMITTED' and not row['excluded']
        items_by_side = {side: PgScoringRepository(conn).items_for_side(assignment.classroom_id, side) for side in {criterion.side for criterion in assignment.criteria}}
        for criterion in assignment.criteria:
            ids = items_by_side[criterion.side]
            for item_id in ids:
                assigned, submitted = counts[(criterion.id, item_id)]
                coverage.append({'itemId': item_id, 'side': str(criterion.side), 'criterionId': criterion.id, 'criterionName': criterion.name,
                    'itemLabel': labels.get(item_id, item_id), 'assignedCount': assigned,
                    'submittedCount': submitted, 'minimum': assignment.min_comparisons,
                    'flags': ['QS-01'] if submitted < assignment.min_comparisons else []})
        pair_coverage = coverage_rows(conn, assignment, rows, labels)
    return QualityOut(evaluators=evaluators, coverage=coverage, pairCoverage=pair_coverage, limitations=[
        'สัญญาณเป็นข้อมูลให้ผู้สอนทบทวน ไม่ตัดคำตอบหรือลดคะแนนอัตโนมัติ',
        'เวลาเฉลี่ยใช้เฉพาะคำตอบที่มีข้อมูลเวลาขณะเปิดหน้าประเมิน ไม่รวมการอ่านผลงานในแท็บอื่น',
        'QS-06 ยังประเมินไม่ได้: ข้อมูลไม่มีความสัมพันธ์เพื่อนสนิทหรือกลุ่มเดิมเพื่อใช้เป็นฐานเปรียบเทียบ',
        "QS-07 ยังประเมินไม่ได้: ผู้ประเมินได้รับคู่ต่างชุดกัน ยังไม่มีอันดับร่วมที่ครบสำหรับ Kendall's W",
    ])


@router.post('/{assignment_id}/quality/{reviewer_key}:identity', response_model=IdentityOut)
def reveal_identity(assignment_id: str, reviewer_key: str, body: ReasonIn,
                    user_email: CurrentUser, request: Request, response: Response) -> IdentityOut:
    with transaction() as conn, conn.cursor() as cur:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        ClassroomAccess(PgClassroomRepository(conn)).require(assignment.classroom_id, user_email, Capability.VIEW_EVALUATOR_IDENTITY)
        if not body.reason.strip():
            raise ValidationError('ต้องระบุเหตุผลก่อนดูตัวตน', field='reason')
        user_id = _resolve(PgQualityRepository(conn).rows(assignment_id), assignment_id, reviewer_key)
        cur.execute('SELECT display_name, email_normalized FROM app_user WHERE id = %s', (user_id,))
        identity = cur.fetchone()
        PgAuditRepository(conn).record(AuditEvent(actor_email=user_email, action=AuditAction.EVALUATOR_IDENTITY_VIEWED,
            resource_type='assignment', resource_id=assignment_id, classroom_id=assignment.classroom_id,
            after_state={'reviewerKey': reviewer_key}, reason=body.reason.strip(), ip=request.client.host if request.client else None))
        response.headers['Cache-Control'] = 'private, no-store'
        return IdentityOut(displayName=identity['display_name'], email=identity['email_normalized'])


@router.post('/{assignment_id}/quality/{reviewer_key}:reviewed', response_model=ReviewedOut)
def mark_reviewed(assignment_id: str, reviewer_key: str, user_email: CurrentUser) -> ReviewedOut:
    """Figma J28 "ดูแล้ว · เก็บไว้" — ผู้สอนเปิดดูคำตอบแล้ว ไม่ได้ตัด · ไม่กระทบคะแนนจึงไม่ต้องมีเหตุผล"""
    with transaction() as conn:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        require_writable_classroom(conn, assignment.classroom_id)
        repo = PgQualityRepository(conn)
        user_id = _resolve([row for row in repo.rows(assignment_id) if not row['by_instructor']], assignment_id, reviewer_key)
        return ReviewedOut(reviewedAt=repo.mark_reviewed(assignment_id, user_id, user_email))


@router.post('/{assignment_id}/quality/{reviewer_key}:exclusion', response_model=ExclusionOut)
def set_exclusion(assignment_id: str, reviewer_key: str, body: ExclusionIn,
                  user_email: CurrentUser, request: Request) -> ExclusionOut:
    with transaction() as conn, conn.cursor() as cur:
        assignment = _load_for_instructor(conn, assignment_id, user_email)
        ClassroomAccess(PgClassroomRepository(conn)).require(assignment.classroom_id, user_email, Capability.FINALIZE_SCORES)
        require_writable_classroom(conn, assignment.classroom_id)
        assignment = PgAssignmentRepository(conn).lock(assignment_id)
        if assignment.status not in {'PUBLISHED', 'OPEN', 'CLOSED'}:
            raise ConflictError('ต้องเปิดผลใหม่ก่อนตัดหรือคืนคำตอบของงานที่ประกาศผลแล้ว')
        if not body.reason.strip():
            raise ValidationError('กรุณาระบุเหตุผล', field='reason')
        user_id = _resolve(PgQualityRepository(conn).rows(assignment_id), assignment_id, reviewer_key)
        cur.execute('SELECT excluded FROM assignment_exclusion WHERE assignment_id = %s AND evaluator_user_id = %s', (assignment_id, user_id))
        previous = cur.fetchone()
        cur.execute('INSERT INTO assignment_exclusion (assignment_id, evaluator_user_id, excluded, reason) VALUES (%s,%s,%s,%s) ON CONFLICT (assignment_id, evaluator_user_id) DO UPDATE SET excluded = EXCLUDED.excluded, reason = EXCLUDED.reason, updated_at = now()', (assignment_id, user_id, body.excluded, body.reason.strip()))
        now = datetime.now(UTC)
        run_recompute(conn, assignment, is_final=False, now=now)
        PgAuditRepository(conn).record(AuditEvent(actor_email=user_email, action=AuditAction.COMPARISONS_EXCLUDED if body.excluded else AuditAction.COMPARISONS_INCLUDED,
            resource_type='assignment', resource_id=assignment_id, classroom_id=assignment.classroom_id,
            before_state={'excluded': previous['excluded'] if previous else False}, after_state={'reviewerKey': reviewer_key, 'excluded': body.excluded}, reason=body.reason.strip(), ip=request.client.host if request.client else None))
    return ExclusionOut(excluded=body.excluded, computedAt=now)
