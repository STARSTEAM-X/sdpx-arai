# SDPX-AI — สรุปงานและผลลัพธ์ของแต่ละ Workshop

> สรุปจาก `Sources/SDPX-AI-main` — วิชา **Software Development Process in Practice (AI-Assisted)**
> แนวคิดหลักคือ **Loop Engineering**: ออกแบบวงจร feedback ให้ *สั้น เชื่อถือได้ รันซ้ำได้*
> `Context → Plan → Act → Verify → Feedback` โดยวัดกันที่ **Latency / Fidelity / Coverage**

โครงสร้างของทุก workshop เหมือนกัน และ **ห้ามสลับลำดับ**:

```
self-learning ──→ homework ──→ lecture ──→ lab ──→ present
   อ่าน/ดู        ทำของจริง     อธิบายจุด    ใช้ของที่     อธิบายและ
   มาก่อน         มาก่อน        ที่ยังติด     เตรียมมา     ป้องกันงาน
```

---

## ภาพรวม: แต่ละ WS ได้อะไรออกมา

| WS | สัปดาห์ | หัวข้อ | Loop ที่ได้ | ผลลัพธ์แก่นกลาง |
|:---|:---|:---|:---|:---|
| **WS-01** | 3 | First Deploy | Deploy Loop | Repo กลุ่ม + app ที่ deploy แล้วบน public URL + `AGENTS.md` + ตัวเลข commit-to-live |
| **WS-02** | 4 | Requirements & API Design | Spec Loop | Backlog ≥ 8 stories, diagrams, `openapi.yaml` ที่ validate ผ่าน, memory-bank |
| **WS-03** | 7 | Unit Testing | Unit Test Loop | Unit test harness (fake/factory/fixture) ที่รันจบ < 10 วิ + ผล fidelity check |
| **WS-04** | 8 | E2E Testing | Acceptance Loop | E2E harness (page object + seed fixture) ที่รันซ้ำ 3 รอบไม่ flaky |
| **WS-05** | 10 | Docker | Environment Loop | `Dockerfile` + compose ที่ทำให้ setup เหลือคำสั่งเดียว + test env ที่ exit code เชื่อถือได้ |
| **WS-06** | 12 | CI/CD | Integration Loop | Pipeline เต็ม + branch protection ที่พิสูจน์แล้วว่าบล็อก merge ได้จริง |
| **WS-07** | 13 | Performance | Production Loop | k6 load test + performance report + structured logging + performance gate ใน CI |
| **WS-08** | 14 | Code Quality & Security | Quality Loop | Refactor ที่ test ไม่ถูกแตะ + ปิดช่องโหว่ ≥ 2 ข้อ + ADR |

---

## การแบ่ง Frontend / Backend

project ของกลุ่มมี 2 ฝั่งเสมอ — artifact แต่ละชิ้นจึงต้องรู้ว่าตัวเองอยู่ **ระดับ root (ใช้ร่วมกัน)**,
**ฝั่ง frontend** หรือ **ฝั่ง backend** และ path จริงขึ้นกับ stack ที่กลุ่มเลือกใน WS-01

### รูปแบบ path ที่พบบ่อย (เลือก 1 แบบแล้วใช้ตลอดวิชา)

| รูปแบบ | frontend path | backend path | เหมาะกับ |
|:---|:---|:---|:---|
| **Monorepo** (แนะนำ) | `apps/web/` | `apps/api/` | React/Vue + FastAPI/Express — แยกชัด CI ทำ path filter ได้ |
| **โฟลเดอร์ระดับบน** | `frontend/` | `backend/` | เข้าใจง่ายที่สุด เหมาะกับกลุ่มที่เพิ่งเริ่ม |
| **Fullstack framework** | `app/`, `components/` | `app/api/`, `server/` | Next.js / SvelteKit — **มี Dockerfile เดียว** |
| **แยก repo** | repo `*-web` | repo `*-api` | ไม่แนะนำในวิชานี้ (loop metric วัดยาก, CI ต้องทำ 2 ชุด) |

> ตั้งชื่อ path แล้ว **ประกาศไว้ที่เดียว** ใน `AGENTS.md` section Setup & Commands
> ทุกที่ที่เหลือให้อ้างอิงจากตรงนั้น — `compose.yaml` (`build.context`), `ci.yml`
> (`working-directory` / `paths` filter), `playwright.config.ts` (`webServer`), `openapi.yaml` (`servers`)

### artifact ชิ้นไหนอยู่ฝั่งไหน

| ระดับ | Artifact | เหตุผล |
|:---|:---|:---|
| **root** | `AGENTS.md`, `memory-bank/`, `docs/`, `openapi.yaml`, `compose*.yaml`, `ci.yml`, `.gitignore` | เป็น context และสัญญาที่ทั้งสองฝั่งใช้ร่วมกัน |
| **root** | `e2e/`, `performance/` | ทดสอบระบบที่ประกอบเสร็จแล้ว ไม่เป็นของฝั่งใดฝั่งหนึ่ง |
| **แยกทั้งสองฝั่ง** | `tests/unit/`, `TEST_PLAN.md`, `Dockerfile`, `.dockerignore`, `.env.example` | คนละ runtime คนละ dependency คนละ test runner |
| **backend เท่านั้น** | `/api/health`, `/api/test/seed`, structured logging | เป็น endpoint และ log ของ service |
| **frontend เท่านั้น** | `docs/wireframes/`, semantic role + `data-testid` | เป็นเรื่องของ UI |

---

## ตัว Product ต้องใช้งานได้ถึงไหนในแต่ละ WS

> ส่วนนี้ **สรุปจากเงื่อนไขของ lab** ไม่ใช่หัวข้อที่เขียนไว้ตรง ๆ ในต้นฉบับ —
> แต่เป็นสิ่งที่ *ถูกบังคับ* โดยกิจกรรมในคาบ เช่น จะทำ E2E ผ่าน browser จริงได้
> หน้าเว็บก็ต้องกดใช้งานได้จริงก่อน

