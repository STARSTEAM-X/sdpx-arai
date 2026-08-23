"""unit test ของ Pairing Engine — อ้าง US-05, US-06

ตารางกฎ P1–P10 อยู่ใน `memory-bank/units/pairing-engine/unit-brief.md`
ทุกข้อมี test ของตัวเองที่นี่ ชื่อ test ขึ้นต้นด้วยรหัสกฎเพื่อให้ไล่กลับได้

หลายข้อเป็น **invariant** ไม่ใช่ตัวอย่างเดียว — test จึงไล่ตรวจ pair ทุกตัวที่ generate ออกมา
แทนที่จะ assert เฉพาะกรณีที่เลือกมา เพราะกฎพวกนี้ต้องจริงกับทุกคู่เสมอ
"""

from itertools import combinations

import pytest

from app.domain.errors import ValidationError
from app.domain.pairing import (
    GroupInfo,
    Side,
    generate_group_pairs,
    generate_individual_pairs,
    solve_group_feasibility,
    solve_individual_feasibility,
)


def make_groups(*sizes: int) -> list[GroupInfo]:
    """สร้างกลุ่มตามขนาดที่ระบุ — id คาดเดาได้เพื่อให้ test อ่านง่ายและ deterministic"""
    groups = []
    student = 0
    for index, size in enumerate(sizes):
        members = []
        for _ in range(size):
            student += 1
            members.append(f"u{student:03d}")
        groups.append(GroupInfo(id=f"g{index + 1}", name=f"กลุ่ม {index + 1}", member_ids=tuple(members)))
    return groups


def group_of(groups: list[GroupInfo], user_id: str) -> str:
    return next(g.id for g in groups if user_id in g.member_ids)


class TestGroupFeasibility:
    def test_ห้องใหญ่ผ่านสบาย_ตรงกับตัวอย่างที่_1_ใน_PRD(self):
        # S = 200, N = 10 (กลุ่มละ 20), R = 5 → k = ceil(45×5/200) = 2
        f = solve_group_feasibility(make_groups(*([20] * 10)), target_coverage=5)

        assert f.feasible
        assert f.achievable_coverage == 5
        assert f.workload_per_evaluator == 2
        assert f.total_comparisons == 400
        assert f.reason is None

    def test_P8_ห้องเล็กต้องลด_R_ตรงกับตัวอย่างที่_2_ใน_PRD(self):
        # S = 12, N = 3 (กลุ่มละ 4), R = 5 → ต้องลดเหลือ 4
        f = solve_group_feasibility(make_groups(4, 4, 4), target_coverage=5)

        assert f.feasible
        assert f.achievable_coverage == 4
        assert f.workload_per_evaluator == 1

    def test_P8_เหตุผลต้องมีตัวเลข_ไม่ใช่คำเตือนลอย_ๆ(self):
        f = solve_group_feasibility(make_groups(4, 4, 4), target_coverage=5)

        assert f.reason is not None
        # FR-PAIR-05 บังคับให้อธิบายด้วยตัวเลข — ถ้าไม่มีเลขสักตัวก็ไม่ต่างจากคำเตือนลอย ๆ
        assert any(ch.isdigit() for ch in f.reason)
        assert "4" in f.reason and "5" in f.reason

    def test_ได้ตามที่ขอแล้วต้องไม่มี_reason_มากวน(self):
        assert solve_group_feasibility(make_groups(*([20] * 10)), target_coverage=2).reason is None

    def test_กลุ่มเดียวเทียบกับใครไม่ได้(self):
        f = solve_group_feasibility(make_groups(5))

        assert not f.feasible
        assert "2 กลุ่ม" in f.reason

    def test_ยังไม่มีนักศึกษาต้องบอกให้ไป_import_ก่อน(self):
        f = solve_group_feasibility([GroupInfo("g1", "ก", ()), GroupInfo("g2", "ข", ())])

        assert not f.feasible
        assert "รายชื่อ" in f.reason

    def test_P3_สามกลุ่มขนาดต่างกันมากถูกปฏิเสธพร้อมเหตุผล(self):
        # เมื่อมี 3 กลุ่ม k ถูกบังคับเป็น 1 และแต่ละกลุ่มประเมินได้คู่เดียว
        # coverage จึงเท่ากับขนาดกลุ่มที่ประเมิน — ต่างกัน 2 ทำให้ P3 เป็นไปไม่ได้
        f = solve_group_feasibility(make_groups(5, 4, 3))

        assert not f.feasible
        assert "3 กลุ่ม" in f.reason
        assert "1" in f.reason

    def test_P3_สามกลุ่มขนาดต่างกันแค่_1_ยังผ่าน(self):
        assert solve_group_feasibility(make_groups(5, 4, 4)).feasible

    def test_เพดาน_workload_บีบ_coverage_ลง(self):
        loose = solve_group_feasibility(make_groups(*([3] * 8)), target_coverage=8, max_workload=30)
        tight = solve_group_feasibility(make_groups(*([3] * 8)), target_coverage=8, max_workload=2)

        assert tight.achievable_coverage < loose.achievable_coverage
        assert tight.workload_per_evaluator <= 2


