# Responsive Issues

2026-10-19 · 5routesทุก6viewportsและ4classroomroles. เพิ่มStudent390pxเพื่อเทียบFigmaโดยตรง ไม่resize375/430ให้ปลอมว่าเป็น390

| Viewport | Captured states | Document overflow | Broken images | Exact Figma reference |
|---|---:|---|---|---|
| 375×812 | 34 | PASS · ไม่พบ>1px | PASS | ไม่มีexactwidthที่verified; Studentmobile390ใช้เทียบเสริม |
| 430×932 | 34 | PASS · ไม่พบ>1px | PASS | ไม่มีexactwidthที่verified; Studentmobile390ใช้เทียบเสริม |
| 768×1024 | 34 | PASS · ไม่พบ>1px | PASS | ไม่มีexactwidthที่verified; Studentmobile390ใช้เทียบเสริม |
| 1366×768 | 34 | PASS · ไม่พบ>1px | PASS | ไม่มีexactwidthที่verified; Studentmobile390ใช้เทียบเสริม |
| 1440×900 | 36 | PASS · ไม่พบ>1px | PASS | Desktopcoreframes; heightขึ้นกับpage |
| 1920×1080 | 34 | PASS · ไม่พบ>1px | PASS | ไม่มีexactwidthที่verified; Studentmobile390ใช้เทียบเสริม |

34commonstates×6=204 บวก2submissionreproductions1440=206 แต่ละcaptureมีfullและviewportรวม412PNG. Commonstatesประกอบด้วยhome3,4roles×5list/menu/search/detailstates=20,create-dialog1,evaluation7,score3. Screenshotindexอยู่ [EVIDENCE_INDEX.md](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/EVIDENCE_INDEX.md>)

| Issue | Page / viewport | Observation | Evidence |
|---|---|---|---|
| UI-006 | Evaluate375/390/430 | 3×2circlegridต่างจาก6verticaloptionsของM04 | [evidence/comparison/evaluation-mobile-side-by-side.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/comparison/evaluation-mobile-side-by-side.png>) |
| UI-002 | Classrooms390 | Studentใช้desktopmanagementcontrolstack; search/card/headerต่างM01 | [evidence/visual/student-classrooms-390.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/student-classrooms-390.png>) |
| UI-004 | Studentclassroom390 | welcome+rosterแทนassignmentstatusdashboardของM03 | [evidence/comparison/student-classroom-mobile-side-by-side.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/comparison/student-classroom-mobile-side-by-side.png>) |
| UI-009 | Protectedheader≤420 | ซ่อนPairEvalwordmarkต่างfreshmobileframes | [evidence/visual/student-classrooms-390.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/student-classrooms-390.png>) |
| A11Y-001 | Home375 | Brandlinkไม่มีaccessible nameเมื่อข้อความซ่อน | [evidence/runtime/home-guest-375x812-viewport.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/home-guest-375x812-viewport.png>) |
| AXE-REVIEW (ไม่ใช่issue) | Roster375/430 · Co/TA/student | TabและArrowRightผ่านจริงทั้ง6; ถอนA11Y-003ซึ่งเป็นaxe falsepositiveในChromium | [evidence/visual/roster-keyboard.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/roster-keyboard.json>) |

Nativecreate-dialogที่375/430เปิดได้ในviewport,autofocus/Escape/returnfocusผ่าน; sortingkeyboardและsearchemptyผ่านทุกrole/viewport. Horizontalclassroomsectionpills/rostertableที่ตั้งใจเลื่อนภายในไม่ใช่documentoverflowโดยอัตโนมัติ ไม่พบหลักฐานimagebreakหรือpagewidehorizontalscrollในmatrixนี้

ตัวตรวจtarget24พบ4patterns:inputfile1×1เป็นsr-onlyที่มีdropzonelabel,assignmenttextlink66×20และcontextlinks88×19.5/72×19.5. ยังต้องตรวจspacing/inlineexceptionของแต่ละplacement จึงเป็นREVIEW ไม่ใช่automaticWCAG2.5.8failure และไม่รวมใน28issues. [WCAGTargetSizeMinimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) มีข้อยกเว้น/spacingcriteria ไม่ใช่กฎ44pxทุกcontrol

FigmaStudentมีM01–M09ที่390pxเท่านั้นที่verifyได้; mobileOwner/Co-teacher/TA,tablet768,laptop1366,wide1920ไม่มีverifiedexactdesignvariant จึงให้ผลusabilityที่ตรวจจริงและแยกFigmaNotVerified. Landscape/orientationchange,200%/400%zoom,virtualkeyboardและactualtouchdevicesยังNOTTESTED
