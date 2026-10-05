# Loop Metrics — WS-06

## Candidate 2026-10-05

วัดบน Windows ด้วย Node 24.20, Python 3.12.14 และ PostgreSQL 18 ที่แยกจาก service เดิม.
เครื่องนี้ไม่มี Docker; native tests ด้านล่างไม่ใช้แทนหลักฐาน Docker CI.
ตัวเลขที่รอวัดไม่ใช่ค่าประมาณ.

| ตัวชี้วัด | ก่อน candidate / ประวัติ | Candidate ตรวจจริง |
|---|---|---|
| Backend unit/API | base Sup 393 tests | 404 passed, 29 integration deselected, 3.05s |
| Frontend unit | 21 tests | 21 passed, Vitest duration 0.311s |
| Unit loop ตั้งแต่เริ่มคำสั่งจนจบ | เป้าหมาย ≤10s | 5.86s รวม backend + frontend ตามลำดับ |
| Coverage | Sup backend 67% | backend 67%, frontend statements 2.96%; test เว็บครอบคลุม utilities ไม่ใช่ทุกหน้า |
| Integration | 29 tests | 29 passed, 2.39s, ไม่มี skip |
| E2E | 118 tests | 118 passed, 2.4min หลัง migrate DB แยกครบ |
| API contract | ต้องไม่มี warnings | Redocly valid, 0 warnings |
| Workflow static check | — | actionlint 1.7.12 ผ่าน; shellcheck ไม่ได้ติดตั้ง |
| Pipeline Docker | [Sup PR #17 run เดิม](https://github.com/STARSTEAM-X/sdpx-arai/actions/runs/37211760610) | [Candidate 7db9796](https://github.com/STARSTEAM-X/sdpx-arai/actions/runs/37244353349) ผ่านทั้ง 7 checks, 4m29s |
| Lead time commit → staging | WS-01 web 42s (ไม่มี gate) | CI deploy 90fe6d9: 359.7s (รวม test gates); manual ก่อนหน้า 690.2s แยกไว้ด้านล่าง |
| Deploy DB replacement | — | Render deploy 15449ab Live, 71s; migration 11 ชุด |
| Deployment frequency | นับ push อย่างเดียวไม่ยืนยัน deploy สำเร็จ | 1 staging release ผ่าน test gates เมื่อ 2026-10-05; performance ของ release นี้ไม่ผ่าน |

ผล k6 แยกใน [performance-report.md](performance-report.md); local baseline ไม่ใช่ staging baseline.

## Gates ที่ตั้งบนบัญชีจริงแล้ว

2026-10-05 ตรวจ GitHub API ยืนยัน:

- main: 1 review, required checks ทั้ง 7, up-to-date branch, enforce admins,
  block force push/deletion และ resolve conversations.
- production environment: required reviewer STARSTEAM-X และ branch policy main.
- secret scanning และ push protection enabled.
- staging environment: เจ้าของบัญชีใส่ secrets ครบ 4 ชื่อแล้ว เมื่อ 07:21–07:23; ตรวจชื่อเท่านั้น.
- Render API/เว็บ Auto-Deploy Off, Blueprint Auto Sync No.
  ภาพอยู่ใน docs/screenshots/render-api-ci-gate-20261005.jpg และ render-web-ci-gate-20261005.jpg.

Required checks บน main ไม่รวม performance ที่รันหลัง staging deploy.
Production service/DB แยกยังไม่สร้าง; template อยู่ใน render.production.yaml.

## ปัญหาที่แก้ก่อน push

| ปัญหา | วิธีแก้ / verification |
|---|---|
| E2E build ยังไม่มี API/เว็บ dependency images | compose build --with-dependencies e2e |
| Test ของ deploy script อยู่นอก backend Docker context | ใช้ stdlib unittest ใน scripts/ci แยกจาก pytest; assertions เดิมครบ |
| runner.temp ใช้ไม่ได้ใน job-level env | cache path .local/build-cache; actionlint ตรวจผ่าน |
| Native DB timezone ต่างจาก Docker | ตั้ง DB ทดสอบเป็น UTC; ไม่แก้ assertions |
| PowerShell npm launcher ชี้ global npm ที่ไม่มีไฟล์ | รัน npm CLI ของ Node ที่ติดตั้งไว้; ไม่แก้ dependency |
| Public staging test-session endpoint ขัด AGENTS | ENVIRONMENT=production; fixture CLI จาก staging credentials แทน |

CI รอบแรก [37244218180](https://github.com/STARSTEAM-X/sdpx-arai/actions/runs/37244218180)
พบ Vitest ลบ coverage directory ที่เป็น mount root ไม่ได้ (EBUSY); แก้ให้รายงานอยู่
ใน /reports/coverage ภายใน mount เดียวกับ JUnit โดยไม่แก้ tests.
จำนวน push เพื่อแก้ Docker CI: 1 หลัง initial PR push; รอบที่แก้แล้วเขียว.

## Docker CI ที่ผ่านจริง

Run 37244353349, head 7db9796, 2026-10-05 06:36:12–06:40:41 Asia/Bangkok.

| Job | เวลารวม setup/report/teardown |
|---|---:|
| lint-api | 6s |
| lint-fe | 12s |
| lint-be | 9s |
| test-fe | 35s |
| test-be | 38s |
| integration-be | 34s |
| e2e | 221s (test จริง 97s, 118 passed) |

E2E เป็น job ที่ช้าที่สุด; ผลนี้เป็น first E2E image/cache ของ candidate.
cache ช่วย setup ในการรันครั้งต่อไป แต่ยังไม่สรุปว่าเร็วขึ้นจนกว่าจะวัด.
Deploy/performance skipped บน PR ตามเงื่อนไข; ไม่ใช่หลักฐานว่า deploy ผ่าน CI แล้ว.

## Failure proof ตาม Source

[PR ทดลอง #19](https://github.com/STARSTEAM-X/sdpx-arai/pull/19) head 6242423
→ main ใช้ implementation health ผิด โดยไม่แก้ existing tests.
[Run 37244411279](https://github.com/STARSTEAM-X/sdpx-arai/actions/runs/37244411279):
backend 403 passed / 1 failed, container และ compose exit 1.
GitHub รายงาน mergeStateStatus=BLOCKED และปุ่ม Merge disabled;
ภาพ [merge-blocked.png](screenshots/merge-blocked.png). ปิด PR แล้วโดยไม่ merge.

ใน branch ทดลองเดียวกัน k6 smoke ยิง staging health ด้วย p95<0.0001ms;
ได้ p95 730.24ms และ job exit **99**, จึงพิสูจน์ threshold failure บน CI จริง.
Job นี้ไม่เรียก Render deploy; GitHub แสดง deployment record เพราะใช้ staging environment.
กลับ branch งานจริงที่ health=ok และเกณฑ์เดิมครบ; ไม่ merge branch ทดลอง.

## Staging verification หลัง CI เขียว

2026-10-05 deploy **7db9796** ด้วย Dashboard ระบุ SHA เดียวกัน:
เว็บ Live ใน 14.3s, API Live ใน 72.8s; script verify-only รอ 21.6s.
Commit-to-verified-live 690.2s รวมเวลาตรวจ CI และขั้นตอน deploy ด้วย Dashboard จึงห้ามใช้
เทียบกับ automated commit-to-live. เปลี่ยน ENVIRONMENT/DEPLOYMENT_TIER ผ่าน Render API
ทำให้ Render deploy branch ปัจจุบันหนึ่งรอบ แม้ Auto-Deploy Off; รอบระบุ SHA ใช้ Dashboard.

API health: status=ok, version=7db9796, environment=production, deploymentTier=staging.
Web build-info version ตรง full SHA; OpenAPI มี /api/test/* **0 paths**.
ภาพ [render-staging-7db9796-20261005.jpg](screenshots/render-staging-7db9796-20261005.jpg).
Smoke 3 VUs/30s ผ่าน p95 64.22ms, 87 requests, 0 errors, exit 0.
ผลรอบนี้เป็น manual verification ก่อน automatic deployment ด้านล่าง;
production resources ยังเป็น template.

## Automatic staging deployment และ performance gate

PR #18 merge เข้า develop เป็น 90fe6d99e85c59c319d22048108346dad28b6900.
[Run 37247458310](https://github.com/STARSTEAM-X/sdpx-arai/actions/runs/37247458310)
เริ่ม 07:25:20 และจบ 07:34:30 Asia/Bangkok (9m10s).
Required checks ทั้ง 7 ผ่าน; deploy-staging ผ่าน; performance **fail** ด้วย exit 99.
deploy-production skipped เพราะเป็น develop ตามเงื่อนไข.

| Job / ตัวชี้วัด | ผลจริง |
|---|---|
| Required test gates | ครบใน 4m34s; E2E 118 passed |
| Deploy verification script | 76.6s; commit-to-verified-live 359.7s |
| Render web | deploy_hook, Live, 16.9s |
| Render API | deploy_hook, Live, 74.2s |
| Staging journey | 335 requests, 58 complete/0 interrupted iterations, 0 errors |
| Autosave p95 | 317.95ms >300ms; จึงทำให้ performance gate แดงจริง |
| Submit p95 | 393.44ms ≤800ms |

ตรวจ public health: status=ok, version=90fe6d9, environment=production,
deploymentTier=staging. Web build-info เป็น full SHA ตรงกัน; test paths ใน OpenAPI =0.
ฐานข้อมูล migration 11 ชุด, synthetic load accounts 61 (60 นักศึกษา + 1 อาจารย์).
CI ลบ private fixture หลังจบแม้ threshold fail แต่พบว่า k6 แนบ session ใน setup_data
ของ summary-export. ลบ artifact รอบนี้แล้วและเจ้าของเปลี่ยน SESSION_SECRET ทั้งสองระบบ.
baseline ใน repo นำ setup_data ออกโดยคง metrics เดิม; CI ที่แก้แล้วกรองข้อมูลก่อน upload
และหยุด upload หากยังมีข้อมูลส่วนตัว. การหมุน key ต้อง deploy API ให้รับค่าใหม่ด้วย.
Baseline/provenance และคอขวดอยู่ใน performance-report.md และ performance/runs/staging-provenance-90fe6d9.json.
ภาพ [staging-ci-performance-90fe6d9.png](screenshots/staging-ci-performance-90fe6d9.png).

## รอบยืนยันหลังเปลี่ยน session key และแก้ export — edba11d

PR #20 ผ่าน 7 ด่านแล้ว merge เข้า develop; [run 37250469594](https://github.com/STARSTEAM-X/sdpx-arai/actions/runs/37250469594)
สำเร็จทั้ง pipeline (08:11:48–08:20:53, 9m05s).
Deploy job 80s ยืนยัน API/เว็บตรง commit edba11d; ENVIRONMENT=production และ /api/test/* ปิด.
Performance job 187s: 319 requests/0 errors, autosave p95 270.40ms และ submit p95 351.71ms,
ทุก threshold ผ่าน. Authentication ผ่านด้วย signing key ที่เจ้าของเปลี่ยนแล้ว.
ตัวกรองก่อน upload และ cleanup ผ่าน; ดาวน์โหลด artifact 11320399704 ตรวจซ้ำ
พบเพียง metrics/root_group ไม่มี session/email/credential patterns.
ผลรอบแรก 317.95ms ที่ไม่ผ่านยังเก็บไว้; ไม่ได้ optimize แอปและไม่ปรับ thresholds.
รายละเอียดและไฟล์แยกรอบอยู่ใน performance-report.md.
ผลนี้ยืนยัน deployment ผ่าน gate ไม่ใช่ยืนยันว่า performance SLA ผ่าน.
