# PairEval

**ระบบประเมินผลนักศึกษาแบบ Pairwise Comparison**

ผู้ประเมินเทียบงานครั้งละ 2 ชิ้นด้วยมาตรวัด 6 ระดับ แล้วระบบคำนวณคะแนนจากผลเปรียบเทียบทั้งหมด
เพื่อแก้ปัญหา absolute scoring bias และ free-rider ในการให้คะแนนงานกลุ่ม

[![CI](https://github.com/STARSTEAM-X/sdpx-arai/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/STARSTEAM-X/sdpx-arai/actions/workflows/ci.yml)

> Project ของวิชา **SDPX-AI** — Software Development Process in Practice (AI-Assisted)
> สรุปงานทั้ง 8 workshop อยู่ที่ [`summary.md`](summary.md)

## Live

| | URL |
|---|---|
| หน้าเว็บ | <https://paireval-web.onrender.com> |
| API | <https://paireval-api.onrender.com/api/health> |

ทั้งสอง service ใช้ branch `develop`. CI สั่ง deploy หลังตรวจผ่าน
ตาม [`render.yaml`](render.yaml); Auto-Deploy และ Blueprint Auto Sync ปิดแล้ว.
การตั้งค่าบัญชีและชื่อ secrets ที่ใช้บันทึกอยู่ใน [`docs/cicd.md`](docs/cicd.md).
ป้ายสถานะบนหน้าแรกแสดง commit SHA ที่ API กำลังรันอยู่ — ใช้เช็คได้ทันทีว่า deploy ตามทันหรือยัง

> `paireval-api` เป็น web service บน free plan ซึ่ง Render จะพักเมื่อไม่มีคนใช้
> request แรกหลังพักจึงช้าเป็นสิบวินาที ส่วนหน้าเว็บเป็น static site เสิร์ฟผ่าน CDN ไม่มีอาการนี้
> ถ้าป้ายสถานะบนหน้าแรกค้างที่ "กำลังโหลด" อยู่ครู่หนึ่ง แปลว่า API กำลังตื่น ไม่ใช่พัง

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
| WS-07 Performance | 🟡 | Baseline/AI analysis ครบ; รอบ edba11d ผ่าน CI: 319 requests/0 errors, autosave p95 **270.40ms**, submit **351.71ms**. เก็บรอบแรกที่ autosave 317.95ms ไม่ผ่านไว้ด้วย; ยังไม่ยืนยัน NFR 200 users หรือความเสถียรหลายรอบ ([`docs/performance-report.md`](docs/performance-report.md)) |
| WS-08 Code Quality & Security | ⬜ | |

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
render.yaml   Render Blueprint — infra เป็น code
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

เปิด `http://localhost:5173` — ถ้าตั้งค่าถูก จะเห็นป้ายสถานะขึ้นว่า **API พร้อมใช้งาน**

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

### ถ้าปุ่ม Sign in with Google ไม่ขึ้น

console จะขึ้น `403` พร้อมข้อความ
`[GSI_LOGGER]: The given origin is not allowed for the given client ID`

แปลว่า origin ที่เปิดอยู่ยังไม่ได้ถูกลงทะเบียนกับ OAuth client — เป็นการตั้งค่าฝั่ง Google
ไม่ใช่บั๊กในโค้ด แก้ที่ [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
เลือก OAuth 2.0 Client ID ตัวที่อยู่ใน `frontend/.env` → **Authorized JavaScript origins** →
เพิ่มให้ครบทุก origin ที่ใช้จริง:

```
http://localhost:5173
http://127.0.0.1:5173
```

`localhost` กับ `127.0.0.1` Google นับเป็นคนละ origin ต้องใส่ทั้งคู่ถ้าเปิดทั้งสองแบบ
ใส่ origin เท่านั้น ห้ามมี path หรือ `/` ปิดท้าย และถ้าเปลี่ยน port ต้องเพิ่ม port นั้นด้วย

กด Save แล้วรอสัก 5 นาทีให้ค่าใหม่มีผล จากนั้น hard refresh (`Ctrl+Shift+R`)

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
ผลตรวจ local unit ล่าสุด 2026-10-05: backend 404, frontend 21 ผ่าน;
unit loop ทั้งสองคำสั่งรวม 5.42s เมื่อรันแยกจาก lint/typecheck.
Integration 29 และ E2E 118 ผ่านในการตรวจ candidate ก่อนหน้า; ผล Docker CI อ้าง run จริงใน docs/loop-metrics.md.

## Deploy

CI สั่ง Render deploy หลัง gate ผ่านเมื่อ push เข้า develop; ตรวจ commit ของ API และเว็บ.
Config staging อยู่ใน [`render.yaml`](render.yaml), production template ใน
[`render.production.yaml`](render.production.yaml) สำหรับ workspace แยก.
DB Free ใหม่หมดอายุ 2026-11-04; รายละเอียดใน [`docs/render-free-db.md`](docs/render-free-db.md).

## เอกสาร

- [`AGENTS.md`](AGENTS.md) — กติกาสำหรับ AI agent และคำสั่งที่ใช้ได้จริง
- [`docs/setup-steps.md`](docs/setup-steps.md) — จำนวนขั้นตอนและเวลาในการติดตั้ง ก่อน/หลังใช้ Docker
- [`docs/ws06-07-submission.md`](docs/ws06-07-submission.md) — หลักฐานและบทเดโม WS-06/07 พร้อมข้อความสำหรับ LMS
- [`memory-bank/standards/tech-stack.md`](memory-bank/standards/tech-stack.md) — การตัดสินใจเรื่อง stack
- [`docs/superpowers/specs/`](docs/superpowers/specs/) — design doc ของแต่ละ workshop
- PRD ฉบับเต็ม: `Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md`
