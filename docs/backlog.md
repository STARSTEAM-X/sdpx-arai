# Product Backlog — PairEval (M1 Walking Skeleton)

> ไฟล์นี้คือ **ต้นฉบับของ GitHub Issues** — เขียนไว้ใน repo เพื่อให้ diff ได้และ AI อ่านได้
> ทุก story ที่นี่ต้องถูกสร้างเป็น issue จริงบน GitHub (ดูหัวข้อ "วิธีสร้าง Issues" ท้ายไฟล์)
>
> **ขอบเขต:** M1 Walking Skeleton ตาม PRD §19 —
> `Login → สร้าง classroom → import CSV → สร้าง assignment → generate pairs → ประเมิน 1 criterion → เห็นคะแนน`

## Labels ที่ต้องสร้าง

| Label | สี | ใช้เมื่อ |
|---|---|---|
| `user-story` | `#0e8a16` | story ที่ส่งมอบคุณค่าให้ผู้ใช้ |
| `bug` | `#d73a4a` | ของที่เคยทำงานแล้วพัง |
| `enhancement` | `#a2eeef` | ปรับปรุงของเดิมที่ไม่ใช่ story ใหม่ |
| `tech-debt` | `#fbca04` | หนี้ที่ยอมรับไว้ชั่วคราว รวมถึงข้อเสนอ AI ที่ "ยังไม่ตัดสิน" |

## Definition of Done (ใช้ร่วมกันทุก story)

- [ ] Feature ทำงานได้ตาม acceptance criteria ทุกข้อ
- [ ] มี unit test ครอบคลุม business rule ของ story นี้
- [ ] มี E2E test สำหรับ AC อย่างน้อย 1 ข้อ (ทำจริงใน WS-04)
- [ ] Code ผ่าน review จากสมาชิกในกลุ่ม
- [ ] Deploy ขึ้น staging แล้วเปิดใช้ได้จริง

---

## US-01 — เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย

`user-story` · Sprint 1 · อ้าง FR-AUTH-01, FR-AUTH-02, FR-AUTH-03

**As a** นักศึกษาหรืออาจารย์
**I want to** เข้าสู่ระบบด้วยบัญชี Google ของมหาวิทยาลัย
**So that** ไม่ต้องจำรหัสผ่านอีกชุด และระบบรู้ว่าฉันเป็นใครในห้องเรียนไหน

**Acceptance Criteria**

- Given ผู้ใช้ยังไม่ login, When เปิดหน้าที่ต้องใช้สิทธิ์, Then ระบบพาไปหน้า Google consent
- Given อีเมลอยู่นอก domain ที่ classroom อนุญาต, When login สำเร็จกับ Google, Then ระบบปฏิเสธพร้อมข้อความบอกว่า domain ไหนที่รับ
- Given roster มีอีเมล `Somchai.A+x@kmitl.ac.th`, When login ด้วย `somchai.a@kmitl.ac.th`, Then จับคู่กับ roster ได้สำเร็จ
- Given ผู้ใช้ login สำเร็จครั้งแรก, When ระบบพบ user สถานะ `PENDING`, Then เปลี่ยนเป็น `ACTIVE` และบันทึก `google_sub`

---

## US-02 — สร้างห้องเรียน

`user-story` · Sprint 1 · อ้าง FR-CLASS-01

**As an** อาจารย์
**I want to** สร้างห้องเรียนพร้อมกำหนด timezone และ domain อีเมลที่อนุญาต
**So that** มีที่รวมงานและรายชื่อของรายวิชานั้น

**Acceptance Criteria**

- Given ฉันเป็นผู้ใช้ที่ login แล้ว, When สร้าง classroom ด้วยชื่อและ timezone, Then ได้ classroom ที่ฉันเป็น `OWNER` และตอบ 201 พร้อม body ของ classroom ที่สร้าง
- Given ส่งชื่อว่าง, When สร้าง classroom, Then ตอบ 422 พร้อมระบุ field ที่ผิด
- Given มี classroom ชื่อ slug ซ้ำอยู่แล้ว, When สร้างซ้ำ, Then ตอบ 409

---

## US-03 — นำเข้ารายชื่อนักศึกษาจาก CSV

`user-story` · Sprint 1 · อ้าง FR-CLASS-02, FR-CLASS-03, FR-CLASS-04

**As an** อาจารย์
**I want to** อัปโหลด CSV ที่มี `email`, `group_name` เพื่อสร้างรายชื่อและกลุ่มในครั้งเดียว
**So that** ไม่ต้องพิมพ์รายชื่อ 200 คนทีละคน

**Acceptance Criteria**

- Given CSV ถูกต้องทั้งไฟล์, When import, Then สร้าง user (สถานะ `PENDING` ถ้ายังไม่เคย login), group และ membership ครบทุกแถว
- Given CSV 100 แถว มีแถวที่ 42 อีเมลผิดรูปแบบ, When import, Then **ไม่มีแถวไหนถูกบันทึกเลย** และ error ระบุว่า `row 42`
- Given CSV มี header ตัวพิมพ์ใหญ่ `Email,Group_Name`, When import, Then ยอมรับได้ (ไม่สนตัวพิมพ์เล็กใหญ่)
- Given CSV มีกลุ่มที่มีสมาชิกคนเดียว, When import, Then สำเร็จแต่รายงานเตือนแยกประเภทว่ากลุ่มไหนมีสมาชิกน้อยกว่า 2

> ข้อ atomic เป็นหัวใจของ story นี้ — import ครึ่ง ๆ กลาง ๆ แก้ยากกว่าไม่ import เลย

---

## US-04 — สร้างงานประเมินพร้อมเกณฑ์และน้ำหนัก

`user-story` · Sprint 2 · อ้าง FR-ASSIGN-01, FR-ASSIGN-02, FR-ASSIGN-07

**As an** อาจารย์
**I want to** สร้าง assignment พร้อมเกณฑ์ย่อยและน้ำหนักของแต่ละเกณฑ์
**So that** นักศึกษาประเมินตามมาตรฐานเดียวกัน

**Acceptance Criteria**

- Given ฉันเป็น OWNER ของ classroom, When สร้าง assignment พร้อม criteria ที่น้ำหนักรวม 100%, Then ได้ assignment สถานะ `DRAFT` และตอบ 201
- Given criteria ฝั่ง GROUP มีน้ำหนักรวม 90%, When พยายาม publish, Then ตอบ 422 พร้อมบอกว่าขาดอีกเท่าไร
- Given assignment สถานะ `PUBLISHED`, When แก้ criteria, Then ตอบ 409 พร้อมบอกว่าต้อง unpublish ก่อน
- Given ตั้ง `individual_max_score = 0`, When publish, Then ระบบไม่สร้าง pair ฝั่ง INDIVIDUAL เลย

---

## US-05 — ดูความเป็นไปได้ก่อนเผยแพร่งาน

`user-story` · Sprint 2 · อ้าง FR-PAIR-04, FR-PAIR-05

**As an** อาจารย์
**I want to** เห็นตัวเลข coverage ที่ทำได้จริงและภาระต่อคน ก่อนกด publish
**So that** ไม่ตั้งค่าที่เป็นไปไม่ได้แล้วมารู้ทีหลังตอนนักศึกษาเริ่มประเมินแล้ว

**Acceptance Criteria**

- Given assignment สถานะ DRAFT ที่มี roster และ criteria ครบ, When เรียกดู feasibility, Then ได้ coverage ที่ทำได้จริง, workload ต่อคน และจำนวน comparison รวม
- Given ตั้ง `target_coverage = 5` แต่ขนาดกลุ่มทำให้เป็นไปไม่ได้, When ดู feasibility, Then ระบบเสนอค่าสูงสุดที่ทำได้ **พร้อมตัวเลขเหตุผล** ไม่ใช่แค่คำเตือนลอย ๆ

---

## US-06 — เผยแพร่งานแล้วระบบจัดคู่ให้อัตโนมัติ

`user-story` · Sprint 2 · อ้าง FR-PAIR-01, FR-PAIR-02, FR-PAIR-03, FR-PAIR-06, FR-PAIR-08, FR-PAIR-09

**As an** อาจารย์
**I want to** กด publish แล้วระบบจัดคู่ประเมินให้ทุกคนโดยอัตโนมัติ
**So that** ไม่ต้องจัดเองซึ่งทั้งช้าและมีอคติ

**Acceptance Criteria**

