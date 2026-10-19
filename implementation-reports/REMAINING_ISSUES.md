# Remaining issues and verification limits

Original audit มี 28 issue IDs (A11Y-003 ถูกถอนก่อนหน้านี้แล้วและไม่นับซ้ำ) งานรอบนี้แก้และทดสอบ functional/asset issues 19 IDs ปรับภาพและเทียบ reference หลักอีก 8 IDs และมี GAP-007 ที่ยังไม่ครบด้านข้อมูลสถิติ สถานะ visual comparison ไม่เท่ากับผ่านทุก variant

| รายการ | สถานะ / เหตุผล | สิ่งที่ต้องทำต่อ |
|---|---|---|
| GAP-007: QS-06 | ไม่มีข้อมูลความสัมพันธ์เพื่อน/กลุ่มเดิม และฐานเปรียบเทียบ z-score จึงแสดงยังประเมินไม่ได้ | กำหนดข้อมูลและวิธีคำนวณก่อนเพิ่ม schema/สถิติ ไม่สร้างค่าตัวอย่างและไม่ลงโทษอัตโนมัติ |
| GAP-007: QS-07 | งานเดิมสุ่มคู่ต่างชุดต่อเกณฑ์ ยังไม่มีอันดับร่วมที่ครบสำหรับ Kendall's W | ตกลงเงื่อนไขที่คำนวณได้และจำนวนตัวอย่างขั้นต่ำ พร้อม statistical tests |
| UI-001 | Home1440 สูง 1875 เทียบ Figma1870; raw differing pixels60635 รวม font rendering, user override และ badge | ดู overlay/side-by-side; หากต้องการ exact pixel baseline ต้องตรึงแบบ ข้อมูล browser/fonts และยอมรับข้อยกเว้น Google/badge ก่อน |
| UI-002–007, UI-009 | ปรับและตรวจ reference หลักแล้ว แต่ไม่ได้พิสูจน์ทุกหนึ่งใน 191frame/state หรือทุก browser | ตรวจ visual variants ที่เหลือเมื่อ Figma นิ่งและเมื่อมีข้อมูลจริงสำหรับ state นั้น |
| ภาพรวมผู้สอน | สรุปทีมผู้สอนจริงแทนตัวนับ quality ที่ยังไม่มีนิยามรวมหลายงาน | กำหนดว่าตัวนับ “ต้องตรวจ” รวม QS/appeal/คน/คู่/งานอย่างไร เพื่อไม่ให้ตัวเลขชวนเข้าใจผิด |
| Notifications | projection ล่าสุด 100 รายการ ไม่ใช่ immutable event inbox ย้อนหลังทุก transition | หากต้องการ retention/history ต้องกำหนด outbox/event schema และ retention policy |
| Real Google OAuth | E2E ใช้ test-only sessions และ GIS/auth exchange doubles | ผู้ใช้ทดสอบ popup/เลือกบัญชี/ยกเลิกจริงใน origin ที่ลงทะเบียน ไม่ส่ง credential เข้าเครื่องมือ AI |
| Frontend lint | 0 errors,17 effect/purity/dependency warnings | ไม่ปิดกฎเพื่อหลบ warnings; แยกงานลดผลกระทบ effects และทบทวน false-positive callback purity ตามความเหมาะสม |

ข้อจำกัดทางพฤติกรรมที่แสดงใน UI แล้ว:

- การถอน/คืนสถานะในห้องที่มี FINALIZED ต้องเปิดผลใหม่ก่อน งานหมดเวลาต้องขยายกำหนดก่อน เพื่อไม่มอบหมายงานใหม่ที่ส่งไม่ทันและกระทบ participation
- การ repair เก็บคำตอบที่ส่งของสมาชิกที่ยังอยู่ roster เล็กลงอาจได้ coverage ไม่พอ จะแสดง warning ตามจริง
- เวลาเก่าย้อนเก็บไม่ได้ เวลาใหม่วัดเฉพาะคำถามที่มองเห็นในแท็บ ไม่รวมเวลาอ่านผลงานภายนอก ค่าที่ไม่มีข้อมูลไม่ใช่ 0 วินาที
- minComparisons ยังใช้ร่วมกับ low-confidence/k-anonymity ตาม domain เดิม
- ไม่มีการยืนยัน NFR200 concurrent users/performance หลัง redesign ด้วยผล unit/E2E; รอบนี้ไม่ยิง load test ไป staging
- axe-core ไม่พบ violations ในสถานะที่สแกน ไม่เท่ากับผ่าน manual WCAG/ทุก interaction/ทุก assistive technology ทั้งหมด

เว็บทดลองตอบ HTTP200 และ APIhealth=ok หลังเปิด server กลับและอัปเดต API มีการตรวจ row counts ก่อน/หลังโดยไม่ seed/cleanup เดิม หน้า browser ของผู้ใช้อาจยังค้าง network-error document ต้องให้ผู้ใช้รีเฟรชเอง การอ่าน error document ผ่าน browser tool ถูก browser security policy ปฏิเสธ จึงไม่เปลี่ยน browser surface เพื่อข้ามข้อจำกัดนั้น
