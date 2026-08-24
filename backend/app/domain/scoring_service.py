"""เครื่องคำนวณคะแนนจากผลเปรียบเทียบ — US-16

กฎ S1–S10 อยู่ใน memory-bank/units/scoring-engine/unit-brief.md ทุกข้อมี unit test คู่กัน
ที่นี่ (S10 = golden test จาก worked example ใน PRD §9.5 ต้องได้ตัวเลขตรงเป๊ะ)

AR-01 บังคับให้เป็น pure function ของข้อมูลใน database — ไฟล์นี้จึงไม่รู้จัก SQL, HTTP
หรือเวลาปัจจุบันเลย รับ record ที่ query มาแล้วเข้ามา คืนตัวเลขออกไปให้ชั้นบนเป็นคนบันทึก
เพื่อให้คำนวณซ้ำแล้วได้ผลเดิมเสมอ (S1) และ audit ได้ว่าตอนนั้นคำนวณจากอะไร (FR-SCORE-09)
"""

from dataclasses import dataclass, field
from decimal import Decimal

from app.domain.pairing import Side

LOW_CONFIDENCE = "LOW_CONFIDENCE"

# PRD §9.1 — s_left/s_right ต่อ choice หนึ่ง ๆ ห้ามแก้โดยไม่เช็คว่า label ใน scale.ts ยังตรงกัน
_POINTS_BY_CHOICE: dict[int, tuple[Decimal, Decimal]] = {
    1: (Decimal("1.0"), Decimal("0.0")),
    2: (Decimal("0.8"), Decimal("0.2")),
    3: (Decimal("0.6"), Decimal("0.4")),
    4: (Decimal("0.4"), Decimal("0.6")),
    5: (Decimal("0.2"), Decimal("0.8")),
    6: (Decimal("0.0"), Decimal("1.0")),
}


@dataclass(frozen=True)
class SubmittedComparison:
    """หนึ่งคำตอบที่เข้าสู่การคำนวณ — เรียกว่า "submitted" เพราะ S2 กรองสถานะอื่นออกไปแล้ว
    ก่อนจะมาถึงฟังก์ชันในไฟล์นี้ (ตัวไฟล์นี้เองไม่ตรวจสถานะซ้ำ เพื่อไม่ให้ต้องรู้จัก status enum)
    """

    item_a_id: str
    item_b_id: str
    display_left_item_id: str
    choice: int
    is_instructor: bool


def _point_for_item(c: SubmittedComparison, item_id: str) -> Decimal:
    s_left, s_right = _POINTS_BY_CHOICE[c.choice]
    return s_left if c.display_left_item_id == item_id else s_right


@dataclass(frozen=True)
class CriterionResult:
    criterion_id: str
    comparison_count: int
    quality_index: Decimal | None
    score_ratio: Decimal | None
    weighted_score: Decimal
    flags: tuple[str, ...] = ()


@dataclass(frozen=True)
class CriterionConfig:
    id: str
    weight_pct: Decimal


def compute_quality_index(
    comparisons: list[SubmittedComparison],
    item_id: str,
    *,
    instructor_weight: Decimal,
) -> Decimal | None:
    """S9: ไม่มี comparison เลยคืน None ไม่ crash — ผู้เรียกตัดสินใจว่าจะแสดงว่า "คำนวณไม่ได้"

    ใช้เฉพาะ comparison ที่ item_id นี้ปรากฏอยู่ (เป็น item_a หรือ item_b) — S2 กรอง SUBMITTED
    มาก่อนแล้วจากชั้นเรียก จึงไม่ต้องเช็คสถานะซ้ำที่นี่
    """
    relevant = [c for c in comparisons if item_id in (c.item_a_id, c.item_b_id)]
    if not relevant:
        return None

    total_weighted = Decimal(0)
    total_weight = Decimal(0)
    for c in relevant:
        w = instructor_weight if c.is_instructor else Decimal(1)
        total_weighted += w * _point_for_item(c, item_id)
        total_weight += w

    return total_weighted / total_weight  # S6: Decimal ตลอดสาย ไม่มี float แทรก


def compute_score_ratio(q: Decimal, *, floor: Decimal, ceiling: Decimal) -> Decimal:
    """S3: band mapping — floor → ceiling ไม่ normalize ให้ผลรวม = 1 (D2)"""
    return floor + (ceiling - floor) * q


