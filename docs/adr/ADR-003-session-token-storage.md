# ADR-003: เก็บ session token ใน localStorage ต่อไป และลดความเสี่ยง XSS ด้วย CSP แทนการย้ายไป cookie

## Status

Proposed — ต้องให้ทีมยืนยันว่ายอมรับความเสี่ยงที่เหลือ หรือจะลงแรงย้ายไป httpOnly cookie

## Date

2026-10-19

## Context

[PRD](../../Sources/SDPX-AI-main/project-ideas/pairwise_evaluation_prd.md) §14.3 FR-SEC-01 (M) ระบุ
"HSTS · secure + httpOnly + SameSite cookie" แต่ระบบปัจจุบันเก็บ JWT ไว้ใน `localStorage`
([session.ts](../../frontend/src/lib/session.ts)) และส่งผ่าน header `Authorization: Bearer`

เหตุผลเดิม: E2E (Playwright) ต้องฉีด token ก่อนเปิดหน้า เพราะ Google บล็อกการล็อกอินอัตโนมัติ

การย้ายไป cookie กระทบหลายส่วนพร้อมกัน:

- หน้าเว็บ (Render static) กับ API (Render web service) อยู่ **คนละ origin** — cookie ข้าม origin ต้องเป็น
  `SameSite=None; Secure` และ CORS `allow_credentials` ซึ่งกลับมาเปิดช่อง CSRF ต้องเพิ่ม CSRF token อีกชั้น
  หรือย้าย API มาอยู่ใต้โดเมนเดียวกัน (proxy) ซึ่ง Render static site ทำ proxy ไปยัง service อื่นได้จำกัด
- ทุก fixture ของ E2E และ `addInitScript` ที่ฉีด token ต้องเปลี่ยนเป็นตั้ง cookie
- การดาวน์โหลดไฟล์ส่งออก (`fetch` + blob) ต้องส่ง credentials

## Decision (ชั่วคราว)

คง `localStorage` ไว้ และลดความเสี่ยง XSS ซึ่งเป็นช่องทางเดียวที่อ่าน token ได้ ด้วยมาตรการที่ทำแล้วในรอบนี้:

- **CSP** ใน `<meta>` ตอน build (`vite.config.ts`): `script-src 'self'` + Google Identity Services เท่านั้น ·
  ไม่มี `unsafe-inline` / `unsafe-eval` สำหรับสคริปต์ · `object-src 'none'` · `base-uri 'self'`
  — E2E `smoke.spec.ts` ยืนยันว่าไม่มีอะไรถูกบล็อก
- **HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy** ใน `render.yaml`,
  `render.production.yaml`, `nginx.conf` และ header ฝั่ง API (`app/main.py`)
- React escape ข้อความทุกจุดอยู่แล้ว · ไม่มี `dangerouslySetInnerHTML` ในโค้ด
- token มีอายุ 12 ชม. (FR-AUTH-04) จำกัดผลเสียถ้าหลุด

## Alternatives Considered

1. **httpOnly cookie ข้าม origin + CSRF token** — ตรง PRD ที่สุด แต่เป็นงานใหญ่ กระทบ E2E ทั้งชุด
   และต้องจัดการ CSRF ที่ระบบตอนนี้ไม่มีเพราะไม่ใช้ cookie
2. **ย้าย API มาใต้โดเมนเดียวกับหน้าเว็บ แล้วใช้ cookie `SameSite=Strict`** — ตัดปัญหา CSRF แต่ต้องเปลี่ยน
   โครงสร้าง deploy บน Render
3. **คง localStorage + CSP (ที่เลือกชั่วคราว)** — ไม่ตรง PRD ตัวอักษร แต่ปิดช่อง XSS ที่เป็นภัยหลักของการเก็บแบบนี้

## Consequences

- FR-SEC-01 ส่วน header **ผ่าน** · ส่วน cookie **ยังไม่ผ่าน** และบันทึกไว้ที่นี่
- ถ้าทีมเลือกทางเลือก 1 หรือ 2 ต้องแก้ `session.ts`, `api.ts`, CORS ใน `app/main.py` และ fixture ของ E2E
