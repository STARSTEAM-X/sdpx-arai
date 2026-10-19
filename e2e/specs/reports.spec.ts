import { expect, issueToken, test } from '../fixtures'

/* หน้ารายงานของงานตาม Figma
 * - J24: งานปิดรับแล้วบอกวันที่ระบบจะประกาศผลอัตโนมัติ (14 วันหลังปิดรับ)
 * - J25 / J35: รายงานคะแนนและคำร้องอุทธรณ์เป็นหน้าแยก ใช้แท็บร่วมกับ J26 / J28
 * - J26 / J27: ปุ่มสั่งประเมินเพิ่มอยู่ท้ายการ์ด และบอกเหตุผลเมื่อไม่มีผู้มีสิทธิ์เหลือ
 */

type Api = import('@playwright/test').APIRequestContext

const auth = (token: string) => ({ headers: { authorization: `Bearer ${token}` } })
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function importRoster(api: Api, token: string, classroomId: string, rows: [string, string][]) {
  const csv = ['email,group_name', ...rows.map(([email, group]) => `${email},${group}`)].join('\n')
  const res = await api.post(`/api/classrooms/${classroomId}/roster:import`, {
    ...auth(token),
    multipart: { file: { name: 'roster.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') } },
  })
  expect(res.ok(), 'เตรียม roster ไม่สำเร็จ').toBeTruthy()
}

async function createGroupAssignment(api: Api, token: string, classroomId: string, deadline: string) {
  const created = await api.post('/api/assignments', {
    ...auth(token),
    data: {
      classroomId,
      name: 'งานรายงาน',
      groupMaxScore: 15,
      individualMaxScore: 0,
      groupDeadlineUtc: deadline,
      targetCoverage: 1,
      criteria: [{ side: 'GROUP', name: 'UX', weightPct: 100 }],
    },
  })
  expect(created.status(), 'สร้างงานไม่สำเร็จ').toBe(201)
  const id = (await created.json()).id as string
  expect((await api.post(`/api/assignments/${id}:publish`, auth(token))).status()).toBe(200)
  return id
}

async function answerAll(api: Api, assignmentId: string, emails: string[]) {
  for (const email of emails) {
    const token = await issueToken(api, email)
    const res = await api.get(`/api/assignments/${assignmentId}/my-evaluations?side=GROUP`, auth(token))
    const pairs = (await res.json()).items as { pairAssignmentId: string }[]
    for (const p of pairs) await api.put(`/api/comparisons/${p.pairAssignmentId}`, { ...auth(token), data: { choice: 2 } })
    if (pairs.length)
      await api.post(`/api/assignments/${assignmentId}/submissions`, {
        ...auth(token),
        headers: { ...auth(token).headers, 'Idempotency-Key': `report-${assignmentId}-${email}` },
        data: { side: 'GROUP' },
      })
  }
}

const ROSTER: [string, string][] = [
  ['rep1@kmitl.ac.th', 'Aurora'],
  ['rep2@kmitl.ac.th', 'Aurora'],
  ['rep3@kmitl.ac.th', 'Lyra'],
  ['rep4@kmitl.ac.th', 'Lyra'],
  ['rep5@kmitl.ac.th', 'Cygnus'],
  ['rep6@kmitl.ac.th', 'Cygnus'],
]

test('J24: งานปิดรับแล้วบอกวันที่ระบบจะประกาศผลอัตโนมัติ 14 วันหลังปิดรับ', async ({
  api,
  signedInPage: page,
  instructorToken,
  classroomId,
}) => {
  await importRoster(api, instructorToken, classroomId, ROSTER)
  const deadline = new Date(Date.now() + 3000).toISOString()
  const assignmentId = await createGroupAssignment(api, instructorToken, classroomId, deadline)
  await sleep(Math.max(0, Date.parse(deadline) - Date.now()) + 500)

  const list = await api.get(`/api/classrooms/${classroomId}/assignments`, auth(instructorToken))
  const summary = (await list.json()).items.find((item: { id: string }) => item.id === assignmentId)
  expect(Date.parse(summary.autoFinalizeAt) - Date.parse(deadline)).toBe(14 * 86400000)

  await page.goto(`/classrooms/${classroomId}/assignments/${assignmentId}`)
  await expect(page.getByText(/ระบบจะประกาศอัตโนมัติวันที่ .+ \(14 วันหลังปิดรับ\) และเตือนคุณก่อน/)).toBeVisible()
})

