"""Generate a publishable assignment's pairs without HTTP or persistence.

Yield one criterion at a time so the caller keeps the existing generation/write
order and can persist every batch inside its single publish transaction.
"""

from collections.abc import Iterator

from app.domain.assignment_service import Assignment, Criterion
from app.domain.errors import ValidationError
from app.domain.pairing import (
    GroupInfo,
    Pair,
    Side,
    generate_group_pairs,
    generate_individual_pairs,
    solve_group_feasibility,
)


def generate_assignment_pairs(
    assignment: Assignment, groups: list[GroupInfo], *, seed: int
) -> Iterator[tuple[Criterion, list[Pair]]]:
    """Use the existing feasibility/seed rules; caller first checks publishability."""
    # GAP-11: ฝั่งกลุ่มที่ปิดไว้ (groupMaxScore = 0) ไม่ต้องผ่าน feasibility และไม่มีคู่ฝั่งกลุ่ม
    if assignment.has_group_side:
        group_plan = solve_group_feasibility(
            groups,
            target_coverage=assignment.target_coverage,
            max_workload=assignment.max_workload,
        )
        if not group_plan.feasible:
            raise ValidationError(
                group_plan.reason or "ตั้งค่าปัจจุบันสร้างคู่ประเมินไม่ได้", field="targetCoverage"
            )

        for criterion in assignment.criteria_for(Side.GROUP):
            yield criterion, generate_group_pairs(
                groups,
                criterion_id=criterion.id,
                coverage=group_plan.achievable_coverage,
                workload=group_plan.workload_per_evaluator,
                seed=seed,
                assignment_id=assignment.id,
            )

    # P10: a disabled individual side must produce no individual pairs.
    if assignment.has_individual_side:
        for criterion in assignment.criteria_for(Side.INDIVIDUAL):
            yield criterion, generate_individual_pairs(
                groups,
                criterion_id=criterion.id,
                seed=seed,
                assignment_id=assignment.id,
                max_workload=assignment.max_workload,
            )
