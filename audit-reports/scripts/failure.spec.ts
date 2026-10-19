import fs from 'node:fs'
import path from 'node:path'
import type { APIRequestContext, Download, Page, Route } from '@playwright/test'

import { expect, issueToken, test } from '../../e2e/fixtures'

type Result = 'PASS' | 'FAIL' | 'BLOCKED'
const ROOT = path.resolve(__dirname, '..')
const EVIDENCE = path.join(ROOT, 'evidence/failure')
const REPORT = path.join(EVIDENCE, 'checks.json')
const RUN_ID = process.env.AUDIT_FAILURE_RUN_ID ?? '2026-10-19-failure-audit'
const SESSION_KEY = 'paireval.session'
const JOB_NAME = 'งานตรวจสอบการอัปเดตหลังเผยแพร่'
const report: { runId: string; startedAt: string; updatedAt?: string; scope: object; checks: object[] } = {
  runId: RUN_ID,
  startedAt: new Date().toISOString(),
  scope: {
    auditOnly: true,
    syntheticIsolatedData: true,
    viewport: { width: 1440, height: 900 },
    googleOAuth: 'NOT TESTED — fixture issues application sessions',
    resultMeaning: 'Product observations are PASS/FAIL; Playwright test pass only means the audit scenario completed',
    injectedFailures: 'Only browser export/me responses in export401 test are synthetic401; no real credential revocation',
  },
  checks: [],
}
fs.mkdirSync(EVIDENCE, { recursive: true })
if (fs.existsSync(REPORT)) {
  try {
    const prior = JSON.parse(fs.readFileSync(REPORT, 'utf8'))
    if (prior.runId === RUN_ID) {
      report.startedAt = prior.startedAt
      report.checks = prior.checks ?? []
    }
  } catch { /* A valid audit report is written at the next observation. */ }
}
function sanitize(value: unknown): unknown {
  if (typeof value === 'string') return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[synthetic-email]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-token]')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]')
  if (Array.isArray(value)) return value.map(sanitize)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]))
  return value
}
function record(id: string, result: Result, actual: object, expected: string, screenshots: string[] = []) {
  report.checks.push(sanitize({ id, result, actual, expected, screenshots, recordedAt: new Date().toISOString() }) as object)
  report.updatedAt = new Date().toISOString()
  const temporary = `${REPORT}.${process.pid}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(report, null, 2))
  for (let attempt = 0; attempt < 12; attempt++) {
    try { fs.renameSync(temporary, REPORT); return } catch (error) {
      if (attempt === 11) throw error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
  }
}
function auth(token: string) { return { headers: { authorization: `Bearer ${token}` } } }
function pathname(url: string) { return new URL(url).pathname }
async function screenshot(page: Page, name: string) {
  await page.evaluate(async () => { await document.fonts.ready })
  const target = path.join(EVIDENCE, `${name}.png`)
  await page.screenshot({ path: target, fullPage: true, animations: 'disabled' })
  return path.relative(ROOT, target).replaceAll('\\', '/')
}
async function seedRoster(api: APIRequestContext, token: string, classroomId: string) {
  const csv = ['email,group_name', ...Array.from({ length: 12 }, (_, index) => `failure${index + 1}@kmitl.ac.th,กลุ่ม-${index % 3 + 1}`)].join('\n')
  const response = await api.post(`/api/classrooms/${classroomId}/roster:import`, {
    ...auth(token), multipart: { file: { name: 'audit-roster.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') } },
  })
  expect(response.ok(), 'isolated synthetic roster fixture').toBeTruthy()
}
async function publishedFixture(api: APIRequestContext, token: string, classroomId: string, options: { deadline?: string; coverage?: number } = {}) {
  await seedRoster(api, token, classroomId)
  const response = await api.post('/api/assignments', {
    ...auth(token), data: { classroomId, name: 'งานสำหรับตรวจ export', groupMaxScore: 15, individualMaxScore: 0,
      groupDeadlineUtc: options.deadline ?? '2099-01-01T18:30:00Z', targetCoverage: options.coverage ?? 1, criteria: [{ side: 'GROUP', name: 'คุณภาพงาน', weightPct: 100 }] },
  })
  expect(response.status(), 'create isolated fixture assignment').toBe(201)
  const id = (await response.json()).id as string
  expect((await api.post(`/api/assignments/${id}:publish`, auth(token))).status(), 'publish isolated fixture assignment').toBe(200)
  return id
}
async function downloadText(download: Download) {
  const stream = await download.createReadStream()
  if (!stream) throw new Error('Browser download did not provide a readable stream')
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}
function queueDialogs(page: Page) {
  const responses: (string | null)[] = []
  const seen: { type: string; message: string }[] = []
  page.on('dialog', async dialog => {
    seen.push({ type: dialog.type(), message: dialog.message() })
    const answer = responses.shift()
    if (answer === null || answer === undefined) await dialog.dismiss()
    else await dialog.accept(answer)
  })
  return { responses, seen }
}
async function mock401(route: Route) {
  const origin = route.request().headers().origin ?? 'http://localhost:8080'
  const headers = {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
  }
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
  return route.fulfill({ status: 401, headers, json: { error: { code: 'SESSION_EXPIRED', message: 'เซสชันหมดอายุ (audit injection)', field: null, details: [], requestId: 'audit-synthetic-request' } } })
}

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) record('AUDIT-SCENARIO-BLOCKED', 'BLOCKED', {
    scenario: testInfo.title,
    error: testInfo.error?.message?.slice(0, 1500),
  }, 'Scenario prerequisites and audit instrumentation complete; product failures are recorded separately')
})

test('published assignment refreshes sibling tools after real UI create and publish', async ({ signedInPage: page, api, instructorToken, classroomId }) => {
  // The classroom/session and roster are fixtures; draft creation, feasibility and publish are real browser actions.
  await seedRoster(api, instructorToken, classroomId)
  const assignmentListPath = `/api/classrooms/${classroomId}/assignments`
  let listResponses = 0
  page.on('response', response => { if (pathname(response.url()) === assignmentListPath && response.request().method() === 'GET') listResponses += 1 })
  await page.goto(`/classrooms/${classroomId}#assignments`)
  await expect(page.getByTestId('assignment-panel')).toBeVisible()
  await expect.poll(() => listResponses, { message: 'Both sibling lists completed initial loading' }).toBeGreaterThanOrEqual(2)
  await expect(page.getByTestId('assignment-scoring-card')).toHaveCount(0)
  const initialListResponses = listResponses
  await page.getByLabel('ชื่องานประเมิน', { exact: true }).fill(JOB_NAME)
  await page.getByLabel('จำนวนคู่ที่ผู้ประเมินแต่ละคนต้องประเมิน', { exact: true }).fill('1')
  await page.getByLabel('คะแนนเต็มรายบุคคล', { exact: true }).fill('0')
  await page.getByLabel('กำหนดส่ง', { exact: true }).click()
  await page.getByRole('button', { name: 'พรุ่งนี้', exact: true }).click()
  await page.getByRole('combobox', { name: 'ชั่วโมง', exact: true }).selectOption('23')
  await page.getByRole('combobox', { name: 'นาที', exact: true }).selectOption('59')
  await page.getByRole('button', { name: 'ยืนยันกำหนดส่ง', exact: true }).click()
  const createdResponse = page.waitForResponse(response => pathname(response.url()) === '/api/assignments' && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'สร้างงานประเมิน', exact: true }).click()
  const created = await createdResponse
  expect(created.status()).toBe(201)
  const id = (await created.json()).id as string
  await expect(page.getByTestId('assignment-status')).toContainText('DRAFT')
  await page.getByRole('button', { name: 'ตรวจความเป็นไปได้', exact: true }).click()
  await expect(page.getByTestId('feasibility-GROUP')).toBeVisible()
  const publishedResponse = page.waitForResponse(response => pathname(response.url()) === `/api/assignments/${id}:publish` && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'เผยแพร่และจัดคู่', exact: true }).click()
  expect((await publishedResponse).status()).toBe(200)
  await expect(page.getByTestId('publish-result')).toBeVisible()
  await expect(page.getByTestId('assignment-status')).toContainText('PUBLISHED')
  // A refresh should be immediate after mutation; allow a bounded grace period before recording DOM and requests.
  await page.waitForTimeout(500)
  const beforeReload = {
    backendPublished: ((await (await api.get(assignmentListPath, auth(instructorToken))).json()).items as any[]).some(item => item.id === id && item.status === 'PUBLISHED'),
    evaluateLinkCount: await page.getByTestId(`evaluate-link-${id}`).count(),
    scoringCardCount: await page.getByTestId('assignment-scoring-card').count(),
    initialListResponses,
    listResponsesAfterPublish: listResponses,
  }
  const beforeScreenshot = await screenshot(page, 'assignment-published-before-reload')
  await page.reload()
  await expect(page.getByTestId(`evaluate-link-${id}`)).toBeAttached()
  await expect(page.getByTestId('assignment-scoring-card')).toContainText(JOB_NAME)
  const afterReload = { evaluateLinkCount: await page.getByTestId(`evaluate-link-${id}`).count(), scoringCardCount: await page.getByTestId('assignment-scoring-card').count(), listResponses }
  const afterScreenshot = await screenshot(page, 'assignment-published-after-reload')
  record('ASSIGNMENT-LIST-REFRESH', beforeReload.evaluateLinkCount > 0 && beforeReload.scoringCardCount > 0 ? 'PASS' : 'FAIL', { beforeReload, afterReload },
    'Successful real UI publish refreshes assignment-entry and scoring siblings without a browser reload', [beforeScreenshot, afterScreenshot])
  const step = page.getByRole('list', { name: 'ขั้นตอนการตั้งค่าห้องเรียน' }).getByRole('listitem').filter({ hasText: 'สร้างงานประเมิน' })
  const renderedStep = await step.innerText()
  record('CLASSROOM-SETUP-STATE', renderedStep.includes('เสร็จแล้ว') ? 'PASS' : 'FAIL', { publishedViaRealUi: true, reloaded: true, renderedStep },
    'Setup step reports created assignment as completed, including after fresh data load', [afterScreenshot])
})

