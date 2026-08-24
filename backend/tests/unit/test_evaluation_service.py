"""unit test ของรายการที่ต้องประเมิน — อ้าง US-07

กฎเดียวที่ service นี้ตัดสินคือ "เปิดให้ดูหรือยัง" — ส่วนอื่น (คู่ไหนใครทำแล้ว)
เป็นข้อมูลดิบที่ repo join มาให้แล้ว จึงไม่ต้องมี fake repo ในไฟล์นี้เลย
"""

from app.domain.assignment_service import AssignmentStatus
from app.domain.evaluation_service import (
    NO_INDIVIDUAL_MESSAGE,
    NOT_OPENED_MESSAGE,
    EvaluationItem,
    build_my_evaluations,
)
from app.domain.pairing import Side


def item(pair_id: str, completed: bool, criterion_id: str = "c1") -> EvaluationItem:
    return EvaluationItem(
        pair_assignment_id=pair_id,
        criterion_id=criterion_id,
        criterion_name="คุณภาพงาน",
        left_id="a",
        left_label="กลุ่ม A",
        right_id="b",
        right_label="กลุ่ม B",
        completed=completed,
        choice=3 if completed else None,
    )


class Testยังไม่เปิด:
    def test_AC_assignment_ยังเป็น_DRAFT_ไม่เห็นคู่ใดเลย(self):
        result = build_my_evaluations(
            side=Side.GROUP,
            status=AssignmentStatus.DRAFT,
            side_enabled=True,
            pairs=[item("p1", completed=False), item("p2", completed=True)],
        )

        assert result.opened is False
        assert result.items == []
        assert result.total_count == 0
        assert result.completed_count == 0

    def test_AC_บอกข้อความว่าเปิดเมื่อไร(self):
        result = build_my_evaluations(
            side=Side.GROUP, status=AssignmentStatus.DRAFT, side_enabled=True, pairs=[]
        )

        assert result.message == NOT_OPENED_MESSAGE


class Testเปิดแล้ว:
    def test_AC_publish_แล้วเห็นคู่ทั้งหมดพร้อมนับความคืบหน้า(self):
        # ตัวอย่างจาก AC ของ US-07 เป๊ะ ๆ: 12 คู่ ทำไปแล้ว 5
        pairs = [item(f"p{i}", completed=i < 5) for i in range(12)]

        result = build_my_evaluations(
            side=Side.GROUP, status=AssignmentStatus.PUBLISHED, side_enabled=True, pairs=pairs
        )

        assert result.opened is True
        assert result.message is None
        assert result.completed_count == 5
        assert result.total_count == 12
        assert result.items == pairs

    def test_ยังไม่ได้ทำเลยนับ_0(self):
        pairs = [item("p1", completed=False), item("p2", completed=False)]

        result = build_my_evaluations(
            side=Side.GROUP, status=AssignmentStatus.PUBLISHED, side_enabled=True, pairs=pairs
        )

        assert result.completed_count == 0
        assert result.total_count == 2

    def test_ทำครบทุกคู่แล้ว(self):
        pairs = [item("p1", completed=True), item("p2", completed=True)]

        result = build_my_evaluations(
            side=Side.GROUP, status=AssignmentStatus.PUBLISHED, side_enabled=True, pairs=pairs
        )

        assert result.completed_count == result.total_count == 2

    def test_ไม่มีคู่เลยไม่พัง(self):
        result = build_my_evaluations(
            side=Side.GROUP, status=AssignmentStatus.PUBLISHED, side_enabled=True, pairs=[]
        )

        assert result.opened is True
        assert result.total_count == 0
        assert result.completed_count == 0


class Testฝั่งบุคคลถูกปิด:
    def test_AC_individual_max_score_0_ไม่เห็น_item_แต่มีข้อความอธิบาย(self):
        # FR-ASSIGN-07 — ปิดฝั่งบุคคลแล้วไม่มี pair ฝั่งนั้นเลย ไม่ใช่แค่รายการว่างเฉย ๆ
        result = build_my_evaluations(
            side=Side.INDIVIDUAL,
            status=AssignmentStatus.PUBLISHED,
            side_enabled=False,
            pairs=[],
        )

        assert result.opened is True
        assert result.items == []
        assert result.message == NO_INDIVIDUAL_MESSAGE

    def test_DRAFT_มาก่อนเสมอ_แม้ฝั่งบุคคลจะปิดอยู่ด้วย(self):
        # ต้องเห็นข้อความ "ยังไม่เปิด" ไม่ใช่ "ไม่มีฝั่งบุคคล" — DRAFT บังทุกอย่าง
        result = build_my_evaluations(
            side=Side.INDIVIDUAL,
            status=AssignmentStatus.DRAFT,
            side_enabled=False,
            pairs=[],
        )

        assert result.message == NOT_OPENED_MESSAGE