- Given assignment DRAFT ที่ผ่าน feasibility, When publish, Then สร้าง pair ทั้งหมดเก็บลง database และเปลี่ยนสถานะเป็น `PUBLISHED`
- Given evaluator เป็นสมาชิกกลุ่ม X, When ดูคู่ที่ได้รับฝั่ง GROUP, Then **ต้องไม่มีคู่ไหนที่มีกลุ่ม X อยู่**
- Given ประเมินฝั่ง INDIVIDUAL, When ดูคู่ที่ได้รับ, Then ทุกคู่อยู่ในกลุ่มตัวเองและไม่มีตัวเองอยู่ในคู่
- Given publish ด้วย `pairing_seed` เดิม, When generate ซ้ำ, Then ได้ผลลัพธ์เหมือนเดิมทุกประการ
- Given ดู pair ทั้งหมด, When นับ coverage ของแต่ละคู่, Then ส่วนต่างระหว่างคู่ใด ๆ ไม่เกิน 1

---

## US-07 — นักศึกษาเห็นรายการงานที่ต้องประเมิน

`user-story` · Sprint 3

**As a** นักศึกษา
**I want to** เห็นว่าฉันต้องประเมินอะไรบ้าง เหลืออีกกี่คู่ และ deadline เมื่อไร
**So that** วางแผนเวลาได้และไม่ลืมส่ง

**Acceptance Criteria**

- Given ฉันมีคู่ที่ต้องประเมิน 12 คู่ ทำไปแล้ว 5, When เปิดหน้ารายการ, Then เห็นความคืบหน้า 5/12 และรายการคู่ที่เหลือ
- Given assignment ยังไม่ถึงเวลาเปิด, When เปิดหน้ารายการ, Then ไม่เห็นคู่ใด ๆ และเห็นข้อความบอกว่าเปิดเมื่อไร
- Given deadline ผ่านไปแล้ว, When พยายามเปิดคู่ที่ยังไม่ได้ทำ, Then ตอบ 409 พร้อม `code: DEADLINE_PASSED`
- Given แสดง deadline, When ฉันอยู่คนละ timezone, Then เวลาที่เห็นเป็น timezone ของ classroom เสมอ

---

## US-08 — ประเมินคู่ด้วยมาตรวัด 6 ระดับ พร้อมบันทึกอัตโนมัติ

`user-story` · Sprint 3 · อ้าง D1, D8, FR-API-01

**As a** นักศึกษา
**I want to** เลือกว่าผลงานไหนดีกว่าและดีกว่ามากแค่ไหน โดยระบบจำคำตอบให้เอง
**So that** ทำต่อจากเดิมได้ถ้าเน็ตหลุดหรือเปลี่ยนเครื่อง

**Acceptance Criteria**

- Given เปิดหน้าคู่ประเมิน, When ดูตัวเลือก, Then มี **6 ระดับ และไม่มีตัวเลือก "เท่ากัน"**
- Given เลือกคำตอบ, When ผ่านไป 2 วินาทีโดยไม่กดอะไร, Then ระบบบันทึกเป็น `DRAFT` อัตโนมัติ
- Given เรียก autosave ซ้ำด้วย body เดิม, When ส่งซ้ำหลายครั้ง, Then ผลลัพธ์เหมือนเดิม (idempotent) ไม่เกิดแถวซ้ำ
- Given ผู้ประเมินคนละคนเปิดคู่เดียวกัน, When ดูตำแหน่งซ้ายขวา, Then ตำแหน่งถูกสุ่มและบันทึกไว้ว่าใครเห็นแบบไหน
- Given ฉันไม่ใช่ evaluator ของคู่นี้, When พยายามบันทึกคำตอบ, Then ตอบ 403

---

## US-09 — ส่งคำตอบทั้งชุด

`user-story` · Sprint 3 · อ้าง FR-API-02, FR-EVAL-05, FR-EVAL-06

**As a** นักศึกษา
**I want to** กดส่งเมื่อไรก็ได้ และแก้แล้วส่งใหม่ได้จนถึง deadline
**So that** รู้แน่ว่างานถูกนับแล้ว

**Acceptance Criteria**

- Given ประเมินครบทุกคู่ของ side นั้น, When กดส่ง, Then ทุก comparison เปลี่ยนสถานะเป็น `SUBMITTED` และตอบ 200
- Given ยังตอบไม่ครบ, When กดส่ง, Then ระบบแสดงจำนวนที่ยังไม่ตอบให้ยืนยันก่อน แล้ว**รับ submission ตามปกติ** — ปุ่มส่งเปิดใช้ได้ตลอด ไม่ตอบ 422
- Given ฉัน submit ไปแล้วและยังไม่ถึง deadline, When แก้คำตอบแล้วส่งใหม่, Then รับได้ไม่จำกัดครั้ง ระบบเก็บทุกเวอร์ชันไว้ และใช้ครั้งล่าสุดในการคำนวณ
- Given กดส่งซ้ำด้วย `Idempotency-Key` เดิม, When ส่งซ้ำ, Then ไม่เกิดผลซ้ำซ้อนและได้ผลลัพธ์เดิม
- Given deadline ผ่านแล้ว, When กดส่ง, Then ตอบ 409 `DEADLINE_PASSED` และหน้าจอเปลี่ยนเป็น read-only

> **บันทึกการตัดสินใจ — AC ข้อ 2 ถูกแก้เมื่อ 2026-08-24**
>
> ของเดิมเขียนว่า "ยังทำไม่ครบ → 422" ซึ่ง**ขัด FR-EVAL-05 โดยตรง**
> ที่ระบุว่าปุ่ม Submit ต้องเปิดใช้ได้ตลอดแม้ตอบไม่ครบ เพียงแต่ต้องแสดงจำนวนที่ยังไม่ตอบก่อนยืนยัน
> เหตุผลของ PRD คือ partial submission มีค่ามากกว่าไม่มีอะไรเลย — การบล็อกไว้ทำให้คนที่ทำไม่ทัน
> ไม่ส่งอะไรเลย แล้ว coverage หายทั้งก้อน ซึ่งกระทบคะแนนของ **คนอื่น** ไม่ใช่แค่ตัวเขาเอง
>
> และของเดิมไม่มี AC เรื่อง re-submit ทั้งที่ FR-EVAL-06 บังคับให้แก้แล้วส่งใหม่ได้ไม่จำกัดก่อน deadline
> — ข้อนี้ตอบคำถามที่เคยค้างข้อ 1 ไปในตัว

---

## US-10 — นักศึกษาดูคะแนนของตัวเอง

`user-story` · Sprint 3 · อ้าง D2, D5, D7

**As a** นักศึกษา
**I want to** เห็นคะแนนที่ได้รับหลังอาจารย์ยืนยันผล
**So that** รู้ผลและเข้าใจว่าคะแนนมาจากอะไร

**Acceptance Criteria**

- Given assignment สถานะ `FINALIZED`, When ดูคะแนนตัวเอง, Then เห็นคะแนนกลุ่มและคะแนนรายบุคคลของตัวเองเท่านั้น
- Given assignment ยังไม่ `FINALIZED`, When ดูคะแนน, Then ตอบ 404 หรือข้อความว่ายังไม่ประกาศผล
- Given จำนวนผู้ประเมินยังไม่ถึงเกณฑ์ k-anonymity, When ดูคะแนนรายบุคคล, Then ระบบไม่แสดงและอธิบายเหตุผล
- Given ฉันไม่ได้ประเมินเพื่อนเลย, When ดูคะแนน, Then คะแนนที่ได้รับยังคงคำนวณตามปกติ แต่มีตัวคูณการมีส่วนร่วมแยกให้เห็น

---

## US-11 — กันการเข้าถึงข้ามห้องเรียน

`user-story` · Sprint 1 · อ้าง FR-AUTHZ-01, FR-AUTHZ-02

**As a** ผู้ดูแลระบบ
**I want to** ให้ทุก endpoint ตรวจสิทธิ์ที่ server เสมอ
**So that** ข้อมูลของห้องเรียนหนึ่งไม่รั่วไปอีกห้องเรียน แม้จะเดา URL ถูก

**Acceptance Criteria**

- Given ฉันเป็น student, When เรียก endpoint ที่เป็นของ instructor ตรง ๆ, Then ตอบ 403
- Given ฉันเป็นสมาชิก classroom A, When ขอ resource ของ classroom B, Then ตอบ **404 ไม่ใช่ 403** เพื่อไม่ให้รู้ว่า resource นั้นมีอยู่จริง
- Given ไม่ได้แนบ token, When เรียก endpoint ที่ต้องใช้สิทธิ์, Then ตอบ 401

---

## US-12 — จัดการผู้ร่วมสอนและ TA

`user-story` · Sprint 2 · อ้าง FR-CLASS-06, FR-AUTHZ-01, FR-AUTHZ-03

**As an** อาจารย์เจ้าของห้องเรียน
**I want to** เพิ่มอาจารย์ร่วมสอนและ TA เข้าห้องเรียน พร้อมกำหนดว่าใครทำอะไรได้
**So that** แบ่งงานดูแลรายชื่อและตรวจงานได้ โดยไม่ต้องยกสิทธิ์ตัดสินคะแนนให้ทุกคน

