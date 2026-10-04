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
| Pipeline Docker | [Sup PR #17 run เดิม](https://github.com/STARSTEAM-X/sdpx-arai/actions/runs/37211760610) | รอ run ของ candidate |
| Lead time commit → staging | WS-01 web 42s (ไม่มี gate) | รอ deploy ผ่าน CI; script บันทึก API + web exact SHA |
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

จำนวน push เพื่อ debug Docker CI: ยังไม่เริ่ม run ของ candidate.
CI failure proof (PR merge blocked) และ performance threshold-red proof บน CI ยังรอ.
เมื่อได้ run จริงให้บันทึก URL, job duration, slowest job และจำนวน push เพิ่มในไฟล์นี้.
