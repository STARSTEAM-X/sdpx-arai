# Test Plan — Backend

> ลอกมาจาก section *Key Business Rules* ใน `memory-bank/units/*/unit-brief.md` โดยตรง
> ทุกกฎที่เขียนไว้ตอน WS-02 ต้องมีบรรทัดของตัวเองที่นี่

## Functions ที่ต้อง Test

### 1. `ClassroomService.create_classroom()` — US-02

| กฎ | พฤติกรรมที่คาดหวัง | Test |
|---|---|---|
| C1 | ผู้สร้างได้ role `OWNER` | `test_C1_ผู้สร้างได้เป็น_OWNER` |
| C2 | ชื่อว่างหรือมีแต่ช่องว่าง → `ValidationError` | `test_C2_ชื่อว่างถูกปฏิเสธ` (3 เคส) |
| C3 | ชื่อยาวเกิน 200 ตัว → `ValidationError` | `test_C3_ชื่อยาวเกินกำหนดถูกปฏิเสธ` |
| C4 | ไม่ระบุ timezone → `ValidationError` | `test_C4_ไม่ระบุ_timezone_ถูกปฏิเสธ` |
| C5 | ชื่อที่ยุบเป็น slug แล้วว่าง → `ValidationError` | `test_C5_ชื่อที่มีแต่อักขระพิเศษถูกปฏิเสธ` |
| C6 | slug ซ้ำ → `ConflictError` | `test_C6_slug_ซ้ำถูกปฏิเสธ` |
| C6 | ถูกปฏิเสธแล้ว **ต้องไม่บันทึกอะไรเลย** | `test_C6_ถูกปฏิเสธแล้วต้องไม่บันทึกอะไรเลย` |
| C7 | `allowed_email_domains` เก็บเป็นตัวพิมพ์เล็ก | `test_C7_allowed_email_domains_ถูกเก็บเป็นตัวพิมพ์เล็ก` |
| — | ชื่อถูกตัดช่องว่างหัวท้าย | `test_ชื่อถูกตัดช่องว่างหัวท้ายก่อนบันทึก` |
| — | บันทึกสำเร็จแล้วอ่านกลับได้ | `test_สร้างสำเร็จแล้วถูกบันทึกลง_repository` |

### 2. `slugify()` — US-02

| กฎ | Test |
|---|---|
| ยุบช่องว่างและอักขระพิเศษเป็นขีดเดียว | `test_แปลงชื่อเป็น_slug` (4 เคส รวมภาษาไทย) |
| ชื่อที่มีแต่อักขระพิเศษได้ slug ว่าง | `test_ชื่อที่มีแต่อักขระพิเศษได้_slug_ว่าง` |

### 3. `parse_roster_csv()` — US-03

| กฎ | พฤติกรรมที่คาดหวัง | Test |
|---|---|---|
| R1 | มีแถวผิดแม้แถวเดียว → ไม่คืนผลบางส่วน | `test_R1_มีแถวผิดแม้แถวเดียว_ต้องไม่คืนผลบางส่วน` |
| R2 | รายงานความผิด **ทุกแถว** ไม่ใช่แค่แถวแรก | `test_R2_รายงานความผิดทุกแถว_ไม่ใช่แค่แถวแรก` |
| R3 | header ไม่สนตัวพิมพ์เล็กใหญ่ | `test_R3_header_ไม่สนตัวพิมพ์เล็กใหญ่` |
| R3 | header มีช่องว่างหัวท้ายก็อ่านได้ | `test_R3_header_มีช่องว่างหัวท้ายก็ยังอ่านได้` |
| R4 | normalize อีเมลก่อนเก็บ | `test_R4_normalize_ก่อนเก็บ` |
| R5 | อีเมลผิดรูปแบบ → แถวผิด | อยู่ใน `test_R1...` และ `test_R2...` |
| R5 | `group_name` ว่าง → แถวผิด | อยู่ใน `test_R2...` |
| R5 | อีเมลซ้ำ **หลัง normalize** → แถวผิด | `test_R5_อีเมลซ้ำหลัง_normalize_ถูกจับได้` |
| R6 | กลุ่มสมาชิก < 2 เป็น **warning ไม่ใช่ error** | `test_R6_กลุ่มเล็กเกินไปเป็น_warning_ไม่ใช่_error` |
| R6 | ทุกกลุ่มพอ → ไม่มี warning | `test_ทุกกลุ่มมีสมาชิกพอ_ต้องไม่มี_warning` |
| R7 | ไฟล์มี BOM จาก Excel อ่านได้ | `test_R7_ไฟล์ที่มี_BOM_จาก_Excel_อ่านได้` |
| R7 | ไฟล์ cp874 ภาษาไทยอ่านได้ | `test_R7_ไฟล์_cp874_ภาษาไทยอ่านได้` |
| — | ขาด column ที่จำเป็น → ปฏิเสธ | `test_ขาด_column_ที่จำเป็นถูกปฏิเสธ` |
| — | column เกินถูกละไว้ | `test_column_ที่ไม่รู้จักถูกละไว้เฉย_ๆ` |
| — | แถวมีกลุ่มแต่ไม่มีอีเมล → แถวผิด | `test_แถวที่มีกลุ่มแต่ไม่มีอีเมลถูกจับเป็นแถวผิด` |
| — | บรรทัดว่างท้ายไฟล์ถูกข้าม | `test_บรรทัดว่างท้ายไฟล์ถูกข้าม_ไม่นับเป็นแถวผิด` |
| — | ไฟล์มีแต่ header → ปฏิเสธ | `test_ไฟล์ที่มีแต่_header_ถูกปฏิเสธ` |

