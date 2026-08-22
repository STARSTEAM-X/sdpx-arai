"""unit test ของการ normalize อีเมล — กฎ R4 / FR-AUTH-03

test ชุดนี้บันทึก **การตัดสินใจเรื่องข้อขัดแย้งใน PRD** ไว้ด้วย
ถ้า product owner ตอบคำถามข้อ 4 มาแล้วเปลี่ยน policy test ที่ต้องแก้คือชุดนี้
"""

import pytest

from app.domain.email import is_valid_email, normalize_email


class TestNormalize:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("  A@Uni.AC.TH  ", "a@uni.ac.th"),
            ("Somchai.A@uni.ac.th", "somchai.a@uni.ac.th"),
            ("somchai+course2026@uni.ac.th", "somchai@uni.ac.th"),
            ("Somchai.A+x@Uni.AC.TH", "somchai.a@uni.ac.th"),
        ],
    )
    def test_lowercase_และตัด_tag(self, raw: str, expected: str):
        assert normalize_email(raw) == expected

    def test_ตัดจุดเฉพาะ_gmail(self):
        assert normalize_email("som.chai@gmail.com") == "somchai@gmail.com"

    def test_ไม่ตัดจุดกับ_domain_ของมหาวิทยาลัย(self):
        """กฎ FR-AUTH-03 บอกให้ตัดจุด "ใน gmail" เท่านั้น

        เหตุผลที่ยึดตามนี้: หลายมหาวิทยาลัยใช้จุดแยกชื่อกับนามสกุล
        `somchai.a@uni.ac.th` กับ `somchaia@uni.ac.th` จึงเป็นคนละคนได้จริง
        การรวมคนผิดในระบบให้คะแนน แก้ย้อนหลังยากกว่าการจับคู่ไม่ติด
        """
        assert normalize_email("somchai.a@uni.ac.th") == "somchai.a@uni.ac.th"

    def test_เปลี่ยน_policy_ได้ด้วย_config(self):
        """ถ้า product owner ตอบว่าให้ตัดจุดทุก domain ให้เปลี่ยนที่ config ตัวนี้

        ทดสอบไว้เพื่อยืนยันว่าเปลี่ยน policy ได้จริงโดยไม่ต้องแก้ logic
        """
        assert (
            normalize_email("Somchai.A+x@uni.ac.th", dot_insensitive_domains={"uni.ac.th"})
            == "somchaia@uni.ac.th"
        )

    def test_ค่าที่ไม่มี_at_คืนกลับแบบ_lowercase_เฉย_ๆ(self):
        assert normalize_email("  NotAnEmail ") == "notanemail"


class TestValidation:
    @pytest.mark.parametrize(
        "good", ["a@uni.ac.th", "somchai.a+x@student.uni.ac.th", "x@y.co"]
    )
    def test_รูปแบบที่ถูกต้อง(self, good: str):
        assert is_valid_email(good)

    @pytest.mark.parametrize(
        "bad", ["", "abc", "a@b", "a@@b.com", "a b@uni.ac.th", "@uni.ac.th"]
    )
    def test_รูปแบบที่ผิด(self, bad: str):
        assert not is_valid_email(bad)
