"""รายการคู่ที่นักศึกษาต้องประเมิน — US-07

กฎธุรกิจเดียวที่ไฟล์นี้ตัดสินคือ "เปิดให้ดูหรือยัง" — รายชื่อคู่และใครทำไปแล้ว
เป็นข้อมูลดิบที่ repo join มาให้แล้ว (label ของ item, สถานะ comparison)
เพราะนั่นเป็นการต่อข้อมูล ไม่ใช่การตัดสินใจ จึงไม่ต้องมี fake repo มาทดสอบไฟล์นี้เลย
"""

from dataclasses import dataclass

from app.domain.assignment_service import AssignmentStatus
from app.domain.pairing import Side

NOT_OPENED_MESSAGE = "อาจารย์ยังไม่เปิดงานนี้ให้ประเมิน — ระบบจะแจ้งเตือนเมื่อเปิดแล้ว"
NO_INDIVIDUAL_MESSAGE = "งานนี้ไม่มีการประเมินรายบุคคล"


@dataclass(frozen=True)
class EvaluationItem:
    """คู่หนึ่งที่ต้องประเมิน — ซ้าย/ขวาตามตำแหน่งที่สุ่มไว้ตอน publish (FR-PAIR-08)

    มี criterion ติดมาด้วยเสมอ เพราะฝั่งเดียวกันมีได้หลายเกณฑ์ (เช่น UX, Completeness,
    Innovation) แต่ละเกณฑ์สร้างชุดคู่ของตัวเองตอน publish — ถ้าไม่ติด criterion ไว้
    หน้าจอจะเอาคู่ของคนละเกณฑ์มาปนกันโดยไม่รู้ตัว (FR-EVAL-01 บังคับให้แยก section ต่อเกณฑ์)
    """

    pair_assignment_id: str
    criterion_id: str
    criterion_name: str
    left_id: str
    left_label: str
    right_id: str
    right_label: str
    completed: bool
    # ค่าที่เคยเลือกไว้ (DRAFT หรือ SUBMITTED) — None ถ้ายังไม่เคยตอบเลย
    # ต้องส่งกลับเพื่อให้เปิดเครื่องใหม่หรือปิด browser กลางคันแล้วยังเห็นคำตอบเดิม (FR-EVAL-04)
    choice: int | None


@dataclass(frozen=True)
class MyEvaluations:
    side: Side
    opened: bool
    message: str | None
    completed_count: int
    total_count: int
    items: list[EvaluationItem]


def build_my_evaluations(
    *,
    side: Side,
    status: AssignmentStatus,
    side_enabled: bool,
    pairs: list[EvaluationItem],
) -> MyEvaluations:
    """DRAFT บังทุกอย่างก่อนเสมอ — ถึงฝั่งบุคคลจะปิดอยู่ด้วย ข้อความที่เห็นต้องเป็น
    "ยังไม่เปิด" ไม่ใช่ "ไม่มีฝั่งบุคคล" เพราะนักศึกษายังไม่ควรรู้ด้วยซ้ำว่างานนี้ตั้งค่าไว้แบบไหน
    """
    if status is AssignmentStatus.DRAFT:
        return MyEvaluations(
            side=side, opened=False, message=NOT_OPENED_MESSAGE,
            completed_count=0, total_count=0, items=[],
        )

    if not side_enabled:
        # FR-ASSIGN-07 — individual_max_score = 0 แปลว่าไม่มี pair ฝั่งนี้เลยตั้งแต่ publish
        # ต้องอธิบายว่าทำไมว่างเปล่า ไม่ใช่ปล่อยให้ดูเหมือนหน้าจอพัง
        return MyEvaluations(
            side=side, opened=True, message=NO_INDIVIDUAL_MESSAGE,
            completed_count=0, total_count=0, items=[],
        )

    completed = sum(1 for p in pairs if p.completed)
    return MyEvaluations(
        side=side, opened=True, message=None,
        completed_count=completed, total_count=len(pairs), items=pairs,
    )
