"""Private score appeals; responding never silently overrides an academic score."""
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.auth import CurrentUser
from app.db import transaction
from app.domain.access import Capability, ClassroomAccess
from app.domain.audit import AuditAction, AuditEvent
from app.domain.errors import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from app.domain.models import MemberRole
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_audit_repo import PgAuditRepository
from app.repositories.pg_classroom_repo import (
    PgClassroomRepository,
    require_writable_classroom,
)

router = APIRouter(prefix="/api", tags=["appeals"])


class AppealIn(BaseModel):
    message: str = Field(min_length=30, max_length=5000)


class ResolutionIn(BaseModel):
    status: str
    resolution: str = Field(min_length=1, max_length=5000)


class AppealOut(BaseModel):
    id: str
    assignmentId: str
    assignmentName: str
    studentName: str
    studentEmail: str
    groupName: str | None = None
    message: str
    status: str
    resolution: str | None
    createdAt: datetime
    resolvedAt: datetime | None


class AppealsOut(BaseModel):
    items: list[AppealOut]


def _read(conn, classroom_id: str, email: str | None = None) -> list[AppealOut]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT p.*, a.name AS assignment_name, u.display_name, u.email_normalized, m.group_name "
            "FROM appeal p JOIN assignment a ON a.id = p.assignment_id "
            "JOIN app_user u ON u.id = p.student_user_id "
            "LEFT JOIN classroom_member m ON m.classroom_id = a.classroom_id AND m.user_id = u.id "
            "WHERE a.classroom_id = %s AND (%s::text IS NULL OR u.email_normalized = %s) "
            "ORDER BY p.created_at DESC",
            (classroom_id, email, email),
        )
        return [AppealOut(
            id=str(row["id"]), assignmentId=str(row["assignment_id"]),
            assignmentName=row["assignment_name"], studentName=row["display_name"] or row["email_normalized"],
            studentEmail=row["email_normalized"], groupName=row["group_name"],
            message=row["message"], status=row["status"], resolution=row["resolution"],
            createdAt=row["created_at"], resolvedAt=row["resolved_at"],
        ) for row in cur.fetchall()]


@router.get("/classrooms/{classroom_id}/appeals", response_model=AppealsOut)
def list_appeals(classroom_id: str, user_email: CurrentUser) -> AppealsOut:
    with transaction() as conn:
        access = ClassroomAccess(PgClassroomRepository(conn))
        role = access.require_member(classroom_id, user_email)
        if role != MemberRole.STUDENT:
            access.require(classroom_id, user_email, Capability.MANAGE_ASSIGNMENT)
        return AppealsOut(items=_read(conn, classroom_id, user_email if role == MemberRole.STUDENT else None))


@router.post("/assignments/{assignment_id}/appeals", status_code=201, response_model=AppealOut)
def create_appeal(assignment_id: str, body: AppealIn, user_email: CurrentUser, request: Request) -> AppealOut:
    message = body.message.strip()
    if len(message) < 30:
        raise ValidationError("กรุณาระบุเหตุผลอย่างน้อย 30 ตัวอักษร", field="message")
    with transaction() as conn, conn.cursor() as cur:
        assignment = PgAssignmentRepository(conn).get(assignment_id)
        if assignment is None:
            raise NotFoundError("ไม่พบงานประเมินนี้")
        role = ClassroomAccess(PgClassroomRepository(conn)).require_member(assignment.classroom_id, user_email)
        if role != MemberRole.STUDENT:
            raise ForbiddenError("เฉพาะนักศึกษายื่นอุทธรณ์คะแนนของตนเองได้")
        cur.execute('SELECT m.enrollment_status FROM classroom_member m JOIN app_user u ON u.id = m.user_id WHERE m.classroom_id = %s AND u.email_normalized = %s', (assignment.classroom_id, user_email))
        if cur.fetchone()['enrollment_status'] == 'WITHDRAWN':
            raise ForbiddenError('นักศึกษาที่ถอนจากรายวิชาแล้วไม่สามารถยื่นคำร้องใหม่ได้')
        require_writable_classroom(conn, assignment.classroom_id)
        # Serialize with finalize/reopen so the window is evaluated against the locked state.
        cur.execute("SELECT status, finalized_at FROM assignment WHERE id = %s FOR UPDATE", (assignment_id,))
        state = cur.fetchone()
        if state["status"] != "FINALIZED" or state["finalized_at"] is None:
            raise ConflictError("ยื่นอุทธรณ์ได้หลังประกาศผลคะแนนแล้วเท่านั้น")
        if datetime.now(UTC) > state["finalized_at"] + timedelta(days=7):
            raise ConflictError("พ้นระยะเวลายื่นอุทธรณ์ 7 วันแล้ว")
        appeal_id = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO appeal (id, assignment_id, student_user_id, message) "
            "SELECT %s, %s, id, %s FROM app_user WHERE email_normalized = %s "
            "ON CONFLICT (assignment_id, student_user_id) DO NOTHING RETURNING id",
            (appeal_id, assignment_id, message, user_email),
        )
        if cur.fetchone() is None:
            raise ConflictError("คุณยื่นอุทธรณ์งานนี้แล้ว ยื่นได้ 1 ครั้งต่องาน")
        PgAuditRepository(conn).record(AuditEvent(
            actor_email=user_email, action=AuditAction.APPEAL_CREATED, resource_type="appeal",
            resource_id=appeal_id, classroom_id=assignment.classroom_id,
            after_state={"status": "OPEN", "assignmentId": assignment_id},
            ip=request.client.host if request.client else None,
        ))
        return next(item for item in _read(conn, assignment.classroom_id, user_email) if item.id == appeal_id)


@router.post("/classrooms/{classroom_id}/appeals/{appeal_id}:resolve", response_model=AppealOut)
def resolve_appeal(classroom_id: str, appeal_id: str, body: ResolutionIn,
                   user_email: CurrentUser, request: Request) -> AppealOut:
    resolution = body.resolution.strip()
    if body.status not in {"RESOLVED", "REJECTED"} or not resolution:
        raise ValidationError("ต้องระบุผลการพิจารณาและคำตอบ", field="resolution")
    with transaction() as conn, conn.cursor() as cur:
        ClassroomAccess(PgClassroomRepository(conn)).require(classroom_id, user_email, Capability.MANAGE_ASSIGNMENT)
        require_writable_classroom(conn, classroom_id)
        cur.execute("SELECT p.status FROM appeal p JOIN assignment a ON a.id = p.assignment_id "
                    "WHERE p.id::text = %s AND a.classroom_id = %s FOR UPDATE OF p", (appeal_id, classroom_id))
        row = cur.fetchone()
        if row is None:
            raise NotFoundError("ไม่พบคำร้องนี้")
        if row["status"] != "OPEN":
            raise ConflictError("คำร้องนี้ได้รับการพิจารณาแล้ว")
        cur.execute("UPDATE appeal SET status = %s, resolution = %s, resolved_at = now(), "
                    "resolved_by = (SELECT id FROM app_user WHERE email_normalized = %s) WHERE id = %s",
                    (body.status, resolution, user_email, appeal_id))
        PgAuditRepository(conn).record(AuditEvent(
            actor_email=user_email, action=AuditAction.APPEAL_RESOLVED, resource_type="appeal",
            resource_id=appeal_id, classroom_id=classroom_id,
            before_state={"status": "OPEN"}, after_state={"status": body.status},
            reason=resolution, ip=request.client.host if request.client else None,
        ))
        return next(item for item in _read(conn, classroom_id) if item.id == appeal_id)
