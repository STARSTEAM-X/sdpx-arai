import { expect, issueToken, test } from '../fixtures'
import { testUsers } from '../seed/test-data'

/* Feature test ของ Sprint 3
 *
 * US-08 ประเมินคู่ด้วยมาตรวัด 6 ระดับ พร้อมบันทึกอัตโนมัติ
 * https://github.com/STARSTEAM-X/sdpx-arai2/issues/8
 *
 * ชุด API ตรวจสัญญาของ PUT /api/comparisons/{id} (idempotent, สิทธิ์, deadline)
 * ชุดหน้าเว็บตรวจ autosave debounce 2 วินาทีจริง — ไม่ใช้ waitForTimeout เพราะ
 * expect().toBeVisible() รอเองจนกว่า DOM จะเปลี่ยนอยู่แล้ว (web-first assertion)
 */

const FUTURE_DEADLINE = '2027-01-01T18:30:00Z'
const PAST_DEADLINE = '2020-01-01T00:00:00Z'

type Api = import('@playwright/test').APIRequestContext

function auth(token: string) {
  return { headers: { authorization: `Bearer ${token}` } }
}

const ROSTER = [
  'email,group_name',
  'stu1@kmitl.ac.th,group-a',
  'stu2@kmitl.ac.th,group-a',
  'stu3@kmitl.ac.th,group-b',
  'stu4@kmitl.ac.th,group-b',
  'stu5@kmitl.ac.th,group-c',
  'stu6@kmitl.ac.th,group-c',
].join('\n')

async function seedRoster(api: Api, token: string, classroomId: string) {
  const res = await api.post(`/api/classrooms/${classroomId}/roster:import`, {
    ...auth(token),
    multipart: {
      file: { name: 'roster.csv', mimeType: 'text/csv', buffer: Buffer.from(ROSTER, 'utf-8') },
    },
  })
  expect(res.ok(), 'เตรียม roster ไม่สำเร็จ').toBeTruthy()
}

async function createAndPublish(api: Api, token: string, classroomId: string, deadline: string) {
  const created = await api.post('/api/assignments', {
    ...auth(token),
    data: {
      classroomId,
      name: 'งานกลุ่มครั้งที่ 1',
      groupMaxScore: 15,
      individualMaxScore: 0,
      groupDeadlineUtc: deadline,
      targetCoverage: 1,
      criteria: [{ side: 'GROUP', name: 'UX', weightPct: 100 }],
    },
  })
  expect(created.status()).toBe(201)
  const assignmentId = (await created.json()).id as string

  const published = await api.post(`/api/assignments/${assignmentId}:publish`, auth(token))
  expect(published.status(), 'publish ไม่สำเร็จ').toBe(200)

  return assignmentId
}

async function firstPairId(api: Api, token: string, assignmentId: string): Promise<string> {
  const res = await api.get(`/api/assignments/${assignmentId}/my-evaluations?side=GROUP`, auth(token))
  const body = await res.json()
  return body.items[0].pairAssignmentId as string
}

