// Evidence-backed audit findings. This file generates reports only; it never changes the app.
const E='/classrooms/:classroomId/assignments/:assignmentId/evaluate'
const S='/classrooms/:classroomId/assignments/:assignmentId/score'
const C='/classrooms/:classroomId'
const issues=[]
function add(id,severity,type,page,route,component,frames,expected,actual,sources,evidence,repro,fix,extra={}){
  issues.push({id,severity,type,page,route,component,frames,expected,actual,sources,evidence,repro,fix,
    status:'FAIL',verification:'Confirmed runtime/source or fresh visual comparison',token:'ไม่ใช่ token-only issue',
    dependencies:'ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ',complexity:'M',...extra})
}
add('EVAL-001','P1','Functional Bug','Evaluation',E,'EvaluatePage + ComparisonRow',['57:3','516:996'],
  'คำตอบล่าสุดต้องไม่หายเมื่อส่งหรือเปลี่ยนแท็บ; เมื่อบันทึกครบแล้วไม่เตือนว่ายังไม่ตอบ',
  'กดส่ง903msหลังเลือก: POST200 submittedCount=0 ทั้งที่ต่อมาAPIมีchoice5แต่completed=false. รอautosave3212msแล้วยังเตือนเหลือ1คู่ผิด. เปลี่ยนsideก่อน2sแล้วย้อนกลับ choice=falseและAPIchoice=null.',
  ['frontend/src/components/ComparisonRow.tsx:32','frontend/src/components/ComparisonRow.tsx:38','frontend/src/components/ComparisonRow.tsx:44','frontend/src/pages/EvaluatePage.tsx:105'],
  ['runtime-summary.json','evidence/runtime/evaluation-submit-during-debounce-1440x900-full.png','evidence/runtime/evaluation-submit-after-autosave-1440x900-full.png','evidence/failure/evaluation-pending-side-switch.png','evidence/failure/checks.json'],
  ['ใช้studentที่มีGROUP1คู่','เลือกขวาดีกว่าแล้วกดส่งก่อน2sและยอมรับconfirm','ตรวจsubmittedCount/completed; ทำซ้ำแบบรอข้อความบันทึกแล้ว','อีกครั้งเลือกแล้วสลับรายบุคคลและกลับGROUPก่อน2s'],
  'รวมchoice/pending/save promiseไว้ในstateที่parentทราบ; flushและawaitคำตอบล่าสุดก่อนsubmit/เปลี่ยนside พร้อมกันsubmitซ้ำ; incomplete countต้องใช้stateล่าสุด และมีregression testsของทั้ง3กรณี',
  {rootCause:'Local choice/debounceอยู่ในrow แต่parentใช้snapshotเริ่มต้น; cleanupล้างtimerตอนrowunmount',dependencies:'ออกแบบstate/save coordinationก่อนปรับpair navigation; เพิ่มtestsที่เลือกผ่านUIจริง',complexity:'M'})
add('EVAL-002','P2','Functional Bug','Evaluation',E,'Deadline state',['502:6592'],
  'เมื่อdeadlineผ่านบนหน้าที่เปิดค้าง inputsต้องread-onlyและปุ่มส่งหายโดยไม่reload',
  'หลังdeadline350ms radioยังenabledและปุ่มส่งยังแสดง; autosaveถูกBackendปฏิเสธ409. Reloadแล้วจึงdisabled/ซ่อนsubmitถูกต้อง.',
  ['frontend/src/pages/EvaluatePage.tsx:103','frontend/src/components/ComparisonRow.tsx:81'],
  ['evidence/failure/checks.json','evidence/failure/evaluation-deadline-passed-before-reload.png','evidence/failure/evaluation-deadline-passed-after-reload.png'],
  ['สร้างงานdeadlineอีก12s','เปิดevaluateก่อนหมดเวลาและรอข้ามdeadline','เลือกคำตอบ ตรวจPUT409 แล้วreloadเปรียบเทียบ'],
  'ตั้งclock/deadline timerจากเวลาที่อ้างอิงserver และอัปเดตreadOnly/submitทันที; อธิบาย409อย่างชัดเจน. รักษาการตรวจdeadlineฝั่งserverไว้',
  {rootCause:'คำนวณDateเฉพาะตอนparentrender ไม่มีtimer',complexity:'S'})
add('FLOW-001','P2','Functional Bug','Classroom management',C,'AssignmentPanel / assignment list / scoring',['332:2834'],
  'เผยแพร่ผ่านUIสำเร็จแล้วรายการงานและเครื่องมือคะแนนต้องอัปเดตทันที',
  'สร้าง/ตรวจfeasibility/publishผ่านUIจริงได้201/200 และแสดงPUBLISHED แต่evaluateLink=0,scoringCard=0; GETรายการคง2requests. Reloadแล้วทั้งคู่เป็น1และGETเป็น4.',
  ['frontend/src/components/AssignmentPanel.tsx:99','frontend/src/components/AssignmentsToEvaluateCard.tsx:22','frontend/src/components/AssignmentScoringCard.tsx:323','frontend/src/pages/ClassroomDetailPage.tsx:450'],
  ['evidence/failure/checks.json','evidence/failure/assignment-published-before-reload.png','evidence/failure/assignment-published-after-reload.png'],
  ['Ownerนำเข้าroster','กรอกงาน→กำหนดส่ง→สร้าง→ตรวจความเป็นไปได้→เผยแพร่','ตรวจรายการงานและscore toolsก่อน/หลังreload'],
  'ยกassignment list/refresh versionไปparentหรือใช้callbackหลังmutationเพื่อinvalidate sibling lists ทั้งcreate/publish/finalize/reopen',
  {rootCause:'siblingsfetchเฉพาะmount/classroomId; publishแก้เฉพาะstateภายในAssignmentPanel'})
