# Test Plan — Frontend

## การทดสอบปัจจุบัน — 2026-10-19

Frontend29 tests ใน 5 ไฟล์: assignment12, datetime3, scale6, comparisonQueue7 และ evaluationPairs1 ไม่เพิ่ม DOM test runner หรือ project dependencies ใหม่ Browser tests ใช้ Playwright เดิมและ API/Postgres จริงใน disposable stack

| กลุ่ม | สิ่งที่ตรวจ |
|---|---|
| Unit | น้ำหนัก/config/request, timezone, forced-choice6 ระดับ, writer race/flush/retry/session/retired drafts และการคง orientation ต่อคู่ |
| Existing E2E |130 กรณี ครอบคลุม classroom/roster/role/assignment/pairing/submissions/scoring/export/anonymity รวม design5 และ login7 |
| Implementation regression |24 กรณี: functional16, reference state1, responsive matrix7 ขนาด; script/results/evidence อยู่ใน implementation-reports |
| Responsive / axe |375×812,430×932,768×1024,1366×768,1440×900,1920×1080 และ 390×844;105 route/view states และ 7visible-score states รวม 112axeJSON reports |
| Visual |HomePixelmatch แบบไม่ resize และ 11unscaled comparison boards ของข้อมูลจริง ไม่ใช่เปอร์เซ็นต์ compliance |

ทดสอบ autosave ก่อน submit,สลับ side/reload/SPA ระหว่างบันทึก,offline/reconnect,deadline จริง,keyboard/focus,CSVpreview ก่อนเขียน,role/audit,enrollmentrepair,copy/edit/schedule/extend/unpublish,notificationread/due/recipient,appealexpiry/response/privacy,qualityidentity/exclusion/participation และ additional/instructor comparison

การเปลี่ยน testflow มีเหตุผลจาก requirement: ใช้ focusedworkspace,confirmCSVpreview,radio ตามคู่จริง,ระบุ deadlinefieldexact เมื่อมีสองฝั่ง และจำนวนเกณฑ์ในคู่ตาม API จริง คง businessassertions เรื่องผลคะแนน/สิทธิ์/ความเป็นส่วนตัว ไม่ปรับ pairing เพื่อทำ fixture ให้เหมือนภาพ

Google popup/auth exchange ใช้ GIS/test doubles;กรณีอื่นใช้ test sessions และ/api/me จริง ไม่อ้างว่าทดสอบ GoogleOAuth จริงครบแล้ว useApiHealth ยังไม่มี isolatedhookunit test และ axe ไม่แทน manualaccessibilityreview

ผลตรวจสุดท้ายพร้อมเวลารันและข้อจำกัดอยู่ใน [REGRESSION_TEST_REPORT.md](../implementation-reports/REGRESSION_TEST_REPORT.md) ไม่ใช้ผล WS-03 ย้อนหลังเป็นผลปัจจุบัน

คำสั่งจาก root:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
npm run lint:api
docker compose -p paireval-figma-implementation -f compose.test.yaml --profile e2e up -d --build api-test web-test
docker compose -p paireval-figma-implementation -f compose.test.yaml --profile e2e run --rm --no-deps --build e2e
docker compose -p paireval-figma-implementation -f compose.test.yaml -f implementation-reports/scripts/compose.audit.yaml --profile e2e run --rm --no-deps e2e
```

axe-core อยู่เฉพาะ.local/audit-tools ตามที่ผู้ใช้อนุญาต compose.audit.yaml mount แบบ read-only และระบุ AXE_PATH ชุดใหม่ปฏิเสธ APIhost ที่ไม่ใช่ api-test ก่อน seed ห้ามชี้ tests เหล่านี้ไป preview หรือ production

---

## หลักฐานย้อนหลัง: Fidelity Check (WS-03)

ตารางนี้เก็บผล mutation ที่รันจริงใน WS-03 ไม่ใช่จำนวน tests หรือผลทดสอบปัจจุบัน
ในเวลานั้น scale มี 5 tests และใช้ชื่อฝั่ง A/B; implementation ปัจจุบันใช้ left/right
ตามตำแหน่งที่สุ่มแสดงบนหน้าประเมิน และมี 6 scale tests รวมตรวจข้อความตาม PRD

| # | กฎที่ลบ | ผลจริงที่รันแล้ว |
|---|---|---|
| 1 | ลบ 1 ระดับออกจาก `COMPARISON_SCALE` (เหลือ 5) | **3 failed / 2 passed** — `มี 6 ระดับพอดี` · `แบ่งฝั่ง A และ B เท่ากันฝั่งละ 3 ระดับ` · `ความห่างของสองฝั่งสมมาตรกัน` ✅ |
| 2 | เพิ่มตัวเลือกกลาง `{ id: 7, winner: 'TIE' }` | `tsc` แดงก่อน: `error TS2322: Type '"TIE"' is not assignable to type 'Winner'`<br>และถ้าข้าม typecheck ไป **2 failed / 3 passed** — `มี 6 ระดับพอดี` · `ไม่มีตัวเลือกกลาง` ✅ |

ผลหลังคืนโค้ดทั้งสองครั้งใน WS-03 → **5 passed** เท่าเดิม

> เคสที่ 2 ป้องกันสองชั้น และชั้นแรกที่จับได้คือ **type system** ไม่ใช่ test —
> `Winner = 'A' | 'B'` ใน WS-03 ทำให้เพิ่มตัวเลือกกลางแล้ว `tsc` แดงตั้งแต่ยังไม่ได้รัน test
> นี่คือเหตุผลที่ย้าย constant ออกมาไว้ใน `lib/` พร้อม type ที่แคบ แทนที่จะปล่อยเป็น array ของ string ใน component
