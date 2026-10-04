# CI/CD — วิธีทำงานและสิ่งที่ต้องตั้งบน GitHub / Render (WS-06)

pipeline อยู่ที่ [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) · ตัวเลขก่อน/หลังอยู่ที่ [`loop-metrics.md`](loop-metrics.md)

## Pipeline

```
lint-fe ─┐
test-fe ─┤
lint-be ─┼─► e2e ─► performance ─┬─► deploy-staging ─► staging-smoke   (push develop)
test-be ─┤                       └─► deploy-production                 (push main · ต้องมีคน approve)
integ-be ┘
```

| Job | ทำอะไร | ทำไมแยก |
|---|---|---|
| `lint-fe` | `oxlint` + `tsc --noEmit` | ไม่ต้องรอ test ก็รู้ว่า code ผิดรูป |
| `test-fe` | vitest + coverage + JUnit · `vite build` | build ใช้ `node_modules` ชุดเดียวกับ test จึงรวม job ไว้ ประหยัด `npm ci` หนึ่งรอบ |
| `lint-be` | `ruff check` | ลงแค่ ruff ตัวเดียว ไม่ต้องลง dependency ของ app |
| `test-be` | pytest (unit + api) + coverage + JUnit | ไม่ต้องมี DB · ตัด integration ออกด้วย `pytest.ini` |
| `integration-be` | `pytest -m integration` กับ Postgres service | ช้ากว่าเพราะต้องยก DB — แยกไว้ไม่ให้ถ่วง unit |
| `e2e` | Playwright 118 tests กับ Postgres + API + หน้าเว็บจริง | แพงที่สุด รันเมื่อ 5 job แรกเขียวครบเท่านั้น |
| `performance` (WS-07) | k6 `load-test.js` journey เต็มใส่ API + Postgres ที่ยกใน runner · threshold แดง → exit 99 → job แดง | gate ก่อน deploy · staging ของกลุ่มรันเป็น production จึงยิง journey ที่ต้อง login ใส่ไม่ได้ |
| `deploy-staging` | **ไม่สั่ง deploy เอง** — รอจน `/api/health` ของเว็บกลุ่มรายงาน commit นี้ แล้วรายงาน lead time | Render ของกลุ่ม deploy จาก `develop` เองอยู่แล้ว · ไม่แตะการตั้งค่าเว็บ ไม่ต้องใช้ secret ([`verify-staging.sh`](../scripts/ci/verify-staging.sh)) |
| `staging-smoke` (WS-07) | k6 `smoke.js` ใส่ staging จริงหลัง deploy | ยืนยันว่าของที่เพิ่งขึ้นตอบได้เร็วพอ |
| `deploy-production` | ผูก environment `production` — หยุดรอคน approve ก่อน แล้วยิง deploy hook | human checkpoint · กลุ่มยังไม่มี production (ดูข้อจำกัด) |

### หลักที่ใช้ในไฟล์ workflow

- **`permissions: contents: read`** ระดับ workflow — `GITHUB_TOKEN` อ่าน code ได้อย่างเดียว
  job ที่สร้าง test summary ขอ `checks: write` เพิ่มเป็นราย job เท่านั้น
- **`concurrency` + `cancel-in-progress`** — push ซ้อนบน branch เดียว รอบเก่าถูกยกเลิก
  ไม่เปลือง runner และไม่มี deploy 2 รอบแข่งกันขึ้น staging
- **cache** — npm (`setup-node`), pip (`setup-python`), browser ของ Playwright (`actions/cache`)
- **action pin ด้วย commit SHA** — tag ย้ายได้ SHA ย้ายไม่ได้ · comment ท้ายบรรทัดบอกเวอร์ชัน
- **ไม่มี secret ในไฟล์** — credential เดียวที่เห็นคือ `testuser/testpass` ของ Postgres ที่ตายพร้อม job
  และไม่มี step ไหน echo ค่า secret (script deploy ไม่พิมพ์ URL ของ hook ออก log)
- **`npm ci` ไม่ใช่ `npm install`** — ติดตั้งตาม lockfile เป๊ะ และ fail ถ้า lockfile ไม่ตรง `package.json`

### ทำไม deploy-staging แค่ "ยืนยัน" ไม่ได้ "สั่ง" deploy

เว็บของกลุ่ม (`paireval-web.onrender.com`) ตั้งให้ Render deploy เองทุก push เข้า `develop` และกลุ่มตกลงว่า**ไม่เปลี่ยน**
job นี้จึงไม่แตะ Render เลย แต่รอจน API รัน commit นี้จริง — "push แล้ว" ไม่ได้แปลว่า "ขึ้นแล้ว"
(ถ้า push นั้นไม่แก้ไฟล์ที่ runtime ใช้ เช่นแก้แค่ docs/ Render จะไม่ build ใหม่ — script ตรวจกรณีนี้ให้)

