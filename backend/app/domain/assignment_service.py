"""วงจรชีวิตของงานประเมิน — US-04, US-06

แยกจาก Pairing Engine โดยตั้งใจ: ที่นี่ตัดสินว่า *ตอนไหน* publish ได้
ส่วนการจัดคู่ว่า *ใครประเมินอะไร* เป็นของ `pairing.py` ซึ่งไม่รู้จักสถานะของ assignment เลย
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from app.domain.errors import ConflictError, ValidationError
from app.domain.pairing import Side

MAX_NAME_LENGTH = 200
FULL_WEIGHT = Decimal(100)
# PRD FR-ASSIGN-02: ผลรวมน้ำหนัก = 100% (± 0.01) — เผื่อเศษปัดเมื่อแบ่งน้ำหนักไม่ลงตัว
# เช่น 3 เกณฑ์เท่ากัน 33.33 + 33.33 + 33.34 หรือ 33.34 + 33.33 + 33.33 ต้องผ่านได้
WEIGHT_TOLERANCE = Decimal("0.01")


class AssignmentStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    FINALIZED = "FINALIZED"
    ARCHIVED = "ARCHIVED"


# สถานะที่ยังแก้เนื้อหาได้ — นอกจากนี้ต้องถอย publish ก่อน
EDITABLE_STATUSES = frozenset({AssignmentStatus.DRAFT})


@dataclass
class Criterion:
    id: str
    side: Side
    name: str
    weight_pct: Decimal
    display_order: int = 0


@dataclass
class Assignment:
    id: str
    classroom_id: str
    name: str
    group_max_score: Decimal
    individual_max_score: Decimal
    group_deadline_utc: datetime
    created_by: str
    individual_deadline_utc: datetime | None = None
    description: str | None = None
    artifact_url: str | None = None
    target_coverage: int = 5
    max_workload: int = 8
    pairing_seed: int | None = None
    status: AssignmentStatus = AssignmentStatus.DRAFT
    criteria: list[Criterion] = field(default_factory=list)
    # ค่า config ของ scoring engine (US-16) — ยังไม่มี UI ให้ตั้งเอง ใช้ default ตาม PRD
    # เสมอ (OQ-1: floor 0.60 "ใช้ได้ทันที" ถ้ายังไม่มีใครตอบว่าต้องการค่าอื่น)
    instructor_weight: Decimal = Decimal("1.0")
    min_comparisons: int = 3
    score_floor: Decimal = Decimal("0.600")
    score_ceiling: Decimal = Decimal("1.000")
    completion_threshold: Decimal = Decimal("0.900")
    finalized_at: datetime | None = None

    @property
    def has_individual_side(self) -> bool:
        """`individual_max_score = 0` แปลว่าไม่มีการประเมินรายบุคคลเลย (FR-ASSIGN-07)"""
        return self.individual_max_score > 0

    def criteria_for(self, side: Side) -> list[Criterion]:
        return [c for c in self.criteria if c.side is side]


def validate_new_assignment(
    *,
    name: str,
    group_deadline_utc: datetime | None,
    criteria: list[Criterion],
) -> None:
    """ตรวจเฉพาะสิ่งที่ผิดแน่ ๆ ไม่ว่าจะยังร่างอยู่หรือไม่

    **ไม่** ตรวจผลรวมน้ำหนักตรงนี้ — DRAFT คืองานที่ยังทำไม่เสร็จ
    ถ้าบังคับให้ครบ 100% ตั้งแต่แรก อาจารย์จะเซฟงานค้างไว้ไม่ได้เลย
    ผลรวมถูกบังคับตอน publish แทน (ดู `assert_publishable`)
    """
    if not name or not name.strip():
        raise ValidationError("ชื่องานประเมินห้ามว่าง", field="name")

    if len(name.strip()) > MAX_NAME_LENGTH:
        raise ValidationError(
            f"ชื่องานประเมินยาวเกิน {MAX_NAME_LENGTH} ตัวอักษร", field="name"
        )

    if group_deadline_utc is None:
        raise ValidationError("ต้องระบุกำหนดส่งของการประเมินระดับกลุ่ม", field="groupDeadlineUtc")

    if not criteria:
        raise ValidationError("ต้องมีเกณฑ์อย่างน้อย 1 ข้อ", field="criteria")

    for c in criteria:
        if not c.name or not c.name.strip():
            raise ValidationError("ชื่อเกณฑ์ห้ามว่าง", field="criteria")
        if not (0 <= c.weight_pct <= FULL_WEIGHT):
            raise ValidationError(
                f"น้ำหนักของเกณฑ์ '{c.name}' ต้องอยู่ระหว่าง 0 ถึง 100", field="criteria"
            )


def assert_editable(assignment: Assignment) -> None:
    """งานที่ publish ไปแล้วแก้เนื้อหาไม่ได้ — ต้องถอยกลับเป็น DRAFT ก่อน

    เหตุผลไม่ใช่เรื่องเทคนิค: นักศึกษาอาจเริ่มประเมินไปแล้วตามเกณฑ์ชุดเดิม
    การเปลี่ยนน้ำหนักกลางคันทำให้คะแนนที่คำนวณจากคำตอบเก่ากับใหม่เทียบกันไม่ได้
    """
    if assignment.status not in EDITABLE_STATUSES:
        raise ConflictError(
            f"งานนี้อยู่ในสถานะ {assignment.status} แล้ว — "
            f"ต้องถอยกลับเป็น DRAFT ก่อนจึงจะแก้เกณฑ์ได้",
            field="status",
        )


def assert_publishable(assignment: Assignment) -> None:
    """ตรวจก่อน publish — น้ำหนักของแต่ละฝั่งต้องรวมได้ 100% พอดี

    บอกเป็นตัวเลขว่าขาดหรือเกินอยู่เท่าไร ไม่ใช่แค่ "น้ำหนักไม่ถูกต้อง"
    เพราะคนที่เห็นข้อความต้องแก้ตัวเลขให้ถูก ไม่ใช่มานั่งไล่บวกเอง
    """
    if assignment.status is not AssignmentStatus.DRAFT:
        raise ConflictError(
            f"งานนี้อยู่ในสถานะ {assignment.status} แล้ว — publish ได้เฉพาะงานที่เป็น DRAFT",
            field="status",
        )

    sides = [Side.GROUP]
    if assignment.has_individual_side:
        sides.append(Side.INDIVIDUAL)

    for side in sides:
        items = assignment.criteria_for(side)
        if not items:
            raise ValidationError(
                f"ยังไม่มีเกณฑ์ฝั่ง {side} — ต้องมีอย่างน้อย 1 ข้อจึงจะ publish ได้",
                field="criteria",
            )

        total = sum((c.weight_pct for c in items), Decimal(0))
        gap = FULL_WEIGHT - total
        if abs(gap) > WEIGHT_TOLERANCE:
            direction = "ขาดอีก" if gap > 0 else "เกินมา"
            raise ValidationError(
                f"น้ำหนักเกณฑ์ฝั่ง {side} รวมได้ {total}% — ต้องเป็น 100% พอดี "
                f"({direction} {abs(gap)}%)",
                field="criteria",
            )

    # ฝั่ง INDIVIDUAL ถูกปิด แต่ยังมีเกณฑ์ค้างอยู่ = ตั้งค่าขัดกันเอง ต้องบอกก่อนจะสร้าง pair
    if not assignment.has_individual_side and assignment.criteria_for(Side.INDIVIDUAL):
        raise ValidationError(
            "ตั้ง individualMaxScore = 0 (ปิดการประเมินรายบุคคล) "
            "แต่ยังมีเกณฑ์ฝั่ง INDIVIDUAL ค้างอยู่ — ลบเกณฑ์นั้นหรือกำหนดคะแนนเต็มให้มากกว่า 0",
            field="individualMaxScore",
        )
