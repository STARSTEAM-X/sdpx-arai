const fs=require('node:fs')
const path=require('node:path')
const root=path.resolve(__dirname,'..')
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))
const save=(p,v)=>fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2))
const r=read('runtime-summary.json'),d=read('discovery.json'),v=read('evidence/verification.json')
const latest=new Map(r.screenshots.map(s=>[s.state+'|'+s.screenSize,s]))
const common=r.screenshots.filter(s=>s.screenSize==='375x812').map(s=>s.state)
for(const state of common)for(const size of r.viewports.map(x=>`${x.width}x${x.height}`))if(!latest.has(state+'|'+size))throw new Error('Unfilled runtime capture gap')
if(r.uniqueObservations!==206)throw new Error('Unexpected capture count')
const mappings={'DISC-001':['EVAL-001'],'DISC-002':['FLOW-001','FLOW-002'],'DISC-003':['A11Y-001'],'DISC-004':['A11Y-004','A11Y-005','A11Y-006'],'DISC-005':['AUTH-001']}
const mismatch=new Set(['SiteNav','Hero','ProcessFlow','CtaBand','SiteFooter','AppNav','RosterImportCard','RosterTable','SetupStepper','AssignmentPanel','AssignmentsToEvaluateCard','ComparisonRow','AssignmentScoringCard'])
const failing=new Set(['SiteNav','ApiStatusBadge','AppNav','SetupStepper','AssignmentPanel','DeadlinePicker','AssignmentsToEvaluateCard','ComparisonRow','AssignmentScoringCard'])
d.scope='AUDIT ONLY — no application or existing test edits; separate audit scripts/reports added'
for(const route of d.routes){
 route.runtimeStatus='PASS'
 route.auditStatus=route.route==='*'?'PASS redirect; visual NOT APPLICABLE':'Runtime checked all6viewports; Figma FAIL for confirmed core mismatches; see ROUTE_INVENTORY.md for role/state limits'
 route.figmaMappingStatus=route.route==='*'?'NOT APPLICABLE':'PARTIAL — core reference identified; no all-state Match claim'
 if(route.route==='/')route.figmaCandidate='175:3 guest; authenticatedHomeframes inventoried, fullvisualNotVerified'
 if(route.route==='/classrooms')route.figmaCandidate='349:2388 Owner;77:1086 Student;516:825 Studentmobile'
 if(route.route==='/classrooms/:classroomId')route.figmaCandidate='330:1914 Owneroverview;330:1057 members;268:6135 Student;516:923 Studentmobile. Co/TA fullframevisualNotVerified'
 if(route.route.endsWith('/evaluate'))route.figmaCandidate='57:3 desktop;516:996 mobile (fresh2026-10-19)'
 if(route.route.endsWith('/score'))route.figmaCandidate='60:437 desktop;516:1322 mobile (old292:7699 stale)'
}
for(const c of d.components){c.figmaStatus=mismatch.has(c.name)?'Mismatch':'Not Verified';c.runtimeStatus=!c.reachableFromEntry?'NOT APPLICABLE — unused source':failing.has(c.name)?'FAIL — bounded findings in COMPONENT_AUDIT.md':'CHECKED — bounded assertions; untested states detailed in COMPONENT_AUDIT.md'}
for(const c of d.sourceCandidates){c.finalIssueIds=mappings[c.id];c.status='CONFIRMED by actual runtime; use final issue IDs/severity from issues.json, not the discovery candidate severity'}
d.testingLimits=d.testingLimits.map(x=>x.includes('pending root auditor')?'Fresh191frame mapping completed; fullvisual only11exports(10runtimecomparisons+1missing), remaining180NotVerified':x)
d.freshVerification.additionalRuntime={uniqueAuditScenarios:40,definition:'26runtime(4families×6viewports+2submit)+12interaction/failure+2referencecapture/keyboard',captures:206,runtimeChecks:r.checkResults,extraChecks:{PASS:8,FAIL:8},figmaExports:11,fullVisualUnverified:180}
save('discovery.json',d)
v.auditRuns=[
 {suite:'runtime.spec.ts initial',uniqueDefinitions:26,runnerPassed:24,runnerFailed:2,duration:'5.8m',reason:'Two EINVAL report-write instrumentation failures; three additional caught partial scenarios. These were not application failures.'},
 {suite:'runtime.spec.ts targeted retry',grep:'430x932|public and protected-route guards1366x768',runnerPassed:5,runnerFailed:0,duration:'1.2m'},
 {suite:'runtime.spec.ts laptopTA catch-gap retry',grep:'classroom list and detail every role1366x768',runnerPassed:1,runnerFailed:0,duration:'26.8s'},
 {suite:'failure.spec.ts initial9',runnerPassed:9,runnerFailed:0,duration:'44.0s'},
 {suite:'failure.spec.ts pending/offline2',runnerPassed:2,runnerFailed:0,duration:'9.6s'},
 {suite:'failure.spec.ts homeanchors1',runnerPassed:1,runnerFailed:0,duration:'4.0s'},
 {suite:'visual.spec.ts',runnerPassed:1,runnerFailed:0,duration:'22.1s'},
 {suite:'visual.spec.ts keyboard review',runnerPassed:1,runnerFailed:0,duration:'4.8s',details:'All6Student/TA/Co-teacher×375/430 realTab/ArrowRight probes passed. Earlier singleStudent375 probe also passed in1.6s. Not new scenario definitions.'},
 ]
v.auditOutcome={uniqueScenarioDefinitions:40,completedDefinitionsAfterTargetedRetries:40,runtimeStateViewportCaptures:206,commonStates:34,viewports:6,extraSubmissionCaptures:2,checks:{PASS:242,FAIL:58},
  note:'A passing audit test means it successfully recorded product observations. Product failures are expected findings, not hidden by the runner pass. JSON/HTML Playwright reporter paths contain only the latest invocation for each suite; runtime.json and failure/checks.json are cumulative audit evidence.'}
