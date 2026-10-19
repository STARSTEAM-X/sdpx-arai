# Coverage Report

วัดล่าสุด **2026-08-23** (หลังจบ WS-04 + งาน Google OIDC) · commit ที่วัด: ดู `git log` ของไฟล์นี้

> HTML report ฉบับเต็มอยู่ที่ `docs/coverage/backend/index.html` และ `docs/coverage/frontend/index.html`
> ทั้งสองโฟลเดอร์ถูก gitignore ไว้ — generate ใหม่ด้วยคำสั่งท้ายแต่ละหัวข้อ

## Backend — 80%

```
Name                                    Stmts   Miss  Cover
-----------------------------------------------------------
app\domainccess.py                       17      0   100%
app\domain\classroom_service.py            31      0   100%
app\domain\email.py                        15      0   100%
app\domain\models.py                       52      0   100%
app\domainepositories.py                  8      0   100%
app\domainoster_service.py               16      0   100%
app\domainoster_import.py                61      1    98%
app\domain\errors.py                       27      1    96%
app\config.py                               18      1    94%
app\main.py                                 39      3    92%
app\google_oidc.py                          61      8    87%
apputh.py                                 26      5    81%
appepositories\pg_classroom_repo.py      57     11    81%
apppi\errors.py                          42     10    76%
app\migrate.py                              29      7    76%
appepositories\pg_user_repo.py           30      9    70%
apppi\classrooms.py                      39     12    69%
apppioster.py                          49     15    69%
app\db.py                                   18      7    61%
apppi	est_support.py                    43     21    51%
apppiuth.py                            47     31    34%
-----------------------------------------------------------
TOTAL                                     725    142    80%
124 passed in 2.10s
```

```bash
cd backend
./.venv/Scripts/python.exe -m pytest -m "" --cov --cov-report=html --cov-report=term-missing
```

`-m ""` รวม integration test ที่ปกติถูกตัดออก — ต้องมี Postgres ขึ้นก่อน
`--cov` ไม่ต้องระบุ `=app` เพราะ [`backend/.coveragerc`](../../backend/.coveragerc) ตั้ง `source` และ
`html directory` ไว้ให้แล้ว — HTML จะไปโผล่ที่ `docs/coverage/backend/` เอง

### test แบ่งเป็นสองชั้น

| ชั้น | จำนวน | ต้องมี DB | เวลา |
|---|---|---|---|
| unit + api (`pytest`) | **106** | ไม่ | **0.65s** |
| integration (`pytest -m integration`) | **18** | ใช่ | 1.12s |
| รวม (`pytest -m ""`) | **124** | ใช่ | 1.22s |

ลูปที่นักพัฒนารันทุกครั้งที่แก้ code คือชั้นบน — 0.65 วินาที ไม่ต้องยก Postgres
ชั้น integration มีไว้ปิดช่องว่างที่ fake repository มองไม่เห็น: **SQL ที่เขียนผิด**
ช่องว่างนั้นคือที่ที่บั๊ก `DISABLED` ซ่อนอยู่มาตลอด (ดู `backend/TEST_PLAN.md`)

### ตัวเลขนี้เดินทางมาอย่างไร

| | WS-03 | ก่อนปิด Sprint 1 | วันนี้ |
|---|---|---|---|
| statements | 192 | 606 | **725** |
| coverage | 99% | 72% | **80%** |
| จำนวน test | 52 | 86 | **124** |

ที่ขึ้นจาก 72% เป็น 80% ไม่ได้มาจากการไล่เขียน test ให้ครบบรรทัด
แต่มาจากการเพิ่มชั้น integration ซึ่งเดินผ่าน `pg_*_repo.py` ที่เดิม unit test แตะไม่ถึงเลย

| โมดูล | ทำไมยังต่ำ | ใครทดสอบแทน |
|---|---|---|
| `api/auth.py` 34% | flow OAuth เต็มเส้นต้องมี Google จริงตอบกลับ | ตรรกะที่ตัดสินใจจริงอยู่ใน `google_oidc.py` (87%) ซึ่งมี unit test 27 ตัว |
| `api/roster.py` 69% · `api/classrooms.py` 69% | เป็น route บาง ๆ ที่แค่แปลง JSON | E2E 22 ตัวที่ยิงผ่าน HTTP จริง |
| `api/test_support.py` 51% | seed/cleanup เรียกจาก E2E ไม่ใช่จาก pytest | E2E fixture `cleanDb` |
| `migrate.py` 76% | เส้นทาง error ตอน migration พังยังไม่ได้ทดสอบ | รับไว้เป็น gap ที่ยอมรับ |