test('export401 clears session consistently with the JSON API boundary', async ({ signedInPage: page, api, instructorToken, classroomId }) => {
  const id = await publishedFixture(api, instructorToken, classroomId)
  await page.goto(`/classrooms/${classroomId}#scores`)
  const scoring = page.getByTestId('assignment-scoring-card')
  await expect(scoring).toBeVisible()
  const exportPath = `/api/assignments/${id}/comparisons:export`
  let injectedGetCount = 0
  await page.route(`**${exportPath}`, async route => {
    if (route.request().method() === 'GET') injectedGetCount += 1
    await mock401(route)
  })
  await scoring.getByRole('button', { name: 'ส่งออกข้อมูล', exact: true }).click()
  await scoring.getByRole('menuitem').filter({ hasText: 'ไม่เปิดเผยตัวตนผู้ประเมิน' }).click()
  await expect(scoring.getByTestId('export-error')).toContainText('เซสชันหมดอายุ')
  const export401State = {
    injectedGetCount,
    tokenStillPresent: await page.evaluate(key => localStorage.getItem(key) !== null, SESSION_KEY),
    protectedHeadingVisible: await page.getByRole('heading', { level: 1, name: 'จัดการสมาชิกและงานประเมิน' }).isVisible(),
    protectedRouteStillMounted: pathname(page.url()) === `/classrooms/${classroomId}`,
    error: await scoring.getByTestId('export-error').innerText(),
  }
  const exportScreenshot = await screenshot(page, 'export-401-session-still-mounted')
  // Demonstrate the bounded inconsistency: a later JSON401 triggers the common guard normally.
  await page.route('**/api/me', mock401)
  await page.reload()
  await expect(page).toHaveURL(/\/$/)
  const laterJson401State = { tokenStillPresent: await page.evaluate(key => localStorage.getItem(key) !== null, SESSION_KEY), finalPath: pathname(page.url()) }
  const afterScreenshot = await screenshot(page, 'later-json-401-session-cleared')
  record('SESSION-EXPORT-401', !export401State.tokenStillPresent && !export401State.protectedRouteStillMounted ? 'PASS' : 'FAIL', { export401State, laterJson401State },
    'Export401 follows the same matching-session invalidation behavior as JSON apiFetch401; backend denial remains enforced in both paths', [exportScreenshot, afterScreenshot])
})

