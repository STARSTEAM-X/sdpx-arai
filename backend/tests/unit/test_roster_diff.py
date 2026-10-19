"""unit test ของ diff รายชื่อก่อนยืนยันนำเข้า — FR-CLASS-05 (GAP-12)"""

from app.domain.models import MemberRole, RosterMember, RosterRow
from app.domain.roster_diff import diff_roster


def member(email: str, group: str | None, role: MemberRole = MemberRole.STUDENT) -> RosterMember:
    return RosterMember(user_id=email, email=email, role=role, status="ACTIVE", group_name=group)


def row(email: str, group: str) -> RosterRow:
    return RosterRow(row_number=1, email_normalized=email, email_raw=email, group_name=group)


def test_GAP12_แยก_4_กลุ่ม_เพิ่มใหม่_เปลี่ยนกลุ่ม_ไม่เปลี่ยน_หายจากไฟล์():
    current = [member("a@x", "G1"), member("b@x", "G1"), member("c@x", "G2")]
    incoming = [row("a@x", "G1"), row("b@x", "G2"), row("d@x", "G2")]

    diff = diff_roster(current, incoming)

    assert diff.added == ["d@x"]
    assert diff.moved == [("b@x", "G1", "G2")]
    assert diff.unchanged == ["a@x"]
    assert diff.removed == ["c@x"]


def test_ผู้สอนไม่ถูกนับว่าหายจากไฟล์_เพราะไม่ได้มาจาก_CSV():
    current = [member("ajarn@x", None, MemberRole.OWNER), member("a@x", "G1")]

    diff = diff_roster(current, [row("a@x", "G1")])

    assert diff.removed == []


def test_ห้องว่าง_ทุกคนเป็นรายการเพิ่มใหม่():
    diff = diff_roster([], [row("b@x", "G1"), row("a@x", "G1")])

    assert diff.added == ["a@x", "b@x"]
    assert not diff.moved and not diff.unchanged and not diff.removed