| WS | Frontend ต้องทำได้ | Backend ต้องทำได้ | อะไรบังคับให้ต้องมี |
|:---|:---|:---|:---|
| **WS-01** | หน้าแรก render ได้บน public URL แก้ข้อความแล้วเห็นผลจริง | service ขึ้นได้และตอบ request ได้อย่างน้อย 1 route | ต้อง demo deploy loop สด |
| **WS-02** | *(ไม่ต้องเพิ่ม feature)* | *(ไม่ต้องเพิ่ม feature)* แต่ **ล็อก data model + contract** แล้ว | WS-03 จะ implement ตาม spec นี้ |
| **WS-03** | หน้าเว็บเปิดได้จริงและมี element ที่ assert ได้ | **มี service layer ที่มี business rule จริง ≥ 1 ข้อ** + repository ที่สลับ fake ได้ | fidelity check ต้อง comment กฎแล้ว test แดง |
| **WS-04** | ★ **User Journey หลักใช้งานได้ครบจาก browser จริง** — ทุกหน้าในเส้นทางเปิดได้, form submit ได้, มี success/error state ที่มองเห็น | endpoint ที่ journey เรียกต้องทำงานกับ DB จริง + seed/cleanup endpoint | Playwright ขับ browser จริง — UI เปล่าไม่พอ |
| **WS-05** | build เป็น production artifact ได้ ไม่ผูกกับเครื่อง dev | ต่อ DB ผ่าน service name, config ผ่าน env var ทั้งหมด, migration รันเองตอน container ขึ้น | `docker compose up` ต้องรันได้ทุกเครื่อง |
| **WS-06** | E2E รัน headless บน CI ได้ | deploy ขึ้น **staging จริง** ได้เองจาก pipeline | pipeline มี job deploy staging + E2E |
| **WS-07** | *(ไม่ต้องเพิ่ม feature)* | รับ concurrent traffic ได้โดยไม่ล้ม + `/api/health` + log JSON ทุก request | k6 ยิง realistic journey ใส่ staging |
| **WS-08** | ยังใช้งานได้เหมือนเดิมหลัง refactor | มี module ที่โตพอจะ refactor + ปิดช่องโหว่จริงได้ | E2E/unit ต้องยืนยันว่าพฤติกรรมไม่เปลี่ยน |

**เส้นแบ่งสำคัญคือ WS-03 → WS-04:**

```
WS-03  หน้าเว็บ "เปิดได้"          → smoke test แค่ยืนยันว่าหน้าขึ้น
WS-04  หน้าเว็บ "ใช้งานได้จริง"    → กรอกฟอร์ม กดปุ่ม เห็นผลลัพธ์ เห็น error
       ────────────────────────────────────────────────────────────
       ถ้า journey ยังกดใช้ไม่ได้ → เขียน feature test ไม่ได้เลย
       และจะไม่มีอะไรให้ Page Object ห่อ
```

---

## WS-01 — First Deploy + Loop Engineering

**Loop ที่ได้: Deploy Loop** — `commit → build → deploy → เห็นของจริงบน URL`

### ก่อนเข้าห้อง

| หมวด | สิ่งที่ต้องทำ |
|:---|:---|
| self-learning | ติดตั้ง tools ครบ, เตรียม AI coding agent ที่ **รันคำสั่งเองได้** อย่างน้อย 1 ตัว, สร้าง accounts, ศึกษา Git/GitHub |
| homework | screenshot version ของ `node` `python` `docker` `docker compose` `git` |
| homework | สร้าง GitHub account (username แบบมืออาชีพ) |
| homework | สร้าง repo แรกของตัวเอง + commit แรก |
| homework | ให้ AI agent เขียน `fizzbuzz.py` + `test_fizzbuzz.py` แล้ววนแก้จน test เขียว |
| homework | จดผลลง `LOOP_NOTES.md`: AI วนกี่รอบ / รอบไหนแก้ถูกทันที / ถ้าไม่มี test ผลจะต่างอย่างไร |

**เช็คตัวเอง:** อธิบายความต่าง `commit` กับ `push` ได้ • บอกได้ว่า pull request มีไว้ทำอะไร • ตอบได้ว่า "ครั้งล่าสุดที่เขียนผิด กว่าจะรู้ใช้เวลานานแค่ไหน"

### ในห้อง (Lab 1 ชม.)

1. เลือก domain และ stack (10 น.)
2. สร้าง repo กลุ่ม `sdpx-[groupname]` + branch `develop` (10 น.)
3. เขียน context ให้ AI: `AGENTS.md` + `memory-bank/standards/tech-stack.md` (15 น.)
4. Scaffold ด้วย AI แล้ว deploy จริง + ตั้ง `.gitignore` / `.env.example` (20 น.)
5. **วัด Deploy Loop**: แก้ข้อความ 1 บรรทัด → commit → push → จับเวลาจนเห็นบน URL (5 น.)

### 🧩 ตัว product ต้องใช้งานได้ถึงไหน

- **FE:** หน้าแรกที่ deploy แล้วเปิดได้จาก browser ของทุกคน และ **แก้ข้อความ 1 บรรทัดแล้วเห็นผลบน URL จริง**
- **BE:** service start ได้และตอบ request ได้อย่างน้อย 1 route (ถ้ายังไม่ได้ deploy แยก อย่างน้อยต้องรัน local ได้)
- **ยังไม่ต้องมี:** feature, database, auth — สัปดาห์นี้วัดที่ *ท่อ deploy* ไม่ใช่ความสามารถของ app

### 📦 ผลลัพธ์ที่ต้องได้

| Artifact | รายละเอียด | ส่งที่ |
|:---|:---|:---|
| GitHub Repository URL | public repo ของกลุ่ม | LMS |
| Live URL | app ที่ deploy แล้ว | LMS |
| `AGENTS.md` | ครบทุก section รวม **Rules for agents** | repo |
| `memory-bank/standards/tech-stack.md` | ครบทุก section + **commit-to-live time** | repo |
| `.env.example` | ชื่อ key อย่างเดียว ไม่มีค่า — **ฝั่งละ 1 ไฟล์** (`frontend/`, `backend/`) | repo |
| `.gitignore` | ครอบคลุม | repo (root) |

> **หมายเหตุ FE/BE:** ตอนเลือก stack ต้องตกลง path ของทั้งสองฝั่งแล้วเขียนลง `AGENTS.md` และ `tech-stack.md`
> ถ้า deploy แยกเป็น 2 service ให้จด commit-to-live **ของทั้งสองฝั่ง** เพราะมักไม่เท่ากัน

### ✅ เกณฑ์ผ่าน

- [ ] Live URL เปิดได้จาก browser ของทุกคน
- [ ] ทุกคน clone และ run local ได้เอง
- [ ] push เข้า `develop` แล้ว deploy อัตโนมัติ (ไม่ต้องกดปุ่ม)
- [ ] จด commit-to-live time ไว้แล้ว
- [ ] `AGENTS.md` มีข้อ "ห้ามแก้ test เพื่อให้ผ่าน"
- [ ] ไม่มี `.env` หรือ secret ใน repo

### 🎤 Present (10 น./กลุ่ม)

Demo live URL → repo structure → **demo deploy loop สด** → อธิบาย domain/stack/เวลา loop
**Rubric:** Live URL ทำงานได้ · Deploy Loop · Repo & Context · Domain Clarity · AI Usage

