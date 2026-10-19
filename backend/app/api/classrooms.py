"""endpoint ของห้องเรียน — US-02

route ที่นี่ทำหน้าที่แค่ 3 อย่าง: อ่าน input, เปิด transaction, แปลงผลเป็น JSON
กฎธุรกิจทั้งหมดอยู่ใน ClassroomService ซึ่งทดสอบแยกได้โดยไม่ต้องมี HTTP หรือ DB
"""

from datetime import datetime

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from app.auth import CurrentUser
from app.config import ALLOWED_EMAIL_DOMAINS
from app.db import transaction
from app.domain.access import Capability, ClassroomAccess, capabilities_of
from app.domain.assignment_service import Assignment
from app.domain.audit import AuditAction, AuditEvent
from app.domain.classroom_service import ClassroomService
from app.domain.errors import ConflictError, NotFoundError
from app.domain.models import Classroom, ClassroomStatus
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_audit_repo import PgAuditRepository
from app.repositories.pg_classroom_repo import PgClassroomRepository

router = APIRouter(prefix="/api/classrooms", tags=["classrooms"])


class ClassroomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    timezone: str = Field(min_length=1)
    allowedEmailDomains: list[str] = Field(default_factory=list)
    courseCode: str | None = Field(default=None, max_length=100)
    semester: str | None = Field(default=None, max_length=100)


class ClassroomOut(BaseModel):
    id: str
    name: str
    slug: str
    timezone: str
    allowedEmailDomains: list[str]
    status: str
    courseCode: str | None = None
    semester: str | None = None
    instructorName: str | None = None
    groupName: str | None = None
    studentCount: int = 0
    groupCount: int = 0
    assignmentCount: int = 0
    pendingAssignmentCount: int = 0

    @staticmethod
    def of(c: Classroom) -> "ClassroomOut":
        return ClassroomOut(
            id=c.id,
            name=c.name,
            slug=c.slug,
            timezone=c.timezone,
            allowedEmailDomains=c.allowed_email_domains,
            status=str(c.status),
            courseCode=c.course_code,
            semester=c.semester,
        )


class ClassroomList(BaseModel):
    items: list[ClassroomOut]


@router.get("", response_model=ClassroomList)
def list_classrooms(user_email: CurrentUser) -> ClassroomList:
    with transaction() as conn:
        repo = PgClassroomRepository(conn)
        rooms = repo.list_for_user(user_email)
        context = repo.context_for_user(user_email)
    return ClassroomList(items=[ClassroomOut.of(c).model_copy(update={
        "instructorName": context.get(c.id, {}).get("instructor_name"),
        "groupName": context.get(c.id, {}).get("group_name"),
        "studentCount": context.get(c.id, {}).get("student_count", 0),
        "groupCount": context.get(c.id, {}).get("group_count", 0),
        "assignmentCount": context.get(c.id, {}).get("assignment_count", 0),
        "pendingAssignmentCount": context.get(c.id, {}).get("pending_assignment_count", 0),
    }) for c in rooms])


@router.post("", response_model=ClassroomOut, status_code=201)
def create_classroom(
    body: ClassroomCreate, user_email: CurrentUser, response: Response
) -> ClassroomOut:
    # classroom กับ membership ของ OWNER ต้องเกิดพร้อมกัน (กฎ C1)
    # ถ้าเขียนอันแรกติดแล้วอันที่สองพัง จะได้ห้องเรียนที่ไม่มีเจ้าของ ซึ่งกู้ยาก
    with transaction() as conn:
        repo = PgClassroomRepository(conn)
        service = ClassroomService(classroom_repo=repo)

        classroom, owner = service.create_classroom(
            name=body.name,
            timezone=body.timezone,
            created_by=user_email,
            # policy ระดับระบบชนะค่าจาก client เสมอ เพื่อให้ API client ส่ง []
            # แล้วเปิดรับ domain อื่นไม่ได้
            allowed_email_domains=ALLOWED_EMAIL_DOMAINS or body.allowedEmailDomains,
            course_code=body.courseCode,
            semester=body.semester,
        )
        repo.save_member(owner)

    response.headers["Location"] = f"/api/classrooms/{classroom.id}"
    return ClassroomOut.of(classroom)


def _change_classroom_status(classroom_id: str, user_email: str, status: ClassroomStatus, request: Request) -> ClassroomOut:
    with transaction() as conn:
        repo = PgClassroomRepository(conn)
        ClassroomAccess(repo).require(classroom_id, user_email, Capability.MANAGE_MEMBERS)
        repo.lock(classroom_id)
        room = repo.get_by_id(classroom_id)
        if room is None:
            raise NotFoundError("ไม่พบห้องเรียนนี้")
        before = str(room.status)
        if room.status != status:
            repo.set_status(classroom_id, status)
            PgAuditRepository(conn).record(AuditEvent(
                actor_email=user_email,
                action=AuditAction.CLASSROOM_ARCHIVED if status is ClassroomStatus.ARCHIVED else AuditAction.CLASSROOM_RESTORED,
                resource_type="classroom", resource_id=classroom_id, classroom_id=classroom_id,
                before_state={"status": before}, after_state={"status": str(status)},
                ip=request.client.host if request.client else None,
            ))
        room.status = status
    return ClassroomOut.of(room)