test('J25 / J35: รายงานคะแนนและคำร้องอุทธรณ์เป็นหน้าแยกที่สลับแท็บกันได้', async ({
  api,
  signedInPage: page,
  instructorToken,
  classroomId,
}) => {
  await importRoster(api, instructorToken, classroomId, ROSTER)
  const deadline = new Date(Date.now() + 4000).toISOString()
  const assignmentId = await createGroupAssignment(api, instructorToken, classroomId, deadline)
  await answerAll(
    api,
    assignmentId,
    ROSTER.map(([email]) => email),
  )
  await sleep(Math.max(0, Date.parse(deadline) - Date.now()) + 500)
  const finalized = await api.post(`/api/assignments/${assignmentId}:finalize`, {
    ...auth(instructorToken),
    data: { confirmLowConfidence: true },
  })
  expect(finalized.status(), await finalized.text()).toBe(200)
  const student = await issueToken(api, 'rep1@kmitl.ac.th')
  const appeal = await api.post(`/api/assignments/${assignmentId}/appeals`, {
    ...auth(student),
    data: { message: 'คะแนนเกณฑ์ UX ต่ำกว่าที่ควร กลุ่มเราส่งผลงานครบทุกข้อตามที่อาจารย์กำหนดไว้' },
  })
  expect(appeal.status(), await appeal.text()).toBe(201)

  await page.goto(`/classrooms/${classroomId}/assignments/${assignmentId}/report`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('รายงานคะแนนกลุ่ม')
  await expect(page.getByTestId('scores-final-flag')).toHaveText('คะแนนสุดท้าย')
  const tabs = page.getByRole('navigation', { name: 'เลือกรายงาน' })
  await expect(tabs.getByRole('link', { name: 'คะแนนกลุ่ม' })).toHaveAttribute('aria-current', 'page')

  await tabs.getByRole('link', { name: 'คำร้องอุทธรณ์ 1' }).click()
  await expect(page).toHaveURL(/\/report#appeals$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('คำร้องอุทธรณ์คะแนน')
  await expect(page.getByText('รอตอบ 1 · ตอบแล้ว 0')).toBeVisible()
  await expect(page.getByRole('row', { name: /rep1@kmitl\.ac\.th/ })).toContainText('รอตอบ')

  // แท็บ coverage พาไปหน้า J26 และกลับมาที่รายงานคะแนนได้
  await tabs.getByRole('link', { name: 'coverage รายคู่' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('coverage รายคู่')
  await page.getByRole('navigation', { name: 'เลือกรายงาน' }).getByRole('link', { name: 'คะแนนรายบุคคล' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('รายงานคะแนนรายบุคคล')
})

test('J26 / J27: ปุ่มท้ายการ์ดทำกับคู่ที่เลือก และบอกเหตุผลเมื่อไม่มีผู้มีสิทธิ์เหลือ', async ({
  api,
  signedInPage: page,
  instructorToken,
  classroomId,
}) => {
  // กลุ่มละ 1 คน 3 กลุ่ม — แต่ละคู่ประเมินได้โดยคนเดียว (กลุ่มที่สาม) จึงไม่มีผู้มีสิทธิ์เหลือให้สั่งเพิ่ม
  await importRoster(api, instructorToken, classroomId, [
    ['solo1@kmitl.ac.th', 'Aurora'],
    ['solo2@kmitl.ac.th', 'Lyra'],
    ['solo3@kmitl.ac.th', 'Cygnus'],
  ])
  const assignmentId = await createGroupAssignment(api, instructorToken, classroomId, '2099-01-01T00:00:00Z')

  await page.goto(`/classrooms/${classroomId}/assignments/${assignmentId}/quality#coverage`)
  const footer = page.getByText('คู่ที่ข้อมูลไม่พอ สั่งให้คนอื่นประเมินเพิ่ม หรืออาจารย์ประเมินเองก็ได้')
  await expect(footer).toBeVisible()
  // ไม่มีปุ่มในแถวแล้ว — เลือกคู่ด้วยการกดชื่อคู่ แล้วบรรทัดคู่ที่เลือกเปลี่ยนตาม
  const second = page.getByRole('button', { name: /Lyra เทียบ Cygnus|Cygnus เทียบ Lyra/ })
  await second.click()
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/คู่ที่เลือก: (Lyra เทียบ Cygnus|Cygnus เทียบ Lyra)/)).toBeVisible()

  await page.getByRole('button', { name: 'ส่งให้ประเมินเพิ่ม', exact: true }).click()
  const dialog = page.getByTestId('coverage-dialog')
  await expect(dialog.getByRole('heading')).toContainText('ส่งให้ประเมินเพิ่มไม่ได้')
  await expect(dialog).toContainText('ผู้มีสิทธิ์ที่ยังไม่ได้รับคู่นี้')
  await expect(dialog).toContainText('0 คน')
  // ทางเลือกในกล่องเดียวกัน: อาจารย์ประเมินเอง
  await dialog.getByRole('button', { name: 'ประเมินเอง' }).click()
  await expect(dialog.getByRole('heading')).toHaveText('ผู้สอนประเมินเอง')
})

test('FR-REPORT-02: สรุปรายบุคคลของอาจารย์แสดง M และคะแนนรวมตรงกับที่นักศึกษาเห็น', async ({
  api,
  signedInPage: page,
  instructorToken,
  classroomId,
}) => {
  await importRoster(api, instructorToken, classroomId, ROSTER)
  const deadline = new Date(Date.now() + 4000).toISOString()
  const assignmentId = await createGroupAssignment(api, instructorToken, classroomId, deadline)
  // rep6 ไม่ตอบเลย → ตัวคูณการมีส่วนร่วม M < 1
  await answerAll(
    api,
    assignmentId,
    ROSTER.map(([email]) => email).filter((email) => email !== 'rep6@kmitl.ac.th'),
  )
  await sleep(Math.max(0, Date.parse(deadline) - Date.now()) + 500)
  const finalized = await api.post(`/api/assignments/${assignmentId}:finalize`, {
    ...auth(instructorToken),
    data: { confirmLowConfidence: true },
  })
  expect(finalized.status(), await finalized.text()).toBe(200)

  const scores = await (await api.get(`/api/assignments/${assignmentId}/scores`, auth(instructorToken))).json()
  for (const email of ['rep1@kmitl.ac.th', 'rep6@kmitl.ac.th']) {
    const mine = await (await api.get(`/api/assignments/${assignmentId}/my-score`, auth(await issueToken(api, email)))).json()
    const row = scores.students.find((s: { email: string }) => s.email === email)
    expect(row.participationMultiplier).toBe(mine.participationMultiplier)
    expect(row.finalScore).toBe(mine.finalScore)
  }
  const lazy = scores.students.find((s: { email: string }) => s.email === 'rep6@kmitl.ac.th')
  expect(Number(lazy.participationMultiplier)).toBeLessThan(1)

  await page.goto(`/classrooms/${classroomId}/assignments/${assignmentId}/report#individual`)
  const summary = page.getByRole('region', { name: 'ตารางสรุปรายบุคคล' })
  await expect(summary.getByRole('row', { name: /rep6@kmitl\.ac\.th/ })).toContainText(
    Number(lazy.participationMultiplier).toFixed(3),
  )
  await expect(summary.getByRole('row', { name: /rep6@kmitl\.ac\.th/ })).toContainText(Number(lazy.finalScore).toFixed(2))
})

test('FR-EVAL-10: หน้าประเมินนับถอยหลังเมื่อเหลือไม่ถึง 48 ชม.', async ({ api, page, instructorToken, classroomId }) => {
  await importRoster(api, instructorToken, classroomId, ROSTER)
  const assignmentId = await createGroupAssignment(
    api,
    instructorToken,
    classroomId,
    new Date(Date.now() + 5 * 3600000).toISOString(),
  )
  const student = await issueToken(api, 'rep1@kmitl.ac.th')
  await page.addInitScript(([key, token]) => window.localStorage.setItem(key, token), ['paireval.session', student] as const)
  await page.goto(`/classrooms/${classroomId}/assignments/${assignmentId}/evaluate`)
  await expect(page.getByTestId('deadline-countdown')).toContainText(/เหลืออีก 4 ชม\. 5\d นาที/)
})
