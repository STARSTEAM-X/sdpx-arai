const fs=require('node:fs'),path=require('node:path')
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'..')
const findings=require('./issue-catalog.cjs')
const figma=JSON.parse(fs.readFileSync(path.join(root,'figma-inventory.json'),'utf8'))
const problems=[]
const knownNodes=new Set([...figma.screens,...figma.masters].map(s=>s.node))
for(const finding of findings){
 for(const p of finding.evidence)if(!fs.existsSync(path.join(root,p)))problems.push(`Missing evidence ${finding.id}:${p}`)
 for(const source of finding.sources){const [,name,line]=source.match(/^(.*):(\d+)$/)??[];if(!name||!fs.existsSync(path.join(repo,name)))problems.push(`Missing source ${finding.id}:${source}`);else if(Number(line)>fs.readFileSync(path.join(repo,name),'utf8').split(/\r?\n/).length)problems.push(`Invalid source line ${source}`)}
 for(const n of finding.frames)if(!knownNodes.has(n))problems.push(`Unknown Figma node ${finding.id}:${n}`)
}
const docs=fs.readdirSync(root).filter(p=>p.endsWith('.md'))
let checkedLinks=0
for(const file of docs){
 const text=fs.readFileSync(path.join(root,file),'utf8')
 for(const match of text.matchAll(/\]\((?:<([^>]+)>|([^\)]+))\)/g)){
  let target=match[1]??match[2]
  if(/^https?:|^#/.test(target))continue
  target=target.replace(/:\d+$/,'').split('#')[0]
  const location=path.isAbsolute(target)?target:path.resolve(root,target)
  checkedLinks++
  if(!fs.existsSync(location))problems.push(`Broken local link ${file}:${target}`)
 }
}
const summary=JSON.parse(fs.readFileSync(path.join(root,'runtime-summary.json'),'utf8'))
const failure=JSON.parse(fs.readFileSync(path.join(root,'evidence/failure/checks.json'),'utf8'))
if(findings.length!==new Set(findings.map(i=>i.id)).size)problems.push('Duplicate central issue IDs')
if(summary.uniqueObservations!==206||failure.checks.length!==16)problems.push('Unexpected capture/check totals')
const integrity=JSON.parse(fs.readFileSync(path.join(root,'evidence/source-integrity.json'),'utf8'))
if(integrity.result!=='PASS')problems.push('Application baseline changed')
const required=['AUDIT_SUMMARY.md','FIGMA_MISMATCH_REPORT.md','FUNCTIONAL_ISSUES.md','USER_FLOW_REPORT.md','RESPONSIVE_ISSUES.md','COMPONENT_AUDIT.md','FIX_PRIORITY.md']
for(const file of required)if(!fs.existsSync(path.join(root,file)))problems.push(`Missing required report ${file}`)
const result={checkedAt:new Date().toISOString(),result:problems.length?'FAIL':'PASS',requiredReports:required.length,markdownReportsChecked:docs.length,localLinksChecked:checkedLinks,centralIssues:findings.length,figmaFrames:figma.screens.length,sourceBaselineFiles:integrity.fileCount,problems}
fs.writeFileSync(path.join(root,'evidence/report-verification.json'),JSON.stringify(result,null,2))
console.log(JSON.stringify(result,null,2));if(problems.length)process.exitCode=1