@router.post("/{classroom_id}:archive", response_model=ClassroomOut)
def archive_classroom(classroom_id: str, user_email: CurrentUser, request: Request) -> ClassroomOut:
    return _change_classroom_status(classroom_id, user_email, ClassroomStatus.ARCHIVED, request)


@router.post("/{classroom_id}:restore", response_model=ClassroomOut)
def restore_classroom(classroom_id: str, user_email: CurrentUser, request: Request) -> ClassroomOut:
    return _change_classroom_status(classroom_id, user_email, ClassroomStatus.ACTIVE, request)


@router.delete("/{classroom_id}", status_code=204)
def delete_classroom(classroom_id: str, user_email: CurrentUser, request: Request) -> Response:
    with transaction() as conn:
        repo = PgClassroomRepository(conn)
        ClassroomAccess(repo).require(classroom_id, user_email, Capability.MANAGE_MEMBERS)
        repo.lock(classroom_id)
        if repo.has_activity(classroom_id):
            raise ConflictError("ลบห้องเรียนไม่ได้ — มีสมาชิก งาน หรือประวัติการใช้งานแล้ว กรุณาเก็บเข้าคลังแทน")
        room = repo.get_by_id(classroom_id)
        if room is None:
            raise NotFoundError("ไม่พบห้องเรียนนี้")
        # Keep the deletion record without an FK to the row being removed.
        PgAuditRepository(conn).record(AuditEvent(
            actor_email=user_email, action=AuditAction.CLASSROOM_DELETED,
            resource_type="classroom", resource_id=classroom_id,
            before_state={"name": room.name, "status": str(room.status)},
            ip=request.client.host if request.client else None,
        ))
        repo.delete_empty(classroom_id)
    return Response(status_code=204)


class AssignmentSummaryOut(BaseModel):
    opensAtUtc: datetime | None = None
    id: str
    name: str
    status: str
    groupDeadlineUtc: datetime
    individualDeadlineUtc: datetime | None
    assignedCount: int = 0
    answeredCount: int = 0
    submittedCount: int = 0
    submittedAt: datetime | None = None

    @staticmethod
    def of(a: Assignment) -> "AssignmentSummaryOut":
        return AssignmentSummaryOut(
            opensAtUtc=a.opens_at_utc,
            id=a.id,
            name=a.name,
            status=str(a.status),
            groupDeadlineUtc=a.group_deadline_utc,
            individualDeadlineUtc=a.individual_deadline_utc,
        )


class AssignmentSummaryList(BaseModel):
    items: list[AssignmentSummaryOut]


@router.get("/{classroom_id}/assignments", response_model=AssignmentSummaryList)
def list_classroom_assignments(
    classroom_id: str, user_email: CurrentUser
) -> AssignmentSummaryList:
    """งานประเมินทั้งหมดในห้องนี้ — endpoint นี้ไม่มีระบุไว้ตรง ๆ ใน PRD §12

    ช่องว่างเดียวกับที่ US-01 (auth) และ US-12 (members) เคยเจอตอนไล่ตาราง traceability:
    ไม่มีทางให้นักศึกษารู้ id ของ assignment เพื่อเรียก `/my-evaluations` ต่อได้เลย
    ถ้าไม่มี endpoint นี้ — US-07 เรียกที่นี่ก่อนเสมอเพื่อได้รายการ id มา

    นักศึกษาไม่เห็นงานที่ยังเป็น DRAFT เพราะยังไม่ควรรู้ด้วยซ้ำว่ามีงานนี้อยู่
    ผู้สอน (MANAGE_ASSIGNMENT) เห็นทุกสถานะเพื่อกลับมาแก้งานที่ทำค้างไว้ได้
    """
    with transaction() as conn:
        role = ClassroomAccess(PgClassroomRepository(conn)).require_member(
            classroom_id, user_email
        )
        can_manage = Capability.MANAGE_ASSIGNMENT in capabilities_of(role)
        assignments = PgAssignmentRepository(conn)
        items = assignments.list_for_classroom(
            classroom_id, include_draft=can_manage
        )
        progress = assignments.own_progress_for_classroom(classroom_id, user_email)

    return AssignmentSummaryList(items=[AssignmentSummaryOut.of(a).model_copy(update={
        "assignedCount": progress.get(a.id, {}).get("assigned", 0),
        "answeredCount": progress.get(a.id, {}).get("answered", 0),
        "submittedCount": progress.get(a.id, {}).get("submitted", 0),
        "submittedAt": progress.get(a.id, {}).get("submitted_at"),
    }) for a in items])
