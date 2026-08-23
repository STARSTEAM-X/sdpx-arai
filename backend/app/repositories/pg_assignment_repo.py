"""SQL ของงานประเมินและคู่ประเมิน — US-04, US-05, US-06

รับ connection เข้ามาเหมือน repository ตัวอื่น เพราะ transaction boundary เป็นของชั้นบน
การ publish ต้องเขียน assignment, criteria และ pair ทั้งหมด **ใน transaction เดียว**
ถ้าเขียน pair ติดครึ่งเดียวแล้วสถานะเปลี่ยนไปแล้ว จะได้งานที่ประกาศแล้วแต่คู่ไม่ครบ
"""

import uuid
from datetime import datetime
from decimal import Decimal

from psycopg import Connection

from app.domain.assignment_service import Assignment, AssignmentStatus, Criterion
from app.domain.pairing import GroupInfo, Pair, Side


class PgAssignmentRepository:
    def __init__(self, conn: Connection):
        self._conn = conn

    # --- อ่าน ---

    def groups_with_members(self, classroom_id: str) -> list[GroupInfo]:
        """กลุ่มพร้อมสมาชิกที่เป็น STUDENT — input ตั้งต้นของ pairing engine

        เรียงทั้งกลุ่มและสมาชิกเพื่อให้ผลลัพธ์ของ pairing deterministic (P5)
        ลำดับที่ Postgres คืนมาโดยไม่ ORDER BY ไม่มีอะไรรับประกัน
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT g.id, g.name, m.user_id
                FROM group_entity g
                JOIN classroom_member m ON m.group_id = g.id AND m.role = 'STUDENT'
                WHERE g.classroom_id = %s
                ORDER BY g.name, m.user_id
                """,
                (classroom_id,),
            )
            rows = cur.fetchall()

        members: dict[tuple[str, str], list[str]] = {}
        for row in rows:
            members.setdefault((str(row["id"]), row["name"]), []).append(str(row["user_id"]))

        return [
            GroupInfo(id=gid, name=name, member_ids=tuple(users))
            for (gid, name), users in sorted(members.items(), key=lambda kv: kv[0][1])
        ]

    def get(self, assignment_id: str) -> Assignment | None:
        try:
            uuid.UUID(assignment_id)
        except (ValueError, AttributeError, TypeError):
            return None

        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.id, a.classroom_id, a.name, a.description, a.artifact_url,
                       a.group_max_score, a.individual_max_score,
                       a.group_deadline_utc, a.individual_deadline_utc,
                       a.target_coverage, a.max_workload, a.pairing_seed, a.status,
                       u.email_normalized AS created_by
                FROM assignment a
                JOIN app_user u ON u.id = a.created_by
                WHERE a.id = %s
                """,
                (assignment_id,),
            )
            row = cur.fetchone()
            if row is None:
                return None

            cur.execute(
                """
                SELECT id, side, name, weight_pct, display_order
                FROM criterion WHERE assignment_id = %s
                ORDER BY side, display_order, name
                """,
                (assignment_id,),
            )
            criteria = [
                Criterion(
                    id=str(c["id"]),
                    side=Side(c["side"]),
                    name=c["name"],
                    weight_pct=Decimal(c["weight_pct"]),
                    display_order=c["display_order"],
                )
                for c in cur.fetchall()
            ]

        return Assignment(
            id=str(row["id"]),
            classroom_id=str(row["classroom_id"]),
            name=row["name"],
            description=row["description"],
            artifact_url=row["artifact_url"],
            group_max_score=Decimal(row["group_max_score"]),
            individual_max_score=Decimal(row["individual_max_score"]),
            group_deadline_utc=row["group_deadline_utc"],
            individual_deadline_utc=row["individual_deadline_utc"],
            target_coverage=row["target_coverage"],
            max_workload=row["max_workload"],
            pairing_seed=row["pairing_seed"],
            status=AssignmentStatus(row["status"]),
            created_by=row["created_by"],
            criteria=criteria,
        )

    def count_pairs(self, assignment_id: str) -> int:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT count(*) AS n FROM pair_assignment WHERE assignment_id = %s",
                (assignment_id,),
            )
            return cur.fetchone()["n"]

    # --- เขียน ---

    def create(self, assignment: Assignment) -> Assignment:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM app_user WHERE email_normalized = %s",
                (assignment.created_by,),
            )
            row = cur.fetchone()
            if row is None:
                raise LookupError(f"ไม่พบผู้ใช้ {assignment.created_by}")

            cur.execute(
                """
                INSERT INTO assignment
                    (id, classroom_id, name, description, artifact_url,
                     group_max_score, individual_max_score,
                     group_deadline_utc, individual_deadline_utc,
                     target_coverage, max_workload, status, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    assignment.id,
                    assignment.classroom_id,
                    assignment.name,
                    assignment.description,
                    assignment.artifact_url,
                    assignment.group_max_score,
                    assignment.individual_max_score,
                    assignment.group_deadline_utc,
                    assignment.individual_deadline_utc,
                    assignment.target_coverage,
                    assignment.max_workload,
                    str(assignment.status),
                    row["id"],
                ),
            )

        self.replace_criteria(assignment.id, assignment.criteria)
        return assignment

    def replace_criteria(self, assignment_id: str, criteria: list[Criterion]) -> None:
        """แทนที่เกณฑ์ทั้งชุด — เหตุผลเดียวกับ replace_roster

        แก้ทีละข้อจะต้องส่ง id กลับมาให้ครบ ซึ่งฝั่งหน้าเว็บที่แก้ในตารางเดียว
        มักไม่มี id ของแถวที่เพิ่งเพิ่ม การส่งทั้งชุดจึงตรงกับวิธีที่ UI ใช้จริงกว่า
        """
        with self._conn.cursor() as cur:
            cur.execute("DELETE FROM criterion WHERE assignment_id = %s", (assignment_id,))
            for order, c in enumerate(criteria):
                cur.execute(
                    """
                    INSERT INTO criterion
                        (id, assignment_id, side, name, weight_pct, display_order)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        c.id or str(uuid.uuid4()),
                        assignment_id,
                        str(c.side),
                        c.name.strip(),
                        c.weight_pct,
                        c.display_order or order,
                    ),
                )

    def mark_published(self, assignment_id: str, *, seed: int, at: datetime) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE assignment
                SET status = 'PUBLISHED', pairing_seed = %s
                WHERE id = %s
                """,
                (seed, assignment_id),
            )
        _ = at  # เก็บพารามิเตอร์ไว้ให้ชั้นบนส่งเวลาเข้ามาได้เมื่อเพิ่มคอลัมน์ published_at

    def save_pairs(self, assignment_id: str, pairs: list[Pair], *, criterion_id: str) -> None:
        """บันทึกคู่ทั้งชุดของ criterion หนึ่ง

        ล้างของเดิมก่อนเสมอ ทำให้ generate ซ้ำด้วย seed เดิมได้ผลเดิมโดยไม่สะสมของเก่า
        """
        with self._conn.cursor() as cur:
            cur.execute("DELETE FROM pair_assignment WHERE criterion_id = %s", (criterion_id,))
            for p in pairs:
                cur.execute(
                    """
                    INSERT INTO pair_assignment
                        (id, assignment_id, criterion_id, side, item_a_id, item_b_id,
                         evaluator_user_id, display_left_item_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        str(uuid.uuid4()),
                        assignment_id,
                        criterion_id,
                        str(p.side),
                        p.item_a_id,
                        p.item_b_id,
                        p.evaluator_user_id,
                        p.display_left_item_id,
                    ),
                )
