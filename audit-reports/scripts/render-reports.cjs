const fs=require('node:fs')
const path=require('node:path')
const root=path.resolve(__dirname,'..')
const repo=path.resolve(root,'..')
const issues=require('./issue-catalog.cjs')
const runtime=JSON.parse(fs.readFileSync(path.join(root,'runtime-summary.json'),'utf8'))
const figma=JSON.parse(fs.readFileSync(path.join(root,'figma-inventory.json'),'utf8'))
const failure=JSON.parse(fs.readFileSync(path.join(root,'evidence/failure/checks.json'),'utf8'))
const discovery=JSON.parse(fs.readFileSync(path.join(root,'discovery.json'),'utf8'))
const absolute=p=>path.resolve(root,p).replaceAll('\\','/')
const link=(p,label=p)=>`[${label}](<${absolute(p)}>)`
const source=p=>{const m=p.match(/^(.*):(\d+)$/);return `[${p}](<${path.resolve(repo,m?m[1]:p).replaceAll('\\','/')}${m?':'+m[2]:''}>)`}
const frame=n=>{const item=[...figma.screens,...figma.masters].find(s=>s.node===n);return `[${item?item.name+' · ':''}${n}](https://www.figma.com/design/vr38E4BOnEqgAXdwTXe80W/PairEval?node-id=${n.replace(':','-')})`}
const esc=s=>String(s??'—').replaceAll('|','\\|').replaceAll('\n',' ')
const write=(file,text)=>fs.writeFileSync(path.join(root,file),text)
const counts=Object.fromEntries(['P0','P1','P2','P3','P4'].map(p=>[p,issues.filter(i=>i.severity===p).length]))
write('issues.json',JSON.stringify({dateLocal:'2026-10-19',counts,definition:'28 deduplicated findings:20 observed functional/accessibility/visual findings plus8 capability gaps. A11Y-003 retired after real-keyboard verification; raw axe alert retained as reviewed false positive in Chromium. Exact unseen Figma layouts and untested flows remain Not Verified; absence of implementation is source-confirmed.',issues},null,2))
function detail(i){
 return `<a id="${i.id.toLowerCase()}"></a>\n\n## ${i.id} · ${i.severity} · ${i.component}\n\n`+
 `- Type: ${i.type} · Page: ${i.page} · Route: \`${i.route??'ไม่มีimplementation/entrypoint'}\`\n`+
 `- Result: ${i.status} · Evidence level: ${i.verification}\n`+
 `- Figma frame/node: ${i.frames.map(frame).join(', ')}\n`+
 `- Expected: ${i.expected}\n- Actual / exact difference: ${i.actual}\n`+
 `- Token / layout value: ${i.token}\n- Source: ${i.sources.map(source).join(', ')}\n`+
 `- Evidence: ${i.evidence.map(e=>link(e)).join(', ')}\n\n`+
 `ตรวจซ้ำ:\n\n${i.repro.map((step,n)=>`${n+1}. ${step}`).join('\n')}\n\n`+
 `แนะนำ: ${i.fix}\n\nDependencies: ${i.dependencies} · Complexity: ${i.complexity}${i.rootCause?' · Root cause: '+i.rootCause:''}${i.wcag?'\n\nAccessibility criterion/pattern: '+i.wcag:''}\n\n`
}
const routeRows=[
 ['/', 'HomePage','SiteNav / SiteFooter','Public','175:3','PASS','FAIL · UI-001 / A11Y-001/002'],
 ['/classrooms','ClassroomsPage','RequireSession / AppNav','Authenticated; membership list','349:2388, 77:1086, 516:825','PASS','FAIL · UI-002/009'],
 ['/classrooms/:classroomId','ClassroomDetailPage','RequireSession / AppNav','OWNER / CO_TEACHER / TA / STUDENT','330:1914, 330:1057, 268:6135, 516:923','PASS ทุก4roles','FAIL Owner/Student · UI-003/004; Co-teacher/TA full-frame visual Not Verified'],
 ['/classrooms/:classroomId/assignments/:assignmentId/evaluate','EvaluatePage','RequireSession / AppNav','Member / assigned evaluator; API enforces mutation','57:3, 516:996','PASS','FAIL · EVAL-001/002, UI-005/006'],
 ['/classrooms/:classroomId/assignments/:assignmentId/score','ScorePage','RequireSession / AppNav','Own score; finalized/privacy rules','60:437, 60:606, 516:1322','PASS','FAIL · UI-007/008; final/privacy functional checks PASS'],
 ['*','Navigate /','Redirect','Public','NOT APPLICABLE','PASS','NOT APPLICABLE'],
]
let routes='# Route Inventory\n\n2026-10-19 · 5 concrete routes +1fallback. ทุกrouteเปิดจริงและมีผลที่ทุก6ขนาดจอ; runtime PASSหมายถึงเข้าหน้า/guard/role stateได้ ไม่ได้รับรองflowหรือFigmaทั้งหมด\n\n| Route | Page | Layout | Login / role | Figma reference | Runtime | Audit status |\n|---|---|---|---|---|---|---|\n'
routes+=routeRows.map(row=>'| '+row.map(esc).join(' | ')+' |').join('\n')+'\n\n'
routes+='Classroomใช้hashsections #overview/#members/#assignments/#scores ไม่ใช่4routesแยก มี5page modules,29component modules(23reachable/6unused),45icon-module exports(includingLogoMark). React19/ReactRouter7/Tailwind4/Vite8, localstate/useSyncExternalStore session, typedfetchAPI; fullversions/forms/API/state/token/sourceinventoryอยู่ '+link('discovery.json')+'\n\n'
routes+='Coverageของroute statesและscreenshots: '+link('runtime-summary.json')+'; Figma bidirectional mapping191frames: '+link('FIGMA_SCREEN_INVENTORY.md')+'. Loading/empty/error/successหลายstatesมีassertionsใน130suiteและauditเพิ่มเติม แต่ไม่มีการรับรองทุกpermutationของทุกcomponent\n'
write('ROUTE_INVENTORY.md',routes)

