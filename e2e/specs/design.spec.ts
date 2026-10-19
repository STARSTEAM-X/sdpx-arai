import type { APIRequestContext, Page } from '@playwright/test'

import { expect, issueToken, test } from '../fixtures'
import { testUsers } from '../seed/test-data'

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 1000 }
const STUDENTS = Array.from({ length: 6 }, (_, index) => `design${index + 1}@kmitl.ac.th`)

function auth(token: string) {
  return { headers: { authorization: `Bearer ${token}` } }
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ))).toBeLessThanOrEqual(1)
}

/** ใช้ API จริงใน fixture ที่ล้าง DB ทุก test; ไม่จำลอง response หรือ session ฝั่ง browser */
async function prepareEvaluation(api: APIRequestContext, token: string, classroomId: string, deadline: string) {
  const roster = ['email,group_name', ...STUDENTS.map((email, index) => (
    `${email},กลุ่ม-${Math.floor(index / 2) + 1}`
  ))].join('\n')
  const imported = await api.post(`/api/classrooms/${classroomId}/roster:import`, {
    ...auth(token),
    multipart: { file: { name: 'design-roster.csv', mimeType: 'text/csv', buffer: Buffer.from(roster, 'utf-8') } },
  })
  expect(imported.ok(), 'เตรียมรายชื่อสำหรับหน้าประเมินไม่สำเร็จ').toBeTruthy()
  const created = await api.post('/api/assignments', {
    ...auth(token),
    data: {
      classroomId,
      name: 'งานประเมินสำหรับตรวจหน้าจอ',
      groupMaxScore: 15,
      individualMaxScore: 0,
      groupDeadlineUtc: deadline,
      // คู่แต่ละกลุ่มมีผู้ประเมินจากกลุ่มที่สาม 2 คน จึงให้ทุกคนได้คู่โดยไม่ขึ้นกับ seed
      targetCoverage: 2,
      criteria: [{ side: 'GROUP', name: 'ประสบการณ์การใช้งาน', weightPct: 100 }],
    },
  })
  expect(created.status()).toBe(201)
  const { id } = await created.json() as { id: string }
  const published = await api.post(`/api/assignments/${id}:publish`, auth(token))
  expect(published.status()).toBe(200)
  return id
}

async function signInStudent(page: Page, api: APIRequestContext) {
  const token = await issueToken(api, STUDENTS[0])
  await page.addInitScript((value) => window.localStorage.setItem('paireval.session', value), token)
  return token
}

