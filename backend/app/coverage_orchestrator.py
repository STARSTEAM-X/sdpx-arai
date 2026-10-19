"""Pair-level coverage and eligible counts; no mock counts or inferred extra evaluators."""
from collections import Counter, defaultdict
from itertools import combinations

from psycopg import Connection

from app.domain.assignment_service import Assignment
from app.domain.extra_pairs import eligible_evaluators
from app.domain.pairing import Side
from app.domain.scoring_service import item_point
from app.repositories.pg_assignment_repo import PgAssignmentRepository


def available_evaluators(groups, rows, criterion, a, b, maximum: int) -> list[str]:
    eligible = eligible_evaluators(groups, criterion.side, a, b)
    assigned = {str(row['evaluator_user_id']) for row in rows if str(row['criterion_id']) == criterion.id
                and {str(row['item_a_id']), str(row['item_b_id'])} == {a, b}}
    workloads = Counter(str(row['evaluator_user_id']) for row in rows if str(row['criterion_id']) == criterion.id)
    return sorted(user_id for user_id in eligible - assigned if workloads[user_id] < maximum)


def coverage_rows(conn: Connection, assignment: Assignment, rows: list[dict], labels: dict[str, str]) -> list[dict]:
    repo = PgAssignmentRepository(conn)
    groups = repo.groups_with_members(assignment.classroom_id)
    artifacts = repo.artifacts(assignment.id)
    pairs = defaultdict(list)
    workloads = Counter((str(row['criterion_id']), str(row['evaluator_user_id'])) for row in rows)
    for row in rows:
        pairs[(str(row['criterion_id']), *sorted((str(row['item_a_id']), str(row['item_b_id']))))].append(row)
    result = []
    for criterion in assignment.criteria:
        candidates = combinations([group.id for group in groups], 2) if criterion.side is Side.GROUP else (
            pair for group in groups for pair in combinations(group.member_ids, 2))
        for a, b in candidates:
            a, b = sorted((a, b))
            assigned = pairs[(criterion.id, a, b)]
            submitted = sum(row['status'] == 'SUBMITTED' and not row['excluded'] for row in assigned)
            # J28: แยกผลที่อาจารย์ประเมินเอง และคู่ที่ส่งให้คนอื่นแล้วยังรอคำตอบ ("รอผล")
            instructor = sum(row['status'] == 'SUBMITTED' and row.get('by_instructor', False) for row in assigned)
            pending = sum(row['status'] != 'SUBMITTED' and not row['excluded'] for row in assigned)
            # J26 "ผลเฉลี่ย" — คะแนนเฉลี่ยที่ฝั่งแรกของคู่ได้ (0–1) จากคำตอบที่นับเข้าคะแนน
            points = [item_point(row['choice'], shown_left=str(row['display_left_item_id']) == a) for row in assigned
                      if row['status'] == 'SUBMITTED' and not row['excluded'] and row['choice'] is not None]
            mean = float(sum(points) / len(points)) if points else None
            expected = assignment.target_coverage if criterion.side is Side.GROUP else max(1, len(eligible_evaluators(groups, criterion.side, a, b)))
            already_assigned = {str(row['evaluator_user_id']) for row in assigned}
            eligible = eligible_evaluators(groups, criterion.side, a, b) - already_assigned
            result.append({'criterionId': criterion.id, 'criterionName': criterion.name, 'side': str(criterion.side),
                'itemAId': a, 'itemBId': b, 'itemALabel': labels.get(a, a), 'itemBLabel': labels.get(b, b),
                'artifactAUrl': artifacts.get(a), 'artifactBUrl': artifacts.get(b),
                'assignedCount': len(assigned), 'submittedCount': submitted, 'expectedCount': expected,
                'instructorCount': instructor, 'pendingCount': pending, 'meanScoreA': mean,
                'eligibleCount': sum(workloads[(criterion.id, user_id)] < assignment.max_workload for user_id in eligible)})
    return result