let visual='# Figma Mismatch Report\n\nรายงานหลัก · 2026-10-19 · AUDIT ONLY\n\n'
visual+='ผล: ทุก5route familiesมีความต่างที่ยืนยันได้จากfreshreferenceและเว็บจริง ไม่มีการให้complianceเปอร์เซ็นต์ ชื่อ/คะแนน/จำนวนห้อง/วันที่จากsyntheticfixtureที่ไม่ตรงแบบไม่ถูกนับเป็นbug ตัวเลข191คือscreen/stateframesจาก7pages ไม่ใช่191URLs\n\n'
visual+='เทียบเต็มภาพcoreexports11frames:10framesมีเว็บให้เทียบ,1appealsuccessframeไม่มีimplementation. อีก180framesมีinventory/mappingครบแต่fullvisualเป็นNot Verified. Missingcapability59framesรวมเป็น8issuefamiliesเพื่อลดรายการซ้ำ; รายละเอียดlayoutของframesที่ไม่ได้exportยังNot Verified\n\n'
visual+='| Website page | Fresh reference | Confirmed differences |\n|---|---|---|\n'+[
  ['Home','175:3','UI-001'],['Classroom list','349:2388 / 516:825','UI-002, UI-009'],['Classroom detail','330:1914 / 330:1057 / 516:923','UI-003, UI-004, UI-009'],['Evaluation','57:3 / 516:996','UI-005, UI-006, UI-009'],['Own score','60:437 / 516:1322','UI-007, UI-008, UI-009'],
].map(r=>'| '+r.map(esc).join(' | ')+' |').join('\n')+'\n\n'
visual+='## วิธีเทียบและข้อยกเว้น\n\n'
visual+='Playwright Chromium, th-TH, Asia/Bangkok,100%zoom,DPR1,productionbuild; รอdocument.fonts.ready/images และเก็บviewport+fullpage. เพิ่ม390pxให้ตรงStudent mobileFigma พร้อมfixture3GROUP+2INDIVIDUALcriteria/max15+5เพื่อไม่สับสนว่ารายละเอียดที่หายเพราะdataset\n\n'
visual+='Pixelmatchใช้guesthome1440pxเท่านั้น: Figma1440×1870,เว็บ1440×1948; top-alignและpadด้านล่างด้วยpaperโดยไม่resize, threshold0.1/ignoreantialiasing. ได้235250differentpixelsบนcanvas2805120pixels(พื้นที่ทับกัน234892/2692800). นี่คือrawdiagnostic ไม่ใช่compliance scoreและไม่ใช่235250bugs; ตรวจภาพแล้วแยกgeometryจริงออกจากfont rasterization,extra healthbadgeและuseroverride. '+link('evidence/comparison/home-1440.json')+' · '+link('evidence/comparison/home-1440-diff.png')+' · '+link('evidence/comparison/home-1440-overlay.png')+'\n\n'
visual+='หน้าที่มีdynamicdataใช้unscaledside-by-side ไม่คำนวณpixelmismatchตัดสินbug: '+link('evidence/comparison/boards.json')+'. Stickyfooterอาจปรากฏกลางfull-pagescreenshotที่ตำแหน่งviewportเดิม ให้ดูviewportPNGประกอบ ไม่อนุมานเป็นoverlap defect\n\n'
visual+='ข้อยกเว้น: ปุ่มGoogleสีส้ม40px/ข้อความเข้าสู่ระบบด้วยGoogleเป็นคำสั่งผู้ใช้ที่มาก่อนaudit จึงไม่เรียกmismatchกับFigmaโดยไม่มีบริบท. ST30มี15/15,p1.00แต่barเติมเพียงบางส่วน และST20selectedcircle/answercaptionไม่สอดคล้องกัน ต้องยืนยันdesignก่อนลอก; ไม่เปลี่ยนlogicที่ถูกเพื่อให้เหมือนภาพที่ขัดแย้ง\n\n'
visual+='## Tokens / components ที่ตรวจค่าได้\n\n'
visual+='Figma175:3: flowVertical,width1440,heightHug1870,surface/paper#FFFCF7. SecondaryMDDefault121:284: width212,height50,radius999,border1,padding12×24,gapspace/2,fillwhite,borderreference/neutral-border#C9C0B9. Buttonmasterมี3styles×2sizes×4states=24variants. ค่าของvariantอื่น/fonts/styles/effects/gridsทั้งหมดไม่ถูกเหมารวมว่าMatch; fulltokenAPIexportไม่มีในview-onlytoolที่เชื่อมอยู่\n\n'
visual+='RuntimeH1home64px/700/line78.08,color#321007,CTA#B84204,bodyNotoSansThai/displayIBMPlexSansThai/monoIBMPlexMono; fontfilesloadedและไม่มีbrokenimageใน206captures. Sharedbtnmd44px/border#E4CCBAต่างจากsamplemaster50px/#C9C0B9 แต่ต้องเทียบconsumer/variantก่อนนับเป็นglobaldefect; ไม่ใช้ตัวอย่างmasterบังคับทุกปุ่ม. รายการCSStokensทั้งหมดอยู่ '+link('discovery.json')+' และค่าcomputedอยู่ '+link('runtime.json')+'\n\n'
visual+=issues.filter(i=>i.id.startsWith('UI-')).map(detail).join('')
visual+='## Missing capabilities / screen states\n\nรายการต่อไปนี้เป็นimplementationgapที่ยืนยันจากframeinventoryและabsenceในsource ไม่ใช่การอ้างว่าทุกunexportedframeผ่านvisualinspection รายละเอียดภายในและprototypeflowที่ยังไม่ได้เดินจริงระบุNotVerifiedไว้ ต้องอ่านframeเต็มเมื่อแตกimplementationtask\n\n'
visual+=issues.filter(i=>i.id.startsWith('GAP-')).map(detail).join('')
visual+='## Website → Figma ที่ยังไม่มีreferenceชัด\n\nAuthretry/error Banners,sortlistboxบางstate,healthstatusbadgeและwildcardredirectไม่มีfreshdedicatedreferenceที่จับคู่ได้: NotVerified/NOTAPPLICABLEตามชนิด ไม่เรียกMissingFigmaโดยเดา. Co-teacher/TA runtimeตรวจครบแต่full-framepixel/layoutcomparisonยังNotVerified ต่างจากOwner/Studentที่มีfreshPNG\n'
write('FIGMA_MISMATCH_REPORT.md',visual)

