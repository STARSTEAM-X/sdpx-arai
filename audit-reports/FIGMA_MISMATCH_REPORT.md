# Figma Mismatch Report

รายงานหลัก · 2026-10-19 · AUDIT ONLY

ผล: ทุก5route familiesมีความต่างที่ยืนยันได้จากfreshreferenceและเว็บจริง ไม่มีการให้complianceเปอร์เซ็นต์ ชื่อ/คะแนน/จำนวนห้อง/วันที่จากsyntheticfixtureที่ไม่ตรงแบบไม่ถูกนับเป็นbug ตัวเลข191คือscreen/stateframesจาก7pages ไม่ใช่191URLs

เทียบเต็มภาพcoreexports11frames:10framesมีเว็บให้เทียบ,1appealsuccessframeไม่มีimplementation. อีก180framesมีinventory/mappingครบแต่fullvisualเป็นNot Verified. Missingcapability59framesรวมเป็น8issuefamiliesเพื่อลดรายการซ้ำ; รายละเอียดlayoutของframesที่ไม่ได้exportยังNot Verified

| Website page | Fresh reference | Confirmed differences |
|---|---|---|
| Home | 175:3 | UI-001 |
| Classroom list | 349:2388 / 516:825 | UI-002, UI-009 |
| Classroom detail | 330:1914 / 330:1057 / 516:923 | UI-003, UI-004, UI-009 |
| Evaluation | 57:3 / 516:996 | UI-005, UI-006, UI-009 |
| Own score | 60:437 / 516:1322 | UI-007, UI-008, UI-009 |

## วิธีเทียบและข้อยกเว้น

Playwright Chromium, th-TH, Asia/Bangkok,100%zoom,DPR1,productionbuild; รอdocument.fonts.ready/images และเก็บviewport+fullpage. เพิ่ม390pxให้ตรงStudent mobileFigma พร้อมfixture3GROUP+2INDIVIDUALcriteria/max15+5เพื่อไม่สับสนว่ารายละเอียดที่หายเพราะdataset

Pixelmatchใช้guesthome1440pxเท่านั้น: Figma1440×1870,เว็บ1440×1948; top-alignและpadด้านล่างด้วยpaperโดยไม่resize, threshold0.1/ignoreantialiasing. ได้235250differentpixelsบนcanvas2805120pixels(พื้นที่ทับกัน234892/2692800). นี่คือrawdiagnostic ไม่ใช่compliance scoreและไม่ใช่235250bugs; ตรวจภาพแล้วแยกgeometryจริงออกจากfont rasterization,extra healthbadgeและuseroverride. [evidence/comparison/home-1440.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/comparison/home-1440.json>) · [evidence/comparison/home-1440-diff.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/comparison/home-1440-diff.png>) · [evidence/comparison/home-1440-overlay.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/comparison/home-1440-overlay.png>)

หน้าที่มีdynamicdataใช้unscaledside-by-side ไม่คำนวณpixelmismatchตัดสินbug: [evidence/comparison/boards.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/comparison/boards.json>). Stickyfooterอาจปรากฏกลางfull-pagescreenshotที่ตำแหน่งviewportเดิม ให้ดูviewportPNGประกอบ ไม่อนุมานเป็นoverlap defect

ข้อยกเว้น: ปุ่มGoogleสีส้ม40px/ข้อความเข้าสู่ระบบด้วยGoogleเป็นคำสั่งผู้ใช้ที่มาก่อนaudit จึงไม่เรียกmismatchกับFigmaโดยไม่มีบริบท. ST30มี15/15,p1.00แต่barเติมเพียงบางส่วน และST20selectedcircle/answercaptionไม่สอดคล้องกัน ต้องยืนยันdesignก่อนลอก; ไม่เปลี่ยนlogicที่ถูกเพื่อให้เหมือนภาพที่ขัดแย้ง

## Tokens / components ที่ตรวจค่าได้

Figma175:3: flowVertical,width1440,heightHug1870,surface/paper#FFFCF7. SecondaryMDDefault121:284: width212,height50,radius999,border1,padding12×24,gapspace/2,fillwhite,borderreference/neutral-border#C9C0B9. Buttonmasterมี3styles×2sizes×4states=24variants. ค่าของvariantอื่น/fonts/styles/effects/gridsทั้งหมดไม่ถูกเหมารวมว่าMatch; fulltokenAPIexportไม่มีในview-onlytoolที่เชื่อมอยู่

RuntimeH1home64px/700/line78.08,color#321007,CTA#B84204,bodyNotoSansThai/displayIBMPlexSansThai/monoIBMPlexMono; fontfilesloadedและไม่มีbrokenimageใน206captures. Sharedbtnmd44px/border#E4CCBAต่างจากsamplemaster50px/#C9C0B9 แต่ต้องเทียบconsumer/variantก่อนนับเป็นglobaldefect; ไม่ใช้ตัวอย่างmasterบังคับทุกปุ่ม. รายการCSStokensทั้งหมดอยู่ [discovery.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/discovery.json>) และค่าcomputedอยู่ [runtime.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/runtime.json>)

<a id="ui-001"></a>

## UI-001 · P3 · Hero / ProcessFlow / CtaBand / footer

