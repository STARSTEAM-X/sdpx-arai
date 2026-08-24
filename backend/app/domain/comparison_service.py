"""บันทึกคำตอบของคู่ประเมิน — US-08

กฎ 3 ข้อล้วนเป็นเรื่อง "ทำได้ไหม" — การ upsert จริงเป็นของ repo (ต้อง idempotent ตาม
FR-API-01 ซึ่งบังคับที่ระดับ SQL ด้วย UNIQUE (pair_assignment_id) ไม่ใช่แค่ในโค้ดชั้นนี้)
"""

from datetime import datetime

from app.domain.errors import DeadlinePassedError, NotYourPairError, ValidationError

MIN_CHOICE = 1
MAX_CHOICE = 6


def validate_choice(choice: int) -> None:
    """มาตรวัด 6 ระดับแบบ forced choice — ไม่มีค่ากลาง (D1)"""
    if not (MIN_CHOICE <= choice <= MAX_CHOICE):
        raise ValidationError(
            f"ต้องเลือกระหว่าง {MIN_CHOICE} ถึง {MAX_CHOICE} — ไม่มีตัวเลือก 'เท่ากัน'",
            field="choice",
        )


def assert_is_evaluator(*, pair_evaluator_email: str, caller_email: str) -> None:
    """คู่หนึ่งมีเจ้าของแค่คนเดียว — คนอื่นเห็น pairAssignmentId แล้วเดาบันทึกแทนไม่ได้"""
    if pair_evaluator_email != caller_email:
        raise NotYourPairError("คุณไม่ใช่ผู้ประเมินของคู่นี้", field="pairAssignmentId")


def assert_before_deadline(*, now: datetime, deadline: datetime) -> None:
    """FR-EVAL-08 — หลัง deadline ต้องปิดการเขียน ไม่ใช่แค่ปิดหน้าจอฝั่ง UI

    ใช้ >= ไม่ใช่ > เพราะ deadline คือวินาทีสุดท้ายที่ *ยังส่งได้* ไม่ใช่วินาทีที่เริ่มปิดรับ
    """
    if now >= deadline:
        raise DeadlinePassedError("เลยกำหนดส่งของการประเมินนี้แล้ว", field="deadline")
