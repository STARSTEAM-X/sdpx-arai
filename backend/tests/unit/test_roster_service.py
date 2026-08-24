"""unit test ของ RosterService — อ้าง US-03

`parse_roster_csv()` มี test ของตัวเองอยู่แล้วใน test_roster_import.py
ชุดนี้จึงไม่ทดสอบการ parse ซ้ำ แต่ทดสอบสิ่งที่ service เพิ่มเข้ามา:
**ใครทำได้** และ **ตอนไฟล์ผิดแล้วมีอะไรหลุดลง repository ไหม**
"""

import pytest

from app.domain.errors import ForbiddenError, NotFoundError, RosterImportError
from app.domain.models import MemberRole
from app.domain.roster_service import RosterService
from tests.factories import make_csv
from tests.fakes.fake_classroom_repo import FakeClassroomRepo

ROOM = "11111111-1111-1111-1111-111111111111"
OTHER_ROOM = "22222222-2222-2222-2222-222222222222"
AJARN = "ajarn@uni.ac.th"
STUDENT = "student@uni.ac.th"
OUTSIDER = "outsider@uni.ac.th"

GOOD_CSV = make_csv(
    [
        "somchai@uni.ac.th,group-1",
        "somsri@uni.ac.th,group-1",
        "manee@uni.ac.th,group-2",
        "mana@uni.ac.th,group-2",
    ]
)


@pytest.fixture
def repo() -> FakeClassroomRepo:
    return FakeClassroomRepo(
        members={
            (ROOM, AJARN): MemberRole.OWNER,
            (ROOM, STUDENT): MemberRole.STUDENT,
            (OTHER_ROOM, OUTSIDER): MemberRole.OWNER,
        }
    )


@pytest.fixture
def service(repo: FakeClassroomRepo) -> RosterService:
    return RosterService(classroom_repo=repo)


class TestImportCsv:
    def test_AC_ไฟล์ถูกต้องทั้งไฟล์บันทึกครบทุกแถว(
        self, service: RosterService, repo: FakeClassroomRepo
    ):
        result = service.import_csv(classroom_id=ROOM, actor_email=AJARN, raw=GOOD_CSV)

        assert len(result.rows) == 4
        assert result.groups == ["group-1", "group-2"]
        assert len(repo.roster_of(ROOM)) == 4

    def test_ทุกแถวกลายเป็นสมาชิก_role_STUDENT(
        self, service: RosterService, repo: FakeClassroomRepo
    ):
        service.import_csv(classroom_id=ROOM, actor_email=AJARN, raw=GOOD_CSV)

        assert repo.get_member_role(ROOM, "somchai@uni.ac.th") is MemberRole.STUDENT

    def test_R1_ไฟล์มีแถวผิดแล้วต้องไม่บันทึกอะไรเลย(
        self, service: RosterService, repo: FakeClassroomRepo
    ):
        bad = make_csv(["somchai@uni.ac.th,group-1", "ไม่ใช่อีเมล,group-1"])

        with pytest.raises(RosterImportError) as exc:
            service.import_csv(classroom_id=ROOM, actor_email=AJARN, raw=bad)

        assert [e.row for e in exc.value.rows] == [3]
        # กฎ atomic จะไร้ความหมายถ้าแถวที่ถูกต้องหลุดลงไปก่อน
        assert repo.roster_of(ROOM) == []
        assert repo.replace_roster_call_count == 0

    def test_import_ซ้ำด้วยไฟล์เดิมได้ผลเท่าเดิม_ไม่สะสมสมาชิกซ้ำ(
        self, service: RosterService, repo: FakeClassroomRepo
    ):
        service.import_csv(classroom_id=ROOM, actor_email=AJARN, raw=GOOD_CSV)
        service.import_csv(classroom_id=ROOM, actor_email=AJARN, raw=GOOD_CSV)

        assert len(repo.roster_of(ROOM)) == 4

    def test_domain_ระดับระบบปฏิเสธทั้งไฟล์และบอกแถวที่ผิด(
        self, repo: FakeClassroomRepo
    ):
        service = RosterService(
            classroom_repo=repo, allowed_email_domains=["kmitl.ac.th"]
        )
        raw = make_csv(
            ["student@kmitl.ac.th,group-1", "outsider@gmail.com,group-1"]
        )

        with pytest.raises(RosterImportError) as exc:
            service.import_csv(classroom_id=ROOM, actor_email=AJARN, raw=raw)

        assert [error.row for error in exc.value.rows] == [3]
        assert "kmitl.ac.th" in exc.value.rows[0].reason
        assert repo.replace_roster_call_count == 0

    def test_import_ทับของเดิมแต่ไม่ลบอาจารย์ในห้อง(
        self, service: RosterService, repo: FakeClassroomRepo
    ):
        service.import_csv(classroom_id=ROOM, actor_email=AJARN, raw=GOOD_CSV)

        assert repo.get_member_role(ROOM, AJARN) is MemberRole.OWNER

    def test_US11_นักศึกษา_import_ไม่ได้(self, service: RosterService):
        with pytest.raises(ForbiddenError):
            service.import_csv(classroom_id=ROOM, actor_email=STUDENT, raw=GOOD_CSV)

    def test_US11_คนนอกได้_404_ไม่ใช่_403(self, service: RosterService):
        with pytest.raises(NotFoundError):
            service.import_csv(classroom_id=ROOM, actor_email=OUTSIDER, raw=GOOD_CSV)

    def test_ตรวจสิทธิ์ก่อน_parse_ไฟล์ผิดของคนไม่มีสิทธิ์ยังตอบเรื่องสิทธิ์(
        self, service: RosterService
    ):
        # ถ้า parse ก่อน คนนอกจะได้ 422 ซึ่งบอกเป็นนัยว่าเขาผ่านด่านสิทธิ์มาแล้ว
        with pytest.raises(NotFoundError):
            service.import_csv(
                classroom_id=ROOM, actor_email=OUTSIDER, raw=make_csv(["ขยะ,,,"])
            )


