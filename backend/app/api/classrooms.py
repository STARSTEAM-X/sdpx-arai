"""endpoint ของห้องเรียน — US-02

route ที่นี่ทำหน้าที่แค่ 3 อย่าง: อ่าน input, เปิด transaction, แปลงผลเป็น JSON
กฎธุรกิจทั้งหมดอยู่ใน ClassroomService ซึ่งทดสอบแยกได้โดยไม่ต้องมี HTTP หรือ DB
"""

from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from app.auth import CurrentUser
from app.config import ALLOWED_EMAIL_DOMAINS
from app.db import transaction
from app.domain.access import Capability, ClassroomAccess, capabilities_of
from app.domain.assignment_service import Assignment
from app.domain.audit import AuditAction, AuditEvent
from app.domain.classroom_service import ClassroomService
from app.domain.errors import ConflictError, NotFoundError, ValidationError
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
    openAssignmentCount: int = 0
    openSubmittedStudents: int = 0
    openAppealCount: int = 0
    finalizedAssignmentCount: int = 0
    nextDeadlineUtc: datetime | None = None
    archivedAt: datetime | None = None

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
        "openAssignmentCount": context.get(c.id, {}).get("open_assignment_count", 0),
        "openSubmittedStudents": context.get(c.id, {}).get("open_submitted_students", 0),
        "openAppealCount": context.get(c.id, {}).get("open_appeal_count", 0),
        "finalizedAssignmentCount": context.get(c.id, {}).get("finalized_assignment_count", 0),
        "nextDeadlineUtc": context.get(c.id, {}).get("next_deadline"),
        "archivedAt": context.get(c.id, {}).get("archived_at"),
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


class ClassroomUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    timezone: str = Field(min_length=1)
    courseCode: str | None = Field(default=None, max_length=100)
    semester: str | None = Field(default=None, max_length=100)


