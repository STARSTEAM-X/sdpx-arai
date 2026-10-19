"""เขียนไฟล์ XLSX แบบเล็กที่สุด (SpreadsheetML) โดยไม่ต้องพึ่ง library ภายนอก

ทุกเซลล์ที่เป็นข้อความเขียนเป็น inline string (`t="inlineStr"`) จึงไม่มีทางถูกตีความเป็นสูตร
ต่างจาก library ทั่วไปที่แปลงข้อความขึ้นต้นด้วย "=" เป็นสูตรให้เอง · ตัวเลขเขียนเป็น `<v>` ตรง ๆ
"""
import io
import re
import zipfile
from decimal import Decimal
from xml.sax.saxutils import escape

# อักขระควบคุมที่ XML 1.0 ไม่อนุญาต — ถ้าหลุดเข้าไป Excel จะเปิดไฟล์ไม่ได้ทั้งไฟล์
_INVALID_XML = re.compile('[\x00-\x08\x0b\x0c\x0e-\x1f]')

Cell = str | int | float | Decimal | None


def _column(index: int) -> str:
    name = ''
    index += 1
    while index:
        index, rest = divmod(index - 1, 26)
        name = chr(65 + rest) + name
    return name


def _cell(ref: str, value: Cell, style: int) -> str:
    if value is None or value == '':
        return ''
    if isinstance(value, bool):
        value = 'TRUE' if value else 'FALSE'
    if isinstance(value, int | float | Decimal):
        return f'<c r="{ref}" s="{style}"><v>{value}</v></c>'
    text = escape(_INVALID_XML.sub('', str(value)))
    return f'<c r="{ref}" s="{style}" t="inlineStr"><is><t xml:space="preserve">{text}</t></is></c>'


def _sheet(rows: list[list[Cell]]) -> str:
    body = []
    for r, row in enumerate(rows, start=1):
        style = 1 if r == 1 else 0  # แถวแรกเป็นหัวตาราง ตัวหนา
        cells = ''.join(_cell(f'{_column(c)}{r}', value, style) for c, value in enumerate(row))
        body.append(f'<row r="{r}">{cells}</row>')
    freeze = ('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" '
              'activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>') if rows else ''
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f'{freeze}<sheetData>{"".join(body)}</sheetData></worksheet>')


def workbook(sheets: list[tuple[str, list[list[Cell]]]]) -> bytes:
    """`sheets` คือ [(ชื่อ sheet, แถว)] ตามลำดับที่ต้องการ · ชื่อ sheet ต้องไม่ซ้ำและยาวไม่เกิน 31 ตัว"""
    if not sheets:
        raise ValueError('ต้องมีอย่างน้อย 1 sheet')
    names = [name[:31] for name, _ in sheets]
    if len(set(names)) != len(names):
        raise ValueError('ชื่อ sheet ซ้ำกัน')
    overrides = ''.join(
        f'<Override PartName="/xl/worksheets/sheet{i}.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for i in range(1, len(sheets) + 1))
    sheet_entries = ''.join(f'<sheet name="{escape(name, {chr(34): "&quot;"})}" sheetId="{i}" r:id="rId{i}"/>'
                            for i, name in enumerate(names, start=1))
    rels = ''.join(
        f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        f'Target="worksheets/sheet{i}.xml"/>' for i in range(1, len(sheets) + 1))
    styles_id = len(sheets) + 1
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml',
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="xml" ContentType="application/xml"/>'
                   '<Override PartName="/xl/workbook.xml" '
                   'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                   '<Override PartName="/xl/styles.xml" '
                   'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                   f'{overrides}</Types>')
        z.writestr('_rels/.rels',
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
                   'Target="xl/workbook.xml"/></Relationships>')
        z.writestr('xl/workbook.xml',
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                   'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                   f'<sheets>{sheet_entries}</sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels',
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   f'{rels}<Relationship Id="rId{styles_id}" '
                   'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
                   'Target="styles.xml"/></Relationships>')
        z.writestr('xl/styles.xml',
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                   '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
                   '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
                   '<fills count="2"><fill><patternFill patternType="none"/></fill>'
                   '<fill><patternFill patternType="gray125"/></fill></fills>'
                   '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
                   '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
                   '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
                   '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
                   '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
                   '</styleSheet>')
        for i, (_, rows) in enumerate(sheets, start=1):
            z.writestr(f'xl/worksheets/sheet{i}.xml', _sheet(rows))
    return buf.getvalue()
