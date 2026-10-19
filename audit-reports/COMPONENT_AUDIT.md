# Component Audit

2026-10-19 ·29modules=23reachable+6unused; 5pagesแยกจากcomponentcount. Matchต้องมีreferenceและstatecomparisonจริง จึงไม่มีการเหมารวมว่าMatchเพียงเพราะใช้assetจากFigma. สถานะMismatchอิงissueส่วนNotVerifiedคือยังไม่ตรวจครบvisualvariants

| Component | Source | Figma status | Runtime / interactions | States / limits |
|---|---|---|---|---|
| ApiStatusBadge | [frontend/src/components/ApiStatusBadge.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ApiStatusBadge.tsx>) | Not Verified | FAIL · A11Y-002contrast | Readyhealthchecked; fullerror/loadingvariantvisualNotVerified |
| AppNav | [frontend/src/components/AppNav.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AppNav.tsx>) | Mismatch | FAIL keyboardA11Y-004; logoutPASS | 4roles×6menu/escape/logout; UI-009shell |
| AssignmentPanel | [frontend/src/components/AssignmentPanel.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AssignmentPanel.tsx>) | Mismatch | FAIL refreshFLOW-001; basiccreate/feas/publishPASS | AuthoringGAP-005/006; inlineworkspaceUI-003 |
| AssignmentScoringCard | [frontend/src/components/AssignmentScoringCard.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AssignmentScoringCard.tsx>) | Mismatch | FAIL menuA11Y-004/sessionAUTH-001; scoringcommandsPASS | Provisional/finalize/override/reopen/CSVactualeffectschecked; richreportsGAP-007 |
| AssignmentsToEvaluateCard | [frontend/src/components/AssignmentsToEvaluateCard.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/AssignmentsToEvaluateCard.tsx>) | Mismatch | FAIL refreshFLOW-001; entrylinksPASS | StudentdashboardUI-004; finalizedlinkasserted |
| ClassroomCreateForm | [frontend/src/components/ClassroomCreateForm.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ClassroomCreateForm.tsx>) | Not Verified | PASS create/validation/cancel/keyboard | Dialogdefault/focus6sizes; fullFigma397:2012layoutNotVerified |
| ComparisonDemo | [frontend/src/components/ComparisonDemo.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonDemo.tsx>) | Not Verified | NOT APPLICABLE · unused source | ไม่มีpathจากentry; ไม่ใช่หน้า/flowจริงและไม่นับMissing |
| ComparisonRow | [frontend/src/components/ComparisonRow.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ComparisonRow.tsx>) | Mismatch | FAIL EVAL-001/GAP-008/A11Y-005 | Default/selected/hover/focus/saved/error/read-only; all6sizes; UI-005/006 |
| CtaBand | [frontend/src/components/CtaBand.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/CtaBand.tsx>) | Mismatch | PASS abouttoggle/content; UI-001 | SecondaryGISrealpopupBLOCKEDbyorigin |
| DashboardPreview | [frontend/src/components/DashboardPreview.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/DashboardPreview.tsx>) | Not Verified | NOT APPLICABLE · unused source | ไม่มีpathจากentry; ไม่ใช่หน้า/flowจริงและไม่นับMissing |
| DeadlinePicker | [frontend/src/components/DeadlinePicker.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/DeadlinePicker.tsx>) | Not Verified | FAIL focusA11Y-007; month/cancel/tomorrow/time/applyPASS | Calendargridallkeys/outside/mobilepositionvariantsNOTTESTED |
| Dropdown | [frontend/src/components/Dropdown.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/Dropdown.tsx>) | Not Verified | PASS sortkeyboard/filter; timezoneused | Default/open/selected/Arrow/Enter; allHomeEnd/outside variantsnotexhaustive |
| FeatureGrid | [frontend/src/components/FeatureGrid.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/FeatureGrid.tsx>) | Not Verified | NOT APPLICABLE · unused source | ไม่มีpathจากentry; ไม่ใช่หน้า/flowจริงและไม่นับMissing |
| GoogleSignInButton | [frontend/src/components/GoogleSignInButton.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/GoogleSignInButton.tsx>) | Not Verified | PASS GISmockcontract; realOAuthBLOCKED | 40pxorangelabelisuseroverride; realaccountchooser/cancelnotexecuted |
| Hero | [frontend/src/components/Hero.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/Hero.tsx>) | Mismatch | PASS navigation/assets; UI-001visual | CTAactualguard/anchorchecked; sessioncopycoveredbysourceonly |
| icons | [frontend/src/components/icons.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/icons.tsx>) | Not Verified | PASS loadedlogofile; noall-iconsemanticcomparison | 45exports=44inlineicons+LogoMark; alldecorativeglyphversionsnotcompared |
| InstructorReport | [frontend/src/components/InstructorReport.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/InstructorReport.tsx>) | Not Verified | NOT APPLICABLE · unused source | ไม่มีpathจากentry; ไม่ใช่หน้า/flowจริงและไม่นับMissing |
| MemberPanel | [frontend/src/components/MemberPanel.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/MemberPanel.tsx>) | Not Verified | PASS basicstaffadd/removevalidationassertions | Advancedroleedit/withdrawnotimplementedGAP-004 |
| PersonaCards | [frontend/src/components/PersonaCards.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/PersonaCards.tsx>) | Not Verified | NOT APPLICABLE · unused source | ไม่มีpathจากentry; ไม่ใช่หน้า/flowจริงและไม่นับMissing |
| ProcessFlow | [frontend/src/components/ProcessFlow.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/ProcessFlow.tsx>) | Mismatch | PASS guidespointer/Enter; UI-001spacing | 3guideopen/closeactualcontent+link |
| RequireSession | [frontend/src/components/RequireSession.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/RequireSession.tsx>) | Not Verified | PASS guard/401/retry/raceassertions | No-token4routes×6; failclosed; cross-taballpermutationsnotexhaustive |
| RosterImportCard | [frontend/src/components/RosterImportCard.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/RosterImportCard.tsx>) | Mismatch | PASS imports/sample/fileclear/reselect | UI-003focusedmemberscomposition; dragdropgestureNOTTESTED; advancedpreviewGAP-004 |
| RosterTable | [frontend/src/components/RosterTable.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/RosterTable.tsx>) | Mismatch | PASS search/pages/removal; realkeyboard6cases | Axe scrollwarningถอนหลังnativeTab/Arrowผ่าน; advancedrole/withdrawGAP-004 |
| SetupStepper | [frontend/src/components/SetupStepper.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/SetupStepper.tsx>) | Mismatch | FAIL · FLOW-002 | Publishedjobstillcurrentall6; FigmafocusedoverviewUI-003 |
| SetupSummary | [frontend/src/components/SetupSummary.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/SetupSummary.tsx>) | Not Verified | PASS valuesrendered/defaults; fullvariantsNotVerified | Source/tracedrender6sizes; notallformcombinationasserted |
| SiteFooter | [frontend/src/components/SiteFooter.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/SiteFooter.tsx>) | Mismatch | PASS actualanchortargets; UI-001 | APIready/errorstylingA11Y-002 |
| SiteNav | [frontend/src/components/SiteNav.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/SiteNav.tsx>) | Mismatch | FAIL · A11Y-001; visualUI-001 | Guestanchors/noticechecked; signed-inhomevariantsNotVerified |
| TrustRow | [frontend/src/components/TrustRow.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/TrustRow.tsx>) | Not Verified | NOT APPLICABLE · unused source | ไม่มีpathจากentry; ไม่ใช่หน้า/flowจริงและไม่นับMissing |
| Ui | [frontend/src/components/Ui.tsx](<C:/Users/SSX/Documents/GitHub/sdpx-arai/frontend/src/components/Ui.tsx>) | Not Verified | Renderedsharedstates; contrastissuesnotblanketPASS | Fullallvariantsnotverified; sampleFigmaButtonpropertiesinfigma-inventory |

