"""fixture ที่ใช้ร่วมกันทุก test

หลักที่ยึด: fixture คือ "สถานการณ์ตั้งต้น" ส่วน factory คือ "เครื่องมือสร้างของ"
ถ้าต้องปรับค่าหลายอย่างในเคสเดียว ให้เรียก factory ตรง ๆ ใน test ดีกว่า
เพราะ fixture ที่รับ parameter เยอะจะอ่านยากกว่าการสร้างของเองตรงนั้น
"""

import pytest

from app.domain.classroom_service import ClassroomService
from tests.factories import make_classroom
from tests.fakes.fake_classroom_repo import FakeClassroomRepo


@pytest.fixture
def empty_repo() -> FakeClassroomRepo:
    """repository ว่าง — สถานการณ์ของอาจารย์ที่สร้างห้องเรียนแรก"""
    return FakeClassroomRepo()


@pytest.fixture
def repo_with_existing_classroom() -> FakeClassroomRepo:
    """repository ที่มีห้องเรียนชื่อ 'Software Engineering 2026' อยู่แล้ว

    ใช้ทดสอบกฎ slug ซ้ำ
    """
    return FakeClassroomRepo([make_classroom()])


@pytest.fixture
def service(empty_repo: FakeClassroomRepo) -> ClassroomService:
    return ClassroomService(classroom_repo=empty_repo)
