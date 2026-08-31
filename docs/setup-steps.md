# Environment Loop — จำนวนขั้นตอนกว่าจะรัน project ได้

> ตัวเลขในหน้านี้คือ **latency ของ Environment Loop**: เวลาตั้งแต่คนใหม่ได้ repo
> จนถึงตอนที่เขาเห็นหน้าเว็บทำงานบนเครื่องตัวเอง
> ยิ่งสูง ยิ่งมีคนติดตั้งไม่สำเร็จและเสียเวลาของทั้งกลุ่มไปกับการแก้ environment แทนการเขียน code

**วิธีวัด:** copy working tree ไปไว้อีก directory หนึ่ง (เหมือนคนใหม่ที่เพิ่ง clone)
แล้วจับเวลาแต่ละคำสั่งจริง ไม่ได้ประมาณเอา
เครื่องที่วัด: Windows 11, Docker Desktop 29.7.2 (WSL2), Compose v5.4.0, วันที่วัด 2026-08-31
เวลาที่รายงานเป็น **เวลาของคำสั่ง** ไม่รวมเวลาที่คนต้องอ่านคู่มือและพิมพ์ค่าลงไฟล์

---

## Before (WS-05) — ติดตั้งบนเครื่องตรง ๆ ตาม README

| # | ขั้นตอน | ประเภท | เวลาที่วัดได้ |
|---|---|---|---|
| 1 | ติดตั้ง Node 24 | ติดตั้งเครื่องมือ | — (ครั้งเดียวต่อเครื่อง) |
| 2 | ติดตั้ง Python 3.12 | ติดตั้งเครื่องมือ | — (ครั้งเดียวต่อเครื่อง) |
| 3 | ติดตั้ง Docker Desktop (ยังต้องใช้สำหรับ Postgres อยู่ดี) | ติดตั้งเครื่องมือ | — (ครั้งเดียวต่อเครื่อง) |
| 4 | `docker compose up -d db` | คำสั่ง | ~5s |
| 5 | `cd backend && python -m venv .venv` | คำสั่ง | **7s** |
| 6 | `pip install -r requirements-dev.txt` | คำสั่ง | **37s** |
| 7 | `cp .env.example .env` | คำสั่ง | <1s |
| 8 | สร้าง `SESSION_SECRET` แล้วเติมลง `.env` | **แก้ไฟล์ด้วยมือ** | ขึ้นกับคน |
| 9 | เติม `DATABASE_URL` ลง `.env` | **แก้ไฟล์ด้วยมือ** | ขึ้นกับคน |
| 10 | `python -m app.migrate` | คำสั่ง | <1s |
| 11 | `uvicorn app.main:app --reload` (terminal ที่ 1 ค้างไว้) | คำสั่ง | ~3s |
| 12 | `cd frontend && npm ci` | คำสั่ง | **3s** (npm cache อุ่นแล้ว · เครื่องใหม่จะนานกว่านี้) |
| 13 | `cp .env.example .env` | คำสั่ง | <1s |
| 14 | เติม `VITE_API_BASE_URL` และ `VITE_GOOGLE_CLIENT_ID` | **แก้ไฟล์ด้วยมือ** | ขึ้นกับคน |
| 15 | `npm run dev` (terminal ที่ 2) | คำสั่ง | ~2s |

**รวม 15 ขั้นตอน · 3 terminal · เวลาของคำสั่งล้วน ~58 วินาที**

ตัวเลข 58 วินาทีไม่ใช่ต้นทุนจริง — **ต้นทุนจริงอยู่ที่ขั้นตอนที่ 8, 9 และ 14**
ซึ่งเป็นการแก้ไฟล์ด้วยมือ 4 ค่าใน 2 ไฟล์ และเป็นจุดที่คนใหม่พลาดบ่อยที่สุด
ทั้งสามข้อนี้ไม่ได้เขียนเป็นขั้นตอนแยกใน README ด้วยซ้ำ — เราเจอมันตอนวัดจริง เพราะ:

```
# ข้าม SESSION_SECRET: backend ไม่ยอมเริ่มทำงานเลย
RuntimeError: SESSION_SECRET สั้นเกินไป (0 bytes) ต้องยาวอย่างน้อย 32 bytes ตาม RFC 7518 §3.2

# ข้าม DATABASE_URL: migrate ไปต่อไม่ได้
psycopg.OperationalError: connection to server at "localhost", port 5432 failed: fe_sendauth: no password supplied
```

นี่คือเหตุผลที่ `cp .env.example .env` ไม่เคยเป็น "1 ขั้นตอน" จริง ๆ

---

## After — `docker compose up`

```bash
docker compose up
```

**รวม 1 ขั้นตอน · 1 terminal · ไม่ต้องลง Node, Python หรือ Postgres บนเครื่อง**
(เหลือ prerequisite เดียวคือ Docker Desktop) และไม่ต้องแก้ไฟล์ `.env` ด้วยมือเลย
เพราะค่า dev ทุกตัวเขียนเป็น `${VAR:-default}` ไว้ใน `compose.yaml` แล้ว

| สถานการณ์ | เวลาที่วัดได้ (จนหน้าเว็บตอบ HTTP 200) |
|---|---|
| ครั้งแรกบนเครื่องใหม่ (`build --no-cache` + `up`) | **36 วินาที** |
| ครั้งถัดไป (image พร้อมแล้ว, volume ใหม่) | **11 วินาที** |
| เปิดใหม่หลัง `docker compose stop` (ข้อมูลเดิมยังอยู่) | **10 วินาที** |

> เวลา 36 วินาทีไม่รวมเวลาดาวน์โหลด base image ครั้งแรก
> (`python:3.12-slim`, `node:24-alpine`, `nginx:1.29-alpine`, `postgres:17-alpine`)
> ซึ่งบนเครื่องที่ยังไม่มี image เลยจะเพิ่มอีกไม่กี่นาทีตามความเร็วเน็ต

**15 ขั้นตอน → 1 ขั้นตอน · 3 terminal → 1 terminal · แก้ไฟล์ด้วยมือ 4 ค่า → 0 ค่า**

---

## Test loop ก็ย่อลงด้วย

| | Before | After |
|---|---|---|
| unit test ฝั่ง backend | ต้องมี venv + dependency ครบก่อน | `docker compose -f compose.test.yaml up unit-api --abort-on-container-exit --exit-code-from unit-api` |
| unit test ฝั่ง frontend | ต้อง `npm ci` ก่อน | `docker compose -f compose.test.yaml up unit-web --abort-on-container-exit --exit-code-from unit-web` |
| integration test | ต้องยก Postgres และตั้ง `DATABASE_URL` เอง | `... up integration-api ...` (compose ยก DB แบบ ephemeral ให้) |
| E2E | ต้องมีทั้ง venv, node_modules, Postgres, และ browser ของ Playwright | `docker compose -f compose.test.yaml --profile e2e up e2e --abort-on-container-exit --exit-code-from e2e` |

test database เป็น **ephemeral** (`tmpfs` — อยู่ใน RAM ไม่มี volume ถาวร)
ข้อมูลจึงหายทุกครั้งที่ container ตาย ผลของการรันรอบนี้จึงไม่ถูกรอบก่อนหน้ากวน

---

## สิ่งที่ยังต้องทำด้วยมืออยู่

| เรื่อง | ทำไมยังอัตโนมัติไม่ได้ |
|---|---|
| ติดตั้ง Docker Desktop | เป็น prerequisite ระดับเครื่อง |
| ปุ่ม Sign in with Google บน origin ใหม่ | ต้องเพิ่ม origin ใน Google Cloud Console — เป็นการตั้งค่าฝั่ง Google ไม่ใช่ใน repo |
| พอร์ตบนเครื่องชนกับโปรแกรมอื่น | ตั้ง `WEB_PORT`, `API_PORT`, `DB_PORT` ทับได้ เช่น `WEB_PORT=5174 CORS_ORIGINS=http://localhost:5174 docker compose up` |