add('FLOW-002','P3','Functional Bug','Classroom management',C,'SetupStepper',['330:1914','332:2834'],
  'ขั้นสร้างงานเสร็จแล้วเมื่อมีงานสร้างหรือเผยแพร่จริง',
  'หลังpublishจริงและreloadแล้วขั้นสร้างงานยังแสดง3/กำลังทำอยู่ ทุก6ขนาดจอ',
  ['frontend/src/pages/ClassroomDetailPage.tsx:269'],['evidence/failure/checks.json','evidence/failure/assignment-published-after-reload.png'],
  ['เผยแพร่งาน','Reloadห้องเรียน','อ่านsetup stepสร้างงานประเมิน'],
  'deriveสถานะจากassignmentที่โหลดจริง; กำหนดให้ชัดว่าdraftหรือpublishedนับเสร็จ',
  {rootCause:'stepState(false,hasStudents) hardcode done=false',complexity:'S'})
add('AUTH-001','P3','Navigation Bug','CSV export',C+'#scores','downloadCsv',['517:3857'],
  'Export401ต้องใช้matching-session invalidationแบบเดียวกับJSON API',
  'ฉีด401เฉพาะexport: แสดงerrorแต่tokenยังอยู่และprotected pageยังmount. เมื่อฉีดJSON/me401แล้วreloadจึงclearและกลับ/. Serverปฏิเสธexportอยู่เสมอ; ไม่ใช่authorization bypass.',
  ['frontend/src/lib/api.ts:63','frontend/src/lib/api.ts:508','frontend/src/lib/api.ts:518'],
  ['evidence/failure/checks.json','evidence/failure/export-401-session-still-mounted.png','evidence/failure/later-json-401-session-cleared.png'],
  ['เปิดคะแนนด้วยsessionที่ใช้ได้','interceptเฉพาะexportให้ตอบ401','กดส่งออกและดูstorage presence/route; ต่อด้วยme401'],
  'รวมcommon response/session handlingสำหรับJSONและdownload โดยclearเฉพาะtokenที่เป็นของrequestเดิมเพื่อรักษาrace protection',
  {rootCause:'downloadCsvใช้fetchตรงข้ามapiFetch401 handler',complexity:'S'})
add('A11Y-001','P2','Accessibility Issue','Guest home','/','SiteNav brand link',['175:3'],
  'ลิงก์กลับหน้าหลักต้องมีaccessible nameที่ทุกขนาดจอ',
  'ที่375pxซ่อนPairEvalด้วยCSS ขณะรูปaltว่าง/aria-hidden จึงมีlinkในtab orderที่ไม่มีชื่อ; axe link-name FAILทั้ง3home states. ที่430pxไม่พบปัญหานี้.',
  ['frontend/src/components/SiteNav.tsx:31','frontend/src/components/SiteNav.tsx:33','frontend/src/components/icons.tsx:8'],
  ['runtime-summary.json','evidence/runtime/home-guest-375x812-viewport.png'],
  ['เปิด/ที่375×812','ตรวจaccessible nameของlogo linkหรือรันaxe'],
  'เพิ่มaria-labelเช่นPairEvalหน้าหลักให้Link; ห้ามอาศัยข้อความที่ถูกdisplay:none',
  {wcag:'2.4.4 Link Purpose / 4.1.2 Name Role Value',complexity:'S'})
add('A11Y-002','P2','Accessibility Issue','Home / Evaluation','/ และ '+E,'ApiStatusBadge / evaluation tab counts',['175:3','57:3'],
  'ข้อความ12pxต้องcontrastอย่างน้อย4.5:1ตามWCAG1.4.3',
  'axeยืนยันready badge #238156บน#EAF7F0=4.38:1; countบนactive tab #BC693Cบน#FFF0E5=3.60:1 และinactive #9D8C84บนwhite=3.22:1. รวม62state/viewportsของruleเดียว ไม่ใช่62issues.',
  ['frontend/src/components/ApiStatusBadge.tsx:5','frontend/src/pages/EvaluatePage.tsx:183','frontend/src/index.css:26'],
  ['runtime-summary.json','evidence/runtime/home-guest-1440x900-full.png','evidence/runtime/evaluation-group-default-375x812-viewport.png'],
  ['เปิดhomeและevaluate','รันaxeพร้อมwcag2aa','ตรวจeffective foregroundหลังopacity75และพื้นหลังจริง'],
  'ใช้success text tokenที่contrastผ่านและเลิกopacityลดcount text; ตรวจทั้งactive/inactive/hoverโดยไม่ลดความอ่านง่ายเพื่อให้เหมือนภาพ',
  {token:'--color-ok-600/#238156, --color-ok-50/#EAF7F0, opacity-75 บนtab count',wcag:'1.4.3 Contrast Minimum',complexity:'S'})