test('export menu closes on Escape and returns focus to trigger', async ({ signedInPage: page, api, instructorToken, classroomId }) => {
  await publishedFixture(api, instructorToken, classroomId)
  await page.goto(`/classrooms/${classroomId}#scores`)
  const scoring = page.getByTestId('assignment-scoring-card')
  await expect(scoring).toBeVisible()
  const trigger = scoring.getByRole('button', { name: 'ส่งออกข้อมูล', exact: true })
  await trigger.click()
  const menu = scoring.getByRole('menu')
  await expect(menu).toBeVisible()
  // Start with focus in the menu, as a keyboard user selecting its first item would have.
  await menu.getByRole('menuitem').first().focus()
  await page.keyboard.press('Escape')
  const actual = { menuVisibleAfterEscape: await menu.isVisible(), triggerExpanded: await trigger.getAttribute('aria-expanded'), focusReturnedToTrigger: await trigger.evaluate(element => element === document.activeElement) }
  const evidence = await screenshot(page, 'export-menu-after-escape')
  record('A11Y-EXPORT-ESCAPE', !actual.menuVisibleAfterEscape && actual.focusReturnedToTrigger ? 'PASS' : 'FAIL', actual,
    'Escape closes the ARIA menu and returns focus to the export trigger', [evidence])
})

