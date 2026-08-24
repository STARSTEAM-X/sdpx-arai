"""ตัดสินและประกาศคะแนน — US-13

กฎที่นี่ล้วนเป็นเรื่อง "ทำตอนนี้ได้ไหม" — การคำนวณจริงเป็นของ scoring_service
การบันทึกลง database เป็นของ repo ชั้นนี้ทดสอบได้โดยไม่ต้องมี DB หรือ HTTP
"""

from datetime import datetime

from app.domain.errors import ConflictError, ValidationError


def assert_finalizable(*, now: datetime, deadline: datetime, status: str) -> None:
    """finalize ได้เมื่อ publish แล้วและเลย deadline — ไม่ใช่แค่สถานะ CLOSED เฉย ๆ

    ระบบยังไม่มี job ที่เปลี่ยน PUBLISHED → OPEN → CLOSED อัตโนมัติ (ยังไม่ถึง M4)
    เงื่อนไขจริงที่ตรวจได้คือเวลาปัจจุบันเทียบ deadline ตรง ๆ ตาม AC ของ US-13 เอง
    ("Given assignment สถานะ PUBLISHED ที่ deadline ผ่านแล้ว")
    """
    if status not in ("PUBLISHED", "OPEN", "CLOSED"):
        raise ConflictError(
            f"งานนี้อยู่ในสถานะ {status} — finalize ได้เฉพาะงานที่เผยแพร่แล้วเท่านั้น",
            field="status",
        )
    if now < deadline:
        raise ConflictError("ยังไม่ถึงกำหนดส่ง — finalize ได้หลัง deadline ผ่านไปแล้ว", field="deadline")


def assert_before_finalize(*, has_low_confidence_items: bool, confirmed: bool) -> None:
    """AC: มี item ติด LOW_CONFIDENCE ต้องให้อาจารย์ยืนยันก่อน ไม่ finalize ให้อัตโนมัติ"""
    if has_low_confidence_items and not confirmed:
        raise ValidationError(
            "มีรายการที่ข้อมูลยังไม่พอ (comparison น้อยกว่าเกณฑ์) — ต้องยืนยันก่อน finalize",
            field="confirmLowConfidence",
        )


def assert_reopenable(*, status: str) -> None:
    if status != "FINALIZED":
        raise ConflictError(f"งานนี้ยังไม่ได้ finalize (สถานะ {status}) — reopen ไม่ได้", field="status")


def assert_can_override(*, reason: str | None) -> None:
    """เหตุผลเป็น field บังคับ ไม่ใช่ช่องให้เปล่าได้ (FR-SCORE-08)"""
    if not reason or not reason.strip():
        raise ValidationError("ต้องระบุเหตุผลก่อนแก้คะแนน", field="reason")