// A11Y-003 retired: real Tab/ArrowRight passed all6 role/width cases.
// Chromium automatically focuses this scroll container despite tabIndex=-1.
// Keep raw axe alerts, but do not count them as confirmed product defects.
add('A11Y-004','P3','Accessibility Issue','Account / export menus',C,'AppNav / ExportControls',['86:770'],
  'ARIA menuเปิดแล้วEscapeปิดและคืนfocusให้trigger; มีkeyboard menu behaviorที่สอดคล้องกัน',
  'บัญชีทั้ง4roles×6viewportsยังเปิดหลังEscape. Export menuยังเปิด aria-expanded=true และfocusไม่กลับtriggerหลังEscape.',
  ['frontend/src/components/AppNav.tsx:57','frontend/src/components/AppNav.tsx:139','frontend/src/components/AssignmentScoringCard.tsx:264'],
  ['runtime-summary.json','evidence/failure/checks.json','evidence/failure/export-menu-after-escape.png'],
  ['เปิดaccountหรือexport menu','focusmenuitem','กดEscapeแล้วดูvisibility/activeElement'],
  'ทำshared menu keyboard/focus handling: focus itemเมื่อเปิด,Escapeคืนtrigger,Arrow navigation และoutside click',
  {wcag:'ARIA APG Menu Button pattern; ไม่สรุปWCAG2.1.1ล้มเหลวเพียงเพราะEscapeไม่มี หากยังใช้Tabได้',complexity:'S'})
add('A11Y-005','P3','Accessibility Issue','Evaluation',E,'ComparisonRow radiogroup',['86:615','516:996'],
  'custom radio groupใช้one tab stopและArrow keysเปลี่ยนfocus/selectionตามAPG',
  'ArrowRightไม่ย้ายfocusหรือเลือกค่าถัดไป ทั้งGROUP/INDIVIDUALทุก6viewports; radioทั้ง6มีtabIndex0. Tab/Spaceยังใช้ได้จึงเป็นpattern/usability defect ไม่ใช่ข้อพิสูจน์keyboardใช้ไม่ได้ทั้งหมด.',
  ['frontend/src/components/ComparisonRow.tsx:75','frontend/src/components/ComparisonRow.tsx:125'],['runtime-summary.json','evidence/runtime/evaluation-group-hover-focus-1440x900-full.png'],
  ['Tabไปตัวเลือกแรก','กดArrowRight','ตรวจactiveElement/aria-checked/tabIndex'],
  'ใช้native radioหรือroving tabindex; ArrowLeft/Right/Up/DownและSpace; คงaccessible group label',
  {wcag:'ARIA APG Radio Group pattern; ไม่ใช้APGแทนเกณฑ์WCAGแบบเหมารวม',complexity:'S'})
add('A11Y-006','P3','Accessibility Issue','Evaluation',E,'Side tabs',['57:3'],
  'tablistมีArrow navigationและความสัมพันธ์tab↔tabpanelที่ถูกต้อง',
  'ArrowRightจากGROUPยังfocus/selectedGROUPทุก6ขนาด ไม่มีtabpanel/aria-controlsเชื่อมเนื้อหา; Tab/Enterยังเปลี่ยนsideได้.',
  ['frontend/src/pages/EvaluatePage.tsx:165','frontend/src/pages/EvaluatePage.tsx:181','frontend/src/pages/EvaluatePage.tsx:199'],['runtime-summary.json','evidence/runtime/evaluation-group-default-1440x900-full.png'],
  ['focusGROUPtab','กดArrowRight','ตรวจfocus/selectionและrelationships'],
  'เลือกautomatic/manual activationให้ชัด,rovingtabindex,Arrow/Home/Endและlabelledtabpanel',
  {wcag:'ARIA APG Tabs pattern; role semanticsตรวจแยกจากkeyboardoperability',complexity:'S'})
add('A11Y-007','P3','Accessibility Issue','Assignment deadline',C+'#assignments','DeadlinePicker',['86:889'],
  'ปิดdate dialogด้วยEscapeแล้วfocusต้องกลับปุ่มกำหนดส่ง',
  'Escapeปิดdialogได้แต่focusไม่กลับtrigger. Month next/previous,cancel,tomorrow,timeและEnter applyผ่าน.',
  ['frontend/src/components/DeadlinePicker.tsx:135','frontend/src/components/DeadlinePicker.tsx:194'],['evidence/failure/checks.json','evidence/failure/calendar-after-escape.png'],
  ['เปิดpicker','focuscontrolภายในแล้วEscape','ตรวจdocument.activeElementเทียบtrigger'],
  'เก็บtriggerrefและคืนfocusทุกclose path; ตรวจfocus order/trapตามรูปแบบdialogที่ใช้จริง',
  {wcag:'2.4.3 Focus Order / APG Dialog guidance; ไม่มีหลักฐานkeyboardtrap',complexity:'S'})
