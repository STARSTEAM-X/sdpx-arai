const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const cp = require('node:child_process')
const root = path.resolve(__dirname, '..')
const reports = ['IMPLEMENTATION_SUMMARY.md','FIGMA_COMPLIANCE.md','FIXED_ISSUES.md','REMAINING_ISSUES.md','REGRESSION_TEST_REPORT.md']
const results = JSON.parse(fs.readFileSync(path.join(root, 'results.json'), 'utf8'))
if (results.stats.expected !== 24 || results.stats.unexpected || results.stats.skipped || results.stats.flaky) throw new Error('Final regression is not green')
const after = path.join(root,'evidence/after')
const axe = fs.readdirSync(after).filter(file => file.endsWith('-axe.json'))
if (axe.length !== 112 || axe.some(file => JSON.parse(fs.readFileSync(path.join(after,file), 'utf8')).length)) throw new Error('Axe evidence is missing or has violations')
for (const report of reports) {
 const content=fs.readFileSync(path.join(root,report),'utf8')
 for(const match of content.matchAll(/\]\(([^)]+)\)/g)) {
  const target=match[1].replace(/^<|>$/g,'').split('#')[0]
  if(!target||/^[a-z]+:/i.test(target))continue
  if(!fs.existsSync(path.resolve(root,target)))throw new Error(`Missing link ${report}: ${target}`)
 }
}
const git = args => cp.execFileSync('git', args, {encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()
const files=[...new Set(git(['ls-files','--cached','--others','--exclude-standard','backend/app','backend/migrations','frontend/src']).split('\n'))].filter(file=>/\.(py|sql|tsx?|css|svg|png)$/.test(file)).sort()
const source=files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))
fs.writeFileSync(path.join(root,'source-files.json'),JSON.stringify(source,null,2))
const warnings=(fs.readFileSync(path.join(root,'frontend-lint.txt'),'utf8').match(/: warning /g)||[]).length
// This checks stored evidence integrity. It does not execute tests or invent fresh pass results.
const verification=JSON.parse(fs.readFileSync(path.join(root,'verification.json'),'utf8'))
const currentHash=crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex')
if(verification.sourceSnapshotSha256!==currentHash)throw new Error('Application source changed since the recorded verification; rerun the relevant checks and update the record')
console.log(JSON.stringify({reportsChecked:reports.length,axeReports:axe.length,newRegressionPassed:results.stats.expected,sourceFiles:source.length,frontendWarnings:warnings,recordedChecks:'verification.json contains observed terminal outcomes, not checks executed by this script'}))
