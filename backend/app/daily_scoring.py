"""งานคำนวณ interim รายวันเวลา 02:00 ของแต่ละ classroom (FR-SCORE-06)."""

import asyncio
import logging
from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.db import transaction
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.scoring_orchestrator import run_recompute

log = logging.getLogger(__name__)


def is_daily_recompute_due(timezone: str, last_computed_at: datetime | None, now: datetime) -> bool:
    try:
        zone = ZoneInfo(timezone)
    except ZoneInfoNotFoundError:
        log.error("timezone ของ classroom ไม่ถูกต้อง: %s", timezone)
        return False
    local_now = now.astimezone(zone)
    if local_now.hour < 2:
        return False
    return last_computed_at is None or last_computed_at.astimezone(zone).date() < local_now.date()


def run_due_recomputes(now: datetime | None = None) -> int:
    """คำนวณงานที่เลย 02:00 แล้วยังไม่มี interim ของวันนั้น; startup จึง catch-up ได้."""
    now = now or datetime.now(UTC)
    with transaction() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.id, c.timezone, MAX(cs.computed_at) AS last_computed_at
            FROM assignment a
            JOIN classroom c ON c.id = a.classroom_id
            LEFT JOIN computed_score cs ON cs.assignment_id = a.id AND cs.is_final = false
            WHERE a.status IN ('PUBLISHED', 'OPEN', 'CLOSED')
            GROUP BY a.id, c.timezone
            """
        )
        due_ids = [
            str(row["id"]) for row in cur.fetchall()
            if is_daily_recompute_due(row["timezone"], row["last_computed_at"], now)
        ]

    completed = 0
    for assignment_id in due_ids:
        with transaction() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT pg_try_advisory_xact_lock(hashtextextended(%s, 0)) AS locked",
                (f"daily-score:{assignment_id}",),
            )
            if not cur.fetchone()["locked"]:
                continue
            assignment = PgAssignmentRepository(conn).get(assignment_id)
            if assignment is None:
                continue
            run_recompute(conn, assignment, is_final=False, now=now)
            completed += 1
    return completed


async def daily_scoring_loop() -> None:
    """ตรวจทุกนาที; upsert + advisory lock ทำให้รันหลาย instance แล้วไม่สร้างผลซ้ำ."""
    while True:
        try:
            count = await asyncio.to_thread(run_due_recomputes)
            if count:
                log.info("daily scoring recomputed %s assignment(s)", count)
        except Exception:
            log.exception("daily scoring failed")
        await asyncio.sleep(60)