add('UI-001','P3','Figma Mismatch','Guest home','/','Hero / ProcessFlow / CtaBand / footer',['175:3'],
  '1440px guestframeสูง1870px; hero CTA raster bounds x502,y359,w208,h50 (ขอบภาพ±1px)',
  'เว็บ1440pxสูง1948px(+78); mainCTA DOMx502,y387.156,w208,h48: ลงมา28.156pxและเตี้ย2px. Decorative rings/section rhythmและwelcome art scaleต่าง. HeaderGooglelabel/40pxเป็นuser overrideจึงไม่นับเป็นdefect.',
  ['frontend/src/components/Hero.tsx:12','frontend/src/components/ProcessFlow.tsx:17','frontend/src/components/CtaBand.tsx:36','frontend/src/components/SiteFooter.tsx:8','frontend/src/index.css:94'],
  ['evidence/figma/home-guest-desktop-175-3.png','evidence/runtime/home-guest-1440x900-full.png','evidence/comparison/home-1440-side-by-side.png','evidence/comparison/home-1440-diff.png','evidence/comparison/home-1440.json'],
  ['เปิดguest1440×900/100%zoom','รอfontsและimages','เทียบfullpageกับfresh175:3แบบไม่resize'],
  'ปรับhero vertical rhythm/CTAheightและsectionspacingตามframe จากนั้นexportเทียบใหม่โดยmaskส่วนuseroverrideและstatusbadgeที่เพิ่มโดยตั้งใจ',
  {token:'surface/paper #FFFCF7 verified; H1 runtime64/700/line78.08; ไม่อ้างfont tokensอื่นว่าMatchหากไม่ได้inspect',complexity:'S'})
add('UI-002','P2','Figma Mismatch','Classroom list','/classrooms','Classroom header / filters / cards',['349:2388','516:825'],
  'desktopใช้หัวข้อสีขาวบนgradient,searchแบบpill,semesterfilterและcardที่สื่อcourse/instructor/group/work status; mobileStudentแสดงsearchและcardsพร้อมปุ่มเต็มความกว้างเป็นหลัก',
  'หัวข้อสีink,searchrounded-xlและsortdropdownแทนsemester. Cardsแสดงname/slug/timezoneโดยไม่แสดงcontextงาน. ที่390นักศึกษายังเห็นarchive/create/rolefilterทั้งชุดและไม่มีภาพหัวข้อ; cardactionไม่เต็มแถว.',
  ['frontend/src/pages/ClassroomsPage.tsx:120','frontend/src/pages/ClassroomsPage.tsx:163','frontend/src/pages/ClassroomsPage.tsx:214','frontend/src/lib/api.ts:160'],
  ['evidence/figma/owner-classrooms-desktop-349-2388.png','evidence/runtime/classrooms-owner-1440x900-full.png','evidence/figma/student-classrooms-mobile-516-825.png','evidence/visual/student-classrooms-390.png'],
  ['เปิดclassroomsOwner1440และStudent390','เทียบheader,controlorderและcardsemantics; ไม่นับจำนวนห้อง/ชื่อfixtureที่ต่าง'],
  'แยกrole-specific composition,ปรับsearch/card/button layout; เพิ่มmetadataผ่านAPIที่มีข้อมูลจริงก่อนแสดงterm/course/instructor/worksummary',
  {token:'paper #FFFCF7; search pill/radius; hero foregroundwhiteเทียบruntimeink',dependencies:'Backend list/viewmodel สำหรับsemester/course/worksummary; ตกลงนักศึกษามีสิทธิ์สร้างห้องในproductหรือเพียงไม่แสดงปุ่มตามFigma'})
add('UI-003','P2','Figma Mismatch','Instructor classroom',C,'Classroom dashboard / section navigation',['330:1914','330:1057'],
  'Owneroverviewมีroomnameเป็นheading,3primaryactions,setupcallout,4statsและassignmentoverview; membersเป็นfocusedworkspaceพร้อมrolefilters/rowmenu',
  'แม้hasmembers/noassignmentตรงstateแล้ว เว็บยังเป็นlongpage3608pxเทียบJ12 896px: genericheading,hashpills,3stats,roster+memberform+assignmentformพร้อมกัน. ตัวเลข14/4เทียบ12/3มาจากfixtureไม่ใช่bug.',
  ['frontend/src/pages/ClassroomDetailPage.tsx:294','frontend/src/pages/ClassroomDetailPage.tsx:307','frontend/src/pages/ClassroomDetailPage.tsx:385','frontend/src/pages/ClassroomDetailPage.tsx:425','frontend/src/components/RosterTable.tsx:156'],
  ['evidence/figma/owner-classroom-desktop-330-1914.png','evidence/figma/owner-members-desktop-330-1057.png','evidence/visual/owner-members-no-assignment-1440.png','evidence/comparison/owner-overview-desktop-side-by-side.png'],
  ['Ownerนำเข้าrosterแต่ยังไม่มีassignment','เปิดoverview1440px','เทียบองค์ประกอบ/primaryactions ไม่เทียบdynamiccounts'],
  'แยกoverview,members,assignmentauthoring,reportเป็นworkspace statesตามFigma; ใช้routeหรือstateก็ได้ แต่ต้องรักษาback/deeplink/rolepermissions',
  {dependencies:'ต้องกำหนดURL/state mapตาม191framesก่อนrefactor; แก้FLOW-001/002ควบคู่',complexity:'L'})