### 4. `normalize_email()` / `is_valid_email()` — R4 / FR-AUTH-03

| กฎ | Test |
|---|---|
| lowercase และตัด `+tag` | `test_lowercase_และตัด_tag` (4 เคส) |
| ตัดจุดเฉพาะ gmail | `test_ตัดจุดเฉพาะ_gmail` |
| **ไม่**ตัดจุดกับ domain มหาวิทยาลัย | `test_ไม่ตัดจุดกับ_domain_ของมหาวิทยาลัย` |
| เปลี่ยน policy ได้ด้วย config | `test_เปลี่ยน_policy_ได้ด้วย_config` |
| รูปแบบถูก/ผิด | `test_รูปแบบที่ถูกต้อง` (3) · `test_รูปแบบที่ผิด` (6) |

### 5. `GET /api/health` — โครงสร้างพื้นฐาน

อยู่ใน `tests/api/` ไม่ใช่ `tests/unit/` เพราะใช้ `TestClient` ยก app ขึ้นจริง

### 6. `ClassroomAccess` — US-11

กฎสามข้อที่ต่างกันแค่ status code แต่ความต่างนั้นคือสาระของ story ทั้งหมด

| กฎ | Test |
|---|---|
| สมาชิกได้ role ของตัวเอง | `test_สมาชิกของห้องได้_role_ของตัวเองกลับมา` |
| **AC** ขอ resource ของห้องอื่นได้ 404 ไม่ใช่ 403 | `test_AC_สมาชิกห้อง_A_ขอ_resource_ห้อง_B_ได้_404_ไม่ใช่_403` |
| ห้องที่ไม่มีอยู่ตอบเหมือนห้องของคนอื่นเป๊ะ | `test_ห้องเรียนที่ไม่มีอยู่จริงตอบเหมือนห้องของคนอื่นทุกประการ` |
| **AC** นักศึกษาเรียก endpoint ผู้สอนได้ 403 | `test_AC_นักศึกษาเรียก_endpoint_ของผู้สอนได้_403` |
| ลำดับตรวจ: คนนอกได้ 404 ไม่ใช่ 403 | `test_คนนอกได้_404_ไม่ใช่_403_แม้จะเรียก_endpoint_ของผู้สอน` |

> กฎ "ลำดับการตรวจ" ข้อสุดท้ายคือข้อที่พลาดง่ายที่สุด — ถ้าเช็ค role ก่อนเช็คสมาชิก
> ระบบจะยังตอบ 403 ให้นักศึกษาถูกต้อง แต่คนนอกจะได้ 403 ด้วย แล้วรู้ทันทีว่า id นั้นมีจริง
> เป็นบั๊กที่ test ที่ดูแค่ "นักศึกษาได้ 403 ไหม" จับไม่ได้เลย

### 7. `RosterService` — US-03

`parse_roster_csv()` มี test ของตัวเองอยู่แล้ว ชุดนี้ทดสอบเฉพาะสิ่งที่ service เพิ่มเข้ามา

| กฎ | Test |
|---|---|
| **AC** ไฟล์ถูกต้องบันทึกครบทุกแถว | `test_AC_ไฟล์ถูกต้องทั้งไฟล์บันทึกครบทุกแถว` |
| **R1** ไฟล์มีแถวผิดแล้วต้องไม่บันทึกอะไรเลย | `test_R1_ไฟล์มีแถวผิดแล้วต้องไม่บันทึกอะไรเลย` |
| import ซ้ำได้ผลเท่าเดิม | `test_import_ซ้ำด้วยไฟล์เดิมได้ผลเท่าเดิม_ไม่สะสมสมาชิกซ้ำ` |
| ไฟล์ใหม่ถอดคนที่หายไป แต่ไม่แตะอาจารย์ | `test_การ_import_ถอดนักศึกษาที่ไม่อยู่ในไฟล์ใหม่ออก` · `test_import_ทับของเดิมแต่ไม่ลบอาจารย์ในห้อง` |
| ตรวจสิทธิ์ **ก่อน** parse | `test_ตรวจสิทธิ์ก่อน_parse_ไฟล์ผิดของคนไม่มีสิทธิ์ยังตอบเรื่องสิทธิ์` |

### 8. `evaluation_service.build_my_evaluations()` — US-07 (Sprint 3)

กฎเดียวที่ service นี้ตัดสินคือ "เปิดให้ดูหรือยัง" — รายชื่อคู่และใครทำไปแล้วเป็นข้อมูลดิบ
ที่ repo join มาให้แล้ว (ดู `pg_assignment_repo.my_pairs`) จึงไม่มี fake repo ในชุดนี้เลย

| กฎ | Test |
|---|---|
| **AC** `DRAFT` ไม่เห็นคู่ใดเลย ไม่ว่าฝั่งไหนจะเปิดหรือปิดอยู่ | `test_AC_assignment_ยังเป็น_DRAFT_ไม่เห็นคู่ใดเลย` |
| **AC** บอกข้อความว่ายังไม่เปิดเมื่อยังเป็น DRAFT | `test_AC_บอกข้อความว่าเปิดเมื่อไร` |
| **AC** publish แล้วเห็นคู่ครบพร้อมนับความคืบหน้าตรงตัวอย่างใน AC (12 คู่ ทำแล้ว 5) | `test_AC_publish_แล้วเห็นคู่ทั้งหมดพร้อมนับความคืบหน้า` |
| **AC** `individualMaxScore = 0` ไม่เห็น item แต่มีข้อความอธิบาย ไม่ใช่แค่ list ว่าง | `test_AC_individual_max_score_0_ไม่เห็น_item_แต่มีข้อความอธิบาย` |
| DRAFT บังทุกอย่างก่อนเสมอ แม้ฝั่งบุคคลจะปิดอยู่ด้วย | `test_DRAFT_มาก่อนเสมอ_แม้ฝั่งบุคคลจะปิดอยู่ด้วย` |
| ไม่มีคู่เลยไม่พัง / ทำครบทุกคู่แล้ว | `test_ไม่มีคู่เลยไม่พัง` · `test_ทำครบทุกคู่แล้ว` |