class TestIndividualFeasibility:
    @pytest.mark.parametrize(
        ("size", "expected_coverage"), [(3, 1), (4, 2), (5, 3), (6, 4), (7, 5)]
    )
    def test_P7_coverage_เท่ากับขนาดกลุ่มลบสอง_ไม่ใช่บังคับ_5(
        self, size: int, expected_coverage: int
    ):
        # ตารางนี้ลอกมาจาก PRD §8.3 ตรง ๆ
        f = solve_individual_feasibility(make_groups(size, size), target_coverage=5)

        assert f.achievable_coverage == expected_coverage

    def test_P7_กลุ่มขนาด_3_ต้องได้_coverage_1_ไม่ใช่_error(self):
        f = solve_individual_feasibility(make_groups(3, 3))

        assert f.feasible
        assert f.achievable_coverage == 1

    def test_กลุ่มเล็กกว่า_3_ประเมินกันเองไม่ได้(self):
        f = solve_individual_feasibility(make_groups(2, 2))

        assert not f.feasible
        assert "m − 2" in f.reason

    def test_กลุ่มที่เล็กเกินถูกข้ามและรายงานชื่อไว้(self):
        f = solve_individual_feasibility(make_groups(5, 2))

        assert f.feasible
        assert "ข้าม 1 กลุ่ม" in f.reason
        assert "กลุ่ม 2" in f.reason

    def test_coverage_อ้างกลุ่มที่เล็กที่สุดเพราะเป็นขอบล่างของทั้งห้อง(self):
        assert solve_individual_feasibility(make_groups(7, 4)).achievable_coverage == 2


