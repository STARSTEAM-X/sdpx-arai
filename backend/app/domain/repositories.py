"""สัญญาของ repository ที่ชั้น domain ต้องการ

ประกาศเป็น Protocol ไม่ใช่ base class เพราะ
1. ตัวจริง (SQL) กับตัว fake (in-memory) ไม่ต้อง inherit อะไรร่วมกัน
2. mypy/pyright ตรวจให้ได้ว่า fake มี method ครบและ signature ตรง
   ซึ่งกันปัญหา "test เขียวแต่ production พัง" ที่เกิดจาก fake ไม่ตรงกับของจริง
"""

from typing import Protocol

from app.domain.models import Classroom


class ClassroomRepository(Protocol):
    def get_by_slug(self, slug: str) -> Classroom | None:
        """คืน classroom ที่ slug ตรง หรือ None ถ้าไม่มี"""
        ...

    def save(self, classroom: Classroom) -> Classroom:
        """บันทึกแล้วคืนตัวที่บันทึกแล้ว"""
        ...
