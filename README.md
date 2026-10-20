<div align="center">

# PairEval

**ระบบประเมินผลงานนักศึกษาแบบ Pairwise Comparison**

[![CI](https://github.com/STARSTEAM-X/sdpx-arai/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/STARSTEAM-X/sdpx-arai/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Vite-3178C6?logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.12-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=white)

[Staging](https://paireval-web.onrender.com) · [Production](https://paireval-web-production.onrender.com) · [API Spec](docs/openapi.yaml) · [Architecture](docs/architecture.md)

</div>

---

## ภาพรวม

ผู้ประเมินเทียบผลงานครั้งละ 2 ชิ้นด้วยมาตรวัด 6 ระดับ แล้วระบบคำนวณคะแนนจากผลเปรียบเทียบทั้งหมด
เพื่อลด **absolute scoring bias** และปัญหา **free-rider** ในการให้คะแนนงานกลุ่ม

**ความสามารถหลัก**

- เข้าสู่ระบบด้วย Google (OpenID Connect) และแยกบทบาทผู้สอน, ผู้ร่วมสอน, TA และนักศึกษา
- สร้างห้องเรียนและนำเข้ารายชื่อจาก CSV โดยแสดง diff ให้ตรวจก่อนนำเข้า
- สร้างงานประเมิน ตรวจ feasibility และจัดคู่เปรียบเทียบอัตโนมัติเมื่อเผยแพร่
- นักศึกษาประเมินแบบ forced-choice พร้อม autosave และดูคะแนนของตัวเองได้
- Scoring engine แบบ pure function พร้อม property-based tests ([ADR-001](docs/adr/ADR-001-pure-scoring-engine.md))
- ประกาศผลอัตโนมัติ, ยื่นอุทธรณ์, audit log, ส่งออก CSV/XLSX และตรวจคุณภาพการประเมิน
- Privacy: k-anonymity ขั้นต่ำ 3 คน, ปิดตัวตนเมื่อพ้นระยะเก็บ และดาวน์โหลดสำเนาข้อมูลของตัวเอง

> โปรเจกต์ของวิชา **SDPX-AI** — Software Development Process in Practice (AI-Assisted)
> PRD ฉบับเต็ม: [`Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md`](Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md)

## สภาพแวดล้อมที่ Deploy

| | Staging (`develop`) | Production (`main`) |
|---|---|---|
| Web | <https://paireval-web.onrender.com> | <https://paireval-web-production.onrender.com> |
| API | <https://paireval-api.onrender.com/api/health> | <https://paireval-api-production.onrender.com/api/health> |
| Blueprint | [`render.yaml`](render.yaml) | [`render.production.yaml`](render.production.yaml) |
| การ deploy | อัตโนมัติเมื่อ CI ผ่าน | หลัง CI ผ่านและมีผู้อนุมัติใน GitHub |

- `GET /api/health` คืนค่า commit SHA ที่ API กำลังรัน ใช้ตรวจว่า deploy ตามทันแล้วหรือยัง
- Auto-Deploy และ Blueprint Auto Sync ของ Render ปิดทั้งสองฝั่ง ทุกการ deploy สั่งจาก CI
- API อยู่บน Render free plan ซึ่งพักเมื่อไม่มีการใช้งาน request แรกหลังพักจึงอาจใช้เวลาหลายสิบวินาที

## Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4 |
| Backend | FastAPI (Python 3.12), psycopg, SQL migrations |
| Database | PostgreSQL |
| Testing | pytest, Vitest, Playwright, axe-core, k6 |
| Quality & Security | ruff, oxlint, Redocly, CodeQL, gitleaks, pip-audit, npm audit |
| Infrastructure | Docker Compose, GitHub Actions, Render |

เหตุผลของการเลือก stack: [`memory-bank/standards/tech-stack.md`](memory-bank/standards/tech-stack.md)

## โครงสร้าง Repository

```text
.
├── frontend/                 React SPA (Vite + TypeScript)
├── backend/                  FastAPI service, migrations และ tests
├── e2e/                      Playwright end-to-end tests
├── performance/              k6 smoke / load tests และผลวัดย้อนหลัง
├── scripts/                  CI, demo และ maintenance scripts
├── docs/                     สถาปัตยกรรม, ADR, OpenAPI และรายงานแต่ละ workshop
├── memory-bank/              context สำหรับทีมและ AI agent
├── Sources/                  เอกสารประกอบวิชา (อ่านอย่างเดียว)
├── compose.yaml              dev environment: web + api + db
├── compose.test.yaml         test environment: unit / integration / e2e
├── render.yaml               Render Blueprint (staging)
└── render.production.yaml    Render Blueprint (production)
```

## เริ่มต้นใช้งาน

### ด้วย Docker (แนะนำ)

ต้องมีเพียง Docker Desktop

```bash
docker compose up
```

| Service | URL |
|---|---|
| Web | <http://localhost:5173> |
| API | <http://localhost:8000/api/health> |
| PostgreSQL | `localhost:5433` |

Migration รันอัตโนมัติก่อน API เริ่มทำงาน และทั้งสองฝั่งรองรับ hot reload
ถ้าพอร์ตชน ให้ override ได้ เช่น `WEB_PORT=5174 CORS_ORIGINS=http://localhost:5174 docker compose up`

### ติดตั้งบนเครื่องโดยตรง

**1. Database**

```bash
docker compose up -d db
```

**2. Backend** — <http://localhost:8000>

```bash
cd backend
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
cp .env.example .env                        # แล้วกรอกค่าที่จำเป็น
./.venv/Scripts/python.exe -m app.migrate
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

**3. Frontend** — <http://localhost:5173>

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

ขั้นตอนก่อน/หลังใช้ Docker และวิธีวัด: [`docs/setup-steps.md`](docs/setup-steps.md)

## การทดสอบ

```bash
# Local
cd backend  && ./.venv/Scripts/python.exe -m pytest                 # unit + api (ไม่ต้องมี DB)
cd backend  && ./.venv/Scripts/python.exe -m pytest -m integration  # ต้องมี PostgreSQL
cd frontend && npm test                                             # unit tests
npm run e2e                                                         # end-to-end
npm run lint:api                                                    # validate OpenAPI

# Docker — environment เดียวกับ CI
docker compose -f compose.test.yaml up unit-api        --abort-on-container-exit --exit-code-from unit-api
docker compose -f compose.test.yaml up unit-web        --abort-on-container-exit --exit-code-from unit-web
docker compose -f compose.test.yaml up integration-api --abort-on-container-exit --exit-code-from integration-api
docker compose -f compose.test.yaml --profile e2e up e2e --abort-on-container-exit --exit-code-from e2e
docker compose -f compose.test.yaml --profile e2e down -v
```

Integration test แยกออกจาก `pytest` ปกติโดยตั้งใจ เพื่อให้ unit loop รันได้เร็วโดยไม่ต้องมีฐานข้อมูล ([`backend/pytest.ini`](backend/pytest.ini))

รายละเอียดว่าแต่ละ test ปกป้องกฎอะไร: [`backend/TEST_PLAN.md`](backend/TEST_PLAN.md) · [`frontend/TEST_PLAN.md`](frontend/TEST_PLAN.md) · [`docs/e2e-report.md`](docs/e2e-report.md)

## CI/CD

ทุก PR และ push เข้า `develop` / `main` รัน [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

```text
lint-api       ┐
lint-fe        │                ┌──► deploy-staging ──► performance   (develop)
test-fe        ├──► e2e ────────┤
lint-be        │                └──► deploy-production              (main, ต้องอนุมัติ)
test-be        │
integration-be ┘

security-scan (gitleaks + dependency audit) รันขนานกันแต่ไม่ได้เป็น dependency ของ e2e
```

- Lint, unit, integration และ E2E เป็น gate ก่อน deploy
- `develop` → staging ทันทีที่ gate ผ่าน · `main` → production หลังผู้อนุมัติกด Review deployments
- การตั้งค่าบัญชีและรายชื่อ secrets: [`docs/cicd.md`](docs/cicd.md)
- ฐานข้อมูล Render Free และวันหมดอายุ: [`docs/render-free-db.md`](docs/render-free-db.md)

## สถานะ Workshop

| Workshop | สถานะ | ผลลัพธ์หลัก |
|---|:---:|---|
| WS-01 First Deploy | ✅ | Landing page, `GET /api/health`, deploy อัตโนมัติจาก `develop` · commit-to-live 42 วินาที (web) |
| WS-02 Requirements & API Design | ✅ | Backlog 16 stories พร้อม AC/DoD, architecture + ERD, OpenAPI ผ่าน validation, memory-bank |
| WS-03 Unit Testing | ✅ | Test harness (fake / factory / fixture), unit loop ต่ำกว่า 10 วินาที, coverage backend 67% |
| WS-04 E2E Testing | ✅ | Journey ของผู้สอนครบเส้นบน stack จริง · `--repeat-each=3` ไม่พบ flaky test |
| WS-05 Docker | ✅ | Multi-stage Dockerfile (non-root + healthcheck, web 459 → 94 MB) · setup 15 ขั้นตอนเหลือคำสั่งเดียว |
| WS-06 CI/CD | ✅ | CI gate บล็อก merge ได้จริง, staging deploy SHA เดียวกันทั้ง API และ web, production มี reviewer gate |
| WS-07 Performance & Observability | ✅ | Performance job บน staging ผ่าน 3 รอบติดกัน · NFR 200 users บน Render free ยังไม่ผ่าน ([รายงาน](docs/performance-report.md)) |
| WS-08 Code Quality & Security | ✅ | Refactor publish 93 → 61 บรรทัด, แก้ช่องโหว่ 3 ข้อพร้อม tests, CodeQL scan `main` ([รายงาน](docs/ws08-submission.md)) |

ตัวเลขและหลักฐานของแต่ละรอบ: [`docs/loop-metrics.md`](docs/loop-metrics.md) · [`docs/ws06-07-submission.md`](docs/ws06-07-submission.md)

### Product Backlog

| Sprint | สถานะ | ขอบเขต |
|---|:---:|---|
| [Sprint 1](https://github.com/STARSTEAM-X/sdpx-arai/milestone/1) | ✅ | Login, สร้างห้องเรียน, นำเข้ารายชื่อ CSV, กันการเข้าถึงข้ามห้อง |
| [Sprint 2](https://github.com/STARSTEAM-X/sdpx-arai/milestone/2) | ✅ | สร้างงานประเมิน, feasibility, จัดคู่อัตโนมัติ, ผู้ร่วมสอนและ TA, audit log |
| [Sprint 3](https://github.com/STARSTEAM-X/sdpx-arai/milestone/3) | ✅ | นักศึกษาประเมินและดูคะแนน, scoring engine, finalize |

แผนและเหตุผลของการแบ่ง Sprint: [`docs/backlog.md`](docs/backlog.md)

## เอกสาร

| หมวด | เอกสาร |
|---|---|
| สถาปัตยกรรม | [Architecture](docs/architecture.md) · [ERD](docs/erd.md) · [OpenAPI](docs/openapi.yaml) · [Wireframes](docs/wireframes/) |
| Architecture Decisions | [ADR-001 – ADR-007](docs/adr/) |
| การพัฒนา | [AGENTS.md](AGENTS.md) · [Setup steps](docs/setup-steps.md) · [Tech stack](memory-bank/standards/tech-stack.md) |
| Testing | [E2E report](docs/e2e-report.md) · [Accessibility](docs/a11y-report.md) · [Coverage](docs/coverage/) |
| Operations | [CI/CD](docs/cicd.md) · [Backup & restore](docs/backup-restore.md) · [Email notifications](docs/email-notifications.md) |
| Performance | [Performance report](docs/performance-report.md) · [History (WS-07)](docs/performance-history-ws07.md) |
| Security & Quality | [Security pre-check](docs/security-pre-check.md) · [Findings](docs/ws08-security-findings.md) · [Refactoring plan](docs/refactoring-plan.md) |

## การแก้ปัญหาที่พบบ่อย

<details>
<summary><b>พอร์ต 8000 ถูกใช้อยู่ (<code>[Errno 10048]</code>)</b></summary>

เปลี่ยนพอร์ตของ backend และตั้งค่า frontend ให้ตรงกัน:

```bash
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8123
# frontend/.env → VITE_API_BASE_URL=http://localhost:8123 แล้ว restart npm run dev
```

ตรวจพอร์ตที่ถูกใช้: `netstat -ano | findstr LISTENING`

</details>

<details>
<summary><b>เข้าสู่ระบบด้วย Google แล้วขึ้น <code>redirect_uri_mismatch</code></b></summary>

ปุ่มเข้าสู่ระบบพาไปหน้า login ของ Google แล้ว Google ส่ง `id_token` กลับมาที่ `<origin>/auth/google/callback`
(OpenID Connect, `response_type=id_token` — ดู `frontend/src/lib/googleSignIn.ts`)

Google ยอมส่งกลับเฉพาะ URI ที่ลงทะเบียนไว้ ให้เพิ่มใน
[Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client ID ที่ใช้ใน `frontend/.env` → **Authorized redirect URIs**:

```text
http://localhost:5173/auth/google/callback
http://127.0.0.1:5173/auth/google/callback
https://paireval-web.onrender.com/auth/google/callback
https://paireval-web-production.onrender.com/auth/google/callback
```

- `localhost` และ `127.0.0.1` นับเป็นคนละ URI
- ต้องตรงทุกตัวอักษร ไม่มี `/` ปิดท้าย และต้องเพิ่มใหม่หากเปลี่ยนพอร์ต
- หลังบันทึก รอประมาณ 5 นาทีให้ค่าใหม่มีผล

</details>

<details>
<summary><b>Request แรกไปที่ staging ช้ามาก</b></summary>

API บน Render free plan ถูกพักเมื่อไม่มีการใช้งาน request แรกจะปลุก service ขึ้นมาใหม่ ซึ่งใช้เวลาหลายสิบวินาที
ไม่ใช่ข้อผิดพลาด ส่วนหน้าเว็บเป็น static site บน CDN จึงไม่มีอาการนี้

</details>
