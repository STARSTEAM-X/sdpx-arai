# WS-08 — Refactor publish_assignment

วันที่ตรวจ: 2026-10-18 · ฝั่ง backend · baseline `c69554c` บน `develop`.

## Function และขอบเขต

`backend/app/api/assignments.py::publish_assignment` ลดจาก **93 เป็น 61 บรรทัด**
(นับ AST รวม docstring/comment/บรรทัดว่างภายใน function).
ย้าย feasibility และการสร้างคู่ไป `backend/app/domain/publication.py::generate_assignment_pairs`.
ไม่เปลี่ยน HTTP signature, response, seed semantics, authorization, SQL หรือ schema.

## Before

โค้ดเต็มก่อนแก้ดูได้ด้วย:

```powershell
git show c69554c:backend/app/api/assignments.py
```

ส่วนสำคัญเดิมใน HTTP handler (ตัดมาเฉพาะขอบเขตการสร้างคู่):

```python
group_plan = solve_group_feasibility(
    groups,
    target_coverage=assignment.target_coverage,
    max_workload=assignment.max_workload,
)
if not group_plan.feasible:
    raise ValidationError(
        group_plan.reason or "ตั้งค่าปัจจุบันสร้างคู่ประเมินไม่ได้", field="targetCoverage"
    )

created = 0
for criterion in assignment.criteria_for(Side.GROUP):
    pairs = generate_group_pairs(
        groups,
        criterion_id=criterion.id,
        coverage=group_plan.achievable_coverage,
        workload=group_plan.workload_per_evaluator,
        seed=chosen_seed,
        assignment_id=assignment.id,
    )
    repo.save_pairs(assignment.id, pairs, criterion_id=criterion.id)
    created += len(pairs)
```

ถัดจากนี้ยังมี loop INDIVIDUAL ใน handler แล้วจึง mark published และบันทึก audit.

## Issues Found

- HTTP handler รวมกฎ feasibility/การเปิดฝั่งบุคคล/การสร้างคู่กับ transaction และ response.
- ยังไม่มี dedicated publish characterization harness ที่รันโดยไม่ต้องใช้ DB.
- ก่อนเปลี่ยนแปลงต้องแยกข้อเท็จจริงออกจากข้อเสนอเก่าใน `ai-review.md`:
  race และ seed overflow ยังไม่ได้พิสูจน์; per-row INSERT ยังไม่ใช่หลักฐานว่าคอขวดอยู่ที่ DB.

## After

```python
created = 0
for criterion, pairs in generate_assignment_pairs(assignment, groups, seed=chosen_seed):
    repo.save_pairs(assignment.id, pairs, criterion_id=criterion.id)
    created += len(pairs)
```

helper เป็น pure generator รับ assignment/roster/seed ไม่อ่าน HTTP, SQL, clock หรือ random state
ภายนอก และไม่เขียนข้อมูล. GROUP และ INDIVIDUAL ยังแยกกฎเดิม.

เลือก **lazy generator** เพื่อคงลำดับ `generate → save` ทีละ criterion เหมือนเดิม
แทนการสร้างทุก criterion ล่วงหน้า. การตรวจ publishability ยังเกิดก่อนโหลด roster.
transaction, ownership, mark published, audit และ success log หลัง commit ยังคงอยู่ใน route.
หาก generation/save/audit ผิดพลาด exception ยังออกจาก transaction และไม่มี success log.

## What AI Suggested vs What We Did

| ข้อเสนอ | ตัดสินใจและเหตุผล |
|---|---|
| เพิ่ม PublishService/repository framework | แยกเฉพาะ pure generation ก่อน: แก้ขอบเขตความรับผิดชอบจริงโดยไม่เพิ่ม abstraction ที่ยังไม่มีผู้ใช้ |
| รวม GROUP/INDIVIDUAL เป็น generic strategy | ไม่ทำ: feasibility และ P10 ต่างกันจริง การรวมต้องเพิ่ม branching อีก |
| batch INSERT/เพิ่ม pool/แก้ concurrent publish ไปพร้อมกัน | เลื่อน: เป็น optimization หรือ behavior change ต้องมีหลักฐานเฉพาะ ไม่ปนกับ refactor |
| เปลี่ยน signed seed ให้เป็น non-negative | ไม่ทำ: PRD ไม่ได้ห้ามค่าติดลบและเดิมใช้งานได้ ข้อจำกัด bigint ต้องเป็นงาน validation แยกต่างหาก |