- Type: Figma Mismatch · Page: Guest home · Route: `/`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [Home — Guest · Orange illustrated · 175:3](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=175-3)
- Expected: 1440px guestframeสูง1870px; hero CTA raster bounds x502,y359,w208,h50 (ขอบภาพ±1px)
- Actual / exact difference: เว็บ1440pxสูง1948px(+78); mainCTA DOMx502,y387.156,w208,h48: ลงมา28.156pxและเตี้ย2px. Decorative rings/section rhythmและwelcome art scaleต่าง. HeaderGooglelabel/40pxเป็นuser overrideจึงไม่นับเป็นdefect.
- Token / layout value: surface/paper #FFFCF7 verified; H1 runtime64/700/line78.08; ไม่อ้างfont tokensอื่นว่าMatchหากไม่ได้inspect
- Source: [frontend/src/components/Hero.tsx:12](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/Hero.tsx:12>), [frontend/src/components/ProcessFlow.tsx:17](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ProcessFlow.tsx:17>), [frontend/src/components/CtaBand.tsx:36](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/CtaBand.tsx:36>), [frontend/src/components/SiteFooter.tsx:8](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/SiteFooter.tsx:8>), [frontend/src/index.css:94](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/index.css:94>)
- Evidence: [evidence/figma/home-guest-desktop-175-3.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/home-guest-desktop-175-3.png>), [evidence/runtime/home-guest-1440x900-full.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/home-guest-1440x900-full.png>), [evidence/comparison/home-1440-side-by-side.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/comparison/home-1440-side-by-side.png>), [evidence/comparison/home-1440-diff.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/comparison/home-1440-diff.png>), [evidence/comparison/home-1440.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/comparison/home-1440.json>)

ตรวจซ้ำ:

1. เปิดguest1440×900/100%zoom
2. รอfontsและimages
3. เทียบfullpageกับfresh175:3แบบไม่resize

แนะนำ: ปรับhero vertical rhythm/CTAheightและsectionspacingตามframe จากนั้นexportเทียบใหม่โดยmaskส่วนuseroverrideและstatusbadgeที่เพิ่มโดยตั้งใจ

Dependencies: ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ · Complexity: S

<a id="ui-002"></a>

## UI-002 · P2 · Classroom header / filters / cards

- Type: Figma Mismatch · Page: Classroom list · Route: `/classrooms`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [J04b · ห้องเรียนของฉัน · หลายบทบาท + ค้นหา / กรอง · 349:2388](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=349-2388), [M01 · ห้องเรียนของฉัน · 516:825](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-825)
- Expected: desktopใช้หัวข้อสีขาวบนgradient,searchแบบpill,semesterfilterและcardที่สื่อcourse/instructor/group/work status; mobileStudentแสดงsearchและcardsพร้อมปุ่มเต็มความกว้างเป็นหลัก
- Actual / exact difference: หัวข้อสีink,searchrounded-xlและsortdropdownแทนsemester. Cardsแสดงname/slug/timezoneโดยไม่แสดงcontextงาน. ที่390นักศึกษายังเห็นarchive/create/rolefilterทั้งชุดและไม่มีภาพหัวข้อ; cardactionไม่เต็มแถว.
- Token / layout value: paper #FFFCF7; search pill/radius; hero foregroundwhiteเทียบruntimeink
- Source: [frontend/src/pages/ClassroomsPage.tsx:120](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ClassroomsPage.tsx:120>), [frontend/src/pages/ClassroomsPage.tsx:163](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ClassroomsPage.tsx:163>), [frontend/src/pages/ClassroomsPage.tsx:214](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ClassroomsPage.tsx:214>), [frontend/src/lib/api.ts:160](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/lib/api.ts:160>)
- Evidence: [evidence/figma/owner-classrooms-desktop-349-2388.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/owner-classrooms-desktop-349-2388.png>), [evidence/runtime/classrooms-owner-1440x900-full.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/classrooms-owner-1440x900-full.png>), [evidence/figma/student-classrooms-mobile-516-825.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/student-classrooms-mobile-516-825.png>), [evidence/visual/student-classrooms-390.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/student-classrooms-390.png>)

ตรวจซ้ำ:

1. เปิดclassroomsOwner1440และStudent390
2. เทียบheader,controlorderและcardsemantics; ไม่นับจำนวนห้อง/ชื่อfixtureที่ต่าง

แนะนำ: แยกrole-specific composition,ปรับsearch/card/button layout; เพิ่มmetadataผ่านAPIที่มีข้อมูลจริงก่อนแสดงterm/course/instructor/worksummary

Dependencies: Backend list/viewmodel สำหรับsemester/course/worksummary; ตกลงนักศึกษามีสิทธิ์สร้างห้องในproductหรือเพียงไม่แสดงปุ่มตามFigma · Complexity: M

<a id="ui-003"></a>

## UI-003 · P2 · Classroom dashboard / section navigation

- Type: Figma Mismatch · Page: Instructor classroom · Route: `/classrooms/:classroomId`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [J12 · ภาพรวมห้อง · มีสมาชิกแล้ว ยังไม่มีงาน · 330:1914](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=330-1914), [J09 · รายชื่อ · 12 คน 3 กลุ่ม · 330:1057](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=330-1057)
- Expected: Owneroverviewมีroomnameเป็นheading,3primaryactions,setupcallout,4statsและassignmentoverview; membersเป็นfocusedworkspaceพร้อมrolefilters/rowmenu
- Actual / exact difference: แม้hasmembers/noassignmentตรงstateแล้ว เว็บยังเป็นlongpage3608pxเทียบJ12 896px: genericheading,hashpills,3stats,roster+memberform+assignmentformพร้อมกัน. ตัวเลข14/4เทียบ12/3มาจากfixtureไม่ใช่bug.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/pages/ClassroomDetailPage.tsx:294](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ClassroomDetailPage.tsx:294>), [frontend/src/pages/ClassroomDetailPage.tsx:307](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ClassroomDetailPage.tsx:307>), [frontend/src/pages/ClassroomDetailPage.tsx:385](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ClassroomDetailPage.tsx:385>), [frontend/src/pages/ClassroomDetailPage.tsx:425](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ClassroomDetailPage.tsx:425>), [frontend/src/components/RosterTable.tsx:156](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/RosterTable.tsx:156>)
- Evidence: [evidence/figma/owner-classroom-desktop-330-1914.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/owner-classroom-desktop-330-1914.png>), [evidence/figma/owner-members-desktop-330-1057.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/owner-members-desktop-330-1057.png>), [evidence/visual/owner-members-no-assignment-1440.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/owner-members-no-assignment-1440.png>), [evidence/comparison/owner-overview-desktop-side-by-side.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/comparison/owner-overview-desktop-side-by-side.png>)

