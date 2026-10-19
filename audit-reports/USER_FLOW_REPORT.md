# User Flow Report

2026-10-19 ·28source-supportedbrowserflowfamilies: {"PASS":18,"FAIL":9,"BLOCKED":1} ผลเป็นboundedassertionsตามขั้นที่เขียน ไม่ใช่รับรองทุกstate/permutation. Existing130casesมีAPI-onlycasesด้วย จึงไม่เรียกว่า130userflows

| ID | Flow / steps | Result | Failed step / severity | Evidence / coverage gap |
|---|---|---|---|---|
| F01 | Landing / anchors / guides / about · เปิดhome→anchors/footertargets→3guides→abouttoggle→guestCTAloginnotice | PASS | — | HOME-GUIDE/HOME-ANCHORS-ABOUT-CTA; realGoogleแยกF02 |
| F02 | Googlelogin / firstaccount · SDKbutton→chooser→credential→appsession→verifiedclassrooms | BLOCKED | RealGoogle: isolated8080originไม่อยู่ในallowedorigins | 130suiteGIScontractmockผ่าน; realcredentials/chooser/cancel/domainไม่ได้ทดสอบใหม่ |
| F03 | Logout · 4roles→account→logout→tokenremoved→home | PASS | — | LOGOUTทุก6viewports; menukeyboardมีA11Y-004แยก |
| F04 | Protectedroutes/session · 4directroutesguest→home;serververify/401/retry/oldtokenrace | PASS | — | AUTH-GUARDทุก6; login.specassertionsใน130suite |
| F05 | Classroomcreate/cancel/validate · dialog→name/timezone→create/list;empty/duplicate→error;Escape→focus | PASS | — | 130suiteclassrooms/design; CREATE-MODAL-KEYBOARDทุก6 |
| F06 | Search/filter/sort · ค้นหา→actualresult/empty→clear;role/statusfilters;Arrow/Enter sort | PASS | — | CLASSROOM-SEARCH/SORTทุก4roles×6 +designsuitefilterassertions |
| F07 | Rolepage/navigation · 4roles→correcttools→hashsectiontarget→back/logout | PASS | — | Rolematrix+hashchecks; scrolloffsetทุกedge/longnamesยังNOTTESTED |
| F08 | RosterCSVimport/sample/reselect · sample→pick/remove/reselect→uploadvalid/invalid→atomicresult/refresh | PASS | — | CSV-PICKER-SAMPLE+130suite; actualdrag-dropgestureยังNOTTESTED |
| F09 | Rostersearch/pages/remove · filter/empty→clear→page2→removecancel/confirm→API/UIupdated | PASS | — | ROSTER-SEARCH-PAGINATION/ROW-REMOVE |
| F10 | Staffmembers · email/role→add/error→remove→refresh;permissiondenial | PASS | — | 130suitemembersUI+API; fullFigmaadvancedrole/withdrawแยกGAP-004 |
| F11 | Deadlinepicker · monthprev/next→pending→cancel/tomorrow/24h→Enterapply→Escape | FAIL | Escapeไม่คืนfocus · A11Y-007 P3 | CALENDAR-INTERACTIONSผ่าน; keyboardcalendarทุกday/HomeEndยังNOTTESTED |
| F12 | Assignmentdraft/authoring · กรอกงาน/weights/deadline→draft;invalidweights→block | FAIL | หลายcriteria/artifacteditorตามแบบไม่มี · GAP-005 P2 | Basiccreate+invalidweight130suiteผ่าน; ใช้APIสร้างmultiplecriteriaได้จริง |
| F13 | Feasibility · draft→check→coverage/workload/reasons/lowanonymity | PASS | — | 130suiteAPI+realUIfailureaudit |
| F14 | Publish→workspacerefresh · draft→publishsuccess→siblingentry/scoring/stepupdated | FAIL | siblings/stepไม่อัปเดต · FLOW-001 P2 / FLOW-002 P3 | ASSIGNMENT-LIST-REFRESH/CLASSROOM-SETUP-STATE |
| F15 | Studentworkentry · publishedwork→evaluate;finalizedwork→score | PASS | — | 130suiteevaluations/scoring +matrix; richdashboardแยกUI-004 |
| F16 | Switchside · GROUP↔INDIVIDUAL→correctdata/pendingselectionpreserved | FAIL | pendinganswerหาย · EVAL-001 P1; tabkeysA11Y-006 | EVALUATION-PENDING-SIDE-SWITCH; basictabclickผ่าน |
| F17 | Select/autosave/reload/recovery · 6choices→2s→saving/saved→persist/reload;networkerror/recover | FAIL | offlinechoiceหาย · GAP-008 P2; radiokeysA11Y-005 | AUTOSAVE-REAL-APIผ่านทุก6; failureinjectionยืนยันrecoverygap |
| F18 | Submitcomplete/partial/cancel · choose→saveorimmediate→confirmifincomplete→submittedcount | FAIL | POSTก่อนPUTและstaleunanswered · EVAL-001 P1 | EVAL-001สองtimings; existingpartialcancel/idempotencyassertionsผ่าน |
| F19 | Deadlineboundary/read-only · เปิดก่อนdeadline→รอข้าม→inputsreadonly/submitgone | FAIL | pageไม่อัปเดตจนreload · EVAL-002 P2 | EVALUATION-DEADLINE-LIVE; server409+expiredinitialviewผ่าน |
| F20 | Recompute/provisionalscore · owner→recompute→expand→newvalues/provisionallabel | PASS | — | 130scoringsuite+failureauditfixtures |
| F21 | Finalize/lowconfidence · afterdeadline→warnconfirm→FINALIZED→ownscore | PASS | — | actualUIlowconfidenceconfirm+APIdeadlineguards; everycancel/errorpermutationไม่ครบ |
| F22 | Scoreoverride · cancel/invalid→nopost;validvalue+reason→updatedscore | PASS | — | SCORE-OVERRIDE-PROMPTS actualUI/API |
| F23 | Reopen · cancel/blank→nopost;reason→CLOSED/successupdated | PASS | — | SCORE-REOPEN-PROMPTS actualUI/API |
| F24 | Ownfinal/privacy score · unfinalized→hidden;finalgroup4→visible;group3→privacyhidden | PASS | — | SCORE-BEFORE-FINALIZE/VISIBLE/PRIVACYทุก6; detailedvisualgapUI-007 |
| F25 | CSVplain/identified/failure · downloadprivacyCSV→identitycancel/blank/reason→file/audit;401 | FAIL | export401sessionstateและmenuEscape · AUTH-001 P3 / A11Y-004 P3 | BROWSER-CSV-DOWNLOADSผ่านfilenames/header/content/privacy; injection401FAIL |
| F26 | Role/crossroomauthorization · notmember404/wrongrole403;correctcapabilityallowed | PASS | — | 130suiteAPIacceptance+4roleUIvisibility; notexhaustivebrowserURL×rolepermutations |
| F27 | Loading/error/recovery/runtime · sessionpending/retry,formerrors,assets/fonts,networkfail/recovery | FAIL | offlinependingrecoveryGAP-008; realOAuthenvironmentBLOCKED | NoJSpageerrors/brokenimages; everyfetch500/timeout/lateout-of-orderresponseNOTTESTED |
| F28 | Unknownroute · unknownURL→replacehome | PASS | — | UNKNOWN-ROUTEทุก6viewports |

