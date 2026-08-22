# Coverage Report — WS-03

วัดเมื่อ 2026-08-23 · commit ที่วัด: ดู `git log` ของไฟล์นี้

## Backend — 99%

```
Name                              Stmts   Miss  Cover   Missing
---------------------------------------------------------------
app\__init__.py                       0      0   100%
app\config.py                         5      0   100%
app\domain\__init__.py                0      0   100%
app\domain\classroom_service.py      31      0   100%
app\domain\email.py                  15      0   100%
app\domain\errors.py                 23      1    96%   63
app\domain\models.py                 44      0   100%
app\domain\repositories.py            5      0   100%
app\domain\roster_import.py          61      1    98%   34
app\main.py                           8      0   100%
---------------------------------------------------------------
TOTAL                               192      2    99%
52 passed in 0.77s
```

สองบรรทัดที่เหลือเป็น gap ที่ยอมรับไว้โดยตั้งใจ — เหตุผลอยู่ใน `backend/TEST_PLAN.md`

คำสั่งที่ใช้:

```bash
cd backend && ./.venv/Scripts/python.exe -m pytest --cov=app --cov-report=term-missing
```

## Frontend — 0.95%

```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|--------
All files          |    0.95 |        0 |       0 |    0.98
 src/lib/scale.ts  |     100 |      100 |     100 |     100
 (ที่เหลือทั้งหมด)   |       0 |        0 |       0 |       0
Statements : 0.95% ( 1/105 )
5 passed in 0.18s
```

**ตัวเลขนี้ต่ำโดยตั้งใจ และเป็นตัวเลขจริง**

ตอนแรกรายงานขึ้น 100% เพราะ vitest นับเฉพาะไฟล์ที่ test import เข้ามา
จึงตั้ง `coverage.all = true` ให้นับไฟล์ที่ยังไม่ถูกทดสอบด้วย
เหตุผลที่ยังไม่เขียน unit test ให้ component อยู่ใน `frontend/TEST_PLAN.md`

คำสั่งที่ใช้:

```bash
cd frontend && npm run test:cov
```

## E2E — 6 tests

| รันกับ | ผล | เวลา |
|---|---|---|
| local dev server | 6 passed | 19.2s |
| staging `paireval-web.onrender.com` | 6 passed | 8.3s |

```bash
npm run e2e                                              # local
BASE_URL=https://paireval-web.onrender.com npm run e2e   # staging
```

---

## ข้อควรระวังเรื่องตัวเลขพวกนี้

coverage บอกแค่ว่า **test เดินผ่าน code กี่บรรทัด** ไม่ได้บอกว่า
test จะจับได้ไหมถ้า logic ผิด — เป็นไปได้ที่จะมี coverage 100%
โดยที่ทุก test เขียวตลอดไม่ว่า business rule จะถูกลบไปกี่ข้อ

ตัวเลขที่ตอบคำถามนั้นคือ **ผล fidelity check** ใน `backend/TEST_PLAN.md`
และ `frontend/TEST_PLAN.md` ซึ่งพิสูจน์ด้วยการทำให้พังจริงแล้วดูว่า test แดงไหม
