from app.domain.quality import evaluator_key, signals


def answer(a, b, choice=1, time=6000, criterion='one', left=None):
    return {'status': 'SUBMITTED', 'choice': choice, 'time_on_task_ms': time, 'criterion_id': criterion,
            'item_a_id': a, 'item_b_id': b, 'display_left_item_id': left or a}


def test_cycles_use_display_orientation_and_do_not_mix_criteria():
    rows = [answer('A', 'B'), answer('B', 'C'), answer('A', 'C', choice=6)]
    result = signals(rows)
    assert result['checkedTriples'] == 1 and result['cycles'] == 1
    assert 'QS-04' in result['flags']
    rows[-1]['criterion_id'] = 'other'
    assert signals(rows)['checkedTriples'] == 0


def test_low_time_and_bias_are_observations_not_exclusion_or_score_changes():
    result = signals([answer('A', 'B', time=1000) for _ in range(5)])
    assert set(result['flags']) == {'QS-02', 'QS-03', 'QS-05'}
    assert 'excluded' not in result and 'score' not in result


def test_missing_timing_is_not_zero_and_drafts_do_not_count_as_answers():
    draft = answer('A', 'B')
    draft['status'] = 'DRAFT'
    result = signals([answer('A', 'B', time=None), draft])
    assert result['submittedCount'] == 1
    assert result['meanTimeMs'] is None
    assert 'QS-05' in result['unassessed']


def test_reviewer_keys_are_assignment_specific_and_require_the_private_secret():
    first = evaluator_key('assignment', 'person', 'unit-test-key')
    assert first != evaluator_key('other', 'person', 'unit-test-key')
    assert first != evaluator_key('assignment', 'person', 'different-test-key')
