# Coverage Report

วัดล่าสุด **2026-08-23** (หลังจบ WS-04 + งาน Google OIDC) · commit ที่วัด: ดู `git log` ของไฟล์นี้

> HTML report ฉบับเต็มอยู่ที่ `docs/coverage/backend/index.html` และ `docs/coverage/frontend/index.html`
> ทั้งสองโฟลเดอร์ถูก gitignore ไว้ — generate ใหม่ด้วยคำสั่งท้ายแต่ละหัวข้อ

## Backend — 72%

```
Name                                    Stmts   Miss  Cover
-----------------------------------------------------------
app\domain\classroom_service.py            31      0   100%
app\domain\email.py                        15      0   100%
app\domain\models.py                       44      0   100%
app\domain\repositories.py                  5      0   100%
app\domain\roster_import.py                61      1    98%
app\domain\errors.py                       23      1    96%
app\config.py                              18      1    94%
app\main.py                                37      3    92%
app\google_oidc.py                         61      8    87%
app\auth.py                                26      5    81%
app\api\errors.py                          42     10    76%
app\api\classrooms.py                      39     12    69%
app\db.py                                  18      7    61%
app\api\test_support.py                    43     21    51%
app\repositories\pg_user_repo.py           30     15    50%
app\repositories\pg_classroom_repo.py      37     24    35%
app\api\auth.py                            47     31    34%
app\migrate.py                             29     29     0%
-----------------------------------------------------------
TOTAL                                     606    168    72%
86 passed in 1.62s
```

```bash
cd backend && ./.venv/Scripts/python.exe -m pytest --cov --cov-report=html --cov-report=term-missing
```

`--cov` ไม่ต้องระบุ `=app` เพราะ [`backend/.coveragerc`](../../backend/.coveragerc) ตั้ง `source` และ
`html directory` ไว้ให้แล้ว — HTML จะไปโผล่ที่ `docs/coverage/backend/` เอง

### ตัวเลขนี้ลดลงจาก 99% ตอน WS-03 — เพราะอะไร

| | WS-03 | วันนี้ |
|---|---|---|
| statements ทั้งหมด | 192 | **606** |
| statements ที่ test เดินผ่าน | 190 | 438 |
| coverage | 99% | **72%** |
| จำนวน test | 52 | 86 |

**code โตเร็วกว่า test** — WS-04 กับงาน Google OIDC เพิ่ม 414 statements
ส่วนที่เพิ่มเข้ามาเป็น layer ที่ unit test แตะไม่ถึงโดยธรรมชาติ:

| โมดูล | ทำไมยังต่ำ | ใครทดสอบแทน |
|---|---|---|
| `api/auth.py` 34% | flow OAuth เต็มเส้นต้องมี Google จริงตอบกลับ | ตรรกะที่ตัดสินใจจริงอยู่ใน `google_oidc.py` (87%) ซึ่งมี unit test 27 ตัว |
| `repositories/pg_*.py` 35–50% | เป็น SQL ล้วน — unit test ใช้ fake repo แทนตามที่ `TEST_PLAN.md` ตั้งใจ | E2E 11 ตัวที่ยิงผ่าน Postgres จริง |
| `api/test_support.py` 51% | seed/cleanup เรียกจาก E2E ไม่ใช่จาก pytest | E2E fixture `cleanDb` |
| `migrate.py` 0% | script ที่รันมือตอน setup ไม่ใช่ code ที่ request วิ่งผ่าน | ยังไม่มี — รับไว้เป็น gap ที่ยอมรับ |

**สิ่งที่ตัวเลขนี้บอกจริง ๆ:** business logic ยังคุ้มครองแน่น (`domain/` ทั้งโฟลเดอร์ 96–100%)
ส่วนที่ลดคือ adapter layer ซึ่งย้ายภาระไปให้ E2E แล้ว — ไม่ใช่กฎธุรกิจที่หลุดการทดสอบ

## Frontend — 0.4%

```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|--------
All files          |     0.4 |        0 |       0 |    0.42
 src/lib/scale.ts  |     100 |      100 |     100 |     100
 (ที่เหลือทั้งหมด)   |       0 |        0 |       0 |       0
Statements : 0.4% ( 1/246 )
5 passed
```

```bash
cd frontend && npm run test:cov
```

**ตัวเลขนี้ต่ำโดยตั้งใจ และเป็นตัวเลขจริง**

ตอนแรกรายงานขึ้น 100% เพราะ vitest นับเฉพาะไฟล์ที่ test import เข้ามา
จึงตั้ง `coverage.all = true` ให้นับไฟล์ที่ยังไม่ถูกทดสอบด้วย
เหตุผลที่ยังไม่เขียน unit test ให้ component อยู่ใน [`frontend/TEST_PLAN.md`](../../frontend/TEST_PLAN.md)

ที่ลดจาก 0.95% เหลือ 0.4% เพราะตัวหารโตขึ้น (105 → 246 statements จากหน้า classrooms
และ `GoogleSignInButton`) ตัวเศษยังเป็น `scale.ts` ไฟล์เดิม

## E2E — 11 tests

| รันกับ | ผล | เวลา |
|---|---|---|
| local (`npm run e2e`) | **11 passed** | 26.3s |
| local `--repeat-each=3` | **33 passed** — ไม่ flaky | 52.5s |
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