> criterion ติดมากับทุก item เสมอ (`criterion_id`/`criterion_name`) เพราะฝั่งเดียวกันมีได้
> หลายเกณฑ์ แต่ละเกณฑ์สร้างชุดคู่ของตัวเองตอน publish — พลาดจุดนี้ตอนร่างรอบแรก
> เพิ่งเห็นตอนทดสอบกับ assignment ที่มี 2 criteria ฝั่ง GROUP จริง ๆ ผ่าน API แล้วเห็นว่า
> คู่ของสองเกณฑ์ปนกันในรายการเดียวโดยไม่มีอะไรบอกว่าคู่ไหนของเกณฑ์ไหน

### 9. `comparison_service` — US-08 (Sprint 3)

กฎ 3 ข้อล้วนเป็นเรื่อง "ทำได้ไหม" — การ upsert จริง (idempotent ตาม FR-API-01) อยู่ใน
`PgComparisonRepository.save()` ซึ่งพิสูจน์ด้วย e2e ที่ยิง `PUT` ซ้ำ 3 ครั้งแล้วเทียบ `id`

| กฎ | Test |
|---|---|
| **AC** 1–6 ผ่านหมด ไม่มีค่ากลาง | `test_AC_1_ถึง_6_ผ่านหมด_ไม่มีค่ากลาง` (parametrize) |
| นอกช่วง 1–6 ถูกปฏิเสธ | `test_นอกช่วง_1_ถึง_6_ถูกปฏิเสธ` (parametrize: 0, 7, -1, 100) |
| **AC** ไม่ใช่ evaluator ของคู่นี้ถูกปฏิเสธด้วย `NOT_YOUR_PAIR` | `test_AC_ไม่ใช่_evaluator_ของคู่นี้ถูกปฏิเสธด้วย_NOT_YOUR_PAIR` |
| **AC** เลยกำหนดส่งแล้วถูกปฏิเสธด้วย `DEADLINE_PASSED` | `test_AC_เลยกำหนดส่งแล้วถูกปฏิเสธด้วย_DEADLINE_PASSED` |
| ตรงเวลา deadline เป๊ะถือว่าเลยแล้ว (ขอบเขตปิด ไม่ใช่เปิด) | `test_ตรงเวลา_deadline_เป๊ะถือว่าเลยแล้ว` |

> **บั๊กที่เจอตอนต่อ UI จริง ไม่ใช่ตอนเขียน backend:** `ComparisonRow.tsx` เดิมไม่เคลียร์
> สถานะ "บันทึกแล้ว" ตอนเลือกคำตอบใหม่ — กดเปลี่ยนคำตอบแล้วยังเห็นข้อความ "บันทึกแล้ว"
> ของคำตอบ**เก่า**ค้างอยู่ตลอด 2 วินาทีก่อน debounce จะยิงจริง ทำให้ผู้ใช้เข้าใจผิดว่า
> คำตอบใหม่บันทึกแล้วทั้งที่ยังไม่ได้ส่ง เจอตอนทดสอบ manual ผ่าน browser จริง ไม่ใช่จาก unit
> test เพราะเป็นเรื่อง UI state ล้วน ๆ ไม่มี business rule ให้ทดสอบแยก — บทเรียนคือ
> unit test คุ้มครอง backend ได้ แต่ UX bug แบบนี้ต้องเห็นด้วยตาจากการรันจริงเท่านั้น

### 10. `submission_service` — US-09 (Sprint 3)

ไม่มีไฟล์ domain แยกต่างหาก — กฎเดียวที่ endpoint นี้ต้องการ (deadline) ใช้
`comparison_service.assert_before_deadline` ตัวเดิมกับ US-08 ตรง ๆ ไม่มีอะไรใหม่ให้ทดสอบซ้ำ
ส่วนที่ทดสอบจริงคือ SQL (`PgComparisonRepository.submit_all`/`get_idempotent_response`) ซึ่ง
ไม่มี fake ให้ยืนยันด้วย unit test ได้ — พิสูจน์ผ่าน e2e `submissions.spec.ts` (8 ตัว) ทั้งหมด