**Acceptance Criteria**

- Given ฉันเป็น `OWNER`, When เพิ่มสมาชิกด้วยอีเมลและ role `CO_TEACHER` หรือ `TA`, Then ได้สมาชิกใหม่และตอบ 201 — ถ้าอีเมลนั้นยังไม่เคย login ให้สร้าง user สถานะ `PENDING` เหมือน US-03
- Given ฉันเป็น `CO_TEACHER` หรือ `TA`, When เพิ่มหรือลบสมาชิก, Then ตอบ 403 — เฉพาะ `OWNER` เท่านั้นที่จัดการสมาชิกฝั่งผู้สอนได้
- Given ห้องเรียนเหลือ `OWNER` คนเดียว, When ลบ owner คนนั้น (รวมถึงลบตัวเอง), Then ตอบ 409 พร้อม `code: LAST_OWNER`
- Given อีเมลที่เพิ่มอยู่นอก `allowed_email_domains` ของห้องเรียน, When เพิ่มสมาชิก, Then ตอบ 422 พร้อมบอก domain ที่รับ (กฎเดียวกับ US-01)
- Given อีเมลนั้นเป็น `STUDENT` ในห้องนี้อยู่แล้ว, When เพิ่มเป็น `TA`, Then ตอบ 409 — 1 คนมีได้ 1 role ต่อ 1 ห้องเรียน แต่เป็นคนละ role ในห้องอื่นได้ (FR-AUTHZ-03)
- Given ห้องเรียนมี `CO_TEACHER` และ `TA` อยู่แล้ว, When import CSV รายชื่อนักศึกษาทับ, Then สมาชิกฝั่งผู้สอนต้องไม่ถูกลบ — ล้างเฉพาะแถว `STUDENT`
- Given ฉันไม่ใช่สมาชิกของห้องเรียนนี้, When เรียก endpoint จัดการสมาชิก, Then ตอบ 404 ไม่ใช่ 403 (กฎเดียวกับ US-11)

**สิทธิ์ที่ต้องบังคับเมื่อมี role ครบ** — จาก role matrix ใน PRD §3 ทุกข้อเช็คที่ server

- Given ฉันเป็น `TA`, When สร้างหรือแก้ assignment, Then ตอบ 403 — TA ดูแลได้แค่ roster
- Given ฉันเป็น `CO_TEACHER`, When สร้างหรือแก้ assignment, Then สำเร็จ
- Given ฉันเป็น `CO_TEACHER`, When finalize คะแนน, Then ตอบ 403 — การตัดสินคะแนนสุดท้ายเป็นของ `OWNER` เท่านั้น
- Given ฉันเป็น `TA`, When จัดการ roster หรือ import CSV, Then สำเร็จ

> AC สองข้อท้ายของกลุ่มแรกคือข้อที่กัน regression ของ US-03 และ US-11 โดยตรง
>
> story นี้บังคับให้แตก `INSTRUCTOR_ROLES` ใน `backend/app/domain/access.py` ออกเป็นสิทธิ์ราย capability
> ตอนนี้ OWNER / CO_TEACHER / TA ถูกรวมเป็นก้อนเดียว ซึ่งยัง**ถูก**อยู่ตราบใดที่ระบบมีแค่ roster
> เพราะทั้งสาม role จัดการ roster ได้จริงตาม matrix — แต่พอมี assignment เมื่อไร ก้อนเดียวจะกลายเป็นช่องโหว่ทันที
>
> ต้องเพิ่ม `POST` / `DELETE /api/classrooms/{classroomId}/members` เข้า `docs/openapi.yaml` ด้วย
> PRD §12 ระบุ endpoint นี้ไว้แล้วแต่ตกหล่นตอนเขียน spec รอบ WS-02 — ช่องโหว่แบบเดียวกับที่ US-01 เคยเจอ

---

## US-13 — อาจารย์ตัดสินและประกาศคะแนน

`user-story` · Sprint 3 · อ้าง FR-SCORE-05, FR-SCORE-07, FR-SCORE-08, FR-SCORE-09, FR-AUDIT-01

**As an** อาจารย์เจ้าของห้องเรียน
**I want to** ตรวจคะแนนที่ระบบคำนวณ แก้เป็นรายกรณีพร้อมเหตุผล แล้วกดประกาศผล
**So that** คะแนนที่นักศึกษาเห็นคือคะแนนที่ฉันรับผิดชอบ ไม่ใช่ตัวเลขที่เครื่องตัดสินเอง

**Acceptance Criteria**

- Given assignment สถานะ `PUBLISHED` ที่ deadline ผ่านแล้ว, When กด finalize, Then สถานะเป็น `FINALIZED` และระบบ snapshot ทั้ง input และ output ของการคำนวณไว้ — อ่านย้อนหลังได้แม้สูตรจะเปลี่ยนไปแล้ว
- Given มี item ที่ติด flag `LOW_CONFIDENCE` (comparison < `min_comparisons` default 3), When กด finalize, Then ระบบ**ไม่** finalize ให้อัตโนมัติ ต้องให้อาจารย์ยืนยันรายตัวก่อน
- Given ฉัน override คะแนนของกลุ่มหรือของคน, When ไม่กรอกเหตุผล, Then ตอบ 422 — เหตุผลเป็น field บังคับ ไม่ใช่ช่องให้เปล่าได้
- Given override สำเร็จ, When เปิด audit log, Then มี record ที่บอก actor, ค่าก่อน, ค่าหลัง, เหตุผล และเวลาเป็น UTC
- Given คะแนนที่ยังไม่ finalize, When แสดงที่ใดก็ตามทั้งฝั่งอาจารย์และนักศึกษา, Then ต้องมี label "ชั่วคราว — อาจเปลี่ยนแปลงได้" กำกับเสมอ
- Given assignment `FINALIZED` แล้ว, When กด reopen, Then บันทึก audit และคะแนนกลับเป็นชั่วคราวจนกว่าจะ finalize ใหม่
- Given ฉันเป็น `CO_TEACHER`, When กด finalize, Then ตอบ 403 — การตัดสินคะแนนสุดท้ายเป็นของ `OWNER` เท่านั้น (คู่กับ US-12)

> story นี้คือช่องว่างที่ทำให้ M1 ปิดไม่ได้ — US-10 เริ่มด้วย "Given assignment สถานะ `FINALIZED`"
> แต่ก่อนหน้านี้ไม่มี story ไหนทำให้สถานะนั้นเกิดขึ้นเลย

---

## US-14 — บันทึก audit ของทุกการกระทำที่ย้อนกลับไม่ได้

`user-story` · Sprint 2 · อ้าง FR-AUDIT-01, FR-AUDIT-02, FR-AUDIT-03

**As a** ผู้ดูแลระบบและอาจารย์ผู้รับผิดชอบคะแนน
**I want to** ให้ทุกการกระทำที่กระทบคะแนนหรือความเป็นส่วนตัวถูกบันทึกไว้แบบลบไม่ได้
**So that** เมื่อมีคนถามว่า "ทำไมคะแนนเปลี่ยน" หรือ "ใครเปิดดูข้อมูลนี้" ตอบได้ด้วยหลักฐาน ไม่ใช่ความจำ

**Acceptance Criteria**

- Given เกิดเหตุการณ์ publish, unpublish, pair regeneration, score override, finalize, reopen, export ที่มี identity, การเข้าถึง evaluator identity หรือการเปลี่ยน role, When เหตุการณ์นั้นสำเร็จ, Then มี audit record ทุกครั้งโดยไม่มีข้อยกเว้น
- Given audit record หนึ่ง, When อ่าน, Then มีครบ: actor, action, resource, ค่าก่อน/หลัง, timestamp เป็น UTC, IP และ reason สำหรับ action ที่บังคับเหตุผล
- Given มีคนพยายามลบหรือแก้ audit record, When ค้นทุก endpoint ที่มี, Then ไม่มีทางทำได้ — append-only ทั้งชั้น API และสิทธิ์ระดับ database
- Given action สำเร็จแต่การเขียน audit ล้มเหลว, When จบ transaction, Then ต้อง rollback ทั้งคู่ — ห้ามมี action ที่สำเร็จโดยไม่มีร่องรอย
- Given ฉันเป็นนักศึกษา, When ขอดู audit log, Then ตอบ 403