class TestGenerateGroupPairs:
    """ใช้ห้อง 5 กลุ่ม กลุ่มละ 4 คน — ใหญ่พอให้ evaluator มีทางเลือกจริง"""

    groups = make_groups(4, 4, 4, 4, 4)

    def generate(self, seed: int = 42, **kw):
        f = solve_group_feasibility(self.groups)
        return generate_group_pairs(
            self.groups,
            criterion_id="c1",
            coverage=kw.get("coverage", f.achievable_coverage),
            workload=kw.get("workload", f.workload_per_evaluator),
            seed=seed,
        )

    def test_P1_ไม่มีใครได้รับคู่ที่มีกลุ่มตัวเองอยู่(self):
        for p in self.generate():
            own = group_of(self.groups, p.evaluator_user_id)
            assert own not in (p.item_a_id, p.item_b_id)

    def test_P3_ส่วนต่าง_coverage_ระหว่างคู่ใด_ๆ_ไม่เกิน_1(self):
        pairs = self.generate()
        counts = {(a.id, b.id): 0 for a, b in combinations(self.groups, 2)}
        for p in pairs:
            counts[(p.item_a_id, p.item_b_id)] += 1

        assert max(counts.values()) - min(counts.values()) <= 1

    def test_P4_evaluator_คนเดิมไม่ได้รับคู่เดิมซ้ำในเกณฑ์เดียวกัน(self):
        seen = [(p.evaluator_user_id, p.item_a_id, p.item_b_id) for p in self.generate()]

        assert len(seen) == len(set(seen))

    def test_P5_seed_เดิมให้ผลเหมือนเดิมทุกประการ(self):
        assert self.generate(seed=7) == self.generate(seed=7)

    def test_P5_seed_ต่างกันให้ผลต่างกัน(self):
        # ถ้าเปลี่ยน seed แล้วผลเท่าเดิม แปลว่า seed ไม่ได้ถูกใช้จริง
        assert self.generate(seed=7) != self.generate(seed=8)

    def test_P6_ตำแหน่งซ้ายขวาไม่เอียงไปฝั่งเดียว(self):
        # รวมหลาย seed เพื่อดูแนวโน้ม ไม่ใช่ตัดสินจากการรันครั้งเดียว
        left_is_a = 0
        total = 0
        for seed in range(20):
            for p in self.generate(seed=seed):
                total += 1
                if p.display_left_item_id == p.item_a_id:
                    left_is_a += 1

        ratio = left_is_a / total
        assert 0.4 < ratio < 0.6, f"เอียงไปฝั่งเดียว: item_a อยู่ซ้าย {ratio:.0%}"

    def test_P6_ฝั่งซ้ายต้องเป็นหนึ่งในสองรายการเสมอ(self):
        for p in self.generate():
            assert p.display_left_item_id in (p.item_a_id, p.item_b_id)

    def test_P9_ไม่มีคู่ไหนเทียบกับตัวเอง(self):
        for p in self.generate():
            assert p.item_a_id != p.item_b_id

    def test_ทุกคนได้งานเท่ากันตามค่า_workload(self):
        f = solve_group_feasibility(self.groups)
        per_person: dict[str, int] = {}
        for p in self.generate():
            per_person[p.evaluator_user_id] = per_person.get(p.evaluator_user_id, 0) + 1

        assert set(per_person.values()) == {f.workload_per_evaluator}

    def test_coverage_เป็นศูนย์แล้วไม่สร้างคู่เลย(self):
        assert self.generate(coverage=0, workload=0) == []

    def test_ทุกคู่ที่สร้างเป็นฝั่ง_GROUP(self):
        assert {p.side for p in self.generate()} == {Side.GROUP}


class TestGenerateIndividualPairs:
    groups = make_groups(4, 5)

    def generate(self, seed: int = 42, groups=None):
        return generate_individual_pairs(groups or self.groups, criterion_id="c1", seed=seed)

    def test_P2_ไม่มีใครได้รับคู่ที่มีตัวเองอยู่(self):
        for p in self.generate():
            assert p.evaluator_user_id not in (p.item_a_id, p.item_b_id)

    def test_P2_ประเมินได้เฉพาะคนในกลุ่มตัวเอง(self):
        for p in self.generate():
            own = group_of(self.groups, p.evaluator_user_id)
            assert group_of(self.groups, p.item_a_id) == own
            assert group_of(self.groups, p.item_b_id) == own

    def test_P7_coverage_ที่ได้จริงเท่ากับขนาดกลุ่มลบสอง(self):
        counts: dict[tuple[str, str], int] = {}
        for p in self.generate():
            counts[(p.item_a_id, p.item_b_id)] = counts.get((p.item_a_id, p.item_b_id), 0) + 1

        group4 = self.groups[0]
        in_group4 = [c for pair, c in counts.items() if pair[0] in group4.member_ids]
        assert set(in_group4) == {group4.size - 2}

    def test_P10_กลุ่มที่เล็กเกินถูกข้ามไปเงียบ_ๆ_ไม่พัง(self):
        pairs = self.generate(groups=make_groups(2, 4))
        touched = {p.item_a_id for p in pairs} | {p.item_b_id for p in pairs}

        assert touched.isdisjoint(make_groups(2, 4)[0].member_ids)

    def test_P4_ไม่มีคู่ซ้ำต่อ_evaluator(self):
        seen = [(p.evaluator_user_id, p.item_a_id, p.item_b_id) for p in self.generate()]

        assert len(seen) == len(set(seen))

    def test_P5_seed_เดิมให้ผลเหมือนเดิม(self):
        assert self.generate(seed=3) == self.generate(seed=3)

    def test_จำนวนคู่ตรงกับสูตร_m_คูณ_C_m_ลบ_1_2(self):
        # กลุ่ม 4 คน → 4 × C(3,2) = 12 · กลุ่ม 5 คน → 5 × C(4,2) = 30
        assert len(self.generate()) == 12 + 30

    def test_ทุกคู่ที่สร้างเป็นฝั่ง_INDIVIDUAL(self):
        assert {p.side for p in self.generate()} == {Side.INDIVIDUAL}