## Test Harness ก่อนเริ่มแก้

เพิ่ม `backend/tests/api/test_publish_characterization.py` **ก่อน refactor** 7 cases:
GROUP อย่างเดียว/ทั้งสองฝั่ง, response และจำนวนคู่, seed 0/สุ่ม,
non-DRAFT, infeasible roster, save failure และ audit failure.
เมื่อรวม assignment unit tests เดิม: **28 passed in 1.20s** บน code ก่อนแก้.

ไฟล์ characterization ถูกตรึงตลอดการ refactor ด้วย SHA-256:

```text
658BE6E5280CD32B9A9FF3EFDE6DC254AF936E27CB963F5823291CEBDBBEC481
```

หลัง extraction รวม characterization + assignment + pairing tests:
**121 passed in 0.84s**. Ruff พบ unused import `ValidationError` ที่ย้ายออกไปแล้ว 1 จุด;
ลบ import แล้วรันซ้ำ **121 passed in 1.15s**, Ruff ผ่าน.
ไม่มี test แดงจาก extraction และไม่ต้อง revert (0 ครั้ง).

## ตรวจเทียบกับ baseline เพิ่มเติม

โหลดเฉพาะ AST ของ `publish_assignment` จาก `git show c69554c:...` ลง namespace
ที่ใช้ boundary สังเคราะห์ชุดเดียวกับ function ปัจจุบัน ไม่เปลี่ยน production files หรือ tests
ที่ตรึงไว้. เปรียบเทียบ response/error type/message/field, รายการ pair ทุก field,
seed, audit payload และลำดับเรียก transaction/repository/log.

**8 สถานการณ์ให้ผลตรงกันทุก field:** GROUP; 2 GROUP criteria + INDIVIDUAL;
save ล้มที่ criterion ที่สอง; non-DRAFT; น้ำหนักผิด; infeasible;
audit ล้ม; signed seed ติดลบ.
fake transaction ยืนยัน exception propagation/call order เท่านั้น ไม่ใช้แทนหลักฐาน SQL rollback.

## ผล verification ทั้งระบบ

| ตรวจ | ผล 2026-10-18 |
|---|---|
| Backend unit/API | 428 passed, 29 integration deselected, 4.50s |
| Frontend unit | 21 passed, Vitest 441ms |
| Unit loop ทั้งสองคำสั่งต่อเนื่อง รวม startup | **8.04s <10s** |
| Backend Ruff | ผ่าน |
| Frontend lint/typecheck/build | exit 0; lint มี 16 warning เดิม ไม่มี error |
| OpenAPI lint | ผ่าน ไม่มี warning/error |
| PostgreSQL integration ใน Docker | 29 passed, 1.24s |
| Full-stack E2E บน built web/API/Postgres | **118 passed, 1.7m**, exit 0 |

E2E ครอบคลุม deterministic seed ทั้ง stack, publish ซ้ำ 409, ไม่ประเมินกลุ่มตัวเอง,
ownership, scoring และ export เดิม. ไม่มีการเปลี่ยนไฟล์ E2E เพื่อให้ผ่าน.
ผลนี้ไม่อ้างว่าแก้ concurrent publish, autosave coordination หรือ NFR 200 users แล้ว.

## แยก refactor ออกจาก security tests

commit refactor แตะเฉพาะ production extraction และเอกสารนี้ ไม่มี test file.
characterization ถูกเพิ่มใน commit ก่อนหน้า; security regression เป็นงานแยก.
existing `test_deployment_safety.py` เพิ่มเฉพาะ key สังเคราะห์ใน fixture เพราะ production
เริ่มบังคับ key ของตัวเองตาม security requirement ใหม่ ไม่ลบ/ผ่อน assertion.
ดูเหตุผลใน [ws08-security-findings.md](ws08-security-findings.md).

เนื่องจาก `main` มีเพียง `.gitattributes` การเทียบ `main...HEAD` จะรวมประวัติงานทั้งโครงการ
และใช้พิสูจน์ refactor นี้ไม่ได้. ให้เทียบ commit refactor กับ parent ของมัน หรือ baseline `c69554c`.
