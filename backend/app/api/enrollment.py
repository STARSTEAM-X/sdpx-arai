"""Classroom-specific withdrawal and restoration; account access elsewhere is unchanged."""
from datetime import UTC, datetime

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.auth import CurrentUser
from app.db import transaction
from app.domain.access import Capability, ClassroomAccess
from app.domain.audit import AuditAction, AuditEvent
from app.domain.errors import ConflictError, NotFoundError, ValidationError
from app.enrollment_orchestrator import repair_pending
from app.repositories.pg_audit_repo import PgAuditRepository
from app.repositories.pg_classroom_repo import (
    PgClassroomRepository,
    require_writable_classroom,
)

router = APIRouter(prefix='/api/classrooms', tags=['classrooms'])


class EnrollmentIn(BaseModel):
    withdrawn: bool
    reason: str = Field(min_length=1, max_length=2000)


class EnrollmentOut(BaseModel):
    enrollmentStatus: str
    repairs: list[dict]


@router.patch('/{classroom_id}/members/{member_id}/enrollment', response_model=EnrollmentOut)
def change_enrollment(classroom_id: str, member_id: str, body: EnrollmentIn,
                      user_email: CurrentUser, request: Request) -> EnrollmentOut:
    if not body.reason.strip():
        raise ValidationError('กรุณาระบุเหตุผล', field='reason')
    with transaction() as conn, conn.cursor() as cur:
        repo = PgClassroomRepository(conn)
        ClassroomAccess(repo).require(classroom_id, user_email, Capability.MANAGE_ROSTER)
        repo.lock(classroom_id)
        require_writable_classroom(conn, classroom_id)
        cur.execute("SELECT enrollment_status FROM classroom_member WHERE classroom_id = %s AND id::text = %s AND role = 'STUDENT' FOR UPDATE", (classroom_id, member_id))
        member = cur.fetchone()
        if member is None:
            raise NotFoundError('ไม่พบนักศึกษาคนนี้ในห้องเรียน')
        status = 'WITHDRAWN' if body.withdrawn else 'ACTIVE'
        if member['enrollment_status'] == status:
            return EnrollmentOut(enrollmentStatus=status, repairs=[])
        cur.execute("SELECT count(*) AS n FROM assignment WHERE classroom_id = %s AND status = 'FINALIZED'", (classroom_id,))
        if cur.fetchone()['n']:
            raise ConflictError('มีงานประกาศผลแล้ว ให้เจ้าของห้องเปิดผลใหม่ก่อนเปลี่ยนสถานะนักศึกษา')
        now = datetime.now(UTC)
        cur.execute("SELECT group_deadline_utc, individual_deadline_utc, individual_max_score FROM assignment WHERE classroom_id = %s AND status IN ('PUBLISHED','OPEN','CLOSED')", (classroom_id,))
        if any(now >= row['group_deadline_utc'] or (row['individual_max_score'] > 0 and row['individual_deadline_utc'] and now >= row['individual_deadline_utc']) for row in cur.fetchall()):
            raise ConflictError('งานปิดรับแล้ว กรุณาขยายกำหนดส่งทุกฝั่งก่อนเปลี่ยนสถานะ เพื่อให้สมาชิกที่ได้คู่ใหม่มีเวลาประเมิน')
        cur.execute('UPDATE classroom_member SET enrollment_status = %s WHERE id::text = %s', (status, member_id))
        repairs = repair_pending(conn, classroom_id, datetime.now(UTC))
        audit = PgAuditRepository(conn)
        audit.record(AuditEvent(actor_email=user_email, action=AuditAction.MEMBER_ENROLLMENT_CHANGED,
            resource_type='classroom_member', resource_id=member_id, classroom_id=classroom_id,
            before_state={'enrollmentStatus': member['enrollment_status']}, after_state={'enrollmentStatus': status},
            reason=body.reason.strip(), ip=request.client.host if request.client else None))
        for repair in repairs:
            audit.record(AuditEvent(actor_email=user_email, action=AuditAction.PAIRS_REGENERATED,
                resource_type='assignment', resource_id=repair['assignmentId'], classroom_id=classroom_id,
                after_state=repair, reason=body.reason.strip(), ip=request.client.host if request.client else None))
        return EnrollmentOut(enrollmentStatus=status, repairs=repairs)
