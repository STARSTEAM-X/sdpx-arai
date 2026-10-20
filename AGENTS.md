# AGENTS.md

คู่มือการทำงานสำหรับ AI agent และผู้พัฒนาใน repository นี้ — อ่านให้จบก่อนเริ่มงานทุกครั้ง
ทุกคำสั่งในไฟล์นี้ต้องรันได้จริง ถ้าคำสั่งใดรันไม่ได้ ให้ถือเป็น bug ของเอกสารและแก้ทันที

---

## 1. ภาพรวมโปรเจกต์

**PairEval** — ระบบประเมินผลงานนักศึกษาแบบ pairwise comparison
ผู้ประเมินเทียบผลงานครั้งละ 2 ชิ้นด้วยมาตรวัด 6 ระดับ แล้วระบบคำนวณคะแนนจากผลเปรียบเทียบทั้งหมด
เพื่อลด absolute scoring bias และปัญหา free-rider ในการให้คะแนนงานกลุ่ม

| หัวข้อ | ที่อยู่ |
|---|---|
| Product requirements (PRD) | `Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md` |
| ข้อกำหนด Workshop WS-01 – WS-08 | `Sources/SDPX-AI-main/` |
| สถานะ loop และตัวเลขที่วัดได้ | `docs/loop-metrics.md` |
| ผล performance ล่าสุด | `docs/performance-report.md` |
| ผล security / code quality (WS-08) | `docs/ws08-submission.md` |
| สถาปัตยกรรมและการตัดสินใจ | `docs/architecture.md`, `docs/adr/` |

## 2. โครงสร้าง Repository

ประกาศ path ไว้ที่นี่ที่เดียว เอกสารอื่นให้อ้างอิงจากตารางนี้

| ส่วน | Path | หมายเหตุ |
|---|---|---|
| Frontend | `frontend/` | React + Vite + TypeScript |
| Backend | `backend/` | FastAPI + PostgreSQL |
| E2E tests | `e2e/` | Playwright (config อยู่ที่ `playwright.config.ts`) |
| Performance tests | `performance/` | k6 scripts และผลวัดย้อนหลัง |
| CI/CD scripts | `scripts/`, `.github/workflows/` | |
| เอกสาร | `docs/` | รวม OpenAPI, ADR, รายงานแต่ละ workshop |
| Context สำหรับ AI | `memory-bank/` | intent, tech stack, unit briefs |
| เอกสารประกอบวิชา | `Sources/` | **อ่านอย่างเดียว ห้ามแก้ไข** |

## 3. การติดตั้งและคำสั่ง

### 3.1 Docker (แนะนำ)

ไม่ต้องติดตั้ง Node, Python หรือ Postgres บนเครื่อง รันทุกคำสั่งจาก root ของ repo

```bash
# Development — web :5173 · api :8000 · db :5433
docker compose up

# Unit tests
docker compose -f compose.test.yaml up unit-api --abort-on-container-exit --exit-code-from unit-api
docker compose -f compose.test.yaml up unit-web --abort-on-container-exit --exit-code-from unit-web

# Integration tests (ยก Postgres แบบ ephemeral ให้เอง)
docker compose -f compose.test.yaml up integration-api --abort-on-container-exit --exit-code-from integration-api

# End-to-end tests (db + api + web + Playwright)
docker compose -f compose.test.yaml --profile e2e up e2e --abort-on-container-exit --exit-code-from e2e

# Teardown — ใช้ -v เพื่อไม่ให้ข้อมูลรอบก่อนค้างไปรอบถัดไป
docker compose -f compose.test.yaml --profile e2e down -v
docker compose down
```

> **ต้องใส่ `--exit-code-from <service>` ทุกครั้ง** — ถ้าไม่ใส่ compose จะคืน exit code 0 แม้ test ล้มเหลว
> ทำให้ CI ผ่านแบบหลอก ๆ คำสั่งชุดนี้เป็นชุดเดียวกับที่ CI ใช้ ผลบนเครื่องจึงตรงกับผลบน CI

ถ้าพอร์ตชนกับโปรแกรมอื่น ให้ override ด้วย `WEB_PORT`, `API_PORT`, `DB_PORT`
เช่น `WEB_PORT=5174 CORS_ORIGINS=http://localhost:5174 docker compose up`

