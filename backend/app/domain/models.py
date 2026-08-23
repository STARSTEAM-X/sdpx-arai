"""entity ของชั้น domain

ตั้งใจให้เป็น dataclass ธรรมดา ไม่ผูกกับ ORM หรือ framework ใด ๆ
เพื่อให้ service ที่ใช้มันทดสอบได้โดยไม่ต้องมี database
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class ClassroomStatus(StrEnum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class MemberRole(StrEnum):
    OWNER = "OWNER"
    CO_TEACHER = "CO_TEACHER"
    TA = "TA"
    STUDENT = "STUDENT"


@dataclass
class Classroom:
    id: str
    name: str
    slug: str
    timezone: str
    created_by: str
    allowed_email_domains: list[str] = field(default_factory=list)
    status: ClassroomStatus = ClassroomStatus.ACTIVE
    created_at: datetime | None = None


@dataclass
class ClassroomMember:
    classroom_id: str
    user_email: str
    role: MemberRole
    group_name: str | None = None


@dataclass
class RosterMember:
    """สมาชิกหนึ่งคนในห้องเรียน ตามที่ `GET /roster` ต้องคืน

    ต่างจาก `RosterRow` ตรงที่ตัวนั้นคือ "แถวใน CSV ที่ยังไม่ได้บันทึก"
    ส่วนตัวนี้คือ "สิ่งที่อยู่ในระบบแล้ว" จึงมี user id และ status ของบัญชีติดมาด้วย
    """

    user_id: str
    email: str
    role: MemberRole
    status: str
    display_name: str | None = None
    group_name: str | None = None


@dataclass
class RosterRow:
    """หนึ่งแถวใน CSV หลังผ่านการ parse และ normalize แล้ว"""

    row_number: int
    email_normalized: str
    email_raw: str
    group_name: str
    student_id: str | None = None
    display_name: str | None = None


@dataclass
class RosterWarning:
    """เรื่องที่ควรรู้แต่ไม่ถึงกับต้อง reject ทั้งไฟล์"""

    type: str
    message: str


@dataclass
class RosterImportResult:
    rows: list[RosterRow]
    groups: list[str]
    warnings: list[RosterWarning] = field(default_factory=list)