Unused6:ComparisonDemo,DashboardPreview,FeatureGrid,InstructorReport,PersonaCards,TrustRow. InstructorReportมีตัวอย่างในsourceไม่ได้แปลว่ารายงานคุณภาพจริงพร้อมใช้; ไม่ดึงmockdataขึ้นproductionเพื่อปิดgap

## Figma components / missing components

มี41mastersและButton24variantnamesใน [FIGMA_SCREEN_INVENTORY.md](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/FIGMA_SCREEN_INVENTORY.md>). ยังไม่ได้ตรวจค่าภาพทุกvariant. Missingnotification/appeal/roomlifecycle/preview/criteriaeditor/report/offlinecomponentsอ้างGAP-001ถึง008; read-onlyframeinventoryไม่ใช่runtimePASS

## State coverage

Default/open/selected/hover/focus/saved/error/readonlyของevaluationมีcaptures; modalcreatefocus/Escapeครบ6; menuEsc/radio/tabkeysถูกprobeจริง; uploadatomicerrors/basicformvalidationมี130suite; scoringpromptscancel/blank/invalid/successและbrowserdownloadตรวจผลAPI/DOMจริง. ส่วนทุกbuttonloadingstate,allinputblurerrors,alltooltips/skeletons,allhover/focus/disabledvaluesและlongcontentcombinationsยังNOTTESTED/NotVerified

## Architecture / tokens / forms

Reactlocalstate+typedfetch;ไม่มีquerycachelibrary,ไม่มีErrorBoundaryที่พบ. RequireSessionอ่านsessionด้วยuseSyncExternalStoreและตรวจ/api/meก่อนmount. Assignment/scorecomponentsfetchแยกกันทำให้FLOW-001; childchoiceที่parentไม่รู้ทำให้EVAL-001. Validationใช้nativeconstraints+domainweightchecks+structuredApiError/Banner; frontendshowsไทย. รายละเอียดAPI/state/loading/empty/error/success/breakpointsและsymbolsทุกตัวอยู่ [discovery.json](<C:/Users/SSX/Documents/GitHub/sdpx-arai/audit-reports/discovery.json>)

Tailwindbreakpoints640/768/1024/1280/1536และbrand≤420; evaluationgrid3→6ที่sm. FontsIBMPlexSansThai/NotoSansThai/IBMPlexMonoโหลดผ่านGoogleFonts; runtimefontfacesโหลดจริงแต่fullFigmafontstyleequivalenceNotVerified. CSSvariablelistอยู่discoveryและcomputedCSSในruntime. Inlinehardcodedcomparisoncolors/gradientยังมี; ไม่สร้างtokenmismatchจากชื่อหรือhexที่ไม่ได้เทียบจริง

Finalsourcecandidatesถูกยืนยันแล้ว:DISC-001→EVAL-001,DISC-002→FLOW-001/002,DISC-003→A11Y-001,DISC-004→A11Y-004/005/006,DISC-005→AUTH-001. ทั้งหมดนับตามcentralIDsเท่านั้น