add('UI-004','P2','Figma Mismatch','Student classroom',C,'StudentDashboard / assignments',['268:6135','516:923'],
  'M03มีroomcontext+group/instructor,งานfilterทั้งหมด/ยังไม่ได้ประเมิน/ออกคะแนนแล้ว,assignmentcardsพร้อมdeadline/progress,statusและปุ่มเต็มแถว',
  'ที่390แสดงgenericwelcome/privacycardขนาดใหญ่และrosterเป็นส่วนหลัก,assignmentเป็นแถวเล็กและไม่มีfilters/assignmenthistory/deadlineต่อcard. หน้าเว็บ2257pxเทียบM03 1238px; dataจำนวนงานต่างจึงไม่ใช้heightเป็นcompliance metric.',
  ['frontend/src/pages/ClassroomDetailPage.tsx:95','frontend/src/pages/ClassroomDetailPage.tsx:466','frontend/src/components/AssignmentsToEvaluateCard.tsx:22'],
  ['evidence/figma/student-classroom-mobile-516-923.png','evidence/visual/student-classroom-390.png','evidence/comparison/student-classroom-mobile-side-by-side.png'],
  ['Studentเปิดห้องที่มีpublishedworkที่390px','ตรวจcontentorder/filter/cardstatus','เทียบM03'],
  'ให้studentassignmentdashboardเป็นmaincontentและแยกroster/groupinfoไปstateรอง; ใช้assignmentstatus/deadline/ownprogressจริง',
  {dependencies:'เสริมsummaryAPIสำหรับownprogress/historyและroomgroupcontextหากcontractปัจจุบันไม่มี',complexity:'M'})
add('UI-005','P2','Figma Mismatch','Evaluation desktop',E,'Pair presentation / criterion cards / navigation',['57:3'],
  'ST20สื่อpairเดียวพร้อมA/Bartifactcards,criterionquestion+weight,บันทึกต่อเกณฑ์ และprevious/nextpair workflow',
  'เว็บแสดงทุกcomparisonแยกภายในcriterion,ไม่มีglobalA/Bartifactcards/criterionweight/questionหรือprevious/nextpair; footerเป็นส่งคำตอบทันที. สร้างfixture3GROUPcriteria+2INDIVIDUALเพื่อตรวจแล้วจึงไม่อธิบายช่องว่างนี้ด้วยจำนวนcriteriaต่างกัน.',
  ['frontend/src/pages/EvaluatePage.tsx:37','frontend/src/pages/EvaluatePage.tsx:240','frontend/src/pages/EvaluatePage.tsx:266','frontend/src/pages/EvaluatePage.tsx:304','frontend/src/lib/api.ts:294','backend/app/api/assignments.py:152'],
  ['evidence/figma/student-evaluation-desktop-57-3.png','evidence/visual/evaluation-three-criteria-1440.png','evidence/visual/conditions.json'],
  ['เปิดevaluateที่มีGROUP3criteria','เทียบST20ที่1440','ตรวจabsenceของartifactA/B,weight,questionและpairnavigation'],
  'กำหนดpair-centric state/navigationและsave lifecycleก่อนจัดlayout; ขยายAPIด้วยcriteria metadata/artifact peritemจากข้อมูลจริง. อย่าปลอมURLสองฝั่งด้วยassignmentURLเดียว',
  {dependencies:'แก้EVAL-001ก่อน; ปัจจุบันartifactUrlเป็นค่าเดียวทั้งassignment ไม่ใช่ต่อitem; ตรวจpair-generation semanticsก่อนบังคับpairเดียวข้ามcriteria',complexity:'L'})
add('UI-006','P2','Responsive Bug','Evaluation mobile',E,'Comparison scale',['516:996'],
  'M04ที่390pxใช้6ตัวเลือกเรียงแนวตั้งเต็มแถว พร้อมชื่อฝั่งในแต่ละคำตอบ/selectedcheck และfixedactions',
  'เว็บ390pxยังเป็นgrid3คอลัมน์×2แถว(min-h128แต่ละตัว), labelยาวแตกบรรทัด; ใช้genericซ้าย/ขวาแทนชื่อในlabel. ไม่พบdocumenthorizontaloverflowแต่compositionต่างชัดเจน.',
  ['frontend/src/components/ComparisonRow.tsx:69','frontend/src/components/ComparisonRow.tsx:82','frontend/src/components/ComparisonRow.tsx:127'],
  ['evidence/figma/student-evaluation-mobile-516-996.png','evidence/visual/evaluation-three-criteria-390.png','evidence/comparison/evaluation-mobile-side-by-side.png','evidence/runtime/evaluation-group-default-375x812-viewport.png'],
  ['เปิดevaluate390×844และ375×812','เทียบ6optionslayoutกับM04','แยกstickyfooterในfullPagescreenshotออกจากoverlapbug'],
  'ใช้singlecolumnmobileoptionsและaria-labelที่มีชื่อpair+ระดับ; selectedtext/checkชัดเจน,desktopคง6columns',
  {token:'mobilelayout=1column expected/current3columns; currentscale sizes24/36/48px',dependencies:'ควบคู่A11Y-005และUI-005',complexity:'M'})
