"""unit test ของเครื่องคำนวณคะแนน — อ้าง US-16, กฎ S1–S10 ใน unit-brief.md

S10 (golden test) เริ่มจากค่า q ที่ PRD §9.5 ให้มาโดยตรง ไม่ได้ไล่สร้าง comparison ดิบ
ที่เฉลี่ยแล้วได้ q พอดี (เช่น 0.61) เพราะ point ต่อ comparison มีแค่ 6 ค่าคงที่
(0, 0.2, 0.4, 0.6, 0.8, 1.0) — การไล่หาชุด comparison ที่เฉลี่ยได้ 0.61 เป๊ะ ๆ เป็นปริศนา
เลขไม่ใช่การพิสูจน์สูตร ส่วนที่ worked example ตั้งใจตรวจคือสูตรตั้งแต่ q ลงไปจนถึงคะแนน
สุดท้าย (band mapping, ถ่วงน้ำหนักเกณฑ์, participation) — ความถูกต้องของค่าเฉลี่ยถ่วงน้ำหนัก
ที่ได้ q มา ถูกทดสอบแยกด้วยตัวเลขกลม ๆ ใน TestComputeQualityIndex แทน
"""

from decimal import Decimal

from app.domain.pairing import Side
from app.domain.scoring_service import (
    LOW_CONFIDENCE,
    CriterionConfig,
    SubmittedComparison,
    compute_final_personal_score,
    compute_item_component,
    compute_participation,
    compute_quality_index,
    compute_score_ratio,
)


def cmp(
    a: str, b: str, left: str, choice: int, *, instructor: bool = False, criterion: str = "c1"
) -> SubmittedComparison:
    return SubmittedComparison(
        criterion_id=criterion, item_a_id=a, item_b_id=b, display_left_item_id=left,
        choice=choice, is_instructor=instructor
    )


class TestComputeQualityIndex:
    def test_S9_ไม่มี_comparison_เลยคืน_None_ไม่_crash(self):
        assert compute_quality_index([], "g1", instructor_weight=Decimal(1)) is None

    def test_comparison_ที่ไม่เกี่ยวกับ_item_นี้ไม่ถูกนับ(self):
        comparisons = [cmp("other-a", "other-b", "other-a", 1)]
        assert compute_quality_index(comparisons, "g1", instructor_weight=Decimal(1)) is None

    def test_choice_1_item_ที่อยู่ซ้ายได้เต็ม_1_0(self):
        # choice 1 = ซ้ายดีกว่ามาก → s_left = 1.0 (PRD §9.1)
        comparisons = [cmp("g1", "g2", "g1", 1)]
        assert compute_quality_index(comparisons, "g1", instructor_weight=Decimal(1)) == Decimal("1.0")

    def test_choice_1_item_ที่อยู่ขวาได้_0_0(self):
        comparisons = [cmp("g1", "g2", "g1", 1)]
        assert compute_quality_index(comparisons, "g2", instructor_weight=Decimal(1)) == Decimal("0.0")

    def test_ค่าเฉลี่ยถ่วงน้ำหนักธรรมดา_สอง_comparison_น้ำหนักเท่ากัน(self):
        # choice 2 (ซ้ายดีกว่า) = 0.8/0.2 · choice 5 (ขวาดีกว่า) = 0.2/0.8
        # g1 อยู่ซ้ายทั้งคู่ครั้งแรก (0.8) และขวาครั้งที่สอง (0.8 จาก choice 5) → เฉลี่ย 0.8
        comparisons = [cmp("g1", "g2", "g1", 2), cmp("g3", "g1", "g3", 5)]
        assert compute_quality_index(comparisons, "g1", instructor_weight=Decimal(1)) == Decimal("0.8")

    def test_AC_S5_instructor_weight_เป็น_float_ใน_weighted_mean_ไม่ใช่นับ_vote_ซ้ำ(self):
        # student ให้ 0.0 (choice 6, g1 อยู่ซ้าย) · instructor ให้ 1.0 (choice 1) น้ำหนัก 3.0
        # เฉลี่ยถ่วงน้ำหนัก = (1×0.0 + 3×1.0) / (1+3) = 0.75 — ไม่ใช่ (0.0+1.0+1.0+1.0)/4 แบบนับซ้ำ
        comparisons = [
            cmp("g1", "g2", "g1", 6),
            cmp("g1", "g2", "g1", 1, instructor=True),
        ]
        q = compute_quality_index(comparisons, "g1", instructor_weight=Decimal("3.0"))
        assert q == Decimal("0.75")

    def test_S6_ผลลัพธ์เป็น_Decimal_ไม่ใช่_float(self):
        comparisons = [cmp("g1", "g2", "g1", 3)]
        q = compute_quality_index(comparisons, "g1", instructor_weight=Decimal(1))
        assert isinstance(q, Decimal)


