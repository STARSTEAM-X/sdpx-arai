# WS-08 — ชุดหลักฐานและแนวทาง present

วันที่: 2026-10-18 · baseline develop `c69554c` · branch `codex/ws08-quality-security`.

**สถานะ (อัปเดต 2026-10-20): ผ่านเกณฑ์ของ lab ทุกข้อที่ตรวจจาก repo/CI ได้.**
CodeQL scan `main` แล้ว (Python, JS/TS, Actions — open 3 warning คัดกรองเป็น false positive);
security fix เพิ่มเป็น 3 ข้อ (SEC-03 ไม่เผยเหตุผลภายในตอน token ตรวจไม่ผ่าน);
CI ของ `main` (merge PR #24) และ `develop` เขียวครบทุก job.
**เหลือเฉพาะสิ่งที่ทีมต้องทำเอง:** present, ส่ง LMS และยืนยันว่าทุกคนอธิบาย refactoring decisions ได้.

| เกณฑ์ผ่านของ lab | สถานะ | หลักฐาน |
|---|---|---|
| Test เขียวทั้งหมดหลัง refactor และ CI เขียว | ✅ | backend 727, frontend 48, integration 57, E2E 149 · CI `main` f343fde และ `develop` f9f0d64 เขียว |
| ไม่มีไฟล์ test ถูกแก้ระหว่าง refactor | ✅ | `git diff --stat eff6ed1 ec0b7a6 -- backend/tests frontend/src e2e` ว่าง (ด้านล่าง) |
| Refactoring plan ระบุเห็นด้วย/ไม่เห็นด้วยกับ AI | ✅ | [refactoring-plan.md](refactoring-plan.md) |
| แก้ security ≥2 ข้อพร้อม test | ✅ 3 ข้อ | SEC-01..03 ใน [security-pre-check.md](security-pre-check.md) |
| ADR ครบทุก section | ✅ | [ADR-001](adr/ADR-001-pure-scoring-engine.md) |
| ทุกคนในกลุ่มอธิบายได้ | ⏳ ทีมยืนยันเอง | agent ยืนยันแทนไม่ได้ |
ผล CI ตรวจจาก [Actions ของ branch](https://github.com/STARSTEAM-X/sdpx-arai/actions?query=branch%3Acodex%2Fws08-quality-security)
และ required checks ของ PR; ห้ามใช้ local results แทน CI.

## Artifacts ตาม source lab

| Artifact | สิ่งที่มี |
|---|---|
| [AI homework review](ai-review.md) | เก็บผลเดิม พร้อมชี้ไปผลตรวจซ้ำ |
| [Refactoring plan](refactoring-plan.md) | Review ทุก subsystem, ลำดับปัญหา, รับ/ไม่รับ/เลื่อน AI และ business context |
| [Refactor before/after](refactoring-publish-assignment.md) | publish 93→61 บรรทัด, pure lazy generation, baseline comparison และ tests |
| Refactored code | `backend/app/domain/publication.py` และ route เดิมที่เรียก helper |
| [Security pre-check](security-pre-check.md) | ผลสแกน/Git history, GitHub screenshots, OWASP, checklist และ fixes/tests |
| [Security red/green proof](ws08-security-findings.md) | 10 red ก่อนแก้ → 17 green; เหตุผลปรับ production fixture |
| [ADR-001](adr/ADR-001-pure-scoring-engine.md) | AR-01 ที่ตัดสินใจไว้จริง: pure scoring, alternatives/trade-offs/revisit |

## ผลที่รันจริง

| ตรวจ | ผล |
|---|---|
| Characterization ก่อน refactor + assignment | 28 passed, 1.20s |
| Characterization + assignment + pairing หลัง refactor | 121 passed, 1.15s |
| Baseline vs current publish | 8 สถานการณ์ response/pair/audit/call order/error ตรงกัน |
| Security regression ก่อน / หลัง | 10 failed + 7 passed → 17 passed; รวม auth/anonymity/deployment 26 passed |
| Backend unit/API | 428 passed, 29 integration deselected, 4.50s |
| Frontend unit | 21 passed, Vitest 441ms ในรอบ unit loop |
| Unit loop สองคำสั่งต่อเนื่อง รวม process startup | **8.04s <10s** |
| Ruff / frontend lint / typecheck / build | ผ่าน; frontend lint มี 16 warning เดิม ไม่มี error ไม่ปิด rule |
| API contract lint | ผ่าน ไม่มี warning/error |
| Docker PostgreSQL integration | 29 passed, 1.24s, exit 0 |
| Docker full E2E บน built web/API/Postgres | **118 passed, 1.7m**, exit 0 |
| npm ci จาก lockfile ใหม่ | ติดตั้ง 91 packages; frontend 21 tests ผ่านซ้ำ 213ms |
| Dependency audit | npm root/frontend 0 advisories; OSV 42 installed distributions ไม่พบ advisory |
| History / runtime logs | 93 commits / 699 text blobs ไม่มี live secret ที่ยืนยันได้ในขอบเขต heuristic; 3,583 service JSON lines + 12 migration CLI lines, raw email/JWT 0 |

Unit timing แยกจาก lint/build/integration/E2E. venv เก่าอ้างเครื่องเดิม จึงซ่อม interpreter
ใน ignored `.venv`; Vitest/Python subprocess รันนอก sandbox เพื่อเขียน temp/spawn ได้ตามปกติ.
ไม่แก้ tests/timeouts เพื่อซ่อน environment failures.

## พิสูจน์ว่า refactor ไม่แตะ tests

- `eff6ed1`: เพิ่ม characterization ก่อน refactor บน production code เดิม.
- `ec0b7a6`: extraction และเอกสาร before/after; **ไม่มี test file ใน commit นี้**.
- Security fix แยก commit: เพิ่ม regression และ key สังเคราะห์ใน production subprocess fixture
  ตาม requirement ใหม่ โดยคง assertion เดิมทุกข้อ.

```powershell
git show --stat ec0b7a6
git diff --stat eff6ed1 ec0b7a6 -- backend/tests frontend/src e2e
```

คำสั่งที่สองไม่มี output. ไม่ใช้ `main...HEAD -- tests/` โดยไม่ดู context:
main มีเพียง `.gitattributes` และ tests อยู่ใต้ backend/frontend/e2e.
diff ทั้ง branch มี security test changes ตาม requirement จึงไม่อ้างว่า branch ทั้งหมดไม่แตะ tests.

## Reproduce

จาก root รันแต่ละ suite จบก่อนเริ่ม suite ถัดไป เพราะใช้ test DB project เดียวกัน:

```powershell
docker compose -f compose.test.yaml up unit-api --build --abort-on-container-exit --exit-code-from unit-api
docker compose -f compose.test.yaml up unit-web --build --abort-on-container-exit --exit-code-from unit-web
docker compose -f compose.test.yaml up integration-api --build --abort-on-container-exit --exit-code-from integration-api
docker compose -f compose.test.yaml --profile e2e up e2e --build --abort-on-container-exit --exit-code-from e2e
docker compose -f compose.test.yaml --profile e2e down -v
```

Unit loop <10s วัด native Python/npm หลังติดตั้ง dependencies ไม่รวม Docker build/startup.
ตั้ง `ENVIRONMENT=test` สำหรับ native pytest แล้วใช้คำสั่งตาม AGENTS.md;
security tests ไม่อ่าน developer dotenv.

## Present 10 นาที

| เวลา | สิ่งที่แสดงและอธิบาย |
|---|---|
| 0:00–1:00 | before/after: HTTP handler รวมกฎสร้างคู่เดิม |
| 1:00–2:00 | ทำไมเลือก lazy generator และคง generate→save/transaction/audit |
| 2:00–3:00 | รัน characterization/pairing และแสดง refactor commit ที่ไม่แก้ tests |
| 3:00–4:00 | CSV injection หรือ production fallback พร้อม red→green regression |
| 4:00–5:00 | ADR: ทางเลือกที่ไม่เลือก ข้อแลกเปลี่ยน และเงื่อนไข revisit |
| 5:00–10:00 | ตอบเรื่องข้อเสนอ AI ที่ปฏิเสธ, test แดง, seed endpoint หลุด production และ “เปิด scanning” ต่างจาก “มีผล scan” |

สมาชิกทุกคนต้องซ้อมอธิบายจริง ไม่ใช้เอกสารนี้เป็นหลักฐานว่าทุกคนเข้าใจแล้ว.

## สิ่งที่ยังเหลือและข้อจำกัด

1. ~~CodeQL first scan~~ — scan แล้วหลัง release PR #24 merge เข้า `main` ตามเส้นทางปกติ (2026-10-20).
2. ~~CI checks บน PR head~~ — PR #24 required checks ผ่าน; human review, present และ LMS ยังต้องยืนยันจริง.
3. Autosave/submit coordination, concurrent publish และ seed bigint validation เป็น follow-ups ใน refactoring plan.
4. ไม่อ้าง performance optimization จาก WS-08; ผล NFR 200 users (ไม่ผ่านบน free plan) และการย้ายเกณฑ์
   รายเส้นทางไปวัดที่ server อยู่ใน [performance-report.md](performance-report.md) (WS-07, 2026-10-20).

## ข้อสังเกตจาก loops ตลอดโครงการ

Unit loop ของ pure domain ตรวจสูตรได้เร็ว; integration/E2E ตรวจ SQL, ownership และ audit
ที่ fake พิสูจน์ไม่ได้. WS-06–07 แสดงว่า CI เขียวไม่เท่ากับ latency ผ่าน จึงต้องเก็บผลแดงและ
ขอบเขต dataset/runner ไว้. WS-08 แสดงว่าต้องตรวจข้อเสนอ AI ด้วย schema/reproduction:
UUID มี constraint จริง ส่วน race/DB bottleneck ยังเป็น hypothesis.
นี่เป็นข้อสังเกตจาก repo/ผลรัน ไม่ใช่คำตอบแทนประสบการณ์ของสมาชิกแต่ละคน.
