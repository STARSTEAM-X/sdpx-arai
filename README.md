# PairEval

**ระบบประเมินผลนักศึกษาแบบ Pairwise Comparison**

ผู้ประเมินเทียบงานครั้งละ 2 ชิ้นด้วยมาตรวัด 6 ระดับ แล้วระบบคำนวณคะแนนจากผลเปรียบเทียบทั้งหมด
เพื่อแก้ปัญหา absolute scoring bias และ free-rider ในการให้คะแนนงานกลุ่ม

[![CI](https://github.com/STARSTEAM-X/sdpx-arai/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/STARSTEAM-X/sdpx-arai/actions/workflows/ci.yml)

> Project ของวิชา **SDPX-AI** — Software Development Process in Practice (AI-Assisted)
> สรุปงานทั้ง 8 workshop อยู่ที่ [`summary.md`](summary.md)

## Live

| | Staging (`develop`) | Production (`main`) |
|---|---|---|
| หน้าเว็บ | <https://paireval-web.onrender.com> | <https://paireval-web-production.onrender.com> |
| API | <https://paireval-api.onrender.com/api/health> | <https://paireval-api-production.onrender.com/api/health> |

Staging deploy จาก `develop` ทันทีที่ CI ผ่านตาม [`render.yaml`](render.yaml);
production deploy จาก `main` ตาม [`render.production.yaml`](render.production.yaml) และต้องรอคนอนุมัติใน GitHub
(Actions → run ของ `main` → Review deployments). Auto-Deploy และ Blueprint Auto Sync ปิดแล้วทั้งสองฝั่ง.
การตั้งค่าบัญชีและชื่อ secrets ที่ใช้บันทึกอยู่ใน [`docs/cicd.md`](docs/cicd.md).
`GET /api/health` ตอบ commit SHA ที่ API กำลังรันอยู่ — ใช้เช็คได้ทันทีว่า deploy ตามทันหรือยัง
(ป้ายสถานะ API บนหน้าแรกถูกเอาออกตามแบบ Figma)

> `paireval-api` เป็น web service บน free plan ซึ่ง Render จะพักเมื่อไม่มีคนใช้
> request แรกหลังพักจึงช้าเป็นสิบวินาที ส่วนหน้าเว็บเป็น static site เสิร์ฟผ่าน CDN ไม่มีอาการนี้
> ถ้า request แรกค้างอยู่ครู่หนึ่ง แปลว่า API กำลังตื่น ไม่ใช่พัง

## สถานะ

ตัวเลขใน WS-01–05 เป็นประวัติที่วัดเมื่อ **2026-08-31**;
ผลอ้างอิง WS-06–07 วัดเมื่อ **2026-10-05** ที่ commit **edba11d**.
ส่วน commit-to-live ยังเป็นค่าที่วัดตอน WS-01 — วิธีวัดซ้ำอยู่ใน [`memory-bank/standards/tech-stack.md`](memory-bank/standards/tech-stack.md)

ชุดสำหรับส่งและ present: [`docs/ws06-07-submission.md`](docs/ws06-07-submission.md)
รวม CI ที่ผ่าน, ภาพ merge ถูกบล็อก, ตารางก่อน/หลัง และคำสั่งเดโม; **การส่ง LMS ยังไม่ยืนยัน**.

| Workshop | สถานะ | ได้อะไร |
|---|---|---|
| WS-01 First Deploy | ✅ | Landing page + `GET /api/health` + auto-deploy จาก `develop` ทั้งสองฝั่ง · commit-to-live 42 วิ (ฝั่ง web) |
| WS-02 Requirements & API Design | ✅ | Backlog 16 stories (ทุกอันมี AC + DoD), architecture + ERD, OpenAPI 13 paths / 14 operations validate ผ่าน, memory-bank |
| WS-03 Unit Testing | ✅ | Unit harness (fake/factory/fixture) · **backend 350 tests 0.96s + frontend 21 tests 0.23s** (เพดาน 10 วิ) · integration อีก 29 · fidelity check 6 ครั้ง · coverage backend 67% |
| WS-04 E2E Testing | ✅ | Journey ของอาจารย์ใช้งานได้ครบเส้นบน Postgres + API + หน้าเว็บ · **E2E 118 tests · `--repeat-each=3` ได้ 354 passed ใน 4.5 นาที ไม่ flaky** |
| WS-05 Docker | ✅ | Dockerfile multi-stage ทั้งสองฝั่ง (non-root + healthcheck · web 459→94MB) · **setup 15 ขั้นตอน → `docker compose up` คำสั่งเดียว (36 วิครั้งแรก / 11 วิครั้งถัดไป)** · test db เป็น ephemeral · พิสูจน์แล้วว่า test แดง → exit code ≠ 0 · CI smoke job เขียวบน GitHub Actions |
| WS-06 CI/CD | ✅ | Docker CI ผ่าน 7 checks, PR ทดลองบล็อก merge จริง, API/เว็บ staging SHA เดียวกัน edba11d; pipeline รอบยืนยันผ่านรวม performance. Commit-to-live รอบแรก 359.7s; production มี human reviewer gate และ template แยก ([`docs/cicd.md`](docs/cicd.md), [`docs/loop-metrics.md`](docs/loop-metrics.md)) |
| WS-07 Performance | ✅ | เกณฑ์ lab ครบ 5 ข้อ. Job `performance` บน staging **ผ่าน 3 รอบติดกัน** (2026-10-20, 311–327 requests, errors 0%): autosave server p95 36–86ms, submit 278–432ms, หน้า Evaluation round-trip p95 288–519ms. แก้เกณฑ์รายเส้นทางที่รวม network CI→สิงคโปร์ ~250ms ให้วัดที่ server (Server-Timing) โดยคงตัวเลขเดิม และเก็บรอบที่แดงไว้เป็นหลักฐาน. **NFR 200 users วัดแล้ว: staging บน Render free ไม่ผ่าน** (หน้า Evaluation p95 9.17s, publish 15.90s; recompute 2.98s ผ่าน) — request รอคิวใน app, วิเคราะห์สาเหตุและวิธีวัดยืนยันไว้ใน [`docs/performance-report.md`](docs/performance-report.md) |
| WS-08 Code Quality & Security | ✅ | Refactor publish 93→61 บรรทัดโดยคง behavior และไม่แตะ test; ADR-001 ครบทุก section; แก้ security **3 ข้อ** พร้อม test (CSV injection, production signing fallback, ไม่เผยเหตุผลภายในตอน token ตรวจไม่ผ่าน) + อัปเดต dependencies. **CodeQL scan `main` แล้ว** (Python/JS-TS/Actions; 3 warning คัดกรองเป็น false positive). CI `main`/`develop` เขียว ([`docs/ws08-submission.md`](docs/ws08-submission.md)) |

> **ทีมต้องทำเอง:** present WS-07/WS-08, ส่ง LMS และยืนยันว่าทุกคนอธิบาย decisions ได้ — agent ทำแทนไม่ได้.

### หลัง WS-08 (merge เข้า `main` ใน [PR #24](https://github.com/STARSTEAM-X/sdpx-arai/pull/24))

- **Privacy / scoring:** k_min ไม่ต่ำกว่า 3 (GAP-01) · กลุ่ม 3 คนติด LOW_CONFIDENCE เสมอ (GAP-09) · ดาวน์โหลดสำเนาข้อมูลของตัวเอง (GAP-02)
- **Features:** ปิดฝั่งกลุ่มด้วย groupMaxScore = 0 (GAP-11) · diff รายชื่อก่อนนำเข้า (GAP-12)
- **Ops / quality:** backup รายวันแบบเข้ารหัสและ alert (GAP-08, GAP-10) · สแกน dependency/secret + dependabot (GAP-07) · property test ของ pairing (GAP-13) · INSERT คู่แบบ executemany (GAP-04)
- **เข้าสู่ระบบด้วย Google:** ปุ่มสีส้มพาไปหน้า login ของ Google เอง (OIDC redirect + state/nonce) แทนการซ่อนปุ่ม GIS ที่ Google เมินคลิก
- **UI:** ปฏิทินเลือกวันเวลาลอยเหนือการ์ด/dialog ไม่ถูกตัด
- **Test:** integration test คะแนนทั้งห้องไม่ flaky แล้ว

### Product backlog

| Sprint | สถานะ | ได้อะไร |
|---|---|---|
| [Sprint 1](https://github.com/STARSTEAM-X/sdpx-arai/milestone/1) | ✅ | login · สร้างห้องเรียน · นำเข้ารายชื่อ CSV · กันการเข้าถึงข้ามห้อง |
| [Sprint 2](https://github.com/STARSTEAM-X/sdpx-arai/milestone/2) | ✅ | สร้างงานประเมิน · feasibility · เผยแพร่แล้วจัดคู่อัตโนมัติ · จัดการผู้ร่วมสอนและ TA · audit log |
| [Sprint 3](https://github.com/STARSTEAM-X/sdpx-arai/milestone/3) | ✅ | นักศึกษาประเมินและดูคะแนน · scoring engine · finalize — ปิดครบ 7 stories |

แผนและเหตุผลของการแบ่ง Sprint อยู่ใน [`docs/backlog.md`](docs/backlog.md)

## โครงสร้าง

```
frontend/     React 19 + Vite + TypeScript + Tailwind v4
backend/      FastAPI (Python 3.12)
memory-bank/  context ที่ทั้งคนและ AI agent อ่าน
docs/         design docs และเอกสารของ project
e2e/          Playwright E2E
performance/  k6 smoke/load test
render.yaml             Render Blueprint ของ staging — infra เป็น code
render.production.yaml  Render Blueprint ของ production
compose.yaml       dev environment — web + api + db ด้วยคำสั่งเดียว
compose.test.yaml  test environment — unit / integration / e2e พร้อม db แบบ ephemeral
Sources/      เอกสารประกอบวิชา (MIT)
```

## รันบนเครื่องตัวเอง

### วิธีที่สั้นที่สุด — Docker (แนะนำ)

ต้องมีแค่ Docker Desktop ไม่ต้องลง Node, Python หรือ Postgres

```bash
docker compose up
```

- หน้าเว็บ: `http://localhost:5173`
- API: `http://localhost:8000/api/health`
- Postgres: `localhost:5433`

migration รันให้เองก่อน API ขึ้นทุกครั้ง และแก้ code แล้ว reload ทั้งสองฝั่งโดยไม่ต้อง build ใหม่
ถ้าพอร์ตชนกับโปรแกรมอื่นบนเครื่อง ตั้งทับได้:
`WEB_PORT=5174 CORS_ORIGINS=http://localhost:5174 docker compose up`

จำนวนขั้นตอนก่อน/หลังใช้ Docker และวิธีวัด: [`docs/setup-steps.md`](docs/setup-steps.md)

### วิธีติดตั้งบนเครื่องตรง ๆ

ต้องเปิด 2 terminal — ฝั่งละอัน

**Database** (ต้องขึ้นก่อน backend)

```bash
docker compose up -d db
```

**Backend** (`http://localhost:8000`)

```bash
cd backend
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
cp .env.example .env                               # แล้วเติมค่าในไฟล์ .env
./.venv/Scripts/python.exe -m app.migrate          # สร้างตาราง รันซ้ำได้
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

**Frontend** (`http://localhost:5173`)

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

เปิด `http://localhost:5173` — ตรวจว่า API พร้อมด้วย `http://localhost:8000/api/health`

> ขั้นตอนชุดนี้คือ baseline ที่ WS-05 เอาไปเทียบ — **15 ขั้นตอน 3 terminal และต้องเติมค่าใน `.env` เอง 4 ค่า**
> ย่อเหลือ `docker compose up` คำสั่งเดียวแล้ว ตัวเลขและวิธีวัดอยู่ใน [`docs/setup-steps.md`](docs/setup-steps.md)

### ถ้า port ชนกัน

บางเครื่องมีโปรแกรมอื่นครอง port 8000 อยู่แล้ว จะขึ้น `[Errno 10048]` ตอนสั่ง uvicorn
ให้เปลี่ยนไปใช้ port อื่นทั้งสองฝั่งให้ตรงกัน:

```bash
# backend
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8123
# frontend/.env  → แก้เป็น VITE_API_BASE_URL=http://localhost:8123 แล้ว restart npm run dev
```

ตรวจว่า port ไหนถูกใช้อยู่: `netstat -ano | findstr LISTENING`

### ถ้ากดเข้าสู่ระบบด้วย Google แล้วขึ้น `redirect_uri_mismatch`

ปุ่มสีส้มพาทั้งหน้าไปหน้า login ของ Google แล้ว Google ส่ง id_token กลับมาที่
`<origin>/auth/google/callback` (OpenID Connect, `response_type=id_token`
— โค้ดอยู่ที่ `frontend/src/lib/googleSignIn.ts`) ไม่ได้ใช้ปุ่มของ Google Identity Services
เพราะ GIS เมินคลิกบนปุ่มที่ถูกซ่อนไว้ใต้ปุ่มของเรา (กัน clickjacking)

Google จะยอมส่งกลับเฉพาะ URI ที่ลงทะเบียนไว้ ถ้ายังไม่ได้ลงทะเบียนจะขึ้นหน้า error `redirect_uri_mismatch`
เป็นการตั้งค่าฝั่ง Google ไม่ใช่บั๊กในโค้ด แก้ที่ [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
เลือก OAuth 2.0 Client ID ตัวที่อยู่ใน `frontend/.env` → **Authorized redirect URIs** →
เพิ่มให้ครบทุก origin ที่ใช้จริง:

```
http://localhost:5173/auth/google/callback
http://127.0.0.1:5173/auth/google/callback
https://paireval-web.onrender.com/auth/google/callback
https://paireval-web-production.onrender.com/auth/google/callback
```

`localhost` กับ `127.0.0.1` Google นับเป็นคนละ URI ต้องใส่ทั้งคู่ถ้าเปิดทั้งสองแบบ
ต้องตรงทุกตัวอักษร ห้ามมี `/` ปิดท้าย และถ้าเปลี่ยน port ต้องเพิ่ม port นั้นด้วย

กด Save แล้วรอสัก 5 นาทีให้ค่าใหม่มีผล จากนั้นลองกดเข้าสู่ระบบอีกครั้ง

## Test

```bash
cd backend && ./.venv/Scripts/python.exe -m pytest                 # unit + api (ไม่ต้องมี DB)
cd backend && ./.venv/Scripts/python.exe -m pytest -m integration  # ต้องมี Postgres
cd frontend && npm test                                            # unit test
npm run e2e                                                        # E2E (ต้องมี Postgres ขึ้นอยู่)

# หรือรันทั้งหมดใน Docker — environment เดียวกับ CI ไม่ต้องลงอะไรบนเครื่อง
docker compose -f compose.test.yaml up unit-api --abort-on-container-exit --exit-code-from unit-api
docker compose -f compose.test.yaml up unit-web --abort-on-container-exit --exit-code-from unit-web
docker compose -f compose.test.yaml up integration-api --abort-on-container-exit --exit-code-from integration-api
docker compose -f compose.test.yaml --profile e2e up e2e --abort-on-container-exit --exit-code-from e2e
docker compose -f compose.test.yaml --profile e2e down -v            # teardown
npm run e2e:report                                                 # เปิด HTML report
npm run lint:api                                                   # validate docs/openapi.yaml
```

integration test ถูกตัดออกจาก `pytest` เปล่า ๆ โดยตั้งใจ — ลูปที่ต้องรอ database
คือลูปที่ไม่มีใครรัน เหตุผลเต็มอยู่ใน [`backend/pytest.ini`](backend/pytest.ini)

รายละเอียดว่า test แต่ละตัวปกป้องกฎอะไร: [`backend/TEST_PLAN.md`](backend/TEST_PLAN.md) ·
[`frontend/TEST_PLAN.md`](frontend/TEST_PLAN.md) · [`docs/e2e-report.md`](docs/e2e-report.md)

## CI

ทุก PR และ push เข้า develop/main รัน [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
Lint, unit, integration และ E2E เป็น gate ก่อน deploy; test containers ใช้
compose.test.yaml พร้อม compose.ci.yaml สำหรับ cache/JUnit/coverage.
ผลตรวจบนเครื่องล่าสุด 2026-10-20: backend unit 727 (9.75s), frontend 48, integration 57
และ E2E 149 ผ่าน — backend ตัวเดียวเข้าใกล้เพดาน 10 วิของ unit loop แล้ว.
CI ของ `develop` (f9f0d64) เขียวครบทุก job รวม `performance`; job นี้ไม่ใช่ required check ของ `main`.
ผล Docker CI รอบก่อน ๆ อ้าง run จริงใน docs/loop-metrics.md.

## Deploy

CI สั่ง Render deploy หลัง gate ผ่าน: push เข้า `develop` → staging ทันที,
push เข้า `main` (merge release PR) → production หลังคนอนุมัติ; ตรวจ commit ของ API และเว็บด้วย `GET /api/health`.
Config staging อยู่ใน [`render.yaml`](render.yaml), production ใน
[`render.production.yaml`](render.production.yaml) สำหรับ workspace แยก.
DB Free ใหม่หมดอายุ 2026-11-04; รายละเอียดใน [`docs/render-free-db.md`](docs/render-free-db.md).

## เอกสาร

- [`AGENTS.md`](AGENTS.md) — กติกาสำหรับ AI agent และคำสั่งที่ใช้ได้จริง
- [`docs/setup-steps.md`](docs/setup-steps.md) — จำนวนขั้นตอนและเวลาในการติดตั้ง ก่อน/หลังใช้ Docker
- [`docs/ws06-07-submission.md`](docs/ws06-07-submission.md) — หลักฐานและบทเดโม WS-06/07 พร้อมข้อความสำหรับ LMS
- [`memory-bank/standards/tech-stack.md`](memory-bank/standards/tech-stack.md) — การตัดสินใจเรื่อง stack
- [`docs/superpowers/specs/`](docs/superpowers/specs/) — design doc ของแต่ละ workshop
- PRD ฉบับเต็ม: `Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md`
