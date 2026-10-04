# CI/CD — วิธีทำงานและสิ่งที่ต้องตั้งบน GitHub / Render (WS-06)

pipeline อยู่ที่ [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) · ตัวเลขก่อน/หลังอยู่ที่ [`loop-metrics.md`](loop-metrics.md)

## Pipeline

```
lint-fe ─┐
test-fe ─┤                                 (push develop)
lint-be ─┼─► e2e ─► performance ─┬─► deploy-staging ─► staging-smoke
test-be ─┤                       └─► deploy-production   (push main · ต้องมีคน approve)
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
| `performance` (WS-07) | k6 `load-test.js` ใส่ API + Postgres ที่ยกใน runner · threshold แดง → exit 99 → job แดง | gate ก่อน deploy · เหตุผลที่ไม่ยิง staging อยู่ใน `performance-report.md` |
| `deploy-staging` | ยิง Render deploy hook แล้วรอจน `/api/health` รายงาน commit นี้ | ดู [`scripts/ci/render-deploy.sh`](../scripts/ci/render-deploy.sh) |
| `deploy-production` | เหมือนกัน แต่ผูก environment `production` ที่ต้องมีคน approve | human checkpoint ที่บังคับใช้จริง |
| `staging-smoke` (WS-07) | k6 `smoke.js` ใส่ staging จริงหลัง deploy | ยืนยันว่าของที่เพิ่งขึ้นตอบได้เร็วพอ |

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

## ✋ สิ่งที่ต้องตั้งบนเว็บเอง (agent ทำแทนไม่ได้ — ต้องใช้สิทธิ์ admin ของ repo/Render)

### 1. Render — เอา deploy hook

Render Dashboard → `paireval-api` → Settings → **Deploy Hook** → Copy
ทำซ้ำกับ `paireval-web` · URL มี key ฝังอยู่ **ถือเป็น secret ห้ามแปะในแชตหรือ commit**

### 2. GitHub Environments

Settings → Environments → New environment

| Environment | Secrets | Variables | Protection |
|---|---|---|---|
| `staging` | `RENDER_DEPLOY_HOOK_API`, `RENDER_DEPLOY_HOOK_WEB` | `STAGING_API_URL` = `https://paireval-api.onrender.com` (ตั้งเป็น **repository variable** ด้วย เพราะ job `staging-smoke` ไม่ได้ผูก environment)<br>`STAGING_WEB_URL` = `https://paireval-web.onrender.com` | Deployment branches: `develop` |
| `production` | `RENDER_DEPLOY_HOOK_API`, `RENDER_DEPLOY_HOOK_WEB` (ของ service production) | `PRODUCTION_API_URL`, `PRODUCTION_WEB_URL` | ✅ **Required reviewers** (สมาชิกกลุ่ม) · Deployment branches: `main` |

ใส่ secret ที่ระดับ **environment** ไม่ใช่ระดับ repo — job ที่ไม่ได้ประกาศ `environment:`
(เช่น job ของ pull request) จึงอ่านค่า hook ไม่ได้เลย
ค่าที่ไม่ลับ (URL) ใส่ใน **Variables** เพื่อให้เห็นใน log ตอน debug

> production ยังไม่มี service จริงบน Render — ดูหัวข้อ "ข้อจำกัด" ด้านล่าง

### 3. Branch protection (Ruleset)

Settings → Rules → Rulesets → New branch ruleset → Target: `main` (ทำซ้ำกับ `develop` ได้)

- ✅ Restrict deletions · ✅ **Block force pushes**
- ✅ **Require a pull request before merging** — Required approvals: 1
- ✅ **Require status checks to pass** + Require branches to be up to date
  เพิ่ม check: `lint-fe`, `test-fe`, `lint-be`, `test-be`, `integration-be`, `e2e`, `performance`
  (ชื่อจะขึ้นให้เลือกได้หลัง pipeline รันอย่างน้อย 1 ครั้ง)

### 4. Secret scanning

Settings → Code security → เปิด **Secret scanning** และ **Push protection**

### 5. พิสูจน์ว่า protection บล็อก merge ได้จริง

branch `test/break-pipeline` เตรียมไว้แล้ว (commit `test: intentionally break a test`)
แก้ `frontend/src/lib/assignment.test.ts` บรรทัด 32 ให้แดง — พิสูจน์บนเครื่องแล้วว่า exit code = 1

```bash
git push -u origin test/break-pipeline
```

เปิด PR `test/break-pipeline → main` → รอ `test-fe` แดง → screenshot หน้าที่ปุ่ม Merge ถูกบล็อก
เก็บที่ `docs/screenshots/merge-blocked.png` → **ปิด PR ทิ้ง ไม่ merge** แล้วลบ branch

## ข้อจำกัดที่ยังเหลือ

- **production ยังไม่มี service + database แยก** — Render free plan ให้ Postgres ฟรีได้ 1 ตัวต่อ workspace
  ซึ่ง staging ใช้อยู่ การแยก production จริงต้องใช้ plan เสียเงินหรือ workspace ที่สอง
  ตอนนี้ job `deploy-production` จึงจะ **แดงพร้อมข้อความบอกว่ายังไม่ได้ตั้ง secret** เมื่อมี push เข้า `main`
  ซึ่งตั้งใจ — ดีกว่าเขียวหลอกว่า deploy แล้ว
- ก่อนตั้ง secret ใน environment `staging` job `deploy-staging` จะแดงด้วยเหตุผลเดียวกัน
  และเพราะ auto-deploy ปิดแล้ว staging จะค้างที่ commit เดิมจนกว่าจะตั้ง hook

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
