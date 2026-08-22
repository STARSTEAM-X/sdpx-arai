# WS-01 — PairEval First Deploy (Design)

| Field | Value |
|---|---|
| Date | 2026-08-23 |
| Workshop | WS-01 — First Deploy + Loop Engineering |
| Loop ที่ปิด | **Deploy Loop** — `commit → build → deploy → เห็นของจริงบน URL` |
| Status | Approved |

## 1. Context

WS-01 ของวิชา SDPX-AI ไม่ได้วัดว่า app ทำอะไรได้ แต่วัดว่า **ท่อ deploy ปิดครบวงหรือยัง**
และ **รู้เร็วแค่ไหนว่าของที่ push ไปขึ้นจริงแล้ว** (commit-to-live time)

Domain ที่เลือกคือ **PairEval** ตาม `Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md` —
ระบบประเมินนักศึกษาแบบ pairwise comparison

## 2. Decisions

| # | Decision | เหตุผล | ทางเลือกที่ไม่เลือก |
|---|---|---|---|
| D1 | **FastAPI + Vite React + Tailwind + PostgreSQL** | PRD ต้องการ REST JSON API + PostgreSQL · หัวใจของระบบคือ Pairing/Scoring Engine ที่ต้องมี property-based test (NFR-MAINT-02) ซึ่ง Python + Hypothesis ทำได้ดีที่สุด · แยก FE/BE ชัดตาม convention ของวิชา | Next.js fullstack (deploy ง่ายกว่า แต่เส้นแบ่ง FE/BE จาง) |
| D2 | **โครงสร้าง `frontend/` + `backend/` ที่ระดับบนของ repo** | ตรงกับ convention ที่บันทึกไว้ใน `summary.md` · อ่านง่ายที่สุดสำหรับกลุ่มที่เพิ่งเริ่ม | monorepo `apps/web` + `apps/api` |
| D3 | **Render ทั้งหมด ผ่าน `render.yaml` (Blueprint)** | สมัครที่เดียว · config เป็น Infrastructure as Code อยู่ใน git ตรวจ review ได้ | Vercel + Render + Neon (3 บัญชี) |
| D4 | **ยังไม่สร้าง PostgreSQL ใน WS-01 — เลื่อนไป WS-03** | Render free Postgres หมดอายุใน 30 วัน · WS-01 และ WS-02 ไม่ใช้ DB เลย (WS-02 เป็นเอกสารล้วน) · สร้างวันนี้จะหมดอายุกลางคอร์ส | สร้างพร้อมกันทั้งหมดตั้งแต่แรก |
| D5 | **Landing page เรียก `GET /api/health` แล้วแสดงผล** | ทำให้เห็นด้วยตาว่า **ทั้งสอง service** deploy ขึ้นจริงและคุยกันได้ ไม่ใช่แค่หน้า static ที่ไม่พิสูจน์อะไรฝั่ง backend | landing page static ล้วนตามตัวอย่างใน lab |
| D6 | **`branch: develop` + auto-deploy** | เกณฑ์ผ่านของ lab บังคับว่า push แล้วต้อง deploy เอง ไม่ต้องกดปุ่ม | deploy จาก `main` |

## 3. Scope

**ทำใน WS-01:**

- Landing page: ชื่อระบบ, nav, placeholder ของ feature หลัก, `data-testid`, สถานะการเชื่อมต่อ API
- `GET /api/health` ตอบ `{"status":"ok","version":"..."}`
- `render.yaml` 2 service + auto-deploy จาก `develop`
- `AGENTS.md`, `memory-bank/standards/tech-stack.md`, `.gitignore`, `.env.example` ทั้งสองฝั่ง
- วัดและบันทึก commit-to-live time

**ไม่ทำ (และเริ่มที่ WS ไหน):**

| ไม่ทำ | เริ่มที่ |
|---|---|
| Database + migration | WS-03 (สร้าง Render Postgres ตอนนั้น) |
| Auth / OIDC / Google OAuth | หลัง WS-02 กำหนด spec |
| Feature ใด ๆ (pairing, scoring, report) | WS-03 เป็นต้นไป |
| Test | WS-02 (ติดตั้ง) / WS-03 (เขียนจริง) |
| Dockerfile, compose | WS-05 |
| CI pipeline | WS-05--before → WS-06 |

## 4. Architecture (WS-01 เท่านั้น)

