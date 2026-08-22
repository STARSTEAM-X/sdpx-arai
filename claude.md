ดำเนินงาน Workshop ตั้งแต่ WS-01 ถึง WS-08 ตามลำดับ โดยลงมือทำจริงในโปรเจกต์ ไม่ใช่เพียงอ่านหรือสรุปเอกสาร

## เอกสารภาพรวม

ก่อนเริ่มงาน ให้อ่านไฟล์ต่อไปนี้ให้ครบ:

* `summary.md`
* `AGENTS.md` และเอกสารคำแนะนำอื่นภายใน repository (ถ้ามี)

ใช้ `summary.md` เพื่อทำความเข้าใจ:

* ภาพรวมและเป้าหมายของทั้ง 8 Workshops
* แนวคิด Loop Engineering
* ลำดับ `homework → lab → present`
* ความสัมพันธ์และผลลัพธ์สะสมระหว่าง Workshop
* การแบ่งโครงสร้าง Frontend, Backend และไฟล์ระดับ root
* Artifact เกณฑ์ผ่าน และตัวเลขที่ต้องวัดตลอดโครงการ

`summary.md` เป็นเอกสารภาพรวม ส่วนไฟล์ `homework.md`, `lab.md` และ `present.md` ของแต่ละ Workshop เป็นข้อกำหนดรายละเอียดหลัก หากข้อมูลขัดแย้งกัน ให้ยึดเอกสาร Workshop ต้นฉบับ แจ้งความขัดแย้งที่พบ และห้ามคาดเดาข้อกำหนดเอง

## เอกสารของแต่ละ Workshop

### WS-01 — First Deploy

* `Sources/SDPX-AI-main/WS-01--before/homework.md`
* `Sources/SDPX-AI-main/WS-01-RUN-first-deploy/lab.md`
* `Sources/SDPX-AI-main/WS-01-RUN-first-deploy/present.md`

### WS-02 — Requirements & API Design

* `Sources/SDPX-AI-main/WS-02--before/homework.md`
* `Sources/SDPX-AI-main/WS-02-RUN-req-design/lab.md`
* `Sources/SDPX-AI-main/WS-02-RUN-req-design/present.md`

### WS-03 — Unit Testing

* `Sources/SDPX-AI-main/WS-03--before/homework.md`
* `Sources/SDPX-AI-main/WS-03-RUN-unit-test/lab.md`
* `Sources/SDPX-AI-main/WS-03-RUN-unit-test/present.md`

### WS-04 — End-to-End Testing

* `Sources/SDPX-AI-main/WS-04--before/homework.md`
* `Sources/SDPX-AI-main/WS-04-RUN-e2e/lab.md`
* `Sources/SDPX-AI-main/WS-04-RUN-e2e/present.md`

### WS-05 — Docker

* `Sources/SDPX-AI-main/WS-05--before/homework.md`
* `Sources/SDPX-AI-main/WS-05-RUN-docker/lab.md`
* `Sources/SDPX-AI-main/WS-05-RUN-docker/present.md`

### WS-06 — CI/CD

* `Sources/SDPX-AI-main/WS-06--before/homework.md`
* `Sources/SDPX-AI-main/WS-06-RUN-cicd/lab.md`
* `Sources/SDPX-AI-main/WS-06-RUN-cicd/present.md`

### WS-07 — Performance & Observability

* `Sources/SDPX-AI-main/WS-07--before/homework.md`
* `Sources/SDPX-AI-main/WS-07-RUN-perf/lab.md`
* `Sources/SDPX-AI-main/WS-07-RUN-perf/present.md`

### WS-08 — Code Quality & Security

* `Sources/SDPX-AI-main/WS-08--before/homework.md`
* `Sources/SDPX-AI-main/WS-08-RUN-code-quality/lab.md`
* `Sources/SDPX-AI-main/WS-08-RUN-code-quality/present.md`

## วิธีดำเนินงาน

ทำ Workshop ทีละชุดตามลำดับ ห้ามสลับหรือข้าม Workshop เนื่องจาก Artifact ของ Workshop ก่อนหน้าจะถูกใช้ใน Workshop ถัดไป