let functional='# Functional and Accessibility Issues\n\n2026-10-19 · ใช้isolatedsyntheticDB ไม่แตะข้อมูลผู้ใช้ที่127.0.0.1:5173. PASSของaudit runnerหมายถึงเก็บobservationสำเร็จ ส่วนproductresultอ่านPASS/FAILในJSON\n\n'
functional+='ExistingE2E130ผ่าน; auditมีruntimechecks284รายการ(PASS234/FAIL50) และadditionalinteractionchecks16รายการ(PASS8/FAIL8),รวม300checksที่dedupeid+stateแล้ว พร้อมrealkeyboardreviewเสริม6กรณี การเกิดซ้ำข้ามroles/viewportsไม่สร้างissueซ้ำ. Appissues28รายการรวมvisualและ8capabilitygapsแยกกันใน '+link('issues.json')+'\n\n'
functional+=issues.filter(i=>!/^(UI|GAP)-/.test(i.id)).map(detail).join('')
functional+='## Offline retention\n\nGAP-008เป็นทั้งช่องว่างจากFigmaและfailureที่ยืนยันด้วยnetworkinjection: serverchoiceยังnullหลังrecoverและreloadทำให้selectionหาย อ่านรายละเอียดใน '+link('FIGMA_MISMATCH_REPORT.md','GAP-008')+' โดยนับissueครั้งเดียว\n\n'
functional+='## สิ่งที่ผ่านและข้อจำกัด\n\n'
functional+='Authguardทั้ง4protectedroutes,serververification/401race/retryตามassertionsเดิม,4roles,logout,create/cancel/validation,search/sort/filter,CSVvalid/atomicinvalid/sample/reselect,rosterpagination/removalcancel+confirm,feasibility/publishbasic,autosaveเมื่อรอจนสำเร็จ,recompute/provisional/finalize/override/reopen,CSVprivacy/identityและownscoreprivacychecksผ่าน. การผ่านส่วนหนึ่งไม่ลบfailureในส่วนอื่นของflowเดียวกัน\n\n'
functional+='Runtimeไม่มีpageerror/unhandledJSexceptionหรือbrokenimageจากcaptures206รายการ; third-partyGISมี403/origin-not-allowed/CORSstyleที่http://localhost:8080ในisolatedauditstack จึงบันทึกGoogleOAuthจริงเป็นBLOCKEDในenvironmentนี้ ไม่เหมารวมว่า127.0.0.1:5173เสีย. Logincontractในsuite130ใช้GISdouble; realGooglecredentials/accountchooser/domainpolicyไม่ได้ทดสอบใหม่ และไม่signoutบัญชีผู้ใช้\n\n'
functional+='Layout-shiftที่วัดสูงสุด0.1732245ในTAclassroomlist375px เป็นsingle-lab observationแบบcumulativeต่อpage; ยังไม่มีtraceattribution/repeatedbaseline/fielddata จึงระบุNeedsprofilingและไม่สร้างperformancebugจากตัวเลขเดียว. Unexpectedrerenderprofiling,screenreaderและcross-browserยังNOTTESTED. Frontendlintไม่มีerrorแต่ยังมีReacteffect/purity/dependencywarnings ไม่ใช่หลักฐานrerenderregressionด้วยตัวเอง\n\n'
functional+='เกณฑ์contrastอ้างอิง [WCAG1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html); keyboardfunctionalityอ้างอิง [WCAG2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html). รูปแบบ [RadioGroup](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) และ [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) เป็นAPGguidance: การขาดArrow/Escapeเพียงอย่างเดียวไม่เท่ากับพิสูจน์WCAGkeyboardfailureทุกกรณี. Axe4.14ตรวจtagswcag2a/2aa/21aa/22aaทุก206captures พบ3rulesดิบ; scrollable-region-focusableทั้ง6role/widthกรณีถูกยืนยันว่าfalsepositiveในChromium: Tabเข้าถึงwrapperได้แม้tabIndex=-1และArrowRightเลื่อน40pxจริง. A11Y-003จึงถอนจากissuecount; browserอื่นยังNOTTESTED. หลักฐาน '+link('evidence/visual/roster-keyboard.json')+'. Incomplete/manualchecksอยู่rawJSON ไม่รับรองWCAGconformanceจากaxePASSเพียงอย่างเดียว\n'
write('FUNCTIONAL_ISSUES.md',functional)

let responsive='# Responsive Issues\n\n2026-10-19 · 5routesทุก6viewportsและ4classroomroles. เพิ่มStudent390pxเพื่อเทียบFigmaโดยตรง ไม่resize375/430ให้ปลอมว่าเป็น390\n\n'
responsive+='| Viewport | Captured states | Document overflow | Broken images | Exact Figma reference |\n|---|---:|---|---|---|\n'+runtime.viewports.map(v=>`| ${v.width}×${v.height} | ${v.observations} | PASS · ไม่พบ>1px | PASS | ${v.width===1440?'Desktopcoreframes; heightขึ้นกับpage':'ไม่มีexactwidthที่verified; Studentmobile390ใช้เทียบเสริม'} |`).join('\n')+'\n\n'
responsive+='34commonstates×6=204 บวก2submissionreproductions1440=206 แต่ละcaptureมีfullและviewportรวม412PNG. Commonstatesประกอบด้วยhome3,4roles×5list/menu/search/detailstates=20,create-dialog1,evaluation7,score3. Screenshotindexอยู่ '+link('EVIDENCE_INDEX.md')+'\n\n'
responsive+='| Issue | Page / viewport | Observation | Evidence |\n|---|---|---|---|\n'+[
 ['UI-006','Evaluate375/390/430','3×2circlegridต่างจาก6verticaloptionsของM04', 'evidence/comparison/evaluation-mobile-side-by-side.png'],
 ['UI-002','Classrooms390','Studentใช้desktopmanagementcontrolstack; search/card/headerต่างM01','evidence/visual/student-classrooms-390.png'],
 ['UI-004','Studentclassroom390','welcome+rosterแทนassignmentstatusdashboardของM03','evidence/comparison/student-classroom-mobile-side-by-side.png'],
 ['UI-009','Protectedheader≤420','ซ่อนPairEvalwordmarkต่างfreshmobileframes','evidence/visual/student-classrooms-390.png'],
 ['A11Y-001','Home375','Brandlinkไม่มีaccessible nameเมื่อข้อความซ่อน','evidence/runtime/home-guest-375x812-viewport.png'],
 ['AXE-REVIEW (ไม่ใช่issue)','Roster375/430 · Co/TA/student','TabและArrowRightผ่านจริงทั้ง6; ถอนA11Y-003ซึ่งเป็นaxe falsepositiveในChromium','evidence/visual/roster-keyboard.json'],
].map(([id,p,o,e])=>`| ${id} | ${p} | ${o} | ${link(e)} |`).join('\n')+'\n\n'
responsive+='Nativecreate-dialogที่375/430เปิดได้ในviewport,autofocus/Escape/returnfocusผ่าน; sortingkeyboardและsearchemptyผ่านทุกrole/viewport. Horizontalclassroomsectionpills/rostertableที่ตั้งใจเลื่อนภายในไม่ใช่documentoverflowโดยอัตโนมัติ ไม่พบหลักฐานimagebreakหรือpagewidehorizontalscrollในmatrixนี้\n\n'
responsive+='ตัวตรวจtarget24พบ4patterns:inputfile1×1เป็นsr-onlyที่มีdropzonelabel,assignmenttextlink66×20และcontextlinks88×19.5/72×19.5. ยังต้องตรวจspacing/inlineexceptionของแต่ละplacement จึงเป็นREVIEW ไม่ใช่automaticWCAG2.5.8failure และไม่รวมใน28issues. [WCAGTargetSizeMinimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) มีข้อยกเว้น/spacingcriteria ไม่ใช่กฎ44pxทุกcontrol\n\n'
responsive+='FigmaStudentมีM01–M09ที่390pxเท่านั้นที่verifyได้; mobileOwner/Co-teacher/TA,tablet768,laptop1366,wide1920ไม่มีverifiedexactdesignvariant จึงให้ผลusabilityที่ตรวจจริงและแยกFigmaNotVerified. Landscape/orientationchange,200%/400%zoom,virtualkeyboardและactualtouchdevicesยังNOTTESTED\n'
write('RESPONSIVE_ISSUES.md',responsive)

