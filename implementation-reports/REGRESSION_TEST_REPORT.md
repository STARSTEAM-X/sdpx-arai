# Regression verification

ทดสอบด้วย production frontend build และ FastAPI/Postgres จริงใน disposable Docker project `paireval-figma-implementation` เท่านั้น ชุดใหม่ตรวจ hostname `api-test` ก่อน seed/cleanup ไม่ seed หรือ cleanup ฐาน preview ของผู้ใช้

| Check | Result | Evidence / scope |
|---|---|---|
| Backend unit | 439 passed /32 deselected /3.89s | pytest จริงบนเครื่อง ไม่รวม integration |
| Frontend unit | 29 passed /5 files /243ms | assignment12/datetime3/scale6/queue7/evaluationPairs1 |
| Combined unit loop | 6.09s | วัดตั้งแต่เริ่มทั้งสองคำสั่งจนจบ ต่ำกว่า 10s ไม่รวม lint/build/integration |
| Integration | 32 passed /439 deselected /1.62s | Postgres จริง รวม metadata/pending count/expired appeal/history/enrollment/exclusion/participation/instructor orientation revisions |
| Existing E2E | 130 passed | ชุด root Playwright เดิม รวม design5/login7; HTMLreport ใน `e2e/playwright-report/` |
| New browser regression | 24 passed | functional16/reference1/responsive7; [results.json](results.json) |
| Responsive / axe | 112 scan reports;0violations | 7sizes×15route/viewstates=105 และ visible-score อีก 7;ไม่มี documentoverflow ใน states ที่ตรวจ |
| Typecheck | passed | `tsc --noEmit` |
| Build | passed | Dockerweb-test รัน Viteproductionbuild จริง |
| Backend lint | passed | Ruff ไม่ปิดกฎ |
| Frontend lint | 0errors/17warnings | [frontend-lint.txt](frontend-lint.txt); effect/purity/dependencywarnings ยังอยู่ ไม่เรียก warning-free |
| OpenAPI lint | 0errors/0warnings | redocly lint ผ่านหลังเพิ่ม draft/lifecycle/enrollment/quality/coverage/pending metadata |
| Visual comparison | HomePixelmatch และ 11unscaledboards | [FIGMA_COMPLIANCE.md](FIGMA_COMPLIANCE.md);ไม่ใช่ compliancepercentage |
| Preview preservation | counts ก่อน/หลังตรงกัน;healthok/web200 | อัปเดตเฉพาะ API และเปิด Vite127.0.0.1:5173 ใหม่ ไม่ล้าง/seed ข้อมูล |

Viewport:375×812,430×932,768×1024,1366×768,1440×900,1920×1080 และ 390×844 ตาม Figma mobile

105matrixstates:home,classroom list/student dashboard,evaluation,score(hidden),notifications,appeal,ownerclassrooms/overview/assignments/members/scores/audit/quality/coverage ในแต่ละขนาดจอ อีก 7states ใช้คะแนนที่มีผู้ประเมินครบและคืน criterionScores จริงครบ 5 เกณฑ์

ตรวจ `pageerror`, document scroll width, images ใน core routes, accessible names/keyboard/focus และ axe WCAG2A/2AA/2.1AA/2.2AA tags ไม่ได้ประกาศว่าทุก third-party console/network entry หรือทุก browser/assistive technology ผ่านแล้ว Error injection ใช้เฉพาะ flow ที่กำลังตรวจ recovery เช่น export401/networkoffline ไม่ใช่ production mocksuccess

Functional coverage เพิ่มเติม: immediate submit รอ PUT ล่าสุด,สลับ side/reload/SPA ไม่ทำ draft หาย,online recovery,deadline จริง,tab/radio/menu/calendar keys,authoring หลายเกณฑ์,CSVpreview ก่อนเขียน,role/audit,archive/restore/delete-empty,withdraw/restore/peer submitted history,copy/edit/schedule/extend/unpublish-generation,notificationread/recipient/due,appealonce/min30/window/response/privacy,owneridentity/exclusion และ participationcredit,เพิ่มเติมเฉพาะ eligible evaluator และแก้คำตอบผู้สอนโดยไม่เพิ่ม pair ซ้ำ

การปรับ tests มีเหตุผลจาก requirement จริง: focusedworkspace,confirmCSVpreview,เลือก radio ตามคู่จริง,deadlinefieldexact หลังแยกสองฝั่ง,finalizedlink เป็นดูคะแนน และ reference fixture ตรวจจำนวนเกณฑ์ต่อคู่ตาม API จริงที่สุ่มแยกเกณฑ์ ไม่เปลี่ยน pairing หรือคะแนนเพื่อให้เหมือนภาพ

คำสั่ง reproduce จาก root:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend test
npm run lint:api
docker compose -p paireval-figma-implementation -f compose.test.yaml --profile e2e up -d --build api-test web-test
docker compose -p paireval-figma-implementation -f compose.test.yaml --profile e2e run --rm --no-deps --build e2e
docker compose -p paireval-figma-implementation -f compose.test.yaml -f implementation-reports/scripts/compose.audit.yaml --profile e2e run --rm --no-deps e2e
docker compose -p paireval-figma-implementation -f compose.test.yaml run --rm --build integration-api
```

รัน E2E และ integration เรียงกันเพราะ sharetestDB ห้ามรัน seedfixtures สอง suite พร้อมกัน compose.audit.yaml mountimplementation-reports และ axe ที่ผู้ใช้อนุญาตใน.local/audit-tools แบบ read-only ไม่มีการแก้ package.json/lockfile เพื่อเพิ่ม axe

ประวัติระหว่างทำงาน: พบและแก้ autosave/submit/retired-draft, menu ปิดเมื่อ focusauto-scroll, sr-only text ทำ rootoverflow, tabaria-controls หายตอน error/loading และ contrast ตัวเลข score ขนาดเล็ก ทุก failure แก้ที่ source ก่อน rerun; testfixture สองจุดที่ผิดสมมติฐานแก้ให้ตรวจ finalizedlink และคู่จริงตามเหตุผลข้างบน ไม่ลบ assertions เพื่อทำให้เขียว
