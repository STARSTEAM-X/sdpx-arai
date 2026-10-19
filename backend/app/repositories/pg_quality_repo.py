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
                       c.time_on_task_ms, COALESCE(x.excluded, false) AS excluded
                FROM pair_assignment p LEFT JOIN comparison c ON c.pair_assignment_id = p.id
                LEFT JOIN assignment_exclusion x ON x.assignment_id = p.assignment_id
                  AND x.evaluator_user_id = p.evaluator_user_id
                WHERE p.assignment_id = %s AND p.retired_at IS NULL
                ORDER BY p.criterion_id, p.id
                ''', (assignment_id,))
            return list(cur.fetchall())

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