test('roster search pagination and row-menu removal cancel and confirm', async ({ signedInPage: page, api, instructorToken, classroomId }) => {
  await seedRoster(api, instructorToken, classroomId)
  await page.goto(`/classrooms/${classroomId}#members`)
  const table = page.getByTestId('roster-list')
  await expect(table).toBeVisible()
  const search = page.getByRole('searchbox', { name: 'ค้นหาสมาชิก', exact: true })
  await search.fill('failure12@kmitl.ac.th')
  await expect(table.locator('tbody tr')).toHaveCount(1)
  const searchMatches = await table.innerText()
  await search.fill('ไม่มีรายชื่อนี้ในการตรวจสอบ')
  await expect(table).toContainText('ไม่พบสมาชิกที่ตรงกับ')
  const emptyScreenshot = await screenshot(page, 'roster-search-empty')
  await search.fill('')
  await expect(table.locator('tbody tr')).toHaveCount(10)
  const pager = page.getByRole('navigation', { name: 'แบ่งหน้ารายชื่อ' })
  await pager.getByRole('button', { name: '2', exact: true }).click()
  await expect(pager.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page')
  const secondPageRows = await table.locator('tbody tr').count()
  const pageScreenshot = await screenshot(page, 'roster-page-two')
  record('ROSTER-SEARCH-PAGINATION', searchMatches.includes('failure12@kmitl.ac.th') && secondPageRows === 3 ? 'PASS' : 'FAIL',
    { matchingRows: 1, matchingStudentDisplayed: searchMatches.includes('failure12@kmitl.ac.th'), emptyStateDisplayed: true, firstPageRows: 10, secondPageRows },
    'Search filters name/email/group, no-results is explicit, clearing restores 10-row pagination with3rows on page2', [emptyScreenshot, pageScreenshot])
  await search.fill('failure12@kmitl.ac.th')
  const manage = table.getByRole('button', { name: 'จัดการ failure12@kmitl.ac.th', exact: true })
  const dialogs = queueDialogs(page)
  const rosterPath = `/api/classrooms/${classroomId}/roster`
  const memberStillExists = async () => ((await (await api.get(rosterPath, auth(instructorToken))).json()).items as any[]).some(item => item.email === 'failure12@kmitl.ac.th')
  const failures: string[] = []
  try {
    await manage.click()
    dialogs.responses.push(null)
    await table.getByRole('menuitem', { name: 'นำออกจากห้องเรียน', exact: true }).click({ timeout: 3000 })
    const existsAfterCancel = await memberStillExists()
    await manage.click()
    dialogs.responses.push('')
    await table.getByRole('menuitem', { name: 'นำออกจากห้องเรียน', exact: true }).click({ timeout: 3000 })
    await expect.poll(memberStillExists).toBe(false)
    await expect(table).toContainText('ไม่พบสมาชิกที่ตรงกับ')
    record('ROSTER-ROW-REMOVE', existsAfterCancel && !await memberStillExists() ? 'PASS' : 'FAIL',
      { existsAfterCancel, existsAfterConfirm: await memberStillExists(), dialogs: dialogs.seen },
      'Row-menu remove cancel preserves membership; confirm removes it in the API and refreshes the table', [await screenshot(page, 'roster-removed-confirmed')])
  } catch (error) {
    failures.push(error instanceof Error ? error.message.slice(0, 1200) : String(error))
    record('ROSTER-ROW-REMOVE', 'FAIL', { interactionErrors: failures, menuCount: await table.getByRole('menu').count(), dialogs: dialogs.seen, memberStillExists: await memberStillExists() },
      'Row-menu action is reachable inside the scrolling table and completes cancel/confirm removal', [await screenshot(page, 'roster-row-menu-interaction-failure')])
  }
})

test('CSV sample downloads and file select remove reselect work', async ({ signedInPage: page, classroomId }) => {
  await page.goto(`/classrooms/${classroomId}#members`)
  const form = page.getByTestId('roster-import')
  await expect(form).toBeVisible()
  await form.getByRole('button', { name: 'นำเข้ารายชื่อ', exact: true }).click()
  await expect(page.getByTestId('error-msg')).toContainText('เลือกไฟล์ CSV ก่อน')
  const downloadEvent = page.waitForEvent('download')
  await form.getByRole('link', { name: 'ดาวน์โหลดไฟล์ตัวอย่าง', exact: true }).click()
  const download = await downloadEvent
  const csv = await downloadText(download)
  const input = form.getByLabel('ไฟล์รายชื่อ CSV', { exact: true })
  const file = { name: 'audit-reselect.csv', mimeType: 'text/csv', buffer: Buffer.from('email,group_name\nfailure-select@kmitl.ac.th,กลุ่มทดสอบ\n', 'utf8') }
  await input.setInputFiles(file)
  await expect(form).toContainText(file.name)
  await form.getByRole('button', { name: 'เอาไฟล์ออก', exact: true }).click()
  const removed = await input.evaluate(element => (element as HTMLInputElement).files?.length === 0)
  await expect(form).not.toContainText(file.name)
  await input.setInputFiles(file)
  await expect(form).toContainText(file.name)
  const reselected = await input.evaluate(element => (element as HTMLInputElement).files?.length === 1)
  record('CSV-PICKER-SAMPLE', download.suggestedFilename() === 'roster-ตัวอย่าง.csv' && csv.includes('email') && csv.includes('group_name') && removed && reselected ? 'PASS' : 'FAIL',
    { noFileValidation: true, sampleFilename: download.suggestedFilename(), sampleHasRequiredHeaders: csv.includes('email') && csv.includes('group_name'), removed, sameFileReselected: reselected },
    'Sample downloads with expected filename/headers; no-file validation, clear and same-file reselection work', [await screenshot(page, 'csv-file-reselected')])
})

test('deadline calendar month navigation cancel Escape and keyboard apply', async ({ signedInPage: page, api, instructorToken, classroomId }) => {
  await seedRoster(api, instructorToken, classroomId)
  await page.goto(`/classrooms/${classroomId}#assignments`)
  const trigger = page.getByLabel('กำหนดส่ง', { exact: true })
  await trigger.focus(); await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'เลือกวันและเวลากำหนดส่ง', exact: true })
  await expect(dialog).toBeVisible()
  const dateSection = dialog.getByRole('region', { name: 'เลือกวันที่', exact: true })
  const initialMonthText = (await dateSection.innerText()).split('\n')[0]
  await dialog.getByRole('button', { name: 'เดือนถัดไป', exact: true }).click()
  const nextMonthText = (await dateSection.innerText()).split('\n')[0]
  await dialog.getByRole('button', { name: 'เดือนก่อนหน้า', exact: true }).click()
  const previousRestored = (await dateSection.innerText()).split('\n')[0] === initialMonthText
  await dialog.getByRole('button', { name: 'วันนี้', exact: true }).click()
  await dialog.getByRole('button', { name: 'ยกเลิก', exact: true }).click()
  const cancelledWithoutApplying = (await trigger.innerText()).includes('เลือกวันและเวลา')
  await trigger.focus(); await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'เดือนถัดไป', exact: true }).focus()
  await page.keyboard.press('Escape')
  const escapeClosed = !await dialog.isVisible()
  const escapeRestoredFocus = await trigger.evaluate(element => element === document.activeElement)
  record('CALENDAR-ESCAPE-FOCUS', escapeClosed && escapeRestoredFocus ? 'PASS' : 'FAIL', { escapeClosed, escapeRestoredFocus },
    'Escape closes the date dialog and restores focus to the date trigger', [await screenshot(page, 'calendar-after-escape')])
  await trigger.click()
  await dialog.getByRole('button', { name: 'พรุ่งนี้', exact: true }).click()
  await dialog.getByRole('combobox', { name: 'ชั่วโมง', exact: true }).selectOption('23')
  await dialog.getByRole('combobox', { name: 'นาที', exact: true }).selectOption('59')
  const pendingScreenshot = await screenshot(page, 'calendar-tomorrow-pending')
  await dialog.getByRole('button', { name: 'ยืนยันกำหนดส่ง', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog).not.toBeVisible()
  const appliedText = await trigger.innerText()
  record('CALENDAR-INTERACTIONS', nextMonthText !== initialMonthText && previousRestored && cancelledWithoutApplying && appliedText.includes('23:59') ? 'PASS' : 'FAIL',
    { monthChanged: nextMonthText !== initialMonthText, previousRestored, cancelledWithoutApplying, appliedText, keyboardApplied: true },
    'Month controls navigate, cancel does not commit pending selection, tomorrow/24h selections apply with keyboard Enter', [pendingScreenshot, await screenshot(page, 'calendar-keyboard-applied')])
})

