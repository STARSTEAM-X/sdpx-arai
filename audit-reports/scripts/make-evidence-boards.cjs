const fs=require('node:fs')
const path=require('node:path')
const root=path.resolve(__dirname,'..')
const sharp=require(path.join(process.env.BUNDLED_NODE_MODULES,'sharp'))
const pairs=[
  ['score-desktop','figma/student-score-desktop-60-437.png','visual/score-three-two-criteria-1440.png'],
  ['evaluation-mobile','figma/student-evaluation-mobile-516-996.png','visual/evaluation-three-criteria-390.png'],
  ['student-classroom-mobile','figma/student-classroom-mobile-516-923.png','visual/student-classroom-390.png'],
  ['owner-overview-desktop','figma/owner-classroom-desktop-330-1914.png','visual/owner-members-no-assignment-1440.png'],
]
async function main(){
  fs.mkdirSync(path.join(root,'evidence/comparison'),{recursive:true})
  const result=[]
  for(const [name,ref,actual] of pairs){
    const a=path.join(root,'evidence',ref),b=path.join(root,'evidence',actual)
    const [ma,mb]=await Promise.all([sharp(a).metadata(),sharp(b).metadata()])
    if(ma.width!==mb.width)throw new Error('Do not resize incomparable screenshots')
    const width=ma.width,height=Math.max(ma.height,mb.height),header=76
    const label=Buffer.from(`<svg width="${width*2}" height="${header}"><rect width="100%" height="100%" fill="#321007"/><g font-family="sans-serif" font-size="${width===390?15:22}" fill="white"><text x="12" y="26">Figma reference</text><text x="${width+12}" y="26">Current website</text><text x="12" y="53">Structure comparison; synthetic names/counts differ</text></g></svg>`)
    const file=`evidence/comparison/${name}-side-by-side.png`
    await sharp({create:{width:width*2,height:height+header,channels:4,background:'#fffcf7'}}).composite([{input:label,left:0,top:0},{input:a,left:0,top:header},{input:b,left:width,top:header}]).png().toFile(path.join(root,file))
    result.push({reference:`evidence/${ref}`,actual:`evidence/${actual}`,output:file,referenceSize:[ma.width,ma.height],actualSize:[mb.width,mb.height],pixelDifference:'NOT APPLICABLE — dynamic fixture/content conditions differ. Unscaled side-by-side evidence only.'})
  }
  fs.writeFileSync(path.join(root,'evidence/comparison/boards.json'),JSON.stringify(result,null,2))
  console.log(JSON.stringify(result,null,2))
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