สำหรับแต่ละ Workshop:

1. อ่าน `homework.md`, `lab.md` และ `present.md` ให้ครบก่อนแก้ไขโปรเจกต์
2. เปรียบเทียบข้อกำหนดกับ `summary.md` และสถานะปัจจุบันของโปรเจกต์
3. สรุปก่อนลงมือว่า:

   * เป้าหมายของ Workshop คืออะไร
   * ต้องสร้างหรือแก้ไข Artifact ใด
   * เกณฑ์ผ่านคืออะไร
   * ต้องวัดผลหรือต้องพิสูจน์ failure case ใด
4. ตรวจสอบโครงสร้างและเทคโนโลยีจริงของโปรเจกต์ ห้ามสมมติ path ของ Frontend หรือ Backend
5. ลงมือสร้างหรือแก้ไขโค้ด เอกสาร configuration และ tests ตามข้อกำหนด
6. รันคำสั่งติดตั้ง build, lint, typecheck, unit test, E2E test, Docker หรือคำสั่งตรวจสอบอื่นที่เกี่ยวข้อง
7. หากพบข้อผิดพลาด ให้ตรวจหาสาเหตุ แก้ไข และทดสอบซ้ำ
8. ตรวจสอบ Checklist และเกณฑ์ผ่านของ Workshop ทีละข้อ
9. ตรวจสอบด้วยว่า Artifact จาก Workshop ก่อนหน้ายังคงทำงาน และไม่มี regression
10. ทำ Workshop ถัดไปเมื่อ Workshop ปัจจุบันผ่านครบ หรือพบ blocker ที่ต้องอาศัยข้อมูลหรือสิทธิ์จากผู้ใช้

## กติกาการทำงาน

* ห้ามหยุดเพียงการสรุปหรือเสนอแนวทาง หากสามารถลงมือทำในโปรเจกต์ได้
* ห้ามสร้างผลการทดสอบ URL, screenshot, deployment หรือค่าตัวเลขปลอม
* ห้ามแก้ test เพียงเพื่อทำให้ผลผ่าน
* ห้าม commit secret, token, password หรือไฟล์ `.env`
* ห้ามเปิดเผยหรือส่ง secret เข้าเครื่องมือ AI
* รักษาการแก้ไขเดิมที่ไม่เกี่ยวข้องกับงาน
* หลีกเลี่ยงการลบหรือเขียนทับข้อมูลโดยไม่จำเป็น
* ทุก Artifact ที่สร้างด้วย AI ต้องสามารถอธิบายเหตุผลและการทำงานได้
* Verify ผลลัพธ์จริงก่อนสรุปว่างานสำเร็จ
* ต้องทดสอบ failure case ตามที่เอกสารกำหนด ไม่ใช่ตรวจเฉพาะกรณีที่ทำงานผ่าน
* หากต้องใช้ credentials, account ภายนอก, public deployment, branch protection หรือการอนุมัติจากผู้ใช้ ให้ทำส่วนที่ทำได้ก่อน แล้วรายงานขั้นตอนที่ติด blocker อย่างชัดเจน

## การรายงานผล

เมื่อจบ Workshop แต่ละชุด ให้รายงาน:

* สถานะ: `ผ่าน`, `ผ่านบางส่วน` หรือ `ติด blocker`
* สิ่งที่ดำเนินการเสร็จแล้ว
* Artifact และไฟล์ที่สร้างหรือแก้ไข
* คำสั่งที่ใช้ตรวจสอบ
* ผลของ build, lint, test, deployment และการวัดผล
* Failure case ที่ทดลองและผลลัพธ์
* ปัญหาที่พบและวิธีแก้ไข
* สิ่งที่ยังไม่เสร็จและเหตุผล
* งานที่ผู้ใช้ต้องดำเนินการเอง (ถ้ามี)
* ความพร้อมสำหรับ Workshop ถัดไป

เมื่อทำครบ WS-01 ถึง WS-08 ให้สรุปภาพรวมของทั้งโปรเจกต์ ตรวจสอบ Artifact สะสมตาม `summary.md` และรันชุดตรวจสอบสุดท้ายทั้งหมดอีกครั้ง