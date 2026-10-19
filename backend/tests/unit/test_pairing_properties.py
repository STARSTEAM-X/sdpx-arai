"""property-based test ของ Pairing Engine — NFR-MAINT-02 · PRD §18 "สุ่ม N, m, R แล้วตรวจ invariant" (GAP-13)

ต่างจาก `TestInvariantsAcrossManyShapes` ใน test_pairing.py ที่ใช้รูปทรงห้องที่คนเลือกไว้ 10 แบบ:
ชุดนี้ **สุ่ม** จำนวนกลุ่ม N, ขนาดกลุ่ม m และ coverage R ด้วย `random.Random(SEED)` ที่ seed คงที่
จึงยังรันซ้ำได้ผลเดิมเสมอ (ไม่ flaky) และไม่ต้องเพิ่ม dependency อย่าง hypothesis (AGENTS.md ข้อ 5)
ถ้าเจอรูปทรงที่ทำให้ invariant ล้ม ข้อความ assert จะบอกรูปทรงนั้นตรง ๆ ให้เอาไปเขียนเป็น test ถาวรได้

ชื่อ test อ้าง INV-1..INV-5 ตาม PRD §8.4 ตรง ๆ เพื่อ trace ได้จากตาราง §18
"""

import random
from collections import Counter
from functools import cache
from itertools import combinations

import pytest

from app.domain.pairing import (
    GroupInfo,
    Pair,
    generate_group_pairs,
    generate_individual_pairs,
    solve_group_feasibility,
)

SEED = 20261020
CASES = 30


def _random_groups(rng: random.Random) -> list[GroupInfo]:
    n = rng.randint(3, 40)
    groups, student = [], 0
    for index in range(n):
        members = []
        for _ in range(rng.randint(2, 8)):
            student += 1
            members.append(f"u{student:04d}")
        groups.append(GroupInfo(id=f"g{index + 1:02d}", name=f"กลุ่ม {index + 1}", member_ids=tuple(members)))
    return groups


def _group_cases() -> list[tuple[tuple[int, ...], int, int]]:
    """(ขนาดกลุ่ม, R, seed ของการจัดคู่) ที่สุ่มได้และ feasible — กรองเฉพาะที่ PRD ยอมให้ publish"""
    rng = random.Random(SEED)
    cases = []
    while len(cases) < CASES:
        groups = _random_groups(rng)
        r = rng.randint(1, 8)
        if solve_group_feasibility(groups, target_coverage=r).feasible:
            cases.append((tuple(len(g.member_ids) for g in groups), r, rng.randint(0, 10_000)))
    return cases


def _groups_of(sizes: tuple[int, ...]) -> list[GroupInfo]:
    groups, student = [], 0
    for index, size in enumerate(sizes):
        members = tuple(f"u{student + i + 1:04d}" for i in range(size))
        student += size
        groups.append(GroupInfo(id=f"g{index + 1:02d}", name=f"กลุ่ม {index + 1}", member_ids=members))
    return groups


@cache
def _group_pairs(sizes: tuple[int, ...], r: int, seed: int) -> tuple[list[GroupInfo], list[Pair]]:
    groups = _groups_of(sizes)
    f = solve_group_feasibility(groups, target_coverage=r)
    pairs = generate_group_pairs(
        groups, criterion_id="c1", coverage=f.achievable_coverage,
        workload=f.workload_per_evaluator, seed=seed,
    )
    return groups, pairs


GROUP_CASES = _group_cases()


