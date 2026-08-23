# AGENTS.md

ไฟล์นี้เขียนให้ **AI agent อ่านก่อนทำงานทุกครั้ง** — เขียนให้เครื่องใช้ได้ ไม่ใช่ให้คนประทับใจ
ถ้าคำสั่งในไฟล์นี้รันไม่ได้จริง แปลว่า loop ของ agent พังตั้งแต่ขั้น Verify

## Project

**PairEval** — ระบบประเมินผลนักศึกษาแบบ pairwise comparison
ผู้ประเมินเทียบงานครั้งละ 2 ชิ้นด้วยมาตรวัด 6 ระดับ แล้วระบบคำนวณคะแนนจากผลเปรียบเทียบทั้งหมด
แก้ปัญหา absolute scoring bias และ free-rider ในการให้คะแนนงานกลุ่ม

- **PRD ฉบับเต็ม:** `Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md`
- **สถานะปัจจุบัน:** WS-01 — มีแค่ landing page และ health endpoint ยังไม่มี feature จริง

## Paths

ประกาศไว้ที่นี่ที่เดียว — ที่อื่นให้อ้างอิงจากตรงนี้

| ส่วน | Path |
|---|---|
| Frontend | `frontend/` |
| Backend | `backend/` |
| Context สำหรับ AI | `memory-bank/` |
| เอกสาร | `docs/` |
| เอกสารประกอบวิชา (อ่านอย่างเดียว) | `Sources/` |

## Setup & Commands

### Frontend (`frontend/`)

```bash
npm ci                 # ติดตั้ง dependency ตาม lockfile
npm run dev            # dev server ที่ http://localhost:5173
npm run build          # build production ออกที่ dist/
npm run typecheck      # ตรวจ type ด้วย tsc
npm test               # vitest run — ต้องเขียวก่อน commit เสมอ
npm run test:watch     # vitest โหมดเฝ้าไฟล์ ใช้ตอนเขียน code
npm run test:cov       # coverage ออกที่ docs/coverage/frontend/
```

### Backend (`backend/`)

```bash
python -m venv .venv

# ติดตั้ง (Windows) — dev ต้องลงทั้งสองไฟล์ ส่วน production ลงแค่ requirements.txt
./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
# macOS / Linux: source .venv/bin/activate && pip install -r requirements-dev.txt

./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
# ตรวจ: http://localhost:8000/api/health  ต้องได้ {"status":"ok",...}

./.venv/Scripts/python.exe -m pytest              # ต้องเขียวก่อน commit เสมอ
./.venv/Scripts/python.exe -m pytest --cov --cov-report=html   # coverage ออกที่ docs/coverage/backend/
# path และ source ตั้งไว้ใน backend/.coveragerc แล้ว จึงไม่ต้องพิมพ์ --cov=app
```

### Database และ E2E (รันจาก root)

```bash
docker compose up -d db                    # Postgres สำหรับ dev/E2E
cd backend && ./.venv/Scripts/python.exe -m app.migrate   # สร้างตาราง รันซ้ำได้

npm run e2e                                # E2E ทั้งชุด (ยก API + frontend ให้เอง)
npx playwright test --repeat-each=3        # จับ flaky ก่อน push
npm run e2e:report                         # เปิด HTML report
```

**ENVIRONMENT ต้องเป็น `production` เสมอบน service ที่เข้าถึงได้จาก internet**
ถ้าไม่ใช่ `production` endpoint `POST /api/test/seed|cleanup|session` จะถูกเปิดขึ้นมา
ซึ่งแปลว่าใครก็ล้าง database และปลอมเป็นใครก็ได้ — ห้ามเปลี่ยนค่านี้โดยไม่มีเหตุผลชัดเจน

**SESSION_SECRET ต้องยาวอย่างน้อย 32 bytes** (RFC 7518 §3.2) — สั้นกว่านั้น app จะไม่ยอมเริ่มทำงาน

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### API contract (`docs/openapi.yaml`)

```bash
npm run lint:api   # redocly lint — ต้องไม่มีทั้ง error และ warning
```

กฎที่ปิดไว้และเหตุผลอยู่ใน `redocly.yaml` — **ห้ามปิดกฎเพิ่มโดยไม่เขียนเหตุผลกำกับ**

### เกณฑ์ความเร็วของ test loop

**unit test ทั้งสองฝั่งรวมกันต้องเสร็จภายใน 10 วินาที** — loop ที่ช้าคือ loop ที่ไม่มีใครรัน
รวมถึง AI agent ด้วย ถ้าเกินเมื่อไรให้ถือว่าเป็นปัญหาที่ต้องแก้ ไม่ใช่เรื่องปกติ

ตัวเลขล่าสุด (2026-08-23): backend 0.69s (86 tests) · frontend 0.25s (5 tests) — รวม ~1s

## Conventions

- **Commit message:** Conventional Commits — `feat:` `fix:` `docs:` `chore:` `refactor:` `test:`
- **Branch:** `main` = production · `develop` = staging (auto-deploy) · งานใหม่แตกจาก `develop`
- **ภาษา UI:** ไทย (ตาม NFR-I18N-01 ใน PRD)
- **Config:** อ่านจาก environment variable เท่านั้น ห้าม hardcode URL, port, credential
- **ลำดับความสำคัญของ config ฝั่ง backend:** environment variable จากภายนอก **ชนะ** `backend/.env` เสมอ
  เพราะบน Render ค่ามาจาก `render.yaml` ไม่ใช่จากไฟล์ — `.env` มีไว้ใช้บนเครื่องตัวเองเท่านั้น
- **CORS:** ระบุ origin เป็นรายตัวใน `CORS_ORIGINS` ห้ามใช้ `*`
- **ตัวแปร `VITE_*`** เป็น build-time — เปลี่ยนค่าแล้วต้อง build ใหม่ ไม่ใช่แค่ restart

## Rules for agents

1. **ห้ามแก้ test เพื่อให้ผ่าน** — ถ้า test แดง ให้แก้ code ไม่ใช่แก้ test
   จะเปลี่ยน test ได้ก็ต่อเมื่อ requirement เปลี่ยนจริง และต้องบอกเหตุผลก่อน
2. **ห้าม commit `.env` หรือ secret ใด ๆ** — ใส่ชื่อ key ไว้ใน `.env.example` เท่านั้น
   ถ้าเผลอ commit key ไปแล้ว ให้ revoke key นั้นทันที การลบ commit ไม่ช่วย
3. **ห้ามส่ง secret เข้า AI tool** ไม่ว่ากรณีใด
4. **ถ้าอธิบายไม่ได้ ห้าม commit** — ทุกบรรทัดที่เข้า repo ต้องมีคนในกลุ่มอธิบายได้
   ถ้า agent สร้างอะไรที่ไม่มีใครเข้าใจ ให้ลบทิ้งหรือถามจนเข้าใจก่อน
5. **ห้ามเพิ่ม dependency โดยไม่ถาม** — บอกก่อนว่าจะเพิ่มอะไรและเพราะอะไร
6. **ห้ามเปลี่ยน stack** ที่บันทึกไว้ใน `memory-bank/standards/tech-stack.md` โดยไม่เขียน ADR
7. **แก้ทีละนิดแล้วตรวจ** — อย่าแก้ยาว 100 บรรทัดแล้วค่อยรัน ต้องรู้เร็วว่าพังตรงไหน
8. **Verify ก่อนบอกว่าเสร็จ** — ต้องรันคำสั่งจริงและเห็นผลจริง ห้ามเดาว่าน่าจะผ่าน
