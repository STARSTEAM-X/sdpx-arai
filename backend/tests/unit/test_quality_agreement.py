"""QS-06 ลำเอียงให้เพื่อนร่วมกลุ่ม และ QS-07 ผู้ประเมินเห็นไม่ตรงกัน (Figma J28 / J28c)"""
from app.domain.quality import criterion_agreement, favoritism


def _row(a, b, choice, evaluator='e1', side='GROUP', left=None):
    return {'item_a_id': a, 'item_b_id': b, 'display_left_item_id': left or a, 'choice': choice,
            'evaluator_user_id': evaluator, 'side': side}


def test_full_agreement_is_one_and_not_flagged():
    rows = [_row(a, b, 2, f'e{k}') for a, b in (('A', 'B'), ('A', 'C'), ('B', 'C')) for k in range(3)]
    result = criterion_agreement(rows)
    assert result['agreement'] == 1.0 and result['flags'] == []
    assert result['distribution'] == [0, 9, 0, 0, 0, 0]


def test_split_votes_flag_qs07():
    # ทุกคู่ 2 คนเลือก A 2 คนเลือก B → p = 2/6 → u = −0.33
    rows = []
    for a, b in (('A', 'B'), ('A', 'C'), ('B', 'C')):
        rows += [_row(a, b, 2, 'e1'), _row(a, b, 2, 'e2'), _row(a, b, 5, 'e3'), _row(a, b, 5, 'e4')]
    result = criterion_agreement(rows)
    assert result['agreement'] == -0.33 and result['flags'] == ['QS-07']


def test_winner_follows_display_side_not_item_order():
    # e2 เห็น B อยู่ซ้าย เลือกซ้าย = B ชนะ → ขัดกับ e1 ที่เลือก A
    rows = [_row('A', 'B', 2, 'e1'), _row('A', 'B', 2, 'e2', left='B')] * 3
    rows = [dict(r, item_a_id=f"{r['item_a_id']}{i // 2}", item_b_id=f"{r['item_b_id']}{i // 2}",
                 display_left_item_id=f"{r['display_left_item_id']}{i // 2}") for i, r in enumerate(rows)]
    assert criterion_agreement(rows)['agreement'] == -1.0


def test_too_few_repeated_pairs_is_not_assessed():
    rows = [_row('A', 'B', 2, 'e1'), _row('A', 'B', 5, 'e2'), _row('A', 'C', 2, 'e1')]
    result = criterion_agreement(rows)
    assert result['agreement'] is None and result['flags'] == []


def test_favoritism_flags_evaluator_who_always_picks_one_peer():
    rows = []
    # ผู้ประเมิน 10 คนตอบกลาง ๆ (ชนะสลับกัน) ยกเว้น e1 ที่ให้ T ชนะทุกครั้ง
    peers = ['T', 'P2', 'P3', 'P4', 'P5']
    for i, evaluator in enumerate(f'e{n}' for n in range(1, 11)):
        for j, other in enumerate(p for p in peers if p != 'T'):
            for k in range(2):
                if evaluator == 'e1':
                    choice = 2  # T อยู่ซ้าย เลือกซ้ายเสมอ
                else:
                    choice = 2 if (i + j + k) % 2 else 5
                rows.append(_row('T', other, choice, evaluator, side='INDIVIDUAL'))
    result = favoritism(rows)
    assert result['assessed'] is True
    assert set(result['flagged']) == {'e1'}


def test_favoritism_even_answers_are_not_flagged():
    rows = [_row('T', other, 2 if (i + j) % 2 else 5, f'e{i}', side='INDIVIDUAL')
            for i in range(6) for j, other in enumerate(['P2', 'P3', 'P4', 'P5'] * 2)]
    result = favoritism(rows)
    assert result['assessed'] is True and result['flagged'] == {}


def test_favoritism_without_individual_side_is_not_assessed():
    assert favoritism([_row('A', 'B', 2)]) == {'assessed': False, 'flagged': {}}
