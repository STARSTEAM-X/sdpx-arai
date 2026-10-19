import fs from 'node:fs'
import path from 'node:path'
import { test, expect, issueToken } from '../../e2e/fixtures'
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'evidence/visual')
fs.mkdirSync(out, { recursive: true })
const emails = Array.from({ length: 14 }, (_, i) => `visual${i+1}@kmitl.ac.th`)
const groups = [0,0,0,0,1,1,1,2,2,2,3,3,3,3]
const auth = (token: string) => ({ headers: { authorization: `Bearer ${token}` } })
test('reference-compatible owner state and student multi-criterion desktop/mobile', async ({ page, api, instructorToken, classroomId }) => {
  const csv = ['email,group_name', ...emails.map((email,i) => `${email},${['Aurora','Borealis','Cygnus','Draco'][groups[i]]}`)].join('\n')
  expect((await api.post(`/api/classrooms/${classroomId}/roster:import`, { ...auth(instructorToken), multipart: { file: { name: 'visual.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) } } })).ok()).toBeTruthy()
  await page.addInitScript(token => { if (!localStorage.getItem('paireval.session')) localStorage.setItem('paireval.session', token) }, instructorToken)
  await page.goto(`/classrooms/${classroomId}`)
  await expect(page.getByRole('heading', { level: 1, name: 'จัดการสมาชิกและงานประเมิน' })).toBeVisible()
  await page.evaluate(async () => { await document.fonts.ready })
  await page.screenshot({ path: path.join(out, 'owner-members-no-assignment-1440.png'), fullPage: true })
  const deadlineMs = Date.now() + 20_000
  const created = await api.post('/api/assignments', { ...auth(instructorToken), data: { classroomId, name: 'งานกลุ่มครั้งที่ 1', groupMaxScore: 15, individualMaxScore: 5,
    groupDeadlineUtc: new Date(deadlineMs).toISOString(), targetCoverage: 1,
    criteria: [{ side:'GROUP', name:'ประสบการณ์การใช้งาน',weightPct:40 },{ side:'GROUP', name:'ความครบถ้วนของงาน',weightPct:35 },{ side:'GROUP', name:'ความคิดสร้างสรรค์',weightPct:25 },{ side:'INDIVIDUAL',name:'การทำงานร่วมกับทีม',weightPct:50 },{ side:'INDIVIDUAL',name:'การจัดการงาน',weightPct:50 }] } })
  expect(created.status()).toBe(201)
  const id = (await created.json()).id
  expect((await api.post(`/api/assignments/${id}:publish`, auth(instructorToken))).status()).toBe(200)
  const token = await issueToken(api, emails[0])
  await page.evaluate(value => localStorage.setItem('paireval.session', value), token)
  for (const width of [1440,390]) {
    await page.setViewportSize({ width, height: width===390 ? 844 : 900 })
    await page.goto(`/classrooms/${classroomId}/assignments/${id}/evaluate`)
    await expect(page.getByRole('radiogroup')).toHaveCount(3)
    await page.evaluate(async () => { await document.fonts.ready })
    await page.screenshot({ path: path.join(out, `evaluation-three-criteria-${width}.png`), fullPage: true })
  }
  await page.goto('/classrooms')
  await expect(page.getByTestId('classroom-list')).toBeVisible()
  await page.screenshot({ path: path.join(out, 'student-classrooms-390.png'), fullPage: true })
  await page.goto(`/classrooms/${classroomId}`)
  await expect(page.getByTestId('student-dashboard')).toBeVisible()
  await page.screenshot({ path: path.join(out, 'student-classroom-390.png'), fullPage: true })
  // Complete actual API submissions solely to show published own-score design state.
  for (const email of emails) {
    const session = await issueToken(api, email)
    for (const side of ['GROUP','INDIVIDUAL']) {
      const data = await (await api.get(`/api/assignments/${id}/my-evaluations?side=${side}`, auth(session))).json()
      for (const item of data.items) expect((await api.put(`/api/comparisons/${item.pairAssignmentId}`, { ...auth(session), data: { choice: 3 } })).ok()).toBeTruthy()
      if (data.items.length) expect((await api.post(`/api/assignments/${id}/submissions`, { headers: { ...auth(session).headers, 'Idempotency-Key': `visual-${side}-${email}` }, data: { side } })).ok()).toBeTruthy()
    }
  }
  if (Date.now() <= deadlineMs) await page.waitForTimeout(deadlineMs-Date.now()+250)
  expect((await api.post(`/api/assignments/${id}:finalize`, { ...auth(instructorToken), data: { confirmLowConfidence:true } })).status()).toBe(200)
  for (const width of [1440,390]) {
    await page.setViewportSize({ width, height: width===390 ? 844 : 900 })
    await page.goto(`/classrooms/${classroomId}/assignments/${id}/score`)
    await expect(page.getByTestId('final-score')).toBeVisible()
    await page.evaluate(async () => { await document.fonts.ready })
    await page.screenshot({ path: path.join(out, `score-three-two-criteria-${width}.png`), fullPage: true })
  }
  fs.writeFileSync(path.join(out, 'conditions.json'), JSON.stringify({ status:'PASS', syntheticData:true, groupCriteria:3, individualCriteria:2, groupMaxScore:15, individualMaxScore:5, exactFigmaMobileWidth:390,
    note:'Values/names/counts differ from Figma fixture. Compare structure, presence, styling and behavior; do not treat all pixel differences as bugs.', screenshots: fs.readdirSync(out).filter(p=>p.endsWith('.png')) }, null, 2))
})

test('manual keyboard verification of read-only mobile roster scrolling', async ({ browser, api, instructorToken, classroomId }) => {
  const csv=['email,group_name',...emails.map((email,i)=>`${email},กลุ่ม-${groups[i]+1}`)].join('\n')
  expect((await api.post(`/api/classrooms/${classroomId}/roster:import`,{...auth(instructorToken),multipart:{file:{name:'keyboard.csv',mimeType:'text/csv',buffer:Buffer.from(csv)}}})).ok()).toBeTruthy()
  const roleTokens:Record<string,string>={STUDENT:await issueToken(api,emails[0])}
  for(const role of ['TA','CO_TEACHER']){
    const email=`keyboard-${role.toLowerCase()}@kmitl.ac.th`
    expect((await api.post(`/api/classrooms/${classroomId}/members`,{...auth(instructorToken),data:{email,role}})).status()).toBe(201)
    roleTokens[role]=await issueToken(api,email)
  }
  const checks:object[]=[]
  for(const [role,token] of Object.entries(roleTokens))for(const width of [375,430]){
    const context=await browser.newContext({viewport:{width,height:812},locale:'th-TH',timezoneId:'Asia/Bangkok'})
    const page=await context.newPage()
    await page.addInitScript(value=>localStorage.setItem('paireval.session',value),token)
    await page.goto(`/classrooms/${classroomId}`)
    const table=page.getByRole('table')
    await expect(table).toBeVisible()
    const wrapper=table.locator('..')
    await page.getByRole('searchbox').first().focus()
    const focuses:object[]=[]
    let keyboardReachedWrapper=false,scrollBefore=0,scrollAfter=0
    for(let i=0;i<16;i++){
      await page.keyboard.press('Tab')
      const active=await wrapper.evaluate(el=>({wrapperFocused:el===document.activeElement,tag:document.activeElement?.tagName,role:document.activeElement?.getAttribute('role'),label:document.activeElement?.getAttribute('aria-label'),scrollLeft:el.scrollLeft,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,tabIndex:(el as HTMLElement).tabIndex}))
      focuses.push(active)
      if(active.wrapperFocused){keyboardReachedWrapper=true;scrollBefore=active.scrollLeft;await page.keyboard.press('ArrowRight');await page.waitForTimeout(250);scrollAfter=await wrapper.evaluate(el=>el.scrollLeft);break}
    }
    checks.push({viewport:{width,height:812},role,keyboardReachedWrapper,scrollBefore,scrollAfter,focuses})
    await page.screenshot({path:path.join(out,`roster-keyboard-${role.toLowerCase()}-${width}.png`),fullPage:false})
    await context.close()
  }
  fs.writeFileSync(path.join(out,'roster-keyboard.json'),JSON.stringify({browser:'PlaywrightChromium',checks,note:'RealTab/ArrowRight probes; no app tabindex/CSS/source change. Do not infer cross-browser conformance.'},null,2))
})