add('UI-007','P2','Missing Component','Own score',S,'ScoreStep / score context / participation',['60:437','516:1322'],
  'ST30/M07แสดงassignment+group,คะแนนรวม/เต็มและวันประกาศ,criteria rows+weights+score/max,จำนวนคู่ส่งแล้ว/ทั้งหมดและp/M',
  'แม้fixtureมี3+2criteriaและ15+5เต็มจริง หน้าเว็บยังแสดงเฉพาะgroup/individualaggregatesและraw4decimals,ไม่มีmax/date/criterionrows/ส่งแล้วNต่อทั้งหมด. Privacyhiddenทำงานถูกต้องและห้ามแก้ให้เปิดคะแนนที่ถูกซ่อน.',
  ['frontend/src/pages/ScorePage.tsx:17','frontend/src/pages/ScorePage.tsx:114','frontend/src/pages/ScorePage.tsx:153','frontend/src/pages/ScorePage.tsx:197','frontend/src/lib/api.ts:559','backend/app/api/scoring.py:418'],
  ['evidence/figma/student-score-desktop-60-437.png','evidence/figma/student-score-mobile-516-1322.png','evidence/visual/score-three-two-criteria-1440.png','evidence/visual/score-three-two-criteria-390.png','evidence/comparison/score-desktop-side-by-side.png'],
  ['Finalizeงานจริงที่มี3+2criteriaและscoremax15+5','เปิดmy-score1440/390','เทียบmetadata/detailpresence ไม่เทียบค่าคะแนนfixture'],
  'ขยายMyScoreOut/OpenAPIให้คืนownscorebreakdown/max/finalizedAt/submissioncountsที่ผ่านprivacyfilter แล้วrenderrows/formatตามแบบ',
  {dependencies:'Backendcontract+privacy regression testsจำเป็น; finalScore/individualHiddenเดิมต้องคงถูกต้อง',complexity:'L'})
add('UI-008','P3','Figma Mismatch','Own score',S,'Score hero illustration',['60:437'],
  'ST30ใช้ภาพรายงานคะแนนที่มีshield/checkตามfreshframe',
  'เว็บใช้reports.pngภาพหน้าต่างกราฟ/แว่นขยาย ซึ่งเป็นคนละภาพในlibrary แม้โหลดไฟล์สำเร็จ.',
  ['frontend/src/pages/ScorePage.tsx:4','frontend/src/pages/ScorePage.tsx:97','frontend/src/assets/figma/README.md:15'],
  ['evidence/figma/student-score-desktop-60-437.png','evidence/visual/score-three-two-criteria-1440.png'],
  ['เปิดscore1440','เทียบheroartกับST30'],
  'หาและexportassetของST30จากFigmaโดยตรงพร้อมnodeprovenance; อย่าใช้ภาพreportsทั่วไปแทน',
  {complexity:'S'})
add('UI-009','P3','Figma Mismatch','Authenticated shell','ทุกprotected route','AppNav',['86:770','516:825','516:923','60:437'],
  'Freshscreensแสดงlogo+PairEvalwordmarkบนมือถือและuser/avatar/bell/logoutตามroleheader',
  'AppNavซ่อนwordmark≤420px เพิ่มroomlink/breadcrumbและรวมlogoutไว้ในaccountmenu; จึงจัดheaderต่างจากFigmaทุกprotectedpage. การไม่มีnotificationcapabilityแยกGAP-001 ไม่คิดซ้ำ.',
  ['frontend/src/components/AppNav.tsx:83','frontend/src/components/AppNav.tsx:90','frontend/src/components/AppNav.tsx:95','frontend/src/components/AppNav.tsx:139'],
  ['evidence/figma/student-classrooms-mobile-516-825.png','evidence/visual/student-classrooms-390.png','evidence/runtime/classrooms-owner-1440x900-viewport.png'],
  ['เปิดprotectedpage1440และ390','เทียบheadercompositionและwordmark'],
  'สร้างresponsiveAppNavvariantsตามrole/screen และกำหนดว่าส่วนaccountmenuใดเป็นintentionaldeviation; คงaccessiblelabelsและrealpermissions',
  {complexity:'M'})

