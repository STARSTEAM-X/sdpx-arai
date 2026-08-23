"""Pairing Engine — ตัดสินว่าใครต้องประเมินคู่ไหน (US-05, US-06)

ทั้งไฟล์นี้เป็น **pure logic** ไม่รู้จัก database, HTTP หรือการคำนวณคะแนน
รับ roster + config + seed เข้ามา คืนรายการ pair ออกไป ให้ชั้นบนเป็นคนบันทึก
นี่คือเหตุผลที่ property ทั้ง 10 ข้อ (P1–P10) ทดสอบได้โดยไม่ต้องยก Postgres

อ้าง PRD §8.2 (feasibility ฝั่งกลุ่ม), §8.3 (individual), §8.4 (อัลกอริทึมจัดสรร)
"""

import math
import random
from dataclasses import dataclass
from enum import StrEnum
from itertools import combinations

from app.domain.errors import ValidationError

DEFAULT_TARGET_COVERAGE = 5
DEFAULT_MAX_WORKLOAD = 8

# กลุ่มที่เล็กกว่านี้ประเมินกันเองไม่ได้ — pair หนึ่งคู่กินสมาชิกไป 2 คน
# เหลือ m − 2 คนเป็นผู้ประเมิน ถ้า m = 2 ก็ไม่เหลือใคร (FR-PAIR-12)
MIN_GROUP_SIZE_FOR_INDIVIDUAL = 3


class Side(StrEnum):
    GROUP = "GROUP"
    INDIVIDUAL = "INDIVIDUAL"


@dataclass(frozen=True)
class GroupInfo:
    """กลุ่มหนึ่งกลุ่มพร้อมสมาชิก — เรียงสมาชิกแล้วเพื่อให้ผลลัพธ์ deterministic"""

    id: str
    name: str
    member_ids: tuple[str, ...]

    @property
    def size(self) -> int:
        return len(self.member_ids)


@dataclass(frozen=True)
class Feasibility:
    side: Side
    requested_coverage: int
    achievable_coverage: int
    workload_per_evaluator: int
    total_comparisons: int
    feasible: bool
    reason: str | None = None


@dataclass(frozen=True)
class Pair:
    """หนึ่งคู่ที่ evaluator คนหนึ่งต้องประเมินภายใต้ criterion หนึ่ง"""

    side: Side
    item_a_id: str
    item_b_id: str
    evaluator_user_id: str
    display_left_item_id: str


def _rng(seed: int, *parts: str) -> random.Random:
    """สร้าง RNG ที่ผูกกับ seed และบริบท

    ผสม assignment/criterion เข้าไปด้วย เพื่อให้แต่ละ criterion ได้ลำดับสุ่มของตัวเอง
    ถ้าใช้ seed ดิบทุก criterion จะได้การจัดสรรหน้าตาเดียวกันเป๊ะ ซึ่งทำให้
    นักศึกษาคนหนึ่งเจอคู่ชุดเดิมซ้ำทุกเกณฑ์ — ยังไม่ผิดกฎข้อไหน แต่เสียคุณค่าของการมีหลายเกณฑ์
    """
    return random.Random(f"{seed}|{'|'.join(parts)}")


# ---------------------------------------------------------------------------
# Feasibility — PRD §8.2
# ---------------------------------------------------------------------------


