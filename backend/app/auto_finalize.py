"""ประกาศผลอัตโนมัติ 14 วันหลังปิดรับ เมื่ออาจารย์ยังไม่ประกาศ (Figma J24)

ข้ามงานที่มีรายการข้อมูลไม่พอ (LOW_CONFIDENCE) ทั้งงาน — กฎเดียวกับการประกาศด้วยมือ
ที่ต้องให้อาจารย์ยืนยันเองเสมอ (finalize_service.assert_before_finalize)
"""

import logging
from datetime import UTC, datetime

from app.db import transaction
from app.domain.audit import AuditAction, AuditEvent
from app.domain.finalize_service import AUTO_FINALIZE_AFTER, is_auto_finalize_due
from app.observability import log_event
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.repositories.pg_audit_repo import PgAuditRepository
from app.repositories.pg_scoring_repo import PgScoringRepository
from app.scoring_orchestrator import run_recompute

log = logging.getLogger(__name__)

# ผู้กระทำใน audit log — ไม่ใช่อีเมลของผู้ใช้จริง actor_user_id จึงเป็น NULL
SYSTEM_ACTOR = "system"


def has_submitted_answers(cur, assignment_id: str) -> bool:
    """ยังไม่มีคำตอบที่ส่งแล้วเลย = ข้อมูลไม่พอทั้งงาน (run_recompute ไม่เห็นรายการให้ติดธง)"""
    cur.execute(
        "SELECT EXISTS (SELECT 1 FROM comparison r JOIN pair_assignment p ON p.id = r.pair_assignment_id "
        "WHERE p.assignment_id = %s AND p.retired_at IS NULL AND r.status = 'SUBMITTED') AS has",
        (assignment_id,),
    )
    return cur.fetchone()["has"]


class _SkipLowConfidence(Exception):
    """ใช้ rollback ผลคำนวณ final ที่เพิ่งเขียน เมื่อมีรายการข้อมูลไม่พอ"""


def run_due_auto_finalizes(now: datetime | None = None) -> int:
    now = now or datetime.now(UTC)
    with transaction() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.id FROM assignment a JOIN classroom c ON c.id = a.classroom_id
            WHERE a.status IN ('PUBLISHED', 'OPEN', 'CLOSED') AND a.finalized_at IS NULL
              AND c.status = 'ACTIVE'
              AND GREATEST(a.group_deadline_utc, COALESCE(a.individual_deadline_utc, a.group_deadline_utc)) <= %s
            """,
            (now - AUTO_FINALIZE_AFTER,),
        )
        due_ids = [str(row["id"]) for row in cur.fetchall()]

    finalized = 0
    for assignment_id in due_ids:
        try:
            with transaction() as conn, conn.cursor() as cur:
                cur.execute(
                    "SELECT pg_try_advisory_xact_lock(hashtextextended(%s, 0)) AS locked",
                    (f"auto-finalize:{assignment_id}",),
                )
                if not cur.fetchone()["locked"]:
                    continue
                repo = PgAssignmentRepository(conn)
                assignment = repo.lock(assignment_id)
                if assignment is None:
                    continue
                deadline = max(
                    assignment.group_deadline_utc,
                    assignment.individual_deadline_utc or assignment.group_deadline_utc,
                )
                # สถานะอาจเปลี่ยนระหว่าง query แรกกับตอนล็อก (อาจารย์ประกาศเอง / archive ห้อง)
                if not is_auto_finalize_due(
                    now=now, deadline=deadline, status=str(assignment.status), finalized_at=assignment.finalized_at
                ):
                    continue
                cur.execute("SELECT status FROM classroom WHERE id = %s FOR SHARE", (assignment.classroom_id,))
                if cur.fetchone()["status"] != "ACTIVE":
                    continue
                if not has_submitted_answers(cur, assignment_id) or run_recompute(
                    conn, assignment, is_final=True, now=now
                ):
                    raise _SkipLowConfidence
                PgScoringRepository(conn).create_final_snapshot(assignment_id, computed_at=now)
                repo.mark_finalized(assignment_id, at=now)
                PgAuditRepository(conn).record(
                    AuditEvent(
                        actor_email=SYSTEM_ACTOR,
                        action=AuditAction.SCORES_FINALIZED,
                        resource_type="assignment",
                        resource_id=assignment_id,
                        classroom_id=assignment.classroom_id,
                        before_state={"status": str(assignment.status)},
                        after_state={"status": "FINALIZED", "hadLowConfidenceItems": False, "automatic": True},
                    )
                )
            finalized += 1
            log_event(log, "scores_auto_finalized", assignmentId=assignment_id)
        except _SkipLowConfidence:
            log.info("auto-finalize skipped %s: มีรายการข้อมูลไม่พอ", assignment_id)
    return finalized
