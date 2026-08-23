"""กฎการเข้าถึงห้องเรียน — US-11

รวมไว้ที่เดียวเพราะทุก endpoint ที่แตะ resource ใน classroom ต้องถามคำถามเดียวกันสองข้อ:
"คนนี้เป็นสมาชิกไหม" และ "role พอจะทำสิ่งนี้ไหม"

ถ้าปล่อยให้แต่ละ route เช็คเอง จะมี route ที่ลืมเช็ค — และ route ที่ลืม
คือช่องโหว่ที่ไม่มีใครสังเกตจนกว่าจะมีคนใช้มัน (AR-02)
"""

from app.domain.errors import ForbiddenError, NotFoundError
from app.domain.models import MemberRole
from app.domain.repositories import ClassroomRepository

# role ที่ถือว่าเป็นฝั่งผู้สอน — จัดการห้องเรียนและรายชื่อได้
INSTRUCTOR_ROLES = frozenset({MemberRole.OWNER, MemberRole.CO_TEACHER, MemberRole.TA})


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

    def require_instructor(self, classroom_id: str, email_normalized: str) -> MemberRole:
        """ยืนยันว่าเป็นฝั่งผู้สอนของห้องเรียนนี้

        ต้องผ่าน require_member ก่อนเสมอ — ลำดับนี้สำคัญ
        คนนอกต้องได้ 404 (ไม่รู้ว่ามีห้องนี้) ส่วนนักศึกษาในห้องได้ 403
        (รู้อยู่แล้วว่ามีห้องนี้ แค่ทำสิ่งนี้ไม่ได้) การสลับลำดับจะทำให้คนนอก
        ได้ 403 แล้วรู้ทันทีว่า id ที่เดามานั้นมีอยู่จริง
        """
        role = self.require_member(classroom_id, email_normalized)
        if role not in INSTRUCTOR_ROLES:
            raise ForbiddenError("ต้องเป็นผู้สอนของห้องเรียนนี้จึงจะทำรายการนี้ได้")
        return role
