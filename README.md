# PairEval

**ระบบประเมินผลนักศึกษาแบบ Pairwise Comparison**

ผู้ประเมินเทียบงานครั้งละ 2 ชิ้นด้วยมาตรวัด 6 ระดับ แล้วระบบคำนวณคะแนนจากผลเปรียบเทียบทั้งหมด
เพื่อแก้ปัญหา absolute scoring bias และ free-rider ในการให้คะแนนงานกลุ่ม

> Project ของวิชา **SDPX-AI** — Software Development Process in Practice (AI-Assisted)
> สรุปงานทั้ง 8 workshop อยู่ที่ [`summary.md`](summary.md)

## Live

| | URL |
|---|---|
| หน้าเว็บ | <https://paireval-web.onrender.com> |
| API | <https://paireval-api.onrender.com/api/health> |

ทั้งสอง service deploy อัตโนมัติจาก branch `develop` ตาม [`render.yaml`](render.yaml)
ป้ายสถานะบนหน้าแรกแสดง commit SHA ที่ API กำลังรันอยู่ — ใช้เช็คได้ทันทีว่า deploy ตามทันหรือยัง

> `paireval-api` เป็น web service บน free plan ซึ่ง Render จะพักเมื่อไม่มีคนใช้
> request แรกหลังพักจึงช้าเป็นสิบวินาที ส่วนหน้าเว็บเป็น static site เสิร์ฟผ่าน CDN ไม่มีอาการนี้
> ถ้าป้ายสถานะบนหน้าแรกค้างที่ "กำลังโหลด" อยู่ครู่หนึ่ง แปลว่า API กำลังตื่น ไม่ใช่พัง

## สถานะ

ตัวเลข test / coverage / E2E วัดใหม่เมื่อ **2026-08-23** ไม่ใช่ค่าที่จดไว้ตอนทำ workshop นั้น ๆ
ส่วน commit-to-live ยังเป็นค่าที่วัดตอน WS-01 — วิธีวัดซ้ำอยู่ใน [`memory-bank/standards/tech-stack.md`](memory-bank/standards/tech-stack.md)

| Workshop | สถานะ | ได้อะไร |
|---|---|---|
| WS-01 First Deploy | ✅ | Landing page + `GET /api/health` + auto-deploy จาก `develop` ทั้งสองฝั่ง · commit-to-live 42 วิ (ฝั่ง web) |
| WS-02 Requirements & API Design | ✅ | Backlog 11 stories (ทุกอันมี AC + DoD), architecture + ERD, OpenAPI 13 paths / 14 operations validate ผ่าน, memory-bank |
| WS-03 Unit Testing | ✅ | Unit harness (fake/factory/fixture) · **106 tests 0.65s** (เพดาน 10 วิ) · integration อีก 18 · fidelity check 6 ครั้ง · coverage backend 80% / frontend 0.31% |
| WS-04 E2E Testing | ✅ | Journey สร้างห้องเรียนและนำเข้ารายชื่อใช้งานได้จริงบน Postgres + API + หน้าเว็บ · **E2E 22 tests · `--repeat-each=3` ได้ 66 passed ไม่ flaky** |
| WS-05 Docker | ⬜ | |
| WS-06 CI/CD | ⬜ | |
| WS-07 Performance | ⬜ | |
| WS-08 Code Quality & Security | ⬜ | |

## โครงสร้าง

```
frontend/     React 19 + Vite + TypeScript + Tailwind v4
backend/      FastAPI (Python 3.12)
memory-bank/  context ที่ทั้งคนและ AI agent อ่าน
docs/         design docs และเอกสารของ project
render.yaml   Render Blueprint — infra เป็น code
Sources/      เอกสารประกอบวิชา (MIT)
```

## รันบนเครื่องตัวเอง

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

> ขั้นตอนตอนนี้ยังเยอะและต้องทำมือหลายอย่าง — **WS-05 จะย่อให้เหลือ `docker compose up` คำสั่งเดียว**
> จำนวนขั้นตอนตอนนี้คือ baseline ที่จะเอาไปเทียบ

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
npm run e2e:report                                                 # เปิด HTML report
npm run lint:api                                                   # validate docs/openapi.yaml
```

integration test ถูกตัดออกจาก `pytest` เปล่า ๆ โดยตั้งใจ — ลูปที่ต้องรอ database
คือลูปที่ไม่มีใครรัน เหตุผลเต็มอยู่ใน [`backend/pytest.ini`](backend/pytest.ini)

รายละเอียดว่า test แต่ละตัวปกป้องกฎอะไร: [`backend/TEST_PLAN.md`](backend/TEST_PLAN.md) ·
[`frontend/TEST_PLAN.md`](frontend/TEST_PLAN.md) · [`docs/e2e-report.md`](docs/e2e-report.md)

## Deploy

Deploy อัตโนมัติขึ้น Render ทุกครั้งที่ push เข้า `develop` — ไม่ต้องกดปุ่ม
config อยู่ใน [`render.yaml`](render.yaml)

## เอกสาร

- [`AGENTS.md`](AGENTS.md) — กติกาสำหรับ AI agent และคำสั่งที่ใช้ได้จริง
- [`memory-bank/standards/tech-stack.md`](memory-bank/standards/tech-stack.md) — การตัดสินใจเรื่อง stack
- [`docs/superpowers/specs/`](docs/superpowers/specs/) — design doc ของแต่ละ workshop
- PRD ฉบับเต็ม: `Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md`