// These are capability gaps proven from screen titles + absent implementation.
// Exact unseen visual layouts remain Not Verified and are not assigned pixel claims.
function gap(id,page,route,component,frames,expected,actual,sources,evidence,fix,extra={}){
 add(id,'P2','Missing Page / Component',page,route,component,frames,expected,actual,sources,evidence,
   ['เปิดframeตามnodeIDและดูชื่อflowที่ระบุ','ตรวจroute/API/componentinventoryและentrypointในเว็บ','ไม่พบcapabilityดังกล่าว; ขั้นตอนภายในที่ยังไม่มีimplementationเป็นBLOCKED'],fix,
   {verification:'Implementation absence confirmed from source and Figma frame inventory; exact unexported frame layout Not Verified',complexity:'L',...extra})
}
gap('GAP-001','Notifications',null,'Notification center / badge',['502:6515','516:870'],
  'FigmaST12/M02มีnotificationและdeeplinkโดยไม่ใส่คะแนนในข้อความ',
  'ไม่มีnotificationroute/component/APIหรือreadstate; authenticatedheaderไม่มีbell. layoutภายในframeยังNotVerified.',
  ['frontend/src/App.tsx:10','frontend/src/components/AppNav.tsx:33','backend/app/main.py:16'],['figma-inventory.json','FIGMA_SCREEN_INVENTORY.md','evidence/figma/student-classrooms-mobile-516-825.png'],
  'กำหนดnotificationevents/recipient/privacy/deeplink/readstateและAPIก่อนเพิ่มdesktopmenu/mobilepage',
  {dependencies:'Backendevent/storage/API+permissions; ห้ามส่งคะแนนในnotificationpayloadตามชื่อframe'})
gap('GAP-002','Score appeals',null,'Appeal entry / form / receipt / teacher response',['318:10237','318:10377','516:1393','516:1440','334:4844','483:7516'],
  'ST30/M07มีปุ่มยื่นอุทธรณ์และST33/34,M08/09มีform/success;ผู้สอนมีqueue/response',
  'ไม่มีappealentrypointในscore,ไม่มีform/receipt/teacherqueue/API. FreshM09ยืนยันsuccessscreenที่ยังไม่มีในเว็บ.',
  ['frontend/src/pages/ScorePage.tsx:114','frontend/src/App.tsx:10','backend/app/api/scoring.py:418'],['evidence/figma/student-score-mobile-516-1322.png','evidence/figma/student-appeal-success-mobile-516-1440.png','evidence/visual/score-three-two-criteria-390.png'],
  'เพิ่มappealmodel/state/submit/respondAPI+audit+rolepermissions แล้วเชื่อมscore→form→receipt→notification',
  {verification:'Missing implementation confirmed; score-entry and success references visually inspected. Form layout details Not Verified',dependencies:'Backend/schema/OpenAPI; scoreidentity/privacy; notificationGAP-001'})
gap('GAP-003','Room lifecycle','/classrooms','Archive / delete / restore controls',['432:2495','432:2575','432:2651','349:2530'],
  'FrameinventoryมีArchive,ลบห้องว่างและข้อห้ามเมื่อมีข้อมูล',
  'มีarchivedfilterแต่ไม่มีarchive/delete/restoremutationหรือownercardmenu; ไม่ได้แปลว่าfilterเป็นdeadcontrol หากมีarchiveddataจากภายนอก.',
  ['frontend/src/pages/ClassroomsPage.tsx:163','frontend/src/lib/api.ts:178','backend/app/api/classrooms.py:55'],['figma-inventory.json','evidence/figma/owner-classrooms-desktop-349-2388.png','evidence/runtime/classrooms-owner-1440x900-full.png'],
  'ตกลงarchive/restore/deletepolicyและowner-onlyAPIพร้อมdataexistenceguards ก่อนเพิ่มcardmenu/confirmstates',
  {dependencies:'Backendlifecycle/schema/audit/permission; ห้ามนำtestdeleteไปใช้ข้อมูลจริง'})
gap('GAP-004','Roster advanced management',C+'#members','Import preview / change role / withdraw',['405:2748','432:2901','468:2963','441:3909','344:1266'],
  'Figmaมีpreviewchangesก่อนนำเข้าซ้ำ,เปลี่ยนroleและwithdrawcourseแทนลบเมื่องานมีข้อมูล',
  'ปัจจุบันimportทันทีผ่านatomicvalidation; rolepanelเพิ่ม/ถอดได้แต่ไม่มีroleedit/withdrawworkflow. การimport/search/pagination/ถอดก่อนpublishที่มีอยู่ทดสอบผ่าน.',
  ['frontend/src/components/RosterImportCard.tsx:11','frontend/src/components/RosterTable.tsx:173','frontend/src/components/MemberPanel.tsx:15','backend/app/api/roster.py:86','backend/app/api/members.py:40'],
  ['figma-inventory.json','evidence/figma/owner-members-desktop-330-1057.png','evidence/failure/roster-removed-confirmed.png'],
  'เพิ่มpreview→confirmprotocol,rolemutationและwithdrawdomainrulesพร้อมpairreassignment/lockedstates; reconcileFigmaกับpermissionsปัจจุบันก่อนเปลี่ยนสิทธิ์',
  {dependencies:'Backendtransaction/state/schema+pairingregressions; อย่าลดsecurityตามvisualframeโดยไม่ทบทวนPRD'})
