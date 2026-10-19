# Functional and Accessibility Issues

2026-10-19 · ใช้isolatedsyntheticDB ไม่แตะข้อมูลผู้ใช้ที่127.0.0.1:5173. PASSของaudit runnerหมายถึงเก็บobservationสำเร็จ ส่วนproductresultอ่านPASS/FAILในJSON

ExistingE2E130ผ่าน; auditมีruntimechecks284รายการ(PASS234/FAIL50) และadditionalinteractionchecks16รายการ(PASS8/FAIL8),รวม300checksที่dedupeid+stateแล้ว พร้อมrealkeyboardreviewเสริม6กรณี การเกิดซ้ำข้ามroles/viewportsไม่สร้างissueซ้ำ. Appissues28รายการรวมvisualและ8capabilitygapsแยกกันใน [issues.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/issues.json>)

<a id="eval-001"></a>

## EVAL-001 · P1 · EvaluatePage + ComparisonRow

- Type: Functional Bug · Page: Evaluation · Route: `/classrooms/:classroomId/assignments/:assignmentId/evaluate`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [ST20 · ประเมินระดับกลุ่ม · กำลังตอบ · 57:3](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=57-3), [M04 · ประเมินระดับกลุ่ม · ตอบทีละเกณฑ์ · 516:996](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-996)
- Expected: คำตอบล่าสุดต้องไม่หายเมื่อส่งหรือเปลี่ยนแท็บ; เมื่อบันทึกครบแล้วไม่เตือนว่ายังไม่ตอบ
- Actual / exact difference: กดส่ง903msหลังเลือก: POST200 submittedCount=0 ทั้งที่ต่อมาAPIมีchoice5แต่completed=false. รอautosave3212msแล้วยังเตือนเหลือ1คู่ผิด. เปลี่ยนsideก่อน2sแล้วย้อนกลับ choice=falseและAPIchoice=null.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/components/ComparisonRow.tsx:32](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonRow.tsx:32>), [frontend/src/components/ComparisonRow.tsx:38](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonRow.tsx:38>), [frontend/src/components/ComparisonRow.tsx:44](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonRow.tsx:44>), [frontend/src/pages/EvaluatePage.tsx:105](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/EvaluatePage.tsx:105>)
- Evidence: [runtime-summary.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/runtime-summary.json>), [evidence/runtime/evaluation-submit-during-debounce-1440x900-full.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/evaluation-submit-during-debounce-1440x900-full.png>), [evidence/runtime/evaluation-submit-after-autosave-1440x900-full.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/evaluation-submit-after-autosave-1440x900-full.png>), [evidence/failure/evaluation-pending-side-switch.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/evaluation-pending-side-switch.png>), [evidence/failure/checks.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/checks.json>)

ตรวจซ้ำ:

1. ใช้studentที่มีGROUP1คู่
2. เลือกขวาดีกว่าแล้วกดส่งก่อน2sและยอมรับconfirm
3. ตรวจsubmittedCount/completed; ทำซ้ำแบบรอข้อความบันทึกแล้ว
4. อีกครั้งเลือกแล้วสลับรายบุคคลและกลับGROUPก่อน2s

แนะนำ: รวมchoice/pending/save promiseไว้ในstateที่parentทราบ; flushและawaitคำตอบล่าสุดก่อนsubmit/เปลี่ยนside พร้อมกันsubmitซ้ำ; incomplete countต้องใช้stateล่าสุด และมีregression testsของทั้ง3กรณี

Dependencies: ออกแบบstate/save coordinationก่อนปรับpair navigation; เพิ่มtestsที่เลือกผ่านUIจริง · Complexity: M · Root cause: Local choice/debounceอยู่ในrow แต่parentใช้snapshotเริ่มต้น; cleanupล้างtimerตอนrowunmount

<a id="eval-002"></a>

## EVAL-002 · P2 · Deadline state

