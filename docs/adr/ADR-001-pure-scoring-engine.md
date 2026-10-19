# ADR-001: คง Scoring Engine เป็น pure function และแยกการอ่านเขียนข้อมูลออกจากสูตร

## Status

Accepted — บันทึกย้อนหลังของการตัดสินใจ AR-01 ที่มีอยู่แล้ว ไม่ใช่การอนุมัติสถาปัตยกรรมใหม่ใน WS-08

## Date

2026-10-18 — วันที่บันทึก ADR; ไม่พบวันที่ประชุมหรือชื่อผู้ตัดสินใจเดิมในหลักฐานที่อ่าน

## Context

PairEval ใช้ผลเปรียบเทียบงานเพื่อคำนวณคะแนนจริงของนักศึกษา ผู้สอนจึงต้องอธิบายได้ว่าคะแนนมาจากข้อมูลและสูตรใด และต้องคำนวณซ้ำได้เมื่อเกิดข้อสงสัย ตาม AR-01 และ FR-SCORE-09 ใน [PRD](../../Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md)

โครงการเป็นงานวิชา ขอบเขต M1–M2 ใช้ FastAPI/Python, PostgreSQL และ React ตาม [tech stack](../../memory-bank/standards/tech-stack.md) โดย unit test ต้องไม่รอฐานข้อมูล และลูป unit ทั้งสองฝั่งรวมกันต้องอยู่ภายใน 10 วินาทีตาม AGENTS.md ไม่มีหลักฐานจำนวนสมาชิกหรือระดับทักษะรายคน จึงไม่สมมติข้อมูลเหล่านั้น

หลักฐานว่าตัดสินใจนี้มีอยู่ก่อน WS-08:

- [memory-bank/intent.md](../../memory-bank/intent.md) ระบุ AR-01 ใต้ Decisions Already Made
- [Scoring Engine unit brief](../../memory-bank/units/scoring-engine/unit-brief.md) แยกการคำนวณออกจาก persistence, authorization และการซ่อนคะแนน
- [scoring_service.py](../../backend/app/domain/scoring_service.py) รับ record/config แล้วคืนผลด้วย `Decimal` โดยไม่อ่าน SQL, HTTP หรือเวลาปัจจุบัน
- [scoring_orchestrator.py](../../backend/app/scoring_orchestrator.py) โหลดข้อมูลและบันทึกผลให้ทั้ง API และงานรายวันใช้ร่วมกัน

## Decision

คงสูตรใน `backend/app/domain/scoring_service.py` เป็น pure function: input เดียวกัน ภายใต้สูตร/config เดียวกัน ต้องได้ output เดียวกัน โดยไม่มี state ภายในและไม่มี I/O

ให้ repository โหลดเฉพาะ comparison ที่ผ่านกติกาการนำมาคำนวณ ให้ orchestrator ประกอบข้อมูลและบันทึกผลใน transaction ส่วน HTTP handler รับผิดชอบสิทธิ์ การยืนยัน finalization และ response การซ่อนคะแนนตาม k-anonymity อยู่ที่ชั้นรายงาน ไม่ตัดข้อมูลทิ้งจากสูตรคำนวณ

ใช้ `Decimal` ตลอดสูตร คะแนนที่ได้รับและ participation multiplier ยังคงเป็นคนละค่า การ finalize เก็บ snapshot ของ input/output ตามโครงสร้างที่มีอยู่ใน migration 008; ความเป็น pure function เพียงอย่างเดียวไม่รับประกันว่าจะตรวจย้อนหลังได้หากไม่มีข้อมูลเดิม

## Alternatives Considered

ทางเลือกต่อไปนี้เป็นการเปรียบเทียบย้อนหลังเพื่ออธิบายขอบเขต ไม่ได้อ้างว่ามีการประชุมลงคะแนนแต่ละทางเลือก:

1. **คำนวณใน SQL ทั้งหมด** — ลดการขนข้อมูลและใช้การ aggregate ของฐานข้อมูลได้ แต่สูตรผูกกับ PostgreSQL มากขึ้นและการทดสอบตัวอย่างคะแนนต้องยกฐานข้อมูล ซึ่งขัดกับขอบเขต pure engine และลูป unit ปัจจุบัน ยังใช้ SQL เพื่อเลือกข้อมูลได้ตามเดิม
2. **ให้ Scoring Engine อ่าน repository/เวลาปัจจุบันเอง** — ผู้เรียกส่งพารามิเตอร์น้อยลง แต่ input ของสูตรแฝงอยู่ในการอ่าน state ณ เวลาที่เรียก การ replay ต้องจำลอง I/O และสูตรอาจถูกใช้ต่างกันระหว่าง API กับงานรายวัน จึงคง orchestration แยกไว้
3. **อัปเดตคะแนนสะสมทุกครั้งที่ autosave** — อาจลดงานคำนวณเต็มชุด แต่ต้องจัดการการแก้คำตอบ การเปลี่ยนสถานะ DRAFT/SUBMITTED/EXCLUDED การ retry และการ rollback เพิ่มเติม อีกทั้ง autosave ไม่เท่ากับ submit ตามกติกาธุรกิจ ไม่เลือกเพิ่ม state ดังกล่าวในขอบเขตปัจจุบัน