@router.patch("/{classroom_id}", response_model=ClassroomOut)
def update_classroom(classroom_id: str, body: ClassroomUpdate, user_email: CurrentUser, request: Request) -> ClassroomOut:
    """แก้ชื่อ รหัสวิชา ภาคเรียน และเขตเวลา (Figma J04 เมนู "แก้ไขข้อมูลห้อง")

    โดเมนอีเมลที่อนุญาตแก้ไม่ได้ — เป็น policy ระดับระบบ (FR-AUTH-02)"""
    try:
        ZoneInfo(body.timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValidationError("เขตเวลาไม่ถูกต้อง", field="timezone") from exc
    with transaction() as conn:
        repo = PgClassroomRepository(conn)
        ClassroomAccess(repo).require(classroom_id, user_email, Capability.MANAGE_MEMBERS)
        repo.lock(classroom_id)
        room = repo.get_by_id(classroom_id)
        if room is None:
            raise NotFoundError("ไม่พบห้องเรียนนี้")
        before = {"name": room.name, "courseCode": room.course_code, "semester": room.semester, "timezone": room.timezone}
        after = {"name": body.name.strip(), "courseCode": (body.courseCode or "").strip() or None,
                 "semester": (body.semester or "").strip() or None, "timezone": body.timezone}
        repo.update_details(classroom_id, name=after["name"], course_code=after["courseCode"],
                            semester=after["semester"], timezone=after["timezone"])
        PgAuditRepository(conn).record(AuditEvent(
            actor_email=user_email, action=AuditAction.CLASSROOM_UPDATED,
            resource_type="classroom", resource_id=classroom_id, classroom_id=classroom_id,
            before_state=before, after_state=after,
            ip=request.client.host if request.client else None,
        ))
        updated = repo.get_by_id(classroom_id)
    return ClassroomOut.of(updated)


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
    # เฉพาะผู้สอน (Figma J16): เผยแพร่เมื่อ · ส่งแล้ว x / y คน
    publishedAt: datetime | None = None
    # Figma J31b: วันประกาศผล และนักศึกษายื่นอุทธรณ์ได้ถึง +7 วัน
    finalizedAt: datetime | None = None
    submittedStudents: int | None = None
    studentCount: int | None = None

    @staticmethod
    def of(a: Assignment) -> "AssignmentSummaryOut":
        return AssignmentSummaryOut(
            opensAtUtc=a.opens_at_utc,
            id=a.id,
            name=a.name,
            status=str(a.status),
            groupDeadlineUtc=a.group_deadline_utc,
            individualDeadlineUtc=a.individual_deadline_utc,
            finalizedAt=a.finalized_at,
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
        overview: dict[str, dict] = {}
        if can_manage:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT a.id::text AS id, a.published_at,
                      (SELECT COUNT(DISTINCT p.evaluator_user_id) FROM pair_assignment p
                         JOIN comparison r ON r.pair_assignment_id = p.id AND r.status = 'SUBMITTED'
                        WHERE p.assignment_id = a.id AND p.retired_at IS NULL) AS submitted_students,
                      (SELECT COUNT(*) FROM classroom_member m WHERE m.classroom_id = a.classroom_id
                         AND m.role = 'STUDENT' AND m.enrollment_status = 'ACTIVE') AS student_count
                    FROM assignment a WHERE a.classroom_id = %s
                    """,
                    (classroom_id,),
                )
                overview = {row["id"]: row for row in cur.fetchall()}

    return AssignmentSummaryList(items=[AssignmentSummaryOut.of(a).model_copy(update={
        "assignedCount": progress.get(a.id, {}).get("assigned", 0),
        "answeredCount": progress.get(a.id, {}).get("answered", 0),
        "submittedCount": progress.get(a.id, {}).get("submitted", 0),
        "submittedAt": progress.get(a.id, {}).get("submitted_at"),
        **({
            "publishedAt": overview[a.id]["published_at"],
            "submittedStudents": overview[a.id]["submitted_students"],
            "studentCount": overview[a.id]["student_count"],
        } if a.id in overview else {}),
    }) for a in items])


class MyGroupArtifactOut(BaseModel):
    groupName: str | None
    url: str | None
    assignmentName: str | None


@router.get("/{classroom_id}/my-group-artifact", response_model=MyGroupArtifactOut)
def my_group_artifact(classroom_id: str, user_email: CurrentUser) -> MyGroupArtifactOut:
    """ลิงก์ผลงานของกลุ่มตัวเองจากงานล่าสุดที่เผยแพร่แล้ว (Figma ST15 "ผลงานของกลุ่ม")

    คืนเฉพาะกลุ่มของผู้เรียก — ไม่มี parameter ให้ระบุกลุ่มอื่น"""
    with transaction() as conn:
        repo = PgClassroomRepository(conn)
        ClassroomAccess(repo).require(classroom_id, user_email, Capability.VIEW_ROSTER)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT g.name AS group_name,
                       (SELECT r.url FROM assignment_artifact r JOIN assignment a ON a.id = r.assignment_id
                        WHERE r.group_id = m.group_id AND a.status NOT IN ('DRAFT', 'ARCHIVED')
                        ORDER BY a.created_at DESC LIMIT 1) AS url,
                       (SELECT a.name FROM assignment_artifact r JOIN assignment a ON a.id = r.assignment_id
                        WHERE r.group_id = m.group_id AND a.status NOT IN ('DRAFT', 'ARCHIVED')
                        ORDER BY a.created_at DESC LIMIT 1) AS assignment_name
                FROM classroom_member m
                JOIN app_user u ON u.id = m.user_id
                LEFT JOIN group_entity g ON g.id = m.group_id
                WHERE m.classroom_id = %s AND u.email_normalized = %s
                """,
                (classroom_id, user_email),
            )
            row = cur.fetchone()
    if row is None:
        return MyGroupArtifactOut(groupName=None, url=None, assignmentName=None)
    return MyGroupArtifactOut(groupName=row["group_name"], url=row["url"], assignmentName=row["assignment_name"])
