# Product Backlog — PairEval (Sprint 1 / M1 Walking Skeleton)

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

`user-story` · Sprint 1 · อ้าง FR-ASSIGN-01, FR-ASSIGN-02, FR-ASSIGN-07

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

`user-story` · Sprint 1 · อ้าง FR-PAIR-04, FR-PAIR-05

**As an** อาจารย์
**I want to** เห็นตัวเลข coverage ที่ทำได้จริงและภาระต่อคน ก่อนกด publish
**So that** ไม่ตั้งค่าที่เป็นไปไม่ได้แล้วมารู้ทีหลังตอนนักศึกษาเริ่มประเมินแล้ว

**Acceptance Criteria**

- Given assignment สถานะ DRAFT ที่มี roster และ criteria ครบ, When เรียกดู feasibility, Then ได้ coverage ที่ทำได้จริง, workload ต่อคน และจำนวน comparison รวม
- Given ตั้ง `target_coverage = 5` แต่ขนาดกลุ่มทำให้เป็นไปไม่ได้, When ดู feasibility, Then ระบบเสนอค่าสูงสุดที่ทำได้ **พร้อมตัวเลขเหตุผล** ไม่ใช่แค่คำเตือนลอย ๆ

---

## US-06 — เผยแพร่งานแล้วระบบจัดคู่ให้อัตโนมัติ

`user-story` · Sprint 1 · อ้าง FR-PAIR-01, FR-PAIR-02, FR-PAIR-03, FR-PAIR-06, FR-PAIR-08, FR-PAIR-09

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

`user-story` · Sprint 1

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

`user-story` · Sprint 1 · อ้าง D1, D8, FR-API-01

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

`user-story` · Sprint 1 · อ้าง FR-API-02

**As a** นักศึกษา
**I want to** กดส่งครั้งเดียวเมื่อประเมินครบ
**So that** รู้แน่ว่างานถูกนับแล้ว

**Acceptance Criteria**

- Given ประเมินครบทุกคู่ของ side นั้น, When กดส่ง, Then ทุก comparison เปลี่ยนสถานะเป็น `SUBMITTED` และตอบ 200
- Given ยังทำไม่ครบ, When กดส่ง, Then ตอบ 422 พร้อมบอกว่าเหลือกี่คู่
- Given กดส่งซ้ำด้วย `Idempotency-Key` เดิม, When ส่งซ้ำ, Then ไม่เกิดผลซ้ำซ้อนและได้ผลลัพธ์เดิม
- Given deadline ผ่านแล้ว, When กดส่ง, Then ตอบ 409 `DEADLINE_PASSED`

---

## US-10 — นักศึกษาดูคะแนนของตัวเอง

`user-story` · Sprint 1 · อ้าง D2, D5, D7

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

# ผลการใช้ AI หา Edge Case

prompt ที่ใช้: ให้ AI อ่าน story ทั้ง 11 ข้อข้างบน แล้วถามหา edge case, error scenario
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

# คำถามที่ requirement ยังตอบไม่ได้

ต้องถามอาจารย์ผู้สอน/product owner ก่อนลงมือ story ที่เกี่ยวข้อง

1. **หลัง submit แล้วนักศึกษาแก้คำตอบได้ไหม และได้ถึงเมื่อไร** — PRD มี `comparison_revision` ที่บอกว่าเก็บทุกเวอร์ชัน แต่ไม่ได้ระบุว่าใครแก้ได้และแก้ได้ถึงตอนไหน กระทบ US-08 และ US-09 โดยตรง
2. **k-anonymity threshold ใช้เลขเท่าไร** — D7 บอกว่าต้องมี threshold แต่ไม่ระบุค่า ถ้าเดาเองแล้วผิด จะแก้ทีหลังไม่ได้เพราะคะแนนประกาศไปแล้ว กระทบ US-10
3. **ถ้านักศึกษาไม่ประเมินเลย คะแนนที่ตัวเองได้รับควรถูกหักไหม และหักเท่าไร** — D5 แยก "คะแนนที่ได้รับ" ออกจาก "โทษการไม่เข้าร่วม" แล้ว แต่ไม่ได้บอกขนาดของโทษ กระทบ US-10