- Type: Functional Bug · Page: Evaluation · Route: `/classrooms/:classroomId/assignments/:assignmentId/evaluate`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [ST26 · ปิดรับแล้ว · คำตอบอ่านอย่างเดียว · 502:6592](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=502-6592)
- Expected: เมื่อdeadlineผ่านบนหน้าที่เปิดค้าง inputsต้องread-onlyและปุ่มส่งหายโดยไม่reload
- Actual / exact difference: หลังdeadline350ms radioยังenabledและปุ่มส่งยังแสดง; autosaveถูกBackendปฏิเสธ409. Reloadแล้วจึงdisabled/ซ่อนsubmitถูกต้อง.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/pages/EvaluatePage.tsx:103](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/EvaluatePage.tsx:103>), [frontend/src/components/ComparisonRow.tsx:81](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonRow.tsx:81>)
- Evidence: [evidence/failure/checks.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/checks.json>), [evidence/failure/evaluation-deadline-passed-before-reload.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/evaluation-deadline-passed-before-reload.png>), [evidence/failure/evaluation-deadline-passed-after-reload.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/evaluation-deadline-passed-after-reload.png>)

ตรวจซ้ำ:

1. สร้างงานdeadlineอีก12s
2. เปิดevaluateก่อนหมดเวลาและรอข้ามdeadline
3. เลือกคำตอบ ตรวจPUT409 แล้วreloadเปรียบเทียบ

แนะนำ: ตั้งclock/deadline timerจากเวลาที่อ้างอิงserver และอัปเดตreadOnly/submitทันที; อธิบาย409อย่างชัดเจน. รักษาการตรวจdeadlineฝั่งserverไว้

Dependencies: ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ · Complexity: S · Root cause: คำนวณDateเฉพาะตอนparentrender ไม่มีtimer

<a id="flow-001"></a>

## FLOW-001 · P2 · AssignmentPanel / assignment list / scoring

- Type: Functional Bug · Page: Classroom management · Route: `/classrooms/:classroomId`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [J16 · ภาพรวมห้อง · งานเปิดให้ประเมินแล้ว · 332:2834](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=332-2834)
- Expected: เผยแพร่ผ่านUIสำเร็จแล้วรายการงานและเครื่องมือคะแนนต้องอัปเดตทันที
- Actual / exact difference: สร้าง/ตรวจfeasibility/publishผ่านUIจริงได้201/200 และแสดงPUBLISHED แต่evaluateLink=0,scoringCard=0; GETรายการคง2requests. Reloadแล้วทั้งคู่เป็น1และGETเป็น4.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/components/AssignmentPanel.tsx:99](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AssignmentPanel.tsx:99>), [frontend/src/components/AssignmentsToEvaluateCard.tsx:22](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AssignmentsToEvaluateCard.tsx:22>), [frontend/src/components/AssignmentScoringCard.tsx:323](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AssignmentScoringCard.tsx:323>), [frontend/src/pages/ClassroomDetailPage.tsx:450](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ClassroomDetailPage.tsx:450>)
- Evidence: [evidence/failure/checks.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/checks.json>), [evidence/failure/assignment-published-before-reload.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/assignment-published-before-reload.png>), [evidence/failure/assignment-published-after-reload.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/assignment-published-after-reload.png>)

ตรวจซ้ำ:

1. Ownerนำเข้าroster
2. กรอกงาน→กำหนดส่ง→สร้าง→ตรวจความเป็นไปได้→เผยแพร่
3. ตรวจรายการงานและscore toolsก่อน/หลังreload

แนะนำ: ยกassignment list/refresh versionไปparentหรือใช้callbackหลังmutationเพื่อinvalidate sibling lists ทั้งcreate/publish/finalize/reopen

Dependencies: ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ · Complexity: M · Root cause: siblingsfetchเฉพาะmount/classroomId; publishแก้เฉพาะstateภายในAssignmentPanel

<a id="flow-002"></a>

## FLOW-002 · P3 · SetupStepper

