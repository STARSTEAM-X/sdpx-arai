const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname,'..')
const fileKey = 'vr38E4BOnEqgAXdwTXe80W'
const base = `https://www.figma.com/design/${fileKey}/PairEval?node-id=`
const rows = fs.readFileSync(path.join(root,'evidence/figma/inventory-source.tsv'),'utf8').split(/\r?\n/).filter(Boolean)
const split = rows[0].includes('\t') ? '\t' : '\\t'
const screens = rows.slice(1).map(line=>{const [page,section,node,name]=line.split(split);return {page,section,node,name}})
if(screens.length!==191 || screens.some(s=>!s.node || !s.name)) throw new Error('Unexpected Figma inventory; verify raw enumeration')
const frameExports = Object.fromEntries(fs.readdirSync(path.join(root,'evidence/figma')).filter(p=>p.endsWith('.png')).map(name=>{
  const match=name.match(/(\d+)-(\d+)\.png$/)
  return [`${match[1]}:${match[2]}`, `evidence/figma/${name}`]
}))
function mapping(s) {
  const n=s.name
  if(s.page==='Home') return ['/', 'Partial route match', null]
  if(/ออฟไลน์/.test(n)) return ['/classrooms/:classroomId/assignments/:assignmentId/evaluate','Missing capability','GAP-008']
  if(/แจ้งเตือน/.test(n)) return [null,'Missing capability','GAP-001']
  if(/อุทธรณ์|คำร้อง|ตอบ นก/.test(n)) return [null,'Missing capability','GAP-002']
  if(/ประกาศความเป็นส่วนตัว|คู่มือ|ข้อมูลของฉัน|กลุ่มของฉัน/.test(n)) return [null,'Not Verified',null]
  if(s.page==='Student') {
    if(/^ST0/.test(n)) return ['/','Partial route match',null]
    if(/^ST1[01]|^M01/.test(n)) return ['/classrooms','Partial route match','UI-002']
    if(/^ST1[34]|^M03/.test(n)) return ['/classrooms/:classroomId','Partial route match','UI-004']
    if(/^ST2|^M0[456]/.test(n)) return ['/classrooms/:classroomId/assignments/:assignmentId/evaluate','Partial route match','UI-005']
    if(/^ST3|^M07/.test(n)) return ['/classrooms/:classroomId/assignments/:assignmentId/score','Partial route match','UI-007']
  }
  if(/Archive|ลบห้องเรียน|แท็บ Archive/.test(n)) return ['/classrooms','Missing capability','GAP-003']
  if(/แก้ไขบทบาท|ถอนรายวิชา|ถอนระหว่าง|ถอนแล้ว|หลังถอน|นำเข้าซ้ำ.*ดูการเปลี่ยนแปลง|นำเข้า CSV ซ้ำ|ตรวจการเปลี่ยนแปลง/.test(n)) return ['/classrooms/:classroomId#members','Missing capability','GAP-004']
  if(/ตั้งเวลา|รอเปิดรับ|ยกเลิกเผยแพร่|ขยายกำหนด|คัดลอก/.test(n)) return ['/classrooms/:classroomId#assignments','Missing capability','GAP-006']
  if(/Coverage|รายงานคุณภาพ|ตัดคำตอบ|ยกเว้นคำตอบ|ดูคำตอบ.*E7|กดดูตัวตน|อาจารย์ประเมินเอง|ประเมินเอง|ผู้สอนเติม|กระจาย|บันทึก audit|บันทึกการตรวจสอบ|ประวัติการส่งออก/.test(n)) return ['/classrooms/:classroomId#scores','Missing capability','GAP-007']
  if(/สร้างงาน.*น้ำหนัก|สร้างงาน.*ครบ|สร้างงาน.*95%|สร้างงาน ·|สร้างงาน ·/.test(n)) return ['/classrooms/:classroomId#assignments','Partial route match','GAP-005']
  if(/เข้าเว็บ|เข้าระบบ|เข้าห้อง.*ครั้งแรก/.test(n) && /J01|C01|T01/.test(n)) return ['/','Partial route match',null]
  if(/ห้องเรียนของฉัน|กรอกข้อมูลสร้างห้องเรียน/.test(n)) return ['/classrooms','Partial route match','UI-002']
  return ['/classrooms/:classroomId','Partial route match',s.page==='Owner'?'UI-003':null]
}
for(const s of screens) {
  const [route,status,issue]=mapping(s)
  Object.assign(s,{referenceUrl:base+s.node.replace(':','-'),route,mappingStatus:status,issue,
    screenshot:frameExports[s.node]??null,
    visualStatus:frameExports[s.node] ? (status==='Missing capability'?'Missing implementation':'Mismatch — compared structural content/styling') : 'Not Verified — frame enumerated; no full visual comparison',
    note:'A named screen/state frame is not an independent URL. Mapping is based on visible frame title, source inventory and exported core references; no prototype interaction graph was inferred.'})
  if(s.screenshot) {const b=fs.readFileSync(path.join(root,s.screenshot));s.exportSize={width:b.readUInt32BE(16),height:b.readUInt32BE(20)}}
}
const masterData='Button|86:356;IconButton|91:237;Avatar|86:464;Checkbox|91:199;Radio|91:213;Toggle|91:230;Icon / Check|86:389;Icon / Alert|86:391;Icon / Clock|86:395;Icon / CheckCircle|86:398;Icon / ChevronDown|86:796;Input|86:453;SearchInput|91:247;TextArea|91:255;Dropdown|86:809;MenuOption|86:798;DeadlinePicker|86:889;DayCell|86:876;UploadDropzone|91:351;Pill|86:401;SaveStatus|91:265;Banner|86:435;FieldError|86:469;EmptyState|86:789;Tooltip|91:392;Dialog|91:332;Skeleton|91:397;ScaleOption|86:494;ComparisonRow|86:615;ProgressBar|86:492;ScoreCard|91:308;AppNav|86:770;ClassroomTabs|86:780;TabItem|86:761;Stepper|91:389;Pagination|91:358;RosterRow|86:830;ClassroomCard|91:276;AssignmentCard|91:299;CardHead|86:475;Card|86:482'
const masters=masterData.split(';').map(value=>{const [name,node]=value.split('|');return {name,node,referenceUrl:base+node.replace(':','-'),status:'Not Verified — enumerated master; not all visual variants inspected'}})
const report={dateLocal:'2026-10-19',fileKey,pages:['Illustrations & Icons','Components — Illustrated','Home — Orange illustrated','Role · Student','Role · Owner','Role · Co-teacher','Role · TA'],
  method:'View-only Figma browser UI. All role sections expanded/enumerated to TSV; 11 fresh core exports. Root rechecked page list and all41 master names/node IDs. No Figma MCP connected.',
  screenCount:screens.length,screenCountsByPage:Object.fromEntries([...new Set(screens.map(s=>s.page))].map(p=>[p,screens.filter(s=>s.page===p).length])),
  mobileFrames:screens.filter(s=>/^M\d/.test(s.name)).length,exportedCoreScreens:Object.keys(frameExports).length,
  mappingCounts:Object.fromEntries([...new Set(screens.map(s=>s.mappingStatus))].map(status=>[status,screens.filter(s=>s.mappingStatus===status).length])),
  masters,library:{pageNode:'20:190',layersCountFromEnumeration:81,illustrations:30,icons:36,decorations:12,referenceBoards:3,note:'Asset-layer counts, not screen counts. Individual semantic equivalence of every icon and decoration is Not Verified. Existing7 application assets have file/node provenance in frontend/src/assets/figma/README.md.'},
  inspectedProperties:[{node:'175:3',flow:'Vertical',width:1440,height:1870,heightMode:'Hug',surfacePaper:'#FFFCF7'},
    {node:'121:284',component:'Button Secondary MD Default',flow:'Horizontal',width:212,height:50,radius:999,border:1,padding:'12px 24px',gapToken:'space/2',fillToken:'surface/white',fill:'#FFFFFF',borderToken:'reference/neutral-border',borderColor:'#C9C0B9'}],
  buttonVariants:{master:'86:356',styles:['Primary','Secondary','Ghost'],sizes:['MD','SM'],states:['Default','Hover','Disabled','Focus'],enumeratedVariants:24,note:'State names enumerated; only Secondary MD Default properties inspected directly. Other visual state values remain Not Verified.'},
  prototype:{flowEntriesObserved:['Student','Student Mobile','Owner (two entries)','Co-teacher','TA'],interactionGraph:'Not Verified — presentation starting points were visible, all hotspots/transitions not traversed'},
  limitations:['No complete variable/style API export: typography styles, all effect values, layout grids, auto-layout constraints and every component state are Not Verified beyond inspected properties. Runtime CSS tokens are separately recorded in discovery.json/runtime.json.',
    'Only Student has verified390px mobile screens M01–M09. Other roles and375/430/768/1366/1920px lack a verified exact Figma reference; usability remains independently tested.',
    'Old score292:7699 is stale; use current ST30 60:437.',
    'Figma ST30 says15/15 p1.00 but paints a partially filled bar; evaluate percentage from real data, do not copy contradictory decoration.',
    'Figma ST20 selected2nd circle but its answer text says a stronger choice; interpret selection semantics from the product scale and confirm design consistency before changing data mapping.',
    'User explicitly requested the40px orange Google-labelled login button; its wording/size are an accepted user override, not an unqualified mismatch against guest Figma.'],screens}
