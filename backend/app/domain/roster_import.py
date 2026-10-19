"""แปลงไฟล์ CSV เป็นรายชื่อสมาชิกและกลุ่ม (US-03)

หลักสำคัญ: **validate ทุกแถวให้จบก่อน แล้วค่อยคืนผล**
ฟังก์ชันนี้ไม่เขียน database เลย ทำให้กฎ atomic (R1) บังคับใช้ได้จริง
เพราะชั้นบนจะได้ผลลัพธ์ทั้งก้อนหรือได้ error ทั้งก้อนเท่านั้น
"""

import csv
import io

from app.domain.email import is_valid_email, normalize_email
from app.domain.errors import RosterImportError, RowError
from app.domain.models import RosterImportResult, RosterRow, RosterWarning

REQUIRED_HEADERS = {"email", "group_name"}
OPTIONAL_HEADERS = {"student_id", "display_name"}
MIN_GROUP_SIZE = 2

# FR-SEC-04 — เซลล์ที่ขึ้นต้นด้วยตัวเหล่านี้ถูกโปรแกรม spreadsheet ตีความเป็นสูตร
# ต้อง escape ตั้งแต่ตอน import เพราะ group_name/display_name จะถูกนำไปโชว์ใน export
# ทีหลัง (รายงาน, XLSX) — ถ้าไม่กันตั้งแต่ต้นทาง ค่าที่ปนเปื้อนจะไหลไปถึงตอน export ทันที
_FORMULA_TRIGGER_CHARS = ("=", "+", "-", "@")


def _escape_formula_injection(value: str) -> str:
    """เติม `'` นำหน้าเพื่อบังคับให้ Excel/Sheets อ่านเป็นข้อความ ไม่ใช่สูตร"""
    if value.startswith(_FORMULA_TRIGGER_CHARS):
        return f"'{value}"
    return value

# เรียงตามความน่าจะเป็นของไฟล์ที่ได้จาก Excel ภาษาไทย (R7)
_ENCODINGS = ("utf-8-sig", "utf-8", "cp874", "tis-620")


def _decode(raw: bytes) -> str:
    """ถอดรหัสไฟล์โดยลองหลาย encoding

    `utf-8-sig` มาก่อนเพราะจัดการ BOM ที่ Excel ใส่มาให้ด้วย
    ถ้าไม่ตัด BOM ออก header ตัวแรกจะกลายเป็น '\\ufeffemail' แล้วหาไม่เจอ
    """
    for enc in _ENCODINGS:
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise RosterImportError(
        "อ่านไฟล์ไม่ได้ — ไม่รองรับ encoding นี้ กรุณาบันทึกเป็น UTF-8",
        rows=[],
    )


def parse_roster_csv(raw: bytes) -> RosterImportResult:
    """อ่าน CSV แล้วคืนรายชื่อที่พร้อมบันทึก

    ถ้ามีแถวใดผิด จะ raise RosterImportError พร้อมความผิด **ทุกแถว**
    และผู้เรียกต้องไม่บันทึกอะไรเลย (R1)
    """
    text = _decode(raw)
    reader = csv.DictReader(io.StringIO(text))

    # R3 — header ไม่สนตัวพิมพ์เล็กใหญ่และช่องว่างหัวท้าย
    raw_headers = reader.fieldnames or []
    header_map = {h.strip().lower(): h for h in raw_headers if h}

    missing = REQUIRED_HEADERS - header_map.keys()
    if missing:
        raise RosterImportError(
            f"CSV ขาด column ที่จำเป็น: {', '.join(sorted(missing))}",
            rows=[],
        )

    def cell(record: dict[str, str], key: str) -> str:
        source = header_map.get(key)
        if source is None:
            return ""
        return (record.get(source) or "").strip()

    rows: list[RosterRow] = []
    errors: list[RowError] = []
    seen_emails: dict[str, int] = {}

    # เริ่มที่ 2 เพราะแถว 1 คือ header — เลขที่รายงานต้องตรงกับที่คนเห็นใน Excel
    for line_no, record in enumerate(reader, start=2):
        email_raw = cell(record, "email")
        group_name = cell(record, "group_name")

        # ข้ามแถวว่างสนิท ไฟล์จาก Excel มักมีบรรทัดว่างท้ายไฟล์
        if not email_raw and not group_name:
            continue

        if not email_raw:
            errors.append(RowError(line_no, "ไม่มีอีเมล"))
            continue

        # R5 — อีเมลผิดรูปแบบ
        if not is_valid_email(email_raw):
            errors.append(RowError(line_no, f"อีเมลผิดรูปแบบ: {email_raw}"))
            continue

        # R5 — group_name ว่าง
        if not group_name:
            errors.append(RowError(line_no, "ไม่ได้ระบุ group_name"))
            continue

        # R4 — normalize ก่อนใช้เป็น key
        email_norm = normalize_email(email_raw)

        # R5 — อีเมลซ้ำ (เทียบหลัง normalize จึงจับ somchai.a+x กับ somchaia ได้)
        if email_norm in seen_emails:
            errors.append(
                RowError(line_no, f"อีเมลซ้ำกับแถว {seen_emails[email_norm]}: {email_norm}")
            )
            continue
        seen_emails[email_norm] = line_no

        student_id = cell(record, "student_id") or None
        display_name = cell(record, "display_name") or None

        rows.append(
            RosterRow(
                row_number=line_no,
                email_normalized=email_norm,
                email_raw=email_raw,
                group_name=_escape_formula_injection(group_name),
                student_id=_escape_formula_injection(student_id) if student_id else None,
                display_name=_escape_formula_injection(display_name) if display_name else None,
            )
        )

    # R1 + R2 — มีแถวผิดแม้แถวเดียว ก็ไม่คืนผลบางส่วน และรายงานความผิดทุกแถว
    if errors:
        raise RosterImportError(
            f"พบข้อผิดพลาด {len(errors)} แถว — ไม่มีแถวใดถูกบันทึก",
            rows=errors,
        )

    if not rows:
        raise RosterImportError("ไฟล์ไม่มีข้อมูลที่นำเข้าได้", rows=[])

    # R6 — กลุ่มเล็กเกินไปเป็นเพียง warning ไม่ใช่ error
    group_sizes: dict[str, int] = {}
    for row in rows:
        group_sizes[row.group_name] = group_sizes.get(row.group_name, 0) + 1

    warnings = [
        RosterWarning(
            type="GROUP_TOO_SMALL",
            message=f"กลุ่ม '{name}' มีสมาชิก {size} คน (น้อยกว่า {MIN_GROUP_SIZE})",
        )
        for name, size in sorted(group_sizes.items())
        if size < MIN_GROUP_SIZE
    ]

    return RosterImportResult(
        rows=rows,
        groups=sorted(group_sizes),
        warnings=warnings,
    )