> **ทำไมอยู่ Sprint 2 ไม่ใช่ Sprint 3** — เหตุการณ์แรกที่ต้องบันทึกคือ publish ซึ่งคือ US-06 ใน Sprint นี้
> audit ที่มาทีหลังจะมีช่องว่างของ event ที่ผ่านไปแล้วเสมอ และย้อนไปเก็บไม่ได้
>
> PRD §19 จัดให้อยู่กลุ่ม **ห้ามตัด** ร่วมกับ FR-ANON-01 และ FR-AUTHZ-01/02
> ด้วยเหตุผลเดียวกัน: พลาดแล้วแก้ทีหลังไม่ได้

---

## US-15 — ปิดทุกทางที่นักศึกษาจะรู้ว่าใครประเมินตน

`user-story` · Sprint 3 · อ้าง FR-ANON-01, FR-ANON-02, FR-ANON-03, FR-ANON-04, FR-ANON-05, FR-EXPORT-03, FR-EXPORT-04

**As a** นักศึกษา
**I want to** มั่นใจว่าไม่มีใครสืบได้ว่าฉันให้คะแนนใครไว้อย่างไร
**So that** ประเมินตามที่เห็นจริงได้ โดยไม่ต้องกลัวผลกระทบกับเพื่อน

**Acceptance Criteria**

- Given ฉันเป็นนักศึกษา, When เรียกทุก endpoint ที่คืนคะแนนหรือ comparison ที่เกี่ยวกับตัวเอง, Then ไม่มี field ใดระบุตัวผู้ประเมินได้ ไม่ว่าเป็น id, อีเมล หรือค่าที่ join กลับไปหาคนได้
- Given ผู้ประเมินที่ submit แล้วยังน้อยกว่า `k_min` (default 3), When ดูคะแนนรายบุคคลของตัวเอง, Then แสดงว่า "ยังมีข้อมูลไม่พอ" ไม่ใช่ตัวเลขคะแนน
- Given ฉันเปิดหน้าคะแนนวันนี้เทียบกับเมื่อวาน, When ดู, Then ระบบไม่แสดง delta, กราฟย้อนหลัง หรือเวลาที่ค่าเปลี่ยน — เห็นค่าก่อน/หลังเมื่อไร ก็อนุมานได้ว่าใครเพิ่งส่ง
- Given กลุ่มขนาด `m = 3`, When อาจารย์จะเปิด individual evaluation, Then ระบบเตือนว่า anonymity ในทางปฏิบัติต่ำมาก และให้เลือกปิดฝั่ง individual ได้
- Given อาจารย์เปิดดู evaluator identity หรือ export ที่มี identity, When ทำสำเร็จ, Then ต้องเป็น `OWNER` เท่านั้น ต้องยืนยันเจตนา และมี audit record ทุกครั้ง
- Given export แบบ default, When เปิดไฟล์, Then evaluator แสดงเป็น pseudonymous id ไม่ใช่ตัวตนจริง

> cross-cutting เหมือน US-11 — ไม่มี endpoint ของตัวเอง แต่เป็นข้อบังคับของทุก endpoint และทุก export
> วิธีพิสูจน์คือ integration test **เชิงลบ**: ยิงทุก endpoint ในฐานะนักศึกษาแล้วต้องไม่เจอ identity เลย
> ไม่ใช่การอ่านโค้ดแล้วเชื่อว่าไม่มี

---

## US-16 — คำนวณคะแนนจากผลเปรียบเทียบ

`user-story` · Sprint 3 · อ้าง FR-SCORE-01, FR-SCORE-02, FR-SCORE-03, FR-SCORE-04, FR-SCORE-06, FR-SCORE-10, FR-EVAL-09

**As an** อาจารย์และนักศึกษา
**I want to** ให้ระบบแปลงผลเปรียบเทียบทั้งหมดเป็นคะแนนด้วยสูตรที่อธิบายได้และคำนวณซ้ำได้ผลเดิม
**So that** คะแนนที่ประกาศออกไปตรวจสอบย้อนหลังได้ ไม่ใช่กล่องดำ

**Acceptance Criteria**

- Given comparison ที่สถานะ `SUBMITTED` ของ item หนึ่ง, When คำนวณ quality index, Then ได้ weighted mean ตาม PRD §9.2 และค่าอยู่ในช่วง [0, 1]
- Given มี comparison สถานะ `DRAFT` หรือ `EXCLUDED` ปนอยู่, When คำนวณ, Then ผลลัพธ์ไม่เปลี่ยน — draft ที่ไม่เคย submit ห้ามเข้าสู่การคำนวณ
- Given quality index ค่าหนึ่ง, When map เป็นคะแนน, Then ใช้ band mapping `floor + (ceiling − floor) × q` (default 0.60 → 1.00 ตั้งค่าได้ต่อ assignment) **ไม่ใช่** normalize ให้ผลรวมเป็น 1
- Given `instructor_weight = 2.5`, When คำนวณ, Then จำนวน comparison ต้องไม่เปลี่ยน แต่ค่าเฉลี่ยต้องขยับ — เป็นน้ำหนักใน weighted mean ไม่ใช่การนับ vote ซ้ำ
- Given นักศึกษาที่งานดีแต่ไม่ประเมินเพื่อนเลย, When คำนวณ, Then `score_ratio` ยังสูงตามคุณภาพงาน ส่วน participation multiplier ต่ำ — สองค่านี้แยกกันเด็ดขาด
- Given item ที่มี comparison น้อยกว่า `min_comparisons`, When คำนวณ, Then ติด flag `LOW_CONFIDENCE` ไปกับผลลัพธ์
- Given input ชุดเดิม, When รันซ้ำ, Then ได้ผลตรงกันทุกหลักทศนิยม และค่าถูกเก็บเป็น `numeric` ไม่ใช่ `float`
- Given worked example ใน PRD §9.5, When รันผ่าน engine, Then ได้ตัวเลขตรงเป๊ะทุกช่อง

> กฎ S1–S10 และ test ที่ต้องเขียนคู่กัน อยู่ใน `memory-bank/units/scoring-engine/unit-brief.md` แล้ว
> ขาดแค่ story ที่ถือมัน — US-10 เป็นเพียงหน้าจอที่**อ่าน**ผลลัพธ์ ไม่ใช่ตัวที่คำนวณ

---

# ผลการใช้ AI หา Edge Case

prompt ที่ใช้: ให้ AI อ่าน story US-01 ถึง US-11 ข้างบน แล้วถามหา edge case, error scenario
และ requirement ที่หายไป พร้อมบอกว่าถ้าไม่สนใจแล้วจะเกิดอะไรบน production

## รับ — สร้างเป็น AC เพิ่มหรือ issue ใหม่

| ข้อเสนอของ AI | ทำอะไรกับมัน |
|---|---|
| CSV ที่มี BOM หรือ encoding TIS-620 จะ parse พัง | เพิ่ม AC ใน US-03 · เป็นเคสที่เกิดจริงกับไฟล์จาก Excel ภาษาไทย |
| นักศึกษาลาออกกลางเทอมหลัง publish แล้ว pair ค้าง | รับเป็น issue ใหม่ `tech-debt` — PRD FR-PAIR-11 พูดถึงแล้วแต่ M1 ยังไม่ทำ |
| กดส่งสองครั้งพร้อมกันจากสองแท็บ | เพิ่ม AC เรื่อง `Idempotency-Key` ใน US-09 |
| deadline ตกช่วงเปลี่ยน DST ของ timezone | รับ — เป็นเหตุผลที่ PRD บังคับเก็บ UTC (DR-05) เพิ่ม AC ใน US-07 |
| กลุ่มมีสมาชิกคนเดียวทำให้ individual pairing เป็นไปไม่ได้ | รับ — เพิ่ม AC เตือนตอน import ใน US-03 |

## ไม่รับ — พร้อมเหตุผล

| ข้อเสนอของ AI | เหตุผลที่ไม่รับ |
|---|---|
| "ควรมีตัวเลือก *ข้ามคู่นี้เพราะดูผลงานไม่ได้*" | ขัดกับ D1 โดยตรง การเพิ่มทางออกให้ผู้ประเมินไม่ต้องตัดสินใจ คือสิ่งที่ forced choice ตั้งใจกำจัด · ถ้าผลงานเปิดไม่ได้จริงเป็นปัญหาคนละเรื่อง ต้องแก้ที่ artifact ไม่ใช่ที่มาตรวัด |
| "ควรให้ผู้ประเมินใส่คอมเมนต์ประกอบทุกคู่" | PRD §2.2 ระบุว่าอยู่นอก scope v1.0 · และการบังคับพิมพ์จะทำให้ workload พุ่งจนคนทำไม่ครบ ซึ่งกระทบ coverage ที่เป็นหัวใจของวิธีนี้ |
| "ควร cache ผลคะแนนไว้ใน Redis" | ยังไม่มีตัวเลขที่บอกว่าช้า · AR-01 บังคับให้ scoring เป็น pure function อยู่แล้วจึงคำนวณซ้ำได้ถูกเสมอ · จะตัดสินใจเรื่องนี้ด้วยข้อมูลจาก WS-07 ไม่ใช่ด้วยการเดา |
| "ควรมี real-time update ด้วย WebSocket ตอนอาจารย์ดู progress" | คุณค่าน้อยเทียบกับความซับซ้อน · refresh เองพอสำหรับ M1 · ถ้าจะทำต้องมีเหตุผลจากผู้ใช้จริงก่อน |