def solve_group_feasibility(
    groups: list[GroupInfo],
    *,
    target_coverage: int = DEFAULT_TARGET_COVERAGE,
    max_workload: int = DEFAULT_MAX_WORKLOAD,
) -> Feasibility:
    """หา coverage สูงสุดที่ทำได้จริงสำหรับการประเมินระดับกลุ่ม

    ไล่ลด R ทีละขั้นจนกว่าข้อจำกัดทุกข้อจะผ่าน แล้วรายงานค่าที่ใช้จริง
    **ไม่แอบลดโดยไม่บอก** — ถ้าได้น้อยกว่าที่ขอ `reason` จะมีตัวเลขกำกับเสมอ (FR-PAIR-05)
    """
    n_groups = len(groups)
    students = sum(g.size for g in groups)

    if n_groups < 2:
        return Feasibility(
            side=Side.GROUP,
            requested_coverage=target_coverage,
            achievable_coverage=0,
            workload_per_evaluator=0,
            total_comparisons=0,
            feasible=False,
            reason=f"มี {n_groups} กลุ่ม — ต้องมีอย่างน้อย 2 กลุ่มจึงจะเทียบกันได้",
        )

    if students == 0:
        return Feasibility(
            side=Side.GROUP,
            requested_coverage=target_coverage,
            achievable_coverage=0,
            workload_per_evaluator=0,
            total_comparisons=0,
            feasible=False,
            reason="ยังไม่มีนักศึกษาในห้องเรียนนี้ — นำเข้ารายชื่อก่อน",
        )

    pair_count = n_groups * (n_groups - 1) // 2

    # ข้อจำกัด (3) — คนที่มีสิทธิ์ประเมิน pair (a,b) คือคนที่ไม่ได้อยู่ทั้งสองกลุ่มนั้น
    # ค่าที่บีบที่สุดมาจากคู่ของสองกลุ่มที่ใหญ่ที่สุด
    eligible_min = min(students - a.size - b.size for a, b in combinations(groups, 2))

    # ข้อจำกัด (4) — เมื่อ N = 3 ข้อจำกัด (1) บังคับให้ k = 1 เสมอ
    # และแต่ละกลุ่มประเมินได้เพียงคู่เดียว (คู่ของอีกสองกลุ่ม) การกระจายจึงถูกกำหนด
    # ด้วยขนาดกลุ่มล้วน ๆ — coverage ของแต่ละคู่ = ขนาดของกลุ่มที่ประเมินคู่นั้น
    # ถ้าขนาดกลุ่มต่างกันเกิน 1 กฎ P3 (ส่วนต่าง coverage ≤ 1) เป็นไปไม่ได้ทางคณิตศาสตร์
    if n_groups == 3:
        sizes = sorted(g.size for g in groups)
        if sizes[-1] - sizes[0] > 1:
            return Feasibility(
                side=Side.GROUP,
                requested_coverage=target_coverage,
                achievable_coverage=0,
                workload_per_evaluator=0,
                total_comparisons=0,
                feasible=False,
                reason=(
                    f"มี 3 กลุ่มขนาด {sizes[0]}, {sizes[1]}, {sizes[2]} คน — "
                    f"เมื่อมี 3 กลุ่ม แต่ละกลุ่มประเมินได้เพียงคู่เดียว "
                    f"coverage ของแต่ละคู่จึงเท่ากับขนาดกลุ่มที่ประเมิน "
                    f"ต่างกัน {sizes[-1] - sizes[0]} ซึ่งเกินเพดานที่ยอมได้คือ 1 "
                    f"— ปรับให้ขนาดกลุ่มต่างกันไม่เกิน 1 คน หรือเพิ่มเป็น 4 กลุ่มขึ้นไป"
                ),
            )

    for coverage in range(target_coverage, 0, -1):
        workload = math.ceil(pair_count * coverage / students)

        # (1) evaluator ประเมิน pair ที่มีกลุ่มตัวเองอยู่ไม่ได้ จึงเหลือคู่ให้เลือกน้อยลง
        if workload > pair_count - (n_groups - 1):
            continue
        # (2) เพดานเวลาของนักศึกษา
        if workload > max_workload:
            continue
        # (3) ต้องมีคนพอจะประเมินคู่ที่บีบที่สุด
        if coverage > eligible_min:
            continue

        reason = None
        if coverage < target_coverage:
            reason = (
                f"ตั้ง coverage ได้สูงสุด {coverage} ครั้งต่อคู่ (ไม่ใช่ {target_coverage} ตามที่ขอ) — "
                f"ห้องนี้มี {n_groups} กลุ่ม {students} คน เกิด {pair_count} คู่ "
                f"แต่ละคู่มีผู้มีสิทธิ์ประเมินอย่างน้อย {eligible_min} คน "
                f"และเพดาน workload คือ {max_workload} คู่ต่อคนต่อเกณฑ์ "
                f"— นักศึกษาแต่ละคนจะได้ {workload} คู่ต่อเกณฑ์"
            )

        return Feasibility(
            side=Side.GROUP,
            requested_coverage=target_coverage,
            achievable_coverage=coverage,
            workload_per_evaluator=workload,
            total_comparisons=workload * students,
            feasible=True,
            reason=reason,
        )

    return Feasibility(
        side=Side.GROUP,
        requested_coverage=target_coverage,
        achievable_coverage=0,
        workload_per_evaluator=0,
        total_comparisons=0,
        feasible=False,
        reason=(
            f"ห้องนี้มี {n_groups} กลุ่ม {students} คน เกิด {pair_count} คู่ "
            f"แต่ละคู่มีผู้มีสิทธิ์ประเมินอย่างน้อย {eligible_min} คน "
            f"— ไม่มีค่า coverage ใดตั้งแต่ 1 ถึง {target_coverage} ที่ผ่านข้อจำกัดทั้งหมด"
        ),
    )