## Consequences

### Positive

- ทดสอบสูตรและ worked example ได้โดยไม่ต้องใช้ PostgreSQL, Google login หรือ HTTP
- API และงานรายวันเรียกสูตรชุดเดียวกัน ลดโอกาสที่คะแนนต่างกันเพราะเส้นทางเรียก
- รับ config ชัดเจนและคืน `Decimal` ทำให้ตรวจสูตรและการปัดเศษได้
- เมื่อเก็บ input, config และผลลัพธ์ไว้ครบ จะเปรียบเทียบการคำนวณย้อนหลังได้

### Negative / Trade-offs

- ต้องมีชั้นประกอบข้อมูลและ mapping ระหว่าง row กับ domain object มากขึ้น ผู้เขียนต้องรักษาความสอดคล้องสองชั้น
- การกรองเฉพาะ SUBMITTED และขอบเขตสิทธิ์เป็นหน้าที่ของผู้เรียก engine; unit test สูตรอย่างเดียวจับข้อผิดพลาดใน SQL/authorization ไม่ได้ ต้องมี integration/E2E ด้วย
- สูตรปัจจุบันวนกรอง comparison ซ้ำต่อ item/criterion จึงอาจใช้ CPU เพิ่มเมื่อห้องใหญ่ การเป็น pure function ไม่ได้ทำให้เร็วโดยอัตโนมัติ
- การโหลดข้อมูลใน transaction เดียวไม่ใช่หลักฐานว่าป้องกันทุก concurrent update ได้ ต้องตรวจ isolation/locking ใน workflow แยกต่างหาก
- ยังต้องรักษา snapshot และเวอร์ชันสูตรเพื่ออธิบายคะแนนเก่า การเรียกโค้ดเวอร์ชันใหม่กับ input เก่าอาจได้ผลต่างเมื่อสูตรเปลี่ยน

## Revisit When

- profiling แสดงว่าการกรอง comparison ใน Python เป็นคอขวดจริง หรือ NFR 200 concurrent users ไม่ผ่านเพราะส่วนนี้
- ขนาดข้อมูลทำให้โหลด comparison ของ assignment ลง memory ไม่เหมาะสม ต้องพิจารณา batch/SQL aggregation โดยรักษา semantics เดิม
- เพิ่มสูตรหลายเวอร์ชันหรือมี requirement ให้ replay snapshot เก่าด้วยสูตรเดิม ต้องกำหนดเวอร์ชันและ compatibility ชัดเจน
- มีความต้องการ real-time scoring ที่ยืนยันแล้วและการคำนวณเต็มชุดไม่ตอบเวลาเป้าหมาย จึงค่อยเปรียบเทียบ incremental model พร้อมแผนทดสอบ

การทบทวนไม่ทำให้ยกเลิก AR-01 อัตโนมัติ หากเปลี่ยนขอบเขต pure engine ให้เขียน ADR ที่ supersede ฉบับนี้และมีผู้รับผิดชอบตัดสินใจ

## AI-DLC Note

AI proposed: ใน WS-08 AI สำรวจ SQL-only, engine ที่อ่าน repository เอง และ incremental scoring เพื่อเปรียบเทียบต้นทุนกับโครงสร้างที่มีอยู่ ไม่ได้เสนอเปลี่ยน stack หรือเพิ่ม dependency

Human decided: อ้างตามรายการ Decisions Already Made (AR-01) ใน `memory-bank/intent.md` และข้อกำหนด PRD ว่าใช้ pure function ไม่มี state ภายในเพื่อคำนวณซ้ำและ audit ได้ ไม่พบคำพูดตรง ชื่อผู้ตัดสินใจ หรือบันทึกการประชุมเดิม จึงไม่สร้างคำพูดหรืออ้างการอนุมัติใหม่แทนทีม

## Verification Evidence

- `backend/tests/unit/test_scoring_service.py` มี test ของ weighted mean, band mapping, `Decimal`, participation และ worked example (golden S10)
- `backend/tests/integration/test_scoring_repo.py` ครอบคลุมการอ่าน/บันทึกและ snapshot ใน PostgreSQL
- สถานะการรันจริงของ WS-08 ให้ดูเอกสารผล verification ของรอบนี้ ไม่ใช้รายการ test ข้างต้นแทนหลักฐานว่ารันผ่านแล้ว
