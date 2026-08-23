"""fake repository แบบเก็บใน memory

**ต้องมี method ครบและ signature ตรงกับ `ClassroomRepository` เสมอ**
ถ้า fake หลุดจากของจริงเมื่อไร test จะเขียวแต่ production พัง —
ซึ่งอันตรายกว่าไม่มี test เพราะทำให้เชื่อผิด

`_assert_matches_protocol()` ท้ายไฟล์ทำให้ type checker จับได้ตั้งแต่ตอน typecheck
ว่า fake ยังทำตามสัญญาอยู่ไหม
"""

import uuid

from app.domain.models import Classroom, MemberRole, RosterMember, RosterRow
from app.domain.repositories import ClassroomRepository


class FakeClassroomRepo:
    def __init__(
        self,
        classrooms: list[Classroom] | None = None,
        members: dict[tuple[str, str], MemberRole] | None = None,
    ):
        self._by_slug: dict[str, Classroom] = {c.slug: c for c in (classrooms or [])}
        # key เป็น (classroom_id, email) เลียนแบบ unique constraint ของตาราง classroom_member
        self._members: dict[tuple[str, str], MemberRole] = dict(members or {})
        self._roster: dict[str, list[RosterRow]] = {}
        # นับจำนวนครั้งที่ save ถูกเรียก ใช้ยืนยันว่า service ไม่บันทึกตอนที่ควร reject
        self.save_call_count = 0
        self.replace_roster_call_count = 0

    def get_by_slug(self, slug: str) -> Classroom | None:
        return self._by_slug.get(slug)

    def save(self, classroom: Classroom) -> Classroom:
        self.save_call_count += 1
        self._by_slug[classroom.slug] = classroom
        return classroom

    def get_member_role(self, classroom_id: str, email_normalized: str) -> MemberRole | None:
        return self._members.get((classroom_id, email_normalized))

    def replace_roster(self, classroom_id: str, rows: list[RosterRow]) -> None:
        self.replace_roster_call_count += 1
        self._roster[classroom_id] = list(rows)
        # ล้าง STUDENT เดิมออกก่อน แล้วใส่ชุดใหม่ — เลียนแบบ semantics ของตัวจริง
        for key, role in list(self._members.items()):
            if key[0] == classroom_id and role is MemberRole.STUDENT:
                del self._members[key]
        for row in rows:
            self._members[(classroom_id, row.email_normalized)] = MemberRole.STUDENT

    def list_roster(self, classroom_id: str) -> list[RosterMember]:
        group_of = {r.email_normalized: r.group_name for r in self._roster.get(classroom_id, [])}
        return [
            RosterMember(
                user_id=str(uuid.uuid5(uuid.NAMESPACE_URL, email)),
                email=email,
                role=role,
                status="PENDING" if role is MemberRole.STUDENT else "ACTIVE",
                group_name=group_of.get(email),
            )
            for (room_id, email), role in self._members.items()
            if room_id == classroom_id
        ]

    # --- ส่วนที่มีเฉพาะใน fake เพื่อให้ test ตรวจสภาพได้ ---

    @property
    def count(self) -> int:
        return len(self._by_slug)

    def roster_of(self, classroom_id: str) -> list[RosterRow]:
        """แถวที่ถูกบันทึกจริง — ใช้ยืนยันกฎ atomic ว่าไม่มีอะไรหลุดลงไปตอน reject"""
        return self._roster.get(classroom_id, [])


def _assert_matches_protocol() -> None:
    """ให้ type checker ยืนยันว่า FakeClassroomRepo ใช้แทนของจริงได้"""
    _: ClassroomRepository = FakeClassroomRepo()
