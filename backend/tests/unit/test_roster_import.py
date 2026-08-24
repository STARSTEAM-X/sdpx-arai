"""unit test ของ roster import — อ้าง US-03 และกฎ R1–R7 ใน unit-brief

กฎสำคัญที่สุดคือ R1 (atomic) — มี test สองตัวคุ้มครองจากคนละมุม
"""

import pytest

from app.domain.errors import RosterImportError, RowError
from app.domain.roster_import import parse_roster_csv
from tests.factories import make_csv


class TestAtomicity:
    def test_R1_มีแถวผิดแม้แถวเดียว_ต้องไม่คืนผลบางส่วน(self):
        """CSV 100 แถว ผิดแถวที่ 42 — ต้อง raise ไม่ใช่คืน 99 แถวที่ถูก"""
        rows = [f"student{i}@uni.ac.th,G{i // 5}" for i in range(1, 101)]
        rows[40] = "ไม่ใช่อีเมล,G8"  # index 40 = แถวที่ 42 ในไฟล์ (นับ header ด้วย)

        with pytest.raises(RosterImportError) as exc:
            parse_roster_csv(make_csv(rows))

        assert [e.row for e in exc.value.rows] == [42]

    def test_แถวที่มีกลุ่มแต่ไม่มีอีเมลถูกจับเป็นแถวผิด(self):
        """เกิดจริงเมื่อคนกรอกกลุ่มไว้ก่อนแล้วลืมใส่อีเมล — ต้องไม่เงียบ"""
        with pytest.raises(RosterImportError) as exc:
            parse_roster_csv(make_csv(["a@uni.ac.th,G1", ",G1"]))

        assert exc.value.rows == [RowError(3, "ไม่มีอีเมล")]

    def test_R2_รายงานความผิดทุกแถว_ไม่ใช่แค่แถวแรก(self):
        rows = [
            "ok1@uni.ac.th,G1",
            "พัง,G1",
            "ok2@uni.ac.th,G1",
            "ก็พัง,G2",
            "ok3@uni.ac.th,",
        ]

        with pytest.raises(RosterImportError) as exc:
            parse_roster_csv(make_csv(rows))

        assert [e.row for e in exc.value.rows] == [3, 5, 6]


class TestHeaders:
    def test_R3_header_ไม่สนตัวพิมพ์เล็กใหญ่(self):
        result = parse_roster_csv(
            make_csv(["a@uni.ac.th,G1", "b@uni.ac.th,G1"], header="Email,Group_Name")
        )

        assert len(result.rows) == 2

    def test_R3_header_มีช่องว่างหัวท้ายก็ยังอ่านได้(self):
        result = parse_roster_csv(
            make_csv(["a@uni.ac.th,G1", "b@uni.ac.th,G1"], header=" email , group_name ")
        )

        assert len(result.rows) == 2

    def test_ขาด_column_ที่จำเป็นถูกปฏิเสธ(self):
        with pytest.raises(RosterImportError) as exc:
            parse_roster_csv(make_csv(["a@uni.ac.th"], header="email"))

        assert "group_name" in exc.value.message

    def test_column_ที่ไม่รู้จักถูกละไว้เฉย_ๆ(self):
        """ไฟล์จริงมักมี column เกินมาจากระบบทะเบียน ไม่ควรทำให้ import พัง"""
        result = parse_roster_csv(
            make_csv(
                ["a@uni.ac.th,G1,ปี3,หมายเหตุ", "b@uni.ac.th,G1,ปี2,-"],
                header="email,group_name,year,note",
            )
        )

        assert len(result.rows) == 2


class TestEmailNormalization:
    def test_R4_normalize_ก่อนเก็บ(self):
        result = parse_roster_csv(
            make_csv(["  Somchai.A+x@Uni.AC.TH  ,G1", "b@uni.ac.th,G1"])
        )

        assert result.rows[0].email_normalized == "somchai.a@uni.ac.th"
        assert result.rows[0].email_raw == "Somchai.A+x@Uni.AC.TH"

    def test_R5_อีเมลซ้ำหลัง_normalize_ถูกจับได้(self):
        """`a+tag@` กับ `a@` เป็นคนเดียวกัน ถ้าไม่จับจะได้ user ซ้ำในห้องเรียน"""
        with pytest.raises(RosterImportError) as exc:
            parse_roster_csv(make_csv(["a@uni.ac.th,G1", "a+tag@uni.ac.th,G2"]))

        assert exc.value.rows[0].row == 3


