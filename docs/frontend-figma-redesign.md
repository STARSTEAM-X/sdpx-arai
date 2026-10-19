# Frontend redesign — 2026-10-18–19

Branch `codex/figma-frontend` ใช้ฐาน WS-08 `c50702a39a0be9dd52ad39f9f56db592925384fa` ไม่มี commit, push หรือ deploy สู่ staging/production ในงานนี้

อ้างอิง [PairEval Design System](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=175-3) ผ่าน Figma UI จริงในโหมด view-only รายการ node และ provenance ของไฟล์อยู่ใน `frontend/src/assets/figma/README.md` รูปเก็บเป็นไฟล์ใน repo และให้ Vite จัดการ URL ไม่ใช้ URL รูปชั่วคราว ไม่สร้างรูปแทน Figma

## หน้าจอและโครงสร้าง

แก้ 5 page modules เดิมและเพิ่ม 4 modules รวม 9 route families:

| หน้า | Route | Reference |
|---|---|---|
| หน้าแรก | `/` | 175:3 |
| ห้องเรียนของฉัน | `/classrooms` | 349:2388, 516:825 |
| ห้องเรียน / สมาชิก / งาน / คะแนน | `/classrooms/:id` และ hash workspace | 330:1914, 330:1057, 516:923 |
| แบบประเมิน | `.../assignments/:id/evaluate` | 57:3, 516:996 |
| คะแนนของฉัน | `.../assignments/:id/score` | 60:437, 516:1322 |
| แจ้งเตือน | `/notifications` | 516:870 |
| ยื่นอุทธรณ์และดูคำตอบ | `.../assignments/:id/appeal` | 516:1393, 516:1440 |
| ประวัติ | `/classrooms/:id/audit` | 432:12097 |
| คุณภาพและ coverage | `.../assignments/:id/quality` | 334:2250, 334:2042 |

ใช้ React/Vite/TypeScript/Tailwind และ FastAPI/Postgres เดิม ไม่มี project dependency ใหม่ axe-core เป็นเครื่องมือตรวจชั่วคราวใต้ `.local/` ตามที่ผู้ใช้อนุญาต

## พฤติกรรมที่เปลี่ยน

- Tokens, ปุ่ม, card variants, navigation, typography และภาพประกอบใช้ร่วมกัน หน้าเล็กมีตัวเลือกประเมินแนวตั้งและพื้นที่กดอย่างน้อย 44px
- ทุก route ภายในผ่าน RequireSession และ `/api/me` ก่อน mount; 401 ล้างเฉพาะ token ของ request นั้น รวมถึง CSV download ปุ่ม Google ยังคงสีส้ม/ข้อความไทยตามคำสั่งผู้ใช้ และเปิด GIS popup ด้วย user gesture จริง
- Autosave ใช้ writer ต่อคำตอบร่วมกันข้าม SPA, รอ flush ก่อนส่ง, แยก revision เก่า/ใหม่ และเก็บ pending choices ใน localStorage ตาม session แบบไม่เก็บชื่อหรือ token ใน answer payload เลิก session แล้วล้าง draft; 4xx ที่ retry ไม่ได้จะให้โหลดสถานะใหม่
- Metadata รายวิชา ภาคเรียน ชื่อกลุ่ม ผู้สอน และจำนวนงานค้างเป็นข้อมูลจริง จำนวนงานค้างนับเฉพาะคู่ของผู้ใช้นั้นที่ยังส่งได้ทันเวลา
- CSV preview ไม่เขียนฐานข้อมูลจนกดยืนยัน; เปลี่ยน role และถอน/คืนสถานะรายวิชาพร้อมเหตุผลและ audit
- ฟอร์มรองรับหลายเกณฑ์ คำถาม น้ำหนัก ลิงก์ผลงานจริง คะแนนเต็ม config คะแนน แก้ร่าง คัดลอก ตั้งเวลา ขยายกำหนด และยกเลิกเผยแพร่
- Archive ห้องทำให้ข้อมูลการเรียนเป็น read-only; restore กลับได้ ลบได้เฉพาะห้องว่างที่ไม่มีข้อมูลหรือประวัติงาน
- Notifications เป็น projection จากเหตุการณ์/สถานะจริงและเก็บ read state ของแต่ละผู้ใช้ มีเปิดงาน ใกล้ส่ง จัดคู่ใหม่ คู่เพิ่มเติม ประกาศผล และตอบคำร้อง
- อุทธรณ์ได้หนึ่งครั้งต่องานหลังประกาศผลภายใน 7 วัน เหตุผลอย่างน้อย 30 ตัวอักษร แยกสิทธิ์นักศึกษา/ผู้สอน คำตอบผู้สอนไม่แก้คะแนนอัตโนมัติ
- Quality ใช้เฉพาะคำตอบที่ส่งแล้ว เปิดตัวตนและตัด/คืนคำตอบได้เฉพาะ OWNER พร้อมเหตุผล คงคำตอบและเครดิตการมีส่วนร่วมไว้ ผู้สอนส่งคู่เพิ่มเติมได้เฉพาะผู้มีสิทธิ์จริง หรือบันทึกคำตอบของผู้สอนเองพร้อม revision