ตรวจซ้ำ:

1. Ownerนำเข้าrosterแต่ยังไม่มีassignment
2. เปิดoverview1440px
3. เทียบองค์ประกอบ/primaryactions ไม่เทียบdynamiccounts

แนะนำ: แยกoverview,members,assignmentauthoring,reportเป็นworkspace statesตามFigma; ใช้routeหรือstateก็ได้ แต่ต้องรักษาback/deeplink/rolepermissions

Dependencies: ต้องกำหนดURL/state mapตาม191framesก่อนrefactor; แก้FLOW-001/002ควบคู่ · Complexity: L

<a id="ui-004"></a>

## UI-004 · P2 · StudentDashboard / assignments

- Type: Figma Mismatch · Page: Student classroom · Route: `/classrooms/:classroomId`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [ST13 · หน้าห้องเรียน · งานที่ต้องประเมิน · 268:6135](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=268-6135), [M03 · หน้าห้องเรียน · งานที่ต้องประเมิน · 516:923](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-923)
- Expected: M03มีroomcontext+group/instructor,งานfilterทั้งหมด/ยังไม่ได้ประเมิน/ออกคะแนนแล้ว,assignmentcardsพร้อมdeadline/progress,statusและปุ่มเต็มแถว
- Actual / exact difference: ที่390แสดงgenericwelcome/privacycardขนาดใหญ่และrosterเป็นส่วนหลัก,assignmentเป็นแถวเล็กและไม่มีfilters/assignmenthistory/deadlineต่อcard. หน้าเว็บ2257pxเทียบM03 1238px; dataจำนวนงานต่างจึงไม่ใช้heightเป็นcompliance metric.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/pages/ClassroomDetailPage.tsx:95](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ClassroomDetailPage.tsx:95>), [frontend/src/pages/ClassroomDetailPage.tsx:466](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ClassroomDetailPage.tsx:466>), [frontend/src/components/AssignmentsToEvaluateCard.tsx:22](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AssignmentsToEvaluateCard.tsx:22>)
- Evidence: [evidence/figma/student-classroom-mobile-516-923.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/student-classroom-mobile-516-923.png>), [evidence/visual/student-classroom-390.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/student-classroom-390.png>), [evidence/comparison/student-classroom-mobile-side-by-side.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/comparison/student-classroom-mobile-side-by-side.png>)

ตรวจซ้ำ:

1. Studentเปิดห้องที่มีpublishedworkที่390px
2. ตรวจcontentorder/filter/cardstatus
3. เทียบM03

แนะนำ: ให้studentassignmentdashboardเป็นmaincontentและแยกroster/groupinfoไปstateรอง; ใช้assignmentstatus/deadline/ownprogressจริง

Dependencies: เสริมsummaryAPIสำหรับownprogress/historyและroomgroupcontextหากcontractปัจจุบันไม่มี · Complexity: M

<a id="ui-005"></a>

## UI-005 · P2 · Pair presentation / criterion cards / navigation

- Type: Figma Mismatch · Page: Evaluation desktop · Route: `/classrooms/:classroomId/assignments/:assignmentId/evaluate`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [ST20 · ประเมินระดับกลุ่ม · กำลังตอบ · 57:3](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=57-3)
- Expected: ST20สื่อpairเดียวพร้อมA/Bartifactcards,criterionquestion+weight,บันทึกต่อเกณฑ์ และprevious/nextpair workflow
- Actual / exact difference: เว็บแสดงทุกcomparisonแยกภายในcriterion,ไม่มีglobalA/Bartifactcards/criterionweight/questionหรือprevious/nextpair; footerเป็นส่งคำตอบทันที. สร้างfixture3GROUPcriteria+2INDIVIDUALเพื่อตรวจแล้วจึงไม่อธิบายช่องว่างนี้ด้วยจำนวนcriteriaต่างกัน.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/pages/EvaluatePage.tsx:37](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/EvaluatePage.tsx:37>), [frontend/src/pages/EvaluatePage.tsx:240](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/EvaluatePage.tsx:240>), [frontend/src/pages/EvaluatePage.tsx:266](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/EvaluatePage.tsx:266>), [frontend/src/pages/EvaluatePage.tsx:304](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/EvaluatePage.tsx:304>), [frontend/src/lib/api.ts:294](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/lib/api.ts:294>), [backend/app/api/assignments.py:152](<C:/Users/SSX/Documents/GitHub/sdpx-arai/backend/app/api/assignments.py:152>)
- Evidence: [evidence/figma/student-evaluation-desktop-57-3.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/student-evaluation-desktop-57-3.png>), [evidence/visual/evaluation-three-criteria-1440.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/evaluation-three-criteria-1440.png>), [evidence/visual/conditions.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/conditions.json>)

ตรวจซ้ำ:

1. เปิดevaluateที่มีGROUP3criteria
2. เทียบST20ที่1440
3. ตรวจabsenceของartifactA/B,weight,questionและpairnavigation

แนะนำ: กำหนดpair-centric state/navigationและsave lifecycleก่อนจัดlayout; ขยายAPIด้วยcriteria metadata/artifact peritemจากข้อมูลจริง. อย่าปลอมURLสองฝั่งด้วยassignmentURLเดียว

Dependencies: แก้EVAL-001ก่อน; ปัจจุบันartifactUrlเป็นค่าเดียวทั้งassignment ไม่ใช่ต่อitem; ตรวจpair-generation semanticsก่อนบังคับpairเดียวข้ามcriteria · Complexity: L

<a id="ui-006"></a>

## UI-006 · P2 · Comparison scale

