from datetime import UTC, datetime

from app.daily_scoring import is_daily_recompute_due


def test_ก่อน_02_00_ตาม_timezone_ยังไม่ถึงเวลา():
    now = datetime(2026, 8, 24, 18, 59, tzinfo=UTC)  # 01:59 Asia/Bangkok
    assert not is_daily_recompute_due("Asia/Bangkok", None, now)


def test_ตั้งแต่_02_00_และยังไม่เคยคำนวณวันนี้ต้องทำ():
    now = datetime(2026, 8, 24, 19, 0, tzinfo=UTC)  # 02:00 Asia/Bangkok
    assert is_daily_recompute_due("Asia/Bangkok", None, now)


def test_คำนวณแล้วในวันท้องถิ่นเดียวกันไม่ทำซ้ำ():
    now = datetime(2026, 8, 25, 4, 0, tzinfo=UTC)
    last = datetime(2026, 8, 24, 19, 0, tzinfo=UTC)
    assert not is_daily_recompute_due("Asia/Bangkok", last, now)


def test_timezone_ไม่ถูกต้องไม่ทำงานแทนที่จะทำ_server_ล้ม():
    assert not is_daily_recompute_due("Mars/Olympus", None, datetime.now(UTC))
