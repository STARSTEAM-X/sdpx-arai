from app.domain.pairing import Pair, Side
from app.domain.pending_pairs import pending_replacements


def pair(evaluator, a, b):
    return Pair(Side.GROUP, a, b, evaluator, a)


def test_completed_pair_is_preserved_even_when_reversed_in_new_plan():
    completed = [pair('student', 'B', 'A')]
    plan = [pair('student', 'A', 'B'), pair('student', 'A', 'C')]
    assert pending_replacements(plan, completed) == [pair('student', 'A', 'C')]


def test_existing_completed_work_reduces_quota_per_evaluator_without_removing_it():
    completed = [pair('one', 'A', 'B'), pair('one', 'A', 'C')]
    plan = [pair('one', 'B', 'C'), pair('two', 'A', 'B')]
    assert pending_replacements(plan, completed) == [pair('two', 'A', 'B')]