class TestWarnings:
    def test_R6_กลุ่มเล็กเกินไปเป็น_warning_ไม่ใช่_error(self):
        result = parse_roster_csv(
            make_csv(["a@uni.ac.th,G1", "b@uni.ac.th,G1", "c@uni.ac.th,G2"])
        )

        assert len(result.rows) == 3  # import สำเร็จ
        assert [w.type for w in result.warnings] == ["GROUP_TOO_SMALL"]
        assert "G2" in result.warnings[0].message

    def test_ทุกกลุ่มมีสมาชิกพอ_ต้องไม่มี_warning(self):
        result = parse_roster_csv(
            make_csv(["a@uni.ac.th,G1", "b@uni.ac.th,G1", "c@uni.ac.th,G2", "d@uni.ac.th,G2"])
        )

        assert result.warnings == []
        assert result.groups == ["G1", "G2"]


class TestEncoding:
    def test_R7_ไฟล์ที่มี_BOM_จาก_Excel_อ่านได้(self):
        """ถ้าไม่ตัด BOM header ตัวแรกจะกลายเป็น '\\ufeffemail' แล้วหาไม่เจอ"""
        raw = "﻿email,group_name\na@uni.ac.th,G1\nb@uni.ac.th,G1\n".encode()

        result = parse_roster_csv(raw)

        assert len(result.rows) == 2

    def test_R7_ไฟล์_cp874_ภาษาไทยอ่านได้(self):
        raw = "email,group_name,display_name\na@uni.ac.th,กลุ่ม1,สมชาย\nb@uni.ac.th,กลุ่ม1,สมหญิง\n".encode(
            "cp874"
        )

        result = parse_roster_csv(raw)

        assert result.rows[0].display_name == "สมชาย"
        assert result.groups == ["กลุ่ม1"]


class TestFormulaInjection:
    """FR-SEC-04 — เซลล์ที่ขึ้นต้นด้วย = + - @ ต้อง escape ตั้งแต่ตอน import

    เพราะ group_name/display_name ถูกนำไปแสดงในรายงานและ export ทีหลัง
    ถ้าไม่กันตั้งแต่ต้นทาง ค่าที่ปนเปื้อนจะไหลไปถึงตอน export ทันที
    """

    @pytest.mark.parametrize("trigger", ["=", "+", "-", "@"])
    def test_group_name_ที่ขึ้นต้นด้วยอักขระสูตรถูก_escape(self, trigger: str):
        raw = f"email,group_name\na@uni.ac.th,{trigger}cmd|'/c calc'!A1\n".encode()

        result = parse_roster_csv(raw)

        assert result.rows[0].group_name == f"'{trigger}cmd|'/c calc'!A1"

    def test_display_name_ที่ขึ้นต้นด้วยอักขระสูตรถูก_escape(self):
        raw = "email,group_name,display_name\na@uni.ac.th,G1,=HYPERLINK(\"http://evil\")\n".encode()

        result = parse_roster_csv(raw)

        assert result.rows[0].display_name == "'=HYPERLINK(\"http://evil\")"

    def test_ชื่อกลุ่มปกติไม่ถูกแตะต้อง(self):
        raw = "email,group_name\na@uni.ac.th,กลุ่ม A\n".encode()

        result = parse_roster_csv(raw)

        assert result.rows[0].group_name == "กลุ่ม A"


class TestEmptyInput:
    def test_ไฟล์ที่มีแต่_header_ถูกปฏิเสธ(self):
        with pytest.raises(RosterImportError):
            parse_roster_csv(make_csv([]))

    def test_บรรทัดว่างท้ายไฟล์ถูกข้าม_ไม่นับเป็นแถวผิด(self):
        """Excel มักทิ้งบรรทัดว่างไว้ท้ายไฟล์ ไม่ควรทำให้ทั้งไฟล์ถูก reject"""
        raw = b"email,group_name\na@uni.ac.th,G1\nb@uni.ac.th,G1\n,\n\n"

        result = parse_roster_csv(raw)

        assert len(result.rows) == 2