---

## WS-02 — Requirements & API Design

**Loop ที่ได้: Spec Loop** — `intent → story → API contract → review`

### ก่อนเข้าห้อง

| หมวด | สิ่งที่ต้องทำ |
|:---|:---|
| self-learning | REST API design (status code, POST vs PUT, 400/422/409), Scrum & user stories, spec ในฐานะ context ของ AI |
| homework | ติดตั้ง pytest หรือ Vitest แล้วรัน sample test ให้เห็น `1 passed` |
| homework | ยืนยันว่าคำสั่ง `test:` ใน `AGENTS.md` copy มารันแล้วใช้ได้จริง |
| homework | วาด component diagram ด้วย **Mermaid** ในไฟล์ `.md` แล้ว push ขึ้น GitHub |
| homework | เขียน **3 คำถาม** ที่ requirement ยังตอบไม่ได้ |

**เช็คตัวเอง:** เขียน user story แบบ As a / I want / So that ได้ • เขียน AC แบบ Given / When / Then ได้

### ในห้อง (Lab 1.5 ชม.)

1. Product Backlog เป็น GitHub Issues — **user stories ≥ 8 items** พร้อม AC และ DoD, ใช้ AI หา edge case (ไม่ใช่ให้ AI เขียน story แทน) (25 น.)
2. Component Diagram + ER Diagram (20 น.)
3. `docs/openapi.yaml` แล้ว validate ด้วย `npx @redocly/cli lint` (35 น.)
4. Sprint Planning (10 น.)
5. เพิ่มเติม: AI-DLC inception artifacts — `memory-bank/intent.md` + unit briefs

### 🧩 ตัว product ต้องใช้งานได้ถึงไหน

- **ไม่ต้องเพิ่ม feature ใด ๆ** — สัปดาห์นี้ผลผลิตคือ *ข้อตกลง* ไม่ใช่ code
- แต่ต้อง **ล็อกสิ่งที่ WS-03/04 จะ implement ตาม**: data model (ERD), รายการ endpoint, AC ที่ตัดสิน pass/fail ได้
- เลือกไว้แล้วว่า **journey ไหนคือ journey หลัก** ที่จะกลายเป็น E2E ใน WS-04
- ถ้ากลุ่มพร้อม: สร้าง schema/migration ตาม ERD ไว้ก่อนได้ จะช่วยให้ WS-03 เริ่มเขียน service ได้ทันที

### 📦 ผลลัพธ์ที่ต้องได้

| Artifact | รายละเอียด |
|:---|:---|
| GitHub Issues | user stories **≥ 8** พร้อม acceptance criteria |
| `docs/architecture.md` | component diagram (Mermaid) |
| `docs/erd.md` | ER diagram |
| `docs/openapi.yaml` | OpenAPI spec **≥ 5 endpoints** validate ผ่าน |
| `memory-bank/intent.md` | intent statement, business context, success criteria, out of scope |
| `memory-bank/units/*/unit-brief.md` | **อย่างน้อย 2 units** |

### ✅ เกณฑ์ผ่าน

- [ ] User story ทุกอันมี AC ที่ตัดสิน pass/fail ได้
- [ ] OpenAPI spec validate ผ่านโดยไม่มี error
- [ ] ทุก endpoint สืบกลับไปหา story ได้ และทุก story มี endpoint
- [ ] ทุกคนอธิบาย endpoint ของตัวเองได้ รวม error case

### 🎤 Present

Demo backlog → อ่าน story + AC → อธิบาย diagram → validate spec สด
**Defend:** 1 endpoint (ทำไม POST ไม่ใช่ PUT / 409 ไม่ใช่ 400) + **1 ข้อที่ AI เสนอแล้วไม่รับ พร้อมเหตุผล**

---

## WS-03 — Unit Testing

**Loop ที่ได้: Unit Test Loop** — `red → green → refactor` (Unit Test Harness)

### ก่อนเข้าห้อง

| หมวด | สิ่งที่ต้องทำ |
|:---|:---|
| self-learning | TDD, AAA pattern, Test Doubles (Mock / Stub / Fake), ทำไม coverage 100% ยังไม่พอ |
| homework | ยืนยัน `pytest --version` / `npm test` ทำงาน |
| homework | Revise backlog ตาม feedback + วาด wireframe 3 หน้าหลัก ลง `docs/wireframes/` |
| homework | ติดตั้ง Playwright + `npx playwright install --with-deps chromium` |
| homework | จับเวลา test suite ปัจจุบัน — **latency ของ Unit Test Loop** |

### ในห้อง (Lab 1.5 ชม.)

**Part A — Unit Test Harness (60 น.)**

1. สร้างโครงสร้าง `tests/`
2. เขียน `TEST_PLAN.md` — business rule ที่ต้อง test + กฎที่ยังไม่มี test (ยอมรับชั่วคราว)
3. สร้าง Fake Repository
4. สร้าง Factories และ Fixtures
5. เขียน Unit Tests
6. **Fidelity Check (บังคับ)**: comment เงื่อนไข 1 บรรทัดใน service → รัน test → **ต้องมีอย่างน้อย 1 test แดง** → undo

**Part B — E2E ตัวแรก (30 น.)**

7. เขียน smoke test ด้วย Playwright + เพิ่ม `data-testid` ใน components

### 🧩 ตัว product ต้องใช้งานได้ถึงไหน

- **BE (แกนหลักของสัปดาห์นี้):** ต้องมี **service layer จริงที่มี business rule อย่างน้อย 1 ข้อ**
  เช่น กฎการจอง (จองซ้ำช่วงเวลาเดิมไม่ได้ / จองล่วงหน้าเกิน N วันไม่ได้)
  — เพราะ fidelity check บังคับให้ comment เงื่อนไขนั้นทิ้งแล้ว test ต้องแดง
- **BE:** business logic ต้องแยกจาก database ผ่าน repository ที่ **สลับเป็น fake ได้** (ถ้า logic ฝังใน controller/ORM จะเขียน unit test ไม่ได้)
- **FE:** หน้าเว็บต้อง **เปิดได้จริง** และมี element ที่ assert ได้ (heading / title) — ระดับ "หน้าขึ้น" พอ ยังไม่ต้องกดใช้งาน
- **ต้องยก FE + BE ขึ้นพร้อมกันบนเครื่อง dev ได้** ไม่งั้น smoke test รันไม่ได้

### 📦 ผลลัพธ์ที่ต้องได้

