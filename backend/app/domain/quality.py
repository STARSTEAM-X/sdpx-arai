"""Observed signals inform a teacher; they never exclude answers automatically."""
import hashlib
import hmac
from collections import Counter, defaultdict


def evaluator_key(assignment_id: str, user_id: str, secret: str) -> str:
    return hmac.new(secret.encode(), f'quality:{assignment_id}:{user_id}'.encode(), hashlib.sha256).hexdigest()


def signals(rows: list[dict]) -> dict:
    submitted = [row for row in rows if row['status'] == 'SUBMITTED' and row['choice'] is not None]
    flags = []
    unassessed = ['QS-06', 'QS-07']
    if submitted:
        if max(Counter(row['choice'] for row in submitted).values()) / len(submitted) > 0.8:
            flags.append('QS-02')
        left = sum(row['choice'] <= 3 for row in submitted)
        if max(left, len(submitted) - left) / len(submitted) > 0.8:
            flags.append('QS-03')
    else:
        unassessed.extend(['QS-02', 'QS-03'])
    times = [row['time_on_task_ms'] for row in submitted if row['time_on_task_ms'] is not None]
    mean_ms = sum(times) / len(times) if times else None
    if mean_ms is not None and mean_ms < 3000:
        flags.append('QS-05')
    if not times:
        unassessed.append('QS-05')
    by_criterion = defaultdict(list)
    for row in submitted:
        by_criterion[str(row['criterion_id'])].append(row)
    triples = cycles = 0
    for answers in by_criterion.values():
        edges = {}
        neighbors = defaultdict(set)
        for row in answers:
            a, b, left_id = str(row['item_a_id']), str(row['item_b_id']), str(row['display_left_item_id'])
            right_id = b if left_id == a else a
            edges[tuple(sorted((a, b)))] = left_id if row['choice'] <= 3 else right_id
            neighbors[a].add(b)
            neighbors[b].add(a)
        for a in sorted(neighbors):
            for b in sorted(node for node in neighbors[a] if node > a):
                for c in (node for node in neighbors[a] & neighbors[b] if node > b):
                    triples += 1
                    if len({edges[tuple(sorted(pair))] for pair in ((a, b), (b, c), (a, c))}) == 3:
                        cycles += 1
    if triples and cycles / triples > 0.2:
        flags.append('QS-04')
    if not triples:
        unassessed.append('QS-04')
    return {'assignedCount': len(rows), 'submittedCount': len(submitted), 'flags': flags,
            'meanTimeMs': mean_ms, 'timedCount': len(times), 'checkedTriples': triples,
            'cycles': cycles, 'unassessed': unassessed}
