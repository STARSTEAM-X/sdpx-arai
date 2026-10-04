# CI/CD — วิธีทำงานและสิ่งที่ต้องตั้งบน GitHub / Render (WS-06)

pipeline อยู่ที่ [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) · ตัวเลขก่อน/หลังอยู่ที่ [`loop-metrics.md`](loop-metrics.md)

## Pipeline

```
lint-fe ─┐
test-fe ─┤
lint-be ─┼─► e2e ─┬─► deploy-staging ─► performance   (push develop)
test-be ─┤        └─► deploy-production                (push main · ต้องมีคน approve)
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
| `deploy-staging` | ยิง Render deploy hook แล้วรอจน `/api/health` รายงาน commit นี้ | ดู [`scripts/ci/render-deploy.sh`](../scripts/ci/render-deploy.sh) |
| `performance` (WS-07) | k6 `smoke.js` + `load-test.js` ยิงใส่ staging ที่เพิ่ง deploy · threshold แดง → exit 99 → job แดง | ตาม lab: วัดบนระบบจริงหลัง deploy · ผลนี้คือด่านก่อนเปิด PR `develop → main` |
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

## ✋ ตั้งค่า fork `supitcha0j/sdpx-arai` ให้ผ่านเกณฑ์ WS-06/07 (ทำบนเว็บเอง — agent ทำแทนไม่ได้)

แยกจากของกลุ่มทั้งหมด: repo ของตัวเอง + Render ของตัวเอง ตามไฟล์ [`render.supitcha.yaml`](../render.supitcha.yaml)
**ไม่แตะ `paireval-web.onrender.com` ของกลุ่มเลย**

| | staging | production |
|---|---|---|
| branch | `develop` | `main` |
| service | `paireval-sp-web-staging`, `paireval-sp-api-staging` | `paireval-sp-web`, `paireval-sp-api` |
| database | `paireval-sp-db-staging` (Render free) | Neon free (แยกจริง คนละที่กับ staging) |
| `ENVIRONMENT` | `staging` (เปิด `/api/test/*` ด้วย token) | `production` (ปิดสนิท) |

### ขั้น 1 — push branch ขึ้น fork และเปิด PR แรก

```bash
git push origin develop
git push -u origin feature/ws06-07-supitcha
```

เปิด PR `feature/ws06-07-supitcha → develop` บน fork → pipeline รัน lint/test/E2E (job deploy ถูกข้ามบน PR)
**ลิงก์ของ run นี้คือ "Pipeline run URL" ที่ใช้ส่ง LMS ได้** · ยังไม่ต้อง merge

### ขั้น 2 — Neon (database ของ production)

[neon.tech](https://neon.tech) → New project → region **AWS Asia Pacific (Singapore)** → คัดลอก connection string แบบ **pooled**
(ต้องลงท้าย `?sslmode=require`) — เป็น secret ห้ามแปะในแชตหรือ commit

### ขั้น 3 — Render Blueprint

Render → New → **Blueprint** → เลือก repo `supitcha0j/sdpx-arai` → branch **`feature/ws06-07-supitcha`** (ตอนนี้ไฟล์อยู่ที่นี่เท่านั้น)
→ **Blueprint Path: `render.supitcha.yaml`** → Render จะถามค่าที่ตั้ง `sync: false`:

| service | key | ค่า |
|---|---|---|
| `paireval-sp-web-staging` | `VITE_API_BASE_URL` | `https://paireval-sp-api-staging.onrender.com` |
| `paireval-sp-api-staging` | `CORS_ORIGINS` | `https://paireval-sp-web-staging.onrender.com` |
| `paireval-sp-web` | `VITE_API_BASE_URL` | `https://paireval-sp-api.onrender.com` |
| `paireval-sp-api` | `CORS_ORIGINS` | `https://paireval-sp-web.onrender.com` |
| `paireval-sp-api` | `DATABASE_URL` | connection string ของ Neon จากขั้น 2 |

> ถ้าชื่อ subdomain ถูกใช้ไปแล้ว Render จะต่อท้ายให้ (เช่น `-abcd`) — ดู URL จริงในหน้า service แล้วแก้ค่าให้ตรง
> service ฝั่ง production อาจ deploy ครั้งแรกไม่ผ่านเพราะ `main` ยังเป็นแค่ Initial commit — ปกติ จะหายหลังขั้น 6
> หลัง merge PR แล้ว เปลี่ยน branch ของ Blueprint เป็น `develop` (Blueprint → Settings)

### ขั้น 4 — GitHub Environments + Secrets (Settings → Environments)

| Environment | Secrets | Variables | Protection |
|---|---|---|---|
| `staging` | `RENDER_DEPLOY_HOOK_API` ← Deploy Hook ของ `paireval-sp-api-staging`<br>`RENDER_DEPLOY_HOOK_WEB` ← Deploy Hook ของ `paireval-sp-web-staging`<br>`TEST_SUPPORT_TOKEN` ← ค่าใน Environment ของ `paireval-sp-api-staging` (Render สุ่มให้) | `STAGING_API_URL`, `STAGING_WEB_URL` (URL จริงจากขั้น 3) | Deployment branches: `develop` |
| `production` | `RENDER_DEPLOY_HOOK_API` ← ของ `paireval-sp-api`<br>`RENDER_DEPLOY_HOOK_WEB` ← ของ `paireval-sp-web` | `PRODUCTION_API_URL`, `PRODUCTION_WEB_URL` | ✅ **Required reviewers** (ใส่ตัวเอง และ**ปิด** "Prevent self-review" ถ้าทำคนเดียว) · Deployment branches: `main` |

Deploy Hook อยู่ที่ Render → service → Settings → **Deploy Hook** · URL มี key ฝังอยู่ = secret
ใส่ secret ที่ระดับ **environment** ไม่ใช่ repo — job ที่ไม่ได้ประกาศ `environment:` (เช่น PR) อ่านค่าไม่ได้

### ขั้น 5 — Branch protection + secret scanning

Settings → Rules → Rulesets → New branch ruleset → Target: `main` และ `develop`

- ✅ Restrict deletions · ✅ **Block force pushes**
- ✅ **Require a pull request before merging** (ทำคนเดียว: Required approvals = 0 · ทำกับกลุ่ม: 1)
- ✅ **Require status checks to pass** + Require branches to be up to date →
  `lint-fe`, `test-fe`, `lint-be`, `test-be`, `integration-be`, `e2e`

Settings → Code security → เปิด **Secret scanning** + **Push protection**

### ขั้น 6 — merge แล้วดู deploy + performance เขียว

1. merge PR ขั้น 1 เข้า `develop` → pipeline: ... → `deploy-staging` → `performance` (k6 ยิง staging จริง)
2. เปิด PR `develop → main` → merge → `deploy-production` **หยุดรอ approve** → กด Review deployments → Approve
   (screenshot หน้ารอ approve เก็บไว้ด้วย)

### ขั้น 7 — พิสูจน์ว่า protection บล็อก merge ได้จริง

```bash
git push -u origin test/break-pipeline
```

เปิด PR `test/break-pipeline → develop` → รอ `test-fe` แดง → screenshot ที่ปุ่ม Merge ถูกบล็อก
→ `docs/screenshots/merge-blocked.png` → **ปิด PR ไม่ merge**

### ขั้น 8 — ทดสอบ performance gate บน GitHub

แก้ `AUTOSAVE_P95_MS: '1'` ใน env ของ step k6 load test (ไฟล์ `ci.yml`) → push เข้า `develop` ผ่าน PR
→ job `performance` ต้องแดง (exit 99) → revert

## รวมกลับเข้า repo ของกลุ่ม (`STARSTEAM-X/sdpx-arai`)

ทุกอย่างใน branch นี้ใช้กับ repo กลุ่มได้ **ยกเว้น `render.supitcha.yaml`** (ชื่อ service ของ fork)
— URL / hook / token ทั้งหมดอ่านจาก GitHub Variables/Secrets ไม่มีค่าของ fork ฝังใน code

```bash
git push upstream feature/ws06-07-supitcha   # ต้องมีสิทธิ์ push · ไม่มีก็เปิด PR จาก fork ข้าม repo ได้
```

เปิด PR → `STARSTEAM-X/sdpx-arai:develop` แล้วลบ `render.supitcha.yaml` ออกใน PR นั้น
**ก่อนกลุ่ม merge ต้องตกลงกันเรื่องนี้:** `render.yaml` ของกลุ่มจะปิด auto-deploy
→ เจ้าของ Render ของกลุ่มต้องใส่ deploy hook ใน environment `staging` ของ repo กลุ่มก่อน ไม่งั้นเว็บกลุ่มหยุดอัปเดต

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