> **บั๊กจริง 2 จุดที่เจอตอนต่อ US-09 ไม่ใช่ตอนออกแบบ:**
>
> 1. **Frontend ใช้ตัวนับผิดตัว** — `EvaluatePage.tsx` เดิมคำนวณ "ยังไม่ตอบกี่คู่" (ที่ใช้โชว์
>    dialog ยืนยันก่อน submit) จาก `totalCount - completedCount` ซึ่ง `completedCount` นับเฉพาะ
>    ที่ `SUBMITTED` แล้วเท่านั้น — คนที่ตอบครบทุกคู่ (มี `choice` แล้ว) แต่ยังไม่เคยกด submit
>    มาก่อนเลย จะเห็น dialog เตือนผิด ๆ ว่า "ยังไม่ตอบ 2 คู่" ทั้งที่ตอบไว้ครบแล้ว เพราะ
>    `completedCount` ยังเป็น 0 อยู่ตลอดจนกว่าจะ submit ครั้งแรก แก้โดยนับจาก
>    `items.filter(i => i.choice === null).length` แทน — เจอจาก e2e ที่ตั้งใจทดสอบ "ตอบครบ
>    แล้วไม่ควรมี dialog" ไม่ใช่จากการอ่านโค้ด
>
> 2. **ตาราง idempotency รุ่นแรกไม่มี scope/FK** — `POST /api/test/cleanup` เดิม
>    `TRUNCATE classroom_member, classroom, app_user ... CASCADE` ซึ่ง cascade ไปถึง
>    `assignment`, `pair_assignment`, `comparison` ได้เพราะมี FK อ้างกลับไปที่ `app_user`
>    แต่ `submission_idempotency` เก็บแค่ `idempotency_key` ดิบ ๆ ไม่มี FK อ้างใครเลย —
>    key ค้างข้าม test run ทำให้ test ที่สองที่ใช้ literal key ซ้ำ (เช่น `"submit-happy-1"`)
>    ได้ response แคชจาก run ก่อนหน้าที่ assignment/comparison ไม่มีอยู่แล้ว เห็นเป็น
>    `submittedCount` ที่ตอบสำเร็จ แต่ `my-evaluations` ตามไปดูจริงกลับว่าง — เพิ่ม
>    รุ่นปัจจุบันใช้ `submission_idempotency_scope` ผูก assignment, side และ evaluator ด้วย FK
>    พร้อม advisory transaction lock กัน request พร้อมกัน; ตารางเดิมคงไว้เพื่อ migration compatibility
>    (ดูรายละเอียดใน `docs/backlog.md` ที่ US-09)

### 11. `scoring_service` — US-16 (Sprint 3)

pure function ล้วน ตาม AR-01 — ไม่รู้จัก SQL เลย รับ `SubmittedComparison` ที่กรอง
`status = SUBMITTED` มาแล้วจากชั้นเรียก (S2) กฎ S1–S10 อ้างจาก
`memory-bank/units/scoring-engine/unit-brief.md`

| กฎ | Test |
|---|---|
| S9 ไม่มี comparison เลยคืน `None` ไม่ crash | `test_S9_ไม่มี_comparison_เลยคืน_None_ไม่_crash` |
| **AC S5** instructor_weight เป็น float ใน weighted mean ไม่ใช่นับ vote ซ้ำ | `test_AC_S5_instructor_weight_เป็น_float_ใน_weighted_mean_ไม่ใช่นับ_vote_ซ้ำ` |
| S6 ผลลัพธ์เป็น `Decimal` ไม่ใช่ `float` | `test_S6_ผลลัพธ์เป็น_Decimal_ไม่ใช่_float` |
| **AC S3** band mapping floor→ceiling ไม่ normalize (D2) | `test_AC_S3_band_mapping_ไม่_normalize` · `test_D2_ทุกคนได้เท่ากันหมด...` |
| **AC S8** comparison น้อยกว่า min_comparisons ติด `LOW_CONFIDENCE` | `test_AC_S8_comparison_น้อยกว่า_min_comparisons_ติด_flag_LOW_CONFIDENCE` |
| **D5** คะแนนแยกจากการมีส่วนร่วมโดยสิ้นเชิง (signature ไม่มีพารามิเตอร์ participation) | `test_D5_แยกคะแนนออกจากการมีส่วนร่วมโดยสิ้นเชิง` |
| **AC S4** ตอบครบ/ไม่ตอบเลย ได้ M เต็ม/ศูนย์ตามสัดส่วน · cap ที่ 1 เสมอ | `TestComputeParticipation` (4 ตัว) |
| **S10 golden test** — worked example PRD §9.5 ทุกตัวเลขต้องตรงเป๊ะ | `TestGoldenS10` (3 ตัว: กลุ่ม Aurora, นก ประเมินครบ, ต้น ประเมินไม่ครบ) |

> **ตัดสินใจเรื่องขอบเขต S10:** point ต่อ comparison มีแค่ 6 ค่าคงที่ (0, 0.2, 0.4, 0.6, 0.8, 1.0)
> การไล่หาชุด comparison ดิบที่เฉลี่ยแล้วได้ q = 0.61 (ตามตัวอย่างใน PRD) เป๊ะ ๆ เป็นปริศนาเลข
> ไม่ใช่การพิสูจน์สูตร ส่วนที่ worked example ตั้งใจตรวจคือสูตรตั้งแต่ q ลงไป (band mapping,
> ถ่วงน้ำหนักเกณฑ์, participation) — golden test จึงเริ่มจากค่า q ที่ PRD ให้มาตรง ๆ ส่วนความ
> ถูกต้องของค่าเฉลี่ยถ่วงน้ำหนักที่ได้ q มา ถูกทดสอบแยกด้วยตัวเลขกลม ๆ ใน `TestComputeQualityIndex`

> **S7 — แก้ไขแล้วเมื่อทำ US-13:** final score ถูกเขียนเป็น append-only batch และมี trigger
> ระดับ database ปฏิเสธ UPDATE/DELETE ของ `computed_score.is_final=true` โดยตรง
> (`008_immutable_score_snapshots.sql`, `010_protect_final_scores.sql`) พร้อม integration test
> ใน `test_scoring_repo.py`; การแก้คะแนนที่มีผลต้องผ่าน `score_override` พร้อมเหตุผลเท่านั้น

### 12. `finalize_service` — US-13 (Sprint 3)

