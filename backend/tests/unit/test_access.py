"""unit test ของกฎการเข้าถึงห้องเรียน — อ้าง US-11 และ US-12

AC ของ US-11 ตัดสินกันที่ status code ที่ต่างกันเพียงเล็กน้อย (401 / 403 / 404)
แต่ความต่างนั้นคือสาระของ story — test ชุดนี้จึงยืนยันที่ตัวเลขนั้น
ส่วน 401 อยู่ที่ชั้น auth ไม่ใช่ที่นี่ (ดู tests/api/test_error_shape.py)

US-12 เพิ่มมิติที่สอง: role ไหนทำ *อะไร* ได้ ซึ่งเดิมรวมเป็นก้อนเดียว
ตาราง role matrix จึงมี test ไล่ทุกช่องแบบ parametrize ไม่ใช่สุ่มตรวจบางช่อง
"""

import pytest

from app.domain.access import Capability, ClassroomAccess, capabilities_of
from app.domain.errors import ForbiddenError, NotFoundError
from app.domain.models import MemberRole
from tests.fakes.fake_classroom_repo import FakeClassroomRepo

ROOM_A = "11111111-1111-1111-1111-111111111111"
ROOM_B = "22222222-2222-2222-2222-222222222222"
AJARN = "ajarn@kmitl.ac.th"
STUDENT = "student@kmitl.ac.th"
OUTSIDER = "outsider@kmitl.ac.th"


@pytest.fixture
def access() -> ClassroomAccess:
    repo = FakeClassroomRepo(
        members={
            (ROOM_A, AJARN): MemberRole.OWNER,
            (ROOM_A, STUDENT): MemberRole.STUDENT,
            (ROOM_B, OUTSIDER): MemberRole.OWNER,
        }
    )
    return ClassroomAccess(repo)


def access_as(role: MemberRole) -> ClassroomAccess:
    return ClassroomAccess(FakeClassroomRepo(members={(ROOM_A, AJARN): role}))


class TestRequireMember:
    def test_สมาชิกของห้องได้_role_ของตัวเองกลับมา(self, access: ClassroomAccess):
        assert access.require_member(ROOM_A, AJARN) is MemberRole.OWNER
        assert access.require_member(ROOM_A, STUDENT) is MemberRole.STUDENT

    def test_AC_สมาชิกห้อง_A_ขอ_resource_ห้อง_B_ได้_404_ไม่ใช่_403(
        self, access: ClassroomAccess
    ):
        # หัวใจของ US-11 — 403 จะเป็นการยืนยันว่า ROOM_B มีอยู่จริง
        with pytest.raises(NotFoundError):
            access.require_member(ROOM_B, AJARN)

    def test_ห้องเรียนที่ไม่มีอยู่จริงตอบเหมือนห้องของคนอื่นทุกประการ(
        self, access: ClassroomAccess
    ):
        # ถ้าสองเคสนี้ตอบต่างกัน คนนอกจะแยกออกว่า id ไหนมีอยู่จริง
        with pytest.raises(NotFoundError) as unknown:
            access.require_member("99999999-9999-9999-9999-999999999999", AJARN)
        with pytest.raises(NotFoundError) as other_room:
            access.require_member(ROOM_B, AJARN)

        assert unknown.value.message == other_room.value.message
        assert unknown.value.code == other_room.value.code