- Type: Responsive Bug · Page: Evaluation mobile · Route: `/classrooms/:classroomId/assignments/:assignmentId/evaluate`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [M04 · ประเมินระดับกลุ่ม · ตอบทีละเกณฑ์ · 516:996](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-996)
- Expected: M04ที่390pxใช้6ตัวเลือกเรียงแนวตั้งเต็มแถว พร้อมชื่อฝั่งในแต่ละคำตอบ/selectedcheck และfixedactions
- Actual / exact difference: เว็บ390pxยังเป็นgrid3คอลัมน์×2แถว(min-h128แต่ละตัว), labelยาวแตกบรรทัด; ใช้genericซ้าย/ขวาแทนชื่อในlabel. ไม่พบdocumenthorizontaloverflowแต่compositionต่างชัดเจน.
- Token / layout value: mobilelayout=1column expected/current3columns; currentscale sizes24/36/48px
- Source: [frontend/src/components/ComparisonRow.tsx:69](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonRow.tsx:69>), [frontend/src/components/ComparisonRow.tsx:82](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonRow.tsx:82>), [frontend/src/components/ComparisonRow.tsx:127](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonRow.tsx:127>)
- Evidence: [evidence/figma/student-evaluation-mobile-516-996.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/student-evaluation-mobile-516-996.png>), [evidence/visual/evaluation-three-criteria-390.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/evaluation-three-criteria-390.png>), [evidence/comparison/evaluation-mobile-side-by-side.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/comparison/evaluation-mobile-side-by-side.png>), [evidence/runtime/evaluation-group-default-375x812-viewport.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/evaluation-group-default-375x812-viewport.png>)

ตรวจซ้ำ:

1. เปิดevaluate390×844และ375×812
2. เทียบ6optionslayoutกับM04
3. แยกstickyfooterในfullPagescreenshotออกจากoverlapbug

แนะนำ: ใช้singlecolumnmobileoptionsและaria-labelที่มีชื่อpair+ระดับ; selectedtext/checkชัดเจน,desktopคง6columns

Dependencies: ควบคู่A11Y-005และUI-005 · Complexity: M

<a id="ui-007"></a>

## UI-007 · P2 · ScoreStep / score context / participation

- Type: Missing Component · Page: Own score · Route: `/classrooms/:classroomId/assignments/:assignmentId/score`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [ST30 · คะแนนของฉัน · ประกาศแล้ว · 60:437](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=60-437), [M07 · คะแนนของฉัน · ประกาศแล้ว · 516:1322](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-1322)
- Expected: ST30/M07แสดงassignment+group,คะแนนรวม/เต็มและวันประกาศ,criteria rows+weights+score/max,จำนวนคู่ส่งแล้ว/ทั้งหมดและp/M
- Actual / exact difference: แม้fixtureมี3+2criteriaและ15+5เต็มจริง หน้าเว็บยังแสดงเฉพาะgroup/individualaggregatesและraw4decimals,ไม่มีmax/date/criterionrows/ส่งแล้วNต่อทั้งหมด. Privacyhiddenทำงานถูกต้องและห้ามแก้ให้เปิดคะแนนที่ถูกซ่อน.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/pages/ScorePage.tsx:17](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ScorePage.tsx:17>), [frontend/src/pages/ScorePage.tsx:114](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ScorePage.tsx:114>), [frontend/src/pages/ScorePage.tsx:153](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ScorePage.tsx:153>), [frontend/src/pages/ScorePage.tsx:197](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ScorePage.tsx:197>), [frontend/src/lib/api.ts:559](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/lib/api.ts:559>), [backend/app/api/scoring.py:418](<C:/Users/SSX/Documents/GitHub/sdpx-arai/backend/app/api/scoring.py:418>)
- Evidence: [evidence/figma/student-score-desktop-60-437.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/student-score-desktop-60-437.png>), [evidence/figma/student-score-mobile-516-1322.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/student-score-mobile-516-1322.png>), [evidence/visual/score-three-two-criteria-1440.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/score-three-two-criteria-1440.png>), [evidence/visual/score-three-two-criteria-390.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/score-three-two-criteria-390.png>), [evidence/comparison/score-desktop-side-by-side.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/comparison/score-desktop-side-by-side.png>)

ตรวจซ้ำ:

1. Finalizeงานจริงที่มี3+2criteriaและscoremax15+5
2. เปิดmy-score1440/390
3. เทียบmetadata/detailpresence ไม่เทียบค่าคะแนนfixture

แนะนำ: ขยายMyScoreOut/OpenAPIให้คืนownscorebreakdown/max/finalizedAt/submissioncountsที่ผ่านprivacyfilter แล้วrenderrows/formatตามแบบ

Dependencies: Backendcontract+privacy regression testsจำเป็น; finalScore/individualHiddenเดิมต้องคงถูกต้อง · Complexity: L

<a id="ui-008"></a>

## UI-008 · P3 · Score hero illustration

- Type: Figma Mismatch · Page: Own score · Route: `/classrooms/:classroomId/assignments/:assignmentId/score`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [ST30 · คะแนนของฉัน · ประกาศแล้ว · 60:437](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=60-437)
- Expected: ST30ใช้ภาพรายงานคะแนนที่มีshield/checkตามfreshframe
- Actual / exact difference: เว็บใช้reports.pngภาพหน้าต่างกราฟ/แว่นขยาย ซึ่งเป็นคนละภาพในlibrary แม้โหลดไฟล์สำเร็จ.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/pages/ScorePage.tsx:4](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ScorePage.tsx:4>), [frontend/src/pages/ScorePage.tsx:97](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ScorePage.tsx:97>), [frontend/src/assets/figma/README.md:15](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/assets/figma/README.md:15>)
- Evidence: [evidence/figma/student-score-desktop-60-437.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/student-score-desktop-60-437.png>), [evidence/visual/score-three-two-criteria-1440.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/score-three-two-criteria-1440.png>)

ตรวจซ้ำ:

1. เปิดscore1440
2. เทียบheroartกับST30

แนะนำ: หาและexportassetของST30จากFigmaโดยตรงพร้อมnodeprovenance; อย่าใช้ภาพreportsทั่วไปแทน

Dependencies: ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ · Complexity: S

<a id="ui-009"></a>

## UI-009 · P3 · AppNav

