"""SQL ของการคำนวณและบันทึกคะแนน — US-13, US-16

แยกจาก PgAssignmentRepository เพราะเป็นคนละเรื่อง: อันนั้นดูแล *มีคู่อะไรบ้าง*
ไฟล์นี้ดูแล *คำตอบที่ตอบแล้วแปลงเป็นคะแนนเท่าไร* — เกิดทีหลังและเปลี่ยนเมื่อมีคน submit
เพิ่มหรือกด recompute เท่านั้น ไม่เปลี่ยนพร้อมกับคู่
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from psycopg import Connection

from app.domain.pairing import Side
from app.domain.scoring_service import CriterionConfig, ItemComponent, SubmittedComparison


@dataclass(frozen=True)
class ParticipationCount:
    assigned: int
    submitted: int


@dataclass(frozen=True)
class ComparisonExportRow:
    """หนึ่งแถวของ raw comparison export — FR-EXPORT-03

    `evaluator_user_id` เป็น uuid จริงเสมอที่ชั้นนี้ — การแปลงเป็น pseudonym (E1, E2, ...)
    หรือเปิดเป็นอีเมลจริง เป็นหน้าที่ของ endpoint ชั้นบน ไม่ใช่ของ repo (S2/AR-01 spirit:
    ชั้นข้อมูลไม่ตัดสินใจเรื่อง privacy — แค่คืนข้อมูลดิบให้ครบ)
    """

    side: Side
    criterion_name: str
    item_a_label: str
    item_b_label: str
    display_left_item_id: str
    item_a_id: str
    item_b_id: str
    choice: int
    evaluator_user_id: str
    submitted_at: datetime


@dataclass(frozen=True)
class ComputedScoreRow:
    item_id: str
    side: Side
    item_label: str
    component: Decimal
    flags: tuple[str, ...]


class PgScoringRepository:
    def __init__(self, conn: Connection):
        self._conn = conn

    def submitted_comparisons(self, assignment_id: str, side: Side) -> list[SubmittedComparison]:
        """คำตอบที่ SUBMITTED แล้วของฝั่งหนึ่ง — เฉพาะสถานะนี้เท่านั้นที่เข้าสู่การคำนวณ (S2, DR-01)

        `is_instructor` เช็คจาก role ของผู้ประเมินในห้องนั้น ๆ — ตอนนี้ pairing engine
        ยังสร้างคู่ให้ STUDENT อย่างเดียว (ยังไม่มี "ส่งประเมินเพิ่ม" ของอาจารย์ตาม FR-PAIR-10)
        จึงเป็น False เสมอในทางปฏิบัติ แต่เขียนให้ถูกไว้ก่อนเผื่ออนาคต
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT p.criterion_id, p.item_a_id, p.item_b_id, p.display_left_item_id, c.choice,
                       (m.role IN ('OWNER', 'CO_TEACHER')) AS is_instructor
                FROM comparison c
                JOIN pair_assignment p ON p.id = c.pair_assignment_id
                JOIN assignment a ON a.id = p.assignment_id
                LEFT JOIN classroom_member m
                       ON m.user_id = c.evaluator_user_id AND m.classroom_id = a.classroom_id
                WHERE p.assignment_id = %s AND p.side = %s AND c.status = 'SUBMITTED'
                """,
                (assignment_id, str(side)),
            )
            rows = cur.fetchall()

        return [
            SubmittedComparison(
                criterion_id=str(r["criterion_id"]),
                item_a_id=str(r["item_a_id"]),
                item_b_id=str(r["item_b_id"]),
                display_left_item_id=str(r["display_left_item_id"]),
                choice=r["choice"],
                is_instructor=bool(r["is_instructor"]),
            )
            for r in rows
        ]

    def criteria_for(self, assignment_id: str, side: Side) -> list[CriterionConfig]:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT id, weight_pct FROM criterion WHERE assignment_id = %s AND side = %s",
                (assignment_id, str(side)),
            )
            return [CriterionConfig(id=str(r["id"]), weight_pct=Decimal(r["weight_pct"])) for r in cur.fetchall()]

    def save_computed_scores(
        self, assignment_id: str, items: list[ItemComponent], *, is_final: bool, now: datetime
    ) -> None:
        """เขียนทับ interim (`is_final=false`) เสมอ — ส่วน `is_final=true` เขียนได้แค่ตอน
        finalize เท่านั้น (repo ไม่เช็คว่าใครเรียก แต่ endpoint ชั้นบนเป็นคนคุมผ่าน finalize_service)

        interim ใช้ partial UNIQUE จึงเขียนทับชุดล่าสุดได้ ส่วน final เป็น append-only batch
        (ทุกแถวใน batch ใช้ `computed_at` เดียวกัน) ตาม DR-03
        """
        with self._conn.cursor() as cur:
            for item in items:
                for c in item.criteria:
                    conflict_clause = "" if is_final else """
                        ON CONFLICT (assignment_id, criterion_id, item_id)
                        WHERE is_final = false DO UPDATE SET
                            comparison_count = EXCLUDED.comparison_count,
                            quality_index    = EXCLUDED.quality_index,
                            score_ratio      = EXCLUDED.score_ratio,
                            weighted_score   = EXCLUDED.weighted_score,
                            flags            = EXCLUDED.flags,
                            computed_at      = EXCLUDED.computed_at
                    """
                    cur.execute(
                        f"""
                        INSERT INTO computed_score
                            (id, assignment_id, criterion_id, side, item_id, comparison_count,
                             quality_index, score_ratio, weighted_score, flags, is_final,
                             computed_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        {conflict_clause}
                        """,
                        (
                            str(uuid.uuid4()),
                            assignment_id,
                            c.criterion_id,
                            str(item.side),
                            item.item_id,
                            c.comparison_count,
                            c.quality_index,
                            c.score_ratio,
                            c.weighted_score,
                            list(c.flags),
                            is_final,
                            now,
                        ),
                    )

    def component_for_item(self, assignment_id: str, side: Side, item_id: str, *, is_final: bool) -> Decimal:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(SUM(weighted_score), 0) AS total
                FROM computed_score
                WHERE assignment_id = %s AND side = %s AND item_id = %s AND is_final = %s
                  AND (NOT %s OR computed_at = (
                      SELECT MAX(computed_at) FROM computed_score
                      WHERE assignment_id = %s AND is_final = true
                  ))
                """,
                (assignment_id, str(side), item_id, is_final, is_final, assignment_id),
            )
            return Decimal(cur.fetchone()["total"])

    def has_low_confidence(self, assignment_id: str, *, is_final: bool) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT count(*) AS n FROM computed_score
                WHERE assignment_id = %s AND is_final = %s AND 'LOW_CONFIDENCE' = ANY(flags)
                  AND (NOT %s OR computed_at = (
                      SELECT MAX(computed_at) FROM computed_score
                      WHERE assignment_id = %s AND is_final = true
                  ))
                """,
                (assignment_id, is_final, is_final, assignment_id),
            )
            return cur.fetchone()["n"] > 0

    def create_final_snapshot(self, assignment_id: str, *, computed_at: datetime) -> str:
        """เก็บ input และ output ของ finalization ครั้งนี้แบบ append-only (FR-SCORE-09)."""
        snapshot_id = str(uuid.uuid4())
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO score_snapshot
                    (id, assignment_id, formula_version, input_json, output_json, created_at)
                SELECT %s, a.id, 'v2.0',
                       jsonb_build_object(
                           'assignment', jsonb_build_object(
                               'instructorWeight', a.instructor_weight,
                               'minComparisons', a.min_comparisons,
                               'scoreFloor', a.score_floor,
                               'scoreCeiling', a.score_ceiling,
                               'completionThreshold', a.completion_threshold,
                               'groupMaxScore', a.group_max_score,
                               'individualMaxScore', a.individual_max_score
                           ),
                           'criteria', COALESCE((
                               SELECT jsonb_agg(to_jsonb(x) ORDER BY x.side, x.display_order)
                               FROM (SELECT id, side, name, weight_pct, display_order
                                     FROM criterion WHERE assignment_id = a.id) x
                           ), '[]'::jsonb),
                           'comparisons', COALESCE((
                               SELECT jsonb_agg(to_jsonb(x) ORDER BY x.pair_assignment_id)
                               FROM (SELECT p.id AS pair_assignment_id, p.side, p.criterion_id,
                                            p.item_a_id, p.item_b_id, p.display_left_item_id,
                                            c.choice, c.evaluator_user_id, c.submitted_at
                                     FROM comparison c
                                     JOIN pair_assignment p ON p.id = c.pair_assignment_id
                                     WHERE p.assignment_id = a.id AND c.status = 'SUBMITTED') x
                           ), '[]'::jsonb),
                           'scoreOverrides', COALESCE((
                               SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at)
                               FROM (SELECT side, item_id, criterion_id, original_value,
                                            override_value, reason, created_by, created_at
                                     FROM score_override WHERE assignment_id = a.id) x
                           ), '[]'::jsonb)
                       ),
                       jsonb_build_object(
                           'computedScores', COALESCE((
                               SELECT jsonb_agg(to_jsonb(x) ORDER BY x.side, x.item_id, x.criterion_id)
                               FROM (SELECT criterion_id, side, item_id, comparison_count,
                                            quality_index, score_ratio, weighted_score, flags
                                     FROM computed_score
                                     WHERE assignment_id = a.id AND is_final = true
                                       AND computed_at = %s) x
                           ), '[]'::jsonb),
                           'scoreOverrides', COALESCE((
                               SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at)
                               FROM (SELECT side, item_id, criterion_id, original_value,
                                            override_value, reason, created_by, created_at
                                     FROM score_override WHERE assignment_id = a.id) x
                           ), '[]'::jsonb)
                       ),
                       %s
                FROM assignment a WHERE a.id = %s
                """,
                (snapshot_id, computed_at, computed_at, assignment_id),
            )
        return snapshot_id

    def participation(self, assignment_id: str, side: Side, evaluator_email: str) -> ParticipationCount:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT count(*) AS assigned,
                       count(*) FILTER (WHERE c.status = 'SUBMITTED') AS submitted
                FROM pair_assignment p
                JOIN app_user e ON e.id = p.evaluator_user_id
                LEFT JOIN comparison c ON c.pair_assignment_id = p.id
                WHERE p.assignment_id = %s AND p.side = %s AND e.email_normalized = %s
                """,
                (assignment_id, str(side), evaluator_email),
            )
            row = cur.fetchone()
            return ParticipationCount(assigned=row["assigned"], submitted=row["submitted"])

    def group_id_for_student(self, classroom_id: str, email_normalized: str) -> str | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT m.group_id
                FROM classroom_member m JOIN app_user u ON u.id = m.user_id
                WHERE m.classroom_id = %s AND u.email_normalized = %s AND m.role = 'STUDENT'
                """,
                (classroom_id, email_normalized),
            )
            row = cur.fetchone()
            return str(row["group_id"]) if row and row["group_id"] else None

    def items_for_side(self, classroom_id: str, side: Side) -> list[str]:
        """id ของทุก item ที่ต้องคำนวณคะแนนในฝั่งนี้ — กลุ่มทั้งหมดของห้อง หรือนักศึกษาทั้งหมด"""
        with self._conn.cursor() as cur:
            if side is Side.GROUP:
                cur.execute("SELECT id FROM group_entity WHERE classroom_id = %s", (classroom_id,))
            else:
                cur.execute(
                    "SELECT user_id AS id FROM classroom_member WHERE classroom_id = %s AND role = 'STUDENT'",
                    (classroom_id,),
                )
            return [str(r["id"]) for r in cur.fetchall()]

    # --- score override (US-13, FR-SCORE-08) ---

    def create_override(
        self,
        *,
        assignment_id: str,
        side: Side,
        item_id: str,
        criterion_id: str | None,
        original_value: Decimal,
        override_value: Decimal,
        reason: str,
        created_by_email: str,
        now: datetime,
    ) -> str:
        override_id = str(uuid.uuid4())
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO score_override
                    (id, assignment_id, side, item_id, criterion_id, original_value,
                     override_value, reason, created_by, created_at)
                SELECT %s, %s, %s, %s, %s, %s, %s, %s, u.id, %s
                FROM app_user u WHERE u.email_normalized = %s
                """,
                (
                    override_id, assignment_id, str(side), item_id, criterion_id,
                    original_value, override_value, reason, now, created_by_email,
                ),
            )
        return override_id

    def latest_override_value(
        self, assignment_id: str, side: Side, item_id: str, criterion_id: str | None
    ) -> Decimal | None:
        """ค่าที่ override ล่าสุดของ item/เกณฑ์นี้ — None ถ้าไม่เคยถูก override เลย

        `criterion_id IS NULL` หมายถึง override ทั้ง item รวม ไม่ใช่เกณฑ์เดียว
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT override_value FROM score_override
                WHERE assignment_id = %s AND side = %s AND item_id = %s
                  AND criterion_id IS NOT DISTINCT FROM %s
                ORDER BY created_at DESC LIMIT 1
                """,
                (assignment_id, str(side), item_id, criterion_id),
            )
            row = cur.fetchone()
            return Decimal(row["override_value"]) if row else None

    def effective_component_for_item(
        self, assignment_id: str, side: Side, item_id: str, *, is_final: bool
    ) -> Decimal:
        """คะแนนที่มีผลจริง: override ทั้ง item ชนะ override รายเกณฑ์ และค่าคำนวณตามลำดับ."""
        item_override = self.latest_override_value(assignment_id, side, item_id, None)
        if item_override is not None:
            return item_override
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(SUM(COALESCE((
                    SELECT so.override_value FROM score_override so
                    WHERE so.assignment_id = cs.assignment_id AND so.side = cs.side
                      AND so.item_id = cs.item_id AND so.criterion_id = cs.criterion_id
                    ORDER BY so.created_at DESC LIMIT 1
                ), cs.weighted_score)), 0) AS total
                FROM computed_score cs
                WHERE cs.assignment_id = %s AND cs.side = %s AND cs.item_id = %s
                  AND cs.is_final = %s
                  AND (NOT %s OR cs.computed_at = (
                      SELECT MAX(computed_at) FROM computed_score
                      WHERE assignment_id = %s AND is_final = true
                  ))
                """,
                (assignment_id, str(side), item_id, is_final, is_final, assignment_id),
            )
            return Decimal(cur.fetchone()["total"])

    def computed_value_for_target(
        self, assignment_id: str, side: Side, item_id: str, criterion_id: str | None,
        *, is_final: bool,
    ) -> Decimal | None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT SUM(weighted_score) AS value FROM computed_score
                WHERE assignment_id = %s AND side = %s AND item_id = %s AND is_final = %s
                  AND (%s::uuid IS NULL OR criterion_id = %s::uuid)
                  AND (NOT %s OR computed_at = (
                      SELECT MAX(computed_at) FROM computed_score
                      WHERE assignment_id = %s AND is_final = true
                  ))
                """,
                (assignment_id, str(side), item_id, is_final, criterion_id, criterion_id,
                 is_final, assignment_id),
            )
            row = cur.fetchone()
            return Decimal(row["value"]) if row and row["value"] is not None else None

    def list_computed_scores(self, assignment_id: str, *, is_final: bool) -> list["ComputedScoreRow"]:
        """สรุปคะแนนต่อ item (รวมทุกเกณฑ์แล้ว) — ให้อาจารย์เห็นก่อนตัดสินใจ finalize (US-13)

        AC ของ US-13 บังคับว่าคะแนนที่ยังไม่ finalize ต้องมี label "ชั่วคราว" กำกับทุกที่ที่แสดง
        endpoint ชั้นบนใช้ `is_final` ที่ query นี้รับมาเป็นตัวตัดสินว่าจะติด label นั้นไหม
        ไม่ query ชื่อผู้ประเมินเลย (join ไปแค่ group_entity/app_user เพื่อเอา "ชื่อของ item" —
        ไม่ใช่ตัวตนของคนที่ให้คะแนน) จึงไม่ผิด FR-ANON-01
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                WITH base AS (
                    SELECT cs.* FROM computed_score cs
                    WHERE cs.assignment_id = %s AND cs.is_final = %s
                      AND (NOT %s OR cs.computed_at = (
                          SELECT MAX(computed_at) FROM computed_score
                          WHERE assignment_id = %s AND is_final = true
                      ))
                )
                SELECT cs.item_id, cs.side,
                       COALESCE(g.name, u.display_name, u.email_normalized) AS item_label,
                       COALESCE((
                           SELECT so.override_value FROM score_override so
                           WHERE so.assignment_id = %s AND so.side = cs.side
                             AND so.item_id = cs.item_id AND so.criterion_id IS NULL
                           ORDER BY so.created_at DESC LIMIT 1
                       ), SUM(COALESCE((
                           SELECT so.override_value FROM score_override so
                           WHERE so.assignment_id = %s AND so.side = cs.side
                             AND so.item_id = cs.item_id AND so.criterion_id = cs.criterion_id
                           ORDER BY so.created_at DESC LIMIT 1
                       ), cs.weighted_score))) AS component,
                       array_agg(DISTINCT flag) FILTER (WHERE flag IS NOT NULL) AS flags
                FROM base cs
                LEFT JOIN group_entity g ON cs.side = 'GROUP' AND g.id = cs.item_id
                LEFT JOIN app_user u ON cs.side = 'INDIVIDUAL' AND u.id = cs.item_id
                LEFT JOIN LATERAL unnest(cs.flags) AS flag ON true
                GROUP BY cs.item_id, cs.side, g.name, u.display_name, u.email_normalized
                ORDER BY cs.side, item_label
                """,
                (assignment_id, is_final, is_final, assignment_id, assignment_id, assignment_id),
            )
            return [
                ComputedScoreRow(
                    item_id=str(r["item_id"]),
                    side=Side(r["side"]),
                    item_label=r["item_label"] or r["item_id"],
                    component=Decimal(r["component"]),
                    flags=tuple(r["flags"] or ()),
                )
                for r in cur.fetchall()
            ]

    def evaluator_count_for_item(
        self, assignment_id: str, side: Side, item_id: str, *, is_final: bool = False
    ) -> int:
        """จำนวนคนที่ submit คำตอบเกี่ยวกับ item นี้แล้ว — ใช้เช็ค k-anonymity (US-15)

        นับ **evaluator ที่ต่างกัน** ไม่ใช่จำนวน comparison เพราะ 1 คนตอบได้หลายคู่ที่มี
        item เดียวกันปรากฏซ้ำได้ (เช่น ประเมินหลายเกณฑ์) การนับ comparison ตรง ๆ จะได้ตัวเลข
        สูงเกินจริงเทียบกับ "มีกี่คนเห็นคำตอบของ item นี้บ้าง" ซึ่งเป็นสิ่งที่ k-anonymity สนใจจริง
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT count(DISTINCT c.evaluator_user_id) AS n
                FROM comparison c
                JOIN pair_assignment p ON p.id = c.pair_assignment_id
                WHERE p.assignment_id = %s AND p.side = %s
                  AND c.status = 'SUBMITTED'
                  AND (p.item_a_id = %s OR p.item_b_id = %s)
                """,
                (assignment_id, str(side), item_id, item_id),
            )
            return cur.fetchone()["n"]

    def export_comparisons(self, assignment_id: str) -> list[ComparisonExportRow]:
        """raw comparison ทั้งหมดที่ SUBMITTED แล้วของงานนี้ — FR-EXPORT-03

        เฉพาะ SUBMITTED เหมือน scoring engine (S2) — comparison ที่ยัง DRAFT ไม่เคยเข้า
        การคำนวณ export จึงไม่ควรมีข้อมูลที่ scoring engine ไม่เห็นเช่นกัน ไม่งั้นตัวเลขใน
        export กับคะแนนที่ประกาศจริงจะเทียบกันไม่ได้
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT p.side, cr.name AS criterion_name,
                       COALESCE(ga.name, ua.display_name, ua.email_normalized) AS item_a_label,
                       COALESCE(gb.name, ub.display_name, ub.email_normalized) AS item_b_label,
                       p.display_left_item_id, p.item_a_id, p.item_b_id,
                       c.choice, c.evaluator_user_id, c.submitted_at
                FROM comparison c
                JOIN pair_assignment p ON p.id = c.pair_assignment_id
                JOIN criterion cr ON cr.id = p.criterion_id
                LEFT JOIN group_entity ga ON p.side = 'GROUP' AND ga.id = p.item_a_id
                LEFT JOIN group_entity gb ON p.side = 'GROUP' AND gb.id = p.item_b_id
                LEFT JOIN app_user ua ON p.side = 'INDIVIDUAL' AND ua.id = p.item_a_id
                LEFT JOIN app_user ub ON p.side = 'INDIVIDUAL' AND ub.id = p.item_b_id
                WHERE p.assignment_id = %s AND c.status = 'SUBMITTED'
                ORDER BY p.side, cr.display_order, c.submitted_at
                """,
                (assignment_id,),
            )
            return [
                ComparisonExportRow(
                    side=Side(r["side"]),
                    criterion_name=r["criterion_name"],
                    item_a_label=r["item_a_label"] or str(r["item_a_id"]),
                    item_b_label=r["item_b_label"] or str(r["item_b_id"]),
                    display_left_item_id=str(r["display_left_item_id"]),
                    item_a_id=str(r["item_a_id"]),
                    item_b_id=str(r["item_b_id"]),
                    choice=r["choice"],
                    evaluator_user_id=str(r["evaluator_user_id"]),
                    submitted_at=r["submitted_at"],
                )
                for r in cur.fetchall()
            ]
