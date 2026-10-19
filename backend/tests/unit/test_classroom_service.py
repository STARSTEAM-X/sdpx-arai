"""unit test ของ ClassroomService — อ้าง US-02

ชื่อ test แต่ละตัวระบุ **กฎที่มันปกป้อง** ไว้ตรง ๆ
เพื่อให้ตอบคำถาม "ลบอะไรออกแล้วมันจะแดง" ได้ทันทีโดยไม่ต้องอ่าน body
"""

import pytest

from app.domain.classroom_service import MAX_NAME_LENGTH, ClassroomService, slugify
from app.domain.errors import ConflictError, ValidationError
from app.domain.models import MemberRole
from tests.fakes.fake_classroom_repo import FakeClassroomRepo


class TestCreateClassroom:
    def test_C1_ผู้สร้างได้เป็น_OWNER(self, service: ClassroomService):
        _, owner = service.create_classroom(
            name="Software Engineering 2026",
            timezone="Asia/Bangkok",
            created_by="ajarn@uni.ac.th",
        )

        assert owner.role is MemberRole.OWNER
        assert owner.user_email == "ajarn@uni.ac.th"

    def test_สร้างสำเร็จแล้วถูกบันทึกลง_repository(
        self, service: ClassroomService, empty_repo: FakeClassroomRepo
    ):
        classroom, _ = service.create_classroom(
            name="Data Structures",
            timezone="Asia/Bangkok",
            created_by="ajarn@uni.ac.th",
        )

        assert empty_repo.get_by_slug(classroom.slug) is classroom

    @pytest.mark.parametrize("bad_name", ["", "   ", "\t\n"])
    def test_C2_ชื่อว่างถูกปฏิเสธ(self, service: ClassroomService, bad_name: str):
        with pytest.raises(ValidationError) as exc:
            service.create_classroom(
                name=bad_name, timezone="Asia/Bangkok", created_by="ajarn@uni.ac.th"
            )

        assert exc.value.field == "name"

    def test_C3_ชื่อยาวเกินกำหนดถูกปฏิเสธ(self, service: ClassroomService):
        with pytest.raises(ValidationError):
            service.create_classroom(
                name="ก" * (MAX_NAME_LENGTH + 1),
                timezone="Asia/Bangkok",
                created_by="ajarn@uni.ac.th",
            )

    def test_C4_ไม่ระบุ_timezone_ถูกปฏิเสธ(self, service: ClassroomService):
        """deadline ทั้งระบบแสดงตาม timezone ของ classroom ถ้าไม่มีจะแสดงผลผิดทั้งห้อง"""
        with pytest.raises(ValidationError) as exc:
            service.create_classroom(
                name="Software Engineering", timezone="", created_by="ajarn@uni.ac.th"
            )

        assert exc.value.field == "timezone"

    def test_C5_ชื่อที่มีแต่อักขระพิเศษถูกปฏิเสธ(self, service: ClassroomService):
        """ชื่อแบบนี้ยุบเป็น slug แล้วเหลือว่าง ใช้เป็น URL ไม่ได้"""
        with pytest.raises(ValidationError):
            service.create_classroom(
                name="!!! @@@ ###", timezone="Asia/Bangkok", created_by="ajarn@uni.ac.th"
            )

    def test_C6_slug_ซ้ำถูกปฏิเสธ(self, repo_with_existing_classroom: FakeClassroomRepo):
        service = ClassroomService(classroom_repo=repo_with_existing_classroom)

        with pytest.raises(ConflictError):
            service.create_classroom(
                name="Software Engineering 2026",
                timezone="Asia/Bangkok",
                created_by="another@uni.ac.th",
            )

    def test_C6_ถูกปฏิเสธแล้วต้องไม่บันทึกอะไรเลย(
        self, repo_with_existing_classroom: FakeClassroomRepo
    ):
        """กันเคสที่ service เผลอ save ก่อนแล้วค่อยตรวจ"""
        service = ClassroomService(classroom_repo=repo_with_existing_classroom)
        before = repo_with_existing_classroom.count

        with pytest.raises(ConflictError):
            service.create_classroom(
                name="Software Engineering 2026",
                timezone="Asia/Bangkok",
                created_by="another@uni.ac.th",
            )

        assert repo_with_existing_classroom.save_call_count == 0
        assert repo_with_existing_classroom.count == before

    def test_C7_allowed_email_domains_ถูกเก็บเป็นตัวพิมพ์เล็ก(
        self, service: ClassroomService
    ):
        """ตอนเทียบกับอีเมลที่ normalize แล้วจะเทียบแบบ case-sensitive
        ถ้าไม่ lower ตรงนี้ domain จะไม่มีวันตรงกัน แล้วทุกคนจะ login ไม่ได้
        """
        classroom, _ = service.create_classroom(
            name="Software Engineering",
            timezone="Asia/Bangkok",
            created_by="ajarn@uni.ac.th",
            allowed_email_domains=["UNI.AC.TH", " Student.Uni.Ac.Th "],
        )

        assert classroom.allowed_email_domains == ["uni.ac.th", "student.uni.ac.th"]

    def test_ชื่อถูกตัดช่องว่างหัวท้ายก่อนบันทึก(self, service: ClassroomService):
        classroom, _ = service.create_classroom(
            name="  Software Engineering  ",
            timezone="Asia/Bangkok",
            created_by="ajarn@uni.ac.th",
        )

        assert classroom.name == "Software Engineering"


class TestSlugify:
    @pytest.mark.parametrize(
        ("name", "expected"),
        [
            ("Software Engineering 2026", "software-engineering-2026"),
            ("  Data   Structures  ", "data-structures"),
            ("CS301: HCI (Sec 1)", "cs301-hci-sec-1"),
            ("วิศวกรรมซอฟต์แวร์", "วิศวกรรมซอฟต์แวร์"),
        ],
    )
    def test_แปลงชื่อเป็น_slug(self, name: str, expected: str):
        assert slugify(name) == expected

    def test_ชื่อที่มีแต่อักขระพิเศษได้_slug_ว่าง(self):
        assert slugify("!!! ###") == ""
