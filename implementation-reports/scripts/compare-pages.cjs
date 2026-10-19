const fs = require('node:fs')
const path = require('node:path')
const sharp = require(path.join(process.env.BUNDLED_NODE_MODULES, 'sharp'))
const root = path.resolve(__dirname, '..')
const pairs = [
 ['classrooms-owner', 'audit-reports/evidence/figma/owner-classrooms-desktop-349-2388.png', 'ownerClassrooms-1440.png'],
 ['classroom-owner', 'audit-reports/evidence/figma/owner-classroom-desktop-330-1914.png', 'ownerOverview-1440.png'],
 ['members-owner', 'audit-reports/evidence/figma/owner-members-desktop-330-1057.png', 'ownerMembers-1440.png'],
 ['classrooms-student', 'audit-reports/evidence/figma/student-classrooms-mobile-516-825.png', 'classrooms-390.png'],
 ['classroom-student', 'audit-reports/evidence/figma/student-classroom-mobile-516-923.png', 'classroom-390.png'],
 ['evaluation-mobile', 'audit-reports/evidence/figma/student-evaluation-mobile-516-996.png', 'evaluation-three-criteria-390.png'],
 ['evaluation-desktop', 'audit-reports/evidence/figma/student-evaluation-desktop-57-3.png', 'evaluation-three-criteria-1440.png'],
 ['score-mobile', 'audit-reports/evidence/figma/student-score-mobile-516-1322.png', 'score-visible-390.png'],
 ['score-desktop', 'audit-reports/evidence/figma/student-score-desktop-60-437.png', 'score-visible-1440.png'],
 ['notifications-mobile', 'implementation-reports/evidence/figma/student-notifications-516-870.png', 'notifications-390.png'],
 ['appeal-mobile', 'implementation-reports/evidence/figma/student-appeal-516-1393.png', 'appeal-390.png'],
]
async function main() {
 const results = []
 for (const [name, reference, actualName] of pairs) {
  const a = path.resolve(reference), b = path.join(root, 'evidence/after', actualName)
  const [ma, mb] = await Promise.all([sharp(a).metadata(), sharp(b).metadata()])
  if (ma.width !== mb.width) throw new Error(`Incomparable width: ${name}`)
  const width = ma.width, height = Math.max(ma.height, mb.height), header = 76
  const title = Buffer.from(`<svg width="${width*2}" height="${header}"><rect width="100%" height="100%" fill="#321007"/><g font-family="sans-serif" font-size="${width===390?15:22}" fill="white"><text x="12" y="26">Figma reference</text><text x="${width+12}" y="26">Implemented website</text><text x="12" y="53">Unscaled; real fixture content differs</text></g></svg>`)
  const output = `evidence/comparison/${name}-side-by-side.png`
  await sharp({create:{width:width*2,height:height+header,channels:4,background:'#fffcf7'}}).composite([{input:title,left:0,top:0},{input:a,left:0,top:header},{input:b,left:width,top:header}]).png().toFile(path.join(root,output))
  results.push({reference,actual:`evidence/after/${actualName}`,output,referenceSize:[ma.width,ma.height],actualSize:[mb.width,mb.height],method:'Unscaled side by side. Dynamic fixture values differ; no pixel compliance percentage.'})
 }
 fs.writeFileSync(path.join(root,'evidence/comparison/boards.json'),JSON.stringify(results,null,2))
 console.log(`Created ${results.length} unscaled comparison boards`)
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
