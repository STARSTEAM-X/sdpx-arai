"""unit test ของการปกปิดตัวตนผู้ประเมิน — อ้าง US-15, FR-EXPORT-03"""

from app.domain.anonymity import pseudonymize_evaluators


class TestPseudonymizeEvaluators:
    def test_AC_คืนรหัสที่ไม่ใช่_uuid_จริง(self):
        mapping = pseudonymize_evaluators(["u001", "u002"])

        assert set(mapping.values()) == {"E1", "E2"}
        assert "u001" not in mapping.values()

    def test_เรียงตาม_uuid_string_ไม่ใช่ลำดับที่ส่งเข้ามา(self):
        # ส่งเข้ามาไม่เรียง แต่ผลต้องเหมือนกันทุกครั้งไม่ว่าจะส่งลำดับไหน (deterministic)
        forward = pseudonymize_evaluators(["u003", "u001", "u002"])
        backward = pseudonymize_evaluators(["u002", "u003", "u001"])

        assert forward == backward
        assert forward == {"u001": "E1", "u002": "E2", "u003": "E3"}

    def test_evaluator_คนเดียวกันปรากฏหลายครั้งได้รหัสเดียว(self):
        mapping = pseudonymize_evaluators(["u001", "u001", "u002", "u001"])

        assert len(mapping) == 2
        assert mapping["u001"] != mapping["u002"]

    def test_ลิสต์ว่างคืน_dict_ว่าง(self):
        assert pseudonymize_evaluators([]) == {}

    def test_evaluator_คนเดียวได้_E1(self):
        assert pseudonymize_evaluators(["u999"]) == {"u999": "E1"}


class TestKMin:
    """GAP-01 / FR-ANON-02 — k_min ต้องไม่ต่ำกว่า 3 แม้ผู้สอนตั้ง minComparisons ต่ำกว่านั้น"""

    def test_GAP01_ตั้ง_minComparisons_1_แล้ว_k_min_ยังเป็น_3(self):
        from app.domain.anonymity import k_min

        assert k_min(1) == 3

    def test_minComparisons_สูงกว่า_3_ใช้ค่าที่สูงกว่า(self):
        from app.domain.anonymity import k_min

        assert k_min(5) == 5

    def test_GAP01_กลุ่ม_3_คน_coverage_1_ต้องถูกซ่อนแม้ตั้ง_minComparisons_1(self):
        from app.domain.anonymity import individual_hidden

        assert individual_hidden(evaluator_count=1, min_comparisons=1) is True
        assert individual_hidden(evaluator_count=3, min_comparisons=1) is False