test.describe('US-08 ประเมินคู่ด้วยมาตรวัด 6 ระดับ พร้อมบันทึกอัตโนมัติ', () => {
  // AC: เรียก autosave ซ้ำด้วย body เดิมหลายครั้ง ผลลัพธ์ต้องเหมือนเดิม ไม่เกิดแถวซ้ำ
  test('happy path + AC idempotent: บันทึกซ้ำด้วย choice เดิมได้ comparison id เดิมทุกครั้ง', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
    const pairId = await firstPairId(api, studentToken, assignmentId)

    const first = await api.put(`/api/comparisons/${pairId}`, { ...auth(studentToken), data: { choice: 3 } })
    expect(first.status()).toBe(200)
    const firstBody = await first.json()
    expect(firstBody.choice).toBe(3)
    expect(firstBody.status).toBe('DRAFT')

    const second = await api.put(`/api/comparisons/${pairId}`, { ...auth(studentToken), data: { choice: 3 } })
    const third = await api.put(`/api/comparisons/${pairId}`, { ...auth(studentToken), data: { choice: 3 } })

    expect((await second.json()).id).toBe(firstBody.id)
    expect((await third.json()).id).toBe(firstBody.id)

    // ยืนยันผ่าน my-evaluations ว่าค่าที่ตอบไว้สะท้อนกลับมาถูกต้อง (ไม่มีทางอ่าน comparison ตรง ๆ)
    const check = await api.get(`/api/assignments/${assignmentId}/my-evaluations?side=GROUP`, auth(studentToken))
    const item = (await check.json()).items.find((i: { pairAssignmentId: string }) => i.pairAssignmentId === pairId)
    expect(item.choice).toBe(3)
  })

  test('เปลี่ยนคำตอบแล้ว choice อัปเดตเป็นค่าล่าสุด', async ({ api, instructorToken, classroomId }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
    const pairId = await firstPairId(api, studentToken, assignmentId)

    await api.put(`/api/comparisons/${pairId}`, { ...auth(studentToken), data: { choice: 1 } })
    const changed = await api.put(`/api/comparisons/${pairId}`, { ...auth(studentToken), data: { choice: 6 } })

    expect((await changed.json()).choice).toBe(6)
  })

  // AC: ฉันไม่ใช่ evaluator ของคู่นี้ → 403
  test('AC: ไม่ใช่ evaluator ของคู่นี้ถูกปฏิเสธด้วย 403 NOT_YOUR_PAIR', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    const owner = await issueToken(api, 'stu1@kmitl.ac.th')
    const pairId = await firstPairId(api, owner, assignmentId)

    // stu3 เป็นสมาชิกห้องเดียวกัน แต่ไม่ใช่ evaluator ของคู่นี้
    const notOwner = await issueToken(api, 'stu3@kmitl.ac.th')
    const res = await api.put(`/api/comparisons/${pairId}`, { ...auth(notOwner), data: { choice: 3 } })

    expect(res.status()).toBe(403)
    expect((await res.json()).error.code).toBe('NOT_YOUR_PAIR')
  })

  // regression ของ US-11 — คนนอกห้องเรียกไม่ได้ ได้ 404 ไม่ใช่ 403
  test('regression US-11: คนนอกห้องเรียกไม่ได้ ได้ 404', async ({ api, instructorToken, classroomId }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    const owner = await issueToken(api, 'stu1@kmitl.ac.th')
    const pairId = await firstPairId(api, owner, assignmentId)

    const outsider = await issueToken(api, testUsers.otherInstructor.email)
    const res = await api.put(`/api/comparisons/${pairId}`, { ...auth(outsider), data: { choice: 3 } })

    expect(res.status()).toBe(404)
  })

  // AC ของ FR-EVAL-08 (ยึดจาก openapi.yaml): เลย deadline แล้วบันทึกไม่ได้
  test('edge case: เลย deadline แล้วบันทึกไม่ได้ ตอบ 409 DEADLINE_PASSED', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, PAST_DEADLINE)
    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
    const pairId = await firstPairId(api, studentToken, assignmentId)

    const res = await api.put(`/api/comparisons/${pairId}`, { ...auth(studentToken), data: { choice: 3 } })

    expect(res.status()).toBe(409)
    expect((await res.json()).error.code).toBe('DEADLINE_PASSED')
  })

  test('edge case: choice นอกช่วง 1-6 ถูกปฏิเสธด้วย 422', async ({ api, instructorToken, classroomId }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
    const pairId = await firstPairId(api, studentToken, assignmentId)

    const res = await api.put(`/api/comparisons/${pairId}`, { ...auth(studentToken), data: { choice: 7 } })

    expect(res.status()).toBe(422)
  })

  test.describe('บนหน้าเว็บ', () => {
    // AC: เปิดหน้าคู่ประเมิน ดูตัวเลือก ต้องมี 6 ระดับ และไม่มีตัวเลือก "เท่ากัน"
    test('AC: มี 6 ตัวเลือกพอดี ไม่มีตัวเลือกกลาง', async ({ page, api, instructorToken, classroomId }) => {
      await seedRoster(api, instructorToken, classroomId)
      const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
      const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')

      await page.addInitScript(
        ([key, token]) => window.localStorage.setItem(key, token),
        ['paireval.session', studentToken] as const,
      )
      await page.goto(`/classrooms/${classroomId}/assignments/${assignmentId}/evaluate`)

      const options = page.getByRole('radio')
      await expect(options).toHaveCount(6)
      await expect(page.getByText('เท่ากัน')).toHaveCount(0)
    })

    // AC: เลือกคำตอบแล้วผ่านไป 2 วินาทีโดยไม่กดอะไร ระบบบันทึกอัตโนมัติ
    test('AC: เลือกคำตอบแล้ว autosave เองภายในไม่กี่วินาทีโดยไม่ต้องกดปุ่มบันทึก', async ({
      page,
      api,
      instructorToken,
      classroomId,
    }) => {
      await seedRoster(api, instructorToken, classroomId)
      const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
      const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')

      await page.addInitScript(
        ([key, token]) => window.localStorage.setItem(key, token),
        ['paireval.session', studentToken] as const,
      )
      await page.goto(`/classrooms/${classroomId}/assignments/${assignmentId}/evaluate`)

      await page.getByRole('radio', { name: 'ขวาดีกว่า', exact: true }).click()

      // ไม่ใช้ waitForTimeout — expect รอเองจนกว่า debounce (2s) จะยิง PUT เสร็จ
      await expect(page.getByText(/บันทึกแล้ว/)).toBeVisible({ timeout: 5000 })
    })

    // AC ของ FR-EVAL-04: ปิด browser กลางคันแล้วเปิดใหม่ คำตอบเดิมยังอยู่
    test('AC: โหลดหน้าใหม่แล้วคำตอบที่เคยเลือกไว้ยังอยู่', async ({
      page,
      api,
      instructorToken,
      classroomId,
    }) => {
      await seedRoster(api, instructorToken, classroomId)
      const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
      const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
      const pairId = await firstPairId(api, studentToken, assignmentId)

      // บันทึกผ่าน API ตรง ๆ แทนการรอ debounce ของหน้าเว็บ — จำลอง "เคยตอบไว้ก่อนหน้านี้"
      await api.put(`/api/comparisons/${pairId}`, { ...auth(studentToken), data: { choice: 6 } })

      await page.addInitScript(
        ([key, token]) => window.localStorage.setItem(key, token),
        ['paireval.session', studentToken] as const,
      )
      await page.goto(`/classrooms/${classroomId}/assignments/${assignmentId}/evaluate`)

      await expect(page.getByRole('radio', { name: 'ขวาดีกว่ามาก', exact: true })).toHaveAttribute(
        'aria-checked',
        'true',
      )
    })
  })
})
