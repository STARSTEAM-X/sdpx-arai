# Unit: Scoring Engine

## Purpose

แปลงผลการเปรียบเทียบทั้งหมดของงานหนึ่ง ให้กลายเป็น **คะแนนของแต่ละกลุ่มและแต่ละคน**

## Responsibilities

- แปลง `choice` 1–6 ของแต่ละ comparison เป็นแต้มของฝั่งที่ชนะ
- รวมแต้มเป็น quality index ต่อ item ต่อ criterion
- map quality index เป็นคะแนนผ่าน band mapping (floor → ceiling)
- คำนวณตัวคูณการมีส่วนร่วม แยกออกจากคะแนนที่ได้รับ
- ติด flag เช่น `LOW_CONFIDENCE` เมื่อจำนวน comparison ไม่ถึงเกณฑ์

## NOT Responsible For

- การจัดคู่ — เป็นของ [Pairing Engine](../pairing-engine/unit-brief.md)
- การตัดสินใจว่าจะประกาศผลเมื่อไร — เป็นของ Assignment Lifecycle
- การซ่อนคะแนนตาม k-anonymity — เป็นของชั้น Report/Authorization
  Scoring Engine คำนวณให้ครบเสมอ ส่วนจะ**แสดง**หรือไม่เป็นเรื่องของชั้นบน
- การบันทึกผลลง `computed_score` — คืนค่าออกไปให้ชั้นบนบันทึก

## Dependencies

- **Depends on:** ไม่มี — pure function ตาม AR-01
- **Used by:** endpoint `:recompute`, `:finalize`, รายงานฝั่งอาจารย์, `my-score` ของนักศึกษา

## Key Business Rules

> ทุกข้อต้องมี unit test คู่กันใน WS-03
> **worked example ใน PRD §9.5 ต้องกลายเป็น golden test** ตาม NFR-MAINT-01

| # | กฎ | อ้าง | test ที่ต้องเขียน |
|---|---|---|---|
| S1 | เป็น **pure function** — input เดิม ให้ output เดิมเสมอ ไม่มี state ภายใน | AR-01 | เรียกซ้ำ 100 ครั้งด้วย input เดิม ผลต้องเท่ากันทุกครั้ง |
| S2 | เฉพาะ comparison ที่ `status = SUBMITTED` เท่านั้นที่เข้าสู่การคำนวณ | DR-01 | ใส่ DRAFT และ EXCLUDED ปนเข้าไป คะแนนต้องไม่เปลี่ยน |
| S3 | คะแนน map ผ่าน **band mapping** floor 0.600 → ceiling 1.000 **ไม่ใช่** normalize ให้ผลรวม = 1 | D2 | ทุกคนได้คะแนนเท่ากัน → ทุกคนต้องได้ค่าในช่วง band ไม่ใช่ 1/N |
| S4 | **คะแนนที่ได้รับ แยกจาก โทษการไม่เข้าร่วม** | D5 | คนที่งานดีแต่ไม่ประเมินเพื่อนเลย ต้องยังได้ `score_ratio` สูง แต่ `participationMultiplier` ต่ำ |
| S5 | `instructor_weight` เป็น **float ใน weighted mean** ไม่ใช่การนับ vote ซ้ำ | D6 | ตั้ง weight 2.5 แล้ว comparison count ต้องไม่เปลี่ยน แต่ค่าเฉลี่ยต้องขยับ |
| S6 | คะแนนเก็บเป็น `numeric` ไม่ใช่ `float` | DR-04 | ทดสอบด้วยเลขที่ float พลาด เช่น 0.1 + 0.2 ต้องได้ 0.3 พอดี |
| S7 | `computed_score` ที่ `is_final = true` แก้ตรง ๆ ไม่ได้ ต้องผ่าน `score_override` | DR-03 | พยายามเขียนทับแล้วต้องถูกปฏิเสธ |
| S8 | ติด flag `LOW_CONFIDENCE` เมื่อ comparison น้อยกว่า `min_comparisons` | §10 | ให้ข้อมูล 2 comparison ทั้งที่ min = 3 → ต้องมี flag |
| S9 | ไม่มี comparison เลย → ต้องไม่ crash และต้องบอกได้ว่าคำนวณไม่ได้ | — | ส่ง list ว่างเข้าไป ต้องไม่ throw แบบไม่ตั้งใจ |
| S10 | worked example ใน PRD §9.5 ต้องได้ตัวเลขตรงเป๊ะ | NFR-MAINT-01 | golden test ที่ hardcode ทั้ง input และ output ที่คาดไว้ |

## Key Stories

- US-10 นักศึกษาดูคะแนนของตัวเอง
- (Sprint ถัดไป) รายงานฝั่งอาจารย์ · finalize · recompute

## Bolt Type

- [x] **DDD Construction** — เป็นหัวใจของคุณค่าที่ระบบให้ และเป็นจุดที่คำนวณผิดแล้วกระทบคะแนนจริงของนักศึกษา
- [ ] Simple Construction

## Human Checkpoint

**unit นี้ทำงานได้โดยไม่ต้องรู้ implementation ของ unit อื่นไหม**

ได้ และ**ต้อง**ได้ — AR-01 บังคับว่าเป็น pure function ของข้อมูลใน database
ถ้าวันไหนพบว่า Scoring Engine ต้องเรียก HTTP หรืออ่าน DB เอง แปลว่าออกแบบผิดแล้ว
เพราะจะคำนวณซ้ำให้ได้ผลเดิมไม่ได้ และ audit ไม่ได้
