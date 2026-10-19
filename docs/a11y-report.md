# Accessibility Report — FR-A11Y-03 / FR-A11Y-04

วัดเมื่อ 2026-10-20 · ต่อจาก commit `c1ae5c9` · spec: `e2e/specs/a11y.spec.ts`

> **ขอบเขต:** axe-core ตรวจได้เฉพาะสิ่งที่เครื่องตัดสินได้ (ประมาณ 30–40% ของ WCAG)
> ผลนี้จึง **ไม่ใช่** หลักฐานว่าผ่าน WCAG 2.2 AA ทั้งหมด — การทดสอบด้วย screen reader (FR-A11Y-07)
> และการใช้คีย์บอร์ดล้วนยังต้องทำด้วยคน ดูหัวข้อ "สิ่งที่ยังต้องทำ"

## วิธีรัน

```bash
docker compose -f compose.test.yaml --profile e2e up -d --build --wait api-test web-test
docker compose -f compose.test.yaml --profile e2e run --rm --build --no-deps e2e npx playwright test e2e/specs/a11y.spec.ts
```

- รันกับ **test stack** (`compose.test.yaml`, DB บน tmpfs) เท่านั้น — fixture `cleanDb` เรียก
  `/api/test/cleanup` ซึ่ง TRUNCATE ทุกตาราง ถ้าชี้ไป dev stack (`localhost:8000`) ข้อมูลเดโมจะหาย
- เครื่องมือ: `@axe-core/playwright` 4.14.0 (axe-core 4.14.0) · Playwright 1.62.1 · Chromium ใน image `mcr.microsoft.com/playwright:v1.62.1-noble`
- กฎ: tag `wcag2a wcag2aa wcag21a wcag21aa wcag22aa`
- spec เตรียมห้อง 9 คน 3 กลุ่ม + งาน 1 ชิ้นที่ publish แล้ว (ตรวจว่า publish สำเร็จจริง
  ไม่งั้นหน้าประเมินของนักศึกษาจะว่างและผลสแกนไม่มีความหมาย) แล้วสแกน 16 หน้าทั้งฝั่งอาจารย์และนักศึกษา
- สรุปต่อหน้าแนบไว้ใน Playwright report ชื่อ `a11y-summary`

## ผลการรัน

| การรัน | ผล | เวลา |
|---|---|---|
| `a11y.spec.ts` (โค้ดก่อนแก้ — frontend จาก `c1ae5c9`) | **failed** — 2 violations | 17s |
| `a11y.spec.ts` (หลังแก้) | **passed** — 0 violations ใน 16 หน้า | 17s |
| E2E ทั้งชุด (`npx playwright test`) หลังแก้ | **145 passed**, 0 flaky | 2m 23s |
| frontend `npm run lint` / `tsc -b` / `npm test` | 0 errors (23 warnings เดิม) / ผ่าน / 29 passed | — |

### ต่อหน้า (หลังแก้)

`passes` = จำนวนกฎที่ผ่าน · `incomplete` = กฎที่ axe ตัดสินเองไม่ได้ ต้องให้คนดู

| หน้า | หัวข้อ h1 ที่สแกนเจอ | passes | violations | incomplete |
|---|---|---|---|---|
| `/` | ทุกความคิดเห็นช่วยให้ทีมเติบโต | 21 | 0 | color-contrast |
| `/guide` | ทำความรู้จัก PairEval ระบบเปรียบเทียบคะแนน | 28 | 0 | color-contrast |
| `/classrooms` | ห้องเรียนของฉัน | 26 | 0 | color-contrast |
| `/classrooms/:id` | (ชื่อห้อง) | 24 | 0 | color-contrast |
| `/classrooms/:id#members` | สมาชิกในห้องเรียน | 27 | 0 | — |
| `/classrooms/:id#assignments` | สร้างงานประเมิน | 24 | 0 | aria-prohibited-attr, aria-valid-attr-value |
| `/classrooms/:id/assignments/:aid` | (ชื่องาน) | 21 | 0 | duplicate-id-aria |
| `…/report` | รายงานคะแนนกลุ่ม | 22 | 0 | — |
| `…/quality` | รายงานคุณภาพการประเมิน | 24 | 0 | color-contrast |
| `…/quality#coverage` | coverage รายคู่ | 24 | 0 | — |
| `…/export` | ส่งออกข้อมูล | 25 | 0 | — |
| `/classrooms/:id/audit` | บันทึกการตรวจสอบ | 26 | 0 | — |
| นักศึกษา `/classrooms` | ห้องเรียนของฉัน | 26 | 0 | color-contrast |
| นักศึกษา `/classrooms/:id` | (ชื่อห้อง) | 24 | 0 | color-contrast |
| นักศึกษา `…/evaluate` | งานที่ต้องประเมิน | 27 | 0 | color-contrast |
| นักศึกษา `/notifications` | การแจ้งเตือน | 23 | 0 | color-contrast |

