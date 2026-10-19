import AxeBuilder from '@axe-core/playwright'

import { expect, issueToken, test } from '../fixtures'

/* PRD §15 FR-A11Y-03 (contrast) · FR-A11Y-04 (target size ≥ 24×24) — สแกนอัตโนมัติด้วย axe-core ตาม WCAG 2.2 AA
 * ครอบหน้าหลักของทั้งผู้สอนและนักศึกษา · ผลรวมบันทึกใน docs/a11y-report.md
 * axe จับได้เฉพาะสิ่งที่ตรวจด้วยเครื่องได้ — การทดสอบด้วย screen reader (FR-A11Y-07) ยังต้องทำด้วยคน
 */
type Api = import('@playwright/test').APIRequestContext
type Page = import('@playwright/test').Page

const auth = (token: string) => ({ headers: { authorization: `Bearer ${token}` } })
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

// สรุปต่อหน้าแนบไว้ใน report (a11y-summary) — ใช้เป็นหลักฐานใน docs/a11y-report.md
const summary: { page: string; heading: string; passes: number; incomplete: string[]; violations: number }[] = []

async function scan(page: Page, name: string) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const heading = ((await page.locator('h1').first().textContent({ timeout: 2_000 }).catch(() => '')) ?? '').trim()
  summary.push({ page: name, heading, passes: result.passes.length, incomplete: result.incomplete.map((r) => r.id), violations: result.violations.length })
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)
}

async function setup(api: Api, token: string, classroomId: string) {
  // 3 กลุ่ม — 2 กลุ่มได้คู่เดียวที่ไม่มีใครนอกคู่ประเมินได้ publish จึงไม่ผ่าน
  const groups = ['Aurora', 'Lyra', 'Araija']
  const csv = ['email,group_name', ...Array.from({ length: 9 }, (_, i) => `a11y${i + 1}@kmitl.ac.th,${groups[i % 3]}`)]
    .join(String.fromCharCode(10))
  await api.post(`/api/classrooms/${classroomId}/roster:import`, {
    ...auth(token),
    multipart: { file: { name: 'roster.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') } },
  })
  const created = await api.post('/api/assignments', {
    ...auth(token),
    data: {
      classroomId, name: 'งาน a11y', groupMaxScore: 15, individualMaxScore: 5, targetCoverage: 1,
      groupDeadlineUtc: '2099-01-01T00:00:00Z', individualDeadlineUtc: '2099-01-01T00:00:00Z',
      criteria: [{ side: 'GROUP', name: 'UX', weightPct: 100 }, { side: 'INDIVIDUAL', name: 'ทีม', weightPct: 100 }],
    },
  })
  const id = (await created.json()).id as string
  // publish ต้องผ่าน — ไม่งั้นงานค้างเป็น DRAFT และหน้าประเมินของนักศึกษาจะไม่มีอะไรให้สแกน
  const published = await api.post(`/api/assignments/${id}:publish`, auth(token))
  expect(published.ok(), await published.text()).toBeTruthy()
  return id
}

test('FR-A11Y-03/04: หน้าหลักผ่าน axe-core WCAG 2.2 AA', async ({ api, page, instructorToken, classroomId }) => {
  test.setTimeout(120_000)
  const assignmentId = await setup(api, instructorToken, classroomId)
  const base = `/classrooms/${classroomId}`
  const report: Record<string, string[]> = {}
  const label = (path: string) => path.replace(classroomId, ':classroomId').replace(assignmentId, ':assignmentId')

  for (const path of ['/', '/guide']) {
    await page.goto(path)
    report[path] = await scan(page, path)
  }

  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), ['paireval.session', instructorToken] as const)
  for (const path of ['/classrooms', base, `${base}#members`, `${base}#assignments`, `${base}/assignments/${assignmentId}`,
    `${base}/assignments/${assignmentId}/report`, `${base}/assignments/${assignmentId}/quality`,
    `${base}/assignments/${assignmentId}/quality#coverage`, `${base}/assignments/${assignmentId}/export`, `${base}/audit`]) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    report[path] = await scan(page, label(path))
  }

  const student = await issueToken(api, 'a11y1@kmitl.ac.th')
  const context = await page.context().browser()!.newContext()
  const studentPage = await context.newPage()
  await studentPage.addInitScript(([key, value]) => window.localStorage.setItem(key, value), ['paireval.session', student] as const)
  for (const path of ['/classrooms', base, `${base}/assignments/${assignmentId}/evaluate`, '/notifications']) {
    await studentPage.goto(path)
    await studentPage.waitForLoadState('networkidle')
    report[`student ${path}`] = await scan(studentPage, `student ${label(path)}`)
  }
  await context.close()
  await test.info().attach('a11y-summary', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' })

  const failing = Object.fromEntries(Object.entries(report).filter(([, v]) => v.length))
  expect(failing).toEqual({})
})