class TestBalanceGuard:
    def test_ถ้าจัดสรรออกมาไม่สมดุลต้อง_raise_ไม่ใช่คืนข้อมูลผิดกฎ(self):
        # บังคับให้เกิดกรณีที่ feasibility ปกติจะดักไว้ก่อน โดยเรียก generate ตรง ๆ
        # ด้วยค่าที่ทำให้ 3 กลุ่มขนาดต่างกันมากถูกจัดสรร
        groups = make_groups(6, 4, 2)

        with pytest.raises(ValidationError) as exc:
            generate_group_pairs(groups, criterion_id="c1", coverage=4, workload=1, seed=1)

        assert "ไม่สมดุล" in exc.value.message
        assert any(ch.isdigit() for ch in exc.value.message)


class TestInvariantsAcrossManyShapes:
    """property-based test แบบเบา — NFR-MAINT-02

    กฎ P1–P4 และ P9 ต้องจริงกับ *ทุก* รูปทรงห้องเรียน ไม่ใช่แค่ห้องที่เลือกมาทดสอบ
    การไล่หลายรูปทรง × หลาย seed คือสิ่งที่จับบั๊กที่ตัวอย่างเดียวมองไม่เห็น —
    อัลกอริทึมเวอร์ชันแรกผ่าน test ห้อง 5 กลุ่มได้ แต่ล้มที่ 8 ใน 19 รูปทรงนี้
    """

    SHAPES = [
        (4, 4, 4, 4, 4),
        (4, 4, 4),
        (5, 4, 4),
        (20, 20, 20, 20, 20),
        (3, 3, 3, 3, 3, 3, 3, 3),
        (6, 5, 5, 4, 4, 4),
        (7, 7, 6, 6, 5),
        (8, 7, 7, 6),
        (4, 5, 4, 5, 4, 5, 4),
        (10, 9, 9, 8),
    ]

    @pytest.mark.parametrize("shape", SHAPES)
    @pytest.mark.parametrize("seed", [0, 1, 7, 42])
    def test_invariant_ทุกข้อจริงกับทุกรูปทรงห้อง(self, shape: tuple[int, ...], seed: int):
        groups = make_groups(*shape)
        f = solve_group_feasibility(groups)
        assert f.feasible, f"รูปทรง {shape} ควร feasible: {f.reason}"

        pairs = generate_group_pairs(
            groups,
            criterion_id="c1",
            coverage=f.achievable_coverage,
            workload=f.workload_per_evaluator,
            seed=seed,
        )

        counts: dict[tuple[str, str], int] = {
            (a.id, b.id): 0 for a, b in combinations(sorted(groups, key=lambda g: g.id), 2)
        }
        seen: set[tuple[str, str, str]] = set()

        for p in pairs:
            # P1 — ไม่มีกลุ่มตัวเองอยู่ในคู่
            assert group_of(groups, p.evaluator_user_id) not in (p.item_a_id, p.item_b_id)
            # P9 — ไม่เทียบกับตัวเอง
            assert p.item_a_id != p.item_b_id
            # P6 — ฝั่งซ้ายเป็นหนึ่งในสองรายการ
            assert p.display_left_item_id in (p.item_a_id, p.item_b_id)
            # P4 — ไม่ซ้ำ
            key = (p.evaluator_user_id, p.item_a_id, p.item_b_id)
            assert key not in seen
            seen.add(key)
            counts[(p.item_a_id, p.item_b_id)] += 1

        # P3 — generate_group_pairs raise เองถ้าไม่ผ่าน แต่ยืนยันซ้ำที่นี่ให้เห็นชัด
        assert max(counts.values()) - min(counts.values()) <= 1

    @pytest.mark.parametrize("shape", SHAPES)
    def test_P5_deterministic_ทุกรูปทรง(self, shape: tuple[int, ...]):
        groups = make_groups(*shape)
        f = solve_group_feasibility(groups)
        kw = dict(
            criterion_id="c1",
            coverage=f.achievable_coverage,
            workload=f.workload_per_evaluator,
            seed=99,
        )

        assert generate_group_pairs(groups, **kw) == generate_group_pairs(groups, **kw)
