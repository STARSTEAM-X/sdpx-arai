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
| Lead time commit → staging | WS-01 web 42s (ไม่มี gate) | manual หลัง CI เขียว 690.2s; ยังไม่ใช่เวลา automated deploy job |
| Deploy DB replacement | — | Render deploy 15449ab Live, 71s; migration 11 ชุด |
| Deployment frequency | นับ push อย่างเดียวไม่ยืนยัน deploy สำเร็จ | รอนับ successful deployments หลัง gate ใช้งาน |

ผล k6 แยกใน [performance-report.md](performance-report.md); local baseline ไม่ใช่ staging baseline.

## Gates ที่ตั้งบนบัญชีจริงแล้ว

2026-10-05 ตรวจ GitHub API ยืนยัน:

- main: 1 review, required checks ทั้ง 7, up-to-date branch, enforce admins,
  block force push/deletion และ resolve conversations.
- production environment: required reviewer STARSTEAM-X และ branch policy main.
- secret scanning และ push protection enabled.
- staging environment สร้างแล้ว; **ค่าลับยังไม่ตั้ง**.
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
ยังรอ deploy hooks และ fixture credentials ใน GitHub เพื่อรัน automatic deployment
และ staging journey หลัง merge; production resources ยังเป็น template.
