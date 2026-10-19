# Audit Summary

2026-10-19 · Asia/Bangkok · AUDIT ONLY · branch codex/figma-frontend · head c50702a39a0be9dd52ad39f9f56db592925384fa

เว็บเปิดได้ครบทุกrouteและregression suiteเขียว แต่ยังไม่พร้อมรับรองว่าimplementตามFigmaครบ พบปัญหาคำตอบตกหล่นเมื่อส่ง/สลับsideก่อนautosave,deadlineUIไม่อัปเดตและpublishไม่refreshsiblingworkspaces รวมถึงscorebreakdownและflowsใหม่จากFigmaที่ยังไม่มี

| Coverage / result | Verified scope |
|---|---|
| Website routes | 5concrete+wildcardredirect; เปิดจริง5/5 ไม่มีrouteถูกblockจากbackendfixture |
| Roles / responsive | Classroom4roles;6exactviewportsทุกroute +Student390pxเสริม |
| Runtimecaptures | 206unique state×viewport observations =412PNG; 34commonstates×6+2submissioncases |
| Figma | 7pages;191screen/stateframes =Home5+Student35+Owner93+Co-teacher42+TA16 |
| Figma mapping | ทุก191มีstatus:123partialroute match,59missingcapability,9NotVerified; masters41/assetlayers81แยกยอด |
| Visualcomparison | Freshexports11:10เทียบเว็บ+1missingappealsuccess;180framesยังNotVerifiedfullvisual. ทุก5routefamiliesมีconfirmedmismatch |
| Browserflowfamilies | 28:PASS18 / FAIL9 / BLOCKED1 (realOAuth); boundedassertions+gapsในUSER_FLOW_REPORT |
| Figma-onlyflows | 8capabilityfamiliesแยก:7BLOCKEDไม่มีentrypoint,offline1FAILจริง; ไม่บวกเป็นflowPASS |
| Issuecount | 28deduplicated:20observedfunctional/accessibility/visual+8capabilitygaps; unseenlayoutdetailsNotVerified |
| Severity | P0=0 · P1=1 · P2=18 · P3=9 · P4=0 |
| Automation | ExistingE2E130passed; backend428passed/29integrationdeselected; frontend21passed; lint/typesnoerrors(frontendlintมีwarnings) |
| Auditchecks | 284runtime+16extra=300checks:PASS242/FAIL58, dedupedbyid+state. ไม่ใช่300issuesหรือ300userflows |
| Accessibility | axe4.14ทุก206captures:raw138scanPASS/68scanFAIL,3rules; scrollrule6alertsถอนหลังTab/Arrowผ่านจริง. เหลือ6a11yfindingsรวมmanualwidgetprobes |
| Runtimequality | 0pageerrors,0brokenimages,0documentoverflowfailures; fontsloaded. GISorigin8080errorsแยกเป็นenvironmentblock |

## สิ่งที่ควรแก้ก่อน

1. EVAL-001 P1: sharedpendinganswers/flushก่อนsubmitหรือเปลี่ยนside. พบPOST200ส่ง0คู่ก่อนPUTและคำตอบหายเมื่อเปลี่ยนside
2. EVAL-002/FLOW-001: deadlineclockและassignmentinvalidation; server409ยังป้องกันlatewriteอยู่
3. A11Y-001/002: mobilebrandlabelและcontrast แล้วแก้menu/radio/tab/focuspatterns
4. GAP-005/UI-005/006: multiplecriteria/artifactcontractและpair-centric/mobileevaluationก่อนขยายredesign
5. UI-007/GAP-002: scorebreakdown/max/date/countsและappealflow ต้องbackend+privacytests ไม่ใช่เติมตัวเลขสมมุติในFrontend

## ทุกหน้าที่ไม่ตรงFigma

- `/` — FAIL · UI-001 / A11Y-001/002
- `/classrooms` — FAIL · UI-002/009
- `/classrooms/:classroomId` — FAIL Owner/Student · UI-003/004; Co-teacher/TA full-frame visual Not Verified
- `/classrooms/:classroomId/assignments/:assignmentId/evaluate` — FAIL · EVAL-001/002, UI-005/006
- `/classrooms/:classroomId/assignments/:assignmentId/score` — FAIL · UI-007/008; final/privacy functional checks PASS

Missingcapabilitiesหลัก:notification,appeal,roomarchive/delete,rosterpreview/role/withdraw,multiplecriteriaeditor,assignmentlifecycleแบบตั้งเวลา/ขยาย/ยกเลิก/คัดลอก,advancedquality/coverage/intervention/auditviewer,offlinependingqueue. แต่ละรายการมีframe/source/evidence/แนวทางแก้ในรายงานหลัก โดย59missingframesรวมเป็น8families ไม่ใช่59bugsซ้ำ

## ข้อจำกัดและข้อขัดแย้ง

RealGoogleOAuthที่isolatedhttp://localhost:8080ถูกGoogle403(originnotallowed) จึงBLOCKED; GISmockcontract130suiteไม่แทนrealOAuth. ไม่logoutหรือแก้ข้อมูลpreviewผู้ใช้ที่127.0.0.1:5173. Prototypehotspots/transitions,fullvariables/styles/allcomponentstates,180unexportedframevisuals,Co-teacher/TAfullframecomparison,screenreaders/crossbrowser/touch/zoomและallnetworkpermutationsยังNOTTESTED/NotVerified. ไม่มีcomplianceเปอร์เซ็นต์และไม่รับรองWCAGทั้งระบบ

Figmaเองมีstatecaption/bar/selectionที่ขัดแย้งกัน; ปุ่มGoogle40pxเป็นexplicituseroverride. อ้างcurrentST30 60:437 ไม่ใช้old292:7699. Full-pagecaptureของstickybarอาจวางbarไว้กลางภาพ; ไม่สร้างoverlapissueจากartifactนี้

## Verification / artifacts

ไม่มีapplication code,existingtestsหรือprojectmanifest/lockfileถูกแก้ในauditนี้; sourcebaseline123ไฟล์เทียบhashก่อน/หลังใน [evidence/source-integrity.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/source-integrity.json>). เก็บการแก้เดิมของผู้ใช้ไว้,ไม่commit/push/deploy. Axe-coreติดตั้งเฉพาะ.localตามpermissionผู้ใช้ และscripts/reports/evidenceอยู่audit-reports. Dockerprojectทดสอบแยกจากpreview. InitialauditมีWindowsbindmountreportwriteEINVAL:แก้เฉพาะharnessและrerunaffectedscenariosจนcoverageครบ ไม่จัดเป็นproductbug

- [รายงานหลัก:ภาพ/ความต่าง/ช่องว่าง](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/FIGMA_MISMATCH_REPORT.md>)
- [การทำงานและaccessibility](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/FUNCTIONAL_ISSUES.md>)
- [Flowmatrix28families](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/USER_FLOW_REPORT.md>)
- [ผล6ขนาดจอและmobile390](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/RESPONSIVE_ISSUES.md>)
- [29modules/states/limitations](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/COMPONENT_AUDIT.md>)
- [ลำดับแก้Frontend/Backend/Tests](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/FIX_PRIORITY.md>)
- [5routes+fallback](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/ROUTE_INVENTORY.md>)
- [191frames+41masters](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/FIGMA_SCREEN_INVENTORY.md>)
- [ภาพและrawreportsทั้งหมด](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/EVIDENCE_INDEX.md>)
- [Central28findings](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/issues.json>)
- [คำสั่ง/ผลทดสอบจริง](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/verification.json>)
