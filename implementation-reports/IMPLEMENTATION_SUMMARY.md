# PairEval Figma implementation summary

ทำบน branch `codex/figma-frontend` จากฐาน WS-08 `c50702a39a0be9dd52ad39f9f56db592925384fa` แก้ source จริงและตรวจ render/flow/visual หลายรอบ ไม่มี commit/push หรือ deploy สู่ staging/production

| Scope | Count / status |
|---|---|
| Page modules / route families |9:เดิม 5 และใหม่ 4(notifications,appeal,audit,quality) |
| Component modules |28 ไฟล์ TSX ที่แก้/เพิ่ม รวม Ui/icons;นับเป็น module ไม่ใช่จำนวน componentfunctions หรือ Figma masters |
| Original audit issues |28 IDs:19functional/asset แก้และตรวจจริง,8visual ปรับและเทียบ reference หลัก,1partial(GAP-007 ด้าน QS-06/07) |
| Flow groups |16 กลุ่มตามรายการด้านล่าง ไม่ใช่จำนวน tests |
| Figma assets |14 ไฟล์จาก Export panel จริง พร้อม node/provenance |
| New project dependencies |0;axe-core อยู่เฉพาะ.local ตามที่ผู้ใช้อนุญาต |
| Unit |Backend439/Frontend29 ผ่าน;combinedloop6.09s |
| Integration / existing E2E / new regression |32/130/24 ผ่านแยก suite |
| Responsive / axe |7 ขนาดจอ;112scanreports ไม่พบ violations ใน states ที่ตรวจ |
| Typecheck / production build / Ruff / OpenAPI |ผ่าน;OpenAPI0warnings |
| Frontend lint |0errors/17warnings(เก็บรายการจริงไว้) |

งานภาพครอบคลุม tokens/typography/buttons/cardvariants/navigation,หน้าแรก,ห้องเรียน,focusedworkspaces,studentdashboard,หลายเกณฑ์และผลงานจริง,mobileverticalscale,คะแนนแยกเกณฑ์และ privacy,notifications,appealreceipt/response,audit และ quality/coverage ไม่อ้าง 100%หรือ pixel-perfect

16flowgroups ที่ทำ/ตรวจ: session และ routeguard;สร้าง/ค้นหา/กรองห้อง;archive/restore/delete-empty;CSVpreview/import;staffroles;withdraw/restore/repair;authoringcriteria/questions/artifacts;draftedit/copy;publish/schedule;unpublish/republish;extenddeadline;evaluationautosave/submit/offline;notifications;scorefinalize/reopen/override/export;appeals;quality/coverage/identity/exclusion/instructor/audit

Backend ยังใช้ FastAPI/Postgres เดิม เพิ่ม migrations012–020 และ API ที่จำเป็นเพื่อให้หน้าเว็บใช้ข้อมูลจริง เก็บ submitted history และ final snapshots เปิดตัวตน/ตัดคำตอบต้องใช้สิทธิ์ OWNER พร้อมเหตุผล/audit การตัดคำตอบไม่ลด participationcredit การถอนเป็นสถานะต่อห้อง ไม่ปิดบัญชีในห้องอื่น

Preview ที่ [127.0.0.1:5173](http://127.0.0.1:5173/) เปิดกลับและเชื่อม API ใหม่แล้ว ตรวจ HTTP200/APIhealthok พร้อมเทียบ rowcounts ก่อน/หลังตรงกัน ไม่ seed/cleanup preview หากแท็บเดิมค้าง network-error ให้รีเฟรชด้วยผู้ใช้เอง

ข้อจำกัดหลัก: QS-06/07 ไม่มีข้อมูลพอจึงแสดงยังประเมินไม่ได้,GoogleOAuth จริงยังไม่ตรวจด้วยบัญชีผู้ใช้,notifications เป็น projection ล่าสุด 100 รายการ,คง randomization แยกเกณฑ์เดิม และไม่ได้พิสูจน์ visual ทุก 191frame/state

รายละเอียด: [ผลทดสอบ](REGRESSION_TEST_REPORT.md), [ภาพเทียบ](FIGMA_COMPLIANCE.md), [issue log](FIXED_ISSUES.md), [สิ่งที่ยังจำกัด](REMAINING_ISSUES.md) ผล functional/axe ไม่ใช้แทนความเหมือน Figma ทุก state
