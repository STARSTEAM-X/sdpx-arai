# Unit: Roster Import

## Purpose

แปลงไฟล์ CSV ที่อาจารย์อัปโหลด ให้กลายเป็นรายชื่อสมาชิกและกลุ่มในห้องเรียน **แบบ all-or-nothing**

## Responsibilities

- อ่าน CSV แล้ว normalize header (ไม่สนตัวพิมพ์เล็กใหญ่)
- normalize อีเมล: lowercase, ตัด dot ใน gmail, ตัด `+tag`
- ตรวจความถูกต้องทุกแถว **ก่อน** บันทึกอะไรเลย
- รวบรวมความผิดของทุกแถวแล้วรายงานพร้อมกัน ไม่ใช่หยุดที่แถวแรกที่ผิด
- แยก "ผิดจนต้อง reject" ออกจาก "เตือนแต่ผ่านได้"

## NOT Responsible For

- การอัปโหลดไฟล์และจัดการ multipart — เป็นของชั้น HTTP
- การเขียนลง database — คืนผลการ parse และ validate ออกไป ให้ชั้นบนเป็นคนบันทึกใน transaction เดียว
- การตรวจว่าผู้เรียกมีสิทธิ์ import ไหม — เป็นของ Authorization
- การสร้าง user ที่ยังไม่เคย login — ชั้นบนทำ โดย unit นี้แค่บอกว่ามีอีเมลอะไรบ้าง

## Dependencies

- **Depends on:** ไม่มี — รับ bytes ของไฟล์เข้ามา คืนโครงสร้างข้อมูลออกไป
- **Used by:** endpoint `POST /api/classrooms/{id}/roster:import`

## Key Business Rules

| # | กฎ | อ้าง | test ที่ต้องเขียน |
|---|---|---|---|
| R1 | **atomic** — ถ้ามีแถวใดผิด ต้องไม่บันทึกแถวใดเลย | FR-CLASS-02 | CSV 100 แถว ผิดแถว 42 → ผลลัพธ์ต้องเป็น reject และ `details` ระบุ `row: 42` |
| R2 | รายงานความผิด **ทุกแถว** ไม่ใช่แค่แถวแรก | FR-CLASS-02 | ผิด 3 แถว → ต้องได้ 3 รายการใน `details` |
| R3 | header ไม่สนตัวพิมพ์เล็กใหญ่ | FR-CLASS-01 | `Email,Group_Name` ต้องผ่านเหมือน `email,group_name` |
| R4 | normalize อีเมลก่อนจับคู่ | FR-AUTH-03 | `Somchai.A+x@uni.ac.th` กับ `somchaia@uni.ac.th` ต้องถือเป็นคนเดียวกัน |
| R5 | ตรวจ 4 อย่าง: อีเมลซ้ำ, อีเมลผิดรูปแบบ, `group_name` ว่าง, กลุ่มที่มีสมาชิก < 2 | FR-CLASS-03 | แต่ละกรณีต้องรายงานแยกประเภทกัน |
| R6 | กลุ่มที่มีสมาชิกน้อยกว่า 2 เป็น **warning ไม่ใช่ error** | FR-CLASS-03 | import ผ่านได้ แต่ต้องมี warning `GROUP_TOO_SMALL` |
| R7 | รองรับไฟล์ที่มี BOM และ encoding ที่ไม่ใช่ UTF-8 | จาก AI review | ไฟล์ที่ export จาก Excel ภาษาไทยต้อง parse ได้ |

## Key Stories

- US-03 นำเข้ารายชื่อนักศึกษาจาก CSV

## Bolt Type

- [ ] DDD Construction
- [x] **Simple Construction** — เป็น parsing + validation ที่กฎชัดเจน ไม่มี domain logic ที่ต้องตัดสินใจซับซ้อน
      แต่ **ต้องมี test แน่นเป็นพิเศษ** เพราะเป็นประตูทางเข้าของข้อมูลทั้งระบบ
      ข้อมูลผิดที่หลุดเข้ามาตรงนี้จะไปโผล่เป็นคะแนนผิดในตอนท้าย

## Human Checkpoint

**unit นี้ทำงานได้โดยไม่ต้องรู้ implementation ของ unit อื่นไหม**

ได้ — รับ bytes คืนผลลัพธ์ที่ parse แล้ว
จุดที่ต้องระวังคือ **อย่าให้มันเขียน database เอง** เพราะกฎ atomic (R1)
จะบังคับใช้ได้ก็ต่อเมื่อการบันทึกทั้งหมดอยู่ใน transaction เดียวที่ชั้นบนคุม
