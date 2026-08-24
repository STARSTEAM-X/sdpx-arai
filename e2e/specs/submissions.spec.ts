import { expect, issueToken, test } from '../fixtures'

/* Feature test ของ Sprint 3
 *
 * US-09 ส่งคำตอบทั้งชุด  https://github.com/STARSTEAM-X/sdpx-arai2/issues/9
 *
 * AC สำคัญที่สุดของ story นี้คือ "ตอบไม่ครบก็ยัง submit ได้ตามปกติ" — ของเดิมในสเปกร่าง
 * เขียนว่า 422 ซึ่งขัด FR-EVAL-05 โดยตรง (ดูบันทึกการตัดสินใจใน docs/backlog.md ที่ US-09)
 * ชุดนี้จึงมี test เฉพาะที่กันไม่ให้ใครเผลอใส่ 422 กลับเข้ามา
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

// 2 เกณฑ์ต่อฝั่ง ทำให้แต่ละคนได้ 2 คู่ (1 ต่อเกณฑ์) — ใช้ทดสอบ "ตอบไม่ครบ" ได้จริง
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
      criteria: [
        { side: 'GROUP', name: 'UX', weightPct: 60 },
        { side: 'GROUP', name: 'Completeness', weightPct: 40 },
      ],
    },
  })
  expect(created.status()).toBe(201)
  const assignmentId = (await created.json()).id as string

  const published = await api.post(`/api/assignments/${assignmentId}:publish`, auth(token))
  expect(published.status(), 'publish ไม่สำเร็จ').toBe(200)

  return assignmentId
}

async function myPairs(api: Api, token: string, assignmentId: string) {
  const res = await api.get(`/api/assignments/${assignmentId}/my-evaluations?side=GROUP`, auth(token))
  return (await res.json()).items as { pairAssignmentId: string }[]
}

test.describe('US-09 ส่งคำตอบทั้งชุด', () => {
  // AC: ประเมินครบทุกคู่ของ side นั้นแล้วกดส่ง ทุก comparison เปลี่ยนเป็น SUBMITTED
  test('happy path: ตอบครบแล้ว submit สำเร็จ และ my-evaluations เห็น completed ครบ', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
    const pairs = await myPairs(api, studentToken, assignmentId)
    expect(pairs).toHaveLength(2)

    for (const p of pairs) {
      await api.put(`/api/comparisons/${p.pairAssignmentId}`, { ...auth(studentToken), data: { choice: 3 } })
    }

    const res = await api.post(`/api/assignments/${assignmentId}/submissions`, {
      ...auth(studentToken),
      headers: { ...auth(studentToken).headers, 'Idempotency-Key': 'submit-happy-1' },
      data: { side: 'GROUP' },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.submittedCount).toBe(2)

    const check = await api.get(`/api/assignments/${assignmentId}/my-evaluations?side=GROUP`, auth(studentToken))
    const checkBody = await check.json()
    expect(checkBody.completedCount).toBe(2)
    expect(checkBody.items.every((i: { completed: boolean }) => i.completed)).toBe(true)
  })

  // AC: ตอบไม่ครบก็ยัง submit ได้ตามปกติ — server ต้องไม่ตอบ 422
  test('AC: ตอบไม่ครบยัง submit สำเร็จ ไม่ใช่ 422 — submit เท่าที่ตอบไว้จริง', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
    const pairs = await myPairs(api, studentToken, assignmentId)

    // ตอบแค่คู่แรก ปล่อยคู่ที่สองว่างไว้
    await api.put(`/api/comparisons/${pairs[0].pairAssignmentId}`, { ...auth(studentToken), data: { choice: 5 } })

    const res = await api.post(`/api/assignments/${assignmentId}/submissions`, {
      ...auth(studentToken),
      headers: { ...auth(studentToken).headers, 'Idempotency-Key': 'submit-partial-1' },
      data: { side: 'GROUP' },
    })

    expect(res.status()).toBe(200) // ไม่ใช่ 422
    expect((await res.json()).submittedCount).toBe(1)
  })

  // AC: ส่งซ้ำด้วย Idempotency-Key เดิม ไม่เกิดผลซ้ำซ้อนและได้ผลลัพธ์เดิม
  test('AC: idempotency-key เดิม เรียกซ้ำได้ submittedAt เดิมเป๊ะ', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
    const pairs = await myPairs(api, studentToken, assignmentId)
    await api.put(`/api/comparisons/${pairs[0].pairAssignmentId}`, { ...auth(studentToken), data: { choice: 1 } })

    const submitOnce = () =>
      api.post(`/api/assignments/${assignmentId}/submissions`, {
        ...auth(studentToken),
        headers: { ...auth(studentToken).headers, 'Idempotency-Key': 'submit-idem-1' },
        data: { side: 'GROUP' },
      })

    const first = await (await submitOnce()).json()
    const second = await (await submitOnce()).json()
    const third = await (await submitOnce()).json()

    expect(second.submittedAt).toBe(first.submittedAt)
    expect(third.submittedAt).toBe(first.submittedAt)
  })

  test('FR-API-02: key เดียวกันของคนละผู้ใช้ไม่ชนกัน', async ({ api, instructorToken, classroomId }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    const token1 = await issueToken(api, 'stu1@kmitl.ac.th')
    const token2 = await issueToken(api, 'stu2@kmitl.ac.th')
    const pairs1 = await myPairs(api, token1, assignmentId)
    const pairs2 = await myPairs(api, token2, assignmentId)
    await api.put(`/api/comparisons/${pairs1[0].pairAssignmentId}`, { ...auth(token1), data: { choice: 1 } })
    for (const pair of pairs2) {
      await api.put(`/api/comparisons/${pair.pairAssignmentId}`, { ...auth(token2), data: { choice: 2 } })
    }

    const submit = (token: string) => api.post(`/api/assignments/${assignmentId}/submissions`, {
      ...auth(token),
      headers: { ...auth(token).headers, 'Idempotency-Key': 'shared-client-key' },
      data: { side: 'GROUP' },
    })
    expect((await (await submit(token1)).json()).submittedCount).toBe(1)
    expect((await (await submit(token2)).json()).submittedCount).toBe(2)
  })

  test('FR-API-02: request scope เดียวกันที่มาพร้อมกันได้ response เดียวกัน', async ({
    api, instructorToken, classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    const token = await issueToken(api, 'stu1@kmitl.ac.th')
    const pairs = await myPairs(api, token, assignmentId)
    await api.put(`/api/comparisons/${pairs[0].pairAssignmentId}`, { ...auth(token), data: { choice: 1 } })
    const submit = () => api.post(`/api/assignments/${assignmentId}/submissions`, {
      ...auth(token),
      headers: { ...auth(token).headers, 'Idempotency-Key': 'concurrent-key' },
      data: { side: 'GROUP' },
    })

    const [a, b] = await Promise.all([submit(), submit()])
    expect(a.status()).toBe(200)
    expect(b.status()).toBe(200)
    expect(await b.json()).toEqual(await a.json())
  })

  test('edge case: ขาด Idempotency-Key header ถูกปฏิเสธด้วย 422', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')

    const res = await api.post(`/api/assignments/${assignmentId}/submissions`, {
      ...auth(studentToken),
      data: { side: 'GROUP' },
    })

    expect(res.status()).toBe(422)
  })

  // AC: เลย deadline แล้วกดส่งไม่ได้
  test('edge case: เลย deadline แล้ว submit ไม่ได้ ตอบ 409 DEADLINE_PASSED', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, PAST_DEADLINE)
    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')

    const res = await api.post(`/api/assignments/${assignmentId}/submissions`, {
      ...auth(studentToken),
      headers: { ...auth(studentToken).headers, 'Idempotency-Key': 'submit-past-1' },
      data: { side: 'GROUP' },
    })

    expect(res.status()).toBe(409)
    expect((await res.json()).error.code).toBe('DEADLINE_PASSED')
  })

  test.describe('บนหน้าเว็บ', () => {
    test('AC: ตอบไม่ครบแล้วกดส่ง ต้องเห็น dialog ถามยืนยันจำนวนที่เหลือก่อนส่งจริง', async ({
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

      let dialogMessage = ''
      page.on('dialog', (dialog) => {
        dialogMessage = dialog.message()
        void dialog.dismiss() // ปฏิเสธ — ต้อง "ไม่" ส่งจริงถ้าไม่กดยืนยัน
      })

      await page.goto(`/classrooms/${classroomId}/assignments/${assignmentId}/evaluate`)
      await page.getByRole('button', { name: 'ส่งคำตอบ' }).click()

      await expect.poll(() => dialogMessage).toContain('2')
      // dismiss ไปแล้ว — ต้องไม่เห็นข้อความว่าส่งสำเร็จ
      await expect(page.getByText(/ส่งแล้ว/)).toHaveCount(0)
    })

    test('ตอบครบแล้วกดส่ง — ไม่มี dialog และเห็นข้อความส่งสำเร็จ', async ({
      page,
      api,
      instructorToken,
      classroomId,
    }) => {
      await seedRoster(api, instructorToken, classroomId)
      const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
      const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
      const pairs = await myPairs(api, studentToken, assignmentId)
      for (const p of pairs) {
        await api.put(`/api/comparisons/${p.pairAssignmentId}`, { ...auth(studentToken), data: { choice: 2 } })
      }

      let dialogShown = false
      page.on('dialog', (dialog) => {
        dialogShown = true
        void dialog.accept()
      })

      await page.addInitScript(
        ([key, token]) => window.localStorage.setItem(key, token),
        ['paireval.session', studentToken] as const,
      )
      await page.goto(`/classrooms/${classroomId}/assignments/${assignmentId}/evaluate`)
      await page.getByRole('button', { name: 'ส่งคำตอบ' }).click()

      await expect(page.getByText(/ส่งแล้ว 2 คู่/)).toBeVisible()
      expect(dialogShown).toBe(false)
    })

    // FR-EVAL-08: เลย deadline แล้วต้องเป็น read-only ทั้งหน้า
    test('AC: เลย deadline แล้วแก้ไขและส่งไม่ได้ — ตัวเลือกถูกปิดและไม่มีปุ่มส่ง', async ({
      page,
      api,
      instructorToken,
      classroomId,
    }) => {
      await seedRoster(api, instructorToken, classroomId)
      const assignmentId = await createAndPublish(api, instructorToken, classroomId, PAST_DEADLINE)
      const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')

      await page.addInitScript(
        ([key, token]) => window.localStorage.setItem(key, token),
        ['paireval.session', studentToken] as const,
      )
      await page.goto(`/classrooms/${classroomId}/assignments/${assignmentId}/evaluate`)

      await expect(page.getByRole('button', { name: 'ส่งคำตอบ' })).toHaveCount(0)
      const radios = page.getByRole('radio')
      await expect(radios.first()).toBeDisabled()
    })
  })
})