pure function เหมือน `scoring_service` — รู้แค่ "ทำตอนนี้ได้ไหม" ไม่รู้จัก SQL หรือ HTTP
ทดสอบได้โดยไม่ต้องมี DB

| กฎ | Test |
|---|---|
| finalize ได้เมื่อเลย deadline และ publish แล้ว | `test_deadline_ผ่านแล้ว_finalize_ได้` |
| **AC** ยังไม่ถึง deadline finalize ไม่ได้ | `test_AC_ยังไม่ถึง_deadline_finalize_ไม่ได้` |
| ยัง DRAFT อยู่ finalize ไม่ได้ (ต้อง publish ก่อน) | `test_ยังไม่_publish_finalize_ไม่ได้` |
| FINALIZED อยู่แล้ว finalize ซ้ำไม่ได้ | `test_FINALIZED_อยู่แล้ว_finalize_ซ้ำไม่ได้` |
| ไม่มี LOW_CONFIDENCE ผ่านได้เลยไม่ต้องยืนยัน | `test_ไม่มี_low_confidence_ผ่านได้เลย` |
| **AC** มี LOW_CONFIDENCE แต่ยังไม่ยืนยันถูกปฏิเสธ (`field: confirmLowConfidence`) | `test_AC_มี_low_confidence_แต่ยังไม่ยืนยันถูกปฏิเสธ` |
| **AC** มี LOW_CONFIDENCE แต่ยืนยันแล้วผ่านได้ | `test_AC_มี_low_confidence_แต่ยืนยันแล้วผ่านได้` |
| FINALIZED แล้ว reopen ได้ | `test_FINALIZED_reopen_ได้` |
| ยังไม่ FINALIZED reopen ไม่ได้ | `test_ยังไม่_FINALIZED_reopen_ไม่ได้` |
| override มีเหตุผลผ่านได้ | `test_มีเหตุผลผ่านได้` |
| **AC** override ไม่กรอกเหตุผล (ว่าง/เว้นวรรค/`None`) ถูกปฏิเสธด้วย 422 (`field: reason`) | `test_AC_ไม่กรอกเหตุผลถูกปฏิเสธด้วย_422` (parametrize 3 ค่า) |

13 tests รวม — ครอบคลุมทุก AC ของ US-13 ที่เป็นกฎล้วน (ไม่นับ audit record ซึ่งพิสูจน์ผ่าน
`e2e/specs/scoring.spec.ts` เพราะต้องมี DB จริงถึงจะเห็น `AuditEvent` ที่บันทึกได้)

### 13. `solve_individual_feasibility()` คำเตือน anonymity ต่ำ + `pseudonymize_evaluators()` — US-15 (Sprint 3)

สองจุดที่ปิด AC ที่เหลือของ US-15 (เดิมเขียนไว้ว่ายังไม่ทำ — ปิดในรอบต่อมาวันเดียวกัน)

| กฎ | Test |
|---|---|
| **AC** กลุ่มขนาด m=3 (m−1 < min_comparisons) เตือนว่าคะแนนจะไม่มีวันแสดง แต่ยัง feasible | `test_AC_กลุ่มขนาด_3_เตือนว่า_anonymity_ต่ำ_คะแนนจะไม่มีวันแสดง` |
| กลุ่มขนาด 4 ขึ้นไป (m−1 ≥ min_comparisons default) ไม่มีคำเตือน | `test_กลุ่มขนาด_4_ขึ้นไปไม่มีคำเตือน` |
| เตือนเฉพาะกลุ่มที่ได้รับผลกระทบจริง ไม่เหมารวมทุกกลุ่ม | `test_เตือนเฉพาะกลุ่มที่ได้รับผลกระทบจริง_ไม่ใช่ทุกกลุ่ม` |
| เกณฑ์อิงตาม `min_comparisons` ของ assignment ไม่ใช่เลข 3 ตายตัว | `test_เกณฑ์คำเตือนอิงตาม_min_comparisons_ของ_assignment_ไม่ใช่ค่าตายตัว` |
| ห้องใหญ่พอทุกกลุ่มไม่มีคำเตือนเลย | `test_ไม่มีกลุ่มไหนเข้าเกณฑ์เตือนเลยเมื่อทุกกลุ่มใหญ่พอ` |

(อยู่ใน `tests/unit/test_pairing.py::TestIndividualFeasibility` ร่วมกับ test เดิมของ US-05/06)

| กฎ (`test_anonymity.py`) | Test |
|---|---|
| **AC** คืนรหัสที่ไม่ใช่ uuid จริง | `test_AC_คืนรหัสที่ไม่ใช่_uuid_จริง` |
| deterministic — เรียงตาม uuid string ไม่ใช่ลำดับที่ส่งเข้ามา | `test_เรียงตาม_uuid_string_ไม่ใช่ลำดับที่ส่งเข้ามา` |
| evaluator คนเดียวกันปรากฏหลายครั้งได้รหัสเดียว | `test_evaluator_คนเดียวกันปรากฏหลายครั้งได้รหัสเดียว` |
| edge case: ลิสต์ว่าง / คนเดียว | `test_ลิสต์ว่างคืน_dict_ว่าง` · `test_evaluator_คนเดียวได้_E1` |

