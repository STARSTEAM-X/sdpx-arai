# Refactoring Plan — WS-08

วันที่ review: 2026-10-18 · baseline: `c69554c` · เลขบรรทัดด้านล่างอ้าง baseline โดยประมาณก่อน refactor

อ่าน AGENTS.md, memory-bank และข้อกำหนด WS-08 ก่อนตรวจ repository งานนี้คง stack, public signature และพฤติกรรมของ publish เดิม แยก security fix ที่ตั้งใจเปลี่ยนพฤติกรรมออกจาก refactor ไม่ใช้คำว่า “ไม่มีช่องโหว่” แทนผล static review

## Review Coverage

ตรวจ inventory ของ tracked files ทั้ง repo แล้วไล่ตาม flow และขอบเขตความรับผิดชอบ:

| ส่วน | ไฟล์/สิ่งที่ตรวจ | ข้อสังเกต |
|---|---|---|
| API และสิทธิ์ | `backend/app/api/*`, `auth.py`, `google_oidc.py`, `domain/access.py` | capability แยกตามงาน, คนนอกได้ 404, evaluator ownership แยกจาก classroom membership, test routes ขึ้นกับ production guard |
| Domain | assignment, pairing, scoring, roster, comparison, evaluation, finalize และ member services | pure pairing/scoring เหมาะกับ unit loop; publish handler ยังประกอบ logic มากเกินชั้น HTTP |
| Persistence | `backend/app/repositories/*`, migrations 001–011, `db.py`, `migrate.py` | parameterized SQL, transaction boundary, idempotency, final snapshots และ schema constraints |
| Frontend | routes/pages, `lib/*`, components ที่มี state เช่น ComparisonRow, AssignmentPanel, AssignmentScoringCard, MemberPanel, RosterImportCard และ shared/presentational components | ความเสี่ยงหลักอยู่ที่ autosave/submit coordination มากกว่าการแบ่งไฟล์เพราะความยาว |
| Delivery และ runtime | `.github/workflows/ci.yml`, `scripts/ci/*`, Compose/Docker, Render templates, `daily_scoring.py`, performance scripts | tests เป็น deploy gate, ตรวจ SHA ทั้ง web/API, public staging ใช้ production environment; หลักฐาน load ยังไม่ยืนยัน 200 users |
| Tests และเอกสาร | unit/API/integration/E2E suites, TEST_PLAN, API contract, architecture, WS-07 evidence | มีตาข่าย domain จำนวนมาก แต่เอกสารบางส่วนยังบอกสถานะ WS-01/WS-03 และ frontend happy-path E2E ไม่ครอบคลุม autosave ที่ยังค้าง |

นี่เป็น review ครอบคลุม subsystem พร้อมอ่าน flow สำคัญและค้นรูปแบบเสี่ยง ไม่ใช่ formal verification ของทุก execution path ไม่อ่าน `.env`, private fixtures หรือไฟล์ใน `performance/.secrets/` และไม่พิมพ์ secret จาก Git history รายละเอียด scan/ข้อจำกัดของสิทธิ์บัญชีอยู่ใน [security-pre-check.md](security-pre-check.md)

## High Priority

