"""endpoint ของห้องเรียน — US-02

route ที่นี่ทำหน้าที่แค่ 3 อย่าง: อ่าน input, เปิด transaction, แปลงผลเป็น JSON
กฎธุรกิจทั้งหมดอยู่ใน ClassroomService ซึ่งทดสอบแยกได้โดยไม่ต้องมี HTTP หรือ DB
"""

from fastapi import APIRouter, Response
from pydantic import BaseModel, Field

from app.auth import CurrentUser
from app.db import transaction
from app.domain.classroom_service import ClassroomService
from app.domain.models import Classroom
from app.repositories.pg_classroom_repo import PgClassroomRepository

router = APIRouter(prefix="/api/classrooms", tags=["classrooms"])


class ClassroomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    timezone: str = Field(min_length=1)
    allowedEmailDomains: list[str] = Field(default_factory=list)


class ClassroomOut(BaseModel):
    id: str
    name: str
    slug: str
    timezone: str
    allowedEmailDomains: list[str]
    status: str

    @staticmethod
    def of(c: Classroom) -> "ClassroomOut":
        return ClassroomOut(
            id=c.id,
            name=c.name,
            slug=c.slug,
            timezone=c.timezone,
            allowedEmailDomains=c.allowed_email_domains,
            status=str(c.status),
        )


class ClassroomList(BaseModel):
    items: list[ClassroomOut]


@router.get("", response_model=ClassroomList)
def list_classrooms(user_email: CurrentUser) -> ClassroomList:
    with transaction() as conn:
        repo = PgClassroomRepository(conn)
        rooms = repo.list_for_user(user_email)
    return ClassroomList(items=[ClassroomOut.of(c) for c in rooms])


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
            allowed_email_domains=body.allowedEmailDomains,
        )
        repo.save_member(owner)

    response.headers["Location"] = f"/api/classrooms/{classroom.id}"
    return ClassroomOut.of(classroom)
