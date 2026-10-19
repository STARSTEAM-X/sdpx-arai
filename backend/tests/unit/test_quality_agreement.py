"""QS-06 ลำเอียงให้เพื่อนร่วมกลุ่ม และ QS-07 ผู้ประเมินเห็นไม่ตรงกัน (Figma J28 / J28c)"""
from app.domain.quality import criterion_agreement, favoritism


def _row(a, b, choice, evaluator='e1', side='GROUP', left=None, status='SUBMITTED'):
    return {'item_a_id': a, 'item_b_id': b, 'display_left_item_id': left or a, 'choice': choice,
            'evaluator_user_id': evaluator, 'side': side, 'status': status}


def test_full_agreement_is_one_and_not_flagged():
    # 3 คู่ × ผู้ประเมิน 4 คน = เทียบได้ 3 × C(4,2) = 18 ครั้ง (ผ่านขั้นต่ำ 10)
    rows = [_row(a, b, 2, f'e{k}') for a, b in (('A', 'B'), ('A', 'C'), ('B', 'C')) for k in range(4)]
    result = criterion_agreement(rows)
    assert result['agreement'] == 1.0 and result['flags'] == []
    assert result['distribution'] == [0, 12, 0, 0, 0, 0]


def test_split_votes_flag_qs07():
    # ทุกคู่ 2 คนเลือก A 2 คนเลือก B → p = 2/6 → u = −0.33
    rows = []
    for a, b in (('A', 'B'), ('A', 'C'), ('B', 'C')):
        rows += [_row(a, b, 2, 'e1'), _row(a, b, 2, 'e2'), _row(a, b, 5, 'e3'), _row(a, b, 5, 'e4')]
    result = criterion_agreement(rows)
    assert result['agreement'] == -0.33 and result['flags'] == ['QS-07']


def test_winner_follows_display_side_not_item_order():
    # e2 เห็น B อยู่ซ้าย เลือกซ้าย = B ชนะ → ขัดกับ e1 ที่เลือก A
    # 10 คู่ × ผู้ประเมิน 2 คน = เทียบได้ 10 ครั้ง (ขั้นต่ำพอดี)
    rows = [_row('A', 'B', 2, 'e1'), _row('A', 'B', 2, 'e2', left='B')] * 10
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


def _gaps_rows(evaluators: int) -> list[dict]:
    """ผู้ประเมินแต่ละคนเทียบเพื่อน T กับ P หนึ่งครั้ง → ได้ส่วนต่าง 2 ค่าต่อคน (T และ P)"""
    return [_row('T', 'P', 2 if i == 0 else 5, f'e{i}', side='INDIVIDUAL') for i in range(evaluators)]


def test_favoritism_with_too_few_gaps_is_not_assessed_rather_than_not_found():
    # N-1: ส่วนต่าง 5 ค่า (หรือน้อยกว่า 10) ติดธง z > 2 ไม่ได้ทางคณิตศาสตร์ → ต้องเป็น "ยังตรวจไม่ได้"
    for evaluators in (2, 3, 4):
        assert favoritism(_gaps_rows(evaluators)) == {'assessed': False, 'flagged': {}}


def test_favoritism_needs_at_least_ten_gaps():
    assert favoritism(_gaps_rows(5))['assessed'] is True  # 5 คน × 2 ค่า = 10


def test_unsubmitted_rows_are_ignored_everywhere():
    # N-3: แถวที่ยังไม่ส่ง (choice เป็น None) ต้องไม่ทำให้ฟังก์ชันพัง และไม่ถูกนับ
    draft = _row('A', 'B', None, 'e9', status='DRAFT')
    rows = [_row(a, b, 2, f'e{k}') for a, b in (('A', 'B'), ('A', 'C'), ('B', 'C')) for k in range(3)]
    assert criterion_agreement(rows + [draft]) == criterion_agreement(rows)
    assert favoritism([dict(draft, side='INDIVIDUAL')]) == {'assessed': False, 'flagged': {}}


def test_qs07_three_rater_pairs_is_not_assessed():
    # รีวิวรอบ 2 ข้อ B: 3 คู่ผู้ประเมินเห็นต่างกันหมดก็ยังไม่ติดธง — ข้อมูลน้อยเกินจะสรุป
    rows = [_row(a, b, choice, f'e{choice}') for a, b in (('A', 'B'), ('A', 'C'), ('B', 'C')) for choice in (2, 5)]
    result = criterion_agreement(rows)
    assert result['agreement'] is None and result['flags'] == []


def test_qs07_ten_rater_pairs_can_flag():
    # คู่เดียว 5 คน เลือกซ้าย 3 ขวา 2 → C(5,2) = 10 คู่ผู้ประเมิน · ตรงกัน C(3,2)+C(2,2) = 4 → u = −0.2
    rows = [_row('A', 'B', choice, f'e{k}') for k, choice in enumerate((2, 2, 2, 5, 5))]
    result = criterion_agreement(rows)
    assert result['agreement'] == -0.2 and result['flags'] == ['QS-07']