test('score override and reopen prompts validate cancel invalid and successful input', async ({ signedInPage: page, api, instructorToken, classroomId }) => {
  const id = await publishedFixture(api, instructorToken, classroomId, { deadline: '2020-01-01T18:30:00Z' })
  await page.goto(`/classrooms/${classroomId}#scores`)
  const scoring = page.getByTestId('assignment-scoring-card')
  await expect(scoring).toBeVisible()
  await scoring.getByRole('button', { name: 'คำนวณคะแนนชั่วคราว', exact: true }).click()
  await expect(page.getByTestId('scoring-notice')).toContainText('คำนวณคะแนนชั่วคราวแล้ว')
  await scoring.getByRole('button', { name: 'ดูคะแนนที่คำนวณ', exact: true }).click()
  await expect(page.getByTestId('scores-final-flag')).toContainText('ชั่วคราว')
  const override = scoring.getByRole('button', { name: /^ปรับคะแนน / }).first()
  const dialogs = queueDialogs(page)
  let overridePosts = 0
  page.on('request', request => { if (pathname(request.url()) === `/api/assignments/${id}/score-overrides` && request.method() === 'POST') overridePosts += 1 })
  dialogs.responses.push(null)
  await override.click()
  const cancelledBeforePosting = overridePosts === 0
  dialogs.responses.push('ไม่ใช่ตัวเลข')
  await override.click()
  await expect(scoring).toContainText('กรุณาระบุคะแนนเป็นตัวเลข')
  const invalidRejectedBeforePosting = overridePosts === 0
  dialogs.responses.push('9.5', 'เหตุผลประกอบการตรวจสอบ UI ด้วยข้อมูลสังเคราะห์')
  const overriddenResponse = page.waitForResponse(response => pathname(response.url()) === `/api/assignments/${id}/score-overrides` && response.request().method() === 'POST')
  await override.click()
  const overridden = await overriddenResponse
  expect(overridden.status()).toBe(201)
  const overrideBody = await overridden.json()
  await expect(scoring).toContainText('9.5000')
  const serverScores = await (await api.get(`/api/assignments/${id}/scores`, auth(instructorToken))).json()
  const overrideVisible = serverScores.items.some((item: any) => Number(item.component) === 9.5)
  record('SCORE-OVERRIDE-PROMPTS', cancelledBeforePosting && invalidRejectedBeforePosting && overrideVisible ? 'PASS' : 'FAIL',
    { cancelledBeforePosting, invalidRejectedBeforePosting, overridePostCount: overridePosts, overrideResponseValue: overrideBody.overrideValue, updatedScorePresent: overrideVisible },
    'Cancel and invalid numeric prompt do not mutate; valid value+reason updates API score and browser display', [await screenshot(page, 'score-override-success')])
  // Finalize with a possible native low-confidence confirmation, then exercise reopen prompts.
  dialogs.responses.push('')
  await scoring.getByRole('button', { name: 'ประกาศผลคะแนน', exact: true }).click()
  await expect(page.getByTestId('scoring-notice')).toContainText('ประกาศผลคะแนนแล้ว')
  const reopen = scoring.getByRole('button', { name: 'เปิดกลับมาแก้', exact: true })
  await expect(reopen).toBeVisible()
  let reopenPosts = 0
  page.on('request', request => { if (pathname(request.url()) === `/api/assignments/${id}:reopen` && request.method() === 'POST') reopenPosts += 1 })
  dialogs.responses.push(null)
  await reopen.click()
  const reopenCancelNoPost = reopenPosts === 0
  dialogs.responses.push('')
  await reopen.click()
  await expect(page.getByTestId('scoring-error')).toContainText('ต้องระบุเหตุผลก่อน reopen')
  const reopenBlankNoPost = reopenPosts === 0
  dialogs.responses.push('เปิดกลับมาเพื่อตรวจสอบด้วยข้อมูลสังเคราะห์')
  const reopenedResponse = page.waitForResponse(response => pathname(response.url()) === `/api/assignments/${id}:reopen` && response.request().method() === 'POST')
  await reopen.click()
  expect((await reopenedResponse).status()).toBe(200)
  await expect(page.getByTestId('scoring-notice')).toContainText('เปิดคะแนนกลับมาแก้แล้ว')
  await expect(scoring).toContainText('ปิดรับแล้ว')
  record('SCORE-REOPEN-PROMPTS', reopenCancelNoPost && reopenBlankNoPost && reopenPosts === 1 ? 'PASS' : 'FAIL',
    { reopenCancelNoPost, reopenBlankNoPost, reopenPosts, statusClosedDisplayed: true, nativeDialogs: dialogs.seen },
    'Cancel/empty reason do not reopen; valid reason reopens once, refreshes status toCLOSED and shows success', [await screenshot(page, 'score-reopened')])
})

