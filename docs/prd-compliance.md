# PRD Compliance Checklist — PairEval

เทียบ [PRD v2.0](../Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md) กับโค้ดบน `develop` (ตรวจ 2026-10-20 หลัง merge PR #42)

**วิธีตรวจ:** อ่านโค้ด, migrations, workflow และเอกสารใน `docs/` ทีละข้อ แล้วรัน test จริงใน Docker (`compose.test.yaml`)

| ชุด test | ผล |
|---|---|
| backend unit + api | **727 passed** (6.01s) |
| frontend unit | **52 passed** (6 files) |
| backend integration (Postgres) | **57 passed** (4.21s) |
| E2E (Playwright) | ไม่ได้รันรอบนี้ — CI ของ PR #42 ผ่าน |

สัญลักษณ์: ✅ ตรง PRD · ⚠️ ทำแล้วแต่ไม่ครบหรือเบี่ยงจากตัวอักษร (มีเหตุผลบันทึกไว้) · ❌ ไม่ตรง PRD

## สรุป

นับต่อแถวของ checklist ด้านล่าง (บางแถวรวมหลาย ID เช่น `QS-01..06`)

| | แถว |
|---|---:|
| ✅ ตรง | 121 |
| ⚠️ เบี่ยง / ไม่ครบ | 13 |
| ❌ ไม่ตรง | 6 |

**❌ ทั้ง 6 แถว**

| ID | Pri | ปัญหา | สถานะการตัดสินใจ |
|---|:---:|---|---|
| FR-AUTH-02 | M | login ได้ทุกโดเมน · ด่านโดเมนเป็นค่ากลาง `ALLOWED_EMAIL_DOMAINS` (ว่างอยู่) ไม่ใช่ต่อ classroom | [ADR-007](adr/ADR-007-open-login-and-account-type.md) รออาจารย์รับรอง |
| FR-SEC-01 | M | session JWT เก็บใน `localStorage` ไม่ใช่ httpOnly + SameSite cookie (HSTS มีแล้ว) | [ADR-003](adr/ADR-003-session-token-storage.md) สถานะ **Proposed** |
| NFR-PERF-01..04 | — | ที่ 200 VUs: หน้าประเมิน p95 **9.17s** (≤2.0s) · autosave **9.29s** (≤300ms) · submit **10.10s** (≤800ms) · publish **15.90s** (≤10s) | สมมติฐาน: CPU ของ Render free plan · ยังไม่พิสูจน์ · ทีมยังไม่ตัดสินเรื่อง plan |
| NFR-AVAIL-02 | — | RPO 24 ชม. (backup วันละครั้ง) เกณฑ์ ≤15 นาที | ต้องใช้ Postgres แบบเสียเงินที่มี PITR ([backup-restore.md](backup-restore.md)) |
| FR-QS-03 | M | ยังไม่รวม QS-07 ข้าม assignment เพื่อรายงานว่า criterion เขียนไม่ชัด | ยังไม่มีงานที่รับไว้ |
| FR-A11Y-07 | S | ยังไม่ได้ทดสอบด้วย NVDA/VoiceOver | บันทึกไว้ใน [a11y-report.md](a11y-report.md) |

ผล performance ทั้งหมดมาจาก [run 39346616515](https://github.com/STARSTEAM-X/sdpx-arai/actions/runs/39346616515) ใน [performance-report.md](performance-report.md) — ที่ 10 VUs ผ่านทุกเกณฑ์

---

## §5 / §6 Design decisions และ architecture

| ID | | หลักฐาน |
|---|:---:|---|
| D1 6-point forced choice | ✅ | `ComparisonRow.tsx` 6 ปุ่ม · DB `choice CHECK BETWEEN 1 AND 6` |
| D2 band mapping | ✅ | `scoring_service.py` · golden test §9.5 |
| D3 R ↔ k คำนวณจากกัน | ✅ | `solve_group_feasibility` ใน `pairing.py` |
| D4 individual coverage = m−2 | ✅ | `test_P7_coverage_เท่ากับขนาดกลุ่มลบสอง` |
| D5 แยก participation ออกจากคะแนน | ✅ | `compute_final_personal_score` · FR-SCORE-11 test |
| D6 instructor weight เป็น float | ✅ | `instructor_weight numeric(4,2)` ใน weighted mean |
| D7 k-anonymity | ✅ | `domain/anonymity.py` |
| D8 สุ่มซ้ายขวา | ✅ | `display_left_item_id` · `test_P6_ตำแหน่งซ้ายขวาไม่เอียง` |
| AR-01 scoring เป็น pure function | ✅ | [ADR-001](adr/ADR-001-pure-scoring-engine.md) |
| AR-02 authz ชั้นเดียว | ✅ | `ClassroomAccess` ใน `domain/access.py` |
| AR-03 audit append-only **แยก storage** | ⚠️ | append-only ด้วย trigger แล้ว แต่ `audit_log` อยู่ใน Postgres ตัวเดียวกับข้อมูลหลัก |

## §7.1 Authentication & Authorization

| ID | Pri | | หลักฐาน / หมายเหตุ |
|---|:---:|:---:|---|
| FR-AUTH-01 | M | ✅ | Google OIDC เท่านั้น (`google_oidc.py`) ไม่มี local password · `login.spec.ts` |
| FR-AUTH-02 | M | ❌ | ดูตารางสรุป |
| FR-AUTH-03 | M | ⚠️ | normalize lowercase + ตัด `+tag` ทุกโดเมน + ตัดจุดเฉพาะ gmail · **AC ของ PRD ขัดกับตัวกฎเอง** (`uni.ac.th` ไม่ใช่ gmail) — เลือกตามตัวกฎ เหตุผลใน `domain/email.py` (C1 รออาจารย์) |
| FR-AUTH-04 | M | ✅ | `SESSION_TTL_HOURS=12` + refresh เงียบ (`auth.py`, `test_session_refresh.py`) |
| FR-AUTHZ-01 | M | ✅ | capability matrix ตรง §3 · e2e นักศึกษาเรียก instructor endpoint → 403 |
| FR-AUTHZ-02 | M | ✅ | `require_member` คืน 404 ก่อนเช็ค role (`test_access.py`) |
| FR-AUTHZ-03 | S | ✅ | role ต่อห้อง · US-12 e2e |

> role matrix: TA และ CO_TEACHER ดู audit log ได้ (`VIEW_AUDIT`) — PRD §3 ไม่ได้ระบุแถวนี้ จึงไม่ถือว่าขัด

## §7.2 Classroom & Roster

| ID | Pri | | หลักฐาน |
|---|:---:|:---:|---|
| FR-CLASS-01 | M | ✅ | header ไม่สนตัวพิมพ์ · รองรับ BOM/TIS-620 (`roster_import.py`) |
| FR-CLASS-02 | M | ✅ | atomic — แถวผิดแถวเดียว reject ทั้งไฟล์และรายงานเลขแถว |
| FR-CLASS-03 | M | ✅ | อีเมลซ้ำ (หลัง normalize), ผิดรูปแบบ, group ว่าง, `GROUP_TOO_SMALL` |
| FR-CLASS-04 | M | ✅ | user `PENDING` → `ACTIVE` ตอน login แรก |
| FR-CLASS-05 | S | ✅ | `roster:preview` + `roster_diff.py` |
| FR-CLASS-06 | M | ✅ | `LAST_OWNER` (`member_service.py`) |
| FR-CLASS-07 | S | ✅ | archive/restore · `require_writable_classroom` กันการเขียนฝั่ง server |

## §7.3 Assignment lifecycle

| ID | Pri | | หลักฐาน / หมายเหตุ |
|---|:---:|:---:|---|
| FR-ASSIGN-01 | M | ✅ | field ครบ + artifact link ต่อกลุ่ม |
| FR-ASSIGN-02 | M | ✅ | `WEIGHT_TOLERANCE = 0.01` ตรวจตอน publish |
| FR-ASSIGN-03 | M | ✅ | แก้ได้เฉพาะ DRAFT · unpublish ต้องยืนยัน invalidate + เหตุผล |
| FR-ASSIGN-04 | M | ⚠️ | ขยายได้ แต่ **ร่นเข้าไม่ได้เลย** — PRD อนุญาตให้ร่นได้ถ้ายังไม่ถึง deadline เดิม (`extend-deadline` ปฏิเสธค่าที่เร็วกว่าเดิมเสมอ) |
| FR-ASSIGN-05 | M | ✅ | `timestamptz` ทุกคอลัมน์ · แสดงตาม timezone ของห้อง |
| FR-ASSIGN-06 | S | ✅ | `:copy` |
| FR-ASSIGN-07 | M | ✅ | `individual_max_score = 0` ไม่สร้างคู่ (3 tests) |
| State diagram §7.3 | — | ✅ | DRAFT/PUBLISHED/OPEN/CLOSED/FINALIZED · reopen → CLOSED พร้อม audit |

## §7.4 / §8 Pairing

| ID | Pri | | หลักฐาน |
|---|:---:|:---:|---|
| FR-PAIR-01 | M | ✅ | สร้างตอน publish เก็บลง DB |
| FR-PAIR-02 / INV-1 | M | ✅ | `test_P1`, `test_INV_1` |
| FR-PAIR-03 | M | ✅ | `test_P2_*` |
| FR-PAIR-04 | M | ✅ | `GET /feasibility` |
| FR-PAIR-05 | M | ✅ | `test_P8_เหตุผลต้องมีตัวเลข` · ตรงตัวอย่าง 1 และ 2 ของ PRD |
| FR-PAIR-06 / INV-3 | M | ✅ | `TestBalanceGuard` raise ถ้าไม่สมดุล |
| FR-PAIR-07 / INV-2 | M | ✅ | `test_P4`, `test_INV_2` |
| FR-PAIR-08 | M | ✅ | `display_left_item_id` |
| FR-PAIR-09 / INV-5 | M | ✅ | `test_P5_seed_เดิมให้ผลเหมือนเดิม` |
| INV-4 | — | ✅ | `test_INV_4` |
| FR-PAIR-10 | M | ✅ | `POST /additional-evaluations` + notification `assigned` |
| FR-PAIR-11 | M | ✅ | unpublish → publish ใหม่ · audit `PAIRS_REGENERATED` · notification `regenerated` |
| FR-PAIR-12 | M | ✅ | m ≤ 2 ข้ามพร้อมเหตุผล |
| FR-PAIR-13 | M | ✅ | m = 3 เตือนและซ่อนคะแนน (k_min) |
| FR-PAIR-14 | M | ✅ | `TestIndividualWorkloadCap` |
| FR-PAIR-15 | S | ✅ | เตือนกลุ่มนอก 4–7 |
| NFR-MAINT-02 | — | ✅ | `test_pairing_properties.py` สุ่ม N, m, R 30 รูปทรง (seed คงที่ ไม่ใช้ hypothesis เพื่อไม่เพิ่ม dependency) |

## §7.5 Evaluation UI

| ID | Pri | | หลักฐาน |
|---|:---:|:---:|---|
| FR-EVAL-01 | M | ✅ | ทุก criterion หน้าเดียว |
| FR-EVAL-02 | M | ✅ | ลิงก์ผลงานต่อกลุ่ม · ไม่มีลิงก์ → "ยังไม่มีลิงก์ผลงานแยก" |
| FR-EVAL-03 | M | ✅ | label ข้อความทุกปุ่ม |
| FR-EVAL-04 | M | ✅ | autosave + สถานะ "บันทึกแล้ว" |
| FR-EVAL-05 | M | ✅ | submit ได้ตลอด แสดงจำนวนที่เหลือ (`SubmitDialogs.tsx`) |
| FR-EVAL-06 | M | ⚠️ | re-submit ไม่จำกัด + เก็บทุกเวอร์ชันใน `comparison_revision` · แต่ AC ระบุ "audit log มี 3 records" — submission **ไม่ได้เขียน audit_log** |
| FR-EVAL-07 | M | ✅ | progress X / Y |
| FR-EVAL-08 | M | ✅ | หลัง deadline 409 `DEADLINE_PASSED` + read-only |
| FR-EVAL-09 | M | ✅ | นับเฉพาะ `SUBMITTED` (DR-01) |
| FR-EVAL-10 | S | ✅ | countdown < 48 ชม. |
| FR-EVAL-11 | M | ✅ | หน้า Individual แยก submit |
| FR-EVAL-12 | M | ✅ | "งานนี้ไม่มีการประเมินรายบุคคลสำหรับกลุ่มของคุณ" |
| FR-EVAL-13 | S | ✅ | `useComparisonQueue.ts` + test |

## §7.6 / §9 Scoring

| ID | Pri | | หลักฐาน / หมายเหตุ |
|---|:---:|:---:|---|
| FR-SCORE-01 | M | ✅ | weighted mean §9.2 |
| FR-SCORE-02 | M | ✅ | floor/ceiling ต่อ assignment |
| FR-SCORE-03 | M | ✅ | float ≥ 0 default 1.0 |
| FR-SCORE-04 | M | ✅ | multiplier แยก |
| FR-SCORE-05 | M | ✅ | `LOW_CONFIDENCE` ไม่ finalize อัตโนมัติ (`test_finalize_service.py`) |
| FR-SCORE-06 | M | ✅ | `daily_scoring.py` 02:00 ตาม timezone ห้อง + `:recompute` |
| FR-SCORE-07 | M | ⚠️ | ฝั่งอาจารย์ใช้ข้อความตรง PRD · ฝั่งนักศึกษาเขียน "คะแนนชั่วคราว อาจจะมีการเปลี่ยนแปลง" — ความหมายเดียวกัน ข้อความไม่ตรงตัวอักษร |
| FR-SCORE-08 | M | ✅ | override บังคับเหตุผล + audit |
| FR-SCORE-09 | M | ✅ | snapshot input/output (migration 008, 010) |
| FR-SCORE-10 | M | ✅ | `numeric` + pure function |
| FR-SCORE-11 | M | ✅ | คะแนนกลุ่มไม่ถูกลดด้วย M ของสมาชิก |
| FR-SCORE-12 | M | ✅ | นโยบายแสดงในหน้า overview / guide |
| FR-SCORE-13 | M | ✅ | `participationRatio`, `participationMultiplier` ใน `my-score` |
| NFR-MAINT-01 | — | ✅ | golden test 12.798 / 16.928 (PRD ปัดแสดง 16.93) |

## §7.7–7.8 Reports & Export

| ID | Pri | | หลักฐาน / หมายเหตุ |
|---|:---:|:---:|---|
| FR-REPORT-01..04 | M | ✅ | `/scores`, coverage actions, `/quality` |
| FR-REPORT-05 | S | ✅ | `DistributionDialog.tsx` |
| FR-REPORT-06 | M | ✅ | นักศึกษาเรียก `/scores` และ export → 403 (e2e) |
| FR-EXPORT-01 | M | ✅ | CSV UTF-8 BOM + XLSX |
| FR-EXPORT-02 | M | ✅ | 4 sheet ตามชื่อ PRD |
| FR-EXPORT-03 | M | ✅ | pseudonym default (`test_anonymity.py`) |
| FR-EXPORT-04 | M | ✅ | Owner เท่านั้น + เหตุผล + audit `IDENTIFIED_EXPORT` |
| FR-EXPORT-05 | M | ✅ | `%Y%m%d-%H%M` ตาม timezone ห้อง |
| FR-EXPORT-06 | S | ✅ | `formula_version` ใน Metadata |

## §7.9–7.10 Notifications, Appeals, Audit

| ID | Pri | | หลักฐาน |
|---|:---:|:---:|---|
| FR-NOTIF-01..05 | M/S | ✅ | kinds `published`, `due` (48 ชม.), `regenerated`, `finalized`, `assigned` · ส่งอีเมลผ่าน `email_worker.py` |
| FR-NOTIF-06 | M | ✅ | `notification_href` ลิงก์ตรง · ไม่มีคะแนนในข้อความ |
| FR-APPEAL-01..02 | S | ✅ | `appeals.py` 7 วัน · resolve |
| FR-AUDIT-01 | M | ✅ | publish/unpublish/regenerate/override/finalize/reopen/identified export/identity view/role change |
| FR-AUDIT-02 | M | ✅ | actor, action, resource, before/after, UTC, IP, reason |
| FR-AUDIT-03 | M | ✅ | trigger `audit_log_no_update` · ไม่มี API ลบ/แก้ |

## §10 Quality signals

| ID | | หลักฐาน / หมายเหตุ |
|---|:---:|---|
| QS-01..06 | ✅ | `domain/quality.py` + tests |
| QS-07 | ⚠️ | ใช้ **Kendall's u** แทน Kendall's W เพราะผู้ประเมินแต่ละคนไม่ได้จัดอันดับครบชุด (เหตุผลใน `quality.py`) |
| FR-QS-01 | ✅ | สัญญาณไม่ลด/ลบคำตอบเอง |
| FR-QS-02 | ✅ | `:exclusion` พร้อมเหตุผล + recompute |
| FR-QS-03 | ❌ | ยังไม่มีการรวม QS-07 ข้ามหลาย assignment เพื่อรายงานว่า criterion เขียนไม่ชัด |

## §11 Data rules

| ID | | หลักฐาน |
|---|:---:|---|
| DR-01 | ✅ | เฉพาะ `SUBMITTED` |
| DR-02 | ✅ | soft-delete ด้วย `retired_at` (migration 018) แทน `generation` ใหม่ |
| DR-03 | ✅ | migration 010 protect final scores |
| DR-04 | ✅ | ไม่มี float ใน schema |
| DR-05 | ✅ | `timestamptz` 37 จุด ไม่มี `timestamp` เปล่า |

## §12 API

| ID | Pri | | หลักฐาน / หมายเหตุ |
|---|:---:|:---:|---|
| path ตาม §12 | — | ⚠️ | ความสามารถครบแต่ชื่อต่าง: `/scores` แทน `/reports/group|individual`, `/quality` แทน `/reports/quality`, `additional-evaluations` แทน `pairs:add-evaluators`, `reports:export` แทน `exports`, `/classrooms/{id}/audit` แทน `/assignments/{id}/audit`, `PUT` แทน `PATCH` · สัญญาจริงอยู่ที่ `docs/openapi.yaml` |
| FR-API-01 | M | ✅ | autosave idempotent (US-08) |
| FR-API-02 | M | ✅ | `Idempotency-Key` (migration 009) |
| FR-API-03 | M | ✅ | error shape เดียว (`test_error_shape.py`) |
| FR-API-04 | M | ✅ | 120/นาที, export 5/นาที, 429 + `Retry-After` (`test_rate_limit.py`) |
| FR-API-05 | S | ⚠️ | export เป็นแบบ synchronous ([ADR-006](adr/ADR-006-synchronous-export.md)) |

## §13 Non-functional

| ID | | หลักฐาน / หมายเหตุ |
|---|:---:|---|
| NFR-PERF-01..04 | ❌ | ดูตารางสรุป |
| NFR-PERF-05 | ✅ | recompute 2.98s ที่ 200 คน |
| NFR-AVAIL-01 | ⚠️ | มี alert/healthcheck ([ADR-005](adr/ADR-005-availability-and-alerting.md)) แต่ยังไม่มีการวัด uptime ต่อเดือน |
| NFR-AVAIL-02 | ❌ | RPO 24 ชม. · มี restore drill script วัด RTO |
| NFR-SCALE-01/02 | ⚠️ | dataset 204 คนรันได้ไม่มี error แต่ latency ไม่ผ่าน · spike 10× ยังไม่ได้ทดสอบ |
| NFR-COMPAT-01 | ⚠️ | Playwright รันบน Chromium อย่างเดียว ยังไม่มีหลักฐาน Safari/Firefox/Edge/มือถือ |
| NFR-COMPAT-02 | ✅ | e2e/design ตรวจ responsive |
| NFR-OBS-01 | ✅ | `requestId` + JSON log (`test_request_logging.py`) |
| NFR-OBS-02 | ✅ | `alerting.py` + tests |
| NFR-I18N-01 | ✅ | UI ไทย · BOM สำหรับ Excel |

## §14 Privacy, anonymity, security

| ID | Pri | | หลักฐาน / หมายเหตุ |
|---|:---:|:---:|---|
| FR-PRIV-01 | M | ✅ | `PrivacyNotice.tsx` + `privacy-ack` |
| FR-PRIV-02 | M | ✅ | `privacy_job.py` แทนด้วย pseudonym คงที่ |
| FR-PRIV-03 | M | ⚠️ | ดาวน์โหลดสำเนาเองทันที (`GET /api/me/data-copy`) แทนคำขอที่ตอบใน 30 วัน — เร็วกว่าเกณฑ์ |
| FR-PRIV-04 | M | ✅ | ไม่มีคะแนน/identity ใน notification |
| FR-ANON-01 | M | ✅ | นักศึกษาเรียก `/scores` และ export ได้ 403 · `my-score` ไม่มี field ระบุผู้ประเมิน |
| FR-ANON-02 | M | ✅ | `k_min = max(3, minComparisons)` |
| FR-ANON-03 | M | ⚠️ | ไม่มี delta หรือกราฟย้อนหลังตามกฎ **แต่** `my-score` คืน `individualEvaluatorCount` ซึ่งเปลี่ยนตามจำนวนคนที่ส่ง — เทียบกับคะแนนชั่วคราวที่คำนวณใหม่ทุกคืน ทำให้อนุมานแบบที่ PRD เตือนไว้ได้ง่ายขึ้น |
| FR-ANON-04 | M | ✅ | เตือนกลุ่ม m = 3 · ปิดฝั่งรายบุคคลได้ |
| FR-ANON-05 | M | ✅ | audit `EVALUATOR_IDENTITY_VIEWED` |
| FR-SEC-01 | M | ❌ | ดูตารางสรุป |
| FR-SEC-02 | M | ✅ | ownership check ที่ server (FR-AUTHZ-02) |
| FR-SEC-03 | M | ✅ | psycopg parameterized ทุก query |
| FR-SEC-04 | M | ✅ | escape `= + - @` ทั้ง import และ export (`test_csv_export_security.py`) |
| FR-SEC-05 | M | ✅ | `/api/test/*` ปิดเมื่อ `ENVIRONMENT=production` (`test_test_support_guard.py`) |
| FR-SEC-06 | M | ✅ | gitleaks ใน CI · secret อยู่ใน Render/GitHub secrets |
| FR-SEC-07 | S | ✅ | pip-audit, npm audit, gitleaks, CodeQL |

## §15 Accessibility

| ID | | หลักฐาน / หมายเหตุ |
|---|:---:|---|
| FR-A11Y-01 | ✅ | `role="radiogroup"` + ลูกศร/Home/End |
| FR-A11Y-02 | ✅ | text label ทุกตัวเลือก |
| FR-A11Y-03..04 | ✅ | `a11y.spec.ts` (axe) · [a11y-report.md](a11y-report.md) |
| FR-A11Y-05 | ✅ | keyboard + focus indicator |
| FR-A11Y-06 | ✅ | `aria-live="polite"` ที่สถานะ autosave |
| FR-A11Y-07 | ❌ | ทดสอบ NVDA/VoiceOver **ยังไม่ได้ทำ** (a11y-report.md บรรทัด 76) |

## §17 Open questions และ §19 Release plan

- OQ-1..OQ-8 — ดู [open-questions.md](open-questions.md) · **OQ-8 ยังเปิด** ข้ออื่นใช้ default รอผู้ตัดสินยืนยัน
- ข้อ "ห้ามตัด" ตาม §19 (FR-ANON-01, FR-AUTHZ-01/02, FR-AUDIT-01) — ✅ ครบทั้งหมด
- M4 Production Ready ยังไม่ผ่าน — NFR-PERF ที่ 200 users, FR-AUTH-02, FR-SEC-01, screen reader test

## ข้อจำกัดของการตรวจรอบนี้

- ไม่ได้รัน E2E บนเครื่อง — อ้างผล CI ของ PR #42
- ตัวเลข performance และ a11y มาจากเอกสารที่ทีมบันทึกไว้ ไม่ได้วัดซ้ำ
- ข้อ ✅ ที่ไม่มีชื่อ test ระบุไว้ ตรวจจากการอ่านโค้ดเท่านั้น
