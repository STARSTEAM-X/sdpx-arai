# Open Questions ตาม PRD §17 — สถานะจริงของทุกข้อ

GAP-18 · แทนข้อสรุปเดิมใน [backlog.md](backlog.md) ว่า "เหลือ OQ-2 ข้อเดียว" ซึ่งไม่ครบ — §17 มี 8 ข้อ
และทุกข้อที่ใช้ default ยังต้องมีคนที่ PRD ระบุเป็นผู้ยืนยัน

สถานะ: **ตอบแล้ว** = มีคำตัดสินจากผู้ที่ PRD ระบุ · **ใช้ default** = ทำตาม default ของ §17 รอผู้ตัดสินยืนยัน ·
**เปิด** = ต้องตัดสินก่อนทำต่อ

| ID | คำถาม | ผู้ตัดสินตาม PRD | สถานะ | ค่าที่ใช้ตอนนี้ | อ้างอิง | ยืนยันเมื่อ / โดย |
|---|---|---|---|---|---|---|
| OQ-1 | `score_floor = 0.60` เหมาะกับวิชาหรือไม่ | Instructor | ใช้ default | 0.60 (ผู้สอนแก้ต่องานได้) | `backend/app/domain/assignment_service.py` (`score_floor`) | — |
| OQ-2 | M คูณทั้งก้อนหรือเฉพาะส่วนบุคคล | Instructor + Academic affairs | ใช้ default | คูณทั้งก้อน (group + individual ของคนนั้น) · คะแนนกลุ่มเองไม่ถูกลด | `backend/app/domain/scoring_service.py` (`compute_final_personal_score`) | — |
| OQ-3 | ไม่กด Finalize จนจบเทอม | Product | ตอบแล้ว (ทีม) | auto-finalize หลัง deadline 14 วัน + แจ้งเตือน | [ADR-002](adr/ADR-002-auto-finalize.md) | 2026-10-20 / ทีม |
| OQ-4 | นักศึกษาถอนกลางเทอม | Registrar | ใช้ default | `WITHDRAWN` ตัดออกจากการคำนวณ re-assign pair ที่ค้าง | `backend/migrations/019_enrollment_status.sql` | — |
| OQ-5 | เชื่อม LMS (LTI 1.3) | Instructor + IT | ใช้ default | ไม่เชื่อม ใช้ export XLSX/CSV | §7.8 Export | — |
| OQ-6 | time-on-task ต้องขอยินยอมแยกไหม | Privacy officer | ใช้ default | เก็บ และแจ้งใน privacy notice (1 ปีการศึกษา) | `frontend/src/components/PrivacyNotice.tsx` | — |
| OQ-7 | Co-teacher เห็นตัวตนผู้ประเมินไหม | Instructor | ใช้ default | ไม่เห็น (เฉพาะ OWNER) | `backend/app/domain/access.py` | — |
| OQ-8 | ห้องที่มี 2 กลุ่ม | Product | **เปิด** | default "เตือนแต่ยังทำได้" ขัดกับ FR-PAIR-02 ทางคณิตศาสตร์ (C3) · ตอนนี้: ฝั่งกลุ่มปฏิเสธพร้อมเหตุผล และผู้สอนปิดฝั่งกลุ่มได้ด้วย `groupMaxScore = 0` เพื่อใช้ฝั่งรายบุคคลต่อ | `backend/app/domain/publication.py` · GAP-11 | — |

## การตัดสินใจนอก §17 ที่ต้องให้อาจารย์รับรอง

| เรื่อง | สถานะ | อ้างอิง |
|---|---|---|
| เปิด login ทุกโดเมน + แยกนักศึกษา/ผู้สอนจากรูปแบบอีเมล (ขัด FR-AUTH-02) | ทีมตัดสินแล้ว เพื่อการสาธิต — รออาจารย์รับรอง | [ADR-007](adr/ADR-007-open-login-and-account-type.md) |
| `k_min` ใช้ค่า `minComparisons` แต่ห้ามต่ำกว่า 3 (PRD §11.1 ไม่มีคอลัมน์ `k_min` — C4) | ทำแล้ว (GAP-01) | `backend/app/domain/anonymity.py` |
| สำเนาข้อมูล FR-PRIV-03 เป็นแบบดาวน์โหลดเองทันที แทนการส่งทางอีเมล | ทำแล้ว (GAP-02) | `GET /api/me/data-copy` |
| ข้อขัดแย้งใน PRD C1 (ตัดจุดใน gmail), C2 (audit append-only vs anonymize), C5 (โดเมนต่อห้องตอน login) | รออาจารย์ชี้ขาด | prd-gap-list ส่วน C |

ช่อง "ยืนยันเมื่อ / โดย" ให้เติมเมื่อได้คำตอบจากผู้ตัดสินจริง — ห้ามเติมแทน