v.auditOutcome.manualKeyboardReview={cases:6,passed:6,retiredIssue:'A11Y-003',scope:'Chromium nativefocus/scroll passed; otherbrowsers nottested',evidence:'evidence/visual/roster-keyboard.json'}
v.harnessVerification={configurationListCheck:'PASS:26runtime+12failure+1visual parsed after isolated-target guard; final additional keyboard visual case verified by execution',sourceIntegrity:read('evidence/source-integrity.json').result}
save('evidence/verification.json',v)
const absolute=p=>path.resolve(root,p).replaceAll('\\','/')
const link=(p,label=p)=>`[${label}](<${absolute(p)}>)`
const files=[]
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else files.push(path.relative(root,p).replaceAll('\\','/'))}}
walk(root)
const pngs=files.filter(p=>p.endsWith('.png'))
let md='# Evidence Index\n\n2026-10-19 · ทุกภาพเว็บใช้syntheticdataในisolatedDockerproject. ไม่มีrealaccountcredentials/tokensในartifactที่ตั้งใจบันทึก; console/networkเก็บpath/statusไม่เก็บauthorizationheaders\n\n'
md+='## Counts\n\n'+[
 ['RuntimePNG',pngs.filter(p=>p.startsWith('evidence/runtime/')).length],['Extra functionalPNG',pngs.filter(p=>p.startsWith('evidence/failure/')).length],['Extra reference/keyboardPNG',pngs.filter(p=>p.startsWith('evidence/visual/')).length],['FreshFigmaPNG',pngs.filter(p=>p.startsWith('evidence/figma/')).length],['Comparisonboards/diff/overlayPNG',pngs.filter(p=>p.startsWith('evidence/comparison/')).length],['AllPNG',pngs.length],
].map(([name,n])=>`- ${name}: ${n}`).join('\n')+'\n\n'
md+='## Runtime captures — latest unique state×viewport\n\n| State | Viewport | ViewportPNG | FullpagePNG |\n|---|---|---|---|\n'
md+=r.screenshots.sort((a,b)=>a.state.localeCompare(b.state)||parseInt(a.screenSize)-parseInt(b.screenSize)).map(s=>`| ${s.state} | ${s.screenSize} | ${link(s.viewport,'View')} | ${link(s.full,'Full')} |`).join('\n')+'\n\n'
md+='## FreshFigma / extra checks / comparisons\n\n'
md+=files.filter(p=>p.startsWith('evidence/')&&!p.startsWith('evidence/runtime/')&&!p.includes('test-results/')&&!p.includes('playwright-report/')&&p.endsWith('.png')).sort().map(p=>'- '+link(p)).join('\n')+'\n\n'
md+='## Raw evidence / runner semantics\n\n'+['runtime.json','runtime-summary.json','figma-inventory.json','discovery.json','issues.json','source-baseline.json','evidence/verification.json','evidence/source-integrity.json','evidence/report-verification.json','evidence/failure/checks.json','evidence/visual/conditions.json','evidence/visual/roster-keyboard.json','evidence/figma/inventory-source.tsv','evidence/comparison/boards.json','evidence/comparison/home-1440.json'].map(p=>'- '+link(p)).join('\n')+'\n\n'
md+='Playwrightreporterpathsถูกเขียนทับเมื่อtargetedrun:runtime-playwright.jsonเป็นlatestlaptopretry1case, failure-playwright.jsonเป็นlatesthomecase,visual-playwright.jsonเป็นvisualcase. อย่าใช้latestreportนับทุกauditcase; cumulativeobservationsและrunhistoryอยู่runtime.json/failurechecks/verification.json. Error-contextจากinitialEINVALเป็นหลักฐานharnessfailure ไม่ใช่appbug. Trace/videoปิดเพื่อไม่เก็บsessionheaders\n\n'
md+='## All report and script files\n\n'+files.filter(p=>!p.startsWith('evidence/')&&!p.includes('/audit-reports/')).sort().map(p=>'- '+link(p)).join('\n')+'\n\n'
md+='## Reproduce\n\nใช้Dockerproject `paireval-ui-audit` กับ `compose.test.yaml` และbindmount `audit-reports:/work/audit-reports`, `.local/audit-tools:/audit-tools:ro`; environment `AXE_PATH=/audit-tools/node_modules/axe-core/axe.min.js`. Run `npx playwright test --config audit-reports/scripts/playwright.config.ts`, `failure.config.ts` และ `visual.config.ts` ตามลำดับ ไม่รันพร้อมกันเพราะfixtureseed/cleanupDB. Auditconfigsrejectwebนอกlocalhost8080และAPIนอกapi-test8000/local8123. ห้ามใช้preview18123/5173หรือremoteDBกับfixtureเหล่านี้\n\n'
md+='Pixelcomparisonใช้bundledsharp/pixelmatchผ่าน `BUNDLED_NODE_MODULES` และscriptscompare-images.cjs/make-evidence-boards.cjs ไม่เพิ่มdependencyในproject. Raw206captures/300checksเป็นobservations/assertions ไม่ใช่compliancescore. เริ่มอ่าน '+link('AUDIT_SUMMARY.md')+' และ '+link('FIGMA_MISMATCH_REPORT.md')+'\n'
fs.writeFileSync(path.join(root,'EVIDENCE_INDEX.md'),md)
console.log(JSON.stringify({pngs:pngs.length,files:files.length,runtimeCaptures:r.uniqueObservations,completeCommonStateMatrix:true},null,2))
