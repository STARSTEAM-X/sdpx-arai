"""unit test ของการตัดสินและประกาศคะแนน — อ้าง US-13"""

from datetime import UTC, datetime, timedelta

import pytest

from app.domain.errors import ConflictError, ValidationError
from app.domain.finalize_service import (
    assert_before_finalize,
    assert_can_override,
    assert_finalizable,
    assert_reopenable,
    auto_finalize_at,
    is_auto_finalize_due,
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


# --- Figma J24: ประกาศผลอัตโนมัติ 14 วันหลังปิดรับ ---

_DEADLINE = datetime(2026, 10, 20, 16, 59, tzinfo=UTC)


def test_auto_finalize_is_fourteen_days_after_last_deadline():
    assert auto_finalize_at(deadline=_DEADLINE, status="CLOSED", finalized_at=None) == _DEADLINE + timedelta(days=14)


def test_auto_finalize_not_due_one_second_before():
    at = _DEADLINE + timedelta(days=14)
    assert not is_auto_finalize_due(now=at - timedelta(seconds=1), deadline=_DEADLINE, status="OPEN", finalized_at=None)
    assert is_auto_finalize_due(now=at, deadline=_DEADLINE, status="OPEN", finalized_at=None)


def test_auto_finalize_never_after_reopen():
    # เคยประกาศแล้ว reopen กลับมา → การประกาศรอบหลังเป็นของอาจารย์เท่านั้น
    reopened = _DEADLINE + timedelta(days=15)
    assert auto_finalize_at(deadline=_DEADLINE, status="CLOSED", finalized_at=reopened) is None
    assert not is_auto_finalize_due(
        now=_DEADLINE + timedelta(days=60), deadline=_DEADLINE, status="CLOSED", finalized_at=reopened
    )


def test_auto_finalize_skips_draft_finalized_and_archived():
    for status in ("DRAFT", "FINALIZED", "ARCHIVED"):
        assert auto_finalize_at(deadline=_DEADLINE, status=status, finalized_at=None) is None
