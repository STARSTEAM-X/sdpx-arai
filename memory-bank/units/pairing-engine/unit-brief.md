# Unit: Pairing Engine

## Purpose

ตัดสินว่า **ใครต้องประเมินคู่ไหนบ้าง** แล้วสร้าง `pair_assignment` ทั้งหมดเก็บลง database ตอน publish

## Responsibilities

- คำนวณ feasibility: coverage ที่ทำได้จริง, workload ต่อคน, จำนวน comparison รวม
- จัดสรร pair ให้ evaluator แต่ละคนตามข้อจำกัดทั้งหมด
- สุ่มตำแหน่งซ้าย-ขวาของแต่ละ pair แล้วบันทึกว่าใครเห็นแบบไหน
- รับ seed เข้ามาเพื่อให้ผลลัพธ์ reproduce ได้

## NOT Responsible For

- การคำนวณคะแนน — เป็นของ [Scoring Engine](../scoring-engine/unit-brief.md)
- การอ่าน/เขียน database โดยตรง — รับ input เป็นโครงสร้างข้อมูลธรรมดา แล้วคืน pair ออกมา
  ให้ชั้นบนเป็นคนบันทึก (ทำให้ test ได้โดยไม่ต้องมี DB)
- การตรวจสิทธิ์ว่าใครสั่ง publish ได้ — เป็นของ Authorization
- การตัดสินใจว่าเมื่อไรควร publish — เป็นของ Assignment Lifecycle

## Dependencies

- **Depends on:** ไม่มี — เป็น pure logic ทั้งหมด รับ roster + criteria + config เข้ามาเท่านั้น
- **Used by:** Assignment Lifecycle (ตอน publish), Feasibility endpoint (ตอน preview ก่อน publish)

## Key Business Rules

> ทุกข้อในตารางนี้ต้องมี unit test คู่กันหนึ่งตัวใน WS-03
> และเป็นเป้าหมายของ property-based test ตาม NFR-MAINT-02

| # | กฎ | อ้าง | test ที่ต้องเขียน |
|---|---|---|---|
| P1 | evaluator ต้องไม่ได้รับ pair ที่มี **กลุ่มตัวเอง** อยู่ (ฝั่ง GROUP) | FR-PAIR-02 | สร้าง pair แล้วไล่ดูทุกคู่ของทุก evaluator ต้องไม่เจอกลุ่มตัวเอง |
| P2 | evaluator ต้องไม่ได้รับ pair ที่มี **ตัวเอง** อยู่ และประเมินได้เฉพาะในกลุ่มตัวเอง (ฝั่ง INDIVIDUAL) | FR-PAIR-03 | เหมือน P1 แต่ระดับบุคคล |
| P3 | ส่วนต่าง coverage ระหว่าง pair ใด ๆ **≤ 1** | FR-PAIR-06 | นับ coverage ทุกคู่ แล้ว max − min ต้อง ≤ 1 |
| P4 | evaluator คนเดิมต้องไม่ได้รับ pair เดิมซ้ำภายใน criterion เดียวกัน | FR-PAIR-07 | ตรวจว่าไม่มี tuple `(evaluator, criterion, itemA, itemB)` ซ้ำ |
| P5 | ให้ seed เดิม → ผลลัพธ์เหมือนเดิมทุกประการ | FR-PAIR-09 | รัน 2 ครั้งด้วย seed เดิม แล้ว assert ว่าเท่ากัน |
| P6 | ตำแหน่งซ้าย-ขวาต้องสุ่มและถูกบันทึกไว้ | FR-PAIR-08, D8 | รันหลายครั้งด้วย seed ต่างกัน แล้วดูว่าไม่ได้เอียงไปฝั่งเดียว |
| P7 | **individual coverage = m − 2** ตามขนาดกลุ่ม ไม่ใช่บังคับ 5 | FR-PAIR-04, D4 | กลุ่มขนาด 3 → coverage ต้องเป็น 1 ไม่ใช่ error |
| P8 | ถ้า coverage เป้าหมายเป็นไปไม่ได้ ต้องลดลงมาที่ค่าสูงสุดที่ทำได้ **พร้อมเหตุผลเป็นตัวเลข** | FR-PAIR-05 | ตั้ง target สูงเกินจริง แล้ว assert ว่ามี `reason` ที่มีตัวเลข |
| P9 | `item_a_id <> item_b_id` เสมอ | DR | ไม่มีคู่ไหนเทียบกับตัวเอง |
| P10 | `individual_max_score = 0` → ไม่สร้าง pair ฝั่ง INDIVIDUAL เลย | FR-ASSIGN-07 | assert ว่าได้ 0 คู่ |

## Key Stories

- US-05 ดูความเป็นไปได้ก่อนเผยแพร่งาน
- US-06 เผยแพร่งานแล้วระบบจัดคู่ให้อัตโนมัติ

## Bolt Type

- [x] **DDD Construction** — domain logic ซับซ้อน มีข้อจำกัดหลายข้อที่ต้องเป็นจริงพร้อมกัน
      และเป็นจุดที่ property-based test ให้คุณค่าสูงที่สุดในระบบ
- [ ] Simple Construction

## Human Checkpoint

**unit นี้ทำงานได้โดยไม่ต้องรู้ implementation ของ unit อื่นไหม**

ได้ — รับ roster, criteria, config และ seed เข้ามา คืนรายการ pair ออกไป
ไม่รู้จัก database, HTTP, หรือวิธีคำนวณคะแนนเลย
นี่คือเหตุผลที่ต้องออกแบบให้ไม่แตะ DB โดยตรงตั้งแต่แรก
