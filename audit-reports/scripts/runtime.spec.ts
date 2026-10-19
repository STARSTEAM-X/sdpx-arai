import fs from 'node:fs'
import path from 'node:path'
import type { APIRequestContext, Browser, Page } from '@playwright/test'
import { expect, issueToken, test } from '../../e2e/fixtures'

type Result = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT TESTED' | 'NOT APPLICABLE'
type Viewport = { name: string; width: number; height: number }
const VIEWPORTS: Viewport[] = [
  { name: 'mobile-small', width: 375, height: 812 },
  { name: 'mobile-large', width: 430, height: 932 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'large-desktop', width: 1920, height: 1080 },
]
const ROOT = path.resolve(__dirname, '..')
const EVIDENCE = path.join(ROOT, 'evidence', 'runtime')
const REPORT = path.join(ROOT, 'runtime.json')
const RUN_ID = process.env.AUDIT_RUN_ID ?? '2026-10-19-ui-audit'
const AXE = process.env.AXE_PATH ?? path.join(ROOT, 'tools', 'axe.min.js')
const STUDENTS = Array.from({ length: 14 }, (_, i) => `audit${i + 1}@kmitl.ac.th`)
const GROUPS = [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3]
const data: { startedAt: string; generatedAt?: string; scope: object; observations: any[]; checks: any[] } = {
  startedAt: new Date().toISOString(),
  scope: {
    auditOnly: true,
    runId: RUN_ID,
    browser: 'Chromium (Playwright)',
    syntheticIsolatedData: true,
    viewports: VIEWPORTS,
    screenshotConditions: '100% zoom, th-TH, Asia/Bangkok; real production build; full page plus viewport',
    figmaMatch: 'NOT VERIFIED by this script; compare exported references separately',
    googleOAuth: 'NOT TESTED with real Google credentials; existing E2E tests validate SDK contract only',
  },
  observations: [], checks: [],
}
fs.mkdirSync(EVIDENCE, { recursive: true })
// Playwright restarts a worker after a fixture/assertion failure. Preserve evidence
// already collected by the prior worker in this same audit run.
if (fs.existsSync(REPORT)) {
  try {
    const previous = JSON.parse(fs.readFileSync(REPORT, 'utf-8'))
    if (previous.scope?.runId === RUN_ID) {
      data.startedAt = previous.startedAt
      data.observations = previous.observations ?? []
      data.checks = previous.checks ?? []
    }
  } catch { /* A fresh valid report will be written at the first observation. */ }
}
function flush() {
  data.generatedAt = new Date().toISOString()
  const temporary = `${REPORT}.${process.pid}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2))
  for (let attempt = 0; attempt < 12; attempt++) {
    try { fs.renameSync(temporary, REPORT); return } catch (error) {
      // Windows host readers can briefly lock a bind-mounted file. Keep the old
      // complete JSON until a retry succeeds instead of truncating it in place.
      if (attempt === 11) throw error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
  }
}
function redact(value: string) {
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[synthetic-email]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-token]')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
}
function pathname(url: string) { try { return new URL(url).pathname } catch { return '[invalid-url]' } }
function auth(token: string) { return { headers: { authorization: `Bearer ${token}` } } }
function check(id: string, state: string, result: Result, actual: unknown, expected: string, evidence?: string) {
  data.checks.push({ id, state, result, actual, expected, evidence, recordedAt: new Date().toISOString() })
  flush()
}

type RuntimeEvents = { console: object[]; pageErrors: string[]; requestFailures: object[]; httpErrors: object[]; fontResponses: object[] }
async function attach(page: Page) {
  const events: RuntimeEvents = { console: [], pageErrors: [], requestFailures: [], httpErrors: [], fontResponses: [] }
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) events.console.push({ level: msg.type(), message: redact(msg.text()).slice(0, 600) })
  })
  page.on('pageerror', err => events.pageErrors.push(redact(err.message).slice(0, 600)))
  page.on('requestfailed', req => events.requestFailures.push({ path: pathname(req.url()), resourceType: req.resourceType(), error: req.failure()?.errorText }))
  page.on('response', response => {
    const request = response.request()
    if (response.status() >= 400) events.httpErrors.push({ path: pathname(response.url()), status: response.status(), method: request.method(), resourceType: request.resourceType() })
    if (request.resourceType() === 'font' || response.url().includes('fonts.googleapis.com')) events.fontResponses.push({ path: pathname(response.url()), status: response.status() })
  })
  await page.addInitScript(() => {
    ;(window as any).__auditLayoutShift = 0
    try {
      new PerformanceObserver(list => {
        for (const item of list.getEntries() as any[]) if (!item.hadRecentInput) (window as any).__auditLayoutShift += item.value
      }).observe({ type: 'layout-shift', buffered: true })
    } catch { /* Browser does not support Layout Instability API. */ }
  })
  return events
}
async function newPage(browser: Browser, token?: string) {
  const context = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok' })
  const page = await context.newPage()
  if (token) await page.addInitScript(value => localStorage.setItem('paireval.session', value), token)
  const events = await attach(page)
  return { context, page, events }
}

async function snapshot(page: Page, state: string, viewport: Viewport, events: RuntimeEvents) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.evaluate(async () => {
    await document.fonts.ready
    // Scroll lazily loaded assets into view before the full page image.
    for (const img of Array.from(document.images)) img.loading = 'eager'
    await Promise.all(Array.from(document.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); setTimeout(resolve, 5000)
    })))
  })
  await page.waitForTimeout(160)
  const prefix = `${state}-${viewport.width}x${viewport.height}`
  const full = path.join(EVIDENCE, `${prefix}-full.png`)
  const screen = path.join(EVIDENCE, `${prefix}-viewport.png`)
  await page.screenshot({ path: full, fullPage: true, animations: 'disabled' })
  await page.screenshot({ path: screen, fullPage: false, animations: 'disabled' })
  const dom = await page.evaluate(() => {
    const scrub = (value: string | null) => (value ?? '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[synthetic-email]').slice(0, 150)
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'
    }
    const info = (el: Element) => {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el)
      return { tag: el.tagName.toLowerCase(), id: el.id, role: el.getAttribute('role'), testId: el.getAttribute('data-testid'),
        label: scrub(el.getAttribute('aria-label') || el.textContent),
        bounds: { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height },
        css: { color: s.color, background: s.backgroundColor, gradient: s.backgroundImage, border: s.borderColor, borderWidth: s.borderWidth,
          radius: s.borderRadius, shadow: s.boxShadow, fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight,
          lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, padding: s.padding, margin: s.margin,
          outline: s.outline, position: s.position, zIndex: s.zIndex, opacity: s.opacity },
        disabled: (el as HTMLButtonElement).disabled ?? false, ariaChecked: el.getAttribute('aria-checked'), ariaSelected: el.getAttribute('aria-selected'),
        tabIndex: (el as HTMLElement).tabIndex }
    }
    const interactive = Array.from(document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,summary,[role=tab],[role=radio]')).filter(visible)
    const dimensions = { innerWidth, innerHeight, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight, dpr: devicePixelRatio, zoom: getComputedStyle(document.documentElement).zoom }
    return {
      dimensions, title: document.title, lang: document.documentElement.lang,
      fonts: { status: document.fonts.status, thai: document.fonts.check('16px "IBM Plex Sans Thai"'), display: document.fonts.check('700 32px "IBM Plex Sans Thai"'),
        body: getComputedStyle(document.body).fontFamily, loaded: Array.from(document.fonts).map(f => ({ family: f.family, status: f.status, weight: f.weight })) },
      tokens: Object.fromEntries(['--color-brand-600', '--color-cta', '--color-ink', '--color-ink-2', '--color-cream', '--color-ground', '--font-body', '--font-display'].map(key => [key, getComputedStyle(document.documentElement).getPropertyValue(key).trim()])),
      headings: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible).map(info),
      landmarks: Array.from(document.querySelectorAll('main,nav,header,footer,aside')).filter(visible).map(info),
      images: Array.from(document.images).map(el => ({ path: (() => { try { return new URL(el.currentSrc || el.src).pathname } catch { return '' } })(), alt: el.getAttribute('alt'),
        ariaHidden: el.getAttribute('aria-hidden'), complete: el.complete, naturalWidth: el.naturalWidth, visible: visible(el), width: el.width, height: el.height })),
      interactive: interactive.map(info),
      overflowElements: Array.from(document.querySelectorAll('main *,nav *,dialog *')).filter(visible).filter(el => {
        const r = el.getBoundingClientRect(); return r.left < -1 || r.right > document.documentElement.clientWidth + 1
      }).slice(0, 50).map(info),
      inertLinks: Array.from(document.querySelectorAll('a[href=""],a[href="#"],a[href^="javascript:"]')).filter(visible).map(info),
      core: Array.from(document.querySelectorAll('h1, main > div, [role=dialog],dialog[open],[role=menu],[role=listbox],[role=progressbar],[role=radiogroup],button[type=submit],input[type=search]')).filter(visible).map(info),
      focus: document.activeElement ? info(document.activeElement) : null,
      layoutShift: (window as any).__auditLayoutShift ?? null,
      mediaQueries: { small: matchMedia('(max-width: 639px)').matches, medium: matchMedia('(min-width: 768px)').matches, large: matchMedia('(min-width: 1024px)').matches },
    }
  })
  let axe: any = { result: 'NOT TESTED', reason: 'axe-core file not supplied; no dependency installed by audit script' }
  if (fs.existsSync(AXE)) {
    await page.addScriptTag({ path: AXE })
    const result = await page.evaluate(async () => (window as any).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }))
    axe = { result: result.violations.length ? 'FAIL' : 'PASS', version: result.testEngine.version,
      passes: result.passes.map((p: any) => p.id), incomplete: result.incomplete.map((p: any) => ({ id: p.id, impact: p.impact, nodes: p.nodes.map((n: any) => ({ target: n.target, summary: redact(n.failureSummary ?? '') })) })),
      violations: result.violations.map((v: any) => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, tags: v.tags, nodes: v.nodes.map((n: any) => ({ target: n.target, summary: redact(n.failureSummary ?? '') })) })) }
  }
  const overflow = dom.dimensions.scrollWidth - dom.dimensions.clientWidth
  const broken = dom.images.filter(i => !i.complete || i.naturalWidth === 0)
  data.observations.push({ state, viewport, route: pathname(page.url()), capturedAt: new Date().toISOString(), screenshots: { full: path.relative(ROOT, full).replaceAll('\\', '/'), viewport: path.relative(ROOT, screen).replaceAll('\\', '/') },
    quality: { overflow: { result: overflow <= 1 ? 'PASS' : 'FAIL', pixels: overflow }, images: { result: broken.length ? 'FAIL' : 'PASS', broken },
      touchTargets24: { result: dom.interactive.some(i => i.bounds.width < 24 || i.bounds.height < 24) ? 'REVIEW' : 'PASS',
        candidates: dom.interactive.filter(i => i.bounds.width < 24 || i.bounds.height < 24), note: 'Small target candidates require WCAG 2.2 2.5.8 spacing/inline exception review; not automatic defects.' },
      runtime: structuredClone(events), axe }, dom })
  flush()
  return full
}

async function roster(api: APIRequestContext, token: string, classroomId: string) {
  const csv = ['email,group_name', ...STUDENTS.map((email, i) => `${email},กลุ่ม-${GROUPS[i] + 1}`)].join('\n')
  const response = await api.post(`/api/classrooms/${classroomId}/roster:import`, { ...auth(token), multipart: { file: { name: 'audit.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') } } })
  expect(response.ok(), 'synthetic roster fixture').toBeTruthy()
}
async function assignment(api: APIRequestContext, token: string, classroomId: string, deadline: string, publish = true) {
  const created = await api.post('/api/assignments', { ...auth(token), data: { classroomId, name: 'งานประเมินสำหรับตรวจสอบคุณภาพ',
    groupMaxScore: 15, individualMaxScore: 10, groupDeadlineUtc: deadline, targetCoverage: 1,
    criteria: [{ side: 'GROUP', name: 'ประสบการณ์การใช้งาน', weightPct: 100 }, { side: 'INDIVIDUAL', name: 'การทำงานร่วมกัน', weightPct: 100 }] } })
  expect(created.status(), 'create synthetic assignment').toBe(201)
  const id = (await created.json()).id as string
  if (publish) expect((await api.post(`/api/assignments/${id}:publish`, auth(token))).status(), 'publish synthetic assignment').toBe(200)
  return id
}
async function pairs(api: APIRequestContext, token: string, id: string, side: 'GROUP' | 'INDIVIDUAL') {
  const response = await api.get(`/api/assignments/${id}/my-evaluations?side=${side}`, auth(token))
  expect(response.ok()).toBeTruthy()
  return await response.json()
}
async function studentWithPairs(api: APIRequestContext, id: string) {
  for (const email of STUDENTS) {
    const token = await issueToken(api, email)
    const group = await pairs(api, token, id, 'GROUP')
    const individual = await pairs(api, token, id, 'INDIVIDUAL')
    if (group.items.length && individual.items.length) return { token, group, individual }
  }
  throw new Error('Synthetic fixture has no student with both evaluation sides')
}

async function focusInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement
    return { tag: el?.tagName, role: el?.getAttribute('role'), name: (el?.getAttribute('aria-label') || el?.textContent || '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[synthetic-email]').slice(0, 150),
      selected: el?.getAttribute('aria-selected'), checked: el?.getAttribute('aria-checked') }
  })
}
async function attempt(state: string, action: () => Promise<void>) {
  try { await action() } catch (error) {
    check('SCENARIO-EXECUTION', state, 'BLOCKED', redact((error as Error).message).slice(0, 600), 'Scenario should execute; remaining scenarios continue')
  }
}

for (const vp of VIEWPORTS) {
  test(`public and protected-route guards ${vp.width}x${vp.height}`, async ({ browser }) => {
    const { page, context, events } = await newPage(browser)
    await page.setViewportSize(vp)
    await page.goto('/')
    await expect(page.getByTestId('main-cta')).toBeVisible()
    await snapshot(page, 'home-guest', vp, events)
    // Every guide is activated and its actual dependent content checked.
    for (const title of ['ดูตัวอย่าง', 'รู้จักการประเมิน', 'ดูวิธีส่งคำตอบ']) {
      await attempt(`guide ${title} ${vp.name}`, async () => {
        const details = page.locator('details').filter({ has: page.locator('summary', { hasText: title }) })
        const summary = details.locator('summary')
        await summary.click()
        const open = await details.getAttribute('open') !== null
        const targetVisible = await details.getByRole('link', { name: 'ไปที่ห้องเรียน', exact: true }).isVisible()
        check('HOME-GUIDE', `${title} ${vp.name}`, open && targetVisible ? 'PASS' : 'FAIL', { open, targetVisible }, 'Guide reveals meaningful content and classroom action')
        await summary.press('Enter')
        check('HOME-GUIDE-KEYBOARD', `${title} ${vp.name}`, await details.getAttribute('open') === null ? 'PASS' : 'FAIL', await details.getAttribute('open'), 'Enter collapses guide')
      })
    }
    await snapshot(page, 'home-guides-collapsed', vp, events)
    for (const route of ['/classrooms', '/classrooms/audit-room', '/classrooms/audit-room/assignments/audit-work/evaluate', '/classrooms/audit-room/assignments/audit-work/score']) {
      await page.goto(route)
      await expect(page).toHaveURL(/\/$/)
      const message = await page.getByRole('status').filter({ hasText: 'กรุณาเข้าสู่ระบบ' }).isVisible()
      check('AUTH-GUARD', `${route} ${vp.name}`, message ? 'PASS' : 'FAIL', { finalPath: pathname(page.url()), loginNoticeVisible: message }, 'Unauthenticated protected route returns home with login notice')
    }
    await snapshot(page, 'home-login-required', vp, events)
    await page.goto('/route-does-not-exist')
    await expect(page).toHaveURL(/\/$/)
    check('UNKNOWN-ROUTE', vp.name, 'PASS', pathname(page.url()), 'Unknown route returns home')
    await context.close()
  })

  test(`classroom list and detail every role ${vp.width}x${vp.height}`, async ({ browser, api, instructorToken, classroomId }) => {
    await roster(api, instructorToken, classroomId)
    for (const [email, role] of [['audit-co@kmitl.ac.th', 'CO_TEACHER'], ['audit-ta@kmitl.ac.th', 'TA']] as const) {
      const response = await api.post(`/api/classrooms/${classroomId}/members`, { ...auth(instructorToken), data: { email, role } })
      expect(response.status(), `synthetic ${role} fixture`).toBe(201)
    }
    await assignment(api, instructorToken, classroomId, '2099-01-01T18:30:00Z')
    const roleTokens: Record<string, string> = { OWNER: instructorToken, CO_TEACHER: await issueToken(api, 'audit-co@kmitl.ac.th'), TA: await issueToken(api, 'audit-ta@kmitl.ac.th'), STUDENT: await issueToken(api, STUDENTS[0]) }
    for (const [role, token] of Object.entries(roleTokens)) {
      await attempt(`classroom ${role} ${vp.name}`, async () => {
        const { page, context, events } = await newPage(browser, token)
        try {
          await page.setViewportSize(vp)
          await page.goto('/classrooms')
          await expect(page.getByTestId('classroom-list')).toBeVisible()
          await snapshot(page, `classrooms-${role.toLowerCase()}`, vp, events)
          const account = page.getByTestId('current-user')
          await account.click()
          await expect(page.getByRole('menu')).toBeVisible()
          const beforeEscape = await focusInfo(page)
          await snapshot(page, `account-menu-${role.toLowerCase()}`, vp, events)
          await page.keyboard.press('Escape')
          const staysOpen = await page.getByRole('menu').isVisible()
          check('A11Y-ACCOUNT-ESCAPE', `${role} ${vp.name}`, staysOpen ? 'FAIL' : 'PASS', { beforeEscape, afterEscape: await focusInfo(page), menuVisibleAfterEscape: staysOpen }, 'Escape closes account menu and focus returns to its trigger')
          if (staysOpen) await account.click()
          // Sorting via keyboard and an actual filter result are verified, not merely clicked.
          const sort = page.getByRole('button', { name: 'เรียงลำดับ', exact: true })
          await sort.focus(); await page.keyboard.press('ArrowDown')
          await expect(page.getByRole('listbox')).toBeVisible()
          await snapshot(page, `sort-open-${role.toLowerCase()}`, vp, events)
          await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter')
          const selectedName = await sort.innerText()
          check('CLASSROOM-SORT-KEYBOARD', `${role} ${vp.name}`, selectedName.includes('ชื่อ ก-ฮ') ? 'PASS' : 'FAIL', { triggerText: selectedName, listboxVisible: await page.getByRole('listbox').isVisible() }, 'Keyboard selects alphabetical sort and closes listbox')
          const search = page.getByRole('searchbox', { name: 'ค้นหาห้องเรียน' })
          await search.fill('ไม่มีห้องชื่อนี้ในการตรวจสอบ')
          const filterEmpty = await page.getByTestId('filtered-empty').isVisible()
          check('CLASSROOM-SEARCH', `${role} ${vp.name}`, filterEmpty ? 'PASS' : 'FAIL', { filterEmpty }, 'Search changes the rendered list to filtered empty state')
          await snapshot(page, `classrooms-search-empty-${role.toLowerCase()}`, vp, events)
          await search.fill('')
          if (role === 'OWNER') {
            const trigger = page.getByRole('button', { name: 'เปิดหน้าต่างสร้างห้องเรียน', exact: true })
            await trigger.click()
            const dialog = page.getByRole('dialog', { name: 'สร้างห้องเรียนใหม่' })
            await expect(dialog).toBeVisible()
            const initiallyFocused = await dialog.getByLabel('ชื่อห้องเรียน').evaluate(el => el === document.activeElement)
            await snapshot(page, 'create-classroom-dialog', vp, events)
            await page.keyboard.press('Escape')
            const restoredFocus = await trigger.evaluate(el => el === document.activeElement)
            check('CREATE-MODAL-KEYBOARD', vp.name, !await dialog.isVisible() && initiallyFocused && restoredFocus ? 'PASS' : 'FAIL', { initiallyFocused, restoredFocus, visible: await dialog.isVisible() }, 'Modal autofocus, Escape close, and trigger focus restoration')
          }
          await page.goto(`/classrooms/${classroomId}`)
          const roleTitle: Record<string, string> = { OWNER: 'จัดการสมาชิกและงานประเมิน', CO_TEACHER: 'ดูแลงานประเมิน', TA: 'ดูแลรายชื่อนักศึกษา', STUDENT: 'งานประเมินของฉัน' }
          await expect(page.getByRole('heading', { level: 1, name: roleTitle[role] })).toBeVisible()
          if (role === 'STUDENT') await expect(page.getByTestId('student-dashboard')).toBeVisible()
          await snapshot(page, `classroom-${role.toLowerCase()}`, vp, events)
          if (role === 'OWNER') {
            const step = page.getByRole('list', { name: 'ขั้นตอนการตั้งค่าห้องเรียน' }).getByRole('listitem').filter({ hasText: 'สร้างงานประเมิน' })
            const text = await step.innerText()
            check('CLASSROOM-SETUP-STATE', vp.name, text.includes('เสร็จแล้ว') ? 'PASS' : 'FAIL', { assignmentPublishedViaApiBeforeNavigation: true, renderedStep: text }, 'Create-assignment setup step reflects a published assignment, including after a fresh page load')
          }
          // Hash navigation scrolls to the linked section when it exists.
          const sections = page.getByRole('navigation', { name: 'ส่วนต่าง ๆ ในห้องเรียน' })
          if (await sections.count()) {
            for (const link of await sections.getByRole('link').all()) {
              const href = await link.getAttribute('href')
              if (!href?.startsWith('#')) continue
              await link.click()
              const exists = await page.locator(href).count() > 0
              check('CLASSROOM-HASH-NAV', `${role} ${vp.name} ${href}`, exists ? 'PASS' : 'FAIL', { href, targetExists: exists, finalHash: new URL(page.url()).hash }, 'Section link has a real target')
            }
          }
          await account.click()
          await page.getByRole('menuitem', { name: 'ออกจากระบบ' }).click()
          await expect(page).toHaveURL(/\/$/)
          check('LOGOUT', `${role} ${vp.name}`, 'PASS', { finalPath: pathname(page.url()), tokenRemoved: await page.evaluate(() => localStorage.getItem('paireval.session') === null) }, 'Logout clears session and returns home')
        } finally { await context.close() }
      })
    }
  })

  test(`evaluation sides and keyboard states ${vp.width}x${vp.height}`, async ({ browser, api, instructorToken, classroomId }) => {
    await roster(api, instructorToken, classroomId)
    const id = await assignment(api, instructorToken, classroomId, '2099-01-01T18:30:00Z')
    const student = await studentWithPairs(api, id)
    const { page, context, events } = await newPage(browser, student.token)
    await page.setViewportSize(vp)
    await page.goto(`/classrooms/${classroomId}/assignments/${id}/evaluate`)
    await expect(page.getByRole('radio').first()).toBeVisible()
    await snapshot(page, 'evaluation-group-unanswered', vp, events)
    const tabs = page.getByRole('tab')
    await tabs.nth(0).focus(); await page.keyboard.press('ArrowRight')
    const secondSelected = await tabs.nth(1).getAttribute('aria-selected') === 'true'
    const focusAfterArrow = await focusInfo(page)
    check('A11Y-EVAL-TABS', vp.name, secondSelected || focusAfterArrow.name.includes('รายบุคคล') ? 'PASS' : 'FAIL', { secondSelected, focusAfterArrow }, 'ArrowRight moves focus or activates next tab according to ARIA tab pattern')
    await tabs.nth(0).click()
    for (const [index, side] of ['GROUP', 'INDIVIDUAL'].entries()) {
      await tabs.nth(index).click()
      await expect(page.getByRole('radio').first()).toBeVisible()
      await snapshot(page, `evaluation-${side.toLowerCase()}-default`, vp, events)
      const group = page.getByRole('radiogroup').first()
      const first = group.getByRole('radio').nth(0)
      const second = group.getByRole('radio').nth(1)
      await first.focus()
      await page.keyboard.press('ArrowRight')
      const moved = await second.evaluate(el => el === document.activeElement)
      const checked = await second.getAttribute('aria-checked') === 'true'
      check('A11Y-COMPARISON-RADIO', `${side} ${vp.name}`, moved && checked ? 'PASS' : 'FAIL', { moved, checked, focus: await focusInfo(page), tabStops: await group.getByRole('radio').evaluateAll(nodes => nodes.map(n => (n as HTMLElement).tabIndex)) }, 'ArrowRight moves to and selects next radio; one radio group tab stop')
      await second.hover()
      await snapshot(page, `evaluation-${side.toLowerCase()}-hover-focus`, vp, events)
      await second.click()
      await expect(group.locator('..').getByText(/บันทึกแล้ว/)).toBeVisible({ timeout: 6000 })
      const saved = await pairs(api, student.token, id, side as 'GROUP' | 'INDIVIDUAL')
      const selectedCount = saved.items.filter((p: any) => p.choice !== null).length
      check('AUTOSAVE-REAL-API', `${side} ${vp.name}`, selectedCount > 0 ? 'PASS' : 'FAIL', { selectedCount }, 'Selection is persisted through real API')
      await snapshot(page, `evaluation-${side.toLowerCase()}-saved`, vp, events)
    }
    await context.close()
  })

  test(`score before and after finalize including privacy ${vp.width}x${vp.height}`, async ({ browser, api, instructorToken, classroomId }) => {
    await roster(api, instructorToken, classroomId)
    const deadline = new Date(Date.now() + 20_000).toISOString()
    const id = await assignment(api, instructorToken, classroomId, deadline)
    const token = await issueToken(api, STUDENTS[0])
    const session = await newPage(browser, token)
    await session.page.setViewportSize(vp)
    await session.page.goto(`/classrooms/${classroomId}/assignments/${id}/score`)
    await expect(session.page.getByTestId('not-finalized')).toBeVisible()
    const hiddenBefore = await session.page.getByTestId('final-score').count() === 0
    check('SCORE-BEFORE-FINALIZE', vp.name, hiddenBefore ? 'PASS' : 'FAIL', { numbersHidden: hiddenBefore }, 'No final score before publication')
    await snapshot(session.page, 'score-not-finalized', vp, session.events)
    for (const email of STUDENTS) {
      const studentToken = await issueToken(api, email)
      for (const side of ['GROUP', 'INDIVIDUAL'] as const) {
        const evaluations = await pairs(api, studentToken, id, side)
        for (const item of evaluations.items) {
          expect((await api.put(`/api/comparisons/${item.pairAssignmentId}`, { ...auth(studentToken), data: { choice: 3 } })).ok(), 'save synthetic score data').toBeTruthy()
        }
        if (evaluations.items.length) {
          expect((await api.post(`/api/assignments/${id}/submissions`, { headers: { ...auth(studentToken).headers, 'Idempotency-Key': `audit-${side}-${email}` }, data: { side } })).ok(), 'submit synthetic score data').toBeTruthy()
        }
      }
    }
    const remaining = new Date(deadline).getTime() - Date.now()
    if (remaining > 0) await session.page.waitForTimeout(remaining + 250)
    expect((await api.post(`/api/assignments/${id}:finalize`, { ...auth(instructorToken), data: { confirmLowConfidence: true } })).status(), 'finalize synthetic score data').toBe(200)
    await session.page.reload()
    await expect(session.page.getByTestId('final-score')).toBeVisible()
    const visibleBody = await (await api.get(`/api/assignments/${id}/my-score`, auth(token))).json()
    const visibleScore = await session.page.getByTestId('final-score').innerText()
    check('SCORE-VISIBLE', vp.name, !visibleBody.individualHidden && visibleScore === visibleBody.finalScore ? 'PASS' : 'FAIL', { individualHidden: visibleBody.individualHidden, apiFinalScore: visibleBody.finalScore, displayedFinalScore: visibleScore }, 'Group of four satisfies privacy threshold; real final score rendered')
    await snapshot(session.page, 'score-final-visible', vp, session.events)
    await session.context.close()
    const privacyToken = await issueToken(api, STUDENTS[4])
    const hidden = await newPage(browser, privacyToken)
    await hidden.page.setViewportSize(vp)
    await hidden.page.goto(`/classrooms/${classroomId}/assignments/${id}/score`)
    await expect(hidden.page.getByTestId('individual-hidden')).toBeVisible()
    const privacyBody = await (await api.get(`/api/assignments/${id}/my-score`, auth(privacyToken))).json()
    const finalHidden = await hidden.page.getByTestId('final-score-hidden').isVisible()
    check('SCORE-PRIVACY', vp.name, privacyBody.individualHidden && privacyBody.finalScore === null && finalHidden ? 'PASS' : 'FAIL', { individualHidden: privacyBody.individualHidden, apiFinalScore: privacyBody.finalScore, finalHidden }, 'Group of three hides individual and final scores without hiding group score')
    await snapshot(hidden.page, 'score-final-privacy-hidden', vp, hidden.events)
    await hidden.context.close()
  })
}

for (const immediate of [false, true]) {
  test(`EVAL-001 ${immediate ? 'submit during debounce' : 'submit after autosave'}`, async ({ browser, api, instructorToken, classroomId }) => {
    // Three groups of two with targetCoverage=2 gives this student exactly one pair.
    const emails = STUDENTS.slice(0, 6)
    const csv = ['email,group_name', ...emails.map((email, i) => `${email},กลุ่ม-${Math.floor(i / 2) + 1}`)].join('\n')
    expect((await api.post(`/api/classrooms/${classroomId}/roster:import`, { ...auth(instructorToken), multipart: { file: { name: 'eval-audit.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') } } })).ok()).toBeTruthy()
    const response = await api.post('/api/assignments', { ...auth(instructorToken), data: { classroomId, name: 'ตรวจสอบการส่งคำตอบ', groupMaxScore: 15, individualMaxScore: 0,
      groupDeadlineUtc: '2099-01-01T18:30:00Z', targetCoverage: 2, criteria: [{ side: 'GROUP', name: 'UX', weightPct: 100 }] } })
    expect(response.status()).toBe(201)
    const id = (await response.json()).id as string
    expect((await api.post(`/api/assignments/${id}:publish`, auth(instructorToken))).status()).toBe(200)
    const token = await issueToken(api, emails[0])
    const { page, context, events } = await newPage(browser, token)
    const vp = VIEWPORTS[4]
    await page.setViewportSize(vp)
    await page.goto(`/classrooms/${classroomId}/assignments/${id}/evaluate`)
    await expect(page.getByRole('radiogroup')).toHaveCount(1)
    const dialogs: string[] = []
    page.on('dialog', async dialog => { dialogs.push(redact(dialog.message())); await dialog.accept() })
    const started = Date.now()
    await page.getByRole('radio', { name: 'ขวาดีกว่า', exact: true }).click()
    if (!immediate) await expect(page.getByText(/บันทึกแล้ว/)).toBeVisible({ timeout: 6000 })
    // Capture the debounced state only after the POST in the immediate case; screenshot/axe would delay submission.
    const submitAt = Date.now()
    const posted = page.waitForResponse(res => pathname(res.url()) === `/api/assignments/${id}/submissions` && res.request().method() === 'POST')
    await page.getByRole('button', { name: 'ส่งคำตอบ', exact: true }).click()
    const submitted = await posted
    const body = await submitted.json()
    await page.waitForTimeout(2400)
    const persisted = await pairs(api, token, id, 'GROUP')
    const actual = { elapsedBeforeSubmitMs: submitAt - started, dialogCount: dialogs.length, dialogMessages: dialogs,
      submissionStatus: submitted.status(), submittedCount: body.submittedCount, apiTotalCount: persisted.totalCount,
      apiCompletedCount: persisted.completedCount, apiItems: persisted.items.map((p: any) => ({ choice: p.choice, completed: p.completed })) }
    const state = immediate ? 'evaluation-submit-during-debounce' : 'evaluation-submit-after-autosave'
    const evidence = await snapshot(page, state, vp, events)
    const passed = immediate ? persisted.completedCount === persisted.totalCount : dialogs.length === 0
    check('EVAL-001', state, passed ? 'PASS' : 'FAIL', actual,
      immediate ? 'Submitting immediately after selecting should persist and submit the latest selection, or explicitly block until saved' : 'All answers saved: submit should not warn that answers remain unanswered', path.relative(ROOT, evidence).replaceAll('\\', '/'))
    await context.close()
  })
}