- Type: Functional Bug · Page: Classroom management · Route: `/classrooms/:classroomId`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [J12 · ภาพรวมห้อง · มีสมาชิกแล้ว ยังไม่มีงาน · 330:1914](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=330-1914), [J16 · ภาพรวมห้อง · งานเปิดให้ประเมินแล้ว · 332:2834](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=332-2834)
- Expected: ขั้นสร้างงานเสร็จแล้วเมื่อมีงานสร้างหรือเผยแพร่จริง
- Actual / exact difference: หลังpublishจริงและreloadแล้วขั้นสร้างงานยังแสดง3/กำลังทำอยู่ ทุก6ขนาดจอ
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/pages/ClassroomDetailPage.tsx:269](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/ClassroomDetailPage.tsx:269>)
- Evidence: [evidence/failure/checks.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/checks.json>), [evidence/failure/assignment-published-after-reload.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/assignment-published-after-reload.png>)

ตรวจซ้ำ:

1. เผยแพร่งาน
2. Reloadห้องเรียน
3. อ่านsetup stepสร้างงานประเมิน

แนะนำ: deriveสถานะจากassignmentที่โหลดจริง; กำหนดให้ชัดว่าdraftหรือpublishedนับเสร็จ

Dependencies: ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ · Complexity: S · Root cause: stepState(false,hasStudents) hardcode done=false

<a id="auth-001"></a>

## AUTH-001 · P3 · downloadCsv

- Type: Navigation Bug · Page: CSV export · Route: `/classrooms/:classroomId#scores`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [S04 · ส่งออกไฟล์ไม่สำเร็จ · 517:3857](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=517-3857)
- Expected: Export401ต้องใช้matching-session invalidationแบบเดียวกับJSON API
- Actual / exact difference: ฉีด401เฉพาะexport: แสดงerrorแต่tokenยังอยู่และprotected pageยังmount. เมื่อฉีดJSON/me401แล้วreloadจึงclearและกลับ/. Serverปฏิเสธexportอยู่เสมอ; ไม่ใช่authorization bypass.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/lib/api.ts:63](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/lib/api.ts:63>), [frontend/src/lib/api.ts:508](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/lib/api.ts:508>), [frontend/src/lib/api.ts:518](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/lib/api.ts:518>)
- Evidence: [evidence/failure/checks.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/checks.json>), [evidence/failure/export-401-session-still-mounted.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/export-401-session-still-mounted.png>), [evidence/failure/later-json-401-session-cleared.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/later-json-401-session-cleared.png>)

ตรวจซ้ำ:

1. เปิดคะแนนด้วยsessionที่ใช้ได้
2. interceptเฉพาะexportให้ตอบ401
3. กดส่งออกและดูstorage presence/route; ต่อด้วยme401

แนะนำ: รวมcommon response/session handlingสำหรับJSONและdownload โดยclearเฉพาะtokenที่เป็นของrequestเดิมเพื่อรักษาrace protection

Dependencies: ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ · Complexity: S · Root cause: downloadCsvใช้fetchตรงข้ามapiFetch401 handler

<a id="a11y-001"></a>

## A11Y-001 · P2 · SiteNav brand link

- Type: Accessibility Issue · Page: Guest home · Route: `/`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [Home — Guest · Orange illustrated · 175:3](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=175-3)
- Expected: ลิงก์กลับหน้าหลักต้องมีaccessible nameที่ทุกขนาดจอ
- Actual / exact difference: ที่375pxซ่อนPairEvalด้วยCSS ขณะรูปaltว่าง/aria-hidden จึงมีlinkในtab orderที่ไม่มีชื่อ; axe link-name FAILทั้ง3home states. ที่430pxไม่พบปัญหานี้.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/components/SiteNav.tsx:31](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/SiteNav.tsx:31>), [frontend/src/components/SiteNav.tsx:33](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/SiteNav.tsx:33>), [frontend/src/components/icons.tsx:8](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/icons.tsx:8>)
- Evidence: [runtime-summary.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/runtime-summary.json>), [evidence/runtime/home-guest-375x812-viewport.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/home-guest-375x812-viewport.png>)

ตรวจซ้ำ:

1. เปิด/ที่375×812
2. ตรวจaccessible nameของlogo linkหรือรันaxe

แนะนำ: เพิ่มaria-labelเช่นPairEvalหน้าหลักให้Link; ห้ามอาศัยข้อความที่ถูกdisplay:none