- Type: Figma Mismatch · Page: Authenticated shell · Route: `ทุกprotected route`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [AppNav · 86:770](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-770), [M01 · ห้องเรียนของฉัน · 516:825](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-825), [M03 · หน้าห้องเรียน · งานที่ต้องประเมิน · 516:923](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-923), [ST30 · คะแนนของฉัน · ประกาศแล้ว · 60:437](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=60-437)
- Expected: Freshscreensแสดงlogo+PairEvalwordmarkบนมือถือและuser/avatar/bell/logoutตามroleheader
- Actual / exact difference: AppNavซ่อนwordmark≤420px เพิ่มroomlink/breadcrumbและรวมlogoutไว้ในaccountmenu; จึงจัดheaderต่างจากFigmaทุกprotectedpage. การไม่มีnotificationcapabilityแยกGAP-001 ไม่คิดซ้ำ.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/components/AppNav.tsx:83](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AppNav.tsx:83>), [frontend/src/components/AppNav.tsx:90](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AppNav.tsx:90>), [frontend/src/components/AppNav.tsx:95](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AppNav.tsx:95>), [frontend/src/components/AppNav.tsx:139](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AppNav.tsx:139>)
- Evidence: [evidence/figma/student-classrooms-mobile-516-825.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/student-classrooms-mobile-516-825.png>), [evidence/visual/student-classrooms-390.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/student-classrooms-390.png>), [evidence/runtime/classrooms-owner-1440x900-viewport.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/classrooms-owner-1440x900-viewport.png>)

ตรวจซ้ำ:

1. เปิดprotectedpage1440และ390
2. เทียบheadercompositionและwordmark

แนะนำ: สร้างresponsiveAppNavvariantsตามrole/screen และกำหนดว่าส่วนaccountmenuใดเป็นintentionaldeviation; คงaccessiblelabelsและrealpermissions

Dependencies: ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ · Complexity: M

## Missing capabilities / screen states

รายการต่อไปนี้เป็นimplementationgapที่ยืนยันจากframeinventoryและabsenceในsource ไม่ใช่การอ้างว่าทุกunexportedframeผ่านvisualinspection รายละเอียดภายในและprototypeflowที่ยังไม่ได้เดินจริงระบุNotVerifiedไว้ ต้องอ่านframeเต็มเมื่อแตกimplementationtask

<a id="gap-001"></a>

## GAP-001 · P2 · Notification center / badge

- Type: Missing Page / Component · Page: Notifications · Route: `ไม่มีimplementation/entrypoint`
- Result: FAIL · Evidence level: Implementation absence confirmed from source and Figma frame inventory; exact unexported frame layout Not Verified
- Figma frame/node: [ST12 · การแจ้งเตือน · ลิงก์ตรง ไม่มีคะแนนในข้อความ · 502:6515](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=502-6515), [M02 · การแจ้งเตือน (หน้าเต็มบนมือถือ) · 516:870](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-870)
- Expected: FigmaST12/M02มีnotificationและdeeplinkโดยไม่ใส่คะแนนในข้อความ
- Actual / exact difference: ไม่มีnotificationroute/component/APIหรือreadstate; authenticatedheaderไม่มีbell. layoutภายในframeยังNotVerified.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/App.tsx:10](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/App.tsx:10>), [frontend/src/components/AppNav.tsx:33](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AppNav.tsx:33>), [backend/app/main.py:16](<C:/Users/SSX/Documents/GitHub/sdpx-arai/backend/app/main.py:16>)
- Evidence: [figma-inventory.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/figma-inventory.json>), [FIGMA_SCREEN_INVENTORY.md](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/FIGMA_SCREEN_INVENTORY.md>), [evidence/figma/student-classrooms-mobile-516-825.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/student-classrooms-mobile-516-825.png>)

ตรวจซ้ำ:

1. เปิดframeตามnodeIDและดูชื่อflowที่ระบุ
2. ตรวจroute/API/componentinventoryและentrypointในเว็บ
3. ไม่พบcapabilityดังกล่าว; ขั้นตอนภายในที่ยังไม่มีimplementationเป็นBLOCKED

แนะนำ: กำหนดnotificationevents/recipient/privacy/deeplink/readstateและAPIก่อนเพิ่มdesktopmenu/mobilepage

Dependencies: Backendevent/storage/API+permissions; ห้ามส่งคะแนนในnotificationpayloadตามชื่อframe · Complexity: L

<a id="gap-002"></a>

## GAP-002 · P2 · Appeal entry / form / receipt / teacher response

- Type: Missing Page / Component · Page: Score appeals · Route: `ไม่มีimplementation/entrypoint`
- Result: FAIL · Evidence level: Missing implementation confirmed; score-entry and success references visually inspected. Form layout details Not Verified
- Figma frame/node: [ST33 · ยื่นอุทธรณ์คะแนน · 318:10237](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=318-10237), [ST34 · ยื่นอุทธรณ์สำเร็จ · 318:10377](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=318-10377), [M08 · ยื่นอุทธรณ์คะแนน · 516:1393](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-1393), [M09 · ยื่นอุทธรณ์สำเร็จ · 516:1440](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-1440), [J35 · คำร้องอุทธรณ์ · ตอบ นก · 334:4844](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-4844), [P01 · คำร้องอุทธรณ์ · ผู้สอนร่วมดูและตอบได้ · 483:7516](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=483-7516)
- Expected: ST30/M07มีปุ่มยื่นอุทธรณ์และST33/34,M08/09มีform/success;ผู้สอนมีqueue/response
- Actual / exact difference: ไม่มีappealentrypointในscore,ไม่มีform/receipt/teacherqueue/API. FreshM09ยืนยันsuccessscreenที่ยังไม่มีในเว็บ.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/pages/ScorePage.tsx:114](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ScorePage.tsx:114>), [frontend/src/App.tsx:10](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/App.tsx:10>), [backend/app/api/scoring.py:418](<C:/Users/SSX/Documents/GitHub/sdpx-arai/backend/app/api/scoring.py:418>)
- Evidence: [evidence/figma/student-score-mobile-516-1322.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/student-score-mobile-516-1322.png>), [evidence/figma/student-appeal-success-mobile-516-1440.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/student-appeal-success-mobile-516-1440.png>), [evidence/visual/score-three-two-criteria-390.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/score-three-two-criteria-390.png>)

