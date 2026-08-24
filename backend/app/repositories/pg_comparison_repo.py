"""SQL ของคำตอบต่อคู่ประเมิน — US-08

แยกจาก PgAssignmentRepository เพราะเป็นคนละเรื่องกัน: อันนั้นดูแลว่า *มีคู่อะไรบ้าง*
ไฟล์นี้ดูแลว่า *ใครตอบว่าอะไร* — สองอย่างนี้เปลี่ยนคนละจังหวะกัน (คู่คงที่หลัง publish
แต่คำตอบเปลี่ยนได้ตลอดจนถึง deadline)
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from psycopg import Connection

from app.domain.pairing import Side


@dataclass(frozen=True)
class PairLookup:
    """ข้อมูลของ pair_assignment เท่าที่ต้องรู้ก่อนจะรับคำตอบ"""

    id: str
    assignment_id: str
    side: Side
    evaluator_email: str


@dataclass(frozen=True)
class Comparison:
    id: str
    pair_assignment_id: str
    choice: int
    status: str
    saved_at: datetime


class PgComparisonRepository:
    def __init__(self, conn: Connection):
        self._conn = conn

    def find_pair(self, pair_assignment_id: str) -> PairLookup | None:
        try:
            uuid.UUID(pair_assignment_id)
        except (ValueError, AttributeError, TypeError):
            return None

        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT p.id, p.assignment_id, p.side, u.email_normalized AS evaluator_email
                FROM pair_assignment p
                JOIN app_user u ON u.id = p.evaluator_user_id
                WHERE p.id = %s
                """,
                (pair_assignment_id,),
            )
            row = cur.fetchone()

        if row is None:
            return None
        return PairLookup(
            id=str(row["id"]),
            assignment_id=str(row["assignment_id"]),
            side=Side(row["side"]),
            evaluator_email=row["evaluator_email"],
        )

    def save(
        self,
        pair_assignment_id: str,
        *,
        choice: int,
        time_on_task_ms: int | None,
        now: datetime,
    ) -> Comparison:
        """upsert เป็น DRAFT เสมอ — ตาม FR-API-01 ต้อง idempotent

        `ON CONFLICT (pair_assignment_id)` ใช้ UNIQUE constraint ของตาราง comparison
        โดยตรง เรียกซ้ำด้วย choice เดิมกี่ครั้งก็ยังเป็นแถวเดียว ไม่ใช่แค่ในโค้ดชั้นบน
        แต่การันตีที่ระดับ database ด้วย

        เขียนทับเป็น DRAFT เสมอแม้จะเคย SUBMITTED มาก่อน — ตรงกับที่เอกสารบอกว่า
        endpoint นี้ "บันทึกเป็นสถานะ DRAFT จนกว่าจะเรียก submissions" (US-09 เปลี่ยนสถานะ)
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO comparison
                    (id, pair_assignment_id, evaluator_user_id, choice, time_on_task_ms,
                     status, saved_at)
                SELECT %s, p.id, p.evaluator_user_id, %s, %s, 'DRAFT', %s
                FROM pair_assignment p
                WHERE p.id = %s
                ON CONFLICT (pair_assignment_id) DO UPDATE SET
                    choice = EXCLUDED.choice,
                    time_on_task_ms = EXCLUDED.time_on_task_ms,
                    status = 'DRAFT',
                    saved_at = EXCLUDED.saved_at
                RETURNING id, pair_assignment_id, choice, status, saved_at
                """,
                (str(uuid.uuid4()), choice, time_on_task_ms, now, pair_assignment_id),
            )
            row = cur.fetchone()

        return Comparison(
            id=str(row["id"]),
            pair_assignment_id=str(row["pair_assignment_id"]),
            choice=row["choice"],
            status=row["status"],
            saved_at=row["saved_at"],
        )