class TestComputeScoreRatio:
    def test_AC_S3_band_mapping_ไม่_normalize(self):
        # q=0 → floor พอดี · q=1 → ceiling พอดี · q=0.5 → กึ่งกลาง
        floor, ceiling = Decimal("0.60"), Decimal("1.00")
        assert compute_score_ratio(Decimal(0), floor=floor, ceiling=ceiling) == floor
        assert compute_score_ratio(Decimal(1), floor=floor, ceiling=ceiling) == ceiling
        assert compute_score_ratio(Decimal("0.5"), floor=floor, ceiling=ceiling) == Decimal("0.80")

    def test_D2_ทุกคนได้เท่ากันหมดยังได้คะแนนในช่วง_band_ไม่ใช่_1_ต่อ_N(self):
        # นี่คือกฎที่ D2 ปกป้อง — ถ้า normalize ให้ผลรวม=1 สิบกลุ่มเท่ากันหมดจะได้กลุ่มละ 0.1
        # แต่ band mapping ทุกกลุ่มต้องได้ค่าเดียวกันในช่วง [floor, ceiling] ไม่ใช่ 1/10
        ratio = compute_score_ratio(Decimal("0.5"), floor=Decimal("0.60"), ceiling=Decimal("1.00"))
        assert Decimal("0.60") <= ratio <= Decimal("1.00")


class TestComputeItemComponent:
    def test_แต่ละเกณฑ์ใช้เฉพาะ_comparison_ของตัวเอง(self):
        comparisons = [
            cmp("g1", "g2", "g1", 1, criterion="c1"),
            cmp("g1", "g2", "g1", 6, criterion="c2"),
        ]
        criteria = [
            CriterionConfig(id="c1", weight_pct=Decimal(50)),
            CriterionConfig(id="c2", weight_pct=Decimal(50)),
        ]

        result = compute_item_component(
            comparisons, "g1", Side.GROUP, criteria,
            max_score_side=Decimal(10), floor=Decimal("0.6"), ceiling=Decimal("1.0"),
            instructor_weight=Decimal(1), min_comparisons=1,
        )

        assert result.criteria[0].quality_index == Decimal("1.0")
        assert result.criteria[1].quality_index == Decimal("0.0")
        assert result.criteria[0].comparison_count == 1
        assert result.criteria[1].comparison_count == 1
        assert result.component == Decimal("8.0")

    def test_AC_S8_comparison_น้อยกว่า_min_comparisons_ติด_flag_LOW_CONFIDENCE(self):
        comparisons = [cmp("g1", "g2", "g1", 1), cmp("g1", "g3", "g1", 1)]  # 2 ตัว < min 3
        criteria = [CriterionConfig(id="c1", weight_pct=Decimal(100))]

        result = compute_item_component(
            comparisons, "g1", Side.GROUP, criteria,
            max_score_side=Decimal(15), floor=Decimal("0.6"), ceiling=Decimal("1.0"),
            instructor_weight=Decimal(1), min_comparisons=3,
        )

        assert LOW_CONFIDENCE in result.flags

    def test_comparison_ครบตามเกณฑ์ไม่ติด_flag(self):
        comparisons = [
            cmp("g1", "g2", "g1", 1), cmp("g1", "g3", "g1", 1), cmp("g1", "g4", "g1", 1),
        ]
        criteria = [CriterionConfig(id="c1", weight_pct=Decimal(100))]

        result = compute_item_component(
            comparisons, "g1", Side.GROUP, criteria,
            max_score_side=Decimal(15), floor=Decimal("0.6"), ceiling=Decimal("1.0"),
            instructor_weight=Decimal(1), min_comparisons=3,
        )

        assert result.flags == ()

    def test_D5_แยกคะแนนออกจากการมีส่วนร่วมโดยสิ้นเชิง(self):
        # component ของ compute_item_component ต้องไม่แตะเรื่อง participation เลย
        # (คนละฟังก์ชันกับ compute_final_personal_score ที่คูณ M — พิสูจน์ด้วย signature
        # ไม่มีพารามิเตอร์ participation ใด ๆ ให้ส่งเข้ามาได้เลยในฟังก์ชันนี้)
        comparisons = [cmp("g1", "g2", "g1", 1)]
        criteria = [CriterionConfig(id="c1", weight_pct=Decimal(100))]
        result = compute_item_component(
            comparisons, "g1", Side.GROUP, criteria,
            max_score_side=Decimal(15), floor=Decimal("0.6"), ceiling=Decimal("1.0"),
            instructor_weight=Decimal(1), min_comparisons=3,
        )
        assert result.component == Decimal("15")  # q=1.0 → ratio=1.0 → 100%×15