| Artifact | รายละเอียด |
|:---|:---|
| `backend/tests/` | unit tests + **fake repository** + factories + fixtures (แกนหลักของสัปดาห์นี้) |
| `frontend/tests/unit/` | component / logic tests + fake API client |
| `TEST_PLAN.md` | **ฝั่งละไฟล์** — business rule ที่ต้อง test + **ผล fidelity check** |
| `e2e/specs/smoke.spec.ts` | E2E smoke test ที่ผ่าน (ต้องยกทั้ง FE + BE ถึงจะรันได้) |
| `docs/coverage/frontend/`, `docs/coverage/backend/` | coverage report แยกฝั่ง (`pytest --cov` / `vitest run --coverage`) |

### ✅ เกณฑ์ผ่าน

- [ ] Unit tests ผ่านทั้งหมด และ **ทั้ง suite (FE + BE รวมกัน) ใช้เวลา < 10 วินาที**
- [ ] มี fake repository อย่างน้อย 1 ตัว
- [ ] มี factories หรือ fixtures อย่างน้อย 2 ตัว
- [ ] ทำ fidelity check และบันทึกผลใน `TEST_PLAN.md`
- [ ] E2E smoke test ผ่าน
- [ ] ทุกคนตอบได้ว่า *"ลบอะไรออกแล้วมันจะแดง"*

### 🎤 Present

รัน suite ให้เห็นเวลา → อธิบาย fake/factory → **Break it live** (comment business rule → test แดง → undo) → รัน E2E
\+ บอกว่า AI generate test มากี่ตัว **ทิ้งไปกี่ตัว เพราะอะไร**

---

## WS-04 — E2E Testing

**Loop ที่ได้: Acceptance Loop** — `user journey → E2E → report` (E2E Test Harness)

### ก่อนเข้าห้อง

| หมวด | สิ่งที่ต้องทำ |
|:---|:---|
| self-learning | Playwright, web-first assertion, สาเหตุ flaky test, Page Object Model, Docker (เตรียม WS-05) |
| homework | ติดตั้ง Docker Desktop + `docker run hello-world` + ทดสอบ postgres container |
| homework | ใส่ semantic HTML ให้ `getByRole` ใช้ได้ + `data-testid` **เฉพาะจุดที่ไม่มี role/label ที่เสถียร** |
| homework | ทำ `POST /api/test/seed` และ `POST /api/test/cleanup` **พร้อม guard ปิดใน production** |

### ในห้อง (Lab 1.5 ชม.)

1. โครงสร้าง + `playwright.config.ts` (15 น.)
2. Seed data และ fixtures (20 น.)
3. Page Objects (20 น.)
4. เขียน E2E tests: smoke + feature (happy path + edge cases) (30 น.)
5. รันซ้ำ 3 รอบเพื่อจับ flaky ตั้งแต่วันแรก

### 🧩 ตัว product ต้องใช้งานได้ถึงไหน — ★ สัปดาห์ที่ product ต้องกระโดดมากที่สุด

Playwright ขับ **browser จริง** กดตาม user จริง — UI ที่ยัง submit ไม่ได้ = เขียน feature test ไม่ได้เลย

**Frontend — User Journey หลักต้องใช้งานได้ครบทั้งเส้น:**

- [ ] ทุกหน้าในเส้นทางเปิดได้และ **navigate ระหว่างหน้าได้จริง** (ไม่ใช่หน้าเปล่า/404)
- [ ] form กรอกได้ + **submit แล้วเกิดผลจริง** ไม่ใช่ปุ่มที่ยังไม่ผูก handler
- [ ] มี **success state** ที่มองเห็นได้หลังทำสำเร็จ (ข้อความ / redirect / รายการที่เพิ่มขึ้น)
- [ ] มี **error state** ที่มองเห็นได้เมื่อทำผิดกติกา — เพราะ feature test ต้องมี edge case ไม่ใช่แค่ happy path
- [ ] list / detail แสดงข้อมูล **ที่มาจาก backend จริง** ไม่ใช่ข้อมูล hardcode ใน component
- [ ] มี semantic role + label ให้ `getByRole` / `getByLabel` เกาะ และ `data-testid` เฉพาะจุดที่ไม่มี role ที่เสถียร
- [ ] ถ้า journey ต้อง login — flow login ต้องใช้งานได้

**Backend:**

- [ ] endpoint ทุกตัวที่ journey เรียกทำงานจริง **กับ database จริง** (ไม่ใช่ mock/stub)
- [ ] business rule ที่จะทดสอบเป็น edge case **บังคับใช้จริงที่ฝั่ง server** และคืน error ที่ FE แสดงได้
- [ ] `POST /api/test/seed` และ `/cleanup` ทำงานได้ พร้อม guard ปิดใน production

**ความครอบคลุมขั้นต่ำ:** ต้อง implement **AC อย่างน้อย 2 ข้อให้เสร็จจริง** (happy path + edge/failure)
เพราะเกณฑ์ผ่านบังคับ feature tests ≥ 2 ที่อ้าง AC จาก GitHub Issue

**ต้อง deterministic:** seed แล้วผลต้องเหมือนเดิมทุกรอบ (`--repeat-each=3` ต้องเขียวทั้ง 3)
→ ห้ามมีข้อมูลที่ขึ้นกับ "วันนี้" หรือค้างจาก test ก่อนหน้า

### 📦 ผลลัพธ์ที่ต้องได้

| Artifact | รายละเอียด |
|:---|:---|
| `e2e/playwright.config.ts` | `baseURL` ชี้ไป FE, `webServer` ยกทั้ง FE + BE, `trace`, `forbidOnly` |
| `e2e/pages/` | Page Objects **≥ 1 ไฟล์ และห้ามมี `expect` ข้างใน** |
| `e2e/fixtures/` | custom fixture ที่เรียก seed / cleanup ของฝั่ง **BE** |
| `e2e/specs/` | smoke test + **feature tests ≥ 2** ที่อ้าง AC |
| `e2e/playwright-report/` | HTML report จากการรัน |
| ฝั่ง **FE** | semantic role + label + `data-testid` ใน components |
| ฝั่ง **BE** | `POST /api/test/seed` และ `/cleanup` + guard ปิดใน production |

### ✅ เกณฑ์ผ่าน

- [ ] E2E tests ผ่านทั้งหมด
- [ ] `--repeat-each=3` แล้วยังเขียวทุกรอบ (ไม่ flaky)
- [ ] Page Object ≥ 1 ตัว และไม่มี `expect()` ข้างใน
- [ ] Seed / cleanup ทำงานได้ และ seed endpoint ปิดใน production
- [ ] **ไม่มี `waitForTimeout` และไม่มีวันที่ hardcode**
- [ ] ทุก feature test อ้าง AC ที่มาจาก GitHub Issue

### 🎤 Present