**AC ที่เหลือของ US-15** (OWNER เท่านั้นเห็นตัวตนจริง, ต้องยืนยันเหตุผล, มี audit ทุกครั้ง,
CO_TEACHER เรียก export ปกติได้แต่ export-identified ไม่ได้) พิสูจน์ผ่าน `e2e/specs/scoring.spec.ts`
กลุ่ม `US-15 export raw comparison` (6 ตัว) เพราะต้องมี DB จริงถึงจะเห็น audit log และ role
matrix ทำงานครบวงจร — เพิ่ม capability ใหม่ `VIEW_EVALUATOR_IDENTITY` ใน `test_access.py` ด้วย
(auto-ขยายเป็น test ใหม่ 4 ช่องจาก parametrize matrix เดิม + 2 ตัว AC เฉพาะ)

---

## Integration Test — ชั้นที่ unit test มองไม่เห็น

`tests/integration/` ต้องมี Postgres จริงและถูก **ตัดออกจากลูปปกติ**

```bash
pytest                  # unit + api — ไม่ต้องมี DB
pytest -m integration   # เฉพาะที่ต้องมี Postgres
```

**ทำไมต้องมีชั้นนี้:** unit test ใช้ fake repository จึงพิสูจน์ได้แค่ว่าตรรกะถูก
แต่พิสูจน์ไม่ได้ว่า SQL ทำในสิ่งที่ fake แกล้งทำ — บั๊ก DISABLED ด้านล่างเกิดในช่องว่างนี้พอดี

ทุก test รันในทรานแซกชันที่ rollback เสมอ จึงไม่ทิ้งขยะและรันซ้ำได้ไม่จำกัด

| ไฟล์ | ปกป้องอะไร |
|---|---|
| `test_user_repo.py` | PENDING → ACTIVE ตอน login · google_sub ถูกผูก · **บัญชีที่ถูกระงับต้องไม่ถูกปลุกคืน** · **AC ข้อ 3 ของ US-01**: อีเมลใน roster ต่างรูปแบบกับตอน login แต่ต้องเป็นบัญชีเดียวกัน (เดินทั้งเส้น CSV → roster → login) |
| `test_classroom_repo.py` | `get_member_role` คืน None ทั้งกรณีไม่มีห้องและไม่ใช่สมาชิก · `replace_roster` เป็น replace จริง · ลำดับของ `list_roster` คงที่ |

---

## Fidelity Check (WS-03)

ทำ 3 ครั้งจาก 3 unit ต่างกัน เพื่อดูว่า harness ปกป้องทั่วถึงหรือกระจุกอยู่ที่เดียว
วิธี: แก้เงื่อนไขให้เป็น `False` (ไม่ comment ทิ้ง เพราะจะทำให้ syntax พังแทนที่จะ test แดง)

| # | กฎที่ลบ | ไฟล์ | Test ที่แดง | ผล |
|---|---|---|---|---|
| 1 | **C6** — slug ซ้ำต้องถูกปฏิเสธ | `classroom_service.py` | `test_C6_slug_ซ้ำถูกปฏิเสธ`<br>`test_C6_ถูกปฏิเสธแล้วต้องไม่บันทึกอะไรเลย` | ✅ harness ปกป้องกฎนี้ |
| 2 | **R1** — atomic (ปล่อยให้คืนผลบางส่วน) | `roster_import.py` | `test_R1_มีแถวผิดแม้แถวเดียว...`<br>`test_R2_รายงานความผิดทุกแถว...`<br>`test_R5_อีเมลซ้ำหลัง_normalize...` | ✅ harness ปกป้องกฎนี้ |
| 3 | **R4** — ตัด `+tag` ตอน normalize | `email.py` | 5 tests ข้าม 2 ไฟล์ | ✅ harness ปกป้องกฎนี้ |

หลังกู้คืนทั้ง 3 ครั้ง → **52 passed** เท่าเดิม (ตัวเลข ณ ตอน WS-03)

### ครั้งที่ 5 — ทำตอน US-07 (Sprint 3, 2026-08-24)

| # | กฎที่ลบ | ไฟล์ | Test ที่แดง | ผล |
|---|---|---|---|---|
| 4 | เงื่อนไข `status is AssignmentStatus.DRAFT` (เปลี่ยนเป็น `if False`) | `evaluation_service.py` | 4 ตัวใน `test_evaluation_service.py` ทั้งกลุ่ม `Testยังไม่เปิด` และ `test_DRAFT_มาก่อนเสมอ...` | ✅ harness ปกป้องกฎนี้ |

หลังกู้คืน → **278 passed** (270 เดิม + 8 ของ US-07)

### ครั้งที่ 6 — ทำตอน US-08 (Sprint 3, 2026-08-24)

| # | กฎที่ลบ | ไฟล์ | Test ที่แดง | ผล |
|---|---|---|---|---|
| 5 | เงื่อนไข `pair_evaluator_email != caller_email` (เปลี่ยนเป็น `if False`) | `comparison_service.py` | `test_AC_ไม่ใช่_evaluator_ของคู่นี้ถูกปฏิเสธด้วย_NOT_YOUR_PAIR` | ✅ harness ปกป้องกฎนี้ |

หลังกู้คืน → **293 passed** (278 เดิม + 15 ของ US-08)

> ข้อสังเกต: การลบ R4 ทำให้ test แดงข้ามไฟล์ไปถึง `test_roster_import.py` ด้วย
> แปลว่า roster import พึ่งพา email normalization จริง ไม่ได้ทำงานแยกกัน
> ซึ่งตรงกับที่ออกแบบไว้ และ test สะท้อนความจริงข้อนี้ออกมาเอง

### ครั้งที่ 7 — ทำตอน US-13 (Sprint 3, 2026-08-24)

| # | กฎที่ลบ | ไฟล์ | Test ที่แดง | ผล |
|---|---|---|---|---|
| 6 | เงื่อนไข `now < deadline` (เปลี่ยนเป็น `if False`) | `finalize_service.py` | `test_AC_ยังไม่ถึง_deadline_finalize_ไม่ได้` | ✅ harness ปกป้องกฎนี้ |