ตรวจซ้ำ:

1. เปิดframeตามnodeIDและดูชื่อflowที่ระบุ
2. ตรวจroute/API/componentinventoryและentrypointในเว็บ
3. ไม่พบcapabilityดังกล่าว; ขั้นตอนภายในที่ยังไม่มีimplementationเป็นBLOCKED

แนะนำ: เพิ่มappealmodel/state/submit/respondAPI+audit+rolepermissions แล้วเชื่อมscore→form→receipt→notification

Dependencies: Backend/schema/OpenAPI; scoreidentity/privacy; notificationGAP-001 · Complexity: L

<a id="gap-003"></a>

## GAP-003 · P2 · Archive / delete / restore controls

- Type: Missing Page / Component · Page: Room lifecycle · Route: `/classrooms`
- Result: FAIL · Evidence level: Implementation absence confirmed from source and Figma frame inventory; exact unexported frame layout Not Verified
- Figma frame/node: [J04d · Archive ห้องเรียน · 432:2495](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=432-2495), [J04e · ลบห้องเรียน · ห้องยังว่าง · 432:2575](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=432-2575), [J04f · ลบห้องเรียนไม่ได้ · มีข้อมูลแล้ว · 432:2651](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=432-2651), [J04c · ห้องเรียนของฉัน · แท็บ Archive · 349:2530](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=349-2530)
- Expected: FrameinventoryมีArchive,ลบห้องว่างและข้อห้ามเมื่อมีข้อมูล
- Actual / exact difference: มีarchivedfilterแต่ไม่มีarchive/delete/restoremutationหรือownercardmenu; ไม่ได้แปลว่าfilterเป็นdeadcontrol หากมีarchiveddataจากภายนอก.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/pages/ClassroomsPage.tsx:163](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ClassroomsPage.tsx:163>), [frontend/src/lib/api.ts:178](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/lib/api.ts:178>), [backend/app/api/classrooms.py:55](<C:/Users/SSX/Documents/GitHub/sdpx-arai/backend/app/api/classrooms.py:55>)
- Evidence: [figma-inventory.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/figma-inventory.json>), [evidence/figma/owner-classrooms-desktop-349-2388.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/owner-classrooms-desktop-349-2388.png>), [evidence/runtime/classrooms-owner-1440x900-full.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/classrooms-owner-1440x900-full.png>)

ตรวจซ้ำ:

1. เปิดframeตามnodeIDและดูชื่อflowที่ระบุ
2. ตรวจroute/API/componentinventoryและentrypointในเว็บ
3. ไม่พบcapabilityดังกล่าว; ขั้นตอนภายในที่ยังไม่มีimplementationเป็นBLOCKED

แนะนำ: ตกลงarchive/restore/deletepolicyและowner-onlyAPIพร้อมdataexistenceguards ก่อนเพิ่มcardmenu/confirmstates

Dependencies: Backendlifecycle/schema/audit/permission; ห้ามนำtestdeleteไปใช้ข้อมูลจริง · Complexity: L

<a id="gap-004"></a>

## GAP-004 · P2 · Import preview / change role / withdraw

- Type: Missing Page / Component · Page: Roster advanced management · Route: `/classrooms/:classroomId#members`
- Result: FAIL · Evidence level: Implementation absence confirmed from source and Figma frame inventory; exact unexported frame layout Not Verified
- Figma frame/node: [J09b · นำเข้า CSV ซ้ำ · ดูการเปลี่ยนแปลงก่อนยืนยัน · 405:2748](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=405-2748), [J09d · แก้ไขบทบาท · นักศึกษา · 432:2901](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=432-2901), [J09e · ทำเครื่องหมายถอนรายวิชา · 468:2963](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=468-2963), [R04 · นำเข้าซ้ำ · ตรวจการเปลี่ยนแปลง · 441:3909](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-3909), [T08 · นักศึกษาถอนรายวิชา · ทำเครื่องหมายแทนการถอด · 344:1266](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=344-1266)
- Expected: Figmaมีpreviewchangesก่อนนำเข้าซ้ำ,เปลี่ยนroleและwithdrawcourseแทนลบเมื่องานมีข้อมูล
- Actual / exact difference: ปัจจุบันimportทันทีผ่านatomicvalidation; rolepanelเพิ่ม/ถอดได้แต่ไม่มีroleedit/withdrawworkflow. การimport/search/pagination/ถอดก่อนpublishที่มีอยู่ทดสอบผ่าน.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/components/RosterImportCard.tsx:11](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/RosterImportCard.tsx:11>), [frontend/src/components/RosterTable.tsx:173](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/RosterTable.tsx:173>), [frontend/src/components/MemberPanel.tsx:15](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/MemberPanel.tsx:15>), [backend/app/api/roster.py:86](<C:/Users/SSX/Documents/GitHub/sdpx-arai/backend/app/api/roster.py:86>), [backend/app/api/members.py:40](<C:/Users/SSX/Documents/GitHub/sdpx-arai/backend/app/api/members.py:40>)
- Evidence: [figma-inventory.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/figma-inventory.json>), [evidence/figma/owner-members-desktop-330-1057.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/figma/owner-members-desktop-330-1057.png>), [evidence/failure/roster-removed-confirmed.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/roster-removed-confirmed.png>)

ตรวจซ้ำ:

1. เปิดframeตามnodeIDและดูชื่อflowที่ระบุ
2. ตรวจroute/API/componentinventoryและentrypointในเว็บ
3. ไม่พบcapabilityดังกล่าว; ขั้นตอนภายในที่ยังไม่มีimplementationเป็นBLOCKED

แนะนำ: เพิ่มpreview→confirmprotocol,rolemutationและwithdrawdomainrulesพร้อมpairreassignment/lockedstates; reconcileFigmaกับpermissionsปัจจุบันก่อนเปลี่ยนสิทธิ์