| ID | ไฟล์:บรรทัด | ประเภท / หลักฐาน | ผลกระทบหากไม่แก้ | การแก้ที่เล็กที่สุด / สถานะ |
|---|---|---|---|---|
| H1 | `backend/app/config.py:67` | insecure default: production ยอมใช้ค่า session signing key สำหรับ dev ที่อยู่ใน source หากไม่ตั้ง env และผ่านเกณฑ์ความยาว | ผู้ที่รู้ค่า default สามารถสร้าง token ได้ หาก deployment พลาดการตั้ง secret; เป็นเส้นทางผิด configuration ที่ยืนยันจาก code ไม่ใช่หลักฐานว่าระบบออนไลน์ใช้ค่านี้ | รับใน WS-08: fail startup ใน production เมื่อไม่มีค่า/เป็น dev default พร้อม regression tests; ดูผลจริงใน security pre-check |
| H2 | `backend/app/api/scoring.py:189` | CSV output boundary ไม่ escape formula; `criterion_name` และ label ถูกเขียนด้วย `csv.writer` โดยตรง การ escape เฉพาะ roster import ไม่คุ้มครอง criterion ที่สร้างผ่าน API | spreadsheet อาจตีความค่าจากผู้ใช้เป็นสูตรเมื่อเปิด export; ความรุนแรงขึ้นกับโปรแกรม/การยืนยันของผู้เปิด ไม่ใช่การรันโค้ดใน server | รับใน WS-08: escape เฉพาะ string cell ที่เสี่ยงที่ export boundary, test ทั้ง anonymous/identified value และเซลล์ปกติ |
| H3 | `frontend/src/components/ComparisonRow.tsx:38`, `frontend/src/pages/EvaluatePage.tsx:100` | async coordination: choice อยู่ใน child และรอ debounce 2 วินาที; unmount เคลียร์ timer; submit ไม่รอ pending save และนับ `item.choice` ของ parent ที่ยังไม่อัปเดต | เลือกแล้วสลับฝั่ง/ออกหน้าก่อน timer ทำงาน คำตอบอาจไม่ถึง server; กดส่งเร็วอาจส่งเฉพาะคำตอบเก่าและแจ้งจำนวนยังไม่ตอบผิด | เลื่อนเป็น correctness follow-up เร่งด่วน: ก่อนแก้เพิ่ม E2E เลือก→สลับฝั่งทันที, เลือก→submit ทันที และ network delay; ใช้สถานะ pending/flush ที่ parent รับรู้ ไม่ต้องเพิ่ม state library |
| H4 | `backend/app/api/assignments.py:339`, `backend/app/repositories/pg_assignment_repo.py:294` | check-then-write concurrency risk: อ่าน DRAFT โดยไม่ lock แล้ว UPDATE ไม่มี predicate สถานะ | publish สอง transaction อาจใช้ seed/ชุดคู่ต่างกัน แต่บันทึก audit ว่าสำเร็จทั้งสองครั้ง | เลื่อนจาก refactor ที่คงพฤติกรรม: ต้องพิสูจน์ด้วย 2 connection concurrent integration test ก่อน เลือก row lock/conditional transition และตรวจทุกเส้นทางแก้เกณฑ์ร่วมกัน ไม่อ้างว่าทดลองพบแล้ว |

H3 ยืนยัน control flow จาก source แต่ยังไม่ได้ reproduce ใน browser; H4 เป็น hypothesis ของ concurrent execution ไม่ควรนำมานับเป็น security issue ที่แก้แล้ว

## Medium Priority