def solve_individual_feasibility(
    groups: list[GroupInfo], *, target_coverage: int = DEFAULT_TARGET_COVERAGE
) -> Feasibility:
    """coverage ฝั่งบุคคลถูกกำหนดโดยขนาดกลุ่ม ไม่ใช่โดยค่าที่อาจารย์ขอ (D4)

    ในกลุ่ม m คน คู่หนึ่งคู่มีคนประเมินได้ m − 2 คน — บังคับ 5 คือเป็นไปไม่ได้เมื่อ m < 7
    ค่าที่รายงานจึงเป็นค่าของ **กลุ่มที่เล็กที่สุด** เพราะนั่นคือขอบล่างที่จริงทั้งห้อง
    """
    usable = [g for g in groups if g.size >= MIN_GROUP_SIZE_FOR_INDIVIDUAL]

    if not usable:
        sizes = sorted(g.size for g in groups) or [0]
        return Feasibility(
            side=Side.INDIVIDUAL,
            requested_coverage=target_coverage,
            achievable_coverage=0,
            workload_per_evaluator=0,
            total_comparisons=0,
            feasible=False,
            reason=(
                f"ทุกกลุ่มมีสมาชิกไม่ถึง {MIN_GROUP_SIZE_FOR_INDIVIDUAL} คน "
                f"(ขนาดที่พบ: {', '.join(str(s) for s in sizes)}) — "
                f"กลุ่ม m คนมีผู้ประเมินต่อคู่เพียง m − 2 คน จึงประเมินกันเองไม่ได้"
            ),
        )

    smallest = min(g.size for g in usable)
    coverage = smallest - 2
    # C(m−1, 2) — จำนวนคู่ที่คนหนึ่งประเมินได้ในกลุ่มของตัวเอง
    workload = (smallest - 1) * (smallest - 2) // 2
    total = sum(g.size * (g.size - 1) * (g.size - 2) // 2 for g in usable)

    reason = None
    skipped = [g for g in groups if g.size < MIN_GROUP_SIZE_FOR_INDIVIDUAL]
    if coverage < target_coverage or skipped:
        parts = [
            f"coverage ฝั่งบุคคลเท่ากับขนาดกลุ่มลบ 2 เสมอ (D4) — "
            f"กลุ่มเล็กสุดมี {smallest} คน จึงได้ coverage {coverage} ไม่ใช่ {target_coverage}"
        ]
        if skipped:
            names = ", ".join(sorted(g.name for g in skipped))
            parts.append(
                f"· ข้าม {len(skipped)} กลุ่มที่มีสมาชิกไม่ถึง "
                f"{MIN_GROUP_SIZE_FOR_INDIVIDUAL} คน ({names})"
            )
        reason = " ".join(parts)

    return Feasibility(
        side=Side.INDIVIDUAL,
        requested_coverage=target_coverage,
        achievable_coverage=coverage,
        workload_per_evaluator=workload,
        total_comparisons=total,
        feasible=True,
        reason=reason,
    )


# ---------------------------------------------------------------------------
# การจัดสรร — PRD §8.4
# ---------------------------------------------------------------------------


def _place(rng: random.Random, a: str, b: str) -> str:
    """สุ่มว่า evaluator เห็นอะไรอยู่ซ้าย แล้วคืน id ของฝั่งซ้าย (P6 / D8)"""
    return a if rng.random() < 0.5 else b


def generate_group_pairs(
    groups: list[GroupInfo],
    *,
    criterion_id: str,
    coverage: int,
    workload: int,
    seed: int,
    assignment_id: str = "",
) -> list[Pair]:
    """จัดสรรคู่ระดับกลุ่มให้นักศึกษาทุกคน

    ## ทำไมไม่ทำตาม pseudocode ใน PRD §8.4 ตรง ๆ

    pseudocode นั้นไล่ทีละ evaluator แล้วให้แต่ละคนหยิบคู่ที่ขาดที่สุด
    วิธีนั้นให้ผลไม่สมดุลในเคสที่ **มีคำตอบสมดุลอยู่จริง** เช่น 5 กลุ่ม กลุ่มละ 4 คน:
    งานทั้งหมด 20 × 3 = 60 ลงได้พอดี 6 ต่อคู่ แต่การไล่ทีละคนได้ 7 กับ 5
    เพราะคนท้าย ๆ เหลือทางเลือกน้อยแล้ว ความไม่สมดุลไปกองอยู่ที่คนสุดท้าย

    ที่นี่จึงกลับด้าน: **ป้อนคู่ที่ขาดที่สุดก่อน** แล้วค่อยหาคนมาให้
    ผลลัพธ์ที่ต้องการคือ coverage สมดุล (FR-PAIR-06) การวนที่ตัวคู่จึงตรงกับเป้าหมายกว่า
    ยังคง deterministic เท่าเดิมเพราะทุกลำดับถูก sort ก่อนแล้วค่อยแตก tie ด้วย rng
    """
    if coverage <= 0 or workload <= 0 or len(groups) < 2:
        return []

    rng = _rng(seed, assignment_id, criterion_id)

    # เรียงก่อนเสมอ — set ของ Python ไม่รับประกันลำดับข้าม process
    # ถ้าปล่อยให้ลำดับลอย ผลลัพธ์จะต่างกันทั้งที่ seed เดียวกัน แล้ว P5 จะพังแบบสุ่ม ๆ
    ordered = sorted(groups, key=lambda g: g.id)
    all_pairs = [(a.id, b.id) for a, b in combinations(ordered, 2)]

    group_of = {member: g.id for g in ordered for member in g.member_ids}
    capacity = {student: workload for student in sorted(group_of)}
    counts = dict.fromkeys(all_pairs, 0)

    # P1 — ผู้มีสิทธิ์ประเมินคู่หนึ่ง คือคนที่ไม่ได้อยู่ในสองกลุ่มนั้น
    eligible_for = {
        pair: [s for s in capacity if group_of[s] not in pair] for pair in all_pairs
    }
    for pool in eligible_for.values():
        rng.shuffle(pool)

    # ใครถือคู่ไหนอยู่ — ใช้ทั้งกันคู่ซ้ำ (P4) และตอน repair
    holders: dict[tuple[str, str], list[str]] = {p: [] for p in all_pairs}
    taken: set[tuple[str, tuple[str, str]]] = set()

    # รอบแรก: ป้อนคู่ที่ coverage ต่ำสุดก่อนเสมอ
    while True:
        progressed = False
        for pair in sorted(all_pairs, key=lambda p: (counts[p], rng.random())):
            pool = [s for s in eligible_for[pair] if capacity[s] > 0 and (s, pair) not in taken]
            if not pool:
                continue
            student = max(pool, key=lambda s: capacity[s])
            capacity[student] -= 1
            counts[pair] += 1
            holders[pair].append(student)
            taken.add((student, pair))
            progressed = True
        if not progressed:
            break

    _rebalance(counts, holders, taken, eligible_for, all_pairs)

    pairs = [
        Pair(
            side=Side.GROUP,
            item_a_id=pair[0],
            item_b_id=pair[1],
            evaluator_user_id=student,
            display_left_item_id=_place(rng, pair[0], pair[1]),
        )
        for pair in all_pairs
        for student in holders[pair]
    ]

    _assert_no_duplicate_pair(pairs)
    _assert_balanced(pairs, all_pairs)
    # เรียงผลลัพธ์ให้คงที่ ไม่ขึ้นกับลำดับที่จัดสรรได้ — ทำให้เทียบผลสอง run ได้ตรง ๆ (P5)
    return sorted(
        pairs, key=lambda p: (p.evaluator_user_id, p.item_a_id, p.item_b_id)
    )


def _rebalance(
    counts: dict[tuple[str, str], int],
    holders: dict[tuple[str, str], list[str]],
    taken: set[tuple[str, tuple[str, str]]],
    eligible_for: dict[tuple[str, str], list[str]],
    all_pairs: list[tuple[str, str]],
) -> None:
    """ย้ายงานจากคู่ที่ coverage ล้น ไปคู่ที่ยังขาด จนกว่าส่วนต่างจะไม่เกิน 1 (P3)

    greedy รอบแรกให้ผลใกล้เคียงสมดุลแต่ไม่รับประกัน เพราะคนที่ถูกจัดไปแล้ว
    อาจเป็นคนเดียวที่คู่อื่นต้องการ การย้ายทีหลังแก้ได้โดยไม่ต้องรื้อทั้งชุด

    การย้ายหนึ่งครั้งลด coverage ของคู่ที่ล้นลง 1 และเพิ่มให้คู่ที่ขาด 1
    ทุกครั้งจึงลดส่วนต่างลงเสมอ วนไม่รู้จบไม่ได้ · เพดานรอบกันไว้อีกชั้น
    ถ้าออกจากลูปทั้งที่ยังไม่สมดุล `_assert_balanced` จะเป็นคนแจ้ง
    """
    max_moves = sum(len(v) for v in holders.values()) + len(all_pairs)

    for _ in range(max_moves):
        overfull = sorted(all_pairs, key=lambda p: -counts[p])
        underfull = sorted(all_pairs, key=lambda p: counts[p])

        if counts[overfull[0]] - counts[underfull[0]] <= 1:
            return

        # ลองทุกคู่ (ล้น, ขาด) ที่ต่างกันตั้งแต่ 2 ขึ้นไป ไม่ใช่แค่ max กับ min
        # เพราะคนที่ถือคู่ที่ล้นที่สุดอาจย้ายไปคู่ที่ขาดที่สุดไม่ได้เลยสักคน
        # ขณะที่คู่อันดับรองยังขยับได้ การหยุดที่คู่แรกจึงยอมแพ้เร็วเกินจริง
        moved = False
        for hi in overfull:
            for lo in underfull:
                if counts[hi] - counts[lo] < 2:
                    break
                movable = next(
                    (s for s in holders[hi] if s in eligible_for[lo] and (s, lo) not in taken),
                    None,
                )
                if movable is None:
                    continue

                holders[hi].remove(movable)
                taken.discard((movable, hi))
                counts[hi] -= 1

                holders[lo].append(movable)
                taken.add((movable, lo))
                counts[lo] += 1
                moved = True
                break
            if moved:
                break

        if moved:
            continue

        # ย้ายตรง ๆ ไม่ได้ — ลองย้ายสองต่อผ่านคู่กลาง
        # คนที่ถือคู่ที่ล้นอาจไม่มีสิทธิ์ในคู่ที่ขาด แต่ย้ายไปคู่กลางได้
        # แล้วให้คนของคู่กลางย้ายต่อไปคู่ที่ขาดแทน · ผลรวมคือ ล้น −1 ขาด +1 กลางเท่าเดิม
        for hi in overfull:
            for lo in underfull:
                if counts[hi] - counts[lo] < 2:
                    break
                for mid in all_pairs:
                    if mid in (hi, lo):
                        continue
                    first = next(
                        (s for s in holders[hi] if s in eligible_for[mid] and (s, mid) not in taken),
                        None,
                    )
                    if first is None:
                        continue
                    second = next(
                        (
                            s
                            for s in holders[mid]
                            if s != first and s in eligible_for[lo] and (s, lo) not in taken
                        ),
                        None,
                    )
                    if second is None:
                        continue

                    holders[hi].remove(first)
                    taken.discard((first, hi))
                    holders[mid].append(first)
                    taken.add((first, mid))

                    holders[mid].remove(second)
                    taken.discard((second, mid))
                    holders[lo].append(second)
                    taken.add((second, lo))

                    counts[hi] -= 1
                    counts[lo] += 1
                    moved = True
                    break
                if moved:
                    break
            if moved:
                break

        if not moved:
            return


def _assert_no_duplicate_pair(pairs: list[Pair]) -> None:
    """P4 — evaluator คนเดิมต้องไม่ได้รับคู่เดิมซ้ำภายใน criterion เดียวกัน

    การแจกแบบวนรอบรับประกันข้อนี้อยู่แล้วเมื่อ workload ≤ จำนวนคู่ที่กลุ่มประเมินได้
    ซึ่งข้อจำกัด (1) ใน feasibility บังคับไว้ — ตรวจซ้ำตรงนี้เพราะถ้าวันหนึ่ง
    มีคนแก้ตัวคำนวณ workload แล้วเงื่อนไขนั้นหลุด database จะเป็นด่านสุดท้ายที่เหลือ
    ซึ่งจะพังตอน insert แทนที่จะบอกสาเหตุที่แท้จริง
    """
    seen = {(p.evaluator_user_id, p.item_a_id, p.item_b_id) for p in pairs}
    if len(seen) != len(pairs):
        raise ValidationError(
            f"มีคู่ซ้ำสำหรับ evaluator คนเดิม — สร้าง {len(pairs)} รายการ "
            f"แต่ไม่ซ้ำกันจริงเพียง {len(seen)} รายการ"
        )


def _assert_balanced(pairs: list[Pair], all_pairs: list[tuple[str, str]]) -> None:
    """P3 — ส่วนต่าง coverage ระหว่างคู่ใด ๆ ต้อง ≤ 1

    ตรวจหลังจัดสรรเสร็จแล้ว raise ถ้าไม่ผ่าน แทนที่จะบันทึกข้อมูลที่ผิดกฎลง database
    ตามหลักการเดียวกับ §8.2: ระบบต้องไม่พังเงียบ ๆ
    ปกติ feasibility จะดักกรณีที่เป็นไปไม่ได้ไว้ก่อนถึงตรงนี้แล้ว
    """
    if not all_pairs:
        return

    counts = dict.fromkeys(all_pairs, 0)
    for p in pairs:
        counts[(p.item_a_id, p.item_b_id)] += 1

    spread = max(counts.values()) - min(counts.values())
    if spread > 1:
        raise ValidationError(
            f"การกระจายคู่ไม่สมดุล — coverage ต่างกัน {spread} "
            f"(มากสุด {max(counts.values())} น้อยสุด {min(counts.values())}) "
            f"ซึ่งเกินเพดานที่ยอมได้คือ 1 · ตรวจ feasibility ก่อน publish"
        )


def generate_individual_pairs(
    groups: list[GroupInfo], *, criterion_id: str, seed: int, assignment_id: str = ""
) -> list[Pair]:
    """จัดสรรคู่ภายในกลุ่ม — เป็น complete enumeration ไม่ต้องสุ่มว่าใครได้คู่ไหน (§8.3)

    ทุกคนประเมินทุกคู่ในกลุ่มที่ไม่มีตัวเองอยู่ จึงได้ coverage = m − 2 โดยอัตโนมัติ
    และสมดุลเป๊ะโดยไม่ต้องจัดสรร — สุ่มเฉพาะตำแหน่งซ้ายขวาเท่านั้น
    """
    rng = _rng(seed, assignment_id, criterion_id, "individual")
    pairs: list[Pair] = []

    for group in sorted(groups, key=lambda g: g.id):
        if group.size < MIN_GROUP_SIZE_FOR_INDIVIDUAL:
            continue

        members = sorted(group.member_ids)
        for evaluator in members:
            # P2 — ไม่มีตัวเองอยู่ในคู่ และประเมินได้เฉพาะในกลุ่มตัวเอง
            others = [m for m in members if m != evaluator]
            for item_a, item_b in combinations(others, 2):
                pairs.append(
                    Pair(
                        side=Side.INDIVIDUAL,
                        item_a_id=item_a,
                        item_b_id=item_b,
                        evaluator_user_id=evaluator,
                        display_left_item_id=_place(rng, item_a, item_b),
                    )
                )

    return pairs
