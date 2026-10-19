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