| ID | ไฟล์:บรรทัด | ประเภท / หลักฐาน | ผลกระทบหากไม่แก้ | การแก้ที่เล็กที่สุด / สถานะ |
|---|---|---|---|---|
| M1 | `backend/app/api/assignments.py:323` | long method / mixed responsibilities: endpoint ตรวจ feasibility และวนสร้างคู่สองฝั่งเองร่วมกับ HTTP, persistence และ audit | ทดสอบ orchestration ของการสร้างคู่ยาก และเปลี่ยนเงื่อนไขฝั่งหนึ่งอาจกระทบอีกฝั่ง | รับใน WS-08: extract pure lazy `generate_assignment_pairs` ไป `domain/publication.py` ให้ route คง authorization, transaction, save, audit และ response เดิม ไม่เพิ่ม service/repository framework |
| M2 | `backend/app/api/assignments.py:328`, `backend/migrations/002_assignment_and_pairing.sql:65` | input/schema mismatch: Python `int` ของ seed ไม่มีขอบเขต แต่ DB เป็น signed bigint | seed เกินขอบเขตอาจเกิด DB error/500 หลังสร้างคู่แล้ว; negative seed อย่างเดียวไม่ใช่ bug เพราะ Python RNG รองรับ | เลื่อน: เพิ่ม boundary regression ที่ HTTP+DB แล้วกำหนด range ตาม contract; เป็น validation behavior change จึงไม่ปนกับ refactor |
| M3 | `backend/app/repositories/pg_assignment_repo.py:320` | persistence hot path: INSERT ทีละ pair | จำนวน execute โตตามจำนวนคู่ แต่ source อย่างเดียวไม่พิสูจน์ network round trip หรือคอขวด CPU/DB | เลื่อน: แยกเวลา generation/DB, วัดก่อนและหลัง batch ด้วยข้อมูลเดียวกันก่อนเลือก `executemany`/COPY; ไม่ใช้ตัวเลข WS-07 เก่าฟันธง bottleneck |
| M4 | `backend/app/api/roster.py:104` | size guard หลัง allocation: `await file.read()` ทั้งก้อนก่อนตรวจ 2 MiB | ไฟล์ใหญ่ถูกอ่านเข้า memory ก่อนถูกปฏิเสธ | เลื่อน: bounded read ที่ limit+1 พร้อม test ขอบเขต; ต้องประเมิน multipart/server request limit ร่วมด้วย เพราะ bounded read อย่างเดียวไม่ป้องกันการรับ body ทั้งหมด |
| M5 | `backend/app/scoring_orchestrator.py:25`, `backend/app/domain/scoring_service.py:105` | repeated scanning: กรอง comparisons ใหม่ต่อ item และต่อ criterion | CPU โตเมื่อ input ใหญ่; ยังไม่มีหลักฐานว่าทำให้ NFR พลาด | เลื่อนจน profiling ยืนยัน แล้วค่อยสร้าง index จากข้อมูลที่รับมาโดยยังคง pure function และ golden tests |
| M6 | `frontend/src/lib/session.ts:1` | credential storage trade-off ที่ repo บันทึกไว้เอง: token อยู่ใน localStorage | หากมี XSS หรือ script ที่ถูกยึด token จะถูกอ่านได้; ไม่ใช่หลักฐานว่ามี XSS ในหน้าปัจจุบัน | เลื่อน migration เป็น HttpOnly cookie เพราะกระทบ CORS, CSRF, login/logout และ E2E ต้องออกแบบและตัดสินใจร่วมกันก่อน ไม่เปลี่ยน auth architecture เพียงเพื่อให้ review ดูครบ |

## Low Priority

| ID | ไฟล์:บรรทัด | ประเภท / ผลกระทบ | การตัดสินใจ |
|---|---|---|---|
| L1 | `backend/app/repositories/pg_assignment_repo.py:304` | dead parameter: `mark_published(at=...)` รับเวลาแต่ไม่เก็บ ทำให้เข้าใจผิดว่ามี published_at | เลื่อน: audit มี event timestamp อยู่แล้ว ไม่เพิ่ม column/เปลี่ยน signature ระหว่าง refactor เพียงเพื่อลบ `_ = at` |
| L2 | `docs/architecture.md:1`, `frontend/TEST_PLAN.md:1`, `memory-bank/intent.md` | documentation drift: สถานะ M1/Google login/จำนวน test ยังเป็นประวัติ ไม่ตรง implementation ใหม่ | รับเป็นงานเอกสารภายหลังผล verification รอบนี้ ใช้ docs/loop-metrics.md และ evidence ลงวันที่เป็นแหล่งสถานะปัจจุบัน ห้ามแทนค่าด้วยการเดา |
| L3 | `frontend/src/lib/api.ts:11`, `frontend/src/lib/api.ts:21` | observability gap: contract มี requestId แต่ ApiError ไม่เก็บให้ UI ใช้แจ้งปัญหา | เลื่อน: ส่ง requestId ผ่าน ApiError เมื่อมี flow support ที่ต้องใช้จริง ไม่ต้องสร้าง generic error framework |

## What AI Suggested vs What We'll Do

ตารางนี้เป็นข้อเสนอและการเลือกขอบเขต implementation ของ agent ภายใต้คำสั่ง “เริ่มทำ” เพื่อให้ทีมตรวจและอธิบายได้ ไม่อ้างว่าสมาชิกทุกคนได้ review/อนุมัติแต่ละแถวแล้ว

