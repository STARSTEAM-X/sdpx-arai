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
from app.domain.evaluation_service import EvaluationItem
from app.domain.pairing import GroupInfo, Pair, Side

_ASSIGNMENT_COLUMNS = """
    a.id, a.classroom_id, a.name, a.description, a.artifact_url,
    a.group_max_score, a.individual_max_score,
    a.group_deadline_utc, a.individual_deadline_utc,
    a.target_coverage, a.max_workload, a.pairing_seed, a.status,
    a.instructor_weight, a.min_comparisons, a.score_floor, a.score_ceiling,
    a.completion_threshold, a.finalized_at,
    u.email_normalized AS created_by
"""


def _row_to_assignment(row: dict, criteria: list[Criterion] | None = None) -> Assignment:
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
        instructor_weight=Decimal(row["instructor_weight"]),
        min_comparisons=row["min_comparisons"],
        score_floor=Decimal(row["score_floor"]),
        score_ceiling=Decimal(row["score_ceiling"]),
        completion_threshold=Decimal(row["completion_threshold"]),
        finalized_at=row["finalized_at"],
        status=AssignmentStatus(row["status"]),
        created_by=row["created_by"],
        criteria=criteria or [],
    )


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
                f"""
                SELECT {_ASSIGNMENT_COLUMNS}
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

        return _row_to_assignment(row, criteria)

    def list_for_classroom(self, classroom_id: str, *, include_draft: bool) -> list[Assignment]:
        """งานประเมินทั้งหมดในห้องนี้ — US-07 ต้องรู้ id ก่อนถึงจะเรียก my-evaluations ต่อได้

        `include_draft=False` สำหรับนักศึกษา — งานที่ยังร่างอยู่ไม่ควรให้เห็นด้วยซ้ำ
        ต่างจากอาจารย์ (`MANAGE_ASSIGNMENT`) ที่ต้องเห็นของที่ยังแก้ไม่เสร็จเพื่อกลับมาทำต่อ
        """
        query = f"""
            SELECT {_ASSIGNMENT_COLUMNS}
            FROM assignment a
            JOIN app_user u ON u.id = a.created_by
            WHERE a.classroom_id = %s
        """
        if not include_draft:
            query += " AND a.status <> 'DRAFT'"
        query += " ORDER BY a.created_at DESC"

        with self._conn.cursor() as cur:
            cur.execute(query, (classroom_id,))
            rows = cur.fetchall()

        return [_row_to_assignment(row) for row in rows]

    def count_pairs(self, assignment_id: str) -> int:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT count(*) AS n FROM pair_assignment WHERE assignment_id = %s",
                (assignment_id,),
            )
            return cur.fetchone()["n"]

    def my_pairs(
        self, assignment_id: str, *, side: Side, evaluator_email: str
    ) -> list[EvaluationItem]:
        """คู่ทั้งหมดที่ evaluator คนนี้ต้องประเมินในฝั่งนี้ พร้อม label และสถานะทำแล้วหรือยัง

        label_join/label_a/label_b มาจากค่าคงที่ที่เลือกจาก `side` เท่านั้น ไม่ใช่ query
        parameter ของผู้เรียก — จึงต่อ string ตรงนี้ได้โดยไม่ผิด FR-SEC-03
        (ค่าที่มาจาก request จริง ๆ ยังผ่าน %s ทั้งหมด)
        """
        if side is Side.GROUP:
            label_join = (
                "LEFT JOIN group_entity ga ON ga.id = p.item_a_id "
                "LEFT JOIN group_entity gb ON gb.id = p.item_b_id"
            )
            label_a, label_b = "ga.name", "gb.name"
        else:
            label_join = (
                "LEFT JOIN app_user ua ON ua.id = p.item_a_id "
                "LEFT JOIN app_user ub ON ub.id = p.item_b_id"
            )
            label_a = "COALESCE(ua.display_name, ua.email_normalized)"
            label_b = "COALESCE(ub.display_name, ub.email_normalized)"

        with self._conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT p.id, p.item_a_id, p.item_b_id, p.display_left_item_id,
                       cr.id AS criterion_id, cr.name AS criterion_name,
                       {label_a} AS label_a, {label_b} AS label_b,
                       (c.status = 'SUBMITTED') AS completed,
                       c.choice AS choice
                FROM pair_assignment p
                JOIN app_user e ON e.id = p.evaluator_user_id
                JOIN criterion cr ON cr.id = p.criterion_id
                {label_join}
                LEFT JOIN comparison c ON c.pair_assignment_id = p.id
                WHERE p.assignment_id = %s AND p.side = %s AND e.email_normalized = %s
                ORDER BY cr.display_order, cr.name, label_a, label_b
                """,
                (assignment_id, str(side), evaluator_email),
            )
            rows = cur.fetchall()

        items: list[EvaluationItem] = []
        for r in rows:
            item_a_id, item_b_id = str(r["item_a_id"]), str(r["item_b_id"])
            left_id = str(r["display_left_item_id"])
            # display_left_item_id บอกว่า item ไหนอยู่ซ้าย (D8) — สลับ a/b ให้ตรงกับตำแหน่งจริง
            if left_id == item_a_id:
                left_label, right_id, right_label = r["label_a"], item_b_id, r["label_b"]
            else:
                left_label, right_id, right_label = r["label_b"], item_a_id, r["label_a"]

            items.append(
                EvaluationItem(
                    pair_assignment_id=str(r["id"]),
                    criterion_id=str(r["criterion_id"]),
                    criterion_name=r["criterion_name"],
                    left_id=left_id,
                    left_label=left_label,
                    right_id=right_id,
                    right_label=right_label,
                    completed=bool(r["completed"]),
                    choice=r["choice"],
                )
            )
        return items

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

    def mark_finalized(self, assignment_id: str, *, at: datetime) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                "UPDATE assignment SET status = 'FINALIZED', finalized_at = %s WHERE id = %s",
                (at, assignment_id),
            )

    def mark_reopened(self, assignment_id: str) -> None:
        """PRD state diagram: FINALIZED → CLOSED เมื่อ reopen — finalized_at คงไว้เป็นประวัติ
        ว่าเคย finalize ครั้งล่าสุดเมื่อไร ไม่ล้างทิ้ง เผื่อกลับมา finalize ใหม่จะได้เทียบเวลาได้
        """
        with self._conn.cursor() as cur:
            cur.execute("UPDATE assignment SET status = 'CLOSED' WHERE id = %s", (assignment_id,))

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
