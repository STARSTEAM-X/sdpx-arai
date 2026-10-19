"""ปกปิดตัวตนผู้ประเมินในข้อมูลที่ส่งออก — US-15, FR-EXPORT-03

แยกเป็นไฟล์ของตัวเองเพราะเป็นคนละเรื่องกับ `scoring_service.py` (นั่นคือสูตรคำนวณคะแนน
ไม่ใช่เรื่อง privacy) — pure function ล้วน ไม่รู้จัก SQL หรือ HTTP เหมือนกัน
"""


def pseudonymize_evaluators(evaluator_ids: list[str]) -> dict[str, str]:
    """map uuid จริงของผู้ประเมิน → รหัสลับ E1, E2, ... ต่อ 1 ครั้งของการ export

    เรียงตาม uuid string ก่อนนับ ไม่ใช่ตามลำดับที่เจอใน query — ทำให้ผล deterministic
    ไม่ขึ้นกับลำดับแถวที่ database คืนมา (เทียบกับ P5 ของ pairing engine: ข้อมูลเดิม
    ต้องได้ผลเดิมเสมอ) รหัสนี้ใช้ได้แค่ **ภายในไฟล์ export เดียวกัน** เท่านั้น — ไม่ใช่ id
    ถาวรของผู้ประเมิน คนละครั้งที่ export คนละชุดผู้ประเมินอาจได้รหัสไม่ตรงกัน
    """
    distinct_sorted = sorted(set(evaluator_ids))
    return {evaluator_id: f"E{i + 1}" for i, evaluator_id in enumerate(distinct_sorted)}


# FR-ANON-02 / PRD §14.2 — default ของ k_min คือ 3 และ §19 ห้ามตัดการคุ้มครองนี้
K_MIN_FLOOR = 3


def k_min(min_comparisons: int) -> int:
    """เกณฑ์ผู้ประเมินขั้นต่ำก่อนนักศึกษาเห็นคะแนนรายบุคคลของตัวเอง (GAP-01)

    PRD §11.1 ไม่มีคอลัมน์ k_min แยก จึงยังอ่านจาก `min_comparisons` ของงาน แต่ห้ามต่ำกว่า 3 —
    ถ้าผู้สอนตั้ง minComparisons = 1 เพื่อลดธง LOW_CONFIDENCE กลุ่ม 3 คน (coverage = 1)
    จะเห็นคะแนนจากผู้ประเมินคนเดียว ซึ่งเดาได้ทันทีว่าใครให้ (ความเสี่ยง R3)
    """
    return max(K_MIN_FLOOR, min_comparisons)


def individual_hidden(*, evaluator_count: int, min_comparisons: int) -> bool:
    return evaluator_count < k_min(min_comparisons)