รัน test → เปิด HTML report → อธิบาย Page Object (ทำไมไม่มี `expect`) → แสดง seed fixture + guard production
\+ ตอบว่า "ถ้า E2E แดงบน CI แต่เขียวบนเครื่อง จะ debug อย่างไร" และ "เลือก**ไม่**เขียน test อะไร เพราะอะไร"

---

## WS-05 — Docker

**Loop ที่ได้: Environment Loop** — `compose up แล้วได้ผลเหมือนกันทุกเครื่อง`

### ก่อนเข้าห้อง

| หมวด | สิ่งที่ต้องทำ |
|:---|:---|
| self-learning | image vs container, layer caching, `npm ci` vs `npm install`, `docker compose` (v2) |
| homework | ยืนยัน docker ทำงาน + pull `postgres:17-alpine` + `docker compose version` เป็น v2 |
| homework | สร้าง `.github/workflows/ci.yml` แบบ smoke พร้อม `permissions: contents: read` ให้รันเขียว |
| homework | เพิ่ม E2E test สำหรับ **failure scenario** 1 ข้อ พร้อม comment อ้าง AC |
| homework | เขียน `docs/setup-steps.md` — ตอนนี้คนใหม่ต้องทำกี่ขั้น ใช้เวลากี่นาที |

### ในห้อง (Lab 1.5 ชม.)

1. `Dockerfile` — ให้ AI ร่างโดยระบุข้อกำหนดครบ แล้ว **review ทุก instruction** + `.dockerignore` + build/ทดสอบ/เทียบขนาด image (25 น.)
2. `compose.yaml` สำหรับ dev — ทดสอบว่า loop ปิดจริง + บันทึก Before/After (20 น.)
3. `compose.test.yaml` — test environment + **ทดสอบว่า exit code เชื่อถือได้** (ทำ test ให้แดง → ต้องได้ exit code ≠ 0) (25 น.)
4. อัปเดต section Commands ใน `AGENTS.md` (5 น.)

### 🧩 ตัว product ต้องใช้งานได้ถึงไหน

- **ไม่ผูกกับเครื่อง dev อีกต่อไป** — ไม่มี path, `localhost`, port หรือ credential hardcode ในโค้ด
- **config ทุกตัวมาจาก environment variable** และมีชื่ออยู่ใน `.env.example` ทั้งสองฝั่ง
- **BE:** ต่อ DB ผ่าน **service name** ของ compose network (เช่น `db:5432`) ไม่ใช่ `localhost`
- **BE:** migration (และ seed ตั้งต้นถ้าจำเป็น) รันเองตอน container ขึ้น — ไม่ต้องให้คนรันมือ
- **FE:** build เป็น production artifact ได้ ไม่ใช่รันได้แค่ dev server
- **E2E จาก WS-04 ต้องรันในคอนเทนเนอร์ได้** และคืน exit code ที่ถูกต้อง
- **ผลลัพธ์ที่วัดได้:** เพื่อนที่ไม่เคยรัน project นี้ พิมพ์ `docker compose up` คำสั่งเดียวแล้วใช้งานได้

### 📦 ผลลัพธ์ที่ต้องได้

| Artifact | รายละเอียด |
|:---|:---|
| `frontend/Dockerfile` + `.dockerignore` | multi-stage → static/node runtime, non-root, pin tag |
| `backend/Dockerfile` + `.dockerignore` | multi-stage, non-root, pin tag, `HEALTHCHECK` ชี้ `/api/health` |
| `compose.yaml` | service **web + api + db** พร้อม `depends_on` — dev รันได้ด้วย **คำสั่งเดียว** |
| `compose.test.yaml` | service `unit-fe`, `unit-be`, `e2e` + **ephemeral DB** |
| `docs/setup-steps.md` | Before/After จำนวนขั้นตอนและเวลา (นับรวมทั้งสองฝั่ง) |
| `AGENTS.md` | อัปเดต section Commands พร้อม path ของแต่ละฝั่ง |

> ถ้าใช้ fullstack framework (Next.js / SvelteKit) จะมี **Dockerfile เดียว** — ให้ระบุเหตุผลไว้ใน `tech-stack.md`

### ✅ เกณฑ์ผ่าน

- [ ] `docker compose up` รันได้บนเครื่องทุกคนโดยไม่ต้อง setup เพิ่ม
- [ ] ทุกคนอธิบาย Dockerfile ได้ทุก instruction
- [ ] Test database เป็น ephemeral (`tmpfs` หรือไม่มี volume)
- [ ] ทดสอบแล้วว่า test แดง → exit code ไม่ใช่ 0
- [ ] ไม่มี secret จริง hardcode ในไฟล์ compose
- [ ] **ไม่มีบรรทัด `version:`** ในไฟล์ compose (เลิกใช้แล้ว)

---

## WS-06 — CI/CD

**Loop ที่ได้: Integration Loop** — รวมทุก loop ให้เป็น gate เดียว

### ก่อนเข้าห้อง

| หมวด | สิ่งที่ต้องทำ |
|:---|:---|
| self-learning | Workflow / Job / Step, `on: push` vs `on: pull_request`, การเก็บ secret, **DORA metrics 4 ตัว** |
| homework | ยืนยัน workflow จาก WS-05 ยังรันเขียว |
| homework | ยืนยัน test รันใน container แล้วได้ exit code ถูก (`--abort-on-container-exit --exit-code-from`) |
| homework | ติดตั้ง k6 (เตรียม WS-07) |
| homework | จด baseline 3 ตัว: unit suite (วินาที), E2E suite (นาที), commit-to-live ปัจจุบัน |

### ในห้อง (Lab 1.5 ชม.)

1. สร้าง full pipeline: lint + typecheck + test + E2E + build + deploy พร้อม `permissions`, `concurrency`, cache (40 น.)
2. GitHub Secrets + Environments (`production` ต้องมีคน approve) + ตรวจว่าไม่มี secret ใน history (15 น.)
3. Branch Protection + **ทดสอบว่าบล็อก merge ได้จริง** (แก้ test ให้ fail → เปิด PR → merge ถูกบล็อก) (15 น.)
4. Test summary ใน PR + บันทึกตัวเลข loop (10 น.)

### 🧩 ตัว product ต้องใช้งานได้ถึงไหน

- ต้องมี **staging environment จริง** ที่ pipeline deploy ขึ้นไปได้เอง และเปิดใช้งานได้จาก internet
- **E2E ต้องรัน headless บน CI ได้** — ไม่พึ่ง browser, ข้อมูล หรือไฟล์บนเครื่องใคร
- **secret ทุกตัวมาจาก GitHub Secrets** ไม่ใช่ `.env` บนเครื่อง (production ต้องผ่าน approval)
- แยก **staging / production** ออกจากกันจริง อย่างน้อยคนละ database
- ระบบต้อง deploy ได้โดยไม่ต้องมีใครกดอะไรด้วยมือ นอกจากการ approve production

