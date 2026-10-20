# CLAUDE.md

คำสั่งสำหรับ Claude Code ใน repository นี้: ดำเนินงาน Workshop **WS-01 ถึง WS-08 ตามลำดับ**
โดยลงมือทำจริงในโปรเจกต์ ไม่ใช่เพียงอ่านหรือสรุปเอกสาร

---

## 1. เอกสารที่ต้องอ่านก่อนเริ่มงาน

| เอกสาร | ใช้ทำอะไร |
|---|---|
| [`AGENTS.md`](AGENTS.md) | โครงสร้าง repo, คำสั่ง build/test, conventions และกฎสำหรับ agent |
| [`README.md`](README.md) | ภาพรวมระบบและ URL ที่ deploy แล้ว |
| [`docs/`](docs/) | หลักฐานและรายงานของแต่ละ Workshop (เช่น `loop-metrics.md`, `cicd.md`, `ws08-submission.md`) |
| `Sources/SDPX-AI-main/README.md` | ภาพรวมของวิชาและทั้ง 8 Workshop |

**แหล่งข้อกำหนดหลัก** คือ `homework.md`, `lab.md` และ `present.md` ของแต่ละ Workshop
หากเอกสารอื่นขัดแย้งกับไฟล์เหล่านี้ ให้ยึดเอกสาร Workshop ต้นฉบับ แจ้งความขัดแย้งที่พบ และห้ามคาดเดาข้อกำหนดเอง

## 2. ข้อกำหนดของแต่ละ Workshop

ไฟล์ทั้งหมดอยู่ใต้ `Sources/SDPX-AI-main/` (อ่านอย่างเดียว)

| WS | หัวข้อ | Homework | Lab / Present |
|---|---|---|---|
| 01 | First Deploy | `WS-01--before/homework.md` | `WS-01-RUN-first-deploy/{lab,present}.md` |
| 02 | Requirements & API Design | `WS-02--before/homework.md` | `WS-02-RUN-req-design/{lab,present}.md` |
| 03 | Unit Testing | `WS-03--before/homework.md` | `WS-03-RUN-unit-test/{lab,present}.md` |
| 04 | End-to-End Testing | `WS-04--before/homework.md` | `WS-04-RUN-e2e/{lab,present}.md` |
| 05 | Docker | `WS-05--before/homework.md` | `WS-05-RUN-docker/{lab,present}.md` |
| 06 | CI/CD | `WS-06--before/homework.md` | `WS-06-RUN-cicd/{lab,present}.md` |
| 07 | Performance & Observability | `WS-07--before/homework.md` | `WS-07-RUN-perf/{lab,present}.md` |
| 08 | Code Quality & Security | `WS-08--before/homework.md` | `WS-08-RUN-code-quality/{lab,present}.md` |

## 3. ขั้นตอนการทำงาน

ทำทีละ Workshop ตามลำดับ **ห้ามสลับหรือข้าม** เพราะ Artifact ของ Workshop ก่อนหน้าถูกใช้ต่อใน Workshop ถัดไป

1. **อ่าน** `homework.md`, `lab.md` และ `present.md` ให้ครบก่อนแก้ไขโปรเจกต์
2. **เปรียบเทียบ** ข้อกำหนดกับสถานะปัจจุบันของโปรเจกต์และหลักฐานใน `docs/`
3. **สรุปก่อนลงมือ:** เป้าหมาย, Artifact ที่ต้องสร้างหรือแก้ไข, เกณฑ์ผ่าน, ตัวเลขที่ต้องวัด และ failure case ที่ต้องพิสูจน์
4. **ตรวจโครงสร้างจริง** ตาม `AGENTS.md` — ห้ามสมมติ path ของ frontend หรือ backend
5. **ลงมือ** สร้างหรือแก้ไขโค้ด เอกสาร configuration และ tests ตามข้อกำหนด
6. **ตรวจสอบ** ด้วย build, lint, typecheck, unit test, E2E test, Docker หรือคำสั่งอื่นที่เกี่ยวข้อง
7. **แก้ไขข้อผิดพลาด** — หาสาเหตุ แก้ แล้วทดสอบซ้ำ
8. **ไล่ checklist** และเกณฑ์ผ่านของ Workshop ทีละข้อ
9. **ตรวจ regression** — Artifact จาก Workshop ก่อนหน้าต้องยังทำงานได้
10. **ไป Workshop ถัดไป** เมื่อผ่านครบ หรือเมื่อติด blocker ที่ต้องใช้ข้อมูลหรือสิทธิ์จากผู้ใช้

## 4. กติกา

**ความถูกต้องของผลลัพธ์**
- ห้ามสร้างผลทดสอบ, URL, screenshot, deployment หรือตัวเลขปลอม
- ห้ามแก้ test เพียงเพื่อให้ผ่าน
- ต้องทดสอบ failure case ตามที่เอกสารกำหนด ไม่ใช่ตรวจเฉพาะกรณีที่ทำงานได้
- Verify ผลจริงก่อนสรุปว่างานสำเร็จ

**ความปลอดภัย**
- ห้าม commit secret, token, password หรือไฟล์ `.env`
- ห้ามเปิดเผยหรือส่ง secret เข้าเครื่องมือ AI

**การแก้ไขโค้ด**
- รักษาการแก้ไขเดิมที่ไม่เกี่ยวข้องกับงาน และหลีกเลี่ยงการลบหรือเขียนทับข้อมูลโดยไม่จำเป็น
- ทุก Artifact ที่สร้างด้วย AI ต้องอธิบายเหตุผลและการทำงานได้
- ห้ามหยุดแค่การสรุปหรือเสนอแนวทาง ถ้าลงมือทำในโปรเจกต์ได้

**Blocker**
- ถ้าต้องใช้ credentials, account ภายนอก, public deployment, branch protection หรือการอนุมัติจากผู้ใช้
  ให้ทำส่วนที่ทำได้ก่อน แล้วรายงานขั้นตอนที่ติดอย่างชัดเจน

## 5. รูปแบบการรายงาน

เมื่อจบแต่ละ Workshop ให้รายงานหัวข้อต่อไปนี้:

| หัวข้อ | รายละเอียด |
|---|---|
| สถานะ | `ผ่าน` · `ผ่านบางส่วน` · `ติด blocker` |
| งานที่เสร็จ | สิ่งที่ดำเนินการแล้ว พร้อม Artifact และไฟล์ที่สร้างหรือแก้ไข |
| การตรวจสอบ | คำสั่งที่ใช้ และผลของ build, lint, test, deployment และการวัดผล |
| Failure case | กรณีที่ทดลองและผลลัพธ์ |
| ปัญหา | ปัญหาที่พบและวิธีแก้ไข |
| งานค้าง | สิ่งที่ยังไม่เสร็จพร้อมเหตุผล และงานที่ผู้ใช้ต้องทำเอง |
| ความพร้อม | พร้อมสำหรับ Workshop ถัดไปหรือไม่ |

เมื่อครบ WS-01 ถึง WS-08 ให้สรุปภาพรวมทั้งโปรเจกต์ ตรวจ Artifact สะสมของทุก Workshop
และรันชุดตรวจสอบสุดท้ายทั้งหมดอีกครั้ง
