"""SQL ของคำตอบต่อคู่ประเมิน — US-08

แยกจาก PgAssignmentRepository เพราะเป็นคนละเรื่องกัน: อันนั้นดูแลว่า *มีคู่อะไรบ้าง*
ไฟล์นี้ดูแลว่า *ใครตอบว่าอะไร* — สองอย่างนี้เปลี่ยนคนละจังหวะกัน (คู่คงที่หลัง publish
แต่คำตอบเปลี่ยนได้ตลอดจนถึง deadline)
"""

import json
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

    # --- ส่งทั้งชุด (US-09) ---

    def submit_all(
        self, *, assignment_id: str, side: Side, evaluator_email: str, now: datetime
    ) -> int:
        """flip ทุกคู่ที่เคยตอบไว้ (มีแถว comparison อยู่แล้ว) ให้เป็น SUBMITTED

        คู่ที่ไม่เคยตอบเลยไม่มีแถวอยู่ตั้งแต่แรก จึงไม่ถูกแตะ — ตรงกับ AC ที่บอกว่า
        "ตอบไม่ครบก็ยัง submit ได้ตามปกติ" คือ submit เท่าที่มี ไม่ใช่ submit ทุกคู่แบบบังคับ

        เขียน revision ทุกครั้งที่ submit แม้ choice จะไม่เปลี่ยนจากรอบก่อน เพราะ FR-EVAL-06
        นับที่ "จำนวนครั้งที่กด submit" ไม่ใช่ "จำนวนครั้งที่คำตอบเปลี่ยน"
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.id, c.choice
                FROM comparison c
                JOIN pair_assignment p ON p.id = c.pair_assignment_id
                JOIN app_user e ON e.id = c.evaluator_user_id
                WHERE p.assignment_id = %s AND p.side = %s AND e.email_normalized = %s
                """,
                (assignment_id, str(side), evaluator_email),
            )
            rows = cur.fetchall()

            for r in rows:
                cur.execute(
                    "UPDATE comparison SET status = 'SUBMITTED', submitted_at = %s WHERE id = %s",
                    (now, r["id"]),
                )
                cur.execute(
                    """
                    SELECT COALESCE(MAX(revision_no), 0) + 1 AS next
                    FROM comparison_revision WHERE comparison_id = %s
                    """,
                    (r["id"],),
                )
                next_no = cur.fetchone()["next"]
                cur.execute(
                    """
                    INSERT INTO comparison_revision
                        (id, comparison_id, choice, status, revision_no, submitted_at)
                    VALUES (%s, %s, %s, 'SUBMITTED', %s, %s)
                    """,
                    (str(uuid.uuid4()), r["id"], r["choice"], next_no, now),
                )

        return len(rows)

    # --- idempotency (US-09, FR-API-02) ---

    def lock_idempotency_scope(
        self, assignment_id: str, side: Side, evaluator_email: str, key: str
    ) -> None:
        """serialize คำขอ scope เดียวกัน ป้องกัน revision ซ้ำเมื่อ request มาพร้อมกัน."""
        scope = f"{assignment_id}:{side}:{evaluator_email}:{key}"
        with self._conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (scope,))

    def get_idempotent_response(
        self, assignment_id: str, side: Side, evaluator_email: str, key: str
    ) -> dict | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT s.response_json FROM submission_idempotency_scope s
                JOIN app_user u ON u.id = s.evaluator_user_id
                WHERE s.assignment_id = %s AND s.side = %s
                  AND u.email_normalized = %s AND s.idempotency_key = %s
                """,
                (assignment_id, str(side), evaluator_email, key),
            )
            row = cur.fetchone()
        return row["response_json"] if row else None

    def store_idempotent_response(
        self, assignment_id: str, side: Side, evaluator_email: str, key: str, response: dict
    ) -> None:
        """`DO NOTHING` เผื่อสอง request แข่งกันมาถึงพร้อมกันด้วย key เดียวกัน

        ตัวที่แพ้ race จะไม่ overwrite response ของตัวที่ชนะ — ทั้งคู่ต้องได้คำตอบเดียวกัน
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO submission_idempotency_scope
                    (assignment_id, side, evaluator_user_id, idempotency_key, response_json)
                SELECT %s, %s, u.id, %s, %s
                FROM app_user u WHERE u.email_normalized = %s
                ON CONFLICT (assignment_id, side, evaluator_user_id, idempotency_key) DO NOTHING
                """,
                (assignment_id, str(side), key, json.dumps(response), evaluator_email),
            )
