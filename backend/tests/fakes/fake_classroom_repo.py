"""fake repository แบบเก็บใน memory

**ต้องมี method ครบและ signature ตรงกับ `ClassroomRepository` เสมอ**
ถ้า fake หลุดจากของจริงเมื่อไร test จะเขียวแต่ production พัง —
ซึ่งอันตรายกว่าไม่มี test เพราะทำให้เชื่อผิด

`_assert_matches_protocol()` ท้ายไฟล์ทำให้ type checker จับได้ตั้งแต่ตอน typecheck
ว่า fake ยังทำตามสัญญาอยู่ไหม
"""

from app.domain.models import Classroom
from app.domain.repositories import ClassroomRepository


class FakeClassroomRepo:
    def __init__(self, classrooms: list[Classroom] | None = None):
        self._by_slug: dict[str, Classroom] = {c.slug: c for c in (classrooms or [])}
        # นับจำนวนครั้งที่ save ถูกเรียก ใช้ยืนยันว่า service ไม่บันทึกตอนที่ควร reject
        self.save_call_count = 0

    def get_by_slug(self, slug: str) -> Classroom | None:
        return self._by_slug.get(slug)

    def save(self, classroom: Classroom) -> Classroom:
        self.save_call_count += 1
        self._by_slug[classroom.slug] = classroom
        return classroom

    # --- ส่วนที่มีเฉพาะใน fake เพื่อให้ test ตรวจสภาพได้ ---

    @property
    def count(self) -> int:
        return len(self._by_slug)


def _assert_matches_protocol() -> None:
    """ให้ type checker ยืนยันว่า FakeClassroomRepo ใช้แทนของจริงได้"""
    _: ClassroomRepository = FakeClassroomRepo()
