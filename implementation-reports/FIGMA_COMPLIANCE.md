# Figma compliance — implementation evidence

อ้างอิง [PairEval Design System](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=175-3) อ่านผ่าน UI จริงในโหมด view-only และใช้ assets จาก Figma โดยตรง 14 ไฟล์ รายการ node/export อยู่ใน `frontend/src/assets/figma/README.md`

Before อยู่ใน `audit-reports/evidence/` ไม่แก้ย้อนหลัง After อยู่ใน `evidence/after/` ใช้ข้อมูลและ API จริงใน disposable test environment ชื่อ วันที่ คะแนน และจำนวนรายการจึงต่างจากตัวอย่าง Figma

| Page / route | Before / reference | After evidence | Status |
|---|---|---|---|
| Home `/` | UI-001, 175:3 | [comparison](evidence/comparison/home-1440-side-by-side.png) | ปรับ hero/CTA/typography/cards/spacing/rings/wave จากค่าจริงแล้ว ความสูงรวม 1875 เทียบ 1870 ไม่อ้าง pixel-perfect |
| Classrooms `/classrooms` | UI-002, 349:2388 / 516:825 | [owner](evidence/comparison/classrooms-owner-side-by-side.png), [student](evidence/comparison/classrooms-student-side-by-side.png) | แยก layout ตามบทบาท; banner/search/filters/metadata และ pending count จริง |
| Classroom `/classrooms/:id` | UI-003/004, 330:1914 / 516:923 | [owner](evidence/comparison/classroom-owner-side-by-side.png), [student](evidence/comparison/classroom-student-side-by-side.png) | focused workspaces, student task sections, ใช้ภาพ Welcome จริง; เก็บเครื่องมือเดิมที่ใช้งานได้ |
| Members `#members` | UI-003, 330:1057 | [comparison](evidence/comparison/members-owner-side-by-side.png) | preview/import/role/enrollment ทำงานจริง มี guards เมื่อเผยแพร่แล้ว |
| Evaluation `.../evaluate` | UI-005/006, 57:3 / 516:996 | [desktop](evidence/comparison/evaluation-desktop-side-by-side.png), [mobile](evidence/comparison/evaluation-mobile-side-by-side.png) | pair context, criteria/questions/weights/artifacts และตัวเลือกแนวตั้งมีขอบ; จำนวนเกณฑ์ต่อคู่ขึ้นกับ assignment จริง |
| Own score `.../score` | UI-007/008, 60:437 / 516:1322 | [desktop](evidence/comparison/score-desktop-side-by-side.png), [mobile](evidence/comparison/score-mobile-side-by-side.png) | breakdown/max/date/count/group/participation/privacy และ ScoresReleased asset จริง |
| Notifications `/notifications` | GAP-001, 516:870 | [comparison](evidence/comparison/notifications-mobile-side-by-side.png) | ใช้เหตุการณ์จริงและ read state; จำนวน/ข้อความขึ้นกับข้อมูลจริง |
| Appeal `.../appeal` | GAP-002, 516:1393 / 516:1440 | [form](evidence/comparison/appeal-mobile-side-by-side.png), [receipt](evidence/after/appeal-submitted.png) | แบบฟอร์ม/receipt/response จริง ใช้ Illustration/Appeal; เก็บคำร้องของตัวเองให้ตรวจย้อนหลังได้ |
| Audit `.../audit` | GAP-007, 432:12097 | [desktop](evidence/after/ownerAudit-1440.png), [mobile](evidence/after/ownerAudit-390.png) | ตาราง UTC/filter/detail/before-after/reason จริง; ไม่สร้าง IP ที่ API ไม่ได้คืน |
| Quality / coverage `.../quality` | GAP-007, 334:2250 / 334:2042 | [quality](evidence/after/ownerQuality-1440.png), [coverage](evidence/after/ownerCoverage-1440.png), [teacher](evidence/after/coverage-instructor-dialog-375.png) | ตรวจโครงและ properties ผ่าน Figma UI แล้ว; QS-06/07 ยังไม่คำนวณเมื่อไม่มีข้อมูล ไม่ได้ทำ full-frame pixel comparison ของ J28 |

ค่าที่ตรวจจาก Properties: paper `#FFFCF7`, surface/cream `#FFF3EC`, text `#321007`, hero gradient `#FF7D3D/#FFD67D/#FF7A38`, secondary MD 212×50 radius999 border `#C9C0B9`; IBM Plex Sans Thai hero64/700/120%, paragraph23/145%; How-it-works heading34/700/145%, padding40/140/48/140, gap28, shortcuts1160×380; privacy card1160×332 radius48 padding16×32 gap40, art480×300, title34/145%, body21/145%

Home ใช้ Pixelmatch แบบไม่ resize, top-align และ pad พื้นล่างให้เท่ากัน threshold0.1 / ignoreAA: จาก audit 235250 เป็น 60635 differing pixels บน canvas1440×1875 ตัวเลขนี้เป็น diagnostic ไม่ใช่เปอร์เซ็นต์ compliance และไม่ใช่จำนวน bugs ดู [JSON](evidence/comparison/home-1440.json), [overlay](evidence/comparison/home-1440-overlay.png) และ [diff](evidence/comparison/home-1440-diff.png)

หน้าที่ข้อมูลเปลี่ยนใช้ 11 unscaled side-by-side boards บันทึกเงื่อนไขใน [boards.json](evidence/comparison/boards.json) ไม่ใช้ pixel diff จัดคะแนนความเหมือนเมื่อข้อมูลคนละชุด Sticky footer ใน full-page PNG อาจอยู่ ณ ตำแหน่ง viewport ตอนถ่าย ไม่อนุมานเป็น layout overlap จากภาพยาวเพียงอย่างเดียว

ความต่างที่คงโดยมีเหตุผล: ปุ่ม Google สีส้ม/ข้อความไทยตามคำสั่งผู้ใช้, readiness badge สำหรับ preview, แถบความคืบหน้าใช้สัดส่วนจริง, ตัวเลขเล็กใช้ส้มเข้มเพื่อ contrast, มี error/retry/readonly/permission hints ตาม API จริง และคงกฎสุ่มคู่แยกเกณฑ์/ซ้ายขวาเดิม

Inventory 191 frames ไม่เท่ากับทดสอบภาพครบ 191 frames การตรวจ reference หลักและ responsive matrix ไม่รับรองทุก hover/loading/empty/long-content/role permutation หรือทุก browser ว่าตรงทุกพิกเซล
