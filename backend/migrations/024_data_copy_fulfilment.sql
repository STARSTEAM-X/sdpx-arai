-- GAP-02 / FR-PRIV-03 — คำขอสำเนาข้อมูลต้องปิดงานได้และนับกำหนด 30 วันได้
-- เดิมไม่มีโค้ดใดเปลี่ยนสถานะเป็น SENT ได้เลย คำขอจึงค้างที่ IN_PROGRESS ตลอดไป
-- fulfilled_at = เวลาที่เจ้าตัวได้รับสำเนาจริงครั้งแรก (ดาวน์โหลดเอง) — ไม่ลบแถวเดิม เก็บเป็นหลักฐาน
ALTER TABLE data_copy_request ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz;

-- คำขอที่สถานะ SENT ต้องมีเวลาที่ส่งเสมอ (แถวเก่าที่อาจถูกแก้มือเป็น SENT ก่อนหน้านี้ไม่มีอยู่จริง
-- เพราะไม่เคยมีเส้นทางเปลี่ยนสถานะ แต่ใส่ NOT VALID ไว้กันกรณีนั้นไม่ให้ migration ล้ม)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_copy_request_sent_has_time') THEN
        ALTER TABLE data_copy_request ADD CONSTRAINT data_copy_request_sent_has_time
            CHECK (status <> 'SENT' OR fulfilled_at IS NOT NULL) NOT VALID;
    END IF;
END $$;
