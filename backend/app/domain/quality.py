"""Observed signals inform a teacher; they never exclude answers automatically."""
import hashlib
import hmac
from collections import Counter, defaultdict


def evaluator_key(assignment_id: str, user_id: str, secret: str) -> str:
    return hmac.new(secret.encode(), f'quality:{assignment_id}:{user_id}'.encode(), hashlib.sha256).hexdigest()


def _submitted(rows: list[dict]) -> list[dict]:
    """DR-01: เฉพาะคำตอบที่ส่งแล้วและมีตัวเลือกเท่านั้นที่เข้าการคำนวณ — ทุกฟังก์ชันในโมดูลนี้กรองเอง ไม่ฝากไว้กับผู้เรียก"""
    return [row for row in rows if row.get('status') == 'SUBMITTED' and row.get('choice') is not None]


def signals(rows: list[dict]) -> dict:
    """สัญญาณรายผู้ประเมิน QS-02–05 — รับทุกแถวของผู้ประเมินคนเดียว (กรองที่ส่งแล้วเอง)"""
    submitted = _submitted(rows)
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


def _winner(row: dict) -> str:
    left = str(row['display_left_item_id'])
    a, b = str(row['item_a_id']), str(row['item_b_id'])
    return left if row['choice'] <= 3 else (b if left == a else a)


# QS-07 ต้องมีการเทียบคำตอบระหว่างผู้ประเมินสองคนในคู่เดียวกันอย่างน้อยเท่านี้ (Σ C(n,2)) จึงคำนวณ
# ถ้ามีแค่ 3 ครั้ง u รับค่าได้เพียง −1, −0.33, 0.33, 1 — ติดธงจากความบังเอิญได้ง่าย แล้ว FR-QS-03
# จะบอกให้อาจารย์ไปแก้เกณฑ์ที่อาจไม่มีอะไรผิด · ใช้ 10 เหตุผลเดียวกับ QS-06 · ต่ำกว่านี้ = "ยังตรวจไม่ได้"
AGREEMENT_MIN_RATER_PAIRS = 10
# PRD §10 ให้ "Kendall's W < 0.2" เป็นเกณฑ์ default แต่ u ไม่ใช่สเกลเดียวกับ W:
# u = 2p − 1 เมื่อ p คือสัดส่วนคู่ผู้ประเมินที่เลือกฝั่งเดียวกัน → u = 0 คือเห็นตรงกัน 50% เท่าการเดาสุ่ม
# u < 0.2 จึงแปลว่าเห็นตรงกันไม่ถึง 60% ของคู่ผู้ประเมิน (ดีกว่าสุ่มไม่ถึง 10 จุด) — คงเลข 0.2 ของ PRD ไว้
# ด้วยความหมายนี้ ยังไม่ได้ทำให้ตั้งค่าต่องานได้
AGREEMENT_THRESHOLD = 0.2


