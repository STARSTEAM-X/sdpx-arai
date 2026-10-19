"""ประกอบ scoring pure functions กับ repository สำหรับทั้ง API และ scheduled job."""

from datetime import datetime

from psycopg import Connection

from app.domain.assignment_service import Assignment
from app.domain.pairing import Side
from app.domain.scoring_service import (
    LOW_CONFIDENCE,
    compute_item_component,
    group_size_forces_low_confidence,
)
from app.repositories.pg_scoring_repo import PgScoringRepository


def run_recompute(conn: Connection, assignment: Assignment, *, is_final: bool, now: datetime) -> bool:
    scoring_repo = PgScoringRepository(conn)
    has_low_confidence = False
    sides = assignment.enabled_sides

    # FR-PAIR-13 — ขนาดกลุ่มของนักศึกษาแต่ละคน ใช้บังคับธงฝั่งรายบุคคลของกลุ่ม 3 คน
    group_sizes = (
        scoring_repo.individual_group_sizes(assignment.classroom_id) if assignment.has_individual_side else {}
    )

    for side in sides:
        comparisons = scoring_repo.submitted_comparisons(assignment.id, side)
        criteria = scoring_repo.criteria_for(assignment.id, side)
        items = scoring_repo.items_for_side(assignment.classroom_id, side)
        max_score = assignment.group_max_score if side is Side.GROUP else assignment.individual_max_score
        components = [
            compute_item_component(
                comparisons, item_id, side, criteria,
                max_score_side=max_score,
                floor=assignment.score_floor,
                ceiling=assignment.score_ceiling,
                instructor_weight=assignment.instructor_weight,
                min_comparisons=assignment.min_comparisons,
                force_low_confidence=(
                    side is Side.INDIVIDUAL
                    and item_id in group_sizes
                    and group_size_forces_low_confidence(group_sizes[item_id])
                ),
            )
            for item_id in items
        ]
        scoring_repo.save_computed_scores(assignment.id, components, is_final=is_final, now=now)
        if any(LOW_CONFIDENCE in component.flags for component in components):
            has_low_confidence = True
    return has_low_confidence