### 3.2 Frontend (`frontend/`)

```bash
npm ci                 # ติดตั้ง dependency ตาม lockfile
npm run dev            # dev server ที่ http://localhost:5173
npm run build          # production build ไปที่ dist/
npm run typecheck      # tsc --noEmit
npm run lint           # oxlint — กฎอยู่ใน .oxlintrc.json
npm test               # vitest run
npm run test:watch     # vitest watch mode
npm run test:cov       # coverage ไปที่ docs/coverage/frontend/
```

### 3.3 Backend (`backend/`)

```bash
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt     # Windows
# macOS / Linux: source .venv/bin/activate && pip install -r requirements-dev.txt

./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
# ตรวจสุขภาพ: http://localhost:8000/api/health → {"status":"ok",...}

./.venv/Scripts/python.exe -m pytest                  # unit + api (ไม่ต้องมี DB)
./.venv/Scripts/python.exe -m pytest -m integration   # ต้องมี Postgres: docker compose up -d db
./.venv/Scripts/python.exe -m pytest -m ""            # ทั้งหมด
./.venv/Scripts/python.exe -m pytest --cov --cov-report=html   # coverage ไปที่ docs/coverage/backend/
./.venv/Scripts/python.exe -m ruff check .            # lint — กฎอยู่ใน ruff.toml
```

`production` ใช้แค่ `requirements.txt` · ค่า coverage ตั้งไว้ใน `backend/.coveragerc` แล้ว

### 3.4 Database และ E2E (รันจาก root)

```bash
docker compose up -d db                                     # Postgres สำหรับ dev / E2E
cd backend && ./.venv/Scripts/python.exe -m app.migrate     # migration — รันซ้ำได้

npm run e2e                           # E2E ทั้งชุด (ยก API + frontend ให้เอง)
npx playwright test --repeat-each=3   # ตรวจ flaky test ก่อน push
npm run e2e:report                    # เปิด HTML report
```

### 3.5 API contract

```bash
npm run lint:api   # redocly lint docs/openapi.yaml — ต้องไม่มีทั้ง error และ warning
```

กฎที่ปิดไว้อยู่ใน `redocly.yaml` — **ห้ามปิดกฎเพิ่มโดยไม่เขียนเหตุผลกำกับ**

### 3.6 Performance (WS-07)

```bash
# Smoke test บน staging (ยิงเฉพาะ /api/health)
docker run --rm -i -e BASE_URL=https://paireval-api.onrender.com grafana/k6:2.3.0 run - < performance/smoke.js

# Load test เต็ม journey — ต้องเตรียม private fixture จาก staging credentials ของเจ้าของบัญชีก่อน
cd backend && python -m app.perf_fixture --base-url "$STAGING_API_URL" --domain "$PERF_EMAIL_DOMAIN"
cd .. && BASE_URL="$STAGING_API_URL" k6 run --summary-export=performance/staging-baseline.json performance/load-test.js
```

exit code `99` หมายถึง threshold ไม่ผ่าน · **ห้าม commit หรือ upload `performance/.secrets/`**

## 4. CI/CD (WS-06)

- `.github/workflows/ci.yml` รัน `lint-api`, `lint-fe`, `test-fe`, `lint-be`, `test-be`, `integration-be` แบบขนาน แล้วจึงรัน `e2e`
- **push `develop`** → deploy API และเว็บที่ SHA เดียวกันไป staging แล้วรัน smoke / load test
- **push `main`** → deploy production ผ่าน GitHub environment ที่ต้องมีผู้อนุมัติ
- Render ตั้ง Auto-Deploy = Off และ Blueprint Auto Sync = No — การ deploy ทั้งหมดสั่งจาก CI
- คำสั่ง reproduce แต่ละ job และการตั้งค่าที่ต้องทำบน GitHub: `docs/cicd.md`

**รัน lint และ unit test ของทั้งสองฝั่งให้ผ่านบนเครื่องก่อน push — ห้าม debug ด้วยการ push ซ้ำ ๆ**

## 5. ความปลอดภัยและการตั้งค่า

- **`ENVIRONMENT=production` บังคับสำหรับทุก service ที่เข้าถึงได้จาก internet**
  ถ้าไม่ใช่ `production` endpoint `POST /api/test/seed|cleanup|session` จะเปิดใช้งาน
  ซึ่งทำให้ใครก็ล้างฐานข้อมูลหรือปลอมตัวเป็นผู้ใช้ใดก็ได้
