# ADR-004: ปิดตัวตนเมื่อพ้นระยะเก็บ (FR-PRIV-02) โดยไม่แก้ audit log ที่เป็น append-only

## Status

Proposed — ต้องให้ทีม/อาจารย์ยืนยันข้อยกเว้นของ audit log

## Date

2026-10-20

## Context

[PRD](../../Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md) §14.1 สั่งสองข้อที่ชนกัน:

- **FR-PRIV-02 (M)** หลังพ้นระยะเก็บ (ตัวตน/ผลประเมิน 2 ปีการศึกษา · time-on-task 1 ปีการศึกษา)
  ต้อง anonymize ด้วย pseudonym คงที่ ไม่ใช่ลบแถว
- **FR-AUDIT-01/03** audit log เป็น append-only — บังคับด้วย trigger `audit_log_no_update`
  ([003_audit_log.sql](../../backend/migrations/003_audit_log.sql)) ซึ่งเก็บ `actor_email` ไว้ทุกแถว

ระบบไม่มีปฏิทินการศึกษาของมหาวิทยาลัย จึงต้องเลือกจุดเริ่มนับ

## Decision

[app/privacy_job.py](../../backend/app/privacy_job.py) (`python -m app.privacy_job`, ค่าเริ่มต้นดูอย่างเดียว · `--apply` แก้จริง):

- **ตัวตน**: ผู้ใช้ที่ **ทุกห้อง** มีกิจกรรมล่าสุด (กำหนดส่งล่าสุดของงาน หรือวันสร้างห้อง) เก่ากว่า 2 × 365 วัน
  → แทน `email_normalized` / `email_raw` / `display_name` ใน `app_user` ด้วย pseudonym จาก HMAC ของ user id
  แถวทั้งหมดยังอยู่ คะแนนและ coverage เดิมคำนวณย้อนหลังได้ · รันซ้ำไม่แปลงซ้ำ
- **time-on-task**: งานที่ปิดรับเกิน 365 วัน → `comparison.time_on_task_ms = NULL`
- **audit log ไม่ถูกแก้** — ยังเก็บ `actor_email` เดิม (ส่วนใหญ่เป็นอีเมลผู้สอน) เพื่อคงความน่าเชื่อถือของหลักฐาน
- รันด้วยมือหรือ cron ภายนอก — ไม่มี scheduler ในแอป

## Alternatives Considered

1. **ยกเว้น trigger ชั่วคราวเพื่อแทนอีเมลใน audit log** — ตรง FR-PRIV-02 ครบ แต่ทำให้ audit ไม่ append-only จริง
2. **เก็บ audit แยก แล้วลบทั้งก้อนเมื่อพ้นระยะ** — ขัด FR-PRIV-02 ข้อ "ไม่ลบแถว"
3. **ไม่แตะ audit (ที่เลือก)** — ข้อยกเว้นเดียวที่ชัดเจนและบันทึกไว้

## Consequences

- นักศึกษาเกือบไม่ปรากฏใน `actor_email` (ผู้สอนเป็นผู้กระทำส่วนใหญ่) แต่คำร้องอุทธรณ์ของนักศึกษาบันทึก audit ด้วย
  — อีเมลนักศึกษาในแถวเหล่านั้นจึงยังอยู่หลังพ้นระยะ
- integration test ครอบส่วนตัวตน (`tests/integration/test_privacy_job.py`) · ส่วน time-on-task ยังไม่มีเทสต์ที่สร้างคำตอบเก่าจริง