def compute_criterion_result(
    comparisons: list[SubmittedComparison],
    item_id: str,
    criterion: CriterionConfig,
    *,
    max_score_side: Decimal,
    floor: Decimal,
    ceiling: Decimal,
    instructor_weight: Decimal,
    min_comparisons: int,
) -> CriterionResult:
    relevant = [c for c in comparisons if item_id in (c.item_a_id, c.item_b_id)]
    q = compute_quality_index(comparisons, item_id, instructor_weight=instructor_weight)

    flags: tuple[str, ...] = ()
    if len(relevant) < min_comparisons:
        # S8 — ติด flag แต่ยัง "คำนวณ" ต่อไปตามปกติถ้ามี comparison อย่างน้อย 1 ตัว
        # การมี comparison น้อยไม่ได้แปลว่าคำนวณไม่ได้ แค่ความเชื่อมั่นต่ำ (คนละเรื่องกับ S9)
        flags = (LOW_CONFIDENCE,)

    if q is None:
        return CriterionResult(
            criterion_id=criterion.id,
            comparison_count=0,
            quality_index=None,
            score_ratio=None,
            weighted_score=Decimal(0),
            flags=flags,
        )

    ratio = compute_score_ratio(q, floor=floor, ceiling=ceiling)
    weighted = ratio * (criterion.weight_pct / Decimal(100)) * max_score_side

    return CriterionResult(
        criterion_id=criterion.id,
        comparison_count=len(relevant),
        quality_index=q,
        score_ratio=ratio,
        weighted_score=weighted,
        flags=flags,
    )


@dataclass(frozen=True)
class ItemComponent:
    """ผลรวมคะแนนของ item หนึ่งในฝั่งหนึ่ง ก่อนคูณ participation multiplier (D5 — แยกกันเด็ดขาด)"""

    item_id: str
    side: Side
    criteria: tuple[CriterionResult, ...]
    component: Decimal = field(init=False)

    def __post_init__(self) -> None:
        total = sum((c.weighted_score for c in self.criteria), Decimal(0))
        object.__setattr__(self, "component", total)

    @property
    def flags(self) -> tuple[str, ...]:
        # item ติด flag ถ้าเกณฑ์ไหนก็ได้ติด — คนอ่านรายงานอยากรู้ว่า item นี้มีจุดอ่อนใดๆ ไหม
        # ไม่ต้องไล่เปิดทีละเกณฑ์
        seen: list[str] = []
        for c in self.criteria:
            for f in c.flags:
                if f not in seen:
                    seen.append(f)
        return tuple(seen)


def compute_item_component(
    comparisons: list[SubmittedComparison],
    item_id: str,
    side: Side,
    criteria: list[CriterionConfig],
    *,
    max_score_side: Decimal,
    floor: Decimal,
    ceiling: Decimal,
    instructor_weight: Decimal,
    min_comparisons: int,
) -> ItemComponent:
    results = tuple(
        compute_criterion_result(
            comparisons,
            item_id,
            c,
            max_score_side=max_score_side,
            floor=floor,
            ceiling=ceiling,
            instructor_weight=instructor_weight,
            min_comparisons=min_comparisons,
        )
        for c in criteria
    )
    return ItemComponent(item_id=item_id, side=side, criteria=results)


def compute_participation(
    *, assigned_group: int, submitted_group: int, assigned_individual: int, submitted_individual: int,
    completion_threshold: Decimal,
) -> Decimal:
    """§9.4 — p ถ่วงน้ำหนักด้วยจำนวนที่ได้รับมอบหมายของแต่ละฝั่ง แล้ว map เป็น M

    สูตร PRD เขียนเป็นค่าเฉลี่ยถ่วงน้ำหนักของ p_group/p_individual แยกฝั่ง ซึ่งพีชคณิตแล้ว
    เท่ากับ (ส่งจริงรวม / ได้รับมอบหมายรวม) พอดี — เขียนแบบยุบรวมเพื่อไม่ต้องหารซ้อนสองชั้น
    """
    total_assigned = assigned_group + assigned_individual
    if total_assigned == 0:
        # ไม่มีอะไรให้ประเมินเลย — ไม่มีทาง "ไม่เข้าร่วม" ได้ ถือว่าเข้าร่วมเต็ม
        p = Decimal(1)
    else:
        p = Decimal(submitted_group + submitted_individual) / Decimal(total_assigned)

    return min(Decimal(1), p / completion_threshold)


def compute_final_personal_score(
    *, group_component: Decimal, individual_component: Decimal, participation_multiplier: Decimal,
) -> Decimal:
    """FR-SCORE-11 — ตัวคูณนี้กระทบเฉพาะคะแนน**ส่วนบุคคล**ของคนที่ไม่เข้าร่วม ไม่กระทบ
    คะแนนของกลุ่มเอง (`group_component` ที่คืนจาก `compute_item_component` สำหรับ item
    ฝั่ง GROUP ไม่ผ่านฟังก์ชันนี้เลย — ฟังก์ชันนี้ใช้ตอนประกอบ "คะแนนส่วนตัว" ของนักศึกษา
    แต่ละคนเท่านั้น ซึ่งดึง group_component ของกลุ่มตัวเองมารวมกับ individual_component
    ของตัวเอง — ตาม OQ-2 default: M คูณคะแนนทั้งก้อนรวมกัน ไม่ใช่คูณเฉพาะส่วนบุคคล)
    """
    return (group_component + individual_component) * participation_multiplier
