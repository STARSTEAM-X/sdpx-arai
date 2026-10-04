# AI Review — function ที่แย่ที่สุด (WS-07 homework → แก้ใน WS-08)

> **ยังไม่แก้** ตามที่ homework กำหนด — เก็บไว้เป็นเป้าหมาย refactor ของ WS-08
> ทุกข้อด้านล่างต้องถูก "ตรวจซ้ำโดยคน" ก่อนลงมือแก้ ข้อที่ไม่จริงให้ขีดฆ่าพร้อมเหตุผล ไม่ใช่ลบทิ้ง

## เลือก function อย่างไร

วัดทุก function ใน `backend/app/` ด้วย AST (จำนวนบรรทัด + จำนวนจุดแตกแขนง) แล้วเลือก
**`publish_assignment`** ใน [`backend/app/api/assignments.py`](../backend/app/api/assignments.py) (93 บรรทัด)

ไม่เลือกตัวที่ยาวที่สุด (`solve_group_feasibility`, `parse_roster_csv`, `_rebalance`) เพราะ 3 ตัวนั้นเป็น
domain logic ล้วนที่มี unit test + property-based test คุมอยู่แล้ว ส่วน `publish_assignment` เป็น
**HTTP handler ที่ทำงานของ domain + persistence + audit เองทั้งหมด** ทดสอบได้ทางเดียวคือผ่าน E2E
และเป็น endpoint ที่ช้าที่สุดที่วัดได้ใน WS-07 (ดู `performance-report.md`)

## Prompt ที่ใช้

```
Review this code and list ALL problems you find.
Be specific about: code smells, naming, missing error handling,
performance problems, and security issues.
Rate each issue: High / Medium / Low severity, and say why it matters.

[publish_assignment + PgAssignmentRepository.save_pairs + mark_published + assert_publishable]
```

**ผู้ review:** Claude (Claude Code, Opus 5.5) · 2026-10-04 · ป้อน code จริงของ 4 function ข้างบน
และตัวเลข duration_ms ของ publish จาก structured log ของ WS-07

## Response

| # | Severity | ปัญหา | ทำไมสำคัญ |
|---|---|---|---|
| 1 | **High** | **race condition เมื่อ publish ซ้อนกัน** — `assert_publishable` อ่านสถานะ `DRAFT` โดยไม่ lock แถว (`SELECT ... FOR UPDATE` ไม่มีใน repo เลย) และ `mark_published` เป็น `UPDATE ... WHERE id = %s` ที่ไม่มีเงื่อนไข `AND status = 'DRAFT'` | อาจารย์กดปุ่มสองครั้ง (หรือ retry ของ client) → ทั้งสอง request ผ่านด่านตรวจ → คู่ถูกสร้างสองรอบด้วย seed ต่างกัน ชุดที่ชนะคือชุดของ request ที่ commit ทีหลัง แต่ audit log มี `ASSIGNMENT_PUBLISHED` สองแถว seed สองค่า — reproduce การจับคู่ย้อนหลังไม่ได้ ขัด FR-PAIR-09 |
| 2 | **Medium** | **INSERT ทีละแถว** ใน `save_pairs` — 1 round trip ต่อ 1 คู่ | วัดจริงที่ 0.1 CPU: 240 คู่ใช้ 389–507ms, 960 คู่ใช้ **1,484ms** (~1.5ms/คู่ โตเป็นเส้นตรง) ห้อง 200 คน 3 เกณฑ์จะเกิน timeout ของ proxy ได้ · ใช้ `executemany` หรือ `COPY` ลดเหลือไม่กี่ round trip |
| 3 | **Medium** | **handler ทำงานของ domain เอง** — ตรวจ feasibility, วน criteria สร้างคู่, เขียน audit ทั้งหมดอยู่ใน function ของชั้น HTTP | กฎสำคัญที่สุดของ US-06 (ทั้งหมดหรือไม่มีเลย, P10 ฝั่งบุคคลที่ปิดต้องไม่มีคู่) ทดสอบได้แค่ผ่าน E2E ที่ช้าและต้องมี DB · ควรย้ายไป `PublishService` ที่รับ repo ปลอมได้แบบ `ClassroomService` |
| 4 | **Medium** | **`seed` จาก query string ไม่มีขอบเขต** | คอลัมน์เป็น `bigint` ค่าที่เกิน 2⁶³ น่าจะทำให้ psycopg throw → **500** แทน 422 (ยังไม่ได้ยิงยืนยัน) · ค่าติดลบผ่านได้ทั้งที่ seed ที่ระบบสุ่มเองอยู่ใน `[0, 2³¹)` |
| 5 | **Low** | loop สร้างคู่ฝั่ง GROUP กับ INDIVIDUAL ซ้ำโครงเดียวกัน | แก้ฝั่งหนึ่งแล้วลืมอีกฝั่งง่าย (เช่น เพิ่ม workload ให้ GROUP แต่ INDIVIDUAL ไม่ได้) |
| 6 | **Low** | `mark_published(..., at=...)` รับ `at` แล้วทิ้ง (`_ = at`) | parameter ที่ไม่ทำอะไรหลอกคนอ่านว่ามีการเก็บเวลา publish · audit มีเวลาอยู่แล้ว ควรลบหรือเพิ่มคอลัมน์จริง |
| 7 | **Low** | `save_pairs` ลบด้วย `criterion_id` อย่างเดียว ไม่ผูก `assignment_id` | ปลอดภัยตราบที่ criterion id เป็น uuid ไม่ซ้ำข้ามงาน แต่เป็นสมมติฐานที่ไม่มีอะไรบังคับไว้ใน function นี้ |
| 8 | **Low** | เก็บ `request.client.host` ลง audit | IP เป็นข้อมูลส่วนบุคคล · เบื้องหลัง proxy ของ Render ค่านี้คือ IP ของ proxy ไม่ใช่ผู้ใช้ จึงทั้งเสี่ยงและไม่มีประโยชน์ — ต้องอ่าน `X-Forwarded-For` แบบเชื่อเฉพาะ proxy ที่รู้จัก |

## สิ่งที่คนต้องตรวจซ้ำก่อนเชื่อ (เตรียมไว้สำหรับ WS-08)

- ข้อ 1: เขียน integration test ที่ยิง publish สองครั้งพร้อมกัน (2 thread, 2 connection) แล้วดูว่าได้ audit 2 แถวจริงไหม
  — ถ้าจริงคือ bug ที่ต้องแก้ก่อน refactor อย่างอื่น
- ข้อ 2: ตัวเลขมาจาก log จริงแล้ว แต่ต้องแยกเวลาของ `generate_group_pairs` (CPU) ออกจากเวลา INSERT (I/O)
  ก่อนสรุปว่าคอขวดคือ round trip
- ข้อ 4: ยิง `POST /api/assignments/{id}:publish?seed=99999999999999999999` กับ stack ใน `compose.test.yaml` แล้วดู status
- ข้อ 8: ตรวจว่า Render ส่ง header อะไรมาจริง ก่อนเลือกวิธีอ่าน IP
