"""FR-SEC-04: text reaching exports must remain text in spreadsheet programs."""

import csv
import io
from datetime import UTC, datetime

import pytest

from app.api.scoring import _rows_to_csv
from app.domain.pairing import Side
from app.repositories.pg_scoring_repo import ComparisonExportRow


def export_row(text: str) -> list[str]:
    row = ComparisonExportRow(
        side=Side.GROUP,
        criterion_name=text,
        item_a_label=text,
        item_b_label=text,
        display_left_item_id="item-a",
        item_a_id="item-a",
        item_b_id="item-b",
        choice=3,
        evaluator_user_id="evaluator-1",
        submitted_at=datetime(2026, 10, 18, tzinfo=UTC),
    )
    result = _rows_to_csv([row], evaluator_column={"evaluator-1": text})
    return list(csv.reader(io.StringIO(result.lstrip("\ufeff"))))[1]


@pytest.mark.parametrize(
    "text", ["=1+1", "+1+1", "-1+1", "@SUM(1,1)", "\t=1+1", "\r=1+1", "\n=1+1", "  =1+1"]
)
def test_export_neutralizes_formula_text_in_every_user_controlled_column(text):
    cells = export_row(text)

    for column in (1, 2, 3, 4, 6):
        assert cells[column] == "'" + text
    assert cells[5] == "3"  # the numeric choice remains usable as a number


@pytest.mark.parametrize("text", ["เกณฑ์ความครบถ้วน", "กลุ่ม 1, กลุ่ม 2", "บรรทัดแรก\nถัดไป", "'safe"])
def test_export_preserves_ordinary_text(text):
    cells = export_row(text)

    assert cells[1:5] == [text] * 4
    assert cells[6] == text