def criterion_agreement(rows: list[dict]) -> dict:
    """ความสอดคล้องของผู้ประเมินในเกณฑ์เดียว (PRD QS-07) และการกระจายคำตอบ 6 ระดับ (Figma J28c)

    PRD ระบุ Kendall's W ซึ่งต้องให้ทุกคนจัดอันดับครบทุกชิ้น แต่ระบบนี้แต่ละคนได้คู่ไม่ครบชุด
    จึงใช้ Kendall's u (coefficient of agreement for paired comparisons) ซึ่งเป็นค่าคู่กันของ W
    สำหรับข้อมูลเปรียบเทียบเป็นคู่: ต่อคู่ที่มี n คำตอบ (a เลือกชิ้นหนึ่ง n−a เลือกอีกชิ้น)
    นับคู่ผู้ประเมินที่เห็นตรงกัน C(a,2)+C(n−a,2) จากทั้งหมด C(n,2) แล้ว u = 2p − 1
    (1 = เห็นตรงกันทุกคู่ · ใกล้ 0 หรือติดลบ = แตกกันเหมือนสุ่ม)
    รับทุกแถวของเกณฑ์เดียว กรองเฉพาะที่ส่งแล้วเอง (DR-01) · การตัดคำตอบที่ผู้สอนยกเว้นเป็นหน้าที่ของผู้เรียก
    """
    distribution = [0] * 6
    votes: dict[tuple[str, str], Counter] = defaultdict(Counter)
    rows = _submitted(rows)
    for row in rows:
        distribution[row['choice'] - 1] += 1
        votes[tuple(sorted((str(row['item_a_id']), str(row['item_b_id']))))][_winner(row)] += 1
    agree = total = 0
    pairs = 0
    for counter in votes.values():
        n = sum(counter.values())
        if n < 2:
            continue
        pairs += 1
        total += n * (n - 1) // 2
        agree += sum(k * (k - 1) // 2 for k in counter.values())
    coefficient = round(2 * agree / total - 1, 2) if total >= AGREEMENT_MIN_RATER_PAIRS else None
    return {
        'distribution': distribution,
        'answerCount': len(rows),
        'pairsChecked': pairs,
        'agreement': coefficient,
        'flags': ['QS-07'] if coefficient is not None and coefficient < AGREEMENT_THRESHOLD else [],
    }


FAVORITISM_Z = 2.0
# z คิดด้วย population SD จึงมีเพดาน max z = √(N−1): N=5 ได้สูงสุด 2.0 พอดี ติดธง z > 2 ไม่ได้เลย
# ขั้นต่ำทางคณิตศาสตร์คือ 6 แต่ z-test บน 6 จุดยังอ่อนเกินไป จึงใช้ 10 (เพดาน z = 3)
# ต่ำกว่านี้ต้องรายงานว่า "ยังตรวจไม่ได้" ไม่ใช่ "ไม่พบ" (PRD §8.2 ห้ามพังเงียบ)
FAVORITISM_MIN_SAMPLES = 10


def favoritism(rows: list[dict]) -> dict:
    """ลำเอียงให้เพื่อนร่วมกลุ่ม (PRD QS-06) — ฝั่งรายบุคคลเปรียบเทียบเพื่อนในกลุ่มเดียวกัน

    ต่อผู้ประเมิน e และเพื่อน t: อัตราที่ e ให้ t ชนะ เทียบกับอัตราที่คนอื่นให้ t ชนะ
    ส่วนต่างที่เป็น z > 2 (เทียบส่วนต่างของทุกคู่ e–t ในงาน) = ให้ t สูงผิดปกติ
    ใช้ได้เมื่อ t ถูกคนอื่นประเมินด้วย (กลุ่ม 3 คนแต่ละคนเทียบเพื่อนได้ครั้งเดียวต่อเกณฑ์)
    และมีส่วนต่างให้เทียบอย่างน้อย FAVORITISM_MIN_SAMPLES ค่า ไม่งั้นถือว่ายังตรวจไม่ได้
    รับทุกแถวของงาน กรองเฉพาะที่ส่งแล้วเอง (DR-01) · การตัดคำตอบของผู้สอน/ที่ถูกยกเว้นเป็นหน้าที่ของผู้เรียก
    คืน {'assessed': bool, 'flagged': {evaluator_user_id: ส่วนต่างสูงสุดเป็น % }}
    """
    stats: dict[tuple[str, str], list[int]] = defaultdict(lambda: [0, 0])  # (evaluator, target) → [wins, n]
    for row in _submitted(rows):
        if str(row['side']) != 'INDIVIDUAL':
            continue
        winner = _winner(row)
        for target in (str(row['item_a_id']), str(row['item_b_id'])):
            entry = stats[(str(row['evaluator_user_id']), target)]
            entry[0] += winner == target
            entry[1] += 1
    by_target: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for (_, target), (wins, n) in stats.items():
        by_target[target][0] += wins
        by_target[target][1] += n
    gaps = []
    for (evaluator, target), (wins, n) in stats.items():
        other_wins, other_n = by_target[target][0] - wins, by_target[target][1] - n
        if n >= 1 and other_n >= 1:
            gaps.append((evaluator, wins / n - other_wins / other_n))
    if len(gaps) < FAVORITISM_MIN_SAMPLES:
        return {'assessed': False, 'flagged': {}}
    mean = sum(gap for _, gap in gaps) / len(gaps)
    sd = (sum((gap - mean) ** 2 for _, gap in gaps) / len(gaps)) ** 0.5
    flagged: dict[str, int] = {}
    for evaluator, gap in gaps:
        if sd > 0 and gap > 0 and (gap - mean) / sd > FAVORITISM_Z:
            flagged[evaluator] = max(flagged.get(evaluator, 0), round(gap * 100))
    return {'assessed': True, 'flagged': flagged}