gap('GAP-005','Assignment authoring',C+'#assignments','Editable multiple criteria / artifact metadata',['332:1712','332:2128','441:4225','441:4645'],
  'Figmaauthoringมีหลายเกณฑ์/weight validationและข้อมูลผลงานที่นำไปแสดงในevaluation',
  'UItoCreateInputhardcodeGROUPคุณภาพงาน1เกณฑ์และINDการมีส่วนร่วม1เกณฑ์. Backendรองรับcriteriaarray/PUTcriteriaอยู่แล้ว แต่UIไม่มีadd/edit/removecriteriaหรือartifactURLinput.',
  ['frontend/src/lib/assignment.ts:91','frontend/src/lib/assignment.ts:103','frontend/src/components/AssignmentPanel.tsx:147','frontend/src/lib/api.ts:263','backend/app/api/assignments.py:251'],
  ['figma-inventory.json','evidence/visual/owner-members-no-assignment-1440.png','evidence/failure/assignment-published-before-reload.png'],
  'เพิ่มeditablecriterialist/description/weight/errorstatesและใช้backendcontractที่มี; validate100%ต่อsideและdraft-onlyupdates; ต้องอ่านfullauthoringframesก่อนเก็บรายละเอียดlayout',
  {dependencies:'Frontendสามารถใช้criteriaAPIเดิม; artifactperitemยังต้องdomain/APIเพิ่มตามUI-005'})
gap('GAP-006','Assignment lifecycle',C+'#assignments','Schedule / unpublish / extend / copy',['491:6320','493:3243','493:3408','399:2041','399:2144','405:2621'],
  'Frameinventoryมีตั้งเวลาเปิดรับ,รอเปิด,ยกเลิกเผยแพร่,ขยายdeadlineและcopyassignment',
  'API/UIรองรับcreate→publish→recompute/finalize/reopen แต่ไม่มีscheduledopening/unpublish/deadlineupdate/duplicateworkflow. Publishไม่ใช่deadbutton; basicflowผ่าน.',
  ['frontend/src/components/AssignmentPanel.tsx:99','frontend/src/lib/api.ts:263','backend/app/api/assignments.py:208','backend/app/api/assignments.py:322'],['figma-inventory.json','discovery.json','evidence/failure/assignment-published-after-reload.png'],
  'กำหนดstatemachineและผลกระทบต่อanswers/deadlinesให้ชัด แล้วเพิ่มcommands/permissions/auditและUIconfirmstates',
  {dependencies:'Backenddomain/schema/clock/schedulerอาจจำเป็น; พิจารณาarchitectureก่อนเพิ่มpackage/service'})
gap('GAP-007','Instructor reporting and interventions',C+'#scores','Coverage / quality / response exclusion / identity audit',['334:2042','334:2250','382:1863','382:2049','334:5219','441:6566','441:6941'],
  'Figmaแยกรายงานคะแนน/coverage/qualityQS01–07,ตรวจresponseรหัสแฝง,excludeพร้อมเหตุผลและauditviewer',
  'มีbasiccomputedscoretable,override,reopenและCSVexport; ไม่มีรายงาน/interactionที่กล่าวมาในเว็บ. Classroom auditAPIมีอยู่แล้วแต่ยังไม่มีviewer. IdentifiedCSVAPIไม่เท่ากับรายงานเปิดตัวตนรายresponse.',
  ['frontend/src/components/AssignmentScoringCard.tsx:323','frontend/src/components/InstructorReport.tsx:1','backend/app/api/scoring.py:389','backend/app/api/members.py:130'],['figma-inventory.json','discovery.json','evidence/runtime/classroom-owner-1440x900-full.png'],
  'แยกรายงานตามcapabilityและใช้ข้อมูลquality/coverageที่คำนวณจริง;เพิ่มintervention+exclusion+auditcontractsเมื่อdomainพร้อม; อย่าเอาunusedInstructorReportที่มีตัวอย่างข้อมูลมารับรองว่ามีflowแล้ว',
  {dependencies:'Backendqualitymetrics/intervention/privacy/auditAPI; owner/co-teacher/TApermissionregressions'})
gap('GAP-008','Offline evaluation',E,'Durable pending answers / recovery',['472:558'],
  'ST24ระบุออฟไลน์ · คำตอบเก็บไว้ในเครื่อง',
  'ฉีดPUT internetdisconnected:มีerrorแต่ไม่persistqueue. คืนnetworkแล้วรอ2.5s APIchoiceยังnull; reloadแล้วselected=false. Basicretryโดยเลือกใหม่อาจทำได้ แต่durability/automaticrecoveryตามframeไม่มี.',
  ['frontend/src/components/ComparisonRow.tsx:32','frontend/src/components/ComparisonRow.tsx:52','frontend/src/components/ComparisonRow.tsx:59'],
  ['figma-inventory.json','evidence/failure/checks.json','evidence/failure/autosave-offline-error.png','evidence/failure/autosave-offline-choice-lost-after-reload.png'],
  'เพิ่มsession-scopedpendingqueue/durablelocalstorageพร้อมrecovery/retryและexpireddeadlinehandling; แยกหน้าตาoffline/errorและบอกสถานะไม่อ้างว่าบันทึกแล้วก่อนserverack',
  {verification:'Runtime loss/recovery failure confirmed under injected network outage; Figma offline capability title verified, fullST24 visual layout Not Verified',dependencies:'แก้EVAL-001savecoordinationก่อน; ต้องแยกuser/session,logoutcleanupและdeadline/privacytests',complexity:'M'})
module.exports=issues