const order=['EVAL-001','EVAL-002','FLOW-001','AUTH-001','A11Y-001','A11Y-002','A11Y-004','A11Y-005','A11Y-006','A11Y-007','FLOW-002','GAP-005','UI-005','UI-006','UI-003','UI-004','UI-002','UI-007','GAP-002','GAP-008','GAP-001','GAP-004','GAP-006','GAP-007','GAP-003','UI-009','UI-001','UI-008']
let priority='# Fix Priority\n\n2026-10-19 · เป็นแผนเสนอจากaudit ไม่มีการแก้application code. S=localcomponent/smallstate, M=sharedstate/multiplecomponents, L=domain/API/multipageflow; ไม่ใช่คำรับรองเวลาส่งมอบ\n\n'
priority+='เริ่มsavecoordinationที่ทำคำตอบตกหล่นก่อน ตามด้วยdeadline/refresh/sessionและaccessibility จากนั้นทำcriteria/artifactcontracts,roleworkspacesและคะแนน จึงขยายnewcapabilitiesตามFigma. ต้องอ่านfullframesของcapabilitygapsก่อนลงรายละเอียดUI ไม่ใช้ชื่อframeแทนrequirementsครบชุด\n\n'
priority+='| Order | Issue / severity | Impact / affected pages | Root cause / recommended fix | Dependencies | Complexity |\n|---:|---|---|---|---|---|\n'
priority+=order.map((id,n)=>{const i=issues.find(x=>x.id===id);return `| ${n+1} | ${id} · ${i.severity} | ${esc(i.page+': '+i.actual)} | ${esc((i.rootCause?i.rootCause+'. ':'')+i.fix)} | ${esc(i.dependencies)} | ${i.complexity} |`}).join('\n')+'\n\n'
priority+='## Frontend / Backend / tests ที่ต้องทำต่อ\n\n| Workstream | Frontend | Backend / contract | Verification ที่ควรเพิ่ม |\n|---|---|---|---|\n'+[
 ['Answer lifecycle','Sharedpendingchoice,flush/await,tabnavigation,clock/offlinequeue','รักษาdeadline/idempotency;พิจารณาack/versionสำหรับrecovery','UI-select→submitทันที/หลังsave,side-switch,networkfail/reorder/reload,deadlineboundary'],
 ['Management state','Invalidateassignmentlists,deriveSetupStepper','BasicAPIsเดิมใช้ได้','UIcreate→publish→siblings/stepsupdatedไม่reload'],
 ['Designsystem / accessibility','RoleNav,mobileverticalradio,labels/contrast/focus/menu/tabs','ไม่มีschemachangeจำเป็น','axe+keyboardจริง+6viewports+390reference,allwidgetstates'],
 ['Assignment authoring','Multiplecriterialists,descriptions/artifactfields,weight/errors','criteriaAPIมีแล้ว;artifactperitem/metadataต้องขยาย','draftonly,100%ต่อside,edit/removal,artifactmapping/privacy'],
 ['Score / appeal','Realbreakdown/max/date/counts+appealforms/status','MyScoreOut/OpenAPI+privacyfilter;appealmodel/submit/respond/audit','finalized/unfinalized/smallcohort,criterion/maxmath,appealauth/validation/history'],
 ['AdvancedFigmafeatures','Notifications,roomlifecycle,rosterpreview/withdraw,scheduledwork,qualityreports','Newdomaincommands/schema/permission/audit/contractsตามแต่ละfeature','Atomicity,role/crossroomaccess,rollback,clock,pairreassignment,privacy'],
].map(r=>'| '+r.map(esc).join(' | ')+' |').join('\n')+'\n\n'
priority+='คงWS-08securityregressionsและserverpermissionsไว้ ระหว่างปรับlayoutอย่าเปิดคะแนน/identityที่privacyซ่อน และอย่าทำmockdataให้ดูเหมือนfeatureทำงาน. หากต้องเพิ่มdependencyหรือเปลี่ยนstackในimplementationรอบหน้าให้ทำตามAGENTS.md; auditนี้เพิ่มaxeเฉพาะ.localตามที่ผู้ใช้อนุญาตแล้ว\n'
write('FIX_PRIORITY.md',priority)