> คำถามพวกนี้คือช่องที่ AI จะเดาแทนถ้าเราไม่ตอบเอง — และมันมักเดาผิด

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
| US-07 รายการที่ต้องประเมิน | [#7](https://github.com/STARSTEAM-X/sdpx-arai2/issues/7) | `GET /api/assignments/{id}/my-evaluations` |
| US-08 ประเมิน + autosave | [#8](https://github.com/STARSTEAM-X/sdpx-arai2/issues/8) | `PUT /api/comparisons/{pairAssignmentId}` |
| US-09 ส่งคำตอบทั้งชุด | [#9](https://github.com/STARSTEAM-X/sdpx-arai2/issues/9) | `POST /api/assignments/{id}/submissions` |
| US-10 ดูคะแนนตัวเอง | [#10](https://github.com/STARSTEAM-X/sdpx-arai2/issues/10) | `GET /api/assignments/{id}/my-score` |
| US-11 กันเข้าถึงข้ามห้องเรียน | [#11](https://github.com/STARSTEAM-X/sdpx-arai2/issues/11) | **ไม่มี endpoint ของตัวเอง** — ดูหมายเหตุ |

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

สร้างครบแล้วทั้ง 11 ข้อ พร้อม label `user-story`
👉 https://github.com/STARSTEAM-X/sdpx-arai2/issues

**ไฟล์นี้คือต้นฉบับ** — ถ้าต้องแก้ story ให้แก้ที่นี่ก่อน แล้วค่อยอัปเดต issue ตาม
เพื่อให้การเปลี่ยนแปลงของ requirement อยู่ใน git diff และ review ได้

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

Milestone: [Sprint 2](https://github.com/STARSTEAM-X/sdpx-arai2/milestone/2) — 3 issues · 11 AC

| ลำดับ | Story | เหตุผลที่อยู่ลำดับนี้ |
|---|---|---|
| 1 | [#4](https://github.com/STARSTEAM-X/sdpx-arai2/issues/4) US-04 สร้าง assignment + criteria | ไม่มี assignment ก็ไม่มีอะไรให้จัดคู่ · เป็นตารางใหม่ชุดสุดท้ายของ M1 |
| 2 | [#5](https://github.com/STARSTEAM-X/sdpx-arai2/issues/5) US-05 feasibility | ต้องมาก่อน publish เพราะหน้าที่ของมันคือกันไม่ให้ publish ค่าที่เป็นไปไม่ได้ |
| 3 | [#6](https://github.com/STARSTEAM-X/sdpx-arai2/issues/6) US-06 publish + จัดคู่ | pairing engine — งานหนักที่สุดของ Sprint นี้ |

**ทำไม US-05 กับ US-06 อยู่ Sprint เดียวกัน**

feasibility คือการคำนวณล่วงหน้าว่า pairing จะได้ผลอะไร — ใช้คณิตศาสตร์ชุดเดียวกันทั้งคู่
(`P7 individual coverage = m − 2`, `P8 ลด target พร้อมเหตุผลเป็นตัวเลข`)
แยกคนละ Sprint เท่ากับเขียน coverage สองรอบ หรือทำ fake คั่นกลางแล้วรื้อทิ้ง

**ไม่มี AC ข้อไหนติด blocker** — เริ่มได้ทันที และเป็นช่วงเวลาที่ควรใช้ไปตามคำตอบ
ของ 3 คำถามด้านบน ซึ่ง Sprint 3 ต้องใช้

**ของหนักจริง:** `memory-bank/units/pairing-engine/unit-brief.md` กฎ P1–P10
ข้อที่ยากกว่าที่เห็นคือ `P3 ส่วนต่าง coverage ระหว่าง pair ใด ๆ ≤ 1` ซึ่งเป็นปัญหาจัดสรร
ต้องออกแบบ algorithm จริง ไม่ใช่สุ่มแล้วจบ และ `P5 seed เดิมได้ผลเดิม` บังคับว่า
ห้ามมี randomness ที่ควบคุมไม่ได้อยู่ในเส้นทางเลย

## Sprint 3 — "นักศึกษาประเมินและเห็นคะแนน"

Milestone: [Sprint 3](https://github.com/STARSTEAM-X/sdpx-arai2/milestone/3) — 4 issues · 17 AC

| ลำดับ | Story | เหตุผลที่อยู่ลำดับนี้ |
|---|---|---|
| 1 | [#7](https://github.com/STARSTEAM-X/sdpx-arai2/issues/7) US-07 รายการที่ต้องประเมิน | ต้องเห็นคู่ก่อนถึงจะประเมินได้ |
| 2 | [#8](https://github.com/STARSTEAM-X/sdpx-arai2/issues/8) US-08 ประเมิน 6 ระดับ + autosave | หน้าจอหลักของนักศึกษา |
| 3 | [#9](https://github.com/STARSTEAM-X/sdpx-arai2/issues/9) US-09 ส่งคำตอบทั้งชุด | ปิด state machine `DRAFT → SUBMITTED` |
| 4 | [#10](https://github.com/STARSTEAM-X/sdpx-arai2/issues/10) US-10 ดูคะแนนตัวเอง | scoring engine อ่านเฉพาะ comparison ที่ `SUBMITTED` (กฎ S2) จึงต้องมาหลัง US-09 |

**US-07 ถึง US-09 แยกกันไม่ได้** — เป็นหน้าจอเดียวกันและ state machine เดียวกัน

**ติด blocker ทั้ง 3 คำถาม** ต้องได้คำตอบ **ก่อนเริ่ม Sprint นี้** ไม่ใช่ระหว่างทาง:

| คำถาม | กระทบ story |
|---|---|
| หลัง submit แก้คำตอบได้ไหม ถึงเมื่อไร | US-08, US-09 |
| k-anonymity threshold ใช้เลขเท่าไร | US-10 |
| ไม่ประเมินเลย หักคะแนนไหม เท่าไร | US-10 |

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
