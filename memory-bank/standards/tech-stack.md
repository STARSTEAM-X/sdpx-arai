# Tech Stack

บันทึกการตัดสินใจเรื่องเครื่องมือของ PairEval — **เปลี่ยนได้ แต่ต้องเขียน ADR ก่อน** (WS-08)

## Decision Summary

| ด้าน | เลือก | เหตุผลสั้น ๆ |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind v4 | Vite build เร็ว · Tailwind v4 เป็น Vite plugin ไม่ต้องมี config file |
| Backend | FastAPI (Python 3.12) | PRD ต้องการ REST JSON · Pairing/Scoring Engine ต้องมี property-based test ซึ่ง Python ทำได้ดีที่สุด |
| Database | PostgreSQL | ระบุไว้ใน PRD §6 — **ยังไม่สร้างจนถึง WS-03** |
| Deployment | Render (Blueprint `render.yaml`) | สมัครที่เดียว · infra เป็น code อยู่ใน git ตรวจผ่าน review ได้ |

## Frontend

- **Framework:** React 19.2
- **Build tool:** Vite 8.2
- **ภาษา:** TypeScript 7
- **CSS:** Tailwind CSS 4.3 ผ่าน `@tailwindcss/vite`
  - ไม่มี `tailwind.config.js` และไม่มี `postcss.config.js` — v4 ไม่ต้องใช้แล้ว
  - `src/index.css` มีแค่ `@import "tailwindcss";`
- **Node:** 24 (pin ที่ `frontend/.node-version`)
- **Env:** `VITE_API_BASE_URL` — build-time เปลี่ยนแล้วต้อง build ใหม่

## Backend

- **Framework:** FastAPI 0.141
- **Server:** Uvicorn 0.52
- **Python:** 3.12 (pin ที่ `backend/.python-version`)
- **Config:** อ่านจาก environment variable ผ่าน `app/config.py` ด้วย `os.getenv` ตรง ๆ
  ยังไม่ใช้ pydantic-settings เพราะตอนนี้มีค่าแค่ 2 ตัว — ถ้าโตขึ้นค่อยย้ายแล้วเขียน ADR
- **Endpoint ที่มีตอนนี้:** `GET /api/health` เท่านั้น

## Database

**ยังไม่สร้างใน WS-01 โดยตั้งใจ** — Render free Postgres หมดอายุใน 30 วัน
และ WS-01/WS-02 ยังไม่ใช้ DB เลย (WS-02 เป็นเอกสารล้วน)

จะสร้างตอน **WS-03** โดยปลดคอมเมนต์ส่วน `databases:` ใน `render.yaml`

## Deployment

- **Platform:** Render
- **Config:** `render.yaml` ที่ root ของ repo
- **Branch ที่ deploy:** `develop` → staging (auto-deploy ทุก push ไม่ต้องกดปุ่ม)
- **Services:**

| Service | Type | rootDir | Health check |
|---|---|---|---|
| `paireval-web` | static site | `frontend` | — |
| `paireval-api` | python web service | `backend` | `/api/health` |

- **Staging URL (frontend):** _(กรอกหลัง deploy ครั้งแรก)_
- **Staging URL (backend):** _(กรอกหลัง deploy ครั้งแรก)_
- **Commit-to-live time:** _(ยังไม่ได้วัด — วัดหลัง deploy ครั้งแรกสำเร็จ)_

### วิธีวัด commit-to-live

`GET /api/health` คืน `version` เป็น 7 ตัวแรกของ commit SHA (Render ใส่ `RENDER_GIT_COMMIT` ให้เอง)
จึงดูได้แน่นอนว่า commit ไหนขึ้นแล้ว ไม่ต้องเดาจากข้อความบนหน้าเว็บ

```bash
git commit -m "feat: update landing headline"
git push origin develop        # ← เริ่มจับเวลา
# poll จนกว่า version จะเปลี่ยนเป็น SHA ใหม่:
#   curl -s https://<api-url>/api/health
# เห็น SHA ใหม่เมื่อไร → หยุดจับเวลา
```

### ข้อจำกัดที่รู้แล้ว

Render free tier ทำให้ service **sleep เมื่อไม่มี traffic** — request แรกหลังหลับจะช้าหลายวินาที
จุดนี้จะกระทบตัวเลข p95 ใน WS-07 ต้องบันทึกไว้ในรายงานว่าเป็น known limitation ไม่ใช่ bug ของ code

## AI Tools

- **Agent:** Claude Code
- **กติกา:** AI เสนอ — คนตัดสิน · ทุก artifact ที่ AI สร้างต้องมีคนในกลุ่มอธิบายได้
- **ข้อบังคับสำหรับ agent:** ดู `AGENTS.md` section *Rules for agents*