// The final flow matrix distinguishes bounded assertions from remaining sub-state gaps.
const flows=[
 ['F01','Landing / anchors / guides / about','เปิดhome→anchors/footertargets→3guides→abouttoggle→guestCTAloginnotice','PASS','—','HOME-GUIDE/HOME-ANCHORS-ABOUT-CTA; realGoogleแยกF02'],
 ['F02','Googlelogin / firstaccount','SDKbutton→chooser→credential→appsession→verifiedclassrooms','BLOCKED','RealGoogle: isolated8080originไม่อยู่ในallowedorigins','130suiteGIScontractmockผ่าน; realcredentials/chooser/cancel/domainไม่ได้ทดสอบใหม่'],
 ['F03','Logout','4roles→account→logout→tokenremoved→home','PASS','—','LOGOUTทุก6viewports; menukeyboardมีA11Y-004แยก'],
 ['F04','Protectedroutes/session','4directroutesguest→home;serververify/401/retry/oldtokenrace','PASS','—','AUTH-GUARDทุก6; login.specassertionsใน130suite'],
 ['F05','Classroomcreate/cancel/validate','dialog→name/timezone→create/list;empty/duplicate→error;Escape→focus','PASS','—','130suiteclassrooms/design; CREATE-MODAL-KEYBOARDทุก6'],
 ['F06','Search/filter/sort','ค้นหา→actualresult/empty→clear;role/statusfilters;Arrow/Enter sort','PASS','—','CLASSROOM-SEARCH/SORTทุก4roles×6 +designsuitefilterassertions'],
 ['F07','Rolepage/navigation','4roles→correcttools→hashsectiontarget→back/logout','PASS','—','Rolematrix+hashchecks; scrolloffsetทุกedge/longnamesยังNOTTESTED'],
 ['F08','RosterCSVimport/sample/reselect','sample→pick/remove/reselect→uploadvalid/invalid→atomicresult/refresh','PASS','—','CSV-PICKER-SAMPLE+130suite; actualdrag-dropgestureยังNOTTESTED'],
 ['F09','Rostersearch/pages/remove','filter/empty→clear→page2→removecancel/confirm→API/UIupdated','PASS','—','ROSTER-SEARCH-PAGINATION/ROW-REMOVE'],
 ['F10','Staffmembers','email/role→add/error→remove→refresh;permissiondenial','PASS','—','130suitemembersUI+API; fullFigmaadvancedrole/withdrawแยกGAP-004'],
 ['F11','Deadlinepicker','monthprev/next→pending→cancel/tomorrow/24h→Enterapply→Escape','FAIL','Escapeไม่คืนfocus · A11Y-007 P3','CALENDAR-INTERACTIONSผ่าน; keyboardcalendarทุกday/HomeEndยังNOTTESTED'],
 ['F12','Assignmentdraft/authoring','กรอกงาน/weights/deadline→draft;invalidweights→block','FAIL','หลายcriteria/artifacteditorตามแบบไม่มี · GAP-005 P2','Basiccreate+invalidweight130suiteผ่าน; ใช้APIสร้างmultiplecriteriaได้จริง'],
 ['F13','Feasibility','draft→check→coverage/workload/reasons/lowanonymity','PASS','—','130suiteAPI+realUIfailureaudit'],
 ['F14','Publish→workspacerefresh','draft→publishsuccess→siblingentry/scoring/stepupdated','FAIL','siblings/stepไม่อัปเดต · FLOW-001 P2 / FLOW-002 P3','ASSIGNMENT-LIST-REFRESH/CLASSROOM-SETUP-STATE'],
 ['F15','Studentworkentry','publishedwork→evaluate;finalizedwork→score','PASS','—','130suiteevaluations/scoring +matrix; richdashboardแยกUI-004'],
 ['F16','Switchside','GROUP↔INDIVIDUAL→correctdata/pendingselectionpreserved','FAIL','pendinganswerหาย · EVAL-001 P1; tabkeysA11Y-006','EVALUATION-PENDING-SIDE-SWITCH; basictabclickผ่าน'],
 ['F17','Select/autosave/reload/recovery','6choices→2s→saving/saved→persist/reload;networkerror/recover','FAIL','offlinechoiceหาย · GAP-008 P2; radiokeysA11Y-005','AUTOSAVE-REAL-APIผ่านทุก6; failureinjectionยืนยันrecoverygap'],
 ['F18','Submitcomplete/partial/cancel','choose→saveorimmediate→confirmifincomplete→submittedcount','FAIL','POSTก่อนPUTและstaleunanswered · EVAL-001 P1','EVAL-001สองtimings; existingpartialcancel/idempotencyassertionsผ่าน'],
 ['F19','Deadlineboundary/read-only','เปิดก่อนdeadline→รอข้าม→inputsreadonly/submitgone','FAIL','pageไม่อัปเดตจนreload · EVAL-002 P2','EVALUATION-DEADLINE-LIVE; server409+expiredinitialviewผ่าน'],
 ['F20','Recompute/provisionalscore','owner→recompute→expand→newvalues/provisionallabel','PASS','—','130scoringsuite+failureauditfixtures'],
 ['F21','Finalize/lowconfidence','afterdeadline→warnconfirm→FINALIZED→ownscore','PASS','—','actualUIlowconfidenceconfirm+APIdeadlineguards; everycancel/errorpermutationไม่ครบ'],
 ['F22','Scoreoverride','cancel/invalid→nopost;validvalue+reason→updatedscore','PASS','—','SCORE-OVERRIDE-PROMPTS actualUI/API'],
 ['F23','Reopen','cancel/blank→nopost;reason→CLOSED/successupdated','PASS','—','SCORE-REOPEN-PROMPTS actualUI/API'],
 ['F24','Ownfinal/privacy score','unfinalized→hidden;finalgroup4→visible;group3→privacyhidden','PASS','—','SCORE-BEFORE-FINALIZE/VISIBLE/PRIVACYทุก6; detailedvisualgapUI-007'],
 ['F25','CSVplain/identified/failure','downloadprivacyCSV→identitycancel/blank/reason→file/audit;401','FAIL','export401sessionstateและmenuEscape · AUTH-001 P3 / A11Y-004 P3','BROWSER-CSV-DOWNLOADSผ่านfilenames/header/content/privacy; injection401FAIL'],
 ['F26','Role/crossroomauthorization','notmember404/wrongrole403;correctcapabilityallowed','PASS','—','130suiteAPIacceptance+4roleUIvisibility; notexhaustivebrowserURL×rolepermutations'],
 ['F27','Loading/error/recovery/runtime','sessionpending/retry,formerrors,assets/fonts,networkfail/recovery','FAIL','offlinependingrecoveryGAP-008; realOAuthenvironmentBLOCKED','NoJSpageerrors/brokenimages; everyfetch500/timeout/lateout-of-orderresponseNOTTESTED'],
 ['F28','Unknownroute','unknownURL→replacehome','PASS','—','UNKNOWN-ROUTEทุก6viewports'],
]
const flowCounts=Object.fromEntries(['PASS','FAIL','BLOCKED'].map(r=>[r,flows.filter(f=>f[3]===r).length]))
let flow='# User Flow Report\n\n2026-10-19 ·28source-supportedbrowserflowfamilies: '+JSON.stringify(flowCounts)+' ผลเป็นboundedassertionsตามขั้นที่เขียน ไม่ใช่รับรองทุกstate/permutation. Existing130casesมีAPI-onlycasesด้วย จึงไม่เรียกว่า130userflows\n\n'
flow+='| ID | Flow / steps | Result | Failed step / severity | Evidence / coverage gap |\n|---|---|---|---|---|\n'+flows.map(([id,name,steps,result,failed,e])=>`| ${id} | ${esc(name+' · '+steps)} | ${result} | ${esc(failed)} | ${esc(e)} |`).join('\n')+'\n\n'
flow+='## Figma-onlyflowfamilies\n\n| Issue | Flow | Execution result | Evidence status |\n|---|---|---|---|\n'+issues.filter(i=>i.id.startsWith('GAP-')).map(i=>`| ${i.id} | ${i.component} | ${i.id==='GAP-008'?'FAIL · injectedruntime':'BLOCKED · noimplementationentrypoint'} | ${esc(i.verification)} |`).join('\n')+'\n\n'
flow+='อีก8APIacceptancefamilies(assignmentvalidation,pairgeneration,accessisolation,comparisonpersistence,submissionidempotency,scoring/privacy/override,audittrail,CSVcontent) มีassertionsที่ผ่านใน130suite ไม่เพิ่มเป็น8browserflowPASS. Passwordsignup/reset/changeเป็นNOTAPPLICABLEเพราะระบบใช้Google; registrationคือimplicitfirst-loginไม่ใช่passwordform. Fullprivacyconsent/tutorial/mygroupframesที่mappingยังNotVerifiedไม่ได้ถูกอ้างว่าทดสอบผ่าน\n\n'
flow+='Evidence: '+link('runtime-summary.json')+' · '+link('evidence/failure/checks.json')+' · '+link('discovery.json','130testtitles/sourceinventory')+' · '+link('evidence/verification.json')+'\n\n'
flow+='Missingstepsที่ยังNOTTESTED: fullprototypehotspots191states,realOAuth,screenreader/crossbrowser,fullcalendargridkeyboard,drag-dropgesture,allnetwork500/timeout/out-of-orderconditions,allhover/focus/disabledvariantsและactualtouch/zoom. ไม่ได้ทำmutationกับproduction; syntheticfixturesถูกแยกDockerprojectpaireval-ui-auditจากpreviewผู้ใช้\n'
write('USER_FLOW_REPORT.md',flow)