หลังกู้คืน → **326 passed** (313 เดิม + 13 ของ US-13)

### ครั้งที่ 4 — ทำตอนปิด Sprint 1 (2026-08-23)

ครั้งนี้ต่างจากสามครั้งแรก: **ไม่ได้ทำให้กฎที่ทดสอบแล้วพัง แต่ย้อนการแก้บั๊กจริงกลับไป**
เพื่อพิสูจน์ว่า test ที่เพิ่งเขียนจับบั๊กนั้นได้จริง ไม่ใช่แค่เขียวไปด้วยกัน

| กฎที่ย้อน | ไฟล์ | ผลจริงที่รันแล้ว |
|---|---|---|
| บัญชี `DISABLED` ต้องไม่ถูกปลุกคืนตอน login (เปลี่ยน `CASE` กลับเป็น `status = 'ACTIVE'`) | `pg_user_repo.py` | **1 failed, 4 passed** — `AssertionError: - DISABLED / + ACTIVE` ✅ |

บั๊กนี้ทำให้ guard `USER_DISABLED` ใน `api/auth.py` เป็น dead code มาตลอด:
`ON CONFLICT` เขียนทับ status เป็น `ACTIVE` ก่อนที่ handler จะได้อ่านค่า
คนที่ถูกระงับจึงแค่กด login ใหม่ก็กลับมาใช้งานได้ และไม่มี test ตัวใดจับได้เลย
เพราะ unit test ทุกตัวใช้ fake repository ซึ่งไม่มี SQL ให้ผิดตั้งแต่แรก

---

## ตัวเลขล่าสุด

| | ค่า |
|---|---|
| จำนวน test | 52 |
| Coverage | **99%** (192 statements, ขาด 2) |

### Latency ของ Unit Test Loop

สองตัวเลขที่ WS-03--before ให้จด — วัดจริง 3 รอบ ค่าคงที่

| คำถาม | คำตอบ |
|---|---|
| suite รันเสร็จในกี่วินาที | **0.34 วินาที** (backend) · 0.65 วินาที (frontend) · **รวม ~1.0 วินาที** |
| แก้ code 1 บรรทัดแล้วต้องรอกี่วินาทีถึงรู้ว่าพัง | **0.02 วินาที** ถ้ารันเฉพาะไฟล์ที่เกี่ยว · **~1.0 วินาที** ถ้ารันทั้งหมด |

```bash
pytest                                      # 52 passed in 0.34s
pytest tests/unit/test_classroom_service.py # 17 passed in 0.02s
```

**เพดานของวิชาคือ 10 วินาที — ตอนนี้ใช้ไป 10% ของงบ**

ที่ต้องเฝ้าคือ *อะไรจะทำให้ตัวเลขนี้พุ่ง* ไม่ใช่ตัวเลขวันนี้:

| ความเสี่ยง | จะเกิดเมื่อ | กันไว้อย่างไร |
|---|---|---|
| test แตะ database จริง | WS-04 เป็นต้นไป | ยืนกรานให้ `tests/unit/` ใช้ fake เท่านั้น · test ที่ต้องใช้ DB ไปอยู่ `tests/integration/` แยก |
| test ยิง HTTP จริง | ตอนต่อ Google OAuth | mock ที่ขอบระบบ ไม่ใช่ยิงออกเน็ต |
| `time.sleep` ใน test | ตอนทำ autosave (US-08) | ใช้ fake clock ไม่ใช่รอจริง |

---

## การใช้ AI เขียน test — สิ่งที่รับและสิ่งที่ทิ้ง

### กระบวนการจริงต่างจากที่ lab ออกแบบไว้ ต้องบันทึกตามตรง

lab กำหนดลำดับว่า **เขียนเอง 2 ตัวก่อน → ให้ AI generate เพิ่ม → รีวิวแล้วทิ้งตัวที่ไม่ปกป้องอะไร**

สิ่งที่เกิดขึ้นจริงคือ AI agent เขียนทั้ง 52 ตัวรวดเดียวจาก `unit-brief.md`
จึง **ไม่มีขั้น "คัดทิ้ง" ที่นับเป็นตัวเลขได้** — ตัวเลข "ทิ้งไป N ตัว" ที่ตอบใน present
จะเป็นการแต่งเรื่องถ้าอ้างว่ามี

สิ่งที่ทำแทนและใช้ยืนยันคุณภาพได้จริงคือ **fidelity check** ด้านบน
ซึ่งพิสูจน์ด้วยการทำให้พังจริง ไม่ใช่การนับจำนวน

### test ที่พิจารณาแล้วตัดสินใจ *ไม่เขียน* พร้อมเหตุผล

นี่คือส่วนที่ทดแทนขั้น "คัดทิ้ง" — บันทึกไว้ตั้งแต่ตอนเขียน

