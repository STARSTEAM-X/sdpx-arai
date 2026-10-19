"""ประเภทบัญชีจากรูปแบบอีเมล — ตัวเลขล้วนหน้า @ คือนักศึกษา แบบอื่นคืออาจารย์"""
import pytest

from app.domain.account import AccountType, account_type, can_create_classroom


@pytest.mark.parametrize("email", ["67015090@kmitl.ac.th", "67015063@kmitl.ac.th", " 1@gmail.com "])
def test_digits_only_local_part_is_student(email):
    assert account_type(email) is AccountType.STUDENT
    assert not can_create_classroom(email)


@pytest.mark.parametrize("email", ["Arjan.0001@kmitl.ac.th", "somchai@kmitl.ac.th", "67015090a@kmitl.ac.th",
                                   "6701.5090@kmitl.ac.th", "someone@gmail.com", "@kmitl.ac.th"])
def test_anything_else_is_instructor(email):
    assert account_type(email) is AccountType.INSTRUCTOR
    assert can_create_classroom(email)