```
Browser
   │
   ├──────────────► paireval-web   (Render Static Site)
   │                 Vite build → dist/
   │                 rootDir: frontend/
   │
   └── fetch ──────► paireval-api  (Render Web Service, python)
                      uvicorn app.main:app
                      rootDir: backend/
                      GET /api/health
```

- FE รู้จัก BE ผ่าน `VITE_API_BASE_URL` (build-time env ของ Vite)
- BE เปิด CORS ให้เฉพาะ origin ที่ระบุใน `CORS_ORIGINS` — ไม่ใช้ `*`
- ทั้งสองค่าเป็น `sync: false` ใน `render.yaml` → Render ถามตอน apply และกรอกจริงหลัง service แรกขึ้น

## 5. Repo structure

```
sdpx-arai2/
├── AGENTS.md                       context ที่ AI agent อ่านทุกครั้ง + ประกาศ path FE/BE
├── README.md
├── .gitignore
├── render.yaml                     Blueprint: paireval-web + paireval-api
├── docs/superpowers/specs/         design docs
├── memory-bank/
│   ├── standards/tech-stack.md
│   └── units/                      ว่างไว้ — WS-02 มาเติม unit-brief
├── frontend/                       Vite + React + TS + Tailwind v4
│   ├── src/{main.tsx, App.tsx, index.css}
│   ├── vite.config.ts              react() + tailwindcss()
│   └── .env.example                VITE_API_BASE_URL
├── backend/                        FastAPI
│   ├── app/{main.py, config.py}
│   ├── requirements.txt
│   └── .env.example                CORS_ORIGINS, DATABASE_URL (comment ไว้ก่อน)
└── Sources/                        เอกสารวิชา (MIT) — เก็บไว้เป็น context ให้ AI
```

## 6. Tailwind

Tailwind v4 ติดตั้งเป็น **Vite plugin** ไม่ใช่ PostCSS อีกต่อไป:

- `npm install tailwindcss @tailwindcss/vite`
- `vite.config.ts` → `plugins: [react(), tailwindcss()]`
- `src/index.css` → `@import "tailwindcss";`
- **ไม่มี** `tailwind.config.js` และ **ไม่มี** `postcss.config.js`

(ยืนยันกับ docs ของ Tailwind แล้ว ไม่ได้เขียนจากความจำ)

## 7. Git flow

| Branch | บทบาท | Deploy |
|---|---|---|
| `main` | production | ยังไม่ต่อใน WS-01 |
| `develop` | staging | auto-deploy ทุก push |

WS-01 ทำงานบน `develop` ทั้งหมด

## 8. Verification (ก่อนบอกว่าเสร็จ)

- [ ] `frontend`: `npm run build` ผ่าน ได้ `dist/`
- [ ] `backend`: `uvicorn` ขึ้นได้ และ `GET /api/health` ตอบ 200
- [ ] Landing page แสดงสถานะ API ที่ได้จาก `/api/health` จริง
- [ ] `git status` สะอาด ไม่มี `.env` หลุด
- [ ] Live URL เปิดได้จาก browser
- [ ] push `develop` แล้ว deploy เองโดยไม่ต้องกดปุ่ม
- [ ] จด commit-to-live time ลง `tech-stack.md`

## 9. สิ่งที่ต้องให้คนทำเอง (agent ทำแทนไม่ได้)

1. สมัคร / login Render
2. Render Dashboard → New → Blueprint → เลือก repo → Apply
3. กรอกค่า `VITE_API_BASE_URL` และ `CORS_ORIGINS` หลัง service แรกขึ้น
4. เปิด Live URL จับเวลา commit-to-live รอบจริง

## 10. Risks

| ความเสี่ยง | ผลกระทบ | การรับมือ |
|---|---|---|
| Render free tier ทำให้ service sleep เมื่อไม่มี traffic | request แรกช้าหลายวินาที → กระทบตัวเลข p95 ใน WS-07 | บันทึกไว้ตั้งแต่ตอนนี้ว่าเป็น known limitation แล้วอธิบายใน performance report |
| ชื่อ service `paireval-*` ชนกับคนอื่นบน Render | URL จริงจะไม่ตรงกับที่คาด | ใช้ `sync: false` ให้กรอก URL จริงทีหลัง ไม่ hardcode |
| `VITE_*` เป็น build-time env | เปลี่ยนค่าแล้วต้อง rebuild ไม่ใช่แค่ restart | เขียนกำกับไว้ใน `AGENTS.md` |