## สิ่งที่พบและแก้

| # | ปัญหา | WCAG | พบจาก | แก้ที่ |
|---|---|---|---|---|
| 1 | ปุ่ม "+ สร้างห้องเรียน" มี `aria-label="เปิดหน้าต่างสร้างห้องเรียน"` ไม่ตรงกับข้อความที่เห็น — ผู้ใช้สั่งงานด้วยเสียงพูดตามป้ายแล้วกดไม่ได้ | 2.5.3 Label in Name | axe `label-content-name-mismatch` (serious) | `ClassroomsPage.tsx` ใช้ข้อความบนปุ่มเป็นชื่อ + `aria-haspopup="dialog"` |
| 2 | ปุ่ม "สร้างงานประเมิน" สีตรง `#e35205` บนตัวอักษรขาว contrast ไม่ถึง 4.5:1 | 1.4.3 Contrast | axe `color-contrast` (serious) | `ClassroomDetailPage.tsx` ใช้ token `bg-cta` / `hover:bg-cta-hover` |
| 3 | ขอบช่องกรอก `--color-edge-strong` `#e4ccba` ได้แค่ 1.5:1 กับพื้น `#fffcf7` | 1.4.11 Non-text Contrast (≥ 3:1) | คำนวณเอง — axe ไม่ตรวจขอบ | `index.css` เปลี่ยนเป็น `#9c8b80` (3.2:1) |
| 4 | radio / checkbox ขนาด 18px เล็กกว่าพื้นที่กดขั้นต่ำ | 2.5.8 Target Size (≥ 24×24) | ตรวจเอง — axe ไม่ได้รายงาน | `index.css` ตั้งค่า base 24px · `MemberDialogs.tsx`, `ExportPage.tsx` `size-6` |
| 5 | `aria-label` บน `<p>` (บัญชีผู้ใช้ในแถบเมนู) และ `<div>` ห่อภาพ hero — element ไม่มี role จึงถูก screen reader เพิกเฉย | 4.1.2 Name, Role, Value | axe `aria-prohibited-attr` (incomplete เกือบทุกหน้า) | `AppNav.tsx`, `SiteNav.tsx` เพิ่ม `role="group"` · `Hero.tsx` เอาออก (ภาพมี `alt` อยู่แล้ว) |

ข้อ 1–2 ยืนยัน failure case แล้ว: รัน spec กับ frontend ก่อนแก้ได้ violations ตรงตามตาราง
หลังแก้ ข้อ 5 หายจาก 14 หน้า เหลือเฉพาะฟอร์มสร้างงาน

E2E ที่อ้างปุ่มด้วยชื่อเดิม (`e2e/pages/ClassroomsPage.ts`, `design.spec.ts`) เปลี่ยนไปอ้างข้อความที่ผู้ใช้เห็น — ไม่ได้ลดสิ่งที่ตรวจ

## สิ่งที่ยังต้องทำ

- **color-contrast (incomplete)** — axe วัดไม่ได้เมื่อตัวอักษรอยู่บนภาพพื้นหลัง gradient หรือ element ซ้อนกัน ต้องเปิดดูด้วย DevTools ทีละจุด
- **ฟอร์มสร้างงาน** — `aria-prohibited-attr` และ `aria-valid-attr-value` ยังเป็น incomplete ต้องไล่ดู element ใน `AssignmentPanel.tsx`
- **หน้ารายละเอียดงาน** — `duplicate-id-aria` (id ซ้ำที่ถูกอ้างจาก `aria-labelledby`/`aria-describedby`) ต้องตรวจว่าซ้ำจริงหรือเป็น element ที่ซ่อนอยู่
- **FR-A11Y-07** — ทดสอบด้วย NVDA/VoiceOver และคีย์บอร์ดล้วนบน flow หลัก (ล็อกอิน → ประเมิน → ส่ง) ยังไม่ได้ทำ
- spec นี้ยังสแกนเฉพาะหน้าที่โหลดเสร็จ ไม่รวม dialog ที่เปิดอยู่ (สร้างห้อง, เพิ่มสมาชิก, ปรับคะแนน)