Dependencies: Backendtransaction/state/schema+pairingregressions; อย่าลดsecurityตามvisualframeโดยไม่ทบทวนPRD · Complexity: L

<a id="gap-005"></a>

## GAP-005 · P2 · Editable multiple criteria / artifact metadata

- Type: Missing Page / Component · Page: Assignment authoring · Route: `/classrooms/:classroomId#assignments`
- Result: FAIL · Evidence level: Implementation absence confirmed from source and Figma frame inventory; exact unexported frame layout Not Verified
- Figma frame/node: [J13a · สร้างงาน · ใส่น้ำหนัก 95% (เผยแพร่ไม่ได้) · 332:1712](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=332-1712), [J13b · สร้างงาน · แก้น้ำหนักครบ 100% · 332:2128](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=332-2128), [A01 · สร้างงาน · น้ำหนักไม่ครบ · 441:4225](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-4225), [A02 · สร้างงาน · น้ำหนักครบ · 441:4645](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-4645)
- Expected: Figmaauthoringมีหลายเกณฑ์/weight validationและข้อมูลผลงานที่นำไปแสดงในevaluation
- Actual / exact difference: UItoCreateInputhardcodeGROUPคุณภาพงาน1เกณฑ์และINDการมีส่วนร่วม1เกณฑ์. Backendรองรับcriteriaarray/PUTcriteriaอยู่แล้ว แต่UIไม่มีadd/edit/removecriteriaหรือartifactURLinput.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/lib/assignment.ts:91](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/lib/assignment.ts:91>), [frontend/src/lib/assignment.ts:103](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/lib/assignment.ts:103>), [frontend/src/components/AssignmentPanel.tsx:147](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AssignmentPanel.tsx:147>), [frontend/src/lib/api.ts:263](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/lib/api.ts:263>), [backend/app/api/assignments.py:251](<C:/Users/SSX/Documents/GitHub/sdpx-arai/backend/app/api/assignments.py:251>)
- Evidence: [figma-inventory.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/figma-inventory.json>), [evidence/visual/owner-members-no-assignment-1440.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/owner-members-no-assignment-1440.png>), [evidence/failure/assignment-published-before-reload.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/assignment-published-before-reload.png>)

ตรวจซ้ำ:

1. เปิดframeตามnodeIDและดูชื่อflowที่ระบุ
2. ตรวจroute/API/componentinventoryและentrypointในเว็บ
3. ไม่พบcapabilityดังกล่าว; ขั้นตอนภายในที่ยังไม่มีimplementationเป็นBLOCKED

แนะนำ: เพิ่มeditablecriterialist/description/weight/errorstatesและใช้backendcontractที่มี; validate100%ต่อsideและdraft-onlyupdates; ต้องอ่านfullauthoringframesก่อนเก็บรายละเอียดlayout

Dependencies: Frontendสามารถใช้criteriaAPIเดิม; artifactperitemยังต้องdomain/APIเพิ่มตามUI-005 · Complexity: L

<a id="gap-006"></a>

## GAP-006 · P2 · Schedule / unpublish / extend / copy

- Type: Missing Page / Component · Page: Assignment lifecycle · Route: `/classrooms/:classroomId#assignments`
- Result: FAIL · Evidence level: Implementation absence confirmed from source and Figma frame inventory; exact unexported frame layout Not Verified
- Figma frame/node: [J13c · ตั้งเวลาเปิดรับ · 15 ต.ค. 09:00 · 491:6320](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=491-6320), [J15b · ยืนยันเผยแพร่แบบตั้งเวลา · 493:3243](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=493-3243), [J16b · เผยแพร่แล้ว · รอเปิดรับตามเวลา · 493:3408](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=493-3408), [J23b · ยกเลิกเผยแพร่ · เตือนว่าคำตอบเดิมจะใช้ไม่ได้ · 399:2041](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=399-2041), [J23c · ขยายกำหนดส่ง · 399:2144](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=399-2144), [J31d · สร้างงานใหม่ · คัดลอกจากงานเดิม · 405:2621](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=405-2621)
- Expected: Frameinventoryมีตั้งเวลาเปิดรับ,รอเปิด,ยกเลิกเผยแพร่,ขยายdeadlineและcopyassignment
- Actual / exact difference: API/UIรองรับcreate→publish→recompute/finalize/reopen แต่ไม่มีscheduledopening/unpublish/deadlineupdate/duplicateworkflow. Publishไม่ใช่deadbutton; basicflowผ่าน.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/components/AssignmentPanel.tsx:99](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AssignmentPanel.tsx:99>), [frontend/src/lib/api.ts:263](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/lib/api.ts:263>), [backend/app/api/assignments.py:208](<C:/Users/SSX/Documents/GitHub/sdpx-arai/backend/app/api/assignments.py:208>), [backend/app/api/assignments.py:322](<C:/Users/SSX/Documents/GitHub/sdpx-arai/backend/app/api/assignments.py:322>)
- Evidence: [figma-inventory.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/figma-inventory.json>), [discovery.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/discovery.json>), [evidence/failure/assignment-published-after-reload.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/assignment-published-after-reload.png>)

ตรวจซ้ำ:

1. เปิดframeตามnodeIDและดูชื่อflowที่ระบุ
2. ตรวจroute/API/componentinventoryและentrypointในเว็บ
3. ไม่พบcapabilityดังกล่าว; ขั้นตอนภายในที่ยังไม่มีimplementationเป็นBLOCKED

แนะนำ: กำหนดstatemachineและผลกระทบต่อanswers/deadlinesให้ชัด แล้วเพิ่มcommands/permissions/auditและUIconfirmstates

Dependencies: Backenddomain/schema/clock/schedulerอาจจำเป็น; พิจารณาarchitectureก่อนเพิ่มpackage/service · Complexity: L

<a id="gap-007"></a>

## GAP-007 · P2 · Coverage / quality / response exclusion / identity audit