| test ที่ไม่เขียน | เหตุผล |
|---|---|
| `test_constructor_เก็บ_repo_ไว้ใน_self._repo` | ทดสอบ implementation ภายใน ไม่ใช่กฎธุรกิจ · ถ้าเปลี่ยนชื่อตัวแปรแล้วแดง ทั้งที่พฤติกรรมเหมือนเดิม |
| `test_create_classroom_เรียก_slugify` | assert ลำดับการเรียกภายใน — lab ห้ามไว้ตรง ๆ · สิ่งที่ควรทดสอบคือ *ผลลัพธ์* slug ไม่ใช่ว่าเรียกฟังก์ชันไหน |
| assert ข้อความ error ภาษาไทยแบบเป๊ะ ๆ | ข้อความเปลี่ยนได้โดยพฤติกรรมไม่เปลี่ยน · จึง assert ที่ชนิด exception กับ `field` แทน |
| `test_created_at_เท่ากับ_now()` | ผูกกับนาฬิกา ทำให้ flaky · ถ้าจะทดสอบจริงต้อง inject clock ซึ่งยังไม่คุ้มตอนนี้ |
| `test_id_ที่สร้างไม่ซ้ำกัน` | ทดสอบ `uuid` ของ stdlib ไม่ใช่ code เรา |
| test แยกตัวต่อ 1 เคสของ `parametrize` | ซ้ำซ้อน · `parametrize` ให้ผลเท่ากันแต่อ่านง่ายกว่า |
| unit test ของ component ทั้ง 12 ตัวฝั่ง frontend | เป็น presentational ล้วน ไม่มี logic ที่จะผิดได้ · สิ่งที่ต้องพิสูจน์คือ "เปิดแล้วกดได้ไหม" ซึ่ง E2E ตอบตรงกว่า (ดู `frontend/TEST_PLAN.md`) |
| test ที่ assert ตัวเลข coverage | coverage เป็น metric ไม่ใช่พฤติกรรม · ตั้ง threshold ใน CI ดีกว่า (จะทำใน WS-06) |

### test ที่แก้หรือเพิ่มระหว่างทาง

| เกิดอะไร | ผล |
|---|---|
| ฝั่ง frontend เกือบเขียน `expect(1+1).toBe(2)` เพื่อพิสูจน์ว่า runner ทำงาน | เปลี่ยนเป็นย้าย `COMPARISON_SCALE` ออกมาเป็น domain module แล้วทดสอบกฎ D1 จริงแทน |
| coverage รอบแรก 97% ชี้ว่าเคส "แถวมีกลุ่มแต่ไม่มีอีเมล" ไม่มีใครทดสอบ | เพิ่ม `test_แถวที่มีกลุ่มแต่ไม่มีอีเมลถูกจับเป็นแถวผิด` → 99% |
| `RowError.__eq__` เขียนไว้แต่ไม่มีใครใช้ | เปลี่ยน assertion ให้เทียบ `RowError` ทั้งก้อนแทนการเทียบ `.row` เพื่อให้ code ที่เขียนไว้มีเหตุผลอยู่จริง |

> **คำถามที่อาจารย์จะถามใน present:** *"ถ้าให้ AI agent แก้ code ใน service นี้ตอนนี้ คุณเชื่อผลของมันแค่ไหน"*
>
> คำตอบที่มีหลักฐานรองรับ: เชื่อได้ในระดับที่ **fidelity check ครอบคลุม** — คือกฎ C6, R1, R4
> ถูกพิสูจน์แล้วว่าถ้า agent ทำพัง test จะแดง
> ส่วนกฎที่ยังไม่ได้ทดสอบ fidelity (C1–C5, C7, R2, R3, R5–R7) ยังเชื่อได้แค่ว่ามี test คลุมอยู่
> ซึ่ง**ไม่เท่ากับ**พิสูจน์แล้วว่ามันจับได้

## กฎที่ยังไม่มี test (ยอมรับไว้ชั่วคราว)

| กฎ / บรรทัด | เหตุผลที่ยังไม่ทำ | จะทำเมื่อไร |
|---|---|---|
| `roster_import.py:34` — ทุก encoding ถอดรหัสไม่ผ่าน | `cp874` และ `tis-620` เป็น single-byte codec ที่รับได้เกือบทุก byte จึงหา input ที่ล้มทั้ง 4 encoding ได้ยากมาก การเขียน test ที่ฝืนสร้างเคสนี้จะเปราะกว่าประโยชน์ที่ได้ | ถ้าเจอไฟล์จริงที่ล้ม ให้เอาไฟล์นั้นมาเป็น fixture |
| `errors.py:63` — `RowError.__repr__` | รันเฉพาะตอน pytest พิมพ์ค่าออกมาเวลา assert ล้ม ไม่ใช่ logic ที่ผู้ใช้พึ่งพา | ไม่ทำ — เก็บไว้เพราะช่วยตอน debug |
| กฎของ Scoring Engine (S1–S10) | ยังไม่ได้ implement | เมื่อทำ US-16 (Sprint 3) |

> แถวนี้เคยมี "Pairing Engine (P1–P10) ยังไม่ได้ implement" และ "authorization ข้ามห้องเรียน
> ยังไม่มีชั้น" ค้างมาตั้งแต่ WS-03 — ทั้งสองทำเสร็จและมี test คุมแล้วตั้งแต่ Sprint 1–2
> (P1–P10 ดู `test_pairing.py` 88 ตัว · authorization ดู หัวข้อ 6 ข้างบน) ลบทิ้งเมื่อมาแก้ไฟล์นี้
> ตอน US-07 — ทิ้งบรรทัดที่เท็จไว้อันตรายกว่าไม่มีบรรทัดนั้นเลย เพราะทำให้เชื่อว่ายังไม่มี test

> **สิ่งที่ต้องระวัง:** coverage 99% ไม่ได้แปลว่าปลอดภัย 99% —
> มันบอกแค่ว่า test เดินผ่าน code กี่บรรทัด ไม่ได้บอกว่า test จะจับได้ไหมถ้า logic ผิด
> ตัวเลขที่บอกเรื่องนั้นคือผล fidelity check ข้างบน
