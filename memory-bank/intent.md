# Intent: PairEval

## Intent Statement

ทำให้การให้คะแนนงานกลุ่มในระดับอุดมศึกษายุติธรรมขึ้น
โดยเปลี่ยนจากการให้คะแนนงานทีละชิ้นด้วยมาตรฐานที่เลื่อนไปมา
มาเป็นการ **เปรียบเทียบงานครั้งละสองชิ้น** แล้วคำนวณคะแนนจากผลเปรียบเทียบทั้งหมด

## Business Context

- **Problem** — การให้คะแนนงานกลุ่มมีปัญหาที่รู้กันมานาน 3 ข้อ
  1. *Absolute scoring bias* — อาจารย์ให้คะแนนงานชิ้นแรกกับชิ้นสุดท้ายด้วยมาตรฐานต่างกัน
  2. *Free-rider problem* — คนที่ไม่ทำงานได้คะแนนเท่ากับคนที่ทำ เพราะคะแนนผูกกับกลุ่ม
  3. การเทียบงานสองชิ้นว่าอันไหนดีกว่า มนุษย์ทำได้แม่นกว่าการให้เลข 0–100 มาก
- **Users** — อาจารย์ (สร้างงาน จัดคู่ ยืนยันคะแนน) · นักศึกษา (ประเมินเพื่อน ดูคะแนนตัวเอง) · TA (ช่วยดูแลคุณภาพ)
- **Value** — คะแนนที่อธิบายที่มาได้ ตรวจสอบย้อนหลังได้ และแยกคนที่ทำงานออกจากคนที่ไม่ทำได้

## Success Criteria

สถานะตรวจจาก repo เมื่อ 2026-10-20 — ✅ มีหลักฐาน · ⚠️ ทำแล้วแต่ยังไม่ครบเกณฑ์ · ⬜ ยังไม่มีหลักฐาน

| เกณฑ์ | สถานะ | หลักฐาน / สิ่งที่ขาด |
|---|:---:|---|
| อาจารย์ปิดวงจร `สร้างห้องเรียน → import รายชื่อ → สร้างงาน → publish → เห็นคะแนน` ได้ครบโดยไม่ต้องมีคนช่วย | ⚠️ | flow ครบและมี E2E ครอบ (`e2e/specs`) · ยังไม่มีหลักฐานว่าคนนอกทีมใช้จนจบเอง (DoD ของ M1 ใน PRD §19) |
| นักศึกษาประเมินครบทุกคู่จากมือถือ โดยไม่เสียคำตอบแม้เน็ตหลุด | ✅ | autosave + queue ฝั่ง client `frontend/src/lib/useComparisonQueue.ts` (FR-EVAL-04/13) พร้อม unit test |
| คำนวณคะแนนซ้ำด้วยข้อมูลชุดเดิมแล้วได้ผลเหมือนเดิมทุกครั้ง | ✅ | pure scoring engine ([ADR-001](../docs/adr/ADR-001-pure-scoring-engine.md)) · golden test §9.5 ใน `backend/tests/unit/test_scoring_service.py` |
| หน้าประเมิน p95 ≤ 2.0 วินาที ที่ 200 concurrent users (NFR-PERF-01) | ⚠️ | round-trip p95 ผ่านเกณฑ์ แต่ load test สูงสุด 10 student VUs — ยังไม่ได้วัดที่ 200 users ([performance-report.md](../docs/performance-report.md)) |

## Decisions Already Made

> section นี้มีไว้หยุด AI จากการเสนอทางเลือกที่เราตัดสินไปแล้วซ้ำ ๆ

| # | ตัดสินใจแล้วว่า | ทางที่ไม่เลือก |
|---|---|---|
| D1 | มาตรวัด **6 ระดับ forced choice ไม่มีตัวเลือกกลาง** | 5 ระดับที่มีตัวกลาง · binary A/B |
| D2 | คะแนนดิบ map ผ่าน **band mapping** (floor 60% → ceiling 100%) | normalize ให้ผลรวม = 1 · z-score · percentile |
| D5 | แยก **"คะแนนที่ได้รับ"** ออกจาก **"โทษการไม่เข้าร่วม"** | ให้ 0 รวบ |
| D7 | มี **k-anonymity threshold** ก่อนแสดงคะแนนรายบุคคล | แสดงทันทีเสมอ |
| D8 | **สลับตำแหน่งซ้าย-ขวาแบบสุ่ม** ทุก comparison | แสดงตามลำดับ id |
| AR-01 | Scoring Engine เป็น **pure function** ของข้อมูลใน DB ไม่มี state ภายใน | เก็บ state ระหว่างคำนวณ |
| — | Stack: **FastAPI + Vite React + Tailwind + PostgreSQL** deploy บน Render ผ่าน `render.yaml` | Next.js fullstack |
| — | โครงสร้าง repo: `frontend/` + `backend/` แยกที่ระดับบน | monorepo `apps/*` |
| — | Render Auto-Deploy = Off — deploy ทั้งหมดสั่งจาก CI ที่ SHA เดียวกัน (`docs/cicd.md`) | auto-deploy จาก push |
| — | login เปิดทุกโดเมน + แยกประเภทบัญชีจากรูปแบบอีเมล **เฉพาะช่วงพัฒนาและสาธิต** ([ADR-007](../docs/adr/ADR-007-open-login-and-account-type.md)) | จำกัด hosted domain ตาม FR-AUTH-02 — ต้องกลับไปใช้ก่อนใช้งานจริง |

