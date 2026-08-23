"""integration test ของ PgClassroomRepository — อ้าง US-03 และ US-11

จุดประสงค์เดียว: ยืนยันว่า SQL ทำสิ่งเดียวกับที่ FakeClassroomRepo แกล้งทำ
ถ้าสองตัวนี้หลุดจากกัน unit test ทั้ง 100 ตัวจะยังเขียวขณะที่ของจริงพัง
"""

import uuid
from datetime import UTC, datetime

import pytest
from psycopg import Connection

from app.domain.models import Classroom, ClassroomMember, MemberRole, RosterRow
from app.repositories.pg_classroom_repo import PgClassroomRepository

pytestmark = pytest.mark.integration


def _make_user(db: Connection, email: str) -> str:
    user_id = str(uuid.uuid4())
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO app_user (id, email_normalized, email_raw, status)
            VALUES (%s, %s, %s, 'ACTIVE')
            """,
            (user_id, email, email),
        )
    return user_id


@pytest.fixture
def room(db: Connection) -> tuple[PgClassroomRepository, str, str]:
    """ห้องเรียนหนึ่งห้องที่มีอาจารย์เป็น OWNER แล้ว — คืน (repo, classroom_id, ajarn_email)"""
    suffix = uuid.uuid4().hex[:8]
    ajarn = f"ajarn-{suffix}@uni.ac.th"
    _make_user(db, ajarn)

    repo = PgClassroomRepository(db)
    classroom = Classroom(
        id=str(uuid.uuid4()),
        name=f"ห้องทดสอบ {suffix}",
        slug=f"room-{suffix}",
        timezone="Asia/Bangkok",
        created_by=ajarn,
        # ต้องใส่เองเหมือนที่ ClassroomService ทำ — คอลัมน์นี้ NOT NULL
        created_at=datetime.now(UTC),
    )
    repo.save(classroom)
    repo.save_member(
        ClassroomMember(classroom_id=classroom.id, user_email=ajarn, role=MemberRole.OWNER)
    )
    return repo, classroom.id, ajarn


def rows(*pairs: tuple[str, str]) -> list[RosterRow]:
    return [
        RosterRow(
            row_number=i + 2,
            email_normalized=email,
            email_raw=email,
            group_name=group,
        )
        for i, (email, group) in enumerate(pairs)
    ]


class TestGetMemberRole:
    def test_สมาชิกได้_role_ของตัวเอง(self, room):
        repo, room_id, ajarn = room
        assert repo.get_member_role(room_id, ajarn) is MemberRole.OWNER

    def test_คนที่ไม่ใช่สมาชิกได้_None(self, room):
        repo, room_id, _ = room
        assert repo.get_member_role(room_id, "outsider@uni.ac.th") is None

    def test_classroom_id_ที่ไม่มีอยู่ได้_None(self, room):
        repo, _, ajarn = room
        assert repo.get_member_role(str(uuid.uuid4()), ajarn) is None

    def test_US11_id_ที่ไม่ใช่รูปแบบ_uuid_ได้_None_ไม่ใช่_500(self, room):
        """ถ้าปล่อยให้ Postgres โยน error จะกลายเป็น 500 ทั้งที่ความหมายคือ "ไม่พบ"

        และ 500 กับ 404 ที่ต่างกันก็บอกคนนอกได้ว่า id แบบไหนที่ระบบรู้จักรูปแบบ
        """
        repo, _, ajarn = room
        assert repo.get_member_role("ไม่ใช่-uuid", ajarn) is None


class TestReplaceRoster:
    def test_สร้าง_user_ใหม่เป็น_PENDING(self, room, db: Connection):
        repo, room_id, _ = room
        email = f"stu-{uuid.uuid4().hex[:8]}@uni.ac.th"

        repo.replace_roster(room_id, rows((email, "g1")))

        with db.cursor() as cur:
            cur.execute("SELECT status FROM app_user WHERE email_normalized = %s", (email,))
            assert cur.fetchone()["status"] == "PENDING"

    def test_ไม่ถีบคนที่_login_แล้วกลับไป_PENDING(self, room, db: Connection):
        repo, room_id, _ = room
        email = f"active-{uuid.uuid4().hex[:8]}@uni.ac.th"
        _make_user(db, email)  # สร้างเป็น ACTIVE

        repo.replace_roster(room_id, rows((email, "g1")))

        with db.cursor() as cur:
            cur.execute("SELECT status FROM app_user WHERE email_normalized = %s", (email,))
            assert cur.fetchone()["status"] == "ACTIVE"

    def test_ทุกแถวกลายเป็นสมาชิก_STUDENT_พร้อม_group_name(self, room):
        repo, room_id, _ = room
        a = f"a-{uuid.uuid4().hex[:8]}@uni.ac.th"

        repo.replace_roster(room_id, rows((a, "กลุ่ม-1")))

        assert repo.get_member_role(room_id, a) is MemberRole.STUDENT
        entry = next(m for m in repo.list_roster(room_id) if m.email == a)
        assert entry.group_name == "กลุ่ม-1"

    def test_import_ซ้ำไม่สะสมสมาชิก(self, room):
        repo, room_id, _ = room
        a = f"a-{uuid.uuid4().hex[:8]}@uni.ac.th"

        repo.replace_roster(room_id, rows((a, "g1")))
        repo.replace_roster(room_id, rows((a, "g1")))

        students = [m for m in repo.list_roster(room_id) if m.role is MemberRole.STUDENT]
        assert len(students) == 1

    def test_ไฟล์ใหม่ถอดคนที่หายไปออก_แต่ไม่แตะอาจารย์(self, room):
        repo, room_id, ajarn = room
        a = f"a-{uuid.uuid4().hex[:8]}@uni.ac.th"
        b = f"b-{uuid.uuid4().hex[:8]}@uni.ac.th"

        repo.replace_roster(room_id, rows((a, "g1"), (b, "g1")))
        repo.replace_roster(room_id, rows((a, "g1")))

        assert repo.get_member_role(room_id, a) is MemberRole.STUDENT
        assert repo.get_member_role(room_id, b) is None
        assert repo.get_member_role(room_id, ajarn) is MemberRole.OWNER

    def test_ย้ายกลุ่มได้ด้วยการ_import_ใหม่(self, room):
        repo, room_id, _ = room
        a = f"a-{uuid.uuid4().hex[:8]}@uni.ac.th"

        repo.replace_roster(room_id, rows((a, "g1")))
        repo.replace_roster(room_id, rows((a, "g2")))

        entry = next(m for m in repo.list_roster(room_id) if m.email == a)
        assert entry.group_name == "g2"


class TestListRoster:
    def test_อาจารย์ขึ้นก่อนนักศึกษาเสมอ(self, room):
        repo, room_id, ajarn = room
        repo.replace_roster(room_id, rows((f"z-{uuid.uuid4().hex[:8]}@uni.ac.th", "g1")))

        assert repo.list_roster(room_id)[0].email == ajarn

    def test_ลำดับคงที่ทุกครั้งที่เรียก(self, room):
        repo, room_id, _ = room
        repo.replace_roster(
            room_id,
            rows(
                (f"c-{uuid.uuid4().hex[:8]}@uni.ac.th", "g2"),
                (f"a-{uuid.uuid4().hex[:8]}@uni.ac.th", "g1"),
                (f"b-{uuid.uuid4().hex[:8]}@uni.ac.th", "g1"),
            ),
        )

        # ลำดับที่ขึ้นกับ physical order ของ Postgres คือบ่อเกิดของ E2E ที่ flaky
        assert [m.email for m in repo.list_roster(room_id)] == [
            m.email for m in repo.list_roster(room_id)
        ]

    def test_ห้องที่ไม่มีสมาชิกคืนรายการว่าง(self, db: Connection):
        assert PgClassroomRepository(db).list_roster(str(uuid.uuid4())) == []
