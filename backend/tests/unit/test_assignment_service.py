"""unit test ของวงจรชีวิตงานประเมิน — อ้าง US-04

AC ของ US-04 ตัดสินกันที่ status code สามค่า (201 / 422 / 409) ซึ่ง map มาจาก
ValidationError / ConflictError ที่นี่ · การ map อยู่ใน app/api/errors.py
"""

from datetime import UTC, datetime
from decimal import Decimal

import pytest

from app.domain.assignment_service import (
    Assignment,
    AssignmentStatus,
    Criterion,
    assert_editable,
    assert_publishable,
    validate_new_assignment,
)
from app.domain.errors import ConflictError, ValidationError
from app.domain.pairing import Side

DEADLINE = datetime(2026, 12, 1, tzinfo=UTC)


def crit(side: Side, weight: str, name: str = "คุณภาพงาน") -> Criterion:
    return Criterion(id=f"c-{side}-{weight}", side=side, name=name, weight_pct=Decimal(weight))


def make_assignment(**overrides) -> Assignment:
    defaults = dict(
        id="a1",
        classroom_id="room1",
        name="งานกลุ่มครั้งที่ 1",
        group_max_score=Decimal(15),
        individual_max_score=Decimal(5),
        group_deadline_utc=DEADLINE,
        created_by="ajarn@kmitl.ac.th",
        criteria=[crit(Side.GROUP, "100"), crit(Side.INDIVIDUAL, "100")],
    )
    return Assignment(**{**defaults, **overrides})


class TestValidateNewAssignment:
    def test_ผ่านเมื่อข้อมูลครบ(self):
        validate_new_assignment(
            name="งานกลุ่ม", group_deadline_utc=DEADLINE, criteria=[crit(Side.GROUP, "100")]
        )

    @pytest.mark.parametrize("bad", ["", "   "])
    def test_ชื่อว่างถูกปฏิเสธ(self, bad: str):
        with pytest.raises(ValidationError) as exc:
            validate_new_assignment(
                name=bad, group_deadline_utc=DEADLINE, criteria=[crit(Side.GROUP, "100")]
            )
        assert exc.value.field == "name"

    def test_ไม่มีกำหนดส่งถูกปฏิเสธ(self):
        with pytest.raises(ValidationError) as exc:
            validate_new_assignment(
                name="งาน", group_deadline_utc=None, criteria=[crit(Side.GROUP, "100")]
            )
        assert exc.value.field == "groupDeadlineUtc"

    def test_ไม่มีเกณฑ์เลยถูกปฏิเสธ(self):
        with pytest.raises(ValidationError) as exc:
            validate_new_assignment(name="งาน", group_deadline_utc=DEADLINE, criteria=[])
        assert exc.value.field == "criteria"

    def test_น้ำหนักเกิน_100_ถูกปฏิเสธ(self):
        with pytest.raises(ValidationError):
            validate_new_assignment(
                name="งาน", group_deadline_utc=DEADLINE, criteria=[crit(Side.GROUP, "101")]
            )

    def test_ตอนสร้างไม่บังคับให้น้ำหนักรวม_100(self):
        # DRAFT คืองานที่ยังทำไม่เสร็จ — บังคับตอนสร้างเท่ากับห้ามเซฟงานค้าง
        validate_new_assignment(
            name="งาน", group_deadline_utc=DEADLINE, criteria=[crit(Side.GROUP, "40")]
        )