class TestListRoster:
    def test_นักศึกษาในห้องดูรายชื่อได้(
        self, service: RosterService, repo: FakeClassroomRepo
    ):
        service.import_csv(classroom_id=ROOM, actor_email=AJARN, raw=GOOD_CSV)

        # ใช้คนที่อยู่ในไฟล์ที่เพิ่ง import — คนที่ไม่อยู่ในไฟล์จะถูกถอดออกจากห้อง
        # ตามกฎ replace ดูที่ test_การ_import_ถอดนักศึกษาที่ไม่อยู่ในไฟล์ใหม่ออก
        viewer = "somchai@uni.ac.th"
        emails = {m.email for m in service.list_roster(classroom_id=ROOM, actor_email=viewer)}

        assert viewer in emails
        assert AJARN in emails

    def test_การ_import_ถอดนักศึกษาที่ไม่อยู่ในไฟล์ใหม่ออก(
        self, service: RosterService, repo: FakeClassroomRepo
    ):
        # ผลพวงที่ตั้งใจของกฎ replace: ไฟล์ใหม่คือความจริงชุดใหม่ทั้งชุด
        # ถ้าไม่ถอดออก การลบนักศึกษาที่ถอนรายวิชาจะทำไม่ได้เลยผ่านการ import
        assert repo.get_member_role(ROOM, STUDENT) is MemberRole.STUDENT

        service.import_csv(classroom_id=ROOM, actor_email=AJARN, raw=GOOD_CSV)

        assert repo.get_member_role(ROOM, STUDENT) is None

    def test_US11_คนนอกดูรายชื่อไม่ได้_และได้_404(self, service: RosterService):
        with pytest.raises(NotFoundError):
            service.list_roster(classroom_id=ROOM, actor_email=OUTSIDER)

    def test_group_name_ติดมากับนักศึกษาแต่ละคน(
        self, service: RosterService, repo: FakeClassroomRepo
    ):
        service.import_csv(classroom_id=ROOM, actor_email=AJARN, raw=GOOD_CSV)

        roster = service.list_roster(classroom_id=ROOM, actor_email=AJARN)
        by_email = {m.email: m for m in roster}

        assert by_email["somchai@uni.ac.th"].group_name == "group-1"
        assert by_email["manee@uni.ac.th"].group_name == "group-2"