test('browser CSV exports download actual pseudonymous and identified content', async ({ signedInPage: page, api, instructorToken, classroomId }) => {
  const id = await publishedFixture(api, instructorToken, classroomId, { coverage: 4 })
  const student = await issueToken(api, 'failure1@kmitl.ac.th')
  const evaluations = await (await api.get(`/api/assignments/${id}/my-evaluations?side=GROUP`, auth(student))).json()
  expect(evaluations.items.length).toBeGreaterThan(0)
  expect((await api.put(`/api/comparisons/${evaluations.items[0].pairAssignmentId}`, { ...auth(student), data: { choice: 2 } })).status()).toBe(200)
  expect((await api.post(`/api/assignments/${id}/submissions`, { headers: { ...auth(student).headers, 'Idempotency-Key': 'failure-audit-browser-export' }, data: { side: 'GROUP' } })).status()).toBe(200)
  await page.goto(`/classrooms/${classroomId}#scores`)
  const scoring = page.getByTestId('assignment-scoring-card')
  const trigger = scoring.getByRole('button', { name: 'ส่งออกข้อมูล', exact: true })
  await expect(trigger).toBeVisible()
  await trigger.click()
  const plainEvent = page.waitForEvent('download')
  await scoring.getByRole('menuitem').filter({ hasText: 'ไม่เปิดเผยตัวตนผู้ประเมิน' }).click()
  const plainDownload = await plainEvent
  const plainText = await downloadText(plainDownload)
  const dialogs = queueDialogs(page)
  let identityPosts = 0
  page.on('request', request => { if (pathname(request.url()) === `/api/assignments/${id}/comparisons:export-identified` && request.method() === 'POST') identityPosts += 1 })
  await trigger.click(); dialogs.responses.push(null)
  await scoring.getByRole('menuitem').filter({ hasText: 'ต้องระบุเหตุผลและบันทึกใน audit log' }).click()
  const cancelNoPost = identityPosts === 0
  await trigger.click(); dialogs.responses.push('')
  await scoring.getByRole('menuitem').filter({ hasText: 'ต้องระบุเหตุผลและบันทึกใน audit log' }).click()
  await expect(scoring.getByTestId('export-error')).toContainText('ต้องระบุเหตุผลก่อนเปิดเผยตัวตนผู้ประเมิน')
  const blankNoPost = identityPosts === 0
  await trigger.click(); dialogs.responses.push('ตรวจสอบ browser CSV ด้วยข้อมูลสังเคราะห์')
  const identifiedEvent = page.waitForEvent('download')
  await scoring.getByRole('menuitem').filter({ hasText: 'ต้องระบุเหตุผลและบันทึกใน audit log' }).click()
  const identifiedDownload = await identifiedEvent
  const identifiedText = await downloadText(identifiedDownload)
  const actual = {
    plainFilenameExpected: plainDownload.suggestedFilename() === `comparisons_${id}.csv`,
    identifiedFilenameExpected: identifiedDownload.suggestedFilename() === `comparisons_identified_${id}.csv`,
    plainHeader: plainText.split(/\r?\n/)[0], plainHasDataRows: plainText.trim().split(/\r?\n/).length > 1,
    plainHasPseudonym: /E\d+/.test(plainText), plainHasStudentEmail: plainText.includes('failure1@kmitl.ac.th'),
    identifiedHasStudentEmail: identifiedText.includes('failure1@kmitl.ac.th'), cancelNoPost, blankNoPost, identityPosts,
  }
  record('BROWSER-CSV-DOWNLOADS', actual.plainFilenameExpected && actual.identifiedFilenameExpected && actual.plainHasDataRows && actual.plainHasPseudonym && !actual.plainHasStudentEmail && actual.identifiedHasStudentEmail && cancelNoPost && blankNoPost ? 'PASS' : 'FAIL', actual,
    'Actual browser downloads have correct filenames and nonempty privacy-filtered/identified content; identity cancel/empty reason do not post', [await screenshot(page, 'browser-csv-downloads-complete')])
})