| AI เสนอ | ตัดสินใจ | เหตุผลเฉพาะโครงการ |
|---|---|---|
| แยก publish เป็น PublishService พร้อม repository abstraction ใหม่ | รับบางส่วน / ไม่รับ framework | แยก pure pair generation ก็ทดสอบเงื่อนไข GROUP/INDIVIDUAL ได้ โดย route ยังรักษา transaction และ save order เดิม; ยังไม่มี concrete need สำหรับ abstraction อีกชุด |
| ให้ GROUP และ INDIVIDUAL ใช้ generic strategy class/loop เดียว | ไม่รับ | สองฝั่งใช้ feasibility และ input ต่างกันจริง D4/P10 เป็นกฎธุรกิจ การบังคับรวมทำให้ต้องเพิ่ม branching/adapter โดยไม่ลดความเสี่ยง |
| แก้ race พร้อม refactor publish | เลื่อน | race ต้องมี concurrent integration test และตั้ง semantics ของผู้แพ้ก่อน เป็น behavior change แยกจากการพิสูจน์ว่าพฤติกรรม refactor เดิมยังอยู่ |
| batch INSERT เพราะ “1 round trip ต่อคู่” เป็นคอขวดแน่ | เลื่อน / ไม่รับคำยืนยัน | per-row execute มีจริง แต่ driver/protocol และ CPU ต้องวัดแยก หลักฐานปัจจุบันยังยืนยันที่มาของ latency ไม่ได้ |
| seed ติดลบต้องผิดเสมอ | ไม่รับ | ไม่มีกติกา PRD ที่ห้าม signed seed และ RNG ใช้งานได้; ปัญหาที่ต้องพิสูจน์คือค่าที่ DB เก็บไม่ได้ |
| `DELETE ... WHERE criterion_id` ทำให้ลบงานอื่นได้เพราะ UUID uniqueness ไม่ถูกบังคับ | ไม่รับเป็นช่องโหว่ที่ยืนยันแล้ว | `criterion.id` เป็น PRIMARY KEY และ pair มี FK ใน migration 002; route สร้าง/โหลด criterion จากงานที่ตรวจสิทธิ์แล้ว ไม่รับ criterion ID อิสระจาก request |
| อ่าน `X-Forwarded-For` ตรง ๆ แทน `request.client.host` | ไม่รับ | request header ปลอมได้หากยังไม่ตั้ง trusted proxy boundary; ต้องพิสูจน์ proxy chain จริงและ retention requirement ก่อน |
| ย้ายสูตรไป SQL หรือเก็บ incremental state เพื่อให้เร็ว | ไม่รับในรอบนี้ | AR-01 เป็นการตัดสินใจที่มีแล้ว ผล profiling ยังไม่รองรับการย้าย; เปรียบเทียบข้อแลกเปลี่ยนไว้ใน ADR-001 |
| คงการ escape formula เฉพาะ roster import | ไม่รับ | export ยังรับ criterion และข้อมูลจากเส้นทางอื่น ต้องป้องกันที่ CSV output boundary |
| ปิด production หากไม่ได้ตั้ง session key ที่ปลอดภัย | รับ | default ที่ทุกคนอ่านได้ต้องไม่กลายเป็นคีย์ใช้งานจริงเมื่อ configuration ตกหล่น |
| เพิ่ม dependency หรือเปลี่ยน stack เพื่อทำ security review | ไม่รับ | ใช้ของเดิมและ targeted regression ได้ การอัปเดต patch ของ transitive dependency ที่มีอยู่แล้วเพื่อแก้ advisory แยกบันทึกใน security pre-check |

## ตรวจซ้ำ AI review เดิม

[ai-review.md](ai-review.md) เป็นหลักฐาน homework เก่า คงข้อความเดิมไว้แล้วใช้ตารางนี้แก้ความเข้าใจ ไม่ลบหลักฐานเดิมให้ดูเหมือนไม่เคยเสนอ:

