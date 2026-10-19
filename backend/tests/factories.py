"""factory สำหรับสร้างข้อมูลทดสอบ

ทุกตัวมีค่า default ที่ "ถูกต้องและใช้งานได้" อยู่แล้ว
test แต่ละตัวจึงระบุเฉพาะ field ที่เกี่ยวกับกฎที่ตัวเองทดสอบ
คนอ่าน test จะได้รู้ทันทีว่าอะไรคือตัวแปรสำคัญของเคสนั้น
"""

import uuid

from app.domain.models import Classroom, ClassroomStatus


def make_classroom(**overrides) -> Classroom:
    defaults = {
        "id": str(uuid.uuid4()),
        "name": "Software Engineering 2026",
        "slug": "software-engineering-2026",
        "timezone": "Asia/Bangkok",
        "created_by": "ajarn@uni.ac.th",
        "allowed_email_domains": ["uni.ac.th"],
        "status": ClassroomStatus.ACTIVE,
    }
    return Classroom(**{**defaults, **overrides})


def make_csv(rows: list[str], header: str = "email,group_name") -> bytes:
    """ประกอบ CSV จาก list ของบรรทัด แล้วเข้ารหัสเป็น UTF-8

    แยกออกมาเป็น factory เพราะแทบทุก test ของ roster ต้องใช้
    และการเขียน CSV เป็น string ดิบใน test ทำให้ขึ้นบรรทัดใหม่ผิดง่าย
    """
    return ("\n".join([header, *rows]) + "\n").encode("utf-8")