### 📦 ผลลัพธ์ที่ต้องได้

| Artifact | รายละเอียด |
|:---|:---|
| `.github/workflows/ci.yml` | pipeline ที่รันผ่าน มี `permissions` + `concurrency` + cache<br>job แยกฝั่ง (`lint-fe`/`test-fe`/`lint-be`/`test-be`) รันขนาน แล้วรวมที่ `e2e` |
| Pipeline run URL | link ไปยัง successful run (ส่งใน LMS) |
| `docs/screenshots/` | หน้าจอที่ merge ถูกบล็อกเพราะ CI แดง |
| `docs/loop-metrics.md` | ตัวเลข before/after + คอขวดของ pipeline + จำนวน push ที่ใช้ debug |

### ✅ เกณฑ์ผ่าน

- [ ] Pipeline รันผ่านทุก job
- [ ] มี `permissions:` และ `concurrency:` ใน workflow
- [ ] ไม่มี secret hardcode และไม่มีการ echo ค่า secret
- [ ] Branch protection เปิดสำหรับ `main` และ **พิสูจน์แล้วว่าบล็อก merge ได้จริง**
- [ ] Environment `production` ต้องมีคน approve ก่อน deploy
- [ ] บันทึก loop metrics แล้ว

**เป้าความเร็ว pipeline (rubric):** < 2 นาที = เต็ม, 3–5 นาที = ผ่านกลาง, > 10 นาที = ต่ำสุด

---

## WS-07 — Performance Testing & Observability

**Loop ที่ได้: Production Loop** — `measure → analyze → optimize → measure`

### ก่อนเข้าห้อง

| หมวด | สิ่งที่ต้องทำ |
|:---|:---|
| self-learning | VUs, ทำไม p95 จริงกว่า average, Logs / Metrics / Traces, SLI vs SLO |
| homework | เขียนและรัน `performance/smoke.js` (k6) กับ staging → บันทึก `p(95)`, `http_req_failed`, `http_reqs/s` และ **สังเกต exit code เมื่อ threshold ไม่ผ่าน** |
| homework | เพิ่ม `GET /api/health` ตอบ 200 + JSON สั้น ๆ |
| homework | ให้ AI review function ที่แย่ที่สุด เก็บใน `docs/ai-review.md` — **ยังไม่ต้องแก้** (ใช้ WS-08) |
| homework | ตั้ง hypothesis ว่า bottleneck น่าจะอยู่ตรงไหน |

### ในห้อง (Lab 1.5 ชม.)

1. `performance/load-test.js` แบบ realistic journey (stages, tags, thresholds, think time) → รันบันทึก baseline → เขียน report (30 น.)
2. Structured logging: logger + request middleware พร้อม **correlation ID** + business event logging + redact ข้อมูลอ่อนไหว (25 น.)
3. ต่อ performance job เข้า CI แล้ว **ทดสอบว่า gate ทำงาน** (20 น.)
4. วิเคราะห์ด้วย AI อย่างถูกวิธี — ป้อนข้อมูลจริงให้ ไม่ใช่ให้เดา (15 น.)

### 🧩 ตัว product ต้องใช้งานได้ถึงไหน

- **ไม่ต้องเพิ่ม feature** แต่ระบบต้องทนของจริงได้มากขึ้น
- **staging ต้องรับ concurrent traffic ได้** — หลาย VUs พร้อมกันแล้วไม่ล้ม ไม่ติด connection pool หมด
- **staging ต้องมีข้อมูลมากพอ** ให้ query สะท้อนความจริง (ตารางที่มี 5 แถวจะไม่เจอ N+1)
- **BE:** `GET /api/health` ตอบเร็วและสะท้อนสถานะจริง (ใช้เป็นทั้ง `HEALTHCHECK` และด่านตรวจก่อนยิง load)
- **BE:** ทุก request ออก log JSON พร้อม `requestId`, `duration_ms` และ **redact ข้อมูลอ่อนไหว**
- journey ที่ k6 ยิงต้องเป็น **เส้นทางเดียวกับที่ user ใช้จริง** (เช่น login → ดูรายการ → จอง) ไม่ใช่แค่ hit หน้าแรก

### 📦 ผลลัพธ์ที่ต้องได้

| Artifact | รายละเอียด |
|:---|:---|
| `performance/load-test.js` | k6 script พร้อม stages, tags, thresholds |
| `performance/baseline.json` | summary export ของ baseline run |
| `docs/performance-report.md` | **Hypothesis vs Actual** + results + threshold ที่ไม่ผ่าน + bottleneck + AI analysis + สิ่งที่จะแก้ |
| Structured logging (ฝั่ง **BE**) | request + business event logging พร้อม `requestId` และ redact |
| `GET /api/health` (ฝั่ง **BE**) | target ของ smoke test และ `HEALTHCHECK` ของ Docker |
| CI job `performance` | ต่อเข้า pipeline แล้ว (ยิงใส่ staging ของฝั่ง BE) |

### ✅ เกณฑ์ผ่าน

- [ ] k6 รันกับ staging URL ได้ และมี think time (`sleep`) ระหว่าง request
- [ ] มี thresholds ที่ทำให้ exit code ≠ 0 เมื่อไม่ผ่าน (**ทดสอบแล้ว**)
- [ ] Performance report ระบุ bottleneck พร้อมตัวเลข ไม่ใช่ความรู้สึก
- [ ] Log ออกเป็น JSON มี `event`, `requestId`, `duration_ms`
- [ ] **ไม่มี email / token / password หลุดออกมาใน log**

> หมายเหตุจากอาจารย์: hypothesis ที่ **ผิด** ได้คะแนนดีได้ ถ้าอธิบายได้ว่าผิดเพราะอะไร — เป้าหมายคือให้เห็นว่า "การวัด" ชนะ "การเดา"

---

## WS-08 — Code Quality & Security

**Loop ที่ได้: Quality Loop** — `review → refactor → verify → ADR`

### ก่อนเข้าห้อง

| หมวด | สิ่งที่ต้องทำ |
|:---|:---|
| self-learning | Code smells & refactoring (ต่างจาก rewriting อย่างไร), OWASP Top 10, ADR, **Excessive Agency ของ AI agent** |
| homework | ให้ AI review function ที่แย่ที่สุด → `docs/ai-review.md` (ยังไม่แก้) |
| homework | เปิด Dependency graph, Dependabot alerts + security updates, Secret scanning (+ push protection), Code scanning (CodeQL) แล้ว screenshot |
| homework | ตรวจ secret ใน history: `git log --all --full-history -- "**/.env*"` |
| homework | เขียน `docs/security-pre-check.md` + เลือก **OWASP Top 10 ที่เกี่ยวกับ project มากที่สุด 3 ข้อ** |