class TestComputeParticipation:
    def test_AC_S4_ตอบครบทุกอย่างได้_M_เต็ม(self):
        m = compute_participation(
            assigned_group=12, submitted_group=12, assigned_individual=3, submitted_individual=3,
            completion_threshold=Decimal("0.90"),
        )
        assert m == Decimal("1")

    def test_ไม่ตอบเลยได้_M_ศูนย์(self):
        m = compute_participation(
            assigned_group=12, submitted_group=0, assigned_individual=3, submitted_individual=0,
            completion_threshold=Decimal("0.90"),
        )
        assert m == Decimal("0")

    def test_ไม่มีอะไรถูกมอบหมายเลยถือว่าเข้าร่วมเต็ม(self):
        m = compute_participation(
            assigned_group=0, submitted_group=0, assigned_individual=0, submitted_individual=0,
            completion_threshold=Decimal("0.90"),
        )
        assert m == Decimal("1")

    def test_เกิน_completion_threshold_แล้วยัง_cap_ที่_1_ไม่เกิน(self):
        m = compute_participation(
            assigned_group=10, submitted_group=10, assigned_individual=0, submitted_individual=0,
            completion_threshold=Decimal("0.50"),  # p=1.0, 1.0/0.5=2.0 แต่ต้อง cap ที่ 1
        )
        assert m == Decimal("1")


class TestComputeFinalPersonalScore:
    def test_AC_S4_M_ไม่กระทบสัดส่วนคะแนนที่ได้_แค่คูณรวม(self):
        score = compute_final_personal_score(
            group_component=Decimal(10), individual_component=Decimal(4),
            participation_multiplier=Decimal("0.5"),
        )
        assert score == Decimal(7)  # (10+4)×0.5


class TestGoldenS10:
    """S10 — worked example จาก PRD §9.5 คำต่อคำ

    ตั้งค่า: total 20 · group_max 15 · individual_max 5 · floor 0.60 · ceiling 1.00
    Group: UX 40%, Completeness 35%, Innovation 25%
    Individual: Teamwork 50%, Management 50%
    """

    FLOOR = Decimal("0.60")
    CEILING = Decimal("1.00")

    def _weighted(self, q: Decimal, weight_pct: Decimal, max_score: Decimal) -> Decimal:
        ratio = compute_score_ratio(q, floor=self.FLOOR, ceiling=self.CEILING)
        return ratio * (weight_pct / Decimal(100)) * max_score

    def test_กลุ่ม_Aurora_ได้_12_798_จาก_15(self):
        ux = self._weighted(Decimal("0.72"), Decimal(40), Decimal(15))
        completeness = self._weighted(Decimal("0.55"), Decimal(35), Decimal(15))
        innovation = self._weighted(Decimal("0.61"), Decimal(25), Decimal(15))

        assert ux == Decimal("5.328")
        assert completeness == Decimal("4.305")
        assert innovation == Decimal("3.165")
        assert ux + completeness + innovation == Decimal("12.798")

    def test_นก_ประเมินครบ_ได้_16_928_จาก_20(self):
        group_component = Decimal("12.798")  # จาก test ก่อนหน้า — สมาชิกกลุ่มเดียวกันได้ค่านี้เท่ากัน

        teamwork = self._weighted(Decimal("0.68"), Decimal(50), Decimal(5))
        management = self._weighted(Decimal("0.45"), Decimal(50), Decimal(5))
        individual_component = teamwork + management

        assert individual_component == Decimal("4.130")

        m = compute_participation(
            assigned_group=12, submitted_group=12, assigned_individual=3, submitted_individual=3,
            completion_threshold=Decimal("0.90"),
        )
        assert m == Decimal("1")

        final = compute_final_personal_score(
            group_component=group_component, individual_component=individual_component,
            participation_multiplier=m,
        )
        assert final == Decimal("16.928")  # PRD แสดง "16.93" ซึ่งเป็นค่าปัดเพื่อแสดงผล

    def test_AC_ต้น_ประเมินไม่ครบ_กลุ่มยังได้เท่าเดิม_แต่คะแนนส่วนตัวถูกคูณ_M(self):
        group_component = Decimal("12.798")

        teamwork = self._weighted(Decimal("0.31"), Decimal(50), Decimal(5))
        management = self._weighted(Decimal("0.35"), Decimal(50), Decimal(5))
        individual_component = teamwork + management

        assert individual_component == Decimal("3.660")

        m = compute_participation(
            assigned_group=12, submitted_group=6, assigned_individual=3, submitted_individual=3,
            completion_threshold=Decimal("0.90"),
        )
        assert m == Decimal("9") / Decimal("15") / Decimal("0.90")  # 0.60 / 0.90 = 0.6667

        final = compute_final_personal_score(
            group_component=group_component, individual_component=individual_component,
            participation_multiplier=m,
        )
        # FR-SCORE-11 — group_component (12.798) เหมือนของนกทุกประการ ไม่ถูกลดเพราะต้นไม่ประเมิน
        # ต่างกันเฉพาะที่ M ของต้นเอง (ดู test ก่อนหน้าที่นกได้ M=1 เต็ม)
        assert round(final, 2) == Decimal("10.97")
