# CI/CD — WS-06 และ WS-07

อิง lab/homework ใน Sources/SDPX-AI-main/WS-06-RUN-cicd/ และ WS-07-RUN-perf/.
ผลที่ตรวจจริงอยู่ใน [loop-metrics.md](loop-metrics.md).

## ลำดับงาน

```text
lint-api ─┐
lint-fe  ─┤
test-fe  ─┤
lint-be  ─┼─► e2e ─┬─► deploy-staging ─► performance (push develop)
test-be  ─┤        └─► deploy-production (push main, รอ human reviewer)
integration-be ─┘
```

PR รันหกด่านแรกและ E2E; ไม่ deploy. performance ยิง staging ที่เพิ่งยืนยัน commit
ของทั้ง API และเว็บแล้ว จึงไม่ใช้ผลจาก runner แทน staging.

| Job | สิ่งที่ตรวจ |
|---|---|
| lint-api | OpenAPI ไม่มี error/warning |
| lint-fe | Oxlint และ TypeScript |
| lint-be | Ruff และ deployment safety tests ที่ไม่ต้องใช้ credential |
| test-fe / test-be | Docker unit tests, coverage และ JUnit |
| integration-be | Docker + Postgres จริง; ต้องมี test รันและห้าม skip |
| e2e | Docker สร้างเว็บ/API/DB/Playwright ครบ แล้วรัน 118 tests |
| deploy-staging / deploy-production | hooks ระบุ SHA; รอ API health และ web build-info ตรง SHA เดียวกัน |
| performance | smoke 3 VUs/30s และ journey 0→5→10→0, think time, PRD thresholds |

ใช้ --exit-code-from ทุก test container, teardown down -v แม้ fail, BuildKit cache
แยกต่อ job, actions pin SHA, token อ่าน repository เป็นค่าเริ่มต้น.
เฉพาะ reporters ขอ checks: write; ไม่ใช้ pull_request_target.

## GitHub environments

สร้าง staging และ production แยก secrets. production ต้องมี required reviewer
เป็นคน และอนุญาต deploy จาก main เท่านั้น.

| Environment | ชื่อ | ชนิด / แหล่งข้อมูล |
|---|---|---|
| staging | RENDER_DEPLOY_HOOK_API | secret; Settings ของ paireval-api |
| staging | RENDER_DEPLOY_HOOK_WEB | secret; Settings ของ paireval-web |
| staging | PERF_DATABASE_URL | secret; **External** URL ของ staging DB (runner อยู่นอก Render) |
| staging | PERF_SESSION_SECRET | secret; SESSION_SECRET ของ staging API |
| staging | STAGING_API_URL / STAGING_WEB_URL | variables; URL สาธารณะของ staging |
| staging | PERF_EMAIL_DOMAIN | variable; ต้องตรง ALLOWED_EMAIL_DOMAINS ของ API |
| production | RENDER_DEPLOY_HOOK_API / RENDER_DEPLOY_HOOK_WEB | secrets ของ production services เท่านั้น |
| production | PRODUCTION_API_URL / PRODUCTION_WEB_URL | variables ของ production |

เจ้าของบัญชีคัดลอกค่าลับจาก Render ไป GitHub โดยตรง ห้ามส่งเข้าแชต/tool ของ AI.
ไม่มีค่าเริ่มต้นแทน secret ที่ขาด: workflow fail ด้วยข้อความที่ไม่เปิดเผยค่า.

## Render

- API/เว็บ staging ตั้ง Auto-Deploy = Off; Blueprint เดิม Auto Sync = No.
- render.yaml จัดการ staging; Manual Sync หลัง review โดยตรวจ plan Free และ DB ใหม่.
- render.production.yaml เป็น template สำหรับ workspace แยก ยังไม่สร้าง production resources.
- Public API ทุก tier ใช้ ENVIRONMENT=production.
  DEPLOYMENT_TIER=staging|production บอกเป้าหมายโดยไม่เปิด /api/test/*.
- API ใช้ Internal DB URL. GitHub fixture ใช้ External URL ของ **DB เดียวกัน**.
- VITE_* ต้อง build ใหม่; build-info.json บันทึก SHA ตอน build.

รายละเอียดฐานข้อมูลและแผน Free: [render-free-db.md](render-free-db.md).

## Main branch protection และหลักฐาน

Require PR + อย่างน้อย 1 approval, up-to-date branch, block force push/deletion,
required checks: lint-api, lint-fe, test-fe, lint-be, test-be, integration-be, e2e.
ไม่บังคับ performance บน PR เพราะรันหลัง deploy-staging.
เปิด secret scanning และ push protection.

ตาม lab ต้องทำ implementation เสียใน PR ทดลอง, ตรวจ CI แดงและ merge ถูกบล็อก,
เก็บภาพ docs/screenshots/merge-blocked.png แล้วปิด PR โดยไม่ merge.
ทดลอง performance threshold ที่เข้มเกินจริงให้ CI แดงแล้วคืนค่าเดิม.
อย่าแก้ test assertions เพื่อสร้างหลักฐาน.

## ตรวจและ debug

คำสั่งแต่ละบรรทัดเริ่มจาก repo root:

```bash
cd frontend && npm run lint && npm run typecheck
cd backend && ./.venv/Scripts/python.exe -m ruff check . ../scripts/ci
cd backend && ./.venv/Scripts/python.exe -m unittest discover -s ../scripts/ci -p 'test_*.py'
npm run lint:api
docker compose -f compose.test.yaml -f compose.ci.yaml up unit-api --abort-on-container-exit --exit-code-from unit-api
docker compose -f compose.test.yaml -f compose.ci.yaml up unit-web --abort-on-container-exit --exit-code-from unit-web
docker compose -f compose.test.yaml -f compose.ci.yaml up integration-api --abort-on-container-exit --exit-code-from integration-api
docker compose -f compose.test.yaml -f compose.ci.yaml --profile e2e up e2e --abort-on-container-exit --exit-code-from e2e
docker compose -f compose.test.yaml -f compose.ci.yaml --profile e2e down -v
```

อ่าน error แรกของ job ที่แดง, reproduce และตรวจบนเครื่องก่อน push.
Artifact เก็บเฉพาะ reports ไม่เก็บ session fixture.

## เตรียม load test

ในเครื่องที่ได้รับ credential ของ staging โดยตรง:

```bash
cd backend
python -m app.perf_fixture --base-url "$STAGING_API_URL" --domain "$PERF_EMAIL_DOMAIN"
cd ..
BASE_URL="$STAGING_API_URL" k6 run --summary-export=performance/staging-baseline.json performance/load-test.js
```

CLI ต้องมี DATABASE_URL, SESSION_SECRET, ENVIRONMENT=production, DEPLOYMENT_TIER=staging.
สร้างบัญชีสังเคราะห์ 60 คนและห้องใหม่ต่อรอบ; ไม่ล้างข้อมูลเดิม.
Fixture มี session อายุสั้น เก็บเฉพาะ performance/.secrets/ ที่ถูก ignore และลบหลังรัน.
Baseline local กับ staging ต้องระบุเป้าหมาย/commit/เวลาแยกกัน.
