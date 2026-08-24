"""กฎการเข้าถึงห้องเรียน — US-11, US-12

รวมไว้ที่เดียวเพราะทุก endpoint ที่แตะ resource ใน classroom ต้องถามคำถามเดียวกันสองข้อ:
"คนนี้เป็นสมาชิกไหม" และ "role ของเขาทำสิ่งนี้ได้ไหม"

ถ้าปล่อยให้แต่ละ route เช็คเอง จะมี route ที่ลืมเช็ค — และ route ที่ลืม
คือช่องโหว่ที่ไม่มีใครสังเกตจนกว่าจะมีคนใช้มัน (AR-02)

## ทำไมเช็คเป็น capability ไม่ใช่ role

รอบแรกที่นี่มี `INSTRUCTOR_ROLES` ก้อนเดียวรวม OWNER, CO_TEACHER และ TA
ซึ่ง**ถูกตราบใดที่ระบบมีแค่ roster** เพราะทั้งสาม role จัดการ roster ได้จริงตาม role matrix
แต่พอมี assignment เข้ามา ก้อนเดียวกลายเป็นช่องโหว่ทันที — TA สร้าง assignment ได้
ทั้งที่ matrix บอกว่าไม่ได้ (US-12)

การถามว่า "role นี้ทำ *สิ่งนี้* ได้ไหม" แทน "role นี้เป็นผู้สอนไหม" ทำให้เพิ่ม capability
ใหม่แล้วต้องตอบให้ครบทุก role ตั้งแต่ตอน compile — ลืมไม่ได้เหมือนการเติม role เข้าก้อนเดิม
"""

from enum import StrEnum, auto

from app.domain.errors import ForbiddenError, NotFoundError
from app.domain.models import MemberRole
from app.domain.repositories import ClassroomRepository


class Capability(StrEnum):
    """สิ่งที่ทำได้ในห้องเรียนหนึ่ง — ตั้งชื่อตามการกระทำ ไม่ใช่ตามตำแหน่ง"""

    VIEW_ROSTER = auto()
    MANAGE_ROSTER = auto()
    MANAGE_ASSIGNMENT = auto()
    MANAGE_MEMBERS = auto()
    FINALIZE_SCORES = auto()
    VIEW_AUDIT = auto()
    # เห็นตัวตนจริงของผู้ประเมิน — เฉพาะ export ที่มี identity (FR-EXPORT-04, US-15)
    # แยกจาก FINALIZE_SCORES โดยตั้งใจ: คนละความเสี่ยงกัน อันหนึ่งกระทบคะแนน
    # อีกอันกระทบความเป็นส่วนตัวของนักศึกษาที่ประเมิน — รวมกันจะบังตาว่าเหตุผลจริงคืออะไร
    VIEW_EVALUATOR_IDENTITY = auto()


# role matrix จาก PRD §3 — เขียนเป็นตารางเต็มโดยตั้งใจ
# ไม่ใช้ "ทุก role ยกเว้น..." เพราะการเติม role ใหม่แล้วลืมกรอกช่องใดช่องหนึ่ง
# จะกลายเป็นการให้สิทธิ์โดยบังเอิญ ซึ่งเป็นทิศทางที่ผิดสำหรับความปลอดภัย
_MATRIX: dict[MemberRole, frozenset[Capability]] = {
    MemberRole.OWNER: frozenset(
        {
            Capability.VIEW_ROSTER,
            Capability.MANAGE_ROSTER,
            Capability.MANAGE_ASSIGNMENT,
            Capability.MANAGE_MEMBERS,
            Capability.FINALIZE_SCORES,
            Capability.VIEW_AUDIT,
            Capability.VIEW_EVALUATOR_IDENTITY,
        }
    ),
    MemberRole.CO_TEACHER: frozenset(
        {
            Capability.VIEW_ROSTER,
            Capability.MANAGE_ROSTER,
            Capability.MANAGE_ASSIGNMENT,
            Capability.VIEW_AUDIT,
            # ไม่มี MANAGE_MEMBERS — การเพิ่ม/ถอดผู้สอนเป็นของเจ้าของห้อง
            # ไม่มี FINALIZE_SCORES — การตัดสินคะแนนสุดท้ายย้อนกลับไม่ได้
        }
    ),
    MemberRole.TA: frozenset(
        {
            Capability.VIEW_ROSTER,
            Capability.MANAGE_ROSTER,
            Capability.VIEW_AUDIT,
            # ไม่มี MANAGE_ASSIGNMENT — TA ดูแลได้แค่ roster ตาม matrix
        }
    ),
    MemberRole.STUDENT: frozenset({Capability.VIEW_ROSTER}),
}


def capabilities_of(role: MemberRole) -> frozenset[Capability]:
    return _MATRIX[role]


class ClassroomAccess:
    def __init__(self, classroom_repo: ClassroomRepository):
        self._repo = classroom_repo

    def require_member(self, classroom_id: str, email_normalized: str) -> MemberRole:
        """ยืนยันว่าเป็นสมาชิก แล้วคืน role — ถ้าไม่ใช่ ให้ 404 ไม่ใช่ 403

        AC ของ US-11 บังคับข้อนี้ไว้ชัด: การขอ resource ของห้องเรียนอื่นต้องตอบ 404
        เพราะ 403 เท่ากับยืนยันว่า "id นี้มีอยู่จริงนะ แค่ไม่ใช่ของคุณ"
        ซึ่งพอเอาไปยิงไล่ทีละ id ก็กลายเป็นเครื่องมือสำรวจว่าในระบบมีห้องเรียนอะไรบ้าง
        """
        role = self._repo.get_member_role(classroom_id, email_normalized)
        if role is None:
            raise NotFoundError("ไม่พบห้องเรียนนี้")
        return role

    def require(
        self, classroom_id: str, email_normalized: str, capability: Capability
    ) -> MemberRole:
        """ยืนยันว่าเป็นสมาชิก **และ** role ทำสิ่งนี้ได้

        ต้องผ่าน require_member ก่อนเสมอ — ลำดับนี้สำคัญ
        คนนอกต้องได้ 404 (ไม่รู้ว่ามีห้องนี้) ส่วนสมาชิกที่ role ไม่พอได้ 403
        (รู้อยู่แล้วว่ามีห้องนี้ แค่ทำสิ่งนี้ไม่ได้) การสลับลำดับจะทำให้คนนอก
        ได้ 403 แล้วรู้ทันทีว่า id ที่เดามานั้นมีอยู่จริง
        """
        role = self.require_member(classroom_id, email_normalized)
        if capability not in capabilities_of(role):
            raise ForbiddenError(
                f"role {role} ทำรายการนี้ไม่ได้ในห้องเรียนนี้", field="role"
            )
        return role
