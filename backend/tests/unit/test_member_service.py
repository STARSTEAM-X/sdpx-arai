"""unit test ของการจัดการผู้ร่วมสอนและ TA — อ้าง US-12"""

import pytest

from app.domain.errors import ConflictError, LastOwnerError, ValidationError
from app.domain.member_service import assert_removable, validate_new_member
from app.domain.models import MemberRole

KMITL = ["kmitl.ac.th"]


def add(**overrides):
    args = dict(
        email_raw="ajarn2@kmitl.ac.th",
        role=MemberRole.CO_TEACHER,
        allowed_email_domains=[],
        existing_role=None,
    )
    return validate_new_member(**{**args, **overrides})


class TestValidateNewMember:
    @pytest.mark.parametrize("role", [MemberRole.CO_TEACHER, MemberRole.TA])
    def test_AC_เพิ่ม_CO_TEACHER_และ_TA_ได้(self, role: MemberRole):
        assert add(role=role).role is role

    @pytest.mark.parametrize("role", [MemberRole.OWNER, MemberRole.STUDENT])
    def test_เพิ่ม_OWNER_หรือ_STUDENT_ผ่าน_endpoint_นี้ไม่ได้(self, role: MemberRole):
        # OWNER เกิดจากการสร้างห้อง · STUDENT มาจาก roster import
        with pytest.raises(ValidationError) as exc:
            add(role=role)
        assert exc.value.field == "role"

    def test_อีเมลถูก_normalize_ก่อนบันทึก(self):
        # ต้องใช้กฎเดียวกับ roster และ login ไม่งั้นคนเดียวกันจะกลายเป็นสองบัญชี
        assert add(email_raw="Ajarn.Two+x@kmitl.ac.th").email_normalized == "ajarn.two@kmitl.ac.th"

    def test_เก็บอีเมลดิบไว้ด้วย(self):
        assert add(email_raw="Ajarn.Two@kmitl.ac.th").email_raw == "Ajarn.Two@kmitl.ac.th"

    @pytest.mark.parametrize("bad", ["", "   "])
    def test_อีเมลว่างถูกปฏิเสธ(self, bad: str):
        with pytest.raises(ValidationError) as exc:
            add(email_raw=bad)
        assert exc.value.field == "email"

    def test_AC_อีเมลนอก_domain_ที่อนุญาตถูกปฏิเสธพร้อมบอก_domain_ที่รับ(self):
        with pytest.raises(ValidationError) as exc:
            add(email_raw="someone@gmail.com", allowed_email_domains=KMITL)

        assert exc.value.field == "email"
        assert "gmail.com" in exc.value.message
        assert "kmitl.ac.th" in exc.value.message

    def test_ห้องที่ไม่จำกัด_domain_รับได้ทุกอีเมล(self):
        assert add(email_raw="someone@gmail.com", allowed_email_domains=[]).role

    def test_AC_คนที่เป็น_STUDENT_อยู่แล้วเพิ่มเป็น_TA_ไม่ได้(self):
        # FR-AUTHZ-03 — 1 คนมีได้ 1 role ต่อ 1 ห้องเรียน
        with pytest.raises(ConflictError) as exc:
            add(role=MemberRole.TA, existing_role=MemberRole.STUDENT)

        assert "STUDENT" in exc.value.message

    def test_คนที่เป็นผู้สอนอยู่แล้วเพิ่มซ้ำไม่ได้(self):
        with pytest.raises(ConflictError):
            add(existing_role=MemberRole.CO_TEACHER)


class TestAssertRemovable:
    def test_AC_ถอด_OWNER_คนสุดท้ายไม่ได้(self):
        with pytest.raises(LastOwnerError) as exc:
            assert_removable(role_to_remove=MemberRole.OWNER, owner_count=1)

        # AC ระบุ code ข้อนี้ไว้เจาะจง หน้าจอต้องแยกจาก conflict อื่นได้
        assert exc.value.code == "LAST_OWNER"

    def test_ถอด_OWNER_ได้ถ้ายังเหลืออีกคน(self):
        assert_removable(role_to_remove=MemberRole.OWNER, owner_count=2)

    @pytest.mark.parametrize(
        "role", [MemberRole.CO_TEACHER, MemberRole.TA, MemberRole.STUDENT]
    )
    def test_ถอด_role_อื่นได้เสมอแม้มี_OWNER_คนเดียว(self, role: MemberRole):
        assert_removable(role_to_remove=role, owner_count=1)
