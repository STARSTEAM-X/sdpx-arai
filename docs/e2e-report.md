# E2E Report — WS-04

วัดเมื่อ 2026-08-23 · commit: ดู `git log` ของไฟล์นี้

> **ทำไมไม่ commit `playwright-report/` เป็น HTML**
> เป็นไฟล์ที่ generate ใหม่ได้ตลอดและมีขนาดใหญ่ ทำให้ diff ของ PR เต็มไปด้วยไฟล์ที่ไม่มีใครอ่าน
> — เหตุผลเดียวกับที่ไม่ commit HTML ของ coverage ใน WS-03
> สร้างใหม่ได้ด้วย `npm run e2e` แล้วเปิดด้วย `npm run e2e:report`

## ผลการรัน

| การรัน | ผล | เวลา |
|---|---|---|
| `npm run e2e` | **11 passed** | 25.5s |
| `npm run e2e --repeat-each=3` | **33 passed** | 44.6s |

**ไม่มี flaky** — รันซ้ำ 3 รอบเขียวครบทุกรอบ ตามเกณฑ์ผ่านของ WS-04

## รายการ test

### `smoke.spec.ts` — 6 tests

ตอบคำถามเดียวว่า "ระบบขึ้นและใช้งานเบื้องต้นได้ไหม"
ตั้งใจ **ไม่พึ่ง database** เพื่อให้รันกับ staging ที่ยังไม่มี DB ได้

| test | ตรวจอะไร |
|---|---|
| เปิดได้และมี title ที่ถูกต้อง | หน้าโหลดสำเร็จ |
| มีแถบเมนูหลักที่มองเห็นได้ | `getByRole('navigation')` |
| มีหัวเรื่องหลักระดับ h1 เพียงหนึ่งเดียว | a11y + SEO |
| ปุ่ม call-to-action หลักกดได้ | `main-cta` มี href จริง |
| ส่วนแสดงตัวอย่างฟีเจอร์หลักมองเห็นได้ | `feature-placeholder` |
| ป้ายสถานะระบบไม่ค้างที่กำลังโหลด | ยอมรับทั้ง ok และ error เพราะ smoke ไม่ควรพังเมื่อ backend ล่ม |

### `classrooms.spec.ts` — 5 tests

ทุกตัวอ้าง acceptance criteria จาก GitHub Issue ตรง ๆ

| test | AC ที่อ้าง | Issue |
|---|---|---|
| happy path: สร้างแล้วเห็นห้องเรียนในรายการ | Given login แล้ว, When สร้างด้วยชื่อ+timezone, Then ได้ classroom ที่เป็น OWNER | [#2](https://github.com/STARSTEAM-X/sdpx-arai2/issues/2) |
| edge case: ชื่อซ้ำถูกปฏิเสธ | Given slug ซ้ำอยู่แล้ว, When สร้างซ้ำ, Then ตอบ 409 | [#2](https://github.com/STARSTEAM-X/sdpx-arai2/issues/2) |
| edge case: ชื่อว่างถูกปฏิเสธ | Given ส่งชื่อว่าง, Then ตอบ 422 พร้อมระบุ field | [#2](https://github.com/STARSTEAM-X/sdpx-arai2/issues/2) |
| ผู้ที่ยังไม่ login สร้างห้องเรียนไม่ได้ | Given ไม่ได้แนบ token, Then ตอบ 401 | [#11](https://github.com/STARSTEAM-X/sdpx-arai2/issues/11) |
| เห็นเฉพาะห้องเรียนของตัวเอง | Given สมาชิก classroom A ขอของ B, Then ไม่เห็น | [#11](https://github.com/STARSTEAM-X/sdpx-arai2/issues/11) |

## เกณฑ์ผ่าน — ตรวจด้วยคำสั่งจริง

| เกณฑ์ | วิธีตรวจ | ผล |
|---|---|---|
| E2E ผ่านทั้งหมด | `npm run e2e` | ✅ 11 passed |
| `--repeat-each=3` เขียวทุกรอบ | `npx playwright test --repeat-each=3` | ✅ 33 passed |
| Page Object ≥ 1 และไม่มี `expect()` ข้างใน | grep code (ตัด comment) | ✅ ไม่พบ |
| Seed / cleanup ทำงานได้ | fixture `cleanDb` แบบ `auto: true` | ✅ |
| Seed endpoint ปิดใน production | เทียบ `openapi.json` สองสภาพแวดล้อม | ✅ ดูด้านล่าง |
| ไม่มี `waitForTimeout` | grep code (ตัด comment) | ✅ ไม่พบ |
| ไม่มีวันที่ hardcode | grep `20xx-xx-xx` | ✅ ไม่พบ |
| ทุก feature test อ้าง AC | 5/5 มี comment `// AC:` | ✅ |

## หลักฐานว่า test endpoint ปิดสนิทใน production

ไม่ใช่แค่ตอบ 404 — **route ไม่ถูกลงทะเบียนเลย** จึงไม่ปรากฏใน OpenAPI spec ด้วยซ้ำ

```
ENVIRONMENT=production
  included routers: 1
  path ใน openapi:  ['/api/classrooms', '/api/health']
  POST /api/test/seed     -> 404
  POST /api/test/session  -> 404

ENVIRONMENT=development
  included routers: 2
  path ใน openapi:  ['/api/classrooms', '/api/health',
                     '/api/test/cleanup', '/api/test/seed', '/api/test/session']
```

กันไว้ 3 ชั้น:

1. `app/main.py` ไม่ `include_router` เลยถ้า `IS_PRODUCTION`
2. ทุก handler เรียก `_guard()` ซ้ำอีกชั้น
3. **default ของ `ENVIRONMENT` คือ `production`** — การลืมตั้ง env เป็นการปิด ไม่ใช่เปิด

## ทำไม E2E ไม่ login ผ่าน Google จริง

Google บล็อก automated login เป็นนโยบาย — Playwright จึงผ่าน consent screen ไม่ได้
วิธีมาตรฐานคือใช้ test-only endpoint ออก session ให้แทน แล้ว inject token
ผ่าน `page.addInitScript` ก่อนหน้าเว็บจะรัน script ใด ๆ

ผลที่ตามมาที่ต้องรู้ตัว: **E2E ชุดนี้ไม่ได้ทดสอบ OAuth flow จริง**
ส่วนนั้นต้องทดสอบด้วยมือ หรือด้วย contract test กับ Google JWKS แยกต่างหาก

## ข้อจำกัดที่ยังเหลือ

| เรื่อง | สถานะ |
|---|---|
| `fullyParallel` ปิดอยู่ (`workers: 1`) | test ทุกตัว share database เดียวกัน · จะเปิดขนานได้เมื่อแยก schema ต่อ worker |
| รันกับ staging ไม่ได้ทั้งชุด | staging ยังไม่มี database — smoke รันได้ แต่ feature test รันไม่ได้จนกว่าจะถึง WS-05/06 |
| ยังไม่มี E2E ของ journey ประเมินคู่ | ต้องรอ US-06 ถึง US-10 ซึ่งอยู่ Sprint ถัดไป |
