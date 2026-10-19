"""ประเภทบัญชีจากรูปแบบอีเมล — กติกาที่ทีมกำหนด 2026-10-20

- ส่วนหน้า @ เป็นตัวเลขล้วน → นักศึกษา (รหัสนักศึกษา เช่น 67015090@kmitl.ac.th)
- แบบอื่นทั้งหมด → อาจารย์ (เช่น Arjan.0001@kmitl.ac.th)

ใช้กับทุก domain · เป็นสิทธิ์ระดับบัญชีอย่างเดียว คือ "สร้างห้องเรียนได้ไหม"
บทบาทในแต่ละห้อง (OWNER / CO_TEACHER / TA / STUDENT) ยังมาจาก membership ตามเดิม
"""

import re
from enum import StrEnum


class AccountType(StrEnum):
    STUDENT = "STUDENT"
    INSTRUCTOR = "INSTRUCTOR"


_STUDENT_LOCAL = re.compile(r"\d+")


def account_type(email: str) -> AccountType:
    local = email.strip().rpartition("@")[0]
    return AccountType.STUDENT if _STUDENT_LOCAL.fullmatch(local) else AccountType.INSTRUCTOR


def can_create_classroom(email: str) -> bool:
    return account_type(email) is AccountType.INSTRUCTOR