> ถ้าเจอ secret จริงใน history: **revoke key นั้นทันทีก่อนทำอย่างอื่น**

### ในห้อง (Lab 1.5 ชม.)

1. Full codebase review → `docs/refactoring-plan.md` ตัดสินทีละข้อว่า **รับ / ไม่รับ / เลื่อน** + section "สิ่งที่ AI มองไม่เห็น" (20 น.)
2. Refactor ด้วย Quality Loop — refactor ทีละนิดแล้วรัน test ทันที (**ห้ามแก้ 100 บรรทัดแล้วค่อย test**) (40 น.)
3. ปิดช่องโหว่ security ตาม checklist (15 น.)
4. เขียน ADR-001 (15 น.)

### 🧩 ตัว product ต้องใช้งานได้ถึงไหน

- **พฤติกรรมของระบบต้องไม่เปลี่ยนเลยหลัง refactor** — E2E จาก WS-04 คือหลักฐาน
- codebase ต้องโตพอที่มี **module ที่ควรแก้จริง** (ถ้า WS-03/04 ทำครบ จะมี service ที่รับ requirement มาหลายรอบแล้ว)
- **test net ต้องหนาพอ** ที่ refactor แล้วรู้ทันทีว่าพัง — ไม่งั้นคือ rewrite ที่เดาเอา ไม่ใช่ refactor
- ช่องโหว่ที่แก้ ≥ 2 ข้อ ต้องเป็น **ของจริงจาก scan** และหลังแก้ระบบต้องยังทำงานได้
- **ตรวจให้แน่ว่า `/api/test/seed` ปิดสนิทบน production** (เป็นคำถามที่ถูกถามใน present)

### 📦 ผลลัพธ์ที่ต้องได้

| Artifact | รายละเอียด |
|:---|:---|
| `docs/refactoring-plan.md` | full review + สิ่งที่รับ/ไม่รับจาก AI พร้อมเหตุผล |
| Refactored code | module ที่ refactor แล้วและ test ยังเขียว |
| `docs/refactoring-[module].md` | before/after + issues found + AI vs team decisions + ผล test |
| `docs/security-pre-check.md` | ผล scan + สิ่งที่แก้ + test ที่คุ้มครอง<br>ไล่แยกฝั่ง: **FE** = XSS, secret หลุดเข้า bundle · **BE** = injection, authz, seed endpoint หลุด production |
| `docs/adr/ADR-001-*.md` | ครบทุก section รวม **Alternatives Considered** และ **Revisit When** |

### ✅ เกณฑ์ผ่าน

- [ ] Test เขียวทั้งหมดหลัง refactor และ CI เขียว
- [ ] **ไม่มีไฟล์ test ถูกแก้ระหว่าง refactor** (ตรวจด้วย `git diff --stat main...HEAD -- tests/`)
- [ ] Refactoring plan ระบุชัดว่าเห็นด้วย/ไม่เห็นด้วยกับ AI ตรงไหน พร้อมเหตุผล
- [ ] แก้ security issue **อย่างน้อย 2 ข้อ** และมี test คุ้มครอง
- [ ] ADR ครบทุก section โดยเฉพาะ Alternatives Considered
- [ ] ทุกคนอธิบาย refactoring decisions ได้

---

## Artifacts สะสมเมื่อจบทั้ง 8 workshop

> ตัวอย่างนี้ใช้รูปแบบ **โฟลเดอร์ระดับบน** (`frontend/` + `backend/`)
> ถ้ากลุ่มเลือก monorepo ให้อ่านเป็น `apps/web/` และ `apps/api/` แทน

```
repo ของกลุ่ม
│
├── ─────────── ระดับ root: ใช้ร่วมกันทั้งสองฝั่ง ───────────
├── AGENTS.md                              ← WS-01 (อัปเดต WS-02, WS-05)
│                                             ★ ประกาศ path ของ FE/BE ไว้ที่นี่
├── LOOP_NOTES.md                          ← WS-01--before
├── memory-bank/
│   ├── intent.md                          ← WS-02
│   ├── units/[unit]/unit-brief.md         ← WS-02  (แยก unit ตาม FE/BE ได้)
│   └── standards/tech-stack.md            ← WS-01  (ระบุ stack ทั้งสองฝั่ง)
├── docs/
│   ├── architecture.md                    ← WS-02  (ต้องเห็นทั้ง FE + BE + DB)
│   ├── erd.md                             ← WS-02  (มาจากฝั่ง BE)
│   ├── openapi.yaml                       ← WS-02  ★ contract ที่ FE/BE ใช้ร่วมกัน
│   ├── wireframes/                        ← WS-03--before  (ฝั่ง FE)
│   ├── coverage/frontend/                 ← WS-03
│   ├── coverage/backend/                  ← WS-03
│   ├── setup-steps.md                     ← WS-05  (นับขั้นตอนของทั้ง 2 ฝั่ง)
│   ├── loop-metrics.md                    ← WS-06
│   ├── screenshots/                       ← WS-06
│   ├── performance-report.md              ← WS-07
│   ├── ai-review.md                       ← WS-07--before / WS-08--before
│   ├── refactoring-plan.md                ← WS-08  (ระบุว่าแก้ module ฝั่งไหน)
│   ├── refactoring-[module].md            ← WS-08
│   ├── security-pre-check.md              ← WS-08--before / WS-08
│   └── adr/ADR-00X-*.md                   ← WS-08
├── compose.yaml                           ← WS-05  ★ service: web + api + db
├── compose.test.yaml                      ← WS-05  ★ unit-fe + unit-be + e2e + db
├── .github/workflows/ci.yml               ← WS-05--before → WS-06 → WS-07
│                                             ★ job แยกฝั่ง + path filter
├── .gitignore                             ← WS-01
│
├── ─────────── frontend/ ───────────  (path ตามที่กลุ่มกำหนด)
│   ├── src/                                  semantic role + data-testid ← WS-04--before
│   ├── tests/unit/                        ← WS-03  (component / logic tests)
│   ├── TEST_PLAN.md                       ← WS-03  (business rule ฝั่ง UI)
│   ├── Dockerfile                         ← WS-05  multi-stage → static/node runtime
│   ├── .dockerignore                      ← WS-05
│   └── .env.example                       ← WS-01  (เช่น API base URL)
│
├── ─────────── backend/ ───────────  (path ตามที่กลุ่มกำหนด)
│   ├── src/
│   │   ├── api/health                     ← WS-07--before  health endpoint
│   │   ├── api/test/seed, /cleanup        ← WS-04--before  ★ ต้อง guard ปิดใน production
│   │   └── logging/                       ← WS-07  structured log + correlation ID + redact
│   ├── tests/
│   │   ├── unit/                          ← WS-03
│   │   ├── fakes/                         ← WS-03  fake repository
│   │   ├── factories.*                    ← WS-03
│   │   └── conftest.py | setup.ts         ← WS-03  fixtures
│   ├── TEST_PLAN.md                       ← WS-03  (business rule ฝั่ง domain)
│   ├── Dockerfile                         ← WS-05  multi-stage + non-root + HEALTHCHECK
│   ├── .dockerignore                      ← WS-05
│   └── .env.example                       ← WS-01  (DB URL, secret key names)
│
├── ─────────── e2e/ ───────────  ← WS-04  ข้ามทั้ง FE + BE จึงอยู่ระดับ root
│   ├── playwright.config.ts                  baseURL ชี้ไป FE, webServer ยกทั้ง 2 ฝั่ง
│   ├── pages/                                Page Objects (ห้ามมี expect)
│   ├── fixtures/                             seed / cleanup เรียก API ฝั่ง BE
│   ├── specs/                                smoke + feature tests
│   └── playwright-report/
│
└── ─────────── performance/ ───────────  ← WS-07  ยิง HTTP ใส่ BE จึงอยู่ระดับ root
    ├── smoke.js                           ← WS-07--before
    ├── load-test.js                       ← WS-07
    └── baseline.json                      ← WS-07
```

