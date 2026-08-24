"""unit test ของการบันทึกคำตอบ — อ้าง US-08

กฎที่นี่ตัดสินล้วนเป็นเรื่อง "ทำได้ไหม" ไม่ใช่ "ทำอย่างไร" — การ upsert จริงเป็นของ repo
"""

from datetime import UTC, datetime

import pytest

from app.domain.comparison_service import assert_before_deadline, assert_is_evaluator, validate_choice
from app.domain.errors import DeadlinePassedError, NotYourPairError, ValidationError


class TestValidateChoice:
    @pytest.mark.parametrize("choice", [1, 2, 3, 4, 5, 6])
    def test_AC_1_ถึง_6_ผ่านหมด_ไม่มีค่ากลาง(self, choice: int):
        validate_choice(choice)  # ไม่ raise = ผ่าน

    @pytest.mark.parametrize("choice", [0, 7, -1, 100])
    def test_นอกช่วง_1_ถึง_6_ถูกปฏิเสธ(self, choice: int):
        with pytest.raises(ValidationError) as exc:
            validate_choice(choice)
        assert exc.value.field == "choice"


class TestAssertIsEvaluator:
    def test_เจ้าของคู่บันทึกได้(self):
        assert_is_evaluator(pair_evaluator_email="a@kmitl.ac.th", caller_email="a@kmitl.ac.th")

    def test_AC_ไม่ใช่_evaluator_ของคู่นี้ถูกปฏิเสธด้วย_NOT_YOUR_PAIR(self):
        with pytest.raises(NotYourPairError) as exc:
            assert_is_evaluator(pair_evaluator_email="a@kmitl.ac.th", caller_email="b@kmitl.ac.th")
        assert exc.value.code == "NOT_YOUR_PAIR"


class TestAssertBeforeDeadline:
    def test_ก่อนกำหนดส่งบันทึกได้(self):
        now = datetime(2027, 1, 1, tzinfo=UTC)
        deadline = datetime(2027, 1, 2, tzinfo=UTC)
        assert_before_deadline(now=now, deadline=deadline)

    def test_AC_เลยกำหนดส่งแล้วถูกปฏิเสธด้วย_DEADLINE_PASSED(self):
        now = datetime(2027, 1, 3, tzinfo=UTC)
        deadline = datetime(2027, 1, 2, tzinfo=UTC)
        with pytest.raises(DeadlinePassedError) as exc:
            assert_before_deadline(now=now, deadline=deadline)
        assert exc.value.code == "DEADLINE_PASSED"

    def test_ตรงเวลา_deadline_เป๊ะถือว่าเลยแล้ว(self):
        # ขอบเขตปิด — วินาทีที่ deadline ต้องไม่รับแล้ว ไม่ใช่รับได้ถึงวินาทีสุดท้ายพอดี
        deadline = datetime(2027, 1, 2, tzinfo=UTC)
        with pytest.raises(DeadlinePassedError):
            assert_before_deadline(now=deadline, deadline=deadline)