const compDetails={
 SiteNav:['Mismatch','FAIL · A11Y-001; visualUI-001','Guestanchors/noticechecked; signed-inhomevariantsNotVerified'],
 Hero:['Mismatch','PASS navigation/assets; UI-001visual','CTAactualguard/anchorchecked; sessioncopycoveredbysourceonly'],
 ProcessFlow:['Mismatch','PASS guidespointer/Enter; UI-001spacing','3guideopen/closeactualcontent+link'],
 CtaBand:['Mismatch','PASS abouttoggle/content; UI-001','SecondaryGISrealpopupBLOCKEDbyorigin'],
 SiteFooter:['Mismatch','PASS actualanchortargets; UI-001','APIready/errorstylingA11Y-002'],
 ApiStatusBadge:['Not Verified','FAIL · A11Y-002contrast','Readyhealthchecked; fullerror/loadingvariantvisualNotVerified'],
 GoogleSignInButton:['Not Verified','PASS GISmockcontract; realOAuthBLOCKED','40pxorangelabelisuseroverride; realaccountchooser/cancelnotexecuted'],
 RequireSession:['Not Verified','PASS guard/401/retry/raceassertions','No-token4routes×6; failclosed; cross-taballpermutationsnotexhaustive'],
 AppNav:['Mismatch','FAIL keyboardA11Y-004; logoutPASS','4roles×6menu/escape/logout; UI-009shell'],
 ClassroomCreateForm:['Not Verified','PASS create/validation/cancel/keyboard','Dialogdefault/focus6sizes; fullFigma397:2012layoutNotVerified'],
 Dropdown:['Not Verified','PASS sortkeyboard/filter; timezoneused','Default/open/selected/Arrow/Enter; allHomeEnd/outside variantsnotexhaustive'],
 RosterImportCard:['Mismatch','PASS imports/sample/fileclear/reselect','UI-003focusedmemberscomposition; dragdropgestureNOTTESTED; advancedpreviewGAP-004'],
 RosterTable:['Mismatch','PASS search/pages/removal; realkeyboard6cases','Axe scrollwarningถอนหลังnativeTab/Arrowผ่าน; advancedrole/withdrawGAP-004'],
 MemberPanel:['Not Verified','PASS basicstaffadd/removevalidationassertions','Advancedroleedit/withdrawnotimplementedGAP-004'],
 SetupStepper:['Mismatch','FAIL · FLOW-002','Publishedjobstillcurrentall6; FigmafocusedoverviewUI-003'],
 SetupSummary:['Not Verified','PASS valuesrendered/defaults; fullvariantsNotVerified','Source/tracedrender6sizes; notallformcombinationasserted'],
 AssignmentPanel:['Mismatch','FAIL refreshFLOW-001; basiccreate/feas/publishPASS','AuthoringGAP-005/006; inlineworkspaceUI-003'],
 DeadlinePicker:['Not Verified','FAIL focusA11Y-007; month/cancel/tomorrow/time/applyPASS','Calendargridallkeys/outside/mobilepositionvariantsNOTTESTED'],
 AssignmentsToEvaluateCard:['Mismatch','FAIL refreshFLOW-001; entrylinksPASS','StudentdashboardUI-004; finalizedlinkasserted'],
 ComparisonRow:['Mismatch','FAIL EVAL-001/GAP-008/A11Y-005','Default/selected/hover/focus/saved/error/read-only; all6sizes; UI-005/006'],
 AssignmentScoringCard:['Mismatch','FAIL menuA11Y-004/sessionAUTH-001; scoringcommandsPASS','Provisional/finalize/override/reopen/CSVactualeffectschecked; richreportsGAP-007'],
 Ui:['Not Verified','Renderedsharedstates; contrastissuesnotblanketPASS','Fullallvariantsnotverified; sampleFigmaButtonpropertiesinfigma-inventory'],
 icons:['Not Verified','PASS loadedlogofile; noall-iconsemanticcomparison','45exports=44inlineicons+LogoMark; alldecorativeglyphversionsnotcompared'],
}
let components='# Component Audit\n\n2026-10-19 ·29modules=23reachable+6unused; 5pagesแยกจากcomponentcount. Matchต้องมีreferenceและstatecomparisonจริง จึงไม่มีการเหมารวมว่าMatchเพียงเพราะใช้assetจากFigma. สถานะMismatchอิงissueส่วนNotVerifiedคือยังไม่ตรวจครบvisualvariants\n\n'
components+='| Component | Source | Figma status | Runtime / interactions | States / limits |\n|---|---|---|---|---|\n'
components+=discovery.components.map(c=>{const name=c.name;const row=compDetails[name];return `| ${name} | ${source(c.source)} | ${row?row[0]:'Not Verified'} | ${row?esc(row[1]):'NOT APPLICABLE · unused source'} | ${row?esc(row[2]):'ไม่มีpathจากentry; ไม่ใช่หน้า/flowจริงและไม่นับMissing'} |`}).join('\n')+'\n\n'
components+='Unused6:ComparisonDemo,DashboardPreview,FeatureGrid,InstructorReport,PersonaCards,TrustRow. InstructorReportมีตัวอย่างในsourceไม่ได้แปลว่ารายงานคุณภาพจริงพร้อมใช้; ไม่ดึงmockdataขึ้นproductionเพื่อปิดgap\n\n'
components+='## Figma components / missing components\n\nมี41mastersและButton24variantnamesใน '+link('FIGMA_SCREEN_INVENTORY.md')+'. ยังไม่ได้ตรวจค่าภาพทุกvariant. Missingnotification/appeal/roomlifecycle/preview/criteriaeditor/report/offlinecomponentsอ้างGAP-001ถึง008; read-onlyframeinventoryไม่ใช่runtimePASS\n\n'
components+='## State coverage\n\nDefault/open/selected/hover/focus/saved/error/readonlyของevaluationมีcaptures; modalcreatefocus/Escapeครบ6; menuEsc/radio/tabkeysถูกprobeจริง; uploadatomicerrors/basicformvalidationมี130suite; scoringpromptscancel/blank/invalid/successและbrowserdownloadตรวจผลAPI/DOMจริง. ส่วนทุกbuttonloadingstate,allinputblurerrors,alltooltips/skeletons,allhover/focus/disabledvaluesและlongcontentcombinationsยังNOTTESTED/NotVerified\n\n'
components+='## Architecture / tokens / forms\n\nReactlocalstate+typedfetch;ไม่มีquerycachelibrary,ไม่มีErrorBoundaryที่พบ. RequireSessionอ่านsessionด้วยuseSyncExternalStoreและตรวจ/api/meก่อนmount. Assignment/scorecomponentsfetchแยกกันทำให้FLOW-001; childchoiceที่parentไม่รู้ทำให้EVAL-001. Validationใช้nativeconstraints+domainweightchecks+structuredApiError/Banner; frontendshowsไทย. รายละเอียดAPI/state/loading/empty/error/success/breakpointsและsymbolsทุกตัวอยู่ '+link('discovery.json')+'\n\n'
components+='Tailwindbreakpoints640/768/1024/1280/1536และbrand≤420; evaluationgrid3→6ที่sm. FontsIBMPlexSansThai/NotoSansThai/IBMPlexMonoโหลดผ่านGoogleFonts; runtimefontfacesโหลดจริงแต่fullFigmafontstyleequivalenceNotVerified. CSSvariablelistอยู่discoveryและcomputedCSSในruntime. Inlinehardcodedcomparisoncolors/gradientยังมี; ไม่สร้างtokenmismatchจากชื่อหรือhexที่ไม่ได้เทียบจริง\n\n'
components+='Finalsourcecandidatesถูกยืนยันแล้ว:DISC-001→EVAL-001,DISC-002→FLOW-001/002,DISC-003→A11Y-001,DISC-004→A11Y-004/005/006,DISC-005→AUTH-001. ทั้งหมดนับตามcentralIDsเท่านั้น\n'
write('COMPONENT_AUDIT.md',components)

