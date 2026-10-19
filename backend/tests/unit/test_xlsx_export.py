"""ตัวเขียน XLSX และชื่อไฟล์ส่งออก (Figma J36) — pure ไม่ต้องมี DB"""
import io
import xml.etree.ElementTree as ET
import zipfile
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from app.api.reports_export import Report, export_basename
from app.domain.assignment_service import Assignment
from app.domain.xlsx import workbook

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def _cells(data: bytes, sheet: int) -> list[list[str]]:
    with zipfile.ZipFile(io.BytesIO(data)) as book:
        root = ET.fromstring(book.read(f'xl/worksheets/sheet{sheet}.xml'))
    return [[(c.findtext('m:is/m:t', namespaces=NS) or c.findtext('m:v', namespaces=NS)) for c in row]
            for row in root.iterfind('.//m:row', NS)]


def test_workbook_keeps_thai_text_numbers_and_never_writes_formulas():
    data = workbook([('Group Summary', [['กลุ่ม', 'คะแนน'], ['Aurora', Decimal('12.50')], ['=1+1', 3]]),
                     ('Metadata', [['key', 'value'], ['ok', 'ข้อความ <ไทย> & "quote"']])])
    with zipfile.ZipFile(io.BytesIO(data)) as book:
        assert book.testzip() is None
        assert 'Group Summary' in book.read('xl/workbook.xml').decode()
        assert b'<f>' not in book.read('xl/worksheets/sheet1.xml')
    assert _cells(data, 1) == [['กลุ่ม', 'คะแนน'], ['Aurora', '12.50'], ['=1+1', '3']]
    assert _cells(data, 2)[1] == ['ok', 'ข้อความ <ไทย> & "quote"']


def test_workbook_strips_control_characters_and_rejects_duplicate_sheets():
    assert _cells(workbook([('A', [['a\x00b\x1fc']])]), 1) == [['abc']]
    with pytest.raises(ValueError):
        workbook([('A', []), ('A', [])])
    with pytest.raises(ValueError):
        workbook([])


def test_export_basename_follows_figma_pattern_in_classroom_timezone():
    job = Assignment(id='0f1e2d3c-aaaa', classroom_id='c', name='Group work 1', group_max_score=Decimal(15),
                     individual_max_score=Decimal(5), group_deadline_utc=datetime(2026, 1, 1, tzinfo=UTC), created_by='x')
    at = datetime(2026, 10, 24, 8, 30, tzinfo=UTC)
    standard = [Report.GROUP, Report.INDIVIDUAL, Report.PAIR_COVERAGE, Report.METADATA]
    assert export_basename(course_code='SDPX', semester='1/2569', assignment=job, reports=standard,
                           at=at, timezone='Asia/Bangkok') == 'sdpx-1-2569_group-work-1_all-reports_20261024-1530'
    thai = Assignment(**{**job.__dict__, 'name': 'งานกลุ่มครั้งที่ 1'})
    assert export_basename(course_code=None, semester=None, assignment=thai, reports=[Report.GROUP],
                           at=at, timezone='Asia/Bangkok') == 'classroom_assignment-0f1e2d3c_group-summary_20261024-1530'