- **`SESSION_SECRET` ต้องยาวอย่างน้อย 32 bytes** (RFC 7518 §3.2) มิฉะนั้น app จะไม่เริ่มทำงาน
  และ production จะปฏิเสธ development key เสมอ สร้างค่าใหม่ด้วย:

  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(48))"
  ```

- **Config อ่านจาก environment variable เท่านั้น** — ห้าม hardcode URL, port หรือ credential
- Environment variable จากภายนอก **มีลำดับเหนือกว่า** `backend/.env` เสมอ
  (บน Render ค่ามาจาก `render.yaml`; `.env` ใช้เฉพาะบนเครื่องตัวเอง)
- **CORS** ระบุ origin ทีละรายการใน `CORS_ORIGINS` — ห้ามใช้ `*`
- ตัวแปร **`VITE_*` เป็น build-time** — เปลี่ยนค่าแล้วต้อง build ใหม่ ไม่ใช่แค่ restart

## 6. Logging

- Log ของ backend เป็น JSON หนึ่งบรรทัดต่อหนึ่ง event (`backend/app/observability.py`)
- เพิ่ม log ด้วย `log_event(log, "snake_case_event", field=...)` — ห้ามใช้ `print` หรือ f-string
- **ห้าม log อีเมล, token หรือ password ตรง ๆ** — อ้างถึงผู้ใช้ด้วย `user_ref(email)`
- Formatter มีการ redact เป็นชั้นป้องกันสุดท้าย ไม่ใช่ข้ออนุญาตให้ log ข้อมูลอ่อนไหว

## 7. Conventions

| หัวข้อ | ข้อกำหนด |
|---|---|
| Commit message | [Conventional Commits](https://www.conventionalcommits.org/) — `feat:` `fix:` `docs:` `chore:` `refactor:` `test:` |
| Branch | `main` = production · `develop` = staging · งานใหม่แตก branch จาก `develop` |
| ภาษา UI | ภาษาไทย (NFR-I18N-01 ใน PRD) |
| Tech stack | ตาม `memory-bank/standards/tech-stack.md` — เปลี่ยนได้เมื่อมี ADR เท่านั้น |

### Test loop

- Unit test ของทั้งสองฝั่ง **ต้องรันได้โดยไม่ต้องมีฐานข้อมูล** และควรเร็วพอให้รันทุกครั้งที่แก้โค้ด
  (เป้าหมาย: รวมกันไม่เกิน 10 วินาที) ถ้าช้าเกินให้ถือเป็นปัญหาที่ต้องแก้
- Integration test แยกออกจาก unit loop โดยตั้งใจเพราะต้องใช้ Postgres — เหตุผลอยู่ใน `backend/pytest.ini`

## 8. กฎสำหรับ Agent

1. **ห้ามแก้ test เพื่อให้ผ่าน** — test ล้มเหลวให้แก้โค้ด จะแก้ test ได้เมื่อ requirement เปลี่ยนจริงและต้องระบุเหตุผล
2. **ห้าม commit `.env` หรือ secret ใด ๆ** — ใส่เฉพาะชื่อ key ใน `.env.example`
   หาก commit secret ไปแล้วให้ revoke ทันที การลบ commit ไม่เพียงพอ
3. **ห้ามส่ง secret เข้าเครื่องมือ AI** ไม่ว่ากรณีใด
4. **ทุกบรรทัดที่ commit ต้องอธิบายได้** — โค้ดที่ไม่มีใครเข้าใจให้ลบหรือศึกษาจนเข้าใจก่อน
5. **ห้ามเพิ่ม dependency โดยไม่แจ้ง** — ระบุว่าจะเพิ่มอะไรและเพราะอะไรก่อนเสมอ
6. **ห้ามเปลี่ยน tech stack โดยไม่เขียน ADR** (`docs/adr/`)
7. **แก้ทีละส่วนแล้วตรวจทันที** — ไม่แก้ยาวหลายร้อยบรรทัดแล้วค่อยรัน
8. **Verify ก่อนรายงานว่าเสร็จ** — ต้องรันคำสั่งจริงและเห็นผลจริง ห้ามคาดเดาว่าน่าจะผ่าน
