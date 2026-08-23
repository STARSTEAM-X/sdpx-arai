"""endpoint ของรายชื่อสมาชิกห้องเรียน — US-03 และเป็นด่านที่ US-11 ถูกบังคับใช้จริง

route ที่นี่บาง: อ่าน input, เปิด transaction, แปลงผลเป็น JSON
การตัดสินสิทธิ์และกฎ atomic อยู่ใน RosterService ซึ่งทดสอบได้โดยไม่ต้องมี HTTP หรือ DB
"""

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

from app.auth import CurrentUser
from app.db import transaction
from app.domain.errors import ValidationError
from app.domain.models import RosterImportResult, RosterMember
from app.domain.roster_service import RosterService
from app.repositories.pg_classroom_repo import PgClassroomRepository

router = APIRouter(prefix="/api/classrooms", tags=["classrooms"])

# กันไฟล์ใหญ่เกินจนกิน memory ของ service — roster ของห้องเรียนจริงไม่ถึงหลักนี้
# 2 MB รองรับได้ราวหลายหมื่นแถว ซึ่งเกินขนาดชั้นเรียนไปมากอยู่แล้ว
MAX_UPLOAD_BYTES = 2 * 1024 * 1024


class RosterEntryOut(BaseModel):
    userId: str
    email: str
    displayName: str | None
    role: str
    groupName: str | None
    status: str

    @staticmethod
    def of(m: RosterMember) -> "RosterEntryOut":
        return RosterEntryOut(
            userId=m.user_id,
            email=m.email,
            displayName=m.display_name,
            role=str(m.role),
            groupName=m.group_name,
            status=m.status,
        )


class RosterList(BaseModel):
    items: list[RosterEntryOut]


class RosterWarningOut(BaseModel):
    type: str
    message: str


class RosterImportOut(BaseModel):
    imported: int
    groupsCreated: int
    warnings: list[RosterWarningOut]

    @staticmethod
    def of(r: RosterImportResult) -> "RosterImportOut":
        return RosterImportOut(
            imported=len(r.rows),
            groupsCreated=len(r.groups),
            warnings=[RosterWarningOut(type=w.type, message=w.message) for w in r.warnings],
        )


@router.get("/{classroom_id}/roster", response_model=RosterList)
def get_roster(classroom_id: str, user_email: CurrentUser) -> RosterList:
    with transaction() as conn:
        service = RosterService(classroom_repo=PgClassroomRepository(conn))
        members = service.list_roster(classroom_id=classroom_id, actor_email=user_email)
    return RosterList(items=[RosterEntryOut.of(m) for m in members])


@router.post("/{classroom_id}/roster:import", response_model=RosterImportOut)
async def import_roster(
    classroom_id: str,
    user_email: CurrentUser,
    file: UploadFile = File(...),
) -> RosterImportOut:
    """นำเข้ารายชื่อจาก CSV — ทั้งไฟล์ผ่านหรือไม่บันทึกเลย

    อ่านไฟล์ทั้งก้อนเข้า memory เพราะ parser ต้องเห็นทุกแถวก่อนตัดสินอยู่แล้ว
    การอ่านทีละ chunk จะไม่ช่วยอะไรเลยในเมื่อกฎ atomic บังคับให้รอครบทั้งไฟล์
    """
    raw = await file.read()

    if not raw:
        raise ValidationError("ไม่ได้แนบไฟล์ หรือไฟล์ว่าง", field="file")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ValidationError(
            f"ไฟล์ใหญ่เกิน {MAX_UPLOAD_BYTES // (1024 * 1024)} MB", field="file"
        )

    # transaction ครอบทั้งการเขียน — ถ้าแถวใดพังกลางทาง จะ rollback ทั้งชุด
    with transaction() as conn:
        service = RosterService(classroom_repo=PgClassroomRepository(conn))
        result = service.import_csv(
            classroom_id=classroom_id, actor_email=user_email, raw=raw
        )

    return RosterImportOut.of(result)
