# Figma Screen Inventory

วันที่2026-10-19 · อ่านทั้ง7pagesผ่าน Figma view-only UI · ไม่มี Figma MCP

191รายการด้านล่างคือ screen/state frames ไม่ใช่191routes มี component masters41และ asset library81layersแยกออกจากยอดนี้ รายละเอียด method/ข้อจำกัด/ค่าที่ตรวจจริงอยู่ [figma-inventory.json](figma-inventory.json) และ raw enumerationอยู่ [TSV](evidence/figma/inventory-source.tsv)

| Page | Screen/state frames |
|---|---:|
| Home | 5 |
| Student | 35 |
| Owner | 93 |
| Co-teacher | 42 |
| TA | 16 |

Mapping เป็นสองทิศทาง: ทุก5routesมี core frame อ้างอิง; frameที่ไม่มี capabilityในเว็บระบุ Missing และ issue family กำกับ ส่วน frameที่มีชื่อแต่ยังไม่ได้เทียบเต็มภาพเป็น Not Verified จึงไม่รับรองทุก191framesว่า Match

| Page/section | Frame | Node / reference | Route candidate | Mapping | Visual audit | Issue |
|---|---|---|---|---|---|---|
| Home/Home | Home — TA · Orange illustrated | [176:212](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=176-212) | / | Partial route match | Not Verified | — |
| Home/Home | Home — Co-teacher · Orange illustrated | [176:152](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=176-152) | / | Partial route match | Not Verified | — |
| Home/Home | Home — Owner · Orange illustrated | [176:92](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=176-92) | / | Partial route match | Not Verified | — |
| Home/Home | Home — Student · Orange illustrated | [164:12283](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=164-12283) | / | Partial route match | Not Verified | — |
| Home/Home | Home — Guest · Orange illustrated | [175:3](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=175-3) | / | Partial route match | [Fresh PNG](evidence/figma/home-guest-desktop-175-3.png) | — |
| Student/A | ST08 · วิธีใช้งาน 4 | [321:18417](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=321-18417) | / | Partial route match | Not Verified | — |
| Student/A | ST07 · วิธีใช้งาน 3 | [321:18346](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=321-18346) | / | Partial route match | Not Verified | — |
| Student/A | ST06 · วิธีใช้งาน 2 | [321:18229](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=321-18229) | / | Partial route match | Not Verified | — |
| Student/A | ST05 · วิธีใช้งาน 1 | [321:18112](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=321-18112) | / | Partial route match | Not Verified | — |
| Student/A | ST04 · หน้าแรก · เข้าสู่ระบบแล้ว | [268:6543](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=268-6543) | / | Partial route match | Not Verified | — |
| Student/A | ST03 · ประกาศความเป็นส่วนตัว (login ครั้งแรก) | [126:573](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=126-573) | — | Not Verified | Not Verified | — |
| Student/A | ST02 · อีเมลนอกโดเมน · ปฏิเสธการเข้าสู่ระบบ | [502:6465](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=502-6465) | / | Partial route match | Not Verified | — |
| Student/A | ST01 · หน้าแรก Guest · เข้าสู่ระบบด้วย Google | [318:9872](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=318-9872) | / | Partial route match | Not Verified | — |
| Student/B | ST15 · กลุ่มของฉัน | [317:7209](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=317-7209) | — | Not Verified | Not Verified | — |
| Student/B | ST14 · หน้าห้องเรียน · ออกคะแนนแล้ว | [290:3890](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=290-3890) | /classrooms/:classroomId | Partial route match | Not Verified | UI-004 |
| Student/B | ST13 · หน้าห้องเรียน · งานที่ต้องประเมิน | [268:6135](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=268-6135) | /classrooms/:classroomId | Partial route match | Not Verified | UI-004 |
| Student/B | ST12 · การแจ้งเตือน · ลิงก์ตรง ไม่มีคะแนนในข้อความ | [502:6515](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=502-6515) | — | Missing capability | Not Verified | GAP-001 |
| Student/B | ST11 · ห้องเรียนของฉัน · ยังไม่มีห้อง | [299:819](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=299-819) | /classrooms | Partial route match | Not Verified | UI-002 |
| Student/B | ST10 · ห้องเรียนของฉัน | [77:1086](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=77-1086) | /classrooms | Partial route match | Not Verified | UI-002 |
| Student/C | ST26 · ปิดรับแล้ว · คำตอบอ่านอย่างเดียว | [502:6592](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=502-6592) | /classrooms/:classroomId/assignments/:assignmentId/evaluate | Partial route match | Not Verified | UI-005 |
| Student/C | ST25 · ไม่มีการประเมินรายบุคคล (กลุ่ม ≤ 2 คน) | [77:1123](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=77-1123) | /classrooms/:classroomId/assignments/:assignmentId/evaluate | Partial route match | Not Verified | UI-005 |
| Student/C | ST24 · ออฟไลน์ · คำตอบเก็บไว้ในเครื่อง | [472:558](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=472-558) | /classrooms/:classroomId/assignments/:assignmentId/evaluate | Missing capability | Not Verified | GAP-008 |
| Student/C | ST23 · ส่งคำตอบสำเร็จ | [268:7496](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=268-7496) | /classrooms/:classroomId/assignments/:assignmentId/evaluate | Partial route match | Not Verified | UI-005 |
| Student/C | ST22 · ประเมินระดับกลุ่ม · ตอบครบ | [280:2127](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=280-2127) | /classrooms/:classroomId/assignments/:assignmentId/evaluate | Partial route match | Not Verified | UI-005 |
| Student/C | ST21 · ยืนยันส่งคำตอบที่ยังไม่ครบ | [276:874](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=276-874) | /classrooms/:classroomId/assignments/:assignmentId/evaluate | Partial route match | Not Verified | UI-005 |
| Student/C | ST20 · ประเมินระดับกลุ่ม · กำลังตอบ | [57:3](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=57-3) | /classrooms/:classroomId/assignments/:assignmentId/evaluate | Partial route match | [Fresh PNG](evidence/figma/student-evaluation-desktop-57-3.png) | UI-005 |
| Student/D | ST34 · ยื่นอุทธรณ์สำเร็จ | [318:10377](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=318-10377) | — | Missing capability | Not Verified | GAP-002 |
| Student/D | ST33 · ยื่นอุทธรณ์คะแนน | [318:10237](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=318-10237) | — | Missing capability | Not Verified | GAP-002 |
| Student/D | ST32 · คะแนนรายบุคคลยังแสดงไม่ได้ (ข้อมูลไม่พอ) | [60:606](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=60-606) | /classrooms/:classroomId/assignments/:assignmentId/score | Partial route match | Not Verified | UI-007 |
| Student/D | ST31 · คะแนนของฉัน · ยังประเมินไม่ครบ ซ่อนเนื้อหา | [293:9359](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=293-9359) | /classrooms/:classroomId/assignments/:assignmentId/score | Partial route match | Not Verified | UI-007 |
| Student/D | ST30 · คะแนนของฉัน · ประกาศแล้ว | [60:437](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=60-437) | /classrooms/:classroomId/assignments/:assignmentId/score | Partial route match | [Fresh PNG](evidence/figma/student-score-desktop-60-437.png) | UI-007 |
| Student/E | M09 · ยื่นอุทธรณ์สำเร็จ | [516:1440](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-1440) | — | Missing capability | [Fresh PNG](evidence/figma/student-appeal-success-mobile-516-1440.png) | GAP-002 |
| Student/E | M08 · ยื่นอุทธรณ์คะแนน | [516:1393](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-1393) | — | Missing capability | Not Verified | GAP-002 |
| Student/E | M07 · คะแนนของฉัน · ประกาศแล้ว | [516:1322](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-1322) | /classrooms/:classroomId/assignments/:assignmentId/score | Partial route match | [Fresh PNG](evidence/figma/student-score-mobile-516-1322.png) | UI-007 |
| Student/E | M06 · ส่งคำตอบสำเร็จ | [516:1315](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-1315) | /classrooms/:classroomId/assignments/:assignmentId/evaluate | Partial route match | Not Verified | UI-005 |
| Student/E | M05 · ยืนยันส่งคำตอบที่ยังไม่ครบ (bottom sheet) | [516:1146](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-1146) | /classrooms/:classroomId/assignments/:assignmentId/evaluate | Partial route match | Not Verified | UI-005 |
| Student/E | M04 · ประเมินระดับกลุ่ม · ตอบทีละเกณฑ์ | [516:996](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-996) | /classrooms/:classroomId/assignments/:assignmentId/evaluate | Partial route match | [Fresh PNG](evidence/figma/student-evaluation-mobile-516-996.png) | UI-005 |
| Student/E | M03 · หน้าห้องเรียน · งานที่ต้องประเมิน | [516:923](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-923) | /classrooms/:classroomId | Partial route match | [Fresh PNG](evidence/figma/student-classroom-mobile-516-923.png) | UI-004 |
| Student/E | M02 · การแจ้งเตือน (หน้าเต็มบนมือถือ) | [516:870](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-870) | — | Missing capability | Not Verified | GAP-001 |
| Student/E | M01 · ห้องเรียนของฉัน | [516:825](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-825) | /classrooms | Partial route match | [Fresh PNG](evidence/figma/student-classrooms-mobile-516-825.png) | UI-002 |
| Owner/A | J04f · ลบห้องเรียนไม่ได้ · มีข้อมูลแล้ว | [432:2651](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=432-2651) | /classrooms | Missing capability | Not Verified | GAP-003 |
| Owner/A | J04e · ลบห้องเรียน · ห้องยังว่าง | [432:2575](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=432-2575) | /classrooms | Missing capability | Not Verified | GAP-003 |
| Owner/A | J04d · Archive ห้องเรียน | [432:2495](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=432-2495) | /classrooms | Missing capability | Not Verified | GAP-003 |
| Owner/A | J01b · เข้าสู่ระบบครั้งแรก · ประกาศความเป็นส่วนตัว | [399:1978](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=399-1978) | — | Not Verified | Not Verified | — |
| Owner/A | J03 · กรอกข้อมูลสร้างห้องเรียน | [397:2012](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=397-2012) | /classrooms | Partial route match | Not Verified | UI-002 |
| Owner/A | J04c · ห้องเรียนของฉัน · แท็บ Archive | [349:2530](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=349-2530) | /classrooms | Missing capability | Not Verified | GAP-003 |
| Owner/A | J04b · ห้องเรียนของฉัน · หลายบทบาท + ค้นหา / กรอง | [349:2388](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=349-2388) | /classrooms | Partial route match | [Fresh PNG](evidence/figma/owner-classrooms-desktop-349-2388.png) | UI-002 |
| Owner/A | J04 · ห้องเรียนของฉัน · มีห้องที่เพิ่งสร้าง | [330:306](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=330-306) | /classrooms | Partial route match | Not Verified | UI-002 |
| Owner/A | J02 · ห้องเรียนของฉัน · ยังไม่มีห้อง | [330:189](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=330-189) | /classrooms | Partial route match | Not Verified | UI-002 |
| Owner/A | J01 · เข้าเว็บครั้งแรก → เข้าสู่ระบบด้วย Google | [330:7](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=330-7) | / | Partial route match | Not Verified | — |
| Owner/B | J09f · รายชื่อหลังทำเครื่องหมาย · นก ถอนรายวิชา | [479:3033](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=479-3033) | /classrooms/:classroomId#members | Missing capability | Not Verified | GAP-004 |
| Owner/B | J09e · ทำเครื่องหมายถอนรายวิชา | [468:2963](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=468-2963) | /classrooms/:classroomId#members | Missing capability | Not Verified | GAP-004 |
| Owner/B | J11c · ถอดผู้สอนออกจากห้อง | [432:3189](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=432-3189) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/B | J11b · แก้ไขบทบาท · ปรียา เป็น TA | [432:3054](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=432-3054) | /classrooms/:classroomId#members | Missing capability | Not Verified | GAP-004 |
| Owner/B | J09d · แก้ไขบทบาท · นักศึกษา | [432:2901](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=432-2901) | /classrooms/:classroomId#members | Missing capability | Not Verified | GAP-004 |
| Owner/B | J09c · ถอดนักศึกษาออกจากห้อง | [432:2743](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=432-2743) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/B | J09b · นำเข้า CSV ซ้ำ · ดูการเปลี่ยนแปลงก่อนยืนยัน | [405:2748](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=405-2748) | /classrooms/:classroomId#members | Missing capability | Not Verified | GAP-004 |
| Owner/B | J11 · ทีมผู้สอน · เพิ่มผู้สอนร่วมและ TA แล้ว | [360:2657](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=360-2657) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/B | J10b · เพิ่มผู้สอน · error อีเมลเป็นนักศึกษาในห้องนี้ | [360:2551](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=360-2551) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/B | J10 · เพิ่มผู้สอน · กรอกอีเมล + เลือกบทบาท | [360:2445](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=360-2445) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/B | J12 · ภาพรวมห้อง · มีสมาชิกแล้ว ยังไม่มีงาน | [330:1914](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=330-1914) | /classrooms/:classroomId | Partial route match | [Fresh PNG](evidence/figma/owner-classroom-desktop-330-1914.png) | UI-003 |
| Owner/B | J09 · รายชื่อ · 12 คน 3 กลุ่ม | [330:1057](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=330-1057) | /classrooms/:classroomId | Partial route match | [Fresh PNG](evidence/figma/owner-members-desktop-330-1057.png) | UI-003 |
| Owner/B | J08 · แก้ไฟล์แล้ว · ยืนยันนำเข้า | [330:941](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=330-941) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/B | J07 · อัปโหลด CSV · พบปัญหา | [330:830](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=330-830) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/B | J06 · หน้ารายชื่อ · ยังไม่มีนักศึกษา | [330:467](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=330-467) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/B | J05 · เข้าห้องเรียนครั้งแรก · ยังว่าง | [330:371](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=330-371) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/C | J14b · ตรวจความเป็นไปได้ · กรณีห้องมี 2 กลุ่ม | [467:3033](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=467-3033) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/C | J23c · ขยายกำหนดส่ง | [399:2144](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=399-2144) | /classrooms/:classroomId#assignments | Missing capability | Not Verified | GAP-006 |
| Owner/C | J23b · ยกเลิกเผยแพร่ · เตือนว่าคำตอบเดิมจะใช้ไม่ได้ | [399:2041](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=399-2041) | /classrooms/:classroomId#assignments | Missing capability | Not Verified | GAP-006 |
| Owner/C | J23 · หน้างาน · เปิดรับอยู่ · ส่งแล้ว 9 / 12 คน | [395:1883](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=395-1883) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/C | J16 · ภาพรวมห้อง · งานเปิดให้ประเมินแล้ว | [332:2834](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=332-2834) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/C | J15 · ยืนยันเผยแพร่และจัดคู่ | [332:2672](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=332-2672) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/C | J14 · ตรวจความเป็นไปได้ก่อนเผยแพร่ | [332:2547](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=332-2547) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/C | J13b · สร้างงาน · แก้น้ำหนักครบ 100% | [332:2128](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=332-2128) | /classrooms/:classroomId#assignments | Partial route match | Not Verified | GAP-005 |
| Owner/C | J13a · สร้างงาน · ใส่น้ำหนัก 95% (เผยแพร่ไม่ได้) | [332:1712](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=332-1712) | /classrooms/:classroomId#assignments | Partial route match | Not Verified | GAP-005 |
| Owner/D | J25d · คะแนนกลุ่มหลังแก้ด้วยมือ · Cygnus 11.500 | [467:2883](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=467-2883) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/D | J24c · ขยายกำหนดส่งหลังปิดรับ · กลับมาเปิดรับ | [422:2448](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=422-2448) | /classrooms/:classroomId#assignments | Missing capability | Not Verified | GAP-006 |
| Owner/D | J28c · การกระจายคะแนนต่อเกณฑ์ | [405:2424](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=405-2424) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Owner/D | J25c · แก้คะแนนด้วยมือ · บังคับเหตุผล | [404:2381](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=404-2381) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/D | J26b · อาจารย์ประเมินเอง · Borealis เทียบ Cygnus | [404:2111](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=404-2111) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Owner/D | J29b · ตัดคำตอบของ E7 · ใส่เหตุผล | [399:2238](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=399-2238) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Owner/D | J24b · ภาพรวมห้อง · ปิดรับแล้ว (กดย้อนจาก J24) | [395:1959](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=395-1959) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/D | J30 · กดดูตัวตน → E7 = ต้น (บันทึก audit) | [382:2049](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=382-2049) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Owner/D | J29 · ดูคำตอบของ E7 (ยังไม่เปิดตัวตน) | [382:1863](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=382-1863) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Owner/D | J28b · รายงานคุณภาพ · ตัดคำตอบของ E7 แล้ว | [378:1815](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=378-1815) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Owner/D | J25b · รายงานคะแนนรายบุคคล (ชั่วคราว) | [374:4945](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=374-4945) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/D | J28 · รายงานคุณภาพ · ครบทุกสัญญาณ (QS-01–07) | [334:2250](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-2250) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Owner/D | J27 · ส่งให้ประเมินเพิ่มไม่ได้ · ไม่มีผู้มีสิทธิ์เหลือ | [334:2135](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-2135) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/D | J26 · Coverage รายคู่ · Borealis เทียบ Cygnus ได้ 2 / 4 | [334:2042](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-2042) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Owner/D | J25 · รายงานคะแนนกลุ่ม (ชั่วคราว) | [334:1941](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-1941) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/D | J24 · ปิดรับแล้ว · ภาพรวมงานกลุ่มครั้งที่ 1 | [334:1867](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-1867) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/E | J35c · ต้องเปิดผลใหม่ก่อนแก้คะแนน | [483:3127](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=483-3127) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/E | J38b · รายละเอียดบันทึก audit · แก้คะแนนด้วยมือ | [432:12097](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=432-12097) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Owner/E | J31e · เปิดผลใหม่ (reopen) · บังคับเหตุผล | [422:2542](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=422-2542) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/E | J31d · สร้างงานใหม่ · คัดลอกจากงานเดิม | [405:2621](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=405-2621) | /classrooms/:classroomId#assignments | Missing capability | Not Verified | GAP-006 |
| Owner/E | J35d · แก้คะแนนของ นก (หลังเปิดผลใหม่) · บังคับเหตุผล | [399:2437](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=399-2437) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/E | J31c · ภาพรวมห้อง · ประกาศผลแล้ว (กดย้อนจาก J31b) | [392:1857](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=392-1857) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/E | J35b · รายละเอียดคำร้อง · นก (ป๊อปอัพ) | [391:2020](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=391-2020) | — | Missing capability | Not Verified | GAP-002 |
| Owner/E | J31b · ภาพรวมงาน · ประกาศผลแล้ว · มีคำร้องอุทธรณ์ 2 | [390:1794](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=390-1794) | — | Missing capability | Not Verified | GAP-002 |
| Owner/E | J38 · บันทึกการตรวจสอบ · ทุกอย่างที่ทำมาในเรื่องนี้ | [334:5219](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-5219) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Owner/E | J37 · ส่งออกพร้อมตัวตนผู้ประเมิน (เฉพาะ Owner) | [334:5074](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-5074) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/E | J36 · ส่งออกรายงาน | [334:4946](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-4946) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/E | J35 · คำร้องอุทธรณ์ · ตอบ นก | [334:4844](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-4844) | — | Missing capability | Not Verified | GAP-002 |
| Owner/E | J31 · ประกาศผลคะแนน | [334:4515](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-4515) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/F | J25e · คะแนนหลังประกาศฉบับแก้ไข · นก 17.30 | [498:3938](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=498-3938) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/F | J26e · Coverage หลังผู้สอนเติมแล้ว | [498:3840](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=498-3840) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Owner/F | J26d · ผู้สอนเติมผลหลังถอนรายวิชา | [498:3662](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=498-3662) | /classrooms/:classroomId#members | Missing capability | Not Verified | GAP-004 |
| Owner/F | J26c · Coverage หลังถอน · ต้องให้ผู้สอนเติม | [498:3568](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=498-3568) | /classrooms/:classroomId#members | Missing capability | Not Verified | GAP-004 |
| Owner/F | J09j · ถอนแล้ว · มีคู่ข้อมูลไม่พอให้ผู้สอนตรวจ | [496:3692](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=496-3692) | /classrooms/:classroomId#members | Missing capability | Not Verified | GAP-004 |
| Owner/F | J09i · ถอนระหว่างเปิดรับ · ไม่มีคนรับคู่เพิ่ม | [496:3553](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=496-3553) | /classrooms/:classroomId#members | Missing capability | Not Verified | GAP-004 |
| Owner/F | J09h · ถอนระหว่างเปิดรับแล้ว · แจกคู่ใหม่สำเร็จ | [496:3428](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=496-3428) | /classrooms/:classroomId#members | Missing capability | Not Verified | GAP-004 |
| Owner/F | J09g · ถอนระหว่างเปิดรับ · แจกคู่ค้างได้ | [496:3286](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=496-3286) | /classrooms/:classroomId#members | Missing capability | Not Verified | GAP-004 |
| Owner/F | J31g · ประกาศผลฉบับแก้ไขแล้ว | [494:3427](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=494-3427) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/F | J31f · ประกาศผลอีกครั้ง · นก 17.30 | [494:3294](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=494-3294) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/F | J35e · เปิดผลใหม่แล้ว · รอแก้ไขหรือประกาศอีกครั้ง | [494:3174](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=494-3174) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/F | J16c · เปิดรับ · ห้อง 2 กลุ่ม | [493:3752](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=493-3752) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/F | J15c · ยืนยันเผยแพร่ · ห้อง 2 กลุ่ม | [493:3591](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=493-3591) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/F | J23d · ยกเลิกเผยแพร่ก่อนถึงเวลาเปิดรับ | [493:3487](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=493-3487) | /classrooms/:classroomId#assignments | Missing capability | Not Verified | GAP-006 |
| Owner/F | J16b · เผยแพร่แล้ว · รอเปิดรับตามเวลา | [493:3408](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=493-3408) | /classrooms/:classroomId#assignments | Missing capability | Not Verified | GAP-006 |
| Owner/F | J15b · ยืนยันเผยแพร่แบบตั้งเวลา | [493:3243](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=493-3243) | /classrooms/:classroomId#assignments | Missing capability | Not Verified | GAP-006 |
| Owner/F | J13c · ตั้งเวลาเปิดรับ · 15 ต.ค. 09:00 | [491:6320](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=491-6320) | /classrooms/:classroomId#assignments | Missing capability | Not Verified | GAP-006 |
| Owner/G | S12 · บันทึกไม่สำเร็จ | [517:3990](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=517-3990) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/G | S11 · ดาวน์โหลด CSV ตัวอย่าง | [517:3978](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=517-3978) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/G | S10 · ประวัติการส่งออก | [517:3957](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=517-3957) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Owner/G | S09 · รายละเอียดความเป็นส่วนตัว | [517:3942](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=517-3942) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/G | S08 · ออกโดยยังไม่บันทึก | [517:3931](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=517-3931) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/G | S07 · วันเวลาเปิดรับไม่ถูกต้อง | [517:3910](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=517-3910) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/G | S06 · คะแนนอยู่นอกช่วง | [517:3890](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=517-3890) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/G | S05 · ไม่ได้กรอกเหตุผล | [517:3870](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=517-3870) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/G | S04 · ส่งออกไฟล์ไม่สำเร็จ | [517:3857](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=517-3857) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/G | S03 · ส่งออกไฟล์สำเร็จ | [517:3842](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=517-3842) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/G | S02 · คำนวณคะแนนสำเร็จ | [517:3833](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=517-3833) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Owner/G | S01 · กำลังคำนวณคะแนน | [517:3821](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=517-3821) | /classrooms/:classroomId | Partial route match | Not Verified | UI-003 |
| Co-teacher/A | C03 · ห้องเรียนของฉัน · ถูกเพิ่มเป็นผู้สอนร่วม | [343:205](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=343-205) | /classrooms | Partial route match | Not Verified | UI-002 |
| Co-teacher/A | C02 · ประกาศความเป็นส่วนตัว (login ครั้งแรก) | [343:162](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=343-162) | — | Not Verified | Not Verified | — |
| Co-teacher/A | C01 · เข้าเว็บ → เข้าสู่ระบบด้วย Google | [343:7](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=343-7) | / | Partial route match | Not Verified | — |
| Co-teacher/B | R06 · รายชื่อถูกล็อก · มีงานเผยแพร่แล้ว | [444:2546](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=444-2546) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/B | R05 · ยืนยันถอดนักศึกษา | [441:4086](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-4086) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/B | R04 · นำเข้าซ้ำ · ตรวจการเปลี่ยนแปลง | [441:3909](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-3909) | /classrooms/:classroomId#members | Missing capability | Not Verified | GAP-004 |
| Co-teacher/B | R03 · ตรวจ CSV ก่อนนำเข้า | [441:3798](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-3798) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/B | R02 · CSV ไม่ผ่านการตรวจ | [441:3722](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-3722) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/B | R01 · สมาชิกในห้องเรียน | [441:3592](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-3592) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/C | A07 · ขยายกำหนดส่ง | [441:5425](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-5425) | /classrooms/:classroomId#assignments | Missing capability | Not Verified | GAP-006 |
| Co-teacher/C | A06 · ยกเลิกเผยแพร่ · เตือนผลกระทบ | [441:5326](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-5326) | /classrooms/:classroomId#assignments | Missing capability | Not Verified | GAP-006 |
| Co-teacher/C | A05 · ภาพรวมห้อง · เผยแพร่แล้ว | [441:5241](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-5241) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/C | A04 · ยืนยันเผยแพร่และจัดคู่ | [441:5079](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-5079) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/C | A03 · ตรวจความเป็นไปได้ | [441:4954](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-4954) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/C | A02 · สร้างงาน · น้ำหนักครบ | [441:4645](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-4645) | /classrooms/:classroomId#assignments | Partial route match | Not Verified | GAP-005 |
| Co-teacher/C | A01 · สร้างงาน · น้ำหนักไม่ครบ | [441:4225](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-4225) | /classrooms/:classroomId#assignments | Partial route match | Not Verified | GAP-005 |
| Co-teacher/D | C05 · ติดตามการส่ง (รายคน) | [343:2022](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=343-2022) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/D | W03 · ภาพรวมห้อง · ปิดรับแล้ว | [441:5680](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-5680) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/D | W02 · งานปิดรับ · ตรวจรายงาน | [441:5604](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-5604) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/D | W01 · งานเปิดรับ · ติดตามการส่ง | [441:5528](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-5528) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/E | S07 · บันทึกคำตอบอาจารย์แล้ว | [443:2355](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=443-2355) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/E | S06 · แก้คะแนน · บังคับเหตุผล | [441:6424](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-6424) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/E | S05 · ประเมินเอง · Aurora–Borealis | [441:6246](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-6246) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Co-teacher/E | S04 · ส่งประเมินเพิ่มไม่ได้ · ไม่มีผู้มีสิทธิ์เหลือ | [441:6130](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-6130) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/E | S03 · Coverage รายคู่ | [441:6036](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-6036) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Co-teacher/E | S02 · รายงานคะแนนรายบุคคล · ชั่วคราว | [441:5899](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-5899) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/E | S01 · รายงานคะแนนกลุ่ม · ชั่วคราว | [441:5760](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-5760) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/F | P02 · ตอบคำร้อง · แก้คะแนนต้องให้เจ้าของห้องเปิดผลใหม่ | [483:7600](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=483-7600) | — | Missing capability | Not Verified | GAP-002 |
| Co-teacher/F | P01 · คำร้องอุทธรณ์ · ผู้สอนร่วมดูและตอบได้ | [483:7516](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=483-7516) | — | Missing capability | Not Verified | GAP-002 |
| Co-teacher/F | C14 · ลองเปิดหน้าตัวตนผู้ประเมินผ่าน URL → 403 | [343:3954](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=343-3954) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/F | Q07 · ส่งออกรายงานด้วยรหัสแฝงสำเร็จ | [443:2533](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=443-2533) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/F | Q06 · ส่งออกด้วยรหัสแฝง | [441:7528](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-7528) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/F | Q05 · การกระจายคำตอบ | [441:7262](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-7262) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Co-teacher/F | Q04 · ยกเว้นคำตอบแล้ว | [441:7124](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-7124) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Co-teacher/F | Q03 · ยกเว้นคำตอบ · บังคับเหตุผล | [441:6941](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-6941) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Co-teacher/F | Q02 · ดูคำตอบ E7 · รหัสแฝง | [441:6731](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-6731) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Co-teacher/F | Q01 · รายงานคุณภาพ QS-01–07 | [441:6566](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-6566) | /classrooms/:classroomId#scores | Missing capability | Not Verified | GAP-007 |
| Co-teacher/G | K05 · เพิ่มผู้สอนร่วมแล้ว · วิภา | [508:2343](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=508-2343) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/G | K04 · ถอด TA ออกจากห้อง | [505:6259](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=505-6259) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/G | K03 · เพิ่มผู้สอน · error อีเมลเป็นนักศึกษาในห้องนี้ | [505:6106](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=505-6106) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/G | K02 · เพิ่มผู้สอน · เพิ่มผู้สอนร่วมอีกคน | [505:5953](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=505-5953) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| Co-teacher/G | K01 · ทีมผู้สอน · ผู้สอนร่วมจัดการผู้สอนร่วมและ TA ได้ (เมนูของ นนท์) | [505:5832](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=505-5832) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| TA/A | T02 · ประกาศความเป็นส่วนตัว (ป๊อปอัพตอน login ครั้งแรก) | [415:714](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=415-714) | — | Not Verified | Not Verified | — |
| TA/A | T03 · ห้องเรียนของฉัน · ถูกเพิ่มเป็น TA | [344:209](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=344-209) | /classrooms | Partial route match | Not Verified | UI-002 |
| TA/A | T01 · เข้าเว็บ → เข้าสู่ระบบด้วย Google | [344:11](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=344-11) | / | Partial route match | Not Verified | — |
| TA/B | T05a · ตรวจ CSV ไม่ผ่าน · ไม่บันทึกทั้งไฟล์ | [435:611](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=435-611) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| TA/B | T05b · แก้รายชื่อไม่ได้ · ต้องให้ Owner ยกเลิกเผยแพร่ก่อน | [435:509](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=435-509) | /classrooms/:classroomId#assignments | Missing capability | Not Verified | GAP-006 |
| TA/B | T08 · นักศึกษาถอนรายวิชา · ทำเครื่องหมายแทนการถอด | [344:1266](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=344-1266) | /classrooms/:classroomId#members | Missing capability | Not Verified | GAP-004 |
| TA/B | T07 · รายชื่ออัปเดตแล้ว · ฟ้า login ได้ | [344:1142](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=344-1142) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| TA/B | T06 · นำเข้าไฟล์ที่แก้แล้ว · ดูการเปลี่ยนแปลงก่อนยืนยัน | [344:881](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=344-881) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| TA/B | T05 · รายชื่อ · นักศึกษาแจ้งว่าเข้าห้องไม่ได้ | [344:505](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=344-505) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| TA/B | T04 · ภาพรวมห้อง · มุมมอง TA (ไม่มีงาน/คะแนน) | [344:297](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=344-297) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| TA/C | T09 · ลองเปิดรายงานคะแนนผ่าน URL → 403 | [344:3455](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=344-3455) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| TA/D | T12b · รับคำขอสำเนาข้อมูลแล้ว | [435:720](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=435-720) | /classrooms/:classroomId | Partial route match | Not Verified | — |
| TA/D | T13 · คู่มือ · เกี่ยวกับ PairEval | [411:894](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=411-894) | — | Not Verified | Not Verified | — |
| TA/D | T12 · คู่มือ · ความเป็นส่วนตัว และข้อมูลของฉัน | [411:823](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=411-823) | — | Not Verified | Not Verified | — |
| TA/D | T11 · คู่มือ · การทำงานของระบบ | [411:693](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=411-693) | — | Not Verified | Not Verified | — |
| TA/D | T10 · คู่มือ · ขั้นตอนการใช้งาน | [411:541](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=411-541) | — | Not Verified | Not Verified | — |

