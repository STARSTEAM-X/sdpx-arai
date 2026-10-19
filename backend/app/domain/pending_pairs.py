"""Keep completed work while filling the revised per-evaluator workload after withdrawal."""
from collections import Counter

from app.domain.pairing import Pair


def pending_replacements(plan: list[Pair], completed: list[Pair]) -> list[Pair]:
    def key(pair: Pair) -> tuple[str, tuple[str, str]]:
        return pair.evaluator_user_id, tuple(sorted((pair.item_a_id, pair.item_b_id)))

    completed_keys = {key(pair) for pair in completed}
    quota = Counter(pair.evaluator_user_id for pair in plan)
    quota.subtract(Counter(pair.evaluator_user_id for pair in completed))
    result = []
    for pair in plan:
        if key(pair) not in completed_keys and quota[pair.evaluator_user_id] > 0:
            result.append(pair)
            quota[pair.evaluator_user_id] -= 1
    return result