class TestAssertPublishable:
    def test_AC_น้ำหนักครบ_100_ทั้งสองฝั่งผ่าน(self):
        assert_publishable(make_assignment())

    def test_AC_ฝั่ง_GROUP_รวม_90_ถูกปฏิเสธพร้อมบอกว่าขาดเท่าไร(self):
        a = make_assignment(
            criteria=[crit(Side.GROUP, "90"), crit(Side.INDIVIDUAL, "100")]
        )

        with pytest.raises(ValidationError) as exc:
            assert_publishable(a)

        # FR ระบุว่าต้องบอกว่าขาดอีกเท่าไร ไม่ใช่แค่ "น้ำหนักไม่ถูกต้อง"
        assert "90" in exc.value.message
        assert "ขาดอีก 10" in exc.value.message

    def test_AC_น้ำหนักคลาดไม่เกิน_0_01_ผ่านได้_PRD_FR_ASSIGN_02(self):
        # แบ่งน้ำหนัก 3 เกณฑ์เท่า ๆ กันไม่ลงตัว: 33.33 + 33.33 + 33.34 = 100.00 พอดี
        # แต่ 33.33 × 3 = 99.99 ต้องผ่านได้เช่นกัน เพราะ PRD อนุญาต ± 0.01
        a = make_assignment(
            criteria=[
                crit(Side.GROUP, "33.33"),
                crit(Side.GROUP, "33.33", "ความคิดสร้างสรรค์"),
                crit(Side.GROUP, "33.33", "การนำเสนอ"),
                crit(Side.INDIVIDUAL, "100"),
            ]
        )

        assert_publishable(a)

    def test_น้ำหนักคลาดเกิน_0_01_ยังถูกปฏิเสธ(self):
        a = make_assignment(
            criteria=[crit(Side.GROUP, "99.98"), crit(Side.INDIVIDUAL, "100")]
        )

        with pytest.raises(ValidationError):
            assert_publishable(a)

    def test_น้ำหนักเกิน_100_บอกว่าเกินมาเท่าไร(self):
        a = make_assignment(
            criteria=[crit(Side.GROUP, "60"), crit(Side.GROUP, "55", "ความคิดสร้างสรรค์"),
                      crit(Side.INDIVIDUAL, "100")]
        )

        with pytest.raises(ValidationError) as exc:
            assert_publishable(a)

        assert "เกินมา 15" in exc.value.message

    def test_หลายเกณฑ์รวมกันได้_100_ผ่าน(self):
        a = make_assignment(
            criteria=[
                crit(Side.GROUP, "60"),
                crit(Side.GROUP, "40", "ความคิดสร้างสรรค์"),
                crit(Side.INDIVIDUAL, "100"),
            ]
        )

        assert_publishable(a)

    def test_AC_ปิดฝั่งบุคคลแล้วไม่ต้องมีเกณฑ์ฝั่งนั้น(self):
        # individualMaxScore = 0 → ระบบไม่แตะฝั่ง INDIVIDUAL เลย (FR-ASSIGN-07)
        a = make_assignment(
            individual_max_score=Decimal(0), criteria=[crit(Side.GROUP, "100")]
        )

        assert_publishable(a)
        assert not a.has_individual_side

    def test_ปิดฝั่งบุคคลแต่ยังมีเกณฑ์ค้างอยู่ถูกปฏิเสธ(self):
        # ตั้งค่าขัดกันเอง — ต้องบอกก่อน ไม่ใช่เงียบแล้วไม่สร้าง pair ให้
        a = make_assignment(
            individual_max_score=Decimal(0),
            criteria=[crit(Side.GROUP, "100"), crit(Side.INDIVIDUAL, "100")],
        )

        with pytest.raises(ValidationError) as exc:
            assert_publishable(a)

        assert exc.value.field == "individualMaxScore"

    def test_ไม่มีเกณฑ์ฝั่ง_GROUP_เลยถูกปฏิเสธ(self):
        a = make_assignment(criteria=[crit(Side.INDIVIDUAL, "100")])

        with pytest.raises(ValidationError):
            assert_publishable(a)

    def test_publish_ซ้ำถูกปฏิเสธด้วย_ConflictError(self):
        a = make_assignment(status=AssignmentStatus.PUBLISHED)

        with pytest.raises(ConflictError):
            assert_publishable(a)


class TestAssertEditable:
    def test_DRAFT_แก้ได้(self):
        assert_editable(make_assignment())

    @pytest.mark.parametrize(
        "status",
        [AssignmentStatus.PUBLISHED, AssignmentStatus.OPEN, AssignmentStatus.CLOSED],
    )
    def test_AC_งานที่_publish_แล้วแก้เกณฑ์ไม่ได้_ต้องบอกให้ถอยก่อน(
        self, status: AssignmentStatus
    ):
        with pytest.raises(ConflictError) as exc:
            assert_editable(make_assignment(status=status))

        assert "DRAFT" in exc.value.message