### ผลที่ตามมาเมื่อแยก 2 ฝั่ง — จุดที่ต้องระวังในแต่ละ WS

| WS | สิ่งที่เปลี่ยนไปเพราะมี 2 ฝั่ง |
|:---|:---|
| WS-01 | `.env.example` มี **2 ไฟล์** คนละชุด key • deploy อาจแยกเป็น 2 service (web + api) → commit-to-live อาจไม่เท่ากัน ให้จดทั้งคู่ |
| WS-02 | `openapi.yaml` คือ **จุดเชื่อมเดียว** ระหว่างสองฝั่ง — FE ห้ามเดา field เอง • component diagram ต้องแยกกล่อง FE / BE / DB ให้ชัด |
| WS-03 | test runner คนละตัวได้ (Vitest ฝั่ง FE / pytest ฝั่ง BE) แต่ **เกณฑ์ < 10 วินาที นับรวมทั้งสองฝั่ง** • fake repository อยู่ฝั่ง BE, fake API client อยู่ฝั่ง FE |
| WS-04 | E2E ต้องยกทั้ง FE + BE + DB ขึ้นพร้อมกันถึงจะรันได้ • seed endpoint อยู่ฝั่ง BE แต่ fixture ที่เรียกอยู่ใน `e2e/` |
| WS-05 | **Dockerfile 2 ไฟล์** (ยกเว้น fullstack framework) • `compose.yaml` ต้องตั้ง `depends_on` ให้ FE รอ BE และ BE รอ DB |
| WS-06 | pipeline ควรแยก job `lint-fe` / `test-fe` / `lint-be` / `test-be` ให้รัน **ขนาน** แล้วค่อยรวมที่ job `e2e` • ใช้ `paths` filter ไม่ให้แก้ FE แล้วรัน test BE ทั้งชุด |
| WS-07 | load test ยิงที่ **BE** เป็นหลัก • structured logging อยู่ฝั่ง BE • bottleneck ที่เจออาจอยู่ที่ DB ไม่ใช่ที่ code |
| WS-08 | ระบุให้ชัดว่า refactor module ฝั่งไหน • security checklist ต่างกัน: FE = XSS / secret ที่หลุดไป bundle, BE = injection / authz / seed endpoint หลุด production |

---

## ตัวเลขที่ต้องวัดได้ตลอดวิชา

| ตัวเลข | เริ่มวัดที่ | เป้าหมาย |
|:---|:---|:---|
| จำนวนรอบที่ AI วนกว่า test จะเขียว | WS-01--before | เข้าใจว่าทำไมทีมที่มี test ได้ประโยชน์จาก AI มากกว่า |
| commit-to-live time | WS-01 | ติดตามต่อใน WS-06 |
| เวลารัน unit test suite | WS-03--before | **< 10 วินาที** ตลอดวิชา |
| จำนวนขั้นตอน setup ของคนใหม่ | WS-05--before | ลดเหลือ **1 คำสั่ง** |
| เวลารัน pipeline | WS-06 | < 2 นาที (rubric เต็ม) |
| p95 / error rate / throughput | WS-07--before | เทียบกับ hypothesis |
| จำนวน push ที่ใช้ debug pipeline | WS-06 | เห็นว่า loop บน CI แพงกว่า local หลายสิบเท่า |

---

## รูปแบบที่ซ้ำทุก WS

- **Present 10 นาที/กลุ่ม** — อาจารย์ **สุ่ม 1 คน ไม่บอกล่วงหน้า**, ไม่ต้องมี slide, demo หน้าจอ
- **Rubric 5 เกณฑ์ × 5 คะแนน** — และเกือบทุก WS มีเกณฑ์ **AI Judgement** แยกออกมา: ต้องบอกได้ว่า AI เสนออะไร แล้ว *ไม่รับข้อไหน เพราะอะไร*
- **พิสูจน์ด้วยการทำให้พัง ไม่ใช่แค่ทำให้ผ่าน** — break test ให้แดง (WS-03), exit code ≠ 0 (WS-05), block merge (WS-06), threshold แดง (WS-07)
- **คำถามยืนของวิชา:** *"ถ้ามันพัง จะรู้ตอนไหน และรู้ได้อย่างไร"*
- ถ้าคนที่ถูกสุ่มตอบไม่ได้ **ลด 1 คะแนนทันที** (เพื่อนช่วยได้)

## กติกาสำคัญ

1. **AI เสนอ — คนตัดสิน** ทุก artifact ที่ AI สร้าง ต้องมีคนในกลุ่มอธิบายได้
2. **ถ้าอธิบายไม่ได้ ห้าม commit**
3. **ห้ามส่ง secret เข้า AI tool หรือเข้า repo** ไม่ว่ากรณีใด
4. **Verify ก่อนเชื่อ** ทั้ง output ของ AI และผลลัพธ์ของตัวเอง

## Scoring

`[40] Lab` · `[10] Presentation` · `[20] Midterm Exam` · `[30] Final Exam`
