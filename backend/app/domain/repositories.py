"""สัญญาของ repository ที่ชั้น domain ต้องการ

ประกาศเป็น Protocol ไม่ใช่ base class เพราะ
1. ตัวจริง (SQL) กับตัว fake (in-memory) ไม่ต้อง inherit อะไรร่วมกัน
2. mypy/pyright ตรวจให้ได้ว่า fake มี method ครบและ signature ตรง
   ซึ่งกันปัญหา "test เขียวแต่ production พัง" ที่เกิดจาก fake ไม่ตรงกับของจริง
"""

from typing import Protocol

from app.domain.models import Classroom, MemberRole, RosterMember, RosterRow


class ClassroomRepository(Protocol):
    def get_by_slug(self, slug: str) -> Classroom | None:
        """คืน classroom ที่ slug ตรง หรือ None ถ้าไม่มี"""
        ...

    def save(self, classroom: Classroom) -> Classroom:
        """บันทึกแล้วคืนตัวที่บันทึกแล้ว"""
        ...

    def get_member_role(self, classroom_id: str, email_normalized: str) -> MemberRole | None:
        """role ของผู้ใช้ใน classroom นี้ หรือ None ถ้าไม่ได้เป็นสมาชิก

        คืน None ทั้งกรณี "ไม่มี classroom นี้" และ "มีแต่ไม่ใช่สมาชิก" โดยตั้งใจ
        ผู้เรียกจะได้ตอบ 404 เหมือนกันทั้งสองกรณี ไม่รั่วว่า id ไหนมีอยู่จริง (US-11)
        """
        ...

    def replace_roster(self, classroom_id: str, rows: list[RosterRow]) -> None:
        """แทนที่รายชื่อนักศึกษาทั้งชุดของ classroom นี้ด้วย rows

        **แทนที่ ไม่ใช่เพิ่มต่อท้าย** — import ไฟล์เดิมซ้ำจึงได้ผลเท่าเดิมเสมอ
        ถ้าเป็นการเพิ่มต่อท้าย การ import ซ้ำจะทำให้สมาชิกซ้ำ และผล E2E
        จะขึ้นกับว่ารันมาแล้วกี่รอบ ซึ่งทำให้ test ไม่ deterministic

        แตะเฉพาะสมาชิก role STUDENT — อาจารย์และ TA ในห้องไม่ถูกลบไปด้วย
        """
        ...

    def list_roster(self, classroom_id: str) -> list[RosterMember]:
        """สมาชิกทั้งหมดใน classroom นี้ รวมอาจารย์"""
        ...