Dependencies: ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ · Complexity: S

Accessibility criterion/pattern: 2.4.4 Link Purpose / 4.1.2 Name Role Value

<a id="a11y-002"></a>

## A11Y-002 · P2 · ApiStatusBadge / evaluation tab counts

- Type: Accessibility Issue · Page: Home / Evaluation · Route: `/ และ /classrooms/:classroomId/assignments/:assignmentId/evaluate`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [Home — Guest · Orange illustrated · 175:3](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=175-3), [ST20 · ประเมินระดับกลุ่ม · กำลังตอบ · 57:3](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=57-3)
- Expected: ข้อความ12pxต้องcontrastอย่างน้อย4.5:1ตามWCAG1.4.3
- Actual / exact difference: axeยืนยันready badge #238156บน#EAF7F0=4.38:1; countบนactive tab #BC693Cบน#FFF0E5=3.60:1 และinactive #9D8C84บนwhite=3.22:1. รวม62state/viewportsของruleเดียว ไม่ใช่62issues.
- Token / layout value: --color-ok-600/#238156, --color-ok-50/#EAF7F0, opacity-75 บนtab count
- Source: [frontend/src/components/ApiStatusBadge.tsx:5](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ApiStatusBadge.tsx:5>), [frontend/src/pages/EvaluatePage.tsx:183](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/EvaluatePage.tsx:183>), [frontend/src/index.css:26](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/index.css:26>)
- Evidence: [runtime-summary.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/runtime-summary.json>), [evidence/runtime/home-guest-1440x900-full.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/home-guest-1440x900-full.png>), [evidence/runtime/evaluation-group-default-375x812-viewport.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/evaluation-group-default-375x812-viewport.png>)

ตรวจซ้ำ:

1. เปิดhomeและevaluate
2. รันaxeพร้อมwcag2aa
3. ตรวจeffective foregroundหลังopacity75และพื้นหลังจริง

แนะนำ: ใช้success text tokenที่contrastผ่านและเลิกopacityลดcount text; ตรวจทั้งactive/inactive/hoverโดยไม่ลดความอ่านง่ายเพื่อให้เหมือนภาพ

Dependencies: ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ · Complexity: S

Accessibility criterion/pattern: 1.4.3 Contrast Minimum

<a id="a11y-004"></a>

## A11Y-004 · P3 · AppNav / ExportControls

- Type: Accessibility Issue · Page: Account / export menus · Route: `/classrooms/:classroomId`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [AppNav · 86:770](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-770)
- Expected: ARIA menuเปิดแล้วEscapeปิดและคืนfocusให้trigger; มีkeyboard menu behaviorที่สอดคล้องกัน
- Actual / exact difference: บัญชีทั้ง4roles×6viewportsยังเปิดหลังEscape. Export menuยังเปิด aria-expanded=true และfocusไม่กลับtriggerหลังEscape.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/components/AppNav.tsx:57](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AppNav.tsx:57>), [frontend/src/components/AppNav.tsx:139](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AppNav.tsx:139>), [frontend/src/components/AssignmentScoringCard.tsx:264](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AssignmentScoringCard.tsx:264>)
- Evidence: [runtime-summary.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/runtime-summary.json>), [evidence/failure/checks.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/checks.json>), [evidence/failure/export-menu-after-escape.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/export-menu-after-escape.png>)

ตรวจซ้ำ:

1. เปิดaccountหรือexport menu
2. focusmenuitem
3. กดEscapeแล้วดูvisibility/activeElement

แนะนำ: ทำshared menu keyboard/focus handling: focus itemเมื่อเปิด,Escapeคืนtrigger,Arrow navigation และoutside click

Dependencies: ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ · Complexity: S

Accessibility criterion/pattern: ARIA APG Menu Button pattern; ไม่สรุปWCAG2.1.1ล้มเหลวเพียงเพราะEscapeไม่มี หากยังใช้Tabได้

<a id="a11y-005"></a>

## A11Y-005 · P3 · ComparisonRow radiogroup

