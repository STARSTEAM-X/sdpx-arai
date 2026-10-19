"""Repair pending assignments after an enrollment change, preserving completed work."""
from collections import defaultdict
from datetime import datetime

from psycopg import Connection

from app.domain.errors import ValidationError
from app.domain.pairing import Pair, Side
from app.domain.pending_pairs import pending_replacements
from app.domain.publication import generate_assignment_pairs
from app.repositories.pg_assignment_repo import PgAssignmentRepository
from app.scoring_orchestrator import run_recompute


def repair_pending(conn: Connection, classroom_id: str, now: datetime) -> list[dict]:
    repo = PgAssignmentRepository(conn)
    result = []
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM assignment WHERE classroom_id = %s AND status IN ('PUBLISHED','OPEN','CLOSED') ORDER BY id FOR UPDATE", (classroom_id,))
        ids = [str(row['id']) for row in cur.fetchall()]
        for assignment_id in ids:
            assignment = repo.get(assignment_id)
            # Retire comparisons involving withdrawn people or groups with no active students.
            cur.execute("""
                UPDATE pair_assignment p SET retired_at = %s
                WHERE p.assignment_id = %s AND p.retired_at IS NULL AND (
                  NOT EXISTS (SELECT 1 FROM classroom_member m WHERE m.classroom_id = %s
                    AND m.user_id = p.evaluator_user_id AND m.enrollment_status = 'ACTIVE')
                  OR (p.side = 'INDIVIDUAL' AND (
                    NOT EXISTS (SELECT 1 FROM classroom_member m WHERE m.classroom_id = %s
                      AND m.user_id = p.item_a_id AND m.role = 'STUDENT' AND m.enrollment_status = 'ACTIVE')
                    OR NOT EXISTS (SELECT 1 FROM classroom_member m WHERE m.classroom_id = %s
                      AND m.user_id = p.item_b_id AND m.role = 'STUDENT' AND m.enrollment_status = 'ACTIVE')))
                  OR (p.side = 'GROUP' AND (
                    NOT EXISTS (SELECT 1 FROM classroom_member m WHERE m.group_id = p.item_a_id
                      AND m.role = 'STUDENT' AND m.enrollment_status = 'ACTIVE')
                    OR NOT EXISTS (SELECT 1 FROM classroom_member m WHERE m.group_id = p.item_b_id
                      AND m.role = 'STUDENT' AND m.enrollment_status = 'ACTIVE'))))
                """, (now, assignment_id, classroom_id, classroom_id, classroom_id))
            cur.execute("SELECT p.* FROM pair_assignment p JOIN comparison c ON c.pair_assignment_id = p.id WHERE p.assignment_id = %s AND p.retired_at IS NULL AND c.status = 'SUBMITTED'", (assignment_id,))
            completed = defaultdict(list)
            for row in cur.fetchall():
                completed[str(row['criterion_id'])].append(Pair(Side(row['side']), str(row['item_a_id']), str(row['item_b_id']), str(row['evaluator_user_id']), str(row['display_left_item_id'])))
            cur.execute("UPDATE pair_assignment p SET retired_at = %s WHERE p.assignment_id = %s AND p.retired_at IS NULL AND NOT EXISTS (SELECT 1 FROM comparison c WHERE c.pair_assignment_id = p.id AND c.status = 'SUBMITTED')", (now, assignment_id))
            cur.execute('UPDATE assignment SET generation = generation + 1, published_at = %s WHERE id = %s RETURNING generation', (now, assignment_id))
            generation = cur.fetchone()['generation']
            warnings = []
            added = 0
            try:
                plans = list(generate_assignment_pairs(assignment, repo.groups_with_members(classroom_id), seed=(assignment.pairing_seed or 0) + generation))
            except ValidationError as error:
                # Withdrawal still takes effect; insufficient coverage is shown explicitly.
                plans = []
                warnings.append(error.message)
            for criterion, plan in plans:
                pending = pending_replacements(plan, completed[criterion.id])
                repo.append_pairs(assignment_id, pending, criterion_id=criterion.id)
                added += len(pending)
            cur.execute('DELETE FROM computed_score WHERE assignment_id = %s AND is_final = false', (assignment_id,))
            run_recompute(conn, assignment, is_final=False, now=now)
            result.append({'assignmentId': assignment_id, 'generation': generation, 'pairsAdded': added, 'warnings': warnings})
    return result