ทดสอบกับเว็บจริงแล้ว: `develop` (`15449ab` แก้แค่ Dockerfile) → ผ่านทันที · branch นี้ (แก้ `backend/app` แต่ยังไม่ขึ้น) → หมดเวลา exit 1

ข้อแลกเปลี่ยน: Render ยัง deploy ก่อน CI จะเขียว (test แดงก็ขึ้น staging) — แก้ได้ด้วย `autoDeployTrigger: checksPass`
ใน `render.yaml` แต่เป็นการเปลี่ยนการตั้งค่าเว็บของกลุ่ม จึงเก็บไว้เป็นข้อเสนอ

## ✋ สิ่งที่ต้องทำบนเว็บ (agent ทำแทนไม่ได้)

### คุณ (collaborator) — push + PR + screenshot

```bash
git push -u origin feature/ws06-07-supitcha
git push -u origin test/break-pipeline
```

1. เปิด PR `feature/ws06-07-supitcha → develop` → pipeline รัน → **ลิงก์ run = Pipeline run URL ส่ง LMS**
2. เปิด PR `test/break-pipeline → develop` → `test-fe` แดง → screenshot ปุ่ม Merge ที่ถูกบล็อก
   → `docs/screenshots/merge-blocked.png` → ปิด PR ไม่ merge
3. ทดสอบ performance gate: ใน PR ข้อ 1 แก้ `AUTOSAVE_P95_MS: '1'` ใน env ของ step k6 → push → `performance` แดง → revert
4. merge PR ข้อ 1 → ดู `deploy-staging` + `staging-smoke` เขียว

### SSX (เจ้าของ repo) — ตั้งค่า GitHub 3 อย่าง **ไม่แตะเว็บ ไม่แตะ Render**

1. **Settings → Rules → Rulesets** → New branch ruleset → target `develop` และ `main`:
   Block force pushes · Require a pull request (approvals 1) ·
   Require status checks: `lint-fe`, `test-fe`, `lint-be`, `test-be`, `integration-be`, `e2e`, `performance`
2. **Settings → Environments** → New environment `production` → ✅ **Required reviewers** (supitcha0j และ/หรือ SSX)
3. **Settings → Code security** → เปิด Secret scanning + Push protection

## ข้อจำกัดที่ยังเหลือ (เพราะกลุ่มไม่เปลี่ยนเว็บ)

- **ยังไม่มี production แยกจาก staging** — `deploy-production` หยุดรอ approve ได้จริง (พิสูจน์ human checkpoint)
  แต่หลัง approve จะแดงเพราะไม่มี deploy hook ของ production ให้ยิง — ตั้งใจ ไม่เขียวหลอกว่า deploy แล้ว
- **k6 journey เต็มยิงใส่ staging ไม่ได้** — ยิงได้แค่ `smoke.js` (มี think time ผ่านเกณฑ์ตามตัวอักษร)
  journey เต็มรันใน runner + บนเครื่องที่จำกัด CPU เท่า Render free · code รองรับ staging แยกแล้วถ้าวันหนึ่งกลุ่มเพิ่ม
  (`ENVIRONMENT=staging` + `TEST_SUPPORT_TOKEN`)

## Debug เมื่อ pipeline แดง

1. คลิก job ที่แดง → step ที่แดง → อ่านหา **error แรก** ไม่ใช่บรรทัดสุดท้าย
2. reproduce บนเครื่องด้วยคำสั่งเดียวกับ job นั้น:

| Job | คำสั่งบนเครื่อง |
|---|---|
| `lint-fe` | `cd frontend && npm run lint && npm run typecheck` |
| `test-fe` | `docker compose -f compose.test.yaml up unit-web --abort-on-container-exit --exit-code-from unit-web` |
| `lint-be` | `cd backend && ./.venv/Scripts/python.exe -m ruff check .` |
| `test-be` | `docker compose -f compose.test.yaml up unit-api --abort-on-container-exit --exit-code-from unit-api` |
| `integration-be` | `docker compose -f compose.test.yaml up integration-api --abort-on-container-exit --exit-code-from integration-api` |
| `e2e` | `docker compose -f compose.test.yaml --profile e2e up e2e --abort-on-container-exit --exit-code-from e2e` |

3. เขียวบนเครื่องแล้วค่อย push — **ห้าม debug ด้วยการ push ซ้ำ ๆ**