## ยังไม่ตัดสิน — ติด `tech-debt`

| ข้อเสนอของ AI | ทำไมยังไม่ตัดสิน |
|---|---|
| ควรจำกัดจำนวนครั้งที่แก้คำตอบหลัง submit | ยังไม่รู้ว่าอาจารย์อยากให้แก้ได้ไหม — เป็น 1 ใน 3 คำถามที่ยังไม่มีคำตอบ (ดูล่าง) |
| ควรเก็บ `time_on_task_ms` ไปใช้ตรวจจับการกดมั่ว | PRD §10 มีเรื่องนี้แต่เป็น M3 · เก็บ field ไว้ตั้งแต่ M1 ได้เพราะย้อนไปเก็บข้อมูลเก่าไม่ได้ |

---

# คำถามที่เคยค้าง — PRD ตอบไว้แล้วทั้งสามข้อ

รอบแรกเราสรุปว่าสามข้อนี้ต้องถามอาจารย์ก่อน และบันทึกไว้ว่าเป็น blocker ของ Sprint 3
พอกลับไปไล่ PRD ทีละบรรทัดเมื่อ **2026-08-24** พบว่าคำตอบอยู่ในเอกสารอยู่แล้วทุกข้อ
สิ่งที่ขาดคือการอ่านให้ครบ ไม่ใช่ requirement ที่หายไป

| คำถามเดิม | คำตอบใน PRD | ผลต่อ backlog |
|---|---|---|
| หลัง submit แก้คำตอบได้ไหม ถึงเมื่อไร | **FR-EVAL-06** — re-submit ได้ไม่จำกัดครั้งก่อน deadline ใช้ submission ล่าสุดคำนวณ และเก็บทุกเวอร์ชัน | แก้ AC ของ US-09 แล้ว (ดูบันทึกใน story) |
| k-anonymity threshold ใช้เลขเท่าไร | **FR-ANON-02** — `k_min` default **3** | เป็น AC ข้อ 2 ของ US-15 |
| ไม่ประเมินเลย หักคะแนนไหม เท่าไร | **§9.4** — `M = min(1.0, p / completion_threshold)` โดย `completion_threshold` default 0.90 พร้อมตารางตัวอย่าง และ FR-SCORE-11 ที่ระบุว่าคะแนน**ของกลุ่ม**ไม่ถูกลดด้วย `M` ของสมาชิกคนใดคนหนึ่ง | เป็น AC ข้อ 5 ของ US-16 |

## ที่ยังเปิดอยู่จริง — หนึ่งข้อ

**OQ-2 (PRD §9.4):** `M` ควรคูณคะแนนทั้งก้อน (ค่าปัจจุบัน) หรือคูณเฉพาะส่วน individual
หรือหักเป็นคะแนนคงที่ — PRD ระบุเองว่าเป็น **นโยบายของวิชา ไม่ใช่เรื่องเทคนิค**

ข้อนี้**ไม่บล็อก** Sprint 3 เพราะ default ที่เอกสารให้ไว้ใช้ได้ทันที และ US-16 บังคับให้
participation multiplier แยกจาก `score_ratio` อยู่แล้ว — เปลี่ยนนโยบายทีหลังคือเปลี่ยนจุดที่คูณ
ไม่ใช่รื้อสูตร

> บทเรียนของรอบนี้กลับด้านกับสิ่งที่เราคิดตอนแรก: ปัญหาไม่ใช่ "AI จะเดาแทนถ้าเราไม่ตอบ"
> แต่คือ**เราเองที่เดาว่าเอกสารไม่มีคำตอบ** โดยไม่ได้ไล่อ่านให้ครบก่อน
> ต้นทุนของการเดาแบบนี้คือ Sprint ที่ถูกกันไว้ไม่ให้เริ่มโดยไม่มีเหตุผลจริง

---

# Traceability — Story ↔ Issue ↔ Endpoint

ตารางนี้คือหลักฐานของเกณฑ์ผ่าน 2 ข้อ:
**"ทุก endpoint สืบกลับไปหา story ได้"** และ **"ทุก story มี endpoint"**