## Figma-onlyflowfamilies

| Issue | Flow | Execution result | Evidence status |
|---|---|---|---|
| GAP-001 | Notification center / badge | BLOCKED · noimplementationentrypoint | Implementation absence confirmed from source and Figma frame inventory; exact unexported frame layout Not Verified |
| GAP-002 | Appeal entry / form / receipt / teacher response | BLOCKED · noimplementationentrypoint | Missing implementation confirmed; score-entry and success references visually inspected. Form layout details Not Verified |
| GAP-003 | Archive / delete / restore controls | BLOCKED · noimplementationentrypoint | Implementation absence confirmed from source and Figma frame inventory; exact unexported frame layout Not Verified |
| GAP-004 | Import preview / change role / withdraw | BLOCKED · noimplementationentrypoint | Implementation absence confirmed from source and Figma frame inventory; exact unexported frame layout Not Verified |
| GAP-005 | Editable multiple criteria / artifact metadata | BLOCKED · noimplementationentrypoint | Implementation absence confirmed from source and Figma frame inventory; exact unexported frame layout Not Verified |
| GAP-006 | Schedule / unpublish / extend / copy | BLOCKED · noimplementationentrypoint | Implementation absence confirmed from source and Figma frame inventory; exact unexported frame layout Not Verified |
| GAP-007 | Coverage / quality / response exclusion / identity audit | BLOCKED · noimplementationentrypoint | Implementation absence confirmed from source and Figma frame inventory; exact unexported frame layout Not Verified |
| GAP-008 | Durable pending answers / recovery | FAIL · injectedruntime | Runtime loss/recovery failure confirmed under injected network outage; Figma offline capability title verified, fullST24 visual layout Not Verified |

อีก8APIacceptancefamilies(assignmentvalidation,pairgeneration,accessisolation,comparisonpersistence,submissionidempotency,scoring/privacy/override,audittrail,CSVcontent) มีassertionsที่ผ่านใน130suite ไม่เพิ่มเป็น8browserflowPASS. Passwordsignup/reset/changeเป็นNOTAPPLICABLEเพราะระบบใช้Google; registrationคือimplicitfirst-loginไม่ใช่passwordform. Fullprivacyconsent/tutorial/mygroupframesที่mappingยังNotVerifiedไม่ได้ถูกอ้างว่าทดสอบผ่าน

Evidence: [runtime-summary.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/runtime-summary.json>) · [evidence/failure/checks.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/failure/checks.json>) · [130testtitles/sourceinventory](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/discovery.json>) · [evidence/verification.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/evidence/verification.json>)

Missingstepsที่ยังNOTTESTED: fullprototypehotspots191states,realOAuth,screenreader/crossbrowser,fullcalendargridkeyboard,drag-dropgesture,allnetwork500/timeout/out-of-orderconditions,allhover/focus/disabledvariantsและactualtouch/zoom. ไม่ได้ทำmutationกับproduction; syntheticfixturesถูกแยกDockerprojectpaireval-ui-auditจากpreviewผู้ใช้
