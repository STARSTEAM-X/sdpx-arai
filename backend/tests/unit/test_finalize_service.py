"""unit test ของการตัดสินและประกาศคะแนน — อ้าง US-13"""

from datetime import UTC, datetime

import pytest

from app.domain.errors import ConflictError, ValidationError
from app.domain.finalize_service import (
    assert_before_finalize,
    assert_can_override,
    assert_finalizable,
    assert_reopenable,
)


class TestAssertFinalizable:
    def test_deadline_ผ่านแล้ว_finalize_ได้(self):
        now = datetime(2027, 1, 2, tzinfo=UTC)
        deadline = datetime(2027, 1, 1, tzinfo=UTC)
        assert_finalizable(now=now, deadline=deadline, status="PUBLISHED")

    def test_AC_ยังไม่ถึง_deadline_finalize_ไม่ได้(self):
        now = datetime(2027, 1, 1, tzinfo=UTC)
        deadline = datetime(2027, 1, 2, tzinfo=UTC)
        with pytest.raises(ConflictError):
            assert_finalizable(now=now, deadline=deadline, status="PUBLISHED")

    def test_ยังไม่_publish_finalize_ไม่ได้(self):
        now = datetime(2027, 1, 2, tzinfo=UTC)
        deadline = datetime(2027, 1, 1, tzinfo=UTC)
        with pytest.raises(ConflictError):
            assert_finalizable(now=now, deadline=deadline, status="DRAFT")

    def test_FINALIZED_อยู่แล้ว_finalize_ซ้ำไม่ได้(self):
        now = datetime(2027, 1, 2, tzinfo=UTC)
        deadline = datetime(2027, 1, 1, tzinfo=UTC)
        with pytest.raises(ConflictError):
            assert_finalizable(now=now, deadline=deadline, status="FINALIZED")


class TestAssertBeforeFinalize:
    def test_ไม่มี_low_confidence_ผ่านได้เลย(self):
        assert_before_finalize(has_low_confidence_items=False, confirmed=False)

    def test_AC_มี_low_confidence_แต่ยังไม่ยืนยันถูกปฏิเสธ(self):
        with pytest.raises(ValidationError) as exc:
            assert_before_finalize(has_low_confidence_items=True, confirmed=False)
        assert exc.value.field == "confirmLowConfidence"

    def test_AC_มี_low_confidence_แต่ยืนยันแล้วผ่านได้(self):
        assert_before_finalize(has_low_confidence_items=True, confirmed=True)


class TestAssertReopenable:
    def test_FINALIZED_reopen_ได้(self):
        assert_reopenable(status="FINALIZED")

    def test_ยังไม่_FINALIZED_reopen_ไม่ได้(self):
        with pytest.raises(ConflictError):
            assert_reopenable(status="PUBLISHED")


class TestAssertCanOverride:
    def test_มีเหตุผลผ่านได้(self):
        assert_can_override(reason="งานส่งช้าเพราะเน็ตล่ม ให้คะแนนเพิ่มตามที่ตกลงไว้ก่อนเรียน")

    @pytest.mark.parametrize("reason", ["", "   ", None])
    def test_AC_ไม่กรอกเหตุผลถูกปฏิเสธด้วย_422(self, reason):
        with pytest.raises(ValidationError) as exc:
            assert_can_override(reason=reason)
        assert exc.value.field == "reason"