@pytest.mark.parametrize(("sizes", "r", "seed"), GROUP_CASES)
class TestGroupSideInvariants:
    def test_INV_1_ไม่มีใครได้คู่ที่มีกลุ่มตัวเอง(self, sizes, r, seed):
        groups, pairs = _group_pairs(sizes, r, seed)
        own = {m: g.id for g in groups for m in g.member_ids}
        bad = [p for p in pairs if own[p.evaluator_user_id] in (p.item_a_id, p.item_b_id)]
        assert not bad, f"รูปทรง {sizes} R={r} seed={seed}: {bad[:3]}"

    def test_INV_2_ไม่มีคู่ซ้ำต่อผู้ประเมินในเกณฑ์เดียวกัน(self, sizes, r, seed):
        _, pairs = _group_pairs(sizes, r, seed)
        keys = Counter((p.evaluator_user_id, frozenset((p.item_a_id, p.item_b_id))) for p in pairs)
        assert max(keys.values()) == 1, f"รูปทรง {sizes} R={r} seed={seed}"

    def test_INV_3_coverage_ต่างกันไม่เกิน_1(self, sizes, r, seed):
        groups, pairs = _group_pairs(sizes, r, seed)
        coverage = Counter(frozenset((p.item_a_id, p.item_b_id)) for p in pairs)
        all_pairs = [frozenset((a.id, b.id)) for a, b in combinations(groups, 2)]
        values = [coverage.get(k, 0) for k in all_pairs]
        assert max(values) - min(values) <= 1, f"รูปทรง {sizes} R={r} seed={seed}: {min(values)}..{max(values)}"

    def test_INV_4_ภาระต่อผู้ประเมินต่างกันไม่เกิน_1(self, sizes, r, seed):
        groups, pairs = _group_pairs(sizes, r, seed)
        load = Counter(p.evaluator_user_id for p in pairs)
        values = [load.get(m, 0) for g in groups for m in g.member_ids]
        assert max(values) - min(values) <= 1, f"รูปทรง {sizes} R={r} seed={seed}: {min(values)}..{max(values)}"

    def test_INV_5_seed_เดิมได้ผลเดิม(self, sizes, r, seed):
        # _group_pairs ถูก cache ไว้ให้ INV-1..4 ใช้ร่วมกัน — ข้อนี้ต้องสร้างใหม่จริงด้วย __wrapped__
        assert _group_pairs.__wrapped__(sizes, r, seed)[1] == _group_pairs(sizes, r, seed)[1]


def _individual_cases() -> list[tuple[tuple[int, ...], int, int]]:
    rng = random.Random(SEED + 1)
    return [
        (tuple(rng.randint(3, 10) for _ in range(rng.randint(1, 12))), rng.randint(3, 30), rng.randint(0, 10_000))
        for _ in range(CASES)
    ]


@pytest.mark.parametrize(("sizes", "max_workload", "seed"), _individual_cases())
def test_INV_1_ถึง_5_ฝั่งรายบุคคล(sizes, max_workload, seed):
    groups = _groups_of(sizes)

    def run() -> list[Pair]:
        return generate_individual_pairs(groups, criterion_id="c1", seed=seed, max_workload=max_workload)

    pairs = run()
    where = f"รูปทรง {sizes} max_workload={max_workload} seed={seed}"
    group_of = {m: g for g in groups for m in g.member_ids}
    for p in pairs:
        # INV-1 — ไม่มีตัวเองอยู่ในคู่ และทั้งสองคนอยู่กลุ่มเดียวกับผู้ประเมิน
        assert p.evaluator_user_id not in (p.item_a_id, p.item_b_id), where
        g = group_of[p.evaluator_user_id]
        assert p.item_a_id in g.member_ids and p.item_b_id in g.member_ids, where
    # INV-2
    keys = Counter((p.evaluator_user_id, frozenset((p.item_a_id, p.item_b_id))) for p in pairs)
    assert not keys or max(keys.values()) == 1, where
    for g in groups:
        mine = [p for p in pairs if p.evaluator_user_id in g.member_ids]
        # INV-3 — ภายในกลุ่มเดียวกัน (คู่ข้ามกลุ่มไม่มีอยู่แล้วตาม INV-1)
        coverage = Counter(frozenset((p.item_a_id, p.item_b_id)) for p in mine)
        values = [coverage.get(frozenset(k), 0) for k in combinations(g.member_ids, 2)]
        assert max(values) - min(values) <= 1, f"{where} กลุ่ม {g.id}: coverage {min(values)}..{max(values)}"
        # INV-4 — ภาระของสมาชิกในกลุ่มเดียวกัน (ขนาดกลุ่มต่างกันมีภาระต่างกันได้ตาม §8.3)
        load = Counter(p.evaluator_user_id for p in mine)
        per_member = [load.get(m, 0) for m in g.member_ids]
        assert max(per_member) - min(per_member) <= 1, f"{where} กลุ่ม {g.id}: ภาระ {per_member}"
    # INV-5
    assert run() == pairs, where
