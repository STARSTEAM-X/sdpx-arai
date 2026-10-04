# เปลี่ยนฐานข้อมูล Render Free

## รอบ 2026-10-05

| รายการ | ค่า |
|---|---|
| Database ใหม่ | `paireval-db-20261005` |
| Service ID | `dpg-db19os1srm7s73anmvrg-a` |
| Plan / storage | Free / 1 GB / $0 ต่อเดือน |
| Region / PostgreSQL | Singapore / 18 |
| หมดอายุ | 2026-11-04 ตาม Dashboard |
| API ที่เชื่อม | `paireval-api` |

สร้าง DB ใหม่สำเร็จและ Dashboard แสดง Available ผู้ใช้วาง Internal Database URL
ใน `DATABASE_URL` ของ API โดยตรงและสั่ง rebuild/deploy แล้ว deploy เป็น Live
commit `15449ab`, ใช้เวลา 71 วินาที. ตรวจ SQL แบบอ่านอย่างเดียวพบ migration ครบ 11 ชุด,
health ตอบ status=ok, environment=production และ OpenAPI ไม่มี /api/test/*.
ภาพ deploy: `docs/screenshots/render-api-db-restored-20261005.jpg`.

ตัวเดิม `paireval-db` หมดอายุและเข้าใช้งานไม่ได้ การสร้างตัวใหม่เริ่มด้วยฐานข้อมูลว่าง
ไม่ได้ย้ายข้อมูลเดิม และไม่ได้ลบตัวเดิมด้วยคำสั่งของ agent.

## ป้องกัน Blueprint เขียนค่าเก่าทับ

`render.yaml` อ้าง `paireval-db-20261005` ทั้งใน `databases` และ `fromDatabase`.
Blueprint เดิมตั้ง Auto Sync = No แล้ว. API และเว็บตั้ง Auto-Deploy = Off แล้ว
เมื่อ 2026-10-05 เพื่อให้ GitHub Actions เป็นผู้สั่ง deploy หลัง tests ผ่าน.
ภาพหลักฐาน: `docs/screenshots/render-api-ci-gate-20261005.jpg` และ
`docs/screenshots/render-web-ci-gate-20261005.jpg`.
ให้ตรวจ diff ของ Blueprint ก่อน Manual Sync.
Render รับ resource ที่ชื่อเดียวกันเข้ามาจัดการได้; อย่าสร้าง Blueprint ซ้ำมาจัดการ API เดิม.
เมื่อ config นี้เข้า develop แล้วจึง Manual Sync Blueprint เดิม โดยตรวจว่าแผนยังเป็น Free.

## ข้อจำกัดที่มีผลกับ WS-06/07

- Render อนุญาต Free Postgres ที่ active หนึ่งตัวต่อ workspace.
- Free DB หมดอายุใน 30 วัน ไม่มี backup บนแผน Free; ข้อมูลเดิมหลังหมดอายุ
  เข้าถึงได้ด้วยการอัปเกรดที่มีค่าใช้จ่ายเท่านั้น จึงไม่เลือกวิธีนั้นในงานนี้.
- `render.production.yaml` เป็น template สำหรับ workspace แยกที่ยังไม่มี Free DB active.
  ยังไม่ได้สร้าง production resources; ห้าม apply รวมกับ staging ใน workspace เดียว.
- Public staging และ production ต้องใช้ `ENVIRONMENT=production` เสมอ.
  `DEPLOYMENT_TIER` ใช้แยกเป้าหมายและไม่เปิด `/api/test/*`.
- อย่าใส่ connection string, password หรือ deploy hook ลง repo, log, screenshot หรือแชต.

อ้างอิง: [Render Free](https://render.com/docs/free),
[เพิ่ม resource เดิมเข้า Blueprint](https://render.com/docs/infrastructure-as-code#adding-an-existing-resource).
