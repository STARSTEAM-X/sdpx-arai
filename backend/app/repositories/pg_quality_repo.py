"""Quality inputs have evaluator IDs internally; the API exposes only signed review keys."""
from psycopg import Connection


class PgQualityRepository:
    def __init__(self, conn: Connection):
        self._conn = conn

    def rows(self, assignment_id: str) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute('''
                SELECT p.id, p.side, p.criterion_id, p.item_a_id, p.item_b_id,
                       p.display_left_item_id, p.evaluator_user_id, c.choice, c.status,
                       c.time_on_task_ms, COALESCE(x.excluded, false) AS excluded,
                       r.reviewed_at,
                       EXISTS (SELECT 1 FROM classroom_member m WHERE m.classroom_id = a.classroom_id
                         AND m.user_id = p.evaluator_user_id AND m.role <> 'STUDENT') AS by_instructor
                FROM pair_assignment p JOIN assignment a ON a.id = p.assignment_id
                LEFT JOIN comparison c ON c.pair_assignment_id = p.id
                LEFT JOIN assignment_exclusion x ON x.assignment_id = p.assignment_id
                  AND x.evaluator_user_id = p.evaluator_user_id
                LEFT JOIN quality_review r ON r.assignment_id = p.assignment_id
                  AND r.evaluator_user_id = p.evaluator_user_id
                WHERE p.assignment_id = %s AND p.retired_at IS NULL
                ORDER BY p.criterion_id, p.id
                ''', (assignment_id,))
            return list(cur.fetchall())

    def earlier_criteria(self, assignment_id: str, side, name: str, *, limit: int = 5) -> list[tuple[str, str]]:
        """FR-QS-03 — (assignment_id, criterion_id) ของเกณฑ์เดียวกันในงานที่เผยแพร่ก่อนงานนี้ ใหม่ → เก่า

        "เกณฑ์เดียวกัน" = ฝั่งเดียวกันและชื่อเดียวกันโดยไม่สนตัวพิมพ์/ช่องว่างหัวท้าย เพราะผู้สอนมักคัดลอกงาน
        แล้วใช้ชื่อเกณฑ์เดิม · จำกัดในห้องเรียนเดียวกัน ไม่ข้ามไปห้องของคนอื่น
        """
        with self._conn.cursor() as cur:
            cur.execute('''
                SELECT a.id AS assignment_id, c.id AS criterion_id
                FROM assignment cur
                JOIN assignment a ON a.classroom_id = cur.classroom_id AND a.id <> cur.id
                JOIN criterion c ON c.assignment_id = a.id AND c.retired_at IS NULL
                  AND c.side = %s AND lower(btrim(c.name)) = lower(btrim(%s))
                WHERE cur.id = %s AND a.published_at IS NOT NULL AND a.status NOT IN ('DRAFT', 'ARCHIVED')
                  AND (cur.published_at IS NULL OR a.published_at < cur.published_at)
                ORDER BY a.published_at DESC
                LIMIT %s
                ''', (str(side), name, assignment_id, limit))
            return [(str(row['assignment_id']), str(row['criterion_id'])) for row in cur.fetchall()]

    def mark_reviewed(self, assignment_id: str, evaluator_user_id: str, reviewer_email: str):
        """บันทึกว่าผู้สอนเปิดดูคำตอบแล้ว — ครั้งแรกเท่านั้นที่นับ เพื่อให้เวลาที่แสดงคือตอนตรวจจริง"""
        with self._conn.cursor() as cur:
            cur.execute('''
                INSERT INTO quality_review (assignment_id, evaluator_user_id, reviewed_by)
                SELECT %s, %s, u.id FROM app_user u WHERE u.email_normalized = %s
                ON CONFLICT (assignment_id, evaluator_user_id) DO NOTHING
                ''', (assignment_id, evaluator_user_id, reviewer_email))
            cur.execute('SELECT reviewed_at FROM quality_review WHERE assignment_id = %s AND evaluator_user_id = %s',
                        (assignment_id, evaluator_user_id))
            return cur.fetchone()['reviewed_at']

    def labels(self, classroom_id: str) -> dict[str, str]:
        with self._conn.cursor() as cur:
            cur.execute('''
                SELECT g.id, g.name AS label FROM group_entity g WHERE g.classroom_id = %s
                  AND EXISTS (SELECT 1 FROM classroom_member m WHERE m.group_id = g.id
                    AND m.role = 'STUDENT' AND m.enrollment_status = 'ACTIVE')
                UNION ALL
                SELECT u.id, COALESCE(u.display_name, u.email_normalized) AS label
                FROM classroom_member m JOIN app_user u ON u.id = m.user_id
                WHERE m.classroom_id = %s AND m.role = 'STUDENT' AND m.enrollment_status = 'ACTIVE'
                ''', (classroom_id, classroom_id))
            return {str(row['id']): row['label'] for row in cur.fetchall()}