| ข้อเดิม | ผลตรวจใน WS-08 |
|---|---|
| #1 race condition | พบรูปแบบเสี่ยงใน source แต่ยังไม่ยืนยันด้วย concurrent integration run |
| #2 INSERT ทีละแถว | พบจริง; ไม่ยืนยันคำอธิบาย latency เดิมหรือตัวเลข Render เก่าว่าเป็นผลของ candidate นี้ |
| #3 ต้องผ่าน E2E ทางเดียว | ก่อน refactor ไม่มี dedicated publish harness แต่สามารถสร้าง characterization test ที่แทน DB boundary ได้ จึงไม่จำเป็นต้องเพิ่ม framework เพื่อให้ทดสอบได้ |
| #4 seed ไม่มีขอบเขต | source/schema mismatch จริง แต่ยังไม่ได้ยิง DB overflow; ข้ออ้างว่า negative seed ผิดถูกปฏิเสธ |
| #5 loop ซ้ำ | มีโครงคล้ายกัน แต่กฎต่างกันจริง; extract ตาม domain boundary โดยไม่ generic เกินจำเป็น |
| #6 เวลา at ถูกทิ้ง | พบจริง เลื่อนการเปลี่ยน signature/เพิ่ม schema |
| #7 criterion UUID ไม่มี constraint | ไม่จริงตาม schema: `criterion.id` เป็น PRIMARY KEY |
| #8 IP ไม่มีประโยชน์และควรใช้ forwarded header | ยังขาดหลักฐาน deployment/retention policy ไม่สรุปว่าค่านี้คือ proxy เสมอและไม่เชื่อ forwarded header โดยตรง |

## สิ่งที่ AI มองไม่เห็น (ต้องอาศัย business context)

- **“บันทึกแล้ว” ไม่เท่ากับ “ส่งแล้ว”**: autosave เป็น draft และ participation นับ SUBMITTED การเร่ง submit โดยไม่รอ save อาจทำให้นักศึกษาเสียคะแนน แม้ API แต่ละตัวทำงานถูกต้องเมื่อเรียกแยกกัน
- **GROUP/INDIVIDUAL ไม่ใช่ loop ที่เหมือนกันทุกกรณี**: individual coverage ผูกกับขนาดกลุ่ม (`m−2`), `individualMaxScore=0` ต้องไม่มีคู่ฝั่งบุคคล และ k-anonymity อาจซ่อนคะแนนของกลุ่มเล็กโดยตั้งใจ
- **คะแนนต่ำไม่ใช่หลักฐานว่า free-rider**: คุณภาพงานและ participation เป็นคนละค่า ห้าม refactor ให้รวมเป็นศูนย์ก้อนเดียว หรือเปลี่ยน band mapping ให้เป็น normalization
- **การ replay คะแนนต้องมีข้อมูลเดิมด้วย**: pure function ช่วยให้ deterministic แต่ไม่ได้ทำให้ roster/คำตอบปัจจุบันเท่ากับข้อมูล ณ วัน finalize ต้องรักษา final snapshots
- **ขอบเขตอำนาจต่างกัน**: CO_TEACHER จัดการ assignment ได้ แต่ OWNER เท่านั้นที่ finalize และเปิดเผยตัวตนผู้ประเมิน ห้ามรวม capability เพื่อลดโค้ดซ้ำ
- **public staging ใช้ production guard**: ชื่อ deployment tier ไม่ใช่ข้ออ้างให้เปิด `/api/test/*`; performance fixture มีเส้นทางแยกอยู่แล้ว
- **baseline 10 VUs ไม่ยืนยัน 200 users**: ผล WS-07 ที่ผ่านหนึ่งรอบไม่ใช่เหตุผลให้ refactor performance แบบคาดเดาหรืออ้างว่า NFR ผ่านครบ

ข้อเหล่านี้อนุมานจาก PRD, memory-bank และ code ที่มีอยู่ ไม่ได้อ้างการสัมภาษณ์ผู้สอน/นักศึกษาหรือคำยืนยันของทีมที่ยังไม่มี

## Verification และขอบเขตการส่ง

ผลก่อน/หลัง refactor และ test ที่รันจริงอยู่ใน [refactoring-publish-assignment.md](refactoring-publish-assignment.md); security regression และ scan evidence อยู่ใน [security-pre-check.md](security-pre-check.md) เอกสารนี้จัดลำดับและแยกข้อพิสูจน์แล้วออกจาก hypothesis ไม่ใช้เป็นหลักฐานว่า tests/CI ผ่านโดยลำพัง

ก่อนประกาศ WS-08 ครบ ต้องตรวจลูป unit/lint ทั้งสองฝั่ง, API contract/typecheck, integration และ E2E ตามสิ่งที่เปลี่ยน พร้อมหลักฐาน CI และ human presentation readiness แยกกัน การเพิ่ม regression file สำหรับ security หรือ characterization ไม่ใช่การแก้ assertion เดิมเพื่อให้ refactor ผ่าน
