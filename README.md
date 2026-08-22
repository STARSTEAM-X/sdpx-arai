# PairEval

**ระบบประเมินผลนักศึกษาแบบ Pairwise Comparison**

ผู้ประเมินเทียบงานครั้งละ 2 ชิ้นด้วยมาตรวัด 6 ระดับ แล้วระบบคำนวณคะแนนจากผลเปรียบเทียบทั้งหมด
เพื่อแก้ปัญหา absolute scoring bias และ free-rider ในการให้คะแนนงานกลุ่ม

> Project ของวิชา **SDPX-AI** — Software Development Process in Practice (AI-Assisted)
> สรุปงานทั้ง 8 workshop อยู่ที่ [`summary.md`](summary.md)

## สถานะ

| Workshop | สถานะ | ได้อะไร |
|---|---|---|
| WS-01 First Deploy | ✅ | Landing page + `GET /api/health` + auto-deploy จาก `develop` · commit-to-live 42 วิ |
| WS-02 Requirements & API Design | ✅ | Backlog 11 stories, architecture + ERD, OpenAPI 12 endpoints, memory-bank |
| WS-03 Unit Testing | ⬜ | |
| WS-04 E2E Testing | ⬜ | |
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

**Backend** (`http://localhost:8000`)

```bash
cd backend
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt
cp .env.example .env
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

## Deploy

Deploy อัตโนมัติขึ้น Render ทุกครั้งที่ push เข้า `develop` — ไม่ต้องกดปุ่ม
config อยู่ใน [`render.yaml`](render.yaml)

## เอกสาร

- [`AGENTS.md`](AGENTS.md) — กติกาสำหรับ AI agent และคำสั่งที่ใช้ได้จริง
- [`memory-bank/standards/tech-stack.md`](memory-bank/standards/tech-stack.md) — การตัดสินใจเรื่อง stack
- [`docs/superpowers/specs/`](docs/superpowers/specs/) — design doc ของแต่ละ workshop
- PRD ฉบับเต็ม: `Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md`