ADR อื่นที่ตัดสินแล้ว: auto-finalize (ADR-002), session token storage (ADR-003), privacy retention (ADR-004),
availability & alerting (ADR-005), synchronous export (ADR-006) — อยู่ใน `docs/adr/`

## Scope

**ขอบเขตจริงของโค้ดตอนนี้กว้างกว่าแผนเดิม** — แผนเดิมตั้งไว้ที่ M1–M2 แต่ระหว่าง WS-03 ถึง WS-08
ทีมทำ feature ของ M3 และ M4 ไปด้วย ได้แก่ anonymity controls, quality signals QS-01–07, audit log,
override, appeals, notifications (ในเว็บ + อีเมล), XLSX export 4 sheet และ a11y ของหน้าประเมิน

| Milestone (PRD §19) | สถานะในโค้ด | ที่ยังไม่ครบ |
|---|---|---|
| M1 Walking Skeleton | ✅ | หลักฐานคนนอกทีมใช้จบ flow เอง |
| M2 Core Complete | ✅ | ยังไม่ได้ทดลองกับห้องเรียนจริง ≤ 30 คน |
| M3 Trustworthy | ✅ (feature) | security review ผ่านตาม WS-08 · privacy review ยังไม่มีผู้ตรวจตาม PRD |
| M4 Production Ready | ⚠️ | load test ที่ 200 users · screen reader test (FR-A11Y-07) · FR-AUTH-02 |

**นอก scope ของ v1.0 ตาม PRD §1.3 / §2.2**

- LMS integration (LTI 1.3) · mobile native app · multi-language UI
- Bradley–Terry / Elo model · rubric attachment ต่อ criteria · rubric-based absolute scoring
- การตัดเกรด (letter grade) · การประเมินข้าม classroom

**นอก scope ที่ทีมตัดสินเอง** (ไม่ได้มาจาก PRD) — คอมเมนต์ประกอบการประเมินรายคู่ ([backlog.md](../docs/backlog.md) ส่วน "ไม่รับ"),
ระบบ plagiarism detection, การให้คะแนนโดย AI

## Status

**WS-01 ถึง WS-08 ทำครบในส่วนที่ตรวจจาก repo/CI ได้** — เหลือเฉพาะงานที่ทีมต้องทำเอง (present, ส่ง LMS,
ยืนยันว่าทุกคนอธิบายได้)

| Workshop | ขอบเขต | สถานะ | หลักฐาน |
|---|---|:---:|---|
| WS-01 | Deploy loop + landing page | ✅ | `README.md` (URL ที่ deploy) |
| WS-02 | Backlog, diagrams, API contract, memory-bank | ✅ | `docs/backlog.md`, `docs/openapi.yaml`, `docs/erd.md` |
| WS-03 | Unit test | ✅ | `backend/tests/unit`, `frontend/src/**/*.test.ts*` |
| WS-04 | E2E (Playwright) | ✅ | `e2e/`, [e2e-report.md](../docs/e2e-report.md) |
| WS-05 | Docker | ✅ | `compose.yaml`, `compose.test.yaml` |
| WS-06 | CI/CD | ✅ (LMS ยังไม่ยืนยัน) | [cicd.md](../docs/cicd.md), [ws06-07-submission.md](../docs/ws06-07-submission.md) |
| WS-07 | Performance & observability | ✅ (LMS ยังไม่ยืนยัน) | [performance-report.md](../docs/performance-report.md) |
| WS-08 | Code quality & security | ✅ (present/LMS ทีมทำเอง) | [ws08-submission.md](../docs/ws08-submission.md) |

## ข้อที่ยังไม่ตรง PRD

1. **FR-AUTH-02 (MUST)** ไม่ผ่านตามตัวอักษร — ดู ADR-007 · ห้ามใช้ deployment นี้กับข้อมูลนักศึกษาจริงที่ไม่ได้ยินยอม
2. **NFR-PERF-01 / NFR-SCALE-01/02** ยังไม่ได้วัดที่ 200 concurrent users
3. **QS-07** ใช้ Kendall's u แทน Kendall's W (เหตุผลอยู่ใน `backend/app/domain/quality.py`)
4. **FR-PRIV-03** ทำเป็นดาวน์โหลดสำเนาเองทันที (`GET /api/me/data-copy`) แทนคำขอที่ตอบภายใน 30 วัน
5. **API path** บางตัวต่างจาก PRD §12 (เช่น `/scores` แทน `/reports/*`, `additional-evaluations` แทน `pairs:add-evaluators`,
   `/classrooms/{id}/audit` แทน `/assignments/{id}/audit`) — ความสามารถครบ ชื่อต่าง · สัญญาจริงอยู่ที่ `docs/openapi.yaml`

## คำถามที่ยังไม่มีคำตอบ

สามข้อที่เคยค้างในไฟล์นี้ (re-submit, `k_min`, โทษการไม่ประเมิน) PRD ตอบไว้แล้ว — ดูท้าย `docs/backlog.md`

สถานะ Open Questions OQ-1 ถึง OQ-8 ของ PRD §17 และข้อขัดแย้งภายใน PRD ที่รออาจารย์ชี้ขาด
อยู่ที่ [open-questions.md](../docs/open-questions.md) ที่เดียว — **OQ-8 ยังเปิดอยู่** ข้ออื่นใช้ default และรอผู้ตัดสินยืนยัน