fs.writeFileSync(path.join(root,'figma-inventory.json'),JSON.stringify(report,null,2))
const esc=s=>String(s??'—').replaceAll('|','\\|')
let md='# Figma Screen Inventory\n\nวันที่2026-10-19 · อ่านทั้ง7pagesผ่าน Figma view-only UI · ไม่มี Figma MCP\n\n191รายการด้านล่างคือ screen/state frames ไม่ใช่191routes มี component masters41และ asset library81layersแยกออกจากยอดนี้ รายละเอียด method/ข้อจำกัด/ค่าที่ตรวจจริงอยู่ [figma-inventory.json](figma-inventory.json) และ raw enumerationอยู่ [TSV](evidence/figma/inventory-source.tsv)\n\n'
md+='| Page | Screen/state frames |\n|---|---:|\n'+Object.entries(report.screenCountsByPage).map(([p,n])=>`| ${p} | ${n} |`).join('\n')+'\n\n'
md+='Mapping เป็นสองทิศทาง: ทุก5routesมี core frame อ้างอิง; frameที่ไม่มี capabilityในเว็บระบุ Missing และ issue family กำกับ ส่วน frameที่มีชื่อแต่ยังไม่ได้เทียบเต็มภาพเป็น Not Verified จึงไม่รับรองทุก191framesว่า Match\n\n'
md+='| Page/section | Frame | Node / reference | Route candidate | Mapping | Visual audit | Issue |\n|---|---|---|---|---|---|---|\n'
md+=screens.map(s=>`| ${esc(s.page+'/'+s.section)} | ${esc(s.name)} | [${s.node}](${s.referenceUrl}) | ${esc(s.route)} | ${esc(s.mappingStatus)} | ${s.screenshot?`[Fresh PNG](${s.screenshot})`:'Not Verified'} | ${esc(s.issue)} |`).join('\n')+'\n\n'
md+='## Design system และข้อจำกัด\n\n'+report.limitations.map(s=>'- '+s).join('\n')+'\n\n'
md+='## Component masters41\n\n| Name | Node | Visual state verification |\n|---|---|---|\n'+masters.map(m=>`| ${m.name} | [${m.node}](${m.referenceUrl}) | ${m.status} |`).join('\n')+'\n'
fs.writeFileSync(path.join(root,'FIGMA_SCREEN_INVENTORY.md'),md)
console.log(JSON.stringify({screenCount:report.screenCount,screenCountsByPage:report.screenCountsByPage,mappingCounts:report.mappingCounts,masters:masters.length,exports:report.exportedCoreScreens},null,2))