- Type: Missing Page / Component · Page: Instructor reporting and interventions · Route: `/classrooms/:classroomId#scores`
- Result: FAIL · Evidence level: Implementation absence confirmed from source and Figma frame inventory; exact unexported frame layout Not Verified
- Figma frame/node: [J26 · Coverage รายคู่ · Borealis เทียบ Cygnus ได้ 2 / 4 · 334:2042](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-2042), [J28 · รายงานคุณภาพ · ครบทุกสัญญาณ (QS-01–07) · 334:2250](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-2250), [J29 · ดูคำตอบของ E7 (ยังไม่เปิดตัวตน) · 382:1863](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=382-1863), [J30 · กดดูตัวตน → E7 = ต้น (บันทึก audit) · 382:2049](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=382-2049), [J38 · บันทึกการตรวจสอบ · ทุกอย่างที่ทำมาในเรื่องนี้ · 334:5219](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=334-5219), [Q01 · รายงานคุณภาพ QS-01–07 · 441:6566](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-6566), [Q03 · ยกเว้นคำตอบ · บังคับเหตุผล · 441:6941](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=441-6941)
- Expected: Figmaแยกรายงานคะแนน/coverage/qualityQS01–07,ตรวจresponseรหัสแฝง,excludeพร้อมเหตุผลและauditviewer
- Actual / exact difference: มีbasiccomputedscoretable,override,reopenและCSVexport; ไม่มีรายงาน/interactionที่กล่าวมาในเว็บ. Classroom auditAPIมีอยู่แล้วแต่ยังไม่มีviewer. IdentifiedCSVAPIไม่เท่ากับรายงานเปิดตัวตนรายresponse.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/components/AssignmentScoringCard.tsx:323](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AssignmentScoringCard.tsx:323>), [frontend/src/components/InstructorReport.tsx:1](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/InstructorReport.tsx:1>), [backend/app/api/scoring.py:389](<C:/Users/SSX/Documents/GitHub/sdpx-arai/backend/app/api/scoring.py:389>), [backend/app/api/members.py:130](<C:/Users/SSX/Documents/GitHub/sdpx-arai/backend/app/api/members.py:130>)
- Evidence: [figma-inventory.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/figma-inventory.json>), [discovery.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/discovery.json>), [evidence/runtime/classroom-owner-1440x900-full.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/classroom-owner-1440x900-full.png>)

ตรวจซ้ำ:

1. เปิดframeตามnodeIDและดูชื่อflowที่ระบุ
2. ตรวจroute/API/componentinventoryและentrypointในเว็บ
3. ไม่พบcapabilityดังกล่าว; ขั้นตอนภายในที่ยังไม่มีimplementationเป็นBLOCKED

แนะนำ: แยกรายงานตามcapabilityและใช้ข้อมูลquality/coverageที่คำนวณจริง;เพิ่มintervention+exclusion+auditcontractsเมื่อdomainพร้อม; อย่าเอาunusedInstructorReportที่มีตัวอย่างข้อมูลมารับรองว่ามีflowแล้ว

Dependencies: Backendqualitymetrics/intervention/privacy/auditAPI; owner/co-teacher/TApermissionregressions · Complexity: L

<a id="gap-008"></a>

## GAP-008 · P2 · Durable pending answers / recovery

- Type: Missing Page / Component · Page: Offline evaluation · Route: `/classrooms/:classroomId/assignments/:assignmentId/evaluate`
- Result: FAIL · Evidence level: Runtime loss/recovery failure confirmed under injected network outage; Figma offline capability title verified, fullST24 visual layout Not Verified
- Figma frame/node: [ST24 · ออฟไลน์ · คำตอบเก็บไว้ในเครื่อง · 472:558](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=472-558)
- Expected: ST24ระบุออฟไลน์ · คำตอบเก็บไว้ในเครื่อง
- Actual / exact difference: ฉีดPUT internetdisconnected:มีerrorแต่ไม่persistqueue. คืนnetworkแล้วรอ2.5s APIchoiceยังnull; reloadแล้วselected=false. Basicretryโดยเลือกใหม่อาจทำได้ แต่durability/automaticrecoveryตามframeไม่มี.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/components/ComparisonRow.tsx:32](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonRow.tsx:32>), [frontend/src/components/ComparisonRow.tsx:52](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonRow.tsx:52>), [frontend/src/components/ComparisonRow.tsx:59](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonRow.tsx:59>)
- Evidence: [figma-inventory.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/figma-inventory.json>), [evidence/failure/checks.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/checks.json>), [evidence/failure/autosave-offline-error.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/autosave-offline-error.png>), [evidence/failure/autosave-offline-choice-lost-after-reload.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/autosave-offline-choice-lost-after-reload.png>)

ตรวจซ้ำ:

1. เปิดframeตามnodeIDและดูชื่อflowที่ระบุ
2. ตรวจroute/API/componentinventoryและentrypointในเว็บ
3. ไม่พบcapabilityดังกล่าว; ขั้นตอนภายในที่ยังไม่มีimplementationเป็นBLOCKED

แนะนำ: เพิ่มsession-scopedpendingqueue/durablelocalstorageพร้อมrecovery/retryและexpireddeadlinehandling; แยกหน้าตาoffline/errorและบอกสถานะไม่อ้างว่าบันทึกแล้วก่อนserverack

Dependencies: แก้EVAL-001savecoordinationก่อน; ต้องแยกuser/session,logoutcleanupและdeadline/privacytests · Complexity: M

## Website → Figma ที่ยังไม่มีreferenceชัด

Authretry/error Banners,sortlistboxบางstate,healthstatusbadgeและwildcardredirectไม่มีfreshdedicatedreferenceที่จับคู่ได้: NotVerified/NOTAPPLICABLEตามชนิด ไม่เรียกMissingFigmaโดยเดา. Co-teacher/TA runtimeตรวจครบแต่full-framepixel/layoutcomparisonยังNotVerified ต่างจากOwner/Studentที่มีfreshPNG
