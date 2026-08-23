"""unit test ของกฎการเข้าถึงห้องเรียน — อ้าง US-11

AC ทั้งสามข้อของ US-11 ตัดสินกันที่ status code ที่ต่างกันเพียงเล็กน้อย
(401 / 403 / 404) แต่ความต่างนั้นคือสาระของ story — test ชุดนี้จึงยืนยันที่ตัวเลขนั้น
ส่วน 401 อยู่ที่ชั้น auth ไม่ใช่ที่นี่ (ดู tests/api/test_error_shape.py)
"""

import pytest

from app.domain.access import ClassroomAccess
from app.domain.errors import ForbiddenError, NotFoundError
from app.domain.models import MemberRole
from tests.fakes.fake_classroom_repo import FakeClassroomRepo

ROOM_A = "11111111-1111-1111-1111-111111111111"
ROOM_B = "22222222-2222-2222-2222-222222222222"
AJARN = "ajarn@uni.ac.th"
STUDENT = "student@uni.ac.th"
OUTSIDER = "outsider@uni.ac.th"


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


class TestRequireInstructor:
    @pytest.mark.parametrize(
        "role", [MemberRole.OWNER, MemberRole.CO_TEACHER, MemberRole.TA]
    )
    def test_ฝั่งผู้สอนทำได้ทุก_role(self, role: MemberRole):
        repo = FakeClassroomRepo(members={(ROOM_A, AJARN): role})
        assert ClassroomAccess(repo).require_instructor(ROOM_A, AJARN) is role

    def test_AC_นักศึกษาเรียก_endpoint_ของผู้สอนได้_403(self, access: ClassroomAccess):
        # นักศึกษาอยู่ในห้องนี้จริง จึงรู้อยู่แล้วว่าห้องมีอยู่ — 403 ไม่ได้รั่วอะไรเพิ่ม
        with pytest.raises(ForbiddenError):
            access.require_instructor(ROOM_A, STUDENT)

    def test_คนนอกได้_404_ไม่ใช่_403_แม้จะเรียก_endpoint_ของผู้สอน(
        self, access: ClassroomAccess
    ):
        # ลำดับการตรวจสำคัญ: ถ้าเช็ค role ก่อนเช็คสมาชิก คนนอกจะได้ 403
        # แล้วรู้ทันทีว่า id ที่เดามามีอยู่จริง
        with pytest.raises(NotFoundError):
            access.require_instructor(ROOM_A, OUTSIDER)
