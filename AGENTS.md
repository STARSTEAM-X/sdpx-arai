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
```

### Backend (`backend/`)

```bash
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # macOS / Linux

./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
# ตรวจ: http://localhost:8000/api/health  ต้องได้ {"status":"ok",...}
```

### Test

ยังไม่มี test ใน WS-01 — จะเริ่มติดตั้ง framework ใน WS-02 และเขียนจริงใน WS-03
เมื่อเพิ่มแล้วต้องกลับมาแก้ section นี้ให้ชี้คำสั่งที่รันได้จริง

## Conventions

- **Commit message:** Conventional Commits — `feat:` `fix:` `docs:` `chore:` `refactor:` `test:`
- **Branch:** `main` = production · `develop` = staging (auto-deploy) · งานใหม่แตกจาก `develop`
- **ภาษา UI:** ไทย (ตาม NFR-I18N-01 ใน PRD)
- **Config:** อ่านจาก environment variable เท่านั้น ห้าม hardcode URL, port, credential
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
