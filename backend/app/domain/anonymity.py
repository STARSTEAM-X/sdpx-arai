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