- Type: Accessibility Issue · Page: Evaluation · Route: `/classrooms/:classroomId/assignments/:assignmentId/evaluate`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [ComparisonRow · 86:615](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-615), [M04 · ประเมินระดับกลุ่ม · ตอบทีละเกณฑ์ · 516:996](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=516-996)
- Expected: custom radio groupใช้one tab stopและArrow keysเปลี่ยนfocus/selectionตามAPG
- Actual / exact difference: ArrowRightไม่ย้ายfocusหรือเลือกค่าถัดไป ทั้งGROUP/INDIVIDUALทุก6viewports; radioทั้ง6มีtabIndex0. Tab/Spaceยังใช้ได้จึงเป็นpattern/usability defect ไม่ใช่ข้อพิสูจน์keyboardใช้ไม่ได้ทั้งหมด.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/components/ComparisonRow.tsx:75](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonRow.tsx:75>), [frontend/src/components/ComparisonRow.tsx:125](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonRow.tsx:125>)
- Evidence: [runtime-summary.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/runtime-summary.json>), [evidence/runtime/evaluation-group-hover-focus-1440x900-full.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/evaluation-group-hover-focus-1440x900-full.png>)

ตรวจซ้ำ:

1. Tabไปตัวเลือกแรก
2. กดArrowRight
3. ตรวจactiveElement/aria-checked/tabIndex

แนะนำ: ใช้native radioหรือroving tabindex; ArrowLeft/Right/Up/DownและSpace; คงaccessible group label

Dependencies: ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ · Complexity: S

Accessibility criterion/pattern: ARIA APG Radio Group pattern; ไม่ใช้APGแทนเกณฑ์WCAGแบบเหมารวม

<a id="a11y-006"></a>

## A11Y-006 · P3 · Side tabs

- Type: Accessibility Issue · Page: Evaluation · Route: `/classrooms/:classroomId/assignments/:assignmentId/evaluate`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [ST20 · ประเมินระดับกลุ่ม · กำลังตอบ · 57:3](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=57-3)
- Expected: tablistมีArrow navigationและความสัมพันธ์tab↔tabpanelที่ถูกต้อง
- Actual / exact difference: ArrowRightจากGROUPยังfocus/selectedGROUPทุก6ขนาด ไม่มีtabpanel/aria-controlsเชื่อมเนื้อหา; Tab/Enterยังเปลี่ยนsideได้.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/pages/EvaluatePage.tsx:165](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/EvaluatePage.tsx:165>), [frontend/src/pages/EvaluatePage.tsx:181](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/EvaluatePage.tsx:181>), [frontend/src/pages/EvaluatePage.tsx:199](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/pages/EvaluatePage.tsx:199>)
- Evidence: [runtime-summary.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/runtime-summary.json>), [evidence/runtime/evaluation-group-default-1440x900-full.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/runtime/evaluation-group-default-1440x900-full.png>)

ตรวจซ้ำ:

1. focusGROUPtab
2. กดArrowRight
3. ตรวจfocus/selectionและrelationships

แนะนำ: เลือกautomatic/manual activationให้ชัด,rovingtabindex,Arrow/Home/Endและlabelledtabpanel

Dependencies: ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ · Complexity: S

Accessibility criterion/pattern: ARIA APG Tabs pattern; role semanticsตรวจแยกจากkeyboardoperability

<a id="a11y-007"></a>

## A11Y-007 · P3 · DeadlinePicker

- Type: Accessibility Issue · Page: Assignment deadline · Route: `/classrooms/:classroomId#assignments`
- Result: FAIL · Evidence level: Confirmed runtime/source or fresh visual comparison
- Figma frame/node: [DeadlinePicker · 86:889](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=86-889)
- Expected: ปิดdate dialogด้วยEscapeแล้วfocusต้องกลับปุ่มกำหนดส่ง
- Actual / exact difference: Escapeปิดdialogได้แต่focusไม่กลับtrigger. Month next/previous,cancel,tomorrow,timeและEnter applyผ่าน.
- Token / layout value: ไม่ใช่ token-only issue
- Source: [frontend/src/components/DeadlinePicker.tsx:135](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/DeadlinePicker.tsx:135>), [frontend/src/components/DeadlinePicker.tsx:194](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/DeadlinePicker.tsx:194>)
- Evidence: [evidence/failure/checks.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/checks.json>), [evidence/failure/calendar-after-escape.png](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/calendar-after-escape.png>)

