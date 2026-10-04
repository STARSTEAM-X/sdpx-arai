# Loop Metrics — WS-06

วัดเมื่อ **2026-10-04** บนเครื่อง dev (Windows 11 + Docker Desktop) · commit `69df953`
ช่อง "หลังมี CI" ที่เขียนว่า **รอวัด** คือยังไม่มี run จริงบน GitHub Actions — **ไม่ใส่ตัวเลขประมาณแทน**
(push ขึ้น GitHub ยังไม่ได้ทำ ดู [`cicd.md`](cicd.md) หัวข้อ "สิ่งที่ต้องตั้งบนเว็บเอง")

| ตัวชี้วัด | ก่อนมี CI | หลังมี CI |
|---|---|---|
| Unit test — backend (350 tests) | 1.33 วินาที (local) · 1.06 วินาที (ใน container) | รอวัด (`test-be`) |
| Unit test — frontend (21 tests) | 0.79 วินาที (local) · 0.34 วินาที (ใน container) | รอวัด (`test-fe`) |
| E2E (118 tests) | 1.6 นาที (เวลารัน test) · 297 วินาที รวม build image ของ `compose.test.yaml` | 1.6 นาที (99 วินาที) เมื่อจำลอง job `e2e` ใน container Linux ด้วยขั้นตอนเดียวกับ workflow · บน GitHub รอวัด |
| Pipeline ทั้งอัน | — (ไม่มี มีแต่ job `smoke` ที่ echo ข้อความ) | รอวัด |
| Lead time (commit → staging) | 42 วินาที (web · วัดตอน WS-01) — **แต่ไม่มี gate** test แดงก็ขึ้น | รอวัด — job `deploy-staging` พิมพ์ตัวเลขนี้ลง step summary เอง |
| Deployment frequency | 28 commits (W34) · 40 commits (W35) บน `develop` — Render deploy ทุก push จึงเป็นเพดานบน | คาดว่าเท่าเดิม แต่ทุกครั้งผ่าน gate ครบ |

### ตัวเลขที่ได้จากการพิสูจน์ failure case (วัดแล้ว)

| สิ่งที่ทดสอบ | ผล |
|---|---|
| test ใน container คืน exit code ถูก (เขียว) | `unit-api` exit 0 · `unit-web` exit 0 · `integration-api` exit 0 (29 passed) |
| ทำ test แดง 1 ตัว (branch `test/break-pipeline`) | `vitest run` exit **1** · `docker compose ... --exit-code-from unit-web` exit **1** (1 failed / 20 passed) |
| ruff เจอ import ที่ไม่ได้ใช้ | exit **1** |
| oxlint เจอ `if (a = 1)` | exit **1** |
| actionlint ตรวจ `ci.yml` | ไม่มี error |

## Pipeline ช้าที่สุดตรงไหน

**`e2e`** — จากการจำลอง job ใน container: ติดตั้ง dependency ~30 วินาที + Playwright 99 วินาที
และมันรอ 5 job แรกเสร็จก่อน (critical path = job ที่ช้าที่สุดในชุดแรก + e2e)

แผนลดเวลาโดยไม่ลด coverage:

1. **แยก database ต่อ worker แล้วรัน Playwright ขนาน** — ตอนนี้ `workers: 1` เพราะ test ทุกตัวใช้ DB เดียวกัน
   (เขียนเหตุผลไว้ใน `playwright.config.ts`) · 2 worker น่าจะลดจาก 99 เหลือราวครึ่ง
2. **shard E2E เป็น 2 job** (`--shard=1/2`, `--shard=2/2`) แต่ละ job มี Postgres service ของตัวเอง
   แก้ปัญหา DB ร่วมได้ทันทีโดยไม่ต้องแก้ fixture
3. **ไม่ต้องรอ `integration-be`** ก่อนเริ่ม `e2e` — integration ไม่ได้ป้องกันสิ่งที่ e2e จะเจอ
   และน่าจะเป็น job ที่ช้าที่สุดในชุดแรกเพราะต้องรอ Postgres service healthy (ต้องยืนยันจาก run จริง)
4. **paths filter** — PR ที่แก้แค่ `docs/` ไม่ต้องรันอะไรเลย · แก้แค่ `frontend/` ไม่ต้องรัน `test-be`
   (summary.md แนะนำไว้ · ยังไม่ทำเพราะต้องจัดการ required check ที่ถูก skip ให้ถูก)

## จำนวน push ที่ใช้ไปในการ debug pipeline วันนี้

**0 push** — ทุกปัญหาเจอและแก้บนเครื่องก่อนทั้งหมด:

| ปัญหา | เจอที่ | แก้อย่างไร |
|---|---|---|
| `typescript-eslint` ไม่รองรับ TypeScript 7 (peer `<6.1`) | `npm install` ใน container | เปลี่ยนไปใช้ `oxlint` ที่ parse TS เอง |
| npm 10 บนเครื่องลบ field `libc` ออกจาก lockfile → CI บน Linux อาจเลือก native binary ผิด | `git diff` ของ lockfile | สร้าง lockfile ด้วย npm 11 ใน `node:24-alpine` แบบเดียวกับ CI |
| Postgres container ไม่ขึ้นตอนจำลอง job `e2e` | จำลองบนเครื่อง | Git Bash แปลง path ของ `--tmpfs` — ปิดด้วย `MSYS_NO_PATHCONV=1` (ปัญหาของเครื่อง ไม่ใช่ของ workflow) |
| `--reporter=dot` ทับ reporter ใน config ทำให้ไม่มี JUnit XML | จำลองบนเครื่อง | workflow ไม่ส่ง `--reporter` ให้ config เป็นคนเลือก · ยืนยันด้วย `CI=1 playwright test --list` ว่าไฟล์ออก |

เครื่องมือที่ทำให้ได้ 0: `actionlint` ตรวจ syntax ของ workflow และการจำลอง job `e2e` ด้วย
image `mcr.microsoft.com/playwright` + Postgres container ด้วยขั้นตอนเดียวกับ workflow

ครั้งหน้า: รัน `actionlint` เป็น pre-commit hook ของไฟล์ใน `.github/workflows/`
