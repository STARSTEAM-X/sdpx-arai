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
| `performance` (WS-07) | k6 `load-test.js` journey เต็มใส่ API + Postgres ที่ยกใน runner · threshold แดง → exit 99 → job แดง | gate ก่อน deploy · ยิง journey ใส่ staging ของกลุ่มไม่ได้ เพราะมันรันเป็น production (เหตุผลใน `performance-report.md`) |
| `deploy-staging` | ยิง Render deploy hook แล้วรอจน `/api/health` รายงาน commit นี้ | ดู [`scripts/ci/render-deploy.sh`](../scripts/ci/render-deploy.sh) |
| `staging-smoke` (WS-07) | k6 `smoke.js` ใส่ staging จริงหลัง deploy | ยืนยันว่าของที่เพิ่งขึ้นตอบได้เร็วพอ |
| `deploy-production` | เหมือน deploy-staging แต่ผูก environment `production` ที่ต้องมีคน approve | human checkpoint ที่บังคับใช้จริง |

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

### ทำไม deploy ผ่าน hook ไม่ใช่ auto-deploy ของ Render

ก่อน WS-06 Render deploy ทุก push เข้า `develop` ทันที — **test แดงก็ขึ้น staging**
ตอนนี้ `render.yaml` ตั้ง `autoDeployTrigger: "off"` ไว้ทั้งสอง service
ทางเดียวที่ของจะขึ้นได้คือ job `deploy-staging` ซึ่งรันหลัง `e2e` เขียวแล้วเท่านั้น

hook ตอบ 200 ทันทีที่รับคิว ไม่ได้แปลว่า build สำเร็จ script จึงวน poll `/api/health`
จนได้ `version` = 7 ตัวแรกของ `GITHUB_SHA` — ตัวเลขนี้คือ **commit-to-live ที่วัดโดย pipeline เอง**

## ✋ สิ่งที่ต้องทำบนเว็บ (agent ทำแทนไม่ได้)

repo `STARSTEAM-X/sdpx-arai` เป็น repo ของบัญชีส่วนตัว — **หน้า Settings มีแค่เจ้าของ (SSX) ที่เข้าได้**
collaborator ทำได้แค่ push branch และเปิด PR

### ส่วนของคุณ (collaborator)

1. push branch แล้วเปิด PR `feature/ws06-07-supitcha → develop`
   ```bash
   git push -u origin feature/ws06-07-supitcha
   ```
   pipeline รัน lint/test/E2E/performance (job deploy ถูกข้ามบน PR) — **ลิงก์ run นี้ = Pipeline run URL ส่ง LMS**
2. **ยังไม่ merge** จนกว่า SSX ทำส่วนของเขาเสร็จ (ไม่งั้นเว็บกลุ่มหยุดอัปเดต — ดูหัวข้อถัดไป)
3. หลัง SSX ตั้ง ruleset แล้ว: push `test/break-pipeline` เปิด PR → `develop` → รอ `test-fe` แดง
   → screenshot ปุ่ม Merge ที่ถูกบล็อก → `docs/screenshots/merge-blocked.png` → **ปิด PR ไม่ merge**
   ```bash
   git push -u origin test/break-pipeline
   ```
4. ทดสอบ performance gate บน GitHub: ใน PR ของคุณ แก้ `AUTOSAVE_P95_MS: '1'` ใน env ของ step k6
   → push → job `performance` ต้องแดง (exit 99) → revert แล้ว push อีกครั้ง

### ส่วนของ SSX (เจ้าของ repo + เจ้าของ Render)

**ทำไมต้องทำก่อน merge:** branch นี้ตั้ง `autoDeployTrigger: "off"` ใน `render.yaml`
→ Render จะไม่ deploy เองอีก ต้องให้ pipeline ยิง deploy hook แทน ถ้าไม่มี hook เว็บ `paireval-web.onrender.com` หยุดอัปเดต

1. **Render** → `paireval-api` และ `paireval-web` → Settings → **Deploy Hook** → Copy (URL มี key = secret)
2. **GitHub → Settings → Environments**

   | Environment | Secrets | Variables | Protection |
   |---|---|---|---|
   | `staging` | `RENDER_DEPLOY_HOOK_API`, `RENDER_DEPLOY_HOOK_WEB` | `STAGING_WEB_URL` = `https://paireval-web.onrender.com` | Deployment branches: `develop` |
   | `production` | (ยังไม่มี service — เว้นไว้) | | ✅ **Required reviewers**: supitcha0j และ/หรือ SSX · Deployment branches: `main` |

3. **Settings → Secrets and variables → Actions → Variables (ระดับ repo):**
   `STAGING_API_URL` = `https://paireval-api.onrender.com` (ใช้ทั้ง `deploy-staging` และ `staging-smoke`)
4. **Settings → Rules → Rulesets** → target `main` และ `develop`:
   Block force pushes · Require a pull request (approvals 1) ·
   Require status checks: `lint-fe`, `test-fe`, `lint-be`, `test-be`, `integration-be`, `e2e`, `performance`
5. **Settings → Code security** → เปิด Secret scanning + Push protection

## ข้อจำกัดที่ยังเหลือ (ต้องตัดสินใจระดับกลุ่ม)

- **ยังไม่มี production แยก** — เว็บ `paireval-web.onrender.com` คือ staging ของ `develop` ที่ทุกคนใช้เป็นเว็บจริง
  job `deploy-production` จะหยุดรอ approve ได้จริง แต่หลัง approve จะแดงเพราะยังไม่มี hook ของ production (ตั้งใจ — ไม่เขียวหลอก)
  แยกจริงต้องสร้าง service + database ชุดที่สอง (Render free ให้ Postgres ฟรีได้จำกัด — ใช้ Neon free เป็น DB ของ production ได้)
- **k6 journey เต็มยังยิงใส่ staging ของกลุ่มไม่ได้** — ถ้ากลุ่มเพิ่ม staging แยกที่ตั้ง `ENVIRONMENT=staging`
  + `TEST_SUPPORT_TOKEN` code รองรับแล้ว (`/api/test/*` เปิดเฉพาะเมื่อแนบ token · seed ไม่ลบข้อมูลเดิม)

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