**สิ่งที่ตัวเลขนี้บอกจริง ๆ:** `domain/` ทั้งโฟลเดอร์อยู่ที่ 96–100% รวมถึง `access.py`
กับ `roster_service.py` ที่เพิ่งเขียนซึ่งได้ 100% ทั้งคู่ — กฎธุรกิจไม่มีข้อไหนหลุดการทดสอบ

## Frontend — 0.31%

```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|--------
All files          |    0.31 |        0 |       0 |    0.32
 src/lib/scale.ts  |     100 |      100 |     100 |     100
 (ที่เหลือทั้งหมด)   |       0 |        0 |       0 |       0
Statements : 0.31% ( 1/316 )
5 passed
```

```bash
cd frontend && npm run test:cov
```

**ตัวเลขนี้ต่ำโดยตั้งใจ และเป็นตัวเลขจริง**

ตอนแรกรายงานขึ้น 100% เพราะ vitest นับเฉพาะไฟล์ที่ test import เข้ามา
จึงตั้ง `coverage.all = true` ให้นับไฟล์ที่ยังไม่ถูกทดสอบด้วย
เหตุผลที่ยังไม่เขียน unit test ให้ component อยู่ใน [`frontend/TEST_PLAN.md`](../../frontend/TEST_PLAN.md)

ที่ลดลงเรื่อย ๆ เพราะตัวหารโตขึ้นทุกรอบ (105 → 246 → **316** statements — ล่าสุดจาก
หน้า `ClassroomDetailPage`) ส่วนตัวเศษยังเป็น `scale.ts` ไฟล์เดิมไฟล์เดียว

## E2E — 22 tests

| รันกับ | ผล | เวลา |
|---|---|---|
| local (`npm run e2e`) | **22 passed** | 27.4s |
| local `--repeat-each=3` | **66 passed** — ไม่ flaky | 1.3m |
| staging | **รันไม่ได้โดยตั้งใจ** — ดูด้านล่าง |

```bash
docker compose up -d db          # ต้องมี Postgres ก่อน
npm run e2e
npx playwright test --repeat-each=3
```

### ทำไมรัน E2E กับ staging ไม่ได้ (และทำไมนั่นคือเรื่องดี)

fixture `cleanDb` เป็น `auto: true` จึงเรียก `POST /api/test/seed` ก่อนทุก test
แต่ staging ตั้ง `ENVIRONMENT=production` ทำให้ router ชุด test ไม่ถูกลงทะเบียนเลย

```
POST https://paireval-api.onrender.com/api/test/session  →  HTTP 404
```

404 นี้คือหลักฐานว่า guard ทำงาน — ถ้าวันไหนมันตอบ 200 แปลว่ามีคนเปิดช่องให้
ใครก็ได้ `TRUNCATE` database และปลอมเป็นใครก็ได้ผ่าน internet

ผลรัน staging **6 passed / 8.3s** ที่เคยบันทึกไว้เป็นตัวเลขจาก WS-03
ตอนที่ยังมีแต่ smoke test และยังไม่มี fixture ที่ต้อง seed

---

## ข้อควรระวังเรื่องตัวเลขพวกนี้

coverage บอกแค่ว่า **test เดินผ่าน code กี่บรรทัด** ไม่ได้บอกว่า
test จะจับได้ไหมถ้า logic ผิด — เป็นไปได้ที่จะมี coverage 100%
โดยที่ทุก test เขียวตลอดไม่ว่า business rule จะถูกลบไปกี่ข้อ

ตัวเลขที่ตอบคำถามนั้นคือ **ผล fidelity check** ใน [`backend/TEST_PLAN.md`](../../backend/TEST_PLAN.md)
และ [`frontend/TEST_PLAN.md`](../../frontend/TEST_PLAN.md) ซึ่งพิสูจน์ด้วยการทำให้พังจริงแล้วดูว่า test แดงไหม