test.describe('Figma redesign — ภาพและการใช้งานบนจอเล็ก', () => {
  test('ภาพประกอบหน้าแรกโหลดจริงบน desktop', async ({ page }, testInfo) => {
    await page.setViewportSize(DESKTOP)
    await page.goto('/')
    const illustrations = page.locator('main img')
    expect(await illustrations.count()).toBeGreaterThan(0)
    for (const illustration of await illustrations.all()) {
      await illustration.scrollIntoViewIfNeeded()
      await expect(illustration).toBeVisible()
      await expect.poll(() => illustration.evaluate((image: HTMLImageElement) => (
        image.complete && image.naturalWidth > 0
      ))).toBe(true)
    }
    await page.screenshot({ path: testInfo.outputPath('home-desktop.png'), fullPage: true })
  })

  // Figma ไม่มีแผงพับบนหน้าแรก — ปุ่มของแต่ละขั้นพาไปหัวข้อในหน้าคู่มือ (ST05–ST08)
  test('หน้าแรก 390px ไม่ล้นแนวนอนและปุ่มแต่ละขั้นพาไปหัวข้อในคู่มือ', async ({ page }, testInfo) => {
    await page.setViewportSize(MOBILE)
    for (const [action, anchor] of [['ดูตัวอย่าง', 'artifacts'], ['รู้จักการประเมิน', 'scale'], ['ดูวิธีส่งคำตอบ', 'submit']] as const) {
      await page.goto('/')
      await expectNoHorizontalOverflow(page)
      await page.getByRole('link', { name: action, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/guide#${anchor}$`))
      await expect(page.locator(`#${anchor}`)).toBeInViewport()
      await expectNoHorizontalOverflow(page)
    }
    await page.goto('/')
    await page.screenshot({ path: testInfo.outputPath('home-mobile.png'), fullPage: true })
  })

  test('ห้องเรียนบนมือถือแสดงบัญชี ปุ่มออกจากระบบ และลิงก์แบรนด์ที่ใช้งานได้', async ({ signedInPage: page, classroomId }, testInfo) => {
    await page.setViewportSize(MOBILE)
    await page.goto('/classrooms')
    await expect(page.getByTestId('classroom-list')).toContainText('ห้องสำหรับทดสอบรายชื่อ')
    const navigation = page.getByRole('navigation', { name: 'เมนูหลัก', exact: true })
    const brand = navigation.getByRole('link', { name: 'PairEval หน้าแรก', exact: true })
    // Figma ไม่มีเมนูบัญชีแบบ dropdown — แสดงบัญชีและปุ่มออกจากระบบบนแถบโดยตรง
    await expect(navigation.getByTestId('current-user')).toHaveAttribute('aria-label', `บัญชีของ ${testUsers.instructor.displayName}`)
    const signOut = navigation.getByRole('button', { name: 'ออกจากระบบ', exact: true })
    await expect(brand).toBeVisible()
    await expect(signOut).toBeVisible()
    await expectNoHorizontalOverflow(page)
    const roles = page.getByRole('group', { name: 'กรองตามบทบาท', exact: true })
    await roles.getByRole('button', { name: /^TA/ }).click()
    await expect(page.getByTestId('filtered-empty')).toBeVisible()
    await roles.getByRole('button', { name: /^ทั้งหมด/ }).click()
    await expect(page.getByTestId('classroom-list')).toContainText('ห้องสำหรับทดสอบรายชื่อ')
    const statuses = page.getByRole('group', { name: 'สถานะห้องเรียน', exact: true })
    await statuses.getByRole('button', { name: /^Archive/ }).click()
    await expect(page.getByTestId('filtered-empty')).toBeVisible()
    await statuses.getByRole('button', { name: /^ใช้งานอยู่/ }).click()
    const openCreate = page.getByRole('button', { name: 'เปิดหน้าต่างสร้างห้องเรียน', exact: true })
    await openCreate.click()
    const dialog = page.getByRole('dialog', { name: 'สร้างห้องเรียน', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('ชื่อห้องเรียน')).toBeFocused()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath('create-classroom-mobile.png'), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(openCreate).toBeFocused()
    await page.screenshot({ path: testInfo.outputPath('classrooms-mobile.png'), fullPage: true })
    await page.setViewportSize(DESKTOP)
    await page.screenshot({ path: testInfo.outputPath('classrooms-desktop.png'), fullPage: true })
    await page.setViewportSize(MOBILE)
    await brand.click()
    await expect(page).toHaveURL(/\/$/)
    await page.goto(`/classrooms/${classroomId}`)
    await expect(page.getByRole('heading', { name: 'ห้องสำหรับทดสอบรายชื่อ', level: 1 })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath('classroom-mobile.png'), fullPage: true })
    await page.setViewportSize(DESKTOP)
    await page.screenshot({ path: testInfo.outputPath('classroom-desktop.png'), fullPage: true })
    await page.setViewportSize(MOBILE)
    await signOut.click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('main-cta')).toHaveText(/เริ่มประเมิน/)
  })

  test('ตัวเลือกประเมินทั้ง 6 ระดับพอดีจอมือถือและเลือกบันทึกได้', async ({ page, api, instructorToken, classroomId }, testInfo) => {
    const assignmentId = await prepareEvaluation(api, instructorToken, classroomId, '2099-01-01T18:30:00Z')
    await signInStudent(page, api)
    await page.setViewportSize(MOBILE)
    await page.goto(`/classrooms/${classroomId}/assignments/${assignmentId}/evaluate`)
    const options = page.getByRole('radio')
    await expect(options).toHaveCount(6)
    await expectNoHorizontalOverflow(page)
    for (const option of await options.all()) {
      const bounds = await option.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(MOBILE.width)
      expect(bounds!.width).toBeGreaterThanOrEqual(44)
      expect(bounds!.height).toBeGreaterThanOrEqual(44)
    }
    const selected = page.getByRole('radio').nth(4)
    await selected.click()
    await expect(selected).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText(/บันทึกแล้ว/)).toBeVisible({ timeout: 5000 })
    await page.reload()
    await expect(selected).toHaveAttribute('aria-checked', 'true')
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath('evaluation-mobile.png'), fullPage: true })
    await page.setViewportSize(DESKTOP)
    await page.screenshot({ path: testInfo.outputPath('evaluation-desktop.png'), fullPage: true })
  })

  test('หน้าคะแนนจัดวางได้ทั้งมือถือและ desktop โดยใช้ผลประกาศจริง', async ({ page, api, instructorToken, classroomId }, testInfo) => {
    // สถานการณ์ไม่มีผู้ส่งคำตอบ: ประกาศโดยยืนยันข้อมูลไม่ครบอย่างชัดเจน ไม่ต้องรอนาฬิกาใน test
    const assignmentId = await prepareEvaluation(api, instructorToken, classroomId, '2020-01-01T00:00:00Z')
    const studentToken = await signInStudent(page, api)
    await page.setViewportSize(MOBILE)
    await page.goto(`/classrooms/${classroomId}/assignments/${assignmentId}/score`)
    await expect(page.getByTestId('not-finalized')).toBeVisible()
    await expect(page.getByTestId('final-score')).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath('score-not-finalized-mobile.png'), fullPage: true })
    const finalized = await api.post(`/api/assignments/${assignmentId}:finalize`, {
      ...auth(instructorToken),
      data: { confirmLowConfidence: true },
    })
    expect(finalized.status()).toBe(200)
    const response = await api.get(`/api/assignments/${assignmentId}/my-score`, auth(studentToken))
    expect(response.ok()).toBeTruthy()
    const score = await response.json() as { finalScore: string; groupComponent: string; participationMultiplier: string }
    await page.reload()
    // The redesigned UI rounds for display; keep comparing its numeric value with the real API.
    await expect.poll(async () => Number(await page.getByTestId('final-score').textContent())).toBeCloseTo(Number(score.finalScore), 2)
    await expect.poll(async () => Number(await page.getByTestId('group-component').textContent())).toBeCloseTo(Number(score.groupComponent), 3)
    await expect(page.getByTestId('participation-multiplier')).toContainText(`M = ${Number(score.participationMultiplier)}`)
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath('score-mobile.png'), fullPage: true })
    await page.setViewportSize(DESKTOP)
    await page.screenshot({ path: testInfo.outputPath('score-desktop.png'), fullPage: true })
  })
})