ตรวจซ้ำ:

1. เปิดpicker
2. focuscontrolภายในแล้วEscape
3. ตรวจdocument.activeElementเทียบtrigger

แนะนำ: เก็บtriggerrefและคืนfocusทุกclose path; ตรวจfocus order/trapตามรูปแบบdialogที่ใช้จริง

Dependencies: ไม่มี dependency package ใหม่ที่จำเป็นต่อการแก้ที่แนะนำ · Complexity: S

Accessibility criterion/pattern: 2.4.3 Focus Order / APG Dialog guidance; ไม่มีหลักฐานkeyboardtrap

## Offline retention

GAP-008เป็นทั้งช่องว่างจากFigmaและfailureที่ยืนยันด้วยnetworkinjection: serverchoiceยังnullหลังrecoverและreloadทำให้selectionหาย อ่านรายละเอียดใน [GAP-008](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/FIGMA_MISMATCH_REPORT.md>) โดยนับissueครั้งเดียว

## สิ่งที่ผ่านและข้อจำกัด

Authguardทั้ง4protectedroutes,serververification/401race/retryตามassertionsเดิม,4roles,logout,create/cancel/validation,search/sort/filter,CSVvalid/atomicinvalid/sample/reselect,rosterpagination/removalcancel+confirm,feasibility/publishbasic,autosaveเมื่อรอจนสำเร็จ,recompute/provisional/finalize/override/reopen,CSVprivacy/identityและownscoreprivacychecksผ่าน. การผ่านส่วนหนึ่งไม่ลบfailureในส่วนอื่นของflowเดียวกัน

Runtimeไม่มีpageerror/unhandledJSexceptionหรือbrokenimageจากcaptures206รายการ; third-partyGISมี403/origin-not-allowed/CORSstyleที่http://localhost:8080ในisolatedauditstack จึงบันทึกGoogleOAuthจริงเป็นBLOCKEDในenvironmentนี้ ไม่เหมารวมว่า127.0.0.1:5173เสีย. Logincontractในsuite130ใช้GISdouble; realGooglecredentials/accountchooser/domainpolicyไม่ได้ทดสอบใหม่ และไม่signoutบัญชีผู้ใช้

Layout-shiftที่วัดสูงสุด0.1732245ในTAclassroomlist375px เป็นsingle-lab observationแบบcumulativeต่อpage; ยังไม่มีtraceattribution/repeatedbaseline/fielddata จึงระบุNeedsprofilingและไม่สร้างperformancebugจากตัวเลขเดียว. Unexpectedrerenderprofiling,screenreaderและcross-browserยังNOTTESTED. Frontendlintไม่มีerrorแต่ยังมีReacteffect/purity/dependencywarnings ไม่ใช่หลักฐานrerenderregressionด้วยตัวเอง

เกณฑ์contrastอ้างอิง [WCAG1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html); keyboardfunctionalityอ้างอิง [WCAG2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html). รูปแบบ [RadioGroup](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) และ [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) เป็นAPGguidance: การขาดArrow/Escapeเพียงอย่างเดียวไม่เท่ากับพิสูจน์WCAGkeyboardfailureทุกกรณี. Axe4.14ตรวจtagswcag2a/2aa/21aa/22aaทุก206captures พบ3rulesดิบ; scrollable-region-focusableทั้ง6role/widthกรณีถูกยืนยันว่าfalsepositiveในChromium: Tabเข้าถึงwrapperได้แม้tabIndex=-1และArrowRightเลื่อน40pxจริง. A11Y-003จึงถอนจากissuecount; browserอื่นยังNOTTESTED. หลักฐาน [evidence/visual/roster-keyboard.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/visual/roster-keyboard.json>). Incomplete/manualchecksอยู่rawJSON ไม่รับรองWCAGconformanceจากaxePASSเพียงอย่างเดียว
