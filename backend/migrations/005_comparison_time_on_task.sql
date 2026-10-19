-- US-08 — เก็บ time_on_task_ms ตั้งแต่ M1 แม้ยังไม่ได้ใช้จนถึง M3
--
-- PRD §10 (QS-05 Speed run) ใช้ค่านี้ตรวจจับการกดมั่ว แต่เป็นฟีเจอร์ของ M3
-- อย่างไรก็ตาม backlog.md บันทึกไว้แล้วว่า "เก็บ field ไว้ตั้งแต่ M1 ได้เพราะย้อนไปเก็บ
-- ข้อมูลเก่าไม่ได้" — ถ้ารอเพิ่มคอลัมน์ตอน M3 comparison ทุกแถวที่บันทึกไปก่อนหน้านั้น
-- จะไม่มีค่านี้ติดมาเลย และไม่มีทางย้อนกลับไปวัดเวลาที่ผ่านไปแล้ว

ALTER TABLE comparison
    ADD COLUMN IF NOT EXISTS time_on_task_ms int CHECK (time_on_task_ms IS NULL OR time_on_task_ms >= 0);
