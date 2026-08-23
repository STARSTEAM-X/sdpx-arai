"""endpoint จัดการผู้ร่วมสอนและ TA — US-12 · และหน้าต่างอ่าน audit log — US-14

เฉพาะ OWNER เท่านั้นที่เพิ่มหรือถอดสมาชิกฝั่งผู้สอนได้ ส่วนคนนอกห้องได้ 404
เหมือนทุก endpoint ที่ผูกกับ classroom (US-11)
"""

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from app.auth import CurrentUser
from app.db import transaction
from app.domain.access import Capability, ClassroomAccess
from app.domain.audit import AuditAction, AuditEvent
from app.domain.email import normalize_email
from app.domain.errors import NotFoundError
from app.domain.member_service import assert_removable, validate_new_member
from app.domain.models import MemberRole
from app.repositories.pg_audit_repo import PgAuditRepository
from app.repositories.pg_classroom_repo import PgClassroomRepository

router = APIRouter(prefix="/api/classrooms", tags=["classrooms"])


class MemberIn(BaseModel):
    email: str = Field(min_length=3)
    role: MemberRole


class MemberOut(BaseModel):
    memberId: str
    email: str
    role: str


class AuditList(BaseModel):
    items: list[dict]


@router.post("/{classroom_id}/members", response_model=MemberOut, status_code=201)
def add_member(
    classroom_id: str,
    body: MemberIn,
    user_email: CurrentUser,
    request: Request,
    response: Response,
) -> MemberOut:
    with transaction() as conn:
        repo = PgClassroomRepository(conn)
        # OWNER เท่านั้น — CO_TEACHER และ TA ได้ 403 ส่วนคนนอกได้ 404
        ClassroomAccess(repo).require(classroom_id, user_email, Capability.MANAGE_MEMBERS)

        classroom = repo.get_by_id(classroom_id)
        if classroom is None:
            raise NotFoundError("ไม่พบห้องเรียนนี้")

        # ต้องหา role เดิมด้วยอีเมลที่ normalize แล้ว — `Somchai.A+x@` กับ `somchai.a@`
        # เป็นคนเดียวกัน ถ้าค้นด้วยอีเมลดิบจะเพิ่มคนเดิมซ้ำได้โดยไม่มีอะไรทัก
        candidate = validate_new_member(
            email_raw=body.email,
            role=body.role,
            allowed_email_domains=classroom.allowed_email_domains,
            existing_role=repo.get_member_role(
                classroom_id, normalize_email(body.email)
            ),
        )

        member_id = repo.add_instructor(
            classroom_id,
            email_normalized=candidate.email_normalized,
            email_raw=candidate.email_raw,
            role=candidate.role,
        )

        # audit อยู่ใน transaction เดียวกับการเพิ่ม — ถ้าเขียน log ไม่สำเร็จ
        # การเพิ่มสมาชิกก็ถูก rollback ไปด้วย (AC ข้อ 4 ของ US-14)
        PgAuditRepository(conn).record(
            AuditEvent(
                actor_email=user_email,
                action=AuditAction.MEMBER_ROLE_CHANGED,
                resource_type="classroom_member",
                resource_id=member_id,
                classroom_id=classroom_id,
                before_state=None,
                after_state={"email": candidate.email_normalized, "role": str(candidate.role)},
                ip=request.client.host if request.client else None,
            )
        )

    response.headers["Location"] = f"/api/classrooms/{classroom_id}/members/{member_id}"
    return MemberOut(
        memberId=member_id, email=candidate.email_normalized, role=str(candidate.role)
    )


@router.delete("/{classroom_id}/members/{member_id}", status_code=204)
def remove_member(
    classroom_id: str, member_id: str, user_email: CurrentUser, request: Request
) -> Response:
    with transaction() as conn:
        repo = PgClassroomRepository(conn)
        ClassroomAccess(repo).require(classroom_id, user_email, Capability.MANAGE_MEMBERS)

        found = repo.get_member(classroom_id, member_id)
        if found is None:
            raise NotFoundError("ไม่พบสมาชิกคนนี้ในห้องเรียนนี้")
        email, role = found

        # รวมกรณีถอดตัวเองด้วย — OWNER คนสุดท้ายถอดตัวเองแล้วห้องจะไม่มีเจ้าของ
        assert_removable(role_to_remove=role, owner_count=repo.count_owners(classroom_id))

        repo.remove_member(classroom_id, member_id)

        PgAuditRepository(conn).record(
            AuditEvent(
                actor_email=user_email,
                action=AuditAction.MEMBER_REMOVED,
                resource_type="classroom_member",
                resource_id=member_id,
                classroom_id=classroom_id,
                before_state={"email": email, "role": str(role)},
                after_state=None,
                ip=request.client.host if request.client else None,
            )
        )

    return Response(status_code=204)


@router.get("/{classroom_id}/audit", response_model=AuditList)
def list_audit(classroom_id: str, user_email: CurrentUser) -> AuditList:
    """อ่าน audit log ของห้องเรียน — นักศึกษาได้ 403 (AC ข้อ 5 ของ US-14)"""
    with transaction() as conn:
        repo = PgClassroomRepository(conn)
        ClassroomAccess(repo).require(classroom_id, user_email, Capability.VIEW_AUDIT)
        items = PgAuditRepository(conn).list_for_classroom(classroom_id)

    return AuditList(items=items)
