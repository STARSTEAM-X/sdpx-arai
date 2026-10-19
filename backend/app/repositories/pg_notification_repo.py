"""In-app events projected from real assignment transitions; no scores in the payload."""
from psycopg import Connection


class PgNotificationRepository:
    def __init__(self, conn: Connection):
        self._conn = conn

    def list_for_user(self, email: str) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.id AS assignment_id, a.classroom_id, a.name AS assignment_name,
                       c.name AS classroom_name, e.kind, e.occurred_at,
                       key.event_key, nr.read_at
                FROM assignment a JOIN classroom c ON c.id = a.classroom_id
                JOIN classroom_member m ON m.classroom_id = c.id AND m.role = 'STUDENT' AND m.enrollment_status = 'ACTIVE'
                JOIN app_user u ON u.id = m.user_id
                JOIN LATERAL (VALUES
                    (CASE WHEN a.generation > 1 THEN 'regenerated' ELSE 'published' END, GREATEST(COALESCE(a.published_at, a.created_at), a.opens_at_utc)),
                    ('finalized', a.finalized_at)
                ) e(kind, occurred_at) ON e.occurred_at IS NOT NULL AND e.occurred_at <= now()
                CROSS JOIN LATERAL (SELECT a.id::text || ':' || e.kind || ':' ||
                    EXTRACT(EPOCH FROM e.occurred_at)::text AS event_key) key
                LEFT JOIN notification_read nr ON nr.user_id = u.id AND nr.event_key = key.event_key
                WHERE u.email_normalized = %s AND a.status NOT IN ('DRAFT', 'ARCHIVED')
                  AND (e.kind != 'finalized' OR a.status = 'FINALIZED')
                ORDER BY e.occurred_at DESC LIMIT 100
                """,
                (email,),
            )
            events = list(cur.fetchall())
            cur.execute(
                "SELECT a.id AS assignment_id, a.classroom_id, a.name AS assignment_name, "
                "c.name AS classroom_name, 'appeal' AS kind, p.resolved_at AS occurred_at, "
                "key.event_key, nr.read_at "
                "FROM appeal p JOIN assignment a ON a.id = p.assignment_id "
                "JOIN classroom c ON c.id = a.classroom_id "
                "JOIN classroom_member m ON m.classroom_id = c.id AND m.user_id = p.student_user_id AND m.enrollment_status = 'ACTIVE' "
                "JOIN app_user u ON u.id = p.student_user_id "
                "CROSS JOIN LATERAL (SELECT p.id::text || ':resolved' AS event_key) key "
                "LEFT JOIN notification_read nr ON nr.user_id = u.id AND nr.event_key = key.event_key "
                "WHERE u.email_normalized = %s AND p.resolved_at IS NOT NULL",
                (email,),
            )
            events.extend(cur.fetchall())
            cur.execute(
                "SELECT a.id AS assignment_id, a.classroom_id, a.name AS assignment_name, "
                "c.name AS classroom_name, 'assigned' AS kind, "
                "GREATEST(MIN(p.created_at), a.opens_at_utc) AS occurred_at, "
                "key.event_key, nr.read_at, count(*) AS new_count "
                "FROM assignment a JOIN classroom c ON c.id = a.classroom_id "
                "JOIN pair_assignment p ON p.assignment_id = a.id AND p.retired_at IS NULL AND p.generation > 1 "
                "JOIN app_user u ON u.id = p.evaluator_user_id "
                "JOIN classroom_member m ON m.classroom_id = c.id AND m.user_id = u.id "
                "AND m.role = 'STUDENT' AND m.enrollment_status = 'ACTIVE' "
                "CROSS JOIN LATERAL (SELECT a.id::text || ':assigned:' || p.generation::text AS event_key) key "
                "LEFT JOIN notification_read nr ON nr.user_id = u.id AND nr.event_key = key.event_key "
                "WHERE u.email_normalized = %s AND a.status NOT IN ('DRAFT', 'ARCHIVED') "
                "AND (a.opens_at_utc IS NULL OR a.opens_at_utc <= now()) "
                "GROUP BY a.id, c.id, key.event_key, nr.read_at",
                (email,),
            )
            events.extend(cur.fetchall())
            cur.execute(
                "SELECT a.id AS assignment_id, a.classroom_id, a.name AS assignment_name, "
                "c.name AS classroom_name, 'due' AS kind, "
                "GREATEST(COALESCE(a.published_at, a.created_at), d.deadline - interval '48 hours') AS occurred_at, "
                "key.event_key, nr.read_at, progress.remaining "
                "FROM assignment a JOIN classroom c ON c.id = a.classroom_id AND c.status = 'ACTIVE' "
                "JOIN classroom_member m ON m.classroom_id = c.id AND m.role = 'STUDENT' AND m.enrollment_status = 'ACTIVE' "
                "JOIN app_user u ON u.id = m.user_id "
                "JOIN LATERAL (VALUES ('GROUP', a.group_deadline_utc), ('INDIVIDUAL', a.individual_deadline_utc)) "
                "d(side, deadline) ON d.deadline > now() AND d.deadline <= now() + interval '48 hours' "
                "CROSS JOIN LATERAL (SELECT count(*) AS remaining FROM pair_assignment p "
                "LEFT JOIN comparison r ON r.pair_assignment_id = p.id "
                "WHERE p.retired_at IS NULL AND p.assignment_id = a.id AND p.evaluator_user_id = u.id AND p.side = d.side "
                "AND (r.status IS NULL OR r.status != 'SUBMITTED')) progress "
                "CROSS JOIN LATERAL (SELECT a.id::text || ':due:' || d.side || ':' || "
                "EXTRACT(EPOCH FROM d.deadline)::text AS event_key) key "
                "LEFT JOIN notification_read nr ON nr.user_id = u.id AND nr.event_key = key.event_key "
                "WHERE u.email_normalized = %s AND a.status IN ('PUBLISHED', 'OPEN') AND progress.remaining > 0 "
                "AND (a.opens_at_utc IS NULL OR a.opens_at_utc <= now())",
                (email,),
            )
            events.extend(cur.fetchall())
            return sorted(events, key=lambda event: event["occurred_at"], reverse=True)[:100]

    def mark_read(self, email: str, event_key: str) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                "INSERT INTO notification_read (user_id, event_key) "
                "SELECT id, %s FROM app_user WHERE email_normalized = %s "
                "ON CONFLICT (user_id, event_key) DO NOTHING",
                (event_key, email),
            )