test('evaluation left open across deadline updates read-only state without reload', async ({ page, api, instructorToken, classroomId }) => {
  const deadlineMs = Date.now() + 12_000
  const id = await publishedFixture(api, instructorToken, classroomId, { deadline: new Date(deadlineMs).toISOString(), coverage: 4 })
  const student = await issueToken(api, 'failure1@kmitl.ac.th')
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, token), { key: SESSION_KEY, token: student })
  await page.goto(`/classrooms/${classroomId}/assignments/${id}/evaluate`)
  await expect(page.getByRole('radiogroup')).toHaveCount(1)
  const radio = page.getByRole('radio', { name: 'ขวาดีกว่า', exact: true })
  await expect(radio).toBeEnabled()
  await expect(page.getByRole('button', { name: 'ส่งคำตอบ', exact: true })).toBeVisible()
  await page.waitForTimeout(Math.max(0, deadlineMs - Date.now()) + 350)
  const afterDeadline = { deadlinePassedByMs: Date.now() - deadlineMs, radioDisabled: await radio.isDisabled(), submitVisible: await page.getByRole('button', { name: 'ส่งคำตอบ', exact: true }).isVisible() }
  let rejectedWriteStatus: number | null = null
  if (!afterDeadline.radioDisabled) {
    const saveResponse = page.waitForResponse(response => pathname(response.url()).startsWith('/api/comparisons/') && response.request().method() === 'PUT')
    await radio.click()
    rejectedWriteStatus = (await saveResponse).status()
  }
  const beforeScreenshot = await screenshot(page, 'evaluation-deadline-passed-before-reload')
  await page.reload()
  await expect(page.getByRole('radio').first()).toBeDisabled()
  await expect(page.getByRole('button', { name: 'ส่งคำตอบ', exact: true })).toHaveCount(0)
  record('EVALUATION-DEADLINE-LIVE', afterDeadline.radioDisabled && !afterDeadline.submitVisible ? 'PASS' : 'FAIL',
    { afterDeadline, rejectedWriteStatus, afterReload: { radiosDisabled: true, submitHidden: true } },
    'When the deadline passes on an open page, input and submit update without reload; backend rejects late writes independently', [beforeScreenshot, await screenshot(page, 'evaluation-deadline-passed-after-reload')])
})