let summary='# Audit Summary\n\n2026-10-19 · Asia/Bangkok · AUDIT ONLY · branch codex/figma-frontend · head c50702a39a0be9dd52ad39f9f56db592925384fa\n\n'
summary+='เว็บเปิดได้ครบทุกrouteและregression suiteเขียว แต่ยังไม่พร้อมรับรองว่าimplementตามFigmaครบ พบปัญหาคำตอบตกหล่นเมื่อส่ง/สลับsideก่อนautosave,deadlineUIไม่อัปเดตและpublishไม่refreshsiblingworkspaces รวมถึงscorebreakdownและflowsใหม่จากFigmaที่ยังไม่มี\n\n'
summary+='| Coverage / result | Verified scope |\n|---|---|\n'+[
 ['Website routes','5concrete+wildcardredirect; เปิดจริง5/5 ไม่มีrouteถูกblockจากbackendfixture'],
 ['Roles / responsive','Classroom4roles;6exactviewportsทุกroute +Student390pxเสริม'],
 ['Runtimecaptures','206unique state×viewport observations =412PNG; 34commonstates×6+2submissioncases'],
 ['Figma','7pages;191screen/stateframes =Home5+Student35+Owner93+Co-teacher42+TA16'],
 ['Figma mapping','ทุก191มีstatus:123partialroute match,59missingcapability,9NotVerified; masters41/assetlayers81แยกยอด'],
 ['Visualcomparison','Freshexports11:10เทียบเว็บ+1missingappealsuccess;180framesยังNotVerifiedfullvisual. ทุก5routefamiliesมีconfirmedmismatch'],
 ['Browserflowfamilies','28:PASS18 / FAIL9 / BLOCKED1 (realOAuth); boundedassertions+gapsในUSER_FLOW_REPORT'],
 ['Figma-onlyflows','8capabilityfamiliesแยก:7BLOCKEDไม่มีentrypoint,offline1FAILจริง; ไม่บวกเป็นflowPASS'],
 ['Issuecount','28deduplicated:20observedfunctional/accessibility/visual+8capabilitygaps; unseenlayoutdetailsNotVerified'],
 ['Severity','P0=0 · P1=1 · P2=18 · P3=9 · P4=0'],
 ['Automation','ExistingE2E130passed; backend428passed/29integrationdeselected; frontend21passed; lint/typesnoerrors(frontendlintมีwarnings)'],
 ['Auditchecks','284runtime+16extra=300checks:PASS242/FAIL58, dedupedbyid+state. ไม่ใช่300issuesหรือ300userflows'],
 ['Accessibility','axe4.14ทุก206captures:raw138scanPASS/68scanFAIL,3rules; scrollrule6alertsถอนหลังTab/Arrowผ่านจริง. เหลือ6a11yfindingsรวมmanualwidgetprobes'],
 ['Runtimequality','0pageerrors,0brokenimages,0documentoverflowfailures; fontsloaded. GISorigin8080errorsแยกเป็นenvironmentblock'],
].map(r=>'| '+r.map(esc).join(' | ')+' |').join('\n')+'\n\n'
summary+='## สิ่งที่ควรแก้ก่อน\n\n1. EVAL-001 P1: sharedpendinganswers/flushก่อนsubmitหรือเปลี่ยนside. พบPOST200ส่ง0คู่ก่อนPUTและคำตอบหายเมื่อเปลี่ยนside\n2. EVAL-002/FLOW-001: deadlineclockและassignmentinvalidation; server409ยังป้องกันlatewriteอยู่\n3. A11Y-001/002: mobilebrandlabelและcontrast แล้วแก้menu/radio/tab/focuspatterns\n4. GAP-005/UI-005/006: multiplecriteria/artifactcontractและpair-centric/mobileevaluationก่อนขยายredesign\n5. UI-007/GAP-002: scorebreakdown/max/date/countsและappealflow ต้องbackend+privacytests ไม่ใช่เติมตัวเลขสมมุติในFrontend\n\n'
summary+='## ทุกหน้าที่ไม่ตรงFigma\n\n'+routeRows.slice(0,5).map(r=>'- `'+r[0]+'` — '+r[6]).join('\n')+'\n\n'
summary+='Missingcapabilitiesหลัก:notification,appeal,roomarchive/delete,rosterpreview/role/withdraw,multiplecriteriaeditor,assignmentlifecycleแบบตั้งเวลา/ขยาย/ยกเลิก/คัดลอก,advancedquality/coverage/intervention/auditviewer,offlinependingqueue. แต่ละรายการมีframe/source/evidence/แนวทางแก้ในรายงานหลัก โดย59missingframesรวมเป็น8families ไม่ใช่59bugsซ้ำ\n\n'
summary+='## ข้อจำกัดและข้อขัดแย้ง\n\nRealGoogleOAuthที่isolatedhttp://localhost:8080ถูกGoogle403(originnotallowed) จึงBLOCKED; GISmockcontract130suiteไม่แทนrealOAuth. ไม่logoutหรือแก้ข้อมูลpreviewผู้ใช้ที่127.0.0.1:5173. Prototypehotspots/transitions,fullvariables/styles/allcomponentstates,180unexportedframevisuals,Co-teacher/TAfullframecomparison,screenreaders/crossbrowser/touch/zoomและallnetworkpermutationsยังNOTTESTED/NotVerified. ไม่มีcomplianceเปอร์เซ็นต์และไม่รับรองWCAGทั้งระบบ\n\n'
summary+='Figmaเองมีstatecaption/bar/selectionที่ขัดแย้งกัน; ปุ่มGoogle40pxเป็นexplicituseroverride. อ้างcurrentST30 60:437 ไม่ใช้old292:7699. Full-pagecaptureของstickybarอาจวางbarไว้กลางภาพ; ไม่สร้างoverlapissueจากartifactนี้\n\n'
summary+='## Verification / artifacts\n\nไม่มีapplication code,existingtestsหรือprojectmanifest/lockfileถูกแก้ในauditนี้; sourcebaseline123ไฟล์เทียบhashก่อน/หลังใน '+link('evidence/source-integrity.json')+'. เก็บการแก้เดิมของผู้ใช้ไว้,ไม่commit/push/deploy. Axe-coreติดตั้งเฉพาะ.localตามpermissionผู้ใช้ และscripts/reports/evidenceอยู่audit-reports. Dockerprojectทดสอบแยกจากpreview. InitialauditมีWindowsbindmountreportwriteEINVAL:แก้เฉพาะharnessและrerunaffectedscenariosจนcoverageครบ ไม่จัดเป็นproductbug\n\n'
summary+=[['FIGMA_MISMATCH_REPORT.md','รายงานหลัก:ภาพ/ความต่าง/ช่องว่าง'],['FUNCTIONAL_ISSUES.md','การทำงานและaccessibility'],['USER_FLOW_REPORT.md','Flowmatrix28families'],['RESPONSIVE_ISSUES.md','ผล6ขนาดจอและmobile390'],['COMPONENT_AUDIT.md','29modules/states/limitations'],['FIX_PRIORITY.md','ลำดับแก้Frontend/Backend/Tests'],['ROUTE_INVENTORY.md','5routes+fallback'],['FIGMA_SCREEN_INVENTORY.md','191frames+41masters'],['EVIDENCE_INDEX.md','ภาพและrawreportsทั้งหมด'],['issues.json','Central28findings'],['evidence/verification.json','คำสั่ง/ผลทดสอบจริง']].map(([p,l])=>'- '+link(p,l)).join('\n')+'\n'
write('AUDIT_SUMMARY.md',summary)
console.log(JSON.stringify({issues:issues.length,counts,flowCounts,reportFiles:8},null,2))