| Story | Issue | Endpoint ที่รองรับ |
|---|---|---|
| US-01 เข้าสู่ระบบ | [#1](https://github.com/STARSTEAM-X/sdpx-arai2/issues/1) | `POST /api/auth/session` · `GET /api/me` |
| US-02 สร้างห้องเรียน | [#2](https://github.com/STARSTEAM-X/sdpx-arai2/issues/2) | `GET /api/classrooms` · `POST /api/classrooms` |
| US-03 import CSV | [#3](https://github.com/STARSTEAM-X/sdpx-arai2/issues/3) | `POST /api/classrooms/{id}/roster:import` · `GET /api/classrooms/{id}/roster` |
| US-04 สร้างงานประเมิน | [#4](https://github.com/STARSTEAM-X/sdpx-arai2/issues/4) | `POST /api/assignments` |
| US-05 ดู feasibility | [#5](https://github.com/STARSTEAM-X/sdpx-arai2/issues/5) | `GET /api/assignments/{id}/feasibility` |
| US-06 publish + จัดคู่ | [#6](https://github.com/STARSTEAM-X/sdpx-arai2/issues/6) | `POST /api/assignments/{id}:publish` |
| US-07 รายการที่ต้องประเมิน | [#7](https://github.com/STARSTEAM-X/sdpx-arai2/issues/7) | `GET /api/assignments/{id}/my-evaluations` · `GET /api/classrooms/{id}/assignments` — ตัวหลังไม่มีใน PRD §12 เพิ่มเพราะไม่มีทางอื่นให้รู้ id ของ assignment |
| US-08 ประเมิน + autosave | [#8](https://github.com/STARSTEAM-X/sdpx-arai2/issues/8) | `PUT /api/comparisons/{pairAssignmentId}` |
| US-09 ส่งคำตอบทั้งชุด | [#9](https://github.com/STARSTEAM-X/sdpx-arai2/issues/9) | `POST /api/assignments/{id}/submissions` |
| US-10 ดูคะแนนตัวเอง | [#10](https://github.com/STARSTEAM-X/sdpx-arai2/issues/10) | `GET /api/assignments/{id}/my-score` |
| US-11 กันเข้าถึงข้ามห้องเรียน | [#11](https://github.com/STARSTEAM-X/sdpx-arai2/issues/11) | **ไม่มี endpoint ของตัวเอง** — ดูหมายเหตุ |
| US-12 จัดการผู้ร่วมสอนและ TA | [#12](https://github.com/STARSTEAM-X/sdpx-arai2/issues/12) | `POST /api/classrooms/{id}/members` · `DELETE /api/classrooms/{id}/members/{memberId}` — ยังไม่มีใน `openapi.yaml` |
| US-13 finalize คะแนน | [#13](https://github.com/STARSTEAM-X/sdpx-arai2/issues/13) | `POST /api/assignments/{id}:finalize` · `POST /api/assignments/{id}:reopen` · `POST /api/assignments/{id}/score-overrides` — ยังไม่มีใน `openapi.yaml` |
| US-14 audit log | [#14](https://github.com/STARSTEAM-X/sdpx-arai2/issues/14) | `GET /api/classrooms/{id}/audit` — ส่วนการ**เขียน** audit ไม่มี endpoint ของตัวเอง เหมือน US-11 |
| US-15 ปิดทางรู้ว่าใครประเมินตน | [#15](https://github.com/STARSTEAM-X/sdpx-arai2/issues/15) | **ไม่มี endpoint ของตัวเอง** — เป็นข้อบังคับของทุก endpoint ที่คืนคะแนนและทุก export |
| US-16 คำนวณคะแนน | [#16](https://github.com/STARSTEAM-X/sdpx-arai2/issues/16) | `POST /api/assignments/{id}:recompute` — ตัว engine ถูกเรียกโดย `my-score`, รายงานฝั่งอาจารย์ และ `:finalize` |

## สองข้อยกเว้นที่ตั้งใจให้เป็นแบบนี้

**US-11 ไม่มี endpoint ของตัวเอง** เพราะเป็น cross-cutting concern
มันถูกทำให้เป็นจริงผ่าน response `401` / `403` / `404` ที่ **ทุก** endpoint ต้องมี
ถ้าแยกเป็น endpoint เดี่ยวจะกลายเป็นการตรวจสิทธิ์ที่จุดเดียว ซึ่งขัดกับ FR-AUTHZ-01 โดยตรง

**`GET /api/health` ไม่มี story รองรับ** เพราะไม่ใช่ feature ของผู้ใช้
มันเป็นโครงสร้างพื้นฐานที่ Render, Docker (WS-05) และ k6 (WS-07) ใช้เป็นด่านตรวจ
บันทึกไว้ตรงนี้เพื่อไม่ให้ใครมาลบทิ้งเพราะ "หา story ไม่เจอ"

> **ช่องโหว่ที่เจอตอนไล่ตารางนี้:** ตอนร่าง spec รอบแรก US-01 ไม่มี endpoint รองรับเลย
> เพิ่ง เห็นตอนมาไล่ traceability จึงเพิ่ม `POST /api/auth/session` และ `GET /api/me` เข้าไป
> — เป็นตัวอย่างว่าทำไม checklist ข้อนี้ถึงมีอยู่

---

# Issues บน GitHub

สร้างครบแล้วทั้ง 16 ข้อ พร้อม label `user-story`
👉 https://github.com/STARSTEAM-X/sdpx-arai2/issues

**ไฟล์นี้คือต้นฉบับ** — ถ้าต้องแก้ story ให้แก้ที่นี่ก่อน แล้วค่อยอัปเดต issue ตาม
เพื่อให้การเปลี่ยนแปลงของ requirement อยู่ใน git diff และ review ได้

**วิธีสร้าง issue จาก story ในไฟล์นี้** — ดึง body จากไฟล์โดยตรง ไม่ copy มือ เนื้อหาสองที่จึงไม่หลุดกัน
[#12](https://github.com/STARSTEAM-X/sdpx-arai2/issues/12) ถึง [#16](https://github.com/STARSTEAM-X/sdpx-arai2/issues/16) ถูกสร้างด้วยคำสั่งนี้ เปลี่ยน `US-12` เป็นเลข story อื่นได้ตรง ๆ

```bash
awk '/^## US-12 /{f=1} f && /^---$/{exit} f' docs/backlog.md | gh issue create --title "US-12 — จัดการผู้ร่วมสอนและ TA" --label user-story --milestone "Sprint 2" --body-file -
```

ถ้าเครื่องยังไม่มี `gh` ติดตั้งด้วย `winget install --id GitHub.cli` แล้ว `gh auth login` ก่อน
สร้างเสร็จแล้วเอาเลข issue มาเติมในตาราง traceability ด้านบนด้วย

## Sprint 1

Milestone: [Sprint 1](https://github.com/STARSTEAM-X/sdpx-arai2/milestone/1) — 4 issues

เรียงตามหลัก "ปิด loop ทั้งวงก่อน ไม่ใช่ทำ feature ใหญ่":

| ลำดับ | Story | เหตุผล |
|---|---|---|
| 1 | **[#2](https://github.com/STARSTEAM-X/sdpx-arai2/issues/2) US-02 สร้างห้องเรียน** | เล็กที่สุดที่ทำให้เกิด endpoint จริงตัวแรก + ตาราง DB ตัวแรก + test ตัวแรกที่แตะ database |
| 2 | [#11](https://github.com/STARSTEAM-X/sdpx-arai2/issues/11) US-11 กันการเข้าถึงข้ามห้องเรียน | ต้องมาทันทีหลังมี resource แรก ถ้ารอทีหลังจะต้องไล่แก้ทุก endpoint |
| 3 | [#1](https://github.com/STARSTEAM-X/sdpx-arai2/issues/1) US-01 login | ปลดล็อกทุก story ที่เหลือ |
| 4 | [#3](https://github.com/STARSTEAM-X/sdpx-arai2/issues/3) US-03 import CSV | เป็น input ของ pairing engine |

US-04 ถึง US-10 ([#4](https://github.com/STARSTEAM-X/sdpx-arai2/issues/4)–[#10](https://github.com/STARSTEAM-X/sdpx-arai2/issues/10)) รอ Sprint ถัดไป

### สถานะ ณ 2026-08-23

| Story | AC ที่ผ่าน | หลักฐาน |
|---|---|---|
| [#2](https://github.com/STARSTEAM-X/sdpx-arai2/issues/2) US-02 สร้างห้องเรียน | **3/3** | unit `test_classroom_service.py` · E2E `classrooms.spec.ts` |
| [#11](https://github.com/STARSTEAM-X/sdpx-arai2/issues/11) US-11 กันเข้าถึงข้ามห้อง | **3/3** | unit `test_access.py` · E2E `roster.spec.ts` |
| [#3](https://github.com/STARSTEAM-X/sdpx-arai2/issues/3) US-03 import CSV | **4/4** | unit `test_roster_service.py` · integration `test_classroom_repo.py` · E2E `roster.spec.ts` |
| [#1](https://github.com/STARSTEAM-X/sdpx-arai2/issues/1) US-01 login | **4/4** | integration `test_user_repo.py` · E2E `classrooms.spec.ts` |

**บันทึกการตัดสินใจ — AC ข้อ 3 ของ US-01 ถูกแก้เมื่อ 2026-08-23**

ตัวอย่างเดิมเขียนว่า roster มี `Somchai.A+x@uni.ac.th` แล้ว login ด้วย `somchaia@uni.ac.th`
ซึ่ง**ขัดกับตัวกฎของ FR-AUTH-03 เอง** — กฎระบุว่าตัดจุดเฉพาะ gmail แต่ตัวอย่างใช้ domain
มหาวิทยาลัย การจะทำให้ตัวอย่างนั้นผ่านต้องตัดจุดทุก domain ซึ่งขัดกฎ

domain จริงของมหาวิทยาลัยคือ **kmitl.ac.th** ซึ่งไม่ใช่ `gmail.com` — บัญชี Google Workspace
ต่างจาก Gmail ตรงที่จุดเป็นตัวอักษรจริง `somchai.a@` กับ `somchaia@` จึงเป็นคนละคน
การรวมสองอันนี้เป็นคนเดียวกันจะทำให้คะแนนไปโผล่ผิดคน และแก้ย้อนหลังไม่ได้เมื่อประกาศไปแล้ว

จึงเลือก **แก้ตัวอย่างใน AC ให้ตรงกับกฎ** แทนการเปลี่ยนกฎให้ตรงกับตัวอย่าง
ตัวอย่างใหม่ยังทดสอบเรื่องเดิมครบ (ตัวพิมพ์ใหญ่-เล็ก + การตัด `+tag`) โดยไม่พึ่งการตัดจุด

`normalize_email(dot_insensitive_domains=...)` ยังรองรับอีกทางไว้ ถ้าวันหนึ่งพบว่า
ระบบเมลของมหาวิทยาลัยละเลยจุดจริง เปลี่ยนได้ที่จุดเดียวโดยไม่ต้องแก้ผู้เรียก

> **ยังไม่ได้ตั้ง due date** ของ Sprint 1 เพราะยังไม่รู้ว่ากลุ่มกำหนดความยาว sprint ไว้กี่สัปดาห์
> ตั้งเพิ่มได้ที่หน้า milestone หรือสั่ง `gh api repos/:owner/:repo/milestones/1 -X PATCH -f due_on=YYYY-MM-DDT00:00:00Z`

---

## Sprint 2 — "อาจารย์เปิดงานประเมินได้"

Milestone: [Sprint 2](https://github.com/STARSTEAM-X/sdpx-arai2/milestone/2) — 5 issues · 27 AC

| ลำดับ | Story | เหตุผลที่อยู่ลำดับนี้ |
|---|---|---|
| 1 | [#12](https://github.com/STARSTEAM-X/sdpx-arai2/issues/12) US-12 จัดการผู้ร่วมสอนและ TA | ต้องมาก่อน US-04 ด้วยเหตุผลเดียวกับที่ US-11 มาก่อน US-03 — US-04 เป็น endpoint แรกที่สิทธิ์ของ CO_TEACHER กับ TA ต่างกันจริง ถ้าทำทีหลังต้องย้อนแก้ทุก endpoint ที่เขียนไปแล้ว |
| 2 | [#14](https://github.com/STARSTEAM-X/sdpx-arai2/issues/14) US-14 audit log | เหตุการณ์แรกที่ PRD บังคับให้บันทึกคือ publish ซึ่งอยู่ Sprint นี้ · audit ที่มาทีหลังมีช่องว่างของ event ที่ผ่านไปแล้วเสมอ และย้อนไปเก็บไม่ได้ |
| 3 | [#4](https://github.com/STARSTEAM-X/sdpx-arai2/issues/4) US-04 สร้าง assignment + criteria | ไม่มี assignment ก็ไม่มีอะไรให้จัดคู่ · เป็นตารางใหม่ชุดสุดท้ายของ M1 |
| 4 | [#5](https://github.com/STARSTEAM-X/sdpx-arai2/issues/5) US-05 feasibility | ต้องมาก่อน publish เพราะหน้าที่ของมันคือกันไม่ให้ publish ค่าที่เป็นไปไม่ได้ |
| 5 | [#6](https://github.com/STARSTEAM-X/sdpx-arai2/issues/6) US-06 publish + จัดคู่ | pairing engine — งานหนักที่สุดของ Sprint นี้ |

**ทำไม US-05 กับ US-06 อยู่ Sprint เดียวกัน**

feasibility คือการคำนวณล่วงหน้าว่า pairing จะได้ผลอะไร — ใช้คณิตศาสตร์ชุดเดียวกันทั้งคู่
(`P7 individual coverage = m − 2`, `P8 ลด target พร้อมเหตุผลเป็นตัวเลข`)
แยกคนละ Sprint เท่ากับเขียน coverage สองรอบ หรือทำ fake คั่นกลางแล้วรื้อทิ้ง

**ไม่มี AC ข้อไหนติด blocker** — เริ่มได้ทันที

### สถานะ ณ 2026-08-24 — ครบทั้ง 5 story

| Story | AC | หลักฐาน |
|---|---|---|
| [#4](https://github.com/STARSTEAM-X/sdpx-arai2/issues/4) US-04 | **4/4** | unit `test_assignment_service.py` · E2E `assignments.spec.ts` |
| [#5](https://github.com/STARSTEAM-X/sdpx-arai2/issues/5) US-05 | **2/2** | unit `test_pairing.py::TestGroupFeasibility` · E2E |
| [#6](https://github.com/STARSTEAM-X/sdpx-arai2/issues/6) US-06 | **5/5** | unit `test_pairing.py` 88 ตัว · E2E ตรวจกับข้อมูลใน database จริง |
| [#12](https://github.com/STARSTEAM-X/sdpx-arai2/issues/12) US-12 | **11/11** | unit `test_access.py` (ไล่ role matrix ทุกช่อง) · `test_member_service.py` · E2E `members.spec.ts` |
| [#14](https://github.com/STARSTEAM-X/sdpx-arai2/issues/14) US-14 | **5/5** | integration `test_audit_repo.py` (append-only ที่ระดับ DB) · E2E |

**สิ่งที่ US-12 บังคับให้แก้ย้อนหลัง — แก้แล้ว**

`require_instructor` เดิมรวม OWNER, CO_TEACHER และ TA เป็นก้อนเดียว ซึ่ง**ถูกตราบใดที่
ระบบมีแค่ roster** เพราะทั้งสาม role จัดการ roster ได้จริงตาม matrix แต่พอมี assignment
เข้ามาใน #4 ก้อนเดียวกลายเป็นช่องโหว่ทันที — TA สร้าง assignment ได้ทั้งที่ไม่ควร

เปลี่ยนเป็นถามราย capability (`MANAGE_ROSTER`, `MANAGE_ASSIGNMENT`, `MANAGE_MEMBERS`,
`FINALIZE_SCORES`, `VIEW_AUDIT`) และเขียน role matrix เต็มตารางแทน "ทุก role ยกเว้น..."
เพราะการเติม role ใหม่แล้วลืมกรอกช่องใดช่องหนึ่งจะกลายเป็นการให้สิทธิ์โดยบังเอิญ

หน้าเว็บถูกแก้ให้ตรงกันด้วย — ถ้าซ่อนไม่ตรงกับ server ผู้ใช้จะเห็นปุ่มที่กดแล้วได้ 403 เสมอ
ซึ่งดูเหมือนระบบพังมากกว่าดูเหมือนกฎ

**ช่องโหว่ที่เจอตอนเขียน test:** `GET /roster` คืนแต่ `userId` ไม่มี `memberId`
จึงไม่มีทางรู้ว่าต้องลบแถวไหน — AC ข้อ LAST_OWNER ทดสอบผ่าน API จริงไม่ได้เลย
เพิ่ม `memberId` เข้า response แล้ว

**สิ่งที่พบระหว่างทาง — pseudocode ใน PRD §8.4 ให้ผลไม่สมดุล**

วิธีที่ PRD เขียนไว้ (ไล่ทีละ evaluator ให้แต่ละคนหยิบคู่ที่ขาดที่สุด) ให้ coverage
ต่างกัน 2 ในเคสที่มีคำตอบสมดุลอยู่จริง เช่น 5 กลุ่ม กลุ่มละ 4 คน — งาน 60 ชิ้น
ลงได้พอดี 6 ต่อคู่ แต่ได้ 7 กับ 5 เพราะคนท้าย ๆ เหลือทางเลือกน้อยแล้ว

เปลี่ยนเป็นป้อนคู่ที่ขาดที่สุดก่อน แล้วเพิ่ม repair pass ที่ย้าย evaluator
จากคู่ที่ล้นไปคู่ที่ขาด (ทั้งย้ายตรงและย้ายผ่านคู่กลาง) — วัดแล้ว **1140 ครั้ง
จาก 19 รูปทรงห้องเรียน สมดุลทุกครั้ง** ถ้ายังไม่สมดุลจะ raise พร้อมตัวเลข
ไม่บันทึกข้อมูลที่ผิดกฎ FR-PAIR-06 ลง database

**สิ่งที่พบเพิ่ม — 3 กลุ่มขนาดต่างกันทำ P3 ไม่ได้เลย**

เมื่อมี 3 กลุ่ม ข้อจำกัด (1) บังคับให้ k = 1 และแต่ละกลุ่มประเมินได้เพียงคู่เดียว
coverage ของแต่ละคู่จึงเท่ากับขนาดกลุ่มที่ประเมิน — ต่างกันเกิน 1 เมื่อไร
กฎ P3 เป็นไปไม่ได้ทางคณิตศาสตร์ feasibility จึงปฏิเสธตั้งแต่ต้นพร้อมอธิบายเป็นตัวเลข
แทนที่จะปล่อยให้ไปพังตอน publish

**ของหนักจริง:** `memory-bank/units/pairing-engine/unit-brief.md` กฎ P1–P10
ข้อที่ยากกว่าที่เห็นคือ `P3 ส่วนต่าง coverage ระหว่าง pair ใด ๆ ≤ 1` ซึ่งเป็นปัญหาจัดสรร
ต้องออกแบบ algorithm จริง ไม่ใช่สุ่มแล้วจบ และ `P5 seed เดิมได้ผลเดิม` บังคับว่า
ห้ามมี randomness ที่ควบคุมไม่ได้อยู่ในเส้นทางเลย

## Sprint 3 — "นักศึกษาประเมินและเห็นคะแนน"

Milestone: [Sprint 3](https://github.com/STARSTEAM-X/sdpx-arai2/milestone/3) — 7 issues · 39 AC

| ลำดับ | Story | เหตุผลที่อยู่ลำดับนี้ |
|---|---|---|
| 1 | [#7](https://github.com/STARSTEAM-X/sdpx-arai2/issues/7) US-07 รายการที่ต้องประเมิน | ต้องเห็นคู่ก่อนถึงจะประเมินได้ |
| 2 | [#8](https://github.com/STARSTEAM-X/sdpx-arai2/issues/8) US-08 ประเมิน 6 ระดับ + autosave | หน้าจอหลักของนักศึกษา |
| 3 | [#9](https://github.com/STARSTEAM-X/sdpx-arai2/issues/9) US-09 ส่งคำตอบทั้งชุด | ปิด state machine `DRAFT → SUBMITTED` |
| 4 | [#16](https://github.com/STARSTEAM-X/sdpx-arai2/issues/16) US-16 คำนวณคะแนน | scoring engine อ่านเฉพาะ comparison ที่ `SUBMITTED` (กฎ S2) จึงต้องมาหลัง US-09 · ทั้ง US-10 และ US-13 ใช้ผลของมัน |
| 5 | [#15](https://github.com/STARSTEAM-X/sdpx-arai2/issues/15) US-15 ปิดทางรู้ว่าใครประเมินตน | ต้องมาก่อนหน้าจอคะแนน ด้วยเหตุผลเดียวกับที่ US-11 มาก่อน US-03 — กฎก่อนหน้าจอ ไม่ใช่ตามไปอุดทีหลัง |
| 6 | [#10](https://github.com/STARSTEAM-X/sdpx-arai2/issues/10) US-10 ดูคะแนนตัวเอง | หน้าจอที่อ่านผลจาก US-16 ภายใต้กฎของ US-15 |
| 7 | [#13](https://github.com/STARSTEAM-X/sdpx-arai2/issues/13) US-13 finalize คะแนน | ปิด M1 — ทำให้สถานะ `FINALIZED` ที่ US-10 รออยู่เกิดขึ้นจริง |

**US-07 ถึง US-09 แยกกันไม่ได้** — เป็นหน้าจอเดียวกันและ state machine เดียวกัน

### สถานะ ณ 2026-08-24 — US-07, US-08 เสร็จ (US-09 ยังไม่เริ่ม)

| Story | AC | หลักฐาน |
|---|---|---|
| [#7](https://github.com/STARSTEAM-X/sdpx-arai2/issues/7) US-07 | **4/4** | unit `test_evaluation_service.py` (8 ตัว) · e2e `evaluations.spec.ts` (6 ตัว, ผ่าน `--repeat-each=3`) |
| [#8](https://github.com/STARSTEAM-X/sdpx-arai2/issues/8) US-08 | **5/5** | unit `test_comparison_service.py` (15 ตัว) · e2e `comparisons.spec.ts` (9 ตัว รวม autosave 2 วินาทีจริงผ่าน web-first assertion ไม่ใช้ `waitForTimeout`, ผ่าน `--repeat-each=3`) |

**US-08 บันทึกไว้เสมอเป็น `DRAFT`** — `PUT /comparisons/{id}` เขียนทับสถานะเป็น `DRAFT` ทุกครั้ง
แม้แถวเดิมจะเคยเป็น `SUBMITTED` มาก่อนก็ตาม ตรงกับที่ `docs/openapi.yaml` เขียนไว้ว่า
"บันทึกเป็นสถานะ DRAFT จนกว่าจะเรียก submissions" — หมายความว่าถ้านักศึกษาแก้คำตอบหลัง
submit ไปแล้ว (ก่อน deadline) ต้องกด submit ใหม่อีกครั้งถึงจะนับเป็น `SUBMITTED` — ยังไม่มี
endpoint submit จริง (US-09) จึงยังพิสูจน์ path นี้ทั้งเส้นไม่ได้ในตอนนี้

**บั๊กที่เจอจากการทดสอบ manual ผ่าน browser จริง ไม่ใช่จาก unit test**

`ComparisonRow.tsx` เดิมไม่เคลียร์สถานะ "บันทึกแล้ว" ตอนเลือกคำตอบใหม่ — เปลี่ยนคำตอบแล้ว
ยังเห็นข้อความ "บันทึกแล้ว" ของคำตอบ**เก่า**ค้างอยู่ตลอด 2 วินาทีก่อน debounce จะยิงจริง
ทำให้เข้าใจผิดว่าคำตอบใหม่บันทึกแล้ว เป็นเรื่อง UI state ล้วน ๆ ไม่มี business rule ให้ unit
test คุ้มครองได้ — เห็นได้จากการรันจริงเท่านั้น แก้แล้วด้วยการ reset state เป็น `idle` ทันทีที่
เลือกคำตอบใหม่ ก่อนจะเข้า debounce window

**สิ่งที่แก้ระหว่างทาง — ข้อความมาตรวัดไม่ตรงกับ PRD §9.1**

`frontend/src/lib/scale.ts` เดิมใช้คำว่า "A ดีกว่า B มากที่สุด" (winner: 'A'|'B') แต่ PRD §9.1
ใช้ "ซ้ายดีกว่ามาก" (คำต่อคำ ผูกกับ s_left/s_right ที่ scoring engine จะใช้ใน US-16) แก้ label
ให้ตรงเป๊ะและเปลี่ยน `Winner` เป็น `'left'|'right'` ให้ตรงความหมายจริง — id และลำดับ
(ซึ่งคือสิ่งที่ backend เก็บจริง) ไม่เคยผิดตั้งแต่แรก มีแค่ข้อความที่ผู้ใช้เห็นที่คลาดไป

**endpoint ที่ไม่มีระบุไว้ตรง ๆ ใน PRD §12 — เพิ่มเพราะจำเป็นจริง**

`GET /api/classrooms/{classroomId}/assignments` ไม่มีในสเปกทั้งของ PRD และ `docs/openapi.yaml`
ฉบับร่างจาก WS-02 — ช่องโหว่เดียวกับที่ US-01 (auth) และ US-12 (members) เคยเจอตอนไล่ตาราง
traceability: ไม่มีทางให้นักศึกษารู้ id ของ assignment เพื่อเรียก `/my-evaluations` ต่อได้เลย
ก่อนหน้านี้หน้าเว็บของนักศึกษามีแค่รายชื่อ ไม่มีทางไปต่อได้แม้อาจารย์จะ publish งานแล้วก็ตาม

เพิ่มเข้า `docs/openapi.yaml` แล้ว validate ผ่าน · นักศึกษาไม่เห็นงานที่ยังเป็น `DRAFT`
ผู้สอนเห็นทุกสถานะ

**ช่องโหว่ที่เจอตอนร่าง `openapi.yaml` ฉบับ WS-02 — แก้แล้ว**

สเปกร่างเดิมให้ `PairToEvaluate.left`/`right` มี `artifactUrl` แยกต่อ item แต่ตาราง `assignment`
มีคอลัมน์ `artifact_url` แค่ช่องเดียวต่อทั้งงาน ไม่ใช่ต่อกลุ่ม — สร้างตาม schema จริงแทน
คือส่งลิงก์เดียวมากับ response ระดับบนสุด (`MyEvaluations.artifactUrl`) และแก้ 409 ที่ร่างไว้ผิดจุด
(ของเดิมใส่ `DEADLINE_PASSED` ไว้ที่ endpoint อ่านอย่างเดียว ทั้งที่ FR-EVAL-08 ต้องการแค่ read-only
หลัง deadline ไม่ใช่ปฏิเสธการอ่าน — 409 ตัวจริงอยู่ที่ `PUT /comparisons/{id}` ซึ่ง endpoint เขียนของ US-08)

**สิ่งที่พบระหว่างทาง — criteria หลายตัวต่อฝั่งต้องแยก section**

ฝั่งเดียวกัน (เช่น GROUP) มีได้หลายเกณฑ์ (UX, Completeness, Innovation) แต่ละเกณฑ์สร้างคู่
ของตัวเองตอน publish — เขียน query รอบแรกไม่ได้ join `criterion` เข้าไปด้วย ทำให้คู่ของหลาย
เกณฑ์ปนกันในรายการเดียวโดยไม่มีอะไรบอกว่าคู่ไหนของเกณฑ์ไหน (ขัด FR-EVAL-01 ที่บังคับให้แยก
section ต่อเกณฑ์) พบตอนทดสอบกับ assignment จริงที่มี 2 criteria ฝั่ง GROUP แก้โดยเพิ่ม
`criterionId`/`criterionName` เข้าไปใน `EvaluationItem` ทุกตัว

**ไม่ติด blocker แล้ว** — คำถามสามข้อที่เคยกัน Sprint นี้ไว้ PRD ตอบไว้ครบ
(FR-EVAL-06, FR-ANON-02, §9.4) รายละเอียดอยู่หัวข้อ "คำถามที่เคยค้าง" ด้านบน
เหลือ OQ-2 ข้อเดียวซึ่งเป็นนโยบายวิชาและมี default ให้ใช้ได้ทันที

**ของหนักจริง:** `memory-bank/units/scoring-engine/unit-brief.md` กฎ S1–S10
ตัววัดที่ดีที่สุดคือ `S10 golden test` — ต้องได้ตัวเลขตรงเป๊ะกับ worked example ใน PRD §9.5
และ `S6 เก็บเป็น numeric ไม่ใช่ float` ซึ่งถ้าพลาดจะเจอตอนคะแนนคลาดกันหลักทศนิยม

## จุดที่ Sprint ชนกับปฏิทินของวิชา

Workshop ที่เหลือเป็นงาน infra ไม่ใช่ feature จึงรันคู่ขนานกับ Sprint ได้ แต่มีสองจุดที่ชน:

| Workshop | สัปดาห์ | ข้อบังคับที่กระทบแผน |
|---|---|---|
| WS-07 Performance | 13 | k6 ต้องยิง "realistic journey" → flow ประเมิน (US-07/US-08) ต้องใช้งานได้ก่อน |
| WS-08 Code Quality | 14 | เป็น refactor ที่ห้ามเปลี่ยนพฤติกรรม → ไม่ควรมี feature ค้างอยู่ |

**สรุป: Sprint 3 ควรเสร็จก่อนสัปดาห์ 13**

> **ยังไม่ได้ตั้ง due date** ของทั้งสอง Sprint ด้วยเหตุผลเดียวกับ Sprint 1 —
> ยังไม่รู้ความยาว sprint ที่กลุ่มตกลงกัน และวันที่จริงของสัปดาห์ปัจจุบัน