test('switching evaluation side preserves a pending answer', async ({ page, api, instructorToken, classroomId }) => {
  const id = await publishedFixture(api, instructorToken, classroomId, { coverage: 4 })
  const token = await issueToken(api, 'failure1@kmitl.ac.th')
  await page.addInitScript(value => localStorage.setItem('paireval.session', value), token)
  await page.goto(`/classrooms/${classroomId}/assignments/${id}/evaluate`)
  const selected = page.getByRole('radio', { name: 'ขวาดีกว่า', exact: true })
  await expect(selected).toHaveCount(1)
  await selected.click()
  await page.getByRole('tab').nth(1).click()
  await page.getByRole('tab').nth(0).click()
  await page.waitForTimeout(2400)
  const body = await (await api.get(`/api/assignments/${id}/my-evaluations?side=GROUP`, auth(token))).json()
  const actual = { selectedAfterReturn: await selected.getAttribute('aria-checked'), persistedChoice: body.items[0].choice }
  record('EVALUATION-PENDING-SIDE-SWITCH', actual.selectedAfterReturn === 'true' && actual.persistedChoice === 5 ? 'PASS' : 'FAIL', actual,
    'Switching tabs must preserve or flush pending choices instead of cancelling the unsaved debounce', [await screenshot(page, 'evaluation-pending-side-switch')])
})

test('failed autosave is retained locally and resumes after connection recovery', async ({ page, api, instructorToken, classroomId }) => {
  const id = await publishedFixture(api, instructorToken, classroomId, { coverage: 4 })
  const token = await issueToken(api, 'failure1@kmitl.ac.th')
  await page.addInitScript(value => localStorage.setItem('paireval.session', value), token)
  await page.goto(`/classrooms/${classroomId}/assignments/${id}/evaluate`)
  const selected = page.getByRole('radio', { name: 'ขวาดีกว่า', exact: true })
  await expect(selected).toHaveCount(1)
  await page.route('**/api/comparisons/*', route => route.abort('internetdisconnected'))
  await selected.click()
  await expect(page.getByText('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง', { exact: true })).toBeVisible()
  const failedShot = await screenshot(page, 'autosave-offline-error')
  await page.unroute('**/api/comparisons/*')
  await page.waitForTimeout(2500)
  const beforeReload = await (await api.get(`/api/assignments/${id}/my-evaluations?side=GROUP`, auth(token))).json()
  await page.reload()
  await expect(selected).toBeVisible()
  const actual = { persistedAfterRecovery: beforeReload.items[0].choice, selectedAfterReload: await selected.getAttribute('aria-checked'),
    failureInjection:'Only comparison PUT aborted as internetdisconnected; normal connection restored before reload' }
  record('EVALUATION-OFFLINE-DURABILITY', actual.persistedAfterRecovery === 5 || actual.selectedAfterReload === 'true' ? 'PASS' : 'FAIL', actual,
    'Figma ST24 promises answers stored locally during offline state; pending choice survives reload or syncs on recovery', [failedShot, await screenshot(page, 'autosave-offline-choice-lost-after-reload')])
})

test('landing anchors and about panel reveal their actual targets', async ({ page }) => {
  await page.goto('/')
  const links = page.locator('a[href^="#"]')
  const count = await links.count()
  const results: object[] = []
  for (let i=0;i<count;i++) {
    const link = links.nth(i)
    if (!await link.isVisible()) continue
    const href = await link.getAttribute('href')
    if (!href || href==='#') continue
    await link.click()
    await expect.poll(async () => page.locator(href).evaluate(el => {
      const r=el.getBoundingClientRect();return r.top<innerHeight && r.bottom>0
    })).toBeTruthy()
    results.push({ href, hash: new URL(page.url()).hash, targetInViewport:true })
  }
  const about = page.getByRole('button', { name:'รู้จัก PairEval', exact:true })
  await about.click()
  const panel=page.locator('#login')
  const expanded = await about.getAttribute('aria-expanded')==='true' && await panel.isVisible() && await panel.getByText(/PairEval ช่วยประเมินผลงานทีละคู่/).isVisible()
  await about.click()
  const collapsed = !await panel.isVisible()
  await page.getByTestId('main-cta').click()
  await expect(page).toHaveURL(/\/$/)
  const loginNotice = await page.getByRole('status').filter({hasText:'กรุณาเข้าสู่ระบบ'}).isVisible()
  record('HOME-ANCHORS-ABOUT-CTA', expanded&&collapsed&&loginNotice?'PASS':'FAIL', { results, expanded, collapsed, guestCtaLoginNotice:loginNotice },
    'Visible section/footer anchors scroll to actual targets, about panel reveals/collapses content, guest CTA invokes protected-route notice', [await screenshot(page,'home-guest-cta-login-notice')])
})