class TestRoleMatrix:
    """ตารางนี้ลอกมาจาก role matrix ใน PRD §3 — ทุกช่องมี test ของตัวเอง

    เขียนเต็มตารางแทนที่จะทดสอบเฉพาะข้อที่ AC พูดถึง เพราะช่องที่ไม่มีใครตรวจ
    คือช่องที่จะเปลี่ยนไปเงียบ ๆ ตอนมีคนเพิ่ม capability ใหม่
    """

    EXPECTED: dict[MemberRole, set[Capability]] = {
        MemberRole.OWNER: {
            Capability.VIEW_ROSTER,
            Capability.MANAGE_ROSTER,
            Capability.MANAGE_ASSIGNMENT,
            Capability.MANAGE_MEMBERS,
            Capability.FINALIZE_SCORES,
            Capability.VIEW_AUDIT,
        },
        MemberRole.CO_TEACHER: {
            Capability.VIEW_ROSTER,
            Capability.MANAGE_ROSTER,
            Capability.MANAGE_ASSIGNMENT,
            Capability.VIEW_AUDIT,
        },
        MemberRole.TA: {
            Capability.VIEW_ROSTER,
            Capability.MANAGE_ROSTER,
            Capability.VIEW_AUDIT,
        },
        MemberRole.STUDENT: {Capability.VIEW_ROSTER},
    }

    @pytest.mark.parametrize("role", list(MemberRole))
    def test_ตาราง_capability_ตรงกับ_role_matrix(self, role: MemberRole):
        assert capabilities_of(role) == self.EXPECTED[role]

    @pytest.mark.parametrize("role", list(MemberRole))
    @pytest.mark.parametrize("capability", list(Capability))
    def test_ทุกช่องในตารางบังคับใช้จริงผ่าน_require(
        self, role: MemberRole, capability: Capability
    ):
        access = access_as(role)

        if capability in self.EXPECTED[role]:
            assert access.require(ROOM_A, AJARN, capability) is role
        else:
            with pytest.raises(ForbiddenError):
                access.require(ROOM_A, AJARN, capability)


class TestCapabilityChecks:
    def test_AC_TA_สร้าง_assignment_ไม่ได้(self):
        # ข้อที่ขัดกับ implementation เดิมโดยตรง — เดิม TA ผ่านเพราะถูกนับเป็นผู้สอน
        with pytest.raises(ForbiddenError):
            access_as(MemberRole.TA).require(ROOM_A, AJARN, Capability.MANAGE_ASSIGNMENT)

    def test_AC_CO_TEACHER_สร้าง_assignment_ได้(self):
        assert (
            access_as(MemberRole.CO_TEACHER).require(
                ROOM_A, AJARN, Capability.MANAGE_ASSIGNMENT
            )
            is MemberRole.CO_TEACHER
        )

    def test_AC_CO_TEACHER_finalize_คะแนนไม่ได้(self):
        with pytest.raises(ForbiddenError):
            access_as(MemberRole.CO_TEACHER).require(
                ROOM_A, AJARN, Capability.FINALIZE_SCORES
            )

    def test_AC_TA_จัดการ_roster_ได้(self):
        assert (
            access_as(MemberRole.TA).require(ROOM_A, AJARN, Capability.MANAGE_ROSTER)
            is MemberRole.TA
        )

    @pytest.mark.parametrize("role", [MemberRole.CO_TEACHER, MemberRole.TA])
    def test_AC_มีแต่_OWNER_ที่จัดการสมาชิกได้(self, role: MemberRole):
        with pytest.raises(ForbiddenError):
            access_as(role).require(ROOM_A, AJARN, Capability.MANAGE_MEMBERS)

    def test_AC_นักศึกษาเรียก_endpoint_ของผู้สอนได้_403(self, access: ClassroomAccess):
        # นักศึกษาอยู่ในห้องนี้จริง จึงรู้อยู่แล้วว่าห้องมีอยู่ — 403 ไม่ได้รั่วอะไรเพิ่ม
        with pytest.raises(ForbiddenError):
            access.require(ROOM_A, STUDENT, Capability.MANAGE_ROSTER)

    def test_AC_นักศึกษาอ่าน_audit_log_ไม่ได้(self, access: ClassroomAccess):
        with pytest.raises(ForbiddenError):
            access.require(ROOM_A, STUDENT, Capability.VIEW_AUDIT)

    def test_คนนอกได้_404_ไม่ใช่_403_แม้จะเรียก_endpoint_ของผู้สอน(
        self, access: ClassroomAccess
    ):
        # ลำดับการตรวจสำคัญ: ถ้าเช็ค capability ก่อนเช็คสมาชิก คนนอกจะได้ 403
        # แล้วรู้ทันทีว่า id ที่เดามามีอยู่จริง
        with pytest.raises(NotFoundError):
            access.require(ROOM_A, OUTSIDER, Capability.MANAGE_ASSIGNMENT)
