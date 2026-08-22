"""business logic ของการสร้างห้องเรียน (US-02)

service นี้ไม่รู้จัก HTTP และไม่รู้จัก SQL — รับ repository เข้ามาทาง constructor
จึงทดสอบได้ด้วย fake repository โดยไม่ต้องมี database
"""

import re
import unicodedata
import uuid
from datetime import UTC, datetime

from app.domain.errors import ConflictError, ValidationError
from app.domain.models import Classroom, ClassroomMember, MemberRole
from app.domain.repositories import ClassroomRepository

MAX_NAME_LENGTH = 200


def slugify(name: str) -> str:
    """แปลงชื่อห้องเรียนเป็น slug ที่ใช้ใน URL ได้

    รองรับภาษาไทย โดยเก็บอักษรไทยไว้ (ไม่ทับศัพท์) เพราะ URL สมัยใหม่รองรับ UTF-8
    และการทับศัพท์อัตโนมัติมักได้ผลที่คนอ่านแล้วงงกว่าเดิม
    """
    normalized = unicodedata.normalize("NFC", name).strip().lower()
    # ยุบทุกอย่างที่ไม่ใช่ตัวอักษร/ตัวเลข ให้เป็นขีดเดียว
    slug = re.sub(r"[^\w฀-๿]+", "-", normalized, flags=re.UNICODE)
    return slug.strip("-")


class ClassroomService:
    def __init__(self, classroom_repo: ClassroomRepository):
        self._repo = classroom_repo

    def create_classroom(
        self,
        *,
        name: str,
        timezone: str,
        created_by: str,
        allowed_email_domains: list[str] | None = None,
    ) -> tuple[Classroom, ClassroomMember]:
        """สร้างห้องเรียนใหม่ แล้วคืนทั้ง classroom และ membership ของผู้สร้าง

        คืนสองอย่างเพราะกฎ C1 บอกว่าผู้สร้างต้องได้เป็น OWNER
        ถ้าคืนแค่ classroom ชั้นบนอาจลืมสร้าง membership แล้วห้องเรียนจะไม่มีเจ้าของ
        """
        # C2 — ชื่อว่างไม่ได้
        if not name or not name.strip():
            raise ValidationError("ชื่อห้องเรียนห้ามว่าง", field="name")

        # C3 — ชื่อยาวเกินกำหนดไม่ได้
        if len(name.strip()) > MAX_NAME_LENGTH:
            raise ValidationError(
                f"ชื่อห้องเรียนยาวเกิน {MAX_NAME_LENGTH} ตัวอักษร", field="name"
            )

        # C4 — timezone ว่างไม่ได้ เพราะ deadline ทั้งระบบแสดงตาม timezone ของ classroom
        if not timezone or not timezone.strip():
            raise ValidationError("ต้องระบุ timezone ของห้องเรียน", field="timezone")

        slug = slugify(name)

        # C5 — slug ที่ยุบแล้วเหลือว่าง แปลว่าชื่อมีแต่อักขระพิเศษ ใช้เป็น URL ไม่ได้
        if not slug:
            raise ValidationError(
                "ชื่อห้องเรียนต้องมีตัวอักษรหรือตัวเลขอย่างน้อยหนึ่งตัว", field="name"
            )

        # C6 — slug ซ้ำไม่ได้
        if self._repo.get_by_slug(slug) is not None:
            raise ConflictError(f"มีห้องเรียนที่ใช้ slug '{slug}' อยู่แล้ว", field="name")

        classroom = Classroom(
            id=str(uuid.uuid4()),
            name=name.strip(),
            slug=slug,
            timezone=timezone.strip(),
            created_by=created_by,
            # C7 — domain เก็บเป็น lowercase เสมอ เพราะตอนเทียบกับอีเมลที่ normalize แล้ว
            # จะเทียบแบบ case-sensitive ถ้าไม่ lower ตรงนี้จะไม่มีวันตรงกัน
            allowed_email_domains=[
                d.strip().lower() for d in (allowed_email_domains or []) if d.strip()
            ],
            created_at=datetime.now(UTC),
        )

        saved = self._repo.save(classroom)

        # C1 — ผู้สร้างได้เป็น OWNER
        owner = ClassroomMember(
            classroom_id=saved.id,
            user_email=created_by,
            role=MemberRole.OWNER,
        )
        return saved, owner