## Design system และข้อจำกัด

- No complete variable/style API export: typography styles, all effect values, layout grids, auto-layout constraints and every component state are Not Verified beyond inspected properties. Runtime CSS tokens are separately recorded in discovery.json/runtime.json.
- Only Student has verified390px mobile screens M01–M09. Other roles and375/430/768/1366/1920px lack a verified exact Figma reference; usability remains independently tested.
- Old score292:7699 is stale; use current ST30 60:437.
- Figma ST30 says15/15 p1.00 but paints a partially filled bar; evaluate percentage from real data, do not copy contradictory decoration.
- Figma ST20 selected2nd circle but its answer text says a stronger choice; interpret selection semantics from the product scale and confirm design consistency before changing data mapping.
- User explicitly requested the40px orange Google-labelled login button; its wording/size are an accepted user override, not an unqualified mismatch against guest Figma.

## Component masters41

| Name | Node | Visual state verification |
|---|---|---|
| Button | [86:356](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-356) | Not Verified — enumerated master; not all visual variants inspected |
| IconButton | [91:237](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-237) | Not Verified — enumerated master; not all visual variants inspected |
| Avatar | [86:464](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-464) | Not Verified — enumerated master; not all visual variants inspected |
| Checkbox | [91:199](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-199) | Not Verified — enumerated master; not all visual variants inspected |
| Radio | [91:213](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-213) | Not Verified — enumerated master; not all visual variants inspected |
| Toggle | [91:230](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-230) | Not Verified — enumerated master; not all visual variants inspected |
| Icon / Check | [86:389](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-389) | Not Verified — enumerated master; not all visual variants inspected |
| Icon / Alert | [86:391](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-391) | Not Verified — enumerated master; not all visual variants inspected |
| Icon / Clock | [86:395](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-395) | Not Verified — enumerated master; not all visual variants inspected |
| Icon / CheckCircle | [86:398](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-398) | Not Verified — enumerated master; not all visual variants inspected |
| Icon / ChevronDown | [86:796](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-796) | Not Verified — enumerated master; not all visual variants inspected |
| Input | [86:453](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-453) | Not Verified — enumerated master; not all visual variants inspected |
| SearchInput | [91:247](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-247) | Not Verified — enumerated master; not all visual variants inspected |
| TextArea | [91:255](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-255) | Not Verified — enumerated master; not all visual variants inspected |
| Dropdown | [86:809](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-809) | Not Verified — enumerated master; not all visual variants inspected |
| MenuOption | [86:798](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-798) | Not Verified — enumerated master; not all visual variants inspected |
| DeadlinePicker | [86:889](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-889) | Not Verified — enumerated master; not all visual variants inspected |
| DayCell | [86:876](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-876) | Not Verified — enumerated master; not all visual variants inspected |
| UploadDropzone | [91:351](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-351) | Not Verified — enumerated master; not all visual variants inspected |
| Pill | [86:401](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-401) | Not Verified — enumerated master; not all visual variants inspected |
| SaveStatus | [91:265](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-265) | Not Verified — enumerated master; not all visual variants inspected |
| Banner | [86:435](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-435) | Not Verified — enumerated master; not all visual variants inspected |
| FieldError | [86:469](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-469) | Not Verified — enumerated master; not all visual variants inspected |
| EmptyState | [86:789](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-789) | Not Verified — enumerated master; not all visual variants inspected |
| Tooltip | [91:392](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-392) | Not Verified — enumerated master; not all visual variants inspected |
| Dialog | [91:332](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-332) | Not Verified — enumerated master; not all visual variants inspected |
| Skeleton | [91:397](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-397) | Not Verified — enumerated master; not all visual variants inspected |
| ScaleOption | [86:494](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-494) | Not Verified — enumerated master; not all visual variants inspected |
| ComparisonRow | [86:615](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-615) | Not Verified — enumerated master; not all visual variants inspected |
| ProgressBar | [86:492](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-492) | Not Verified — enumerated master; not all visual variants inspected |
| ScoreCard | [91:308](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-308) | Not Verified — enumerated master; not all visual variants inspected |
| AppNav | [86:770](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-770) | Not Verified — enumerated master; not all visual variants inspected |
| ClassroomTabs | [86:780](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-780) | Not Verified — enumerated master; not all visual variants inspected |
| TabItem | [86:761](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-761) | Not Verified — enumerated master; not all visual variants inspected |
| Stepper | [91:389](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-389) | Not Verified — enumerated master; not all visual variants inspected |
| Pagination | [91:358](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-358) | Not Verified — enumerated master; not all visual variants inspected |
| RosterRow | [86:830](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-830) | Not Verified — enumerated master; not all visual variants inspected |
| ClassroomCard | [91:276](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-276) | Not Verified — enumerated master; not all visual variants inspected |
| AssignmentCard | [91:299](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=91-299) | Not Verified — enumerated master; not all visual variants inspected |
| CardHead | [86:475](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-475) | Not Verified — enumerated master; not all visual variants inspected |
| Card | [86:482](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-482) | Not Verified — enumerated master; not all visual variants inspected |
