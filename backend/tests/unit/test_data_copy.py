"""unit test ของสำเนาข้อมูลเจ้าตัว — FR-PRIV-03, FR-ANON-01 (GAP-02)"""

from datetime import UTC, datetime, timedelta

import pytest

from app.domain.data_copy import build_data_copy, due_at, is_overdue

NOW = datetime(2026, 10, 20, tzinfo=UTC)


def test_กำหนดส่งคือ_30_วันนับจากรับคำขอ():
    assert due_at(NOW) == NOW + timedelta(days=30)


def test_GAP02_คำขออายุ_31_วันที่ยังไม่ส่งถือว่าเลยกำหนด():
    assert is_overdue(requested_at=NOW - timedelta(days=31), status="IN_PROGRESS", now=NOW) is True


def test_คำขอที่ส่งแล้วไม่เลยกำหนด_แม้จะเก่า():
    assert is_overdue(requested_at=NOW - timedelta(days=90), status="SENT", now=NOW) is False


def test_คำขอใหม่ยังไม่เลยกำหนด():
    assert is_overdue(requested_at=NOW - timedelta(days=29), status="IN_PROGRESS", now=NOW) is False


def _copy(**over):
    base = dict(
        generated_at=NOW, profile={"email": "67000001@kmitl.ac.th"}, memberships=[],
        evaluations_given=[], scores=[], requests=[],
    )
    return build_data_copy(**{**base, **over})


def test_สำเนามีทุกหมวดที่เจ้าตัวมีสิทธิ์ได้():
    doc = _copy()

    assert set(doc) == {"generatedAt", "profile", "classrooms", "evaluationsGiven", "scores", "dataCopyRequests"}


def test_FR_ANON_01_สำเนาที่มีตัวตนผู้ประเมินคนอื่นถูกปฏิเสธ():
    with pytest.raises(ValueError):
        _copy(scores=[{"assignment": "A1", "details": [{"evaluatorEmail": "someone@kmitl.ac.th"}]}])