## Database และความเข้ากันได้

Migrations 012–020 เพิ่มคำถาม metadata ลิงก์ผลงาน read state อุทธรณ์ เวลาเปิด generation/history สถานะ enrollment และ exclusion การยกเลิกเผยแพร่ใช้ retired pairs/criteria แทนลบ submitted history ข้อมูลเดิมไม่ถูก seed หรือ cleanup ตอนอัปเดต preview

การถอนเป็นสถานะต่อห้อง ไม่ปิดบัญชีในห้องอื่น เก็บคำตอบที่ส่งของสมาชิกที่ยังอยู่ จัดเฉพาะงานค้างใหม่ และแจ้งข้อจำกัดเมื่อผู้มีสิทธิ์เหลือน้อย งานที่ประกาศผลต้องเปิดผลใหม่ก่อน; งานหมดเวลาต้องขยายกำหนดก่อน repair

## ข้อจำกัดที่ต้องอ่านก่อนสรุปความเหมือน

- ระบบเดิมสุ่มคู่และ orientation แยกตามเกณฑ์ หน้าเว็บแสดงเฉพาะคู่ที่ได้รับจริง จำนวนเกณฑ์ต่อหน้าจึงอาจต่างจากตัวอย่าง Figma ไม่เปลี่ยน pairing engine เพื่อจัดข้อมูลให้เหมือนภาพ
- `minComparisons` ยังใช้ร่วมกับเกณฑ์ low-confidence/k-anonymity ตามระบบเดิม ไม่แยก config k ใหม่โดยไม่มีข้อกำหนดธุรกิจ
- QS-06 ไม่มีข้อมูลความสัมพันธ์เพื่อน/ฐานเปรียบเทียบ ส่วน QS-07 ไม่มีอันดับร่วมที่ครบ จึงแสดงว่ายังประเมินไม่ได้ และไม่ลดคะแนนอัตโนมัติ
- ค่าเวลาของคำตอบเก่าย้อนเก็บไม่ได้ เวลาที่เก็บใหม่วัดเฉพาะเวลาที่ส่วนคำถามมองเห็นในแท็บ ไม่ใช่เวลาอ่านผลงานภายนอก
- Notifications แสดง projection ล่าสุดสูงสุด 100 รายการ ไม่ใช่ event inbox ย้อนหลังที่เก็บทุก transition แบบถาวร
- Figma inventory 191 frames ไม่ใช่หลักฐานว่าทุก frame ผ่าน pixel comparison; ผลภาพและข้อแตกต่างอยู่ใน `implementation-reports/FIGMA_COMPLIANCE.md`
- Google OAuth จริงต้องตรวจใน browser ด้วยบัญชีที่อนุญาต E2E ของ popup ใช้ test doubles ไม่ยืนยันว่า Google รับ origin/ID token จริง

ผลตรวจ คำสั่ง reproduce และภาพหลังแก้ไขอยู่ใน `implementation-reports/` และ `frontend/TEST_PLAN.md`
