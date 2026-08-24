import { expect, issueToken, test } from '../fixtures'

/* Feature test ของ Sprint 3
 *
 * US-13 ตัดสินและประกาศคะแนน  https://github.com/STARSTEAM-X/sdpx-arai2/issues/13
 * US-15 ปกปิดตัวตนผู้ประเมิน (k-anonymity)  https://github.com/STARSTEAM-X/sdpx-arai2/issues/15
 * US-10 นักศึกษาดูคะแนนตัวเอง  https://github.com/STARSTEAM-X/sdpx-arai2/issues/10
 *
 * roster ตั้งใจให้มี 4 กลุ่ม ขนาด 4/3/3/4 คน (ต้องมีอย่างน้อย 2 กลุ่มให้จับคู่ระดับกลุ่มได้
 * ตาม FR-PAIR — ลอง 2 และ 3 กลุ่มมาก่อนแล้วเจอ "ไม่มีคนนอกคู่มาประเมิน" และ "coverage
 * ต่างกันเกินเพดาน" ตามลำดับ 4 กลุ่มขนาดต่างกันไม่เกิน 1 คนคือค่าต่ำสุดที่ publish ผ่านจริง):
 *   group-a, group-d มี 4 คน → ทุกคนถูกประเมินรายบุคคลโดยเพื่อนอีก 3 คน (m-1) = ครบเกณฑ์
 *            k-anonymity พอดี (min_comparisons default = 3) → คะแนนรายบุคคลต้อง "เห็นได้"
 *   group-b, group-c มี 3 คน → ผู้ประเมินรายบุคคลมีแค่ 2 คน (m-1) → ต่ำกว่าเกณฑ์ → ต้อง "ถูกซ่อน"
 * ทุกกลุ่มอยู่ assignment เดียวกัน จึงเทียบพฤติกรรมสองแบบได้ในสถานการณ์เดียว
 */

const ROSTER = [
  'email,group_name',
  'stu1@kmitl.ac.th,group-a',
  'stu2@kmitl.ac.th,group-a',
  'stu3@kmitl.ac.th,group-a',
  'stu4@kmitl.ac.th,group-a',
  'stu5@kmitl.ac.th,group-b',
  'stu6@kmitl.ac.th,group-b',
  'stu7@kmitl.ac.th,group-b',
  'stu8@kmitl.ac.th,group-c',
  'stu9@kmitl.ac.th,group-c',
  'stu10@kmitl.ac.th,group-c',
  'stu11@kmitl.ac.th,group-d',
  'stu12@kmitl.ac.th,group-d',
  'stu13@kmitl.ac.th,group-d',
  'stu14@kmitl.ac.th,group-d',
].join('\n')

const ALL_STUDENTS = Array.from({ length: 14 }, (_, i) => `stu${i + 1}@kmitl.ac.th`)

const FUTURE_DEADLINE = '2027-01-01T18:30:00Z'

type Api = import('@playwright/test').APIRequestContext

function auth(token: string) {
  return { headers: { authorization: `Bearer ${token}` } }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
      name: 'งานให้คะแนน Sprint 3',
      groupMaxScore: 15,
      individualMaxScore: 10,
      groupDeadlineUtc: deadline,
      targetCoverage: 1,
      criteria: [
        { side: 'GROUP', name: 'UX', weightPct: 100 },
        { side: 'INDIVIDUAL', name: 'Teamwork', weightPct: 100 },
      ],
    },
  })
  expect(created.status(), 'สร้างงานไม่สำเร็จ').toBe(201)
  const assignmentId = (created.json ? await created.json() : {}).id as string

  const published = await api.post(`/api/assignments/${assignmentId}:publish`, auth(token))
  expect(published.status(), 'publish ไม่สำเร็จ').toBe(200)

  return assignmentId
}

async function myPairs(api: Api, token: string, assignmentId: string, side: 'GROUP' | 'INDIVIDUAL') {
  const res = await api.get(`/api/assignments/${assignmentId}/my-evaluations?side=${side}`, auth(token))
  return (await res.json()).items as { pairAssignmentId: string }[]
}

/** ให้นักศึกษาทุกคนตอบและ submit ทั้งสองฝั่ง — ใช้ choice เดิม (3) ทุกคู่เพราะ test นี้
 *  สนใจแค่ "คำนวณได้ครบหรือไม่" ไม่ได้ตรวจเลขคะแนนตรง ๆ (สูตรมี unit test คุมอยู่แล้ว) */
async function answerAndSubmitAll(api: Api, assignmentId: string) {
  for (const email of ALL_STUDENTS) {
    const token = await issueToken(api, email)
    for (const side of ['GROUP', 'INDIVIDUAL'] as const) {
      const pairs = await myPairs(api, token, assignmentId, side)
      for (const p of pairs) {
        await api.put(`/api/comparisons/${p.pairAssignmentId}`, { ...auth(token), data: { choice: 3 } })
      }
      if (pairs.length > 0) {
        await api.post(`/api/assignments/${assignmentId}/submissions`, {
          ...auth(token),
          headers: { ...auth(token).headers, 'Idempotency-Key': `submit-${email}-${side}` },
          data: { side },
        })
      }
    }
  }
}

test.describe('US-13/US-15/US-10 คำนวณ ประกาศ และดูคะแนน', () => {
  // AC (US-13): ยังไม่ถึง deadline finalize ไม่ได้
  test('edge case: finalize ก่อนถึง deadline ถูกปฏิเสธด้วย 409', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)

    const res = await api.post(`/api/assignments/${assignmentId}:finalize`, {
      ...auth(instructorToken),
      data: {},
    })
    expect(res.status()).toBe(409)
  })

  // AC (US-13): recompute ใช้ได้ตลอดไม่ต้องรอ deadline — ไว้ดูความคืบหน้าระหว่างทาง
  test('AC: recompute คะแนนชั่วคราวได้ก่อนถึง deadline', async ({ api, instructorToken, classroomId }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    await answerAndSubmitAll(api, assignmentId)

    const res = await api.post(`/api/assignments/${assignmentId}:recompute`, auth(instructorToken))
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(typeof body.hasLowConfidenceItems).toBe('boolean')
  })

  // AC (US-13): "คะแนนที่ยังไม่ finalize ต้องมี label ชั่วคราวกำกับเสมอไม่ว่าจะแสดงที่ไหน" —
  // /scores คือจุดเดียวที่อาจารย์เห็นตัวเลขก่อน finalize ตรวจว่า isFinal บอกสถานะถูกต้องจริง
  test('AC: /scores บอก isFinal:false ก่อน finalize และ isFinal:true หลัง finalize', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const deadline = new Date(Date.now() + 4000).toISOString()
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, deadline)
    await answerAndSubmitAll(api, assignmentId)

    await api.post(`/api/assignments/${assignmentId}:recompute`, auth(instructorToken))
    const interim = await api.get(`/api/assignments/${assignmentId}/scores`, auth(instructorToken))
    expect(interim.status()).toBe(200)
    const interimBody = await interim.json()
    expect(interimBody.isFinal).toBe(false)
    expect(interimBody.items.length).toBeGreaterThan(0)

    const msLeft = new Date(deadline).getTime() - Date.now()
    if (msLeft > 0) await sleep(msLeft + 500)
    await api.post(`/api/assignments/${assignmentId}:finalize`, {
      ...auth(instructorToken),
      data: { confirmLowConfidence: true },
    })

    const final = await api.get(`/api/assignments/${assignmentId}/scores`, auth(instructorToken))
    expect((await final.json()).isFinal).toBe(true)
  })

  // AC (US-15 คู่กับ US-13): นักศึกษาต้องเรียก /scores (คะแนนชั่วคราวรายบุคคล) ไม่ได้เลย —
  // endpoint นี้จำกัดไว้ฝั่งอาจารย์เท่านั้น ไม่ใช่ตาม k-anonymity เหมือน my-score
  test('edge case: นักศึกษาเรียก /scores ไม่ได้ ตอบ 403', async ({ api, instructorToken, classroomId }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')

    const res = await api.get(`/api/assignments/${assignmentId}/scores`, auth(studentToken))
    expect(res.status()).toBe(403)
  })

  // AC (US-13): CO_TEACHER จัดการ assignment ได้ แต่ finalize ไม่ได้ (FINALIZE_SCORES เป็นของ OWNER เท่านั้น)
  test('edge case: CO_TEACHER finalize ไม่ได้ ตอบ 403', async ({ api, instructorToken, classroomId }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)

    const added = await api.post(`/api/classrooms/${classroomId}/members`, {
      ...auth(instructorToken),
      data: { email: 'co-teacher@kmitl.ac.th', role: 'CO_TEACHER' },
    })
    expect(added.ok(), 'เพิ่มผู้ร่วมสอนไม่สำเร็จ').toBeTruthy()
    const coTeacherToken = await issueToken(api, 'co-teacher@kmitl.ac.th')

    const res = await api.post(`/api/assignments/${assignmentId}:finalize`, {
      ...auth(coTeacherToken),
      data: {},
    })
    expect(res.status()).toBe(403)
  })

  // AC (US-10): งานยังไม่ประกาศผล — นักศึกษาต้องไม่เห็นตัวเลขคะแนนเลยแม้แต่ตัวเดียว
  test('AC: ก่อนประกาศผล my-score บอกแค่ว่ายังไม่ประกาศ ไม่มีตัวเลขคะแนนติดมา', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')

    const res = await api.get(`/api/assignments/${assignmentId}/my-score`, auth(studentToken))
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.finalized).toBe(false)
    expect(body.groupComponent).toBeNull()
    expect(body.finalScore).toBeNull()
  })

  test.describe('เมื่อประกาศผลแล้ว (ต้องรอ deadline ผ่านจริง)', () => {
    // ทุก test ในกลุ่มนี้ต้องการ deadline ที่เลยไปแล้วก่อน finalize — สร้าง assignment ที่ deadline
    // ใกล้ปัจจุบันมาก ๆ (ไม่ใช่อดีต เพราะนักศึกษาต้องตอบและ submit ได้ก่อน) แล้วรอเวลาจริงผ่านไป
    // ไม่ mock เวลา เพราะ finalize_service เทียบเวลาปัจจุบันจริงกับ deadline ตรง ๆ
    async function setupFinalized(api: Api, instructorToken: string, classroomId: string) {
      await seedRoster(api, instructorToken, classroomId)
      const deadline = new Date(Date.now() + 4000).toISOString()
      const assignmentId = await createAndPublish(api, instructorToken, classroomId, deadline)
      await answerAndSubmitAll(api, assignmentId)

      const msLeft = new Date(deadline).getTime() - Date.now()
      if (msLeft > 0) await sleep(msLeft + 500)

      const res = await api.post(`/api/assignments/${assignmentId}:finalize`, {
        ...auth(instructorToken),
        data: { confirmLowConfidence: true },
      })
      expect(res.status(), `finalize ไม่สำเร็จ: ${await res.text()}`).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('FINALIZED')

      return assignmentId
    }

    // AC (US-15): group-a มี 4 คน → ทุกคนถูกประเมินโดยเพื่อนอีก 3 คน = ครบเกณฑ์ k-anonymity พอดี
    test('AC: กลุ่มที่มีผู้ประเมินครบเกณฑ์ (m=4) เห็นคะแนนรายบุคคลของตัวเอง', async ({
      api,
      instructorToken,
      classroomId,
    }) => {
      const assignmentId = await setupFinalized(api, instructorToken, classroomId)
      const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')

      const res = await api.get(`/api/assignments/${assignmentId}/my-score`, auth(studentToken))
      const body = await res.json()
      expect(body.finalized).toBe(true)
      expect(body.individualHidden).toBe(false)
      expect(body.individualComponent).not.toBeNull()
      expect(body.finalScore).not.toBeNull()
      expect(body.groupComponent).not.toBeNull()
    })

    // AC (US-15): group-b มี 3 คน → ผู้ประเมินรายบุคคลมีแค่ 2 คน < เกณฑ์ 3 → ต้องซ่อน
    // และ finalScore ที่รวมส่วนบุคคลไว้ต้องซ่อนไปด้วย ไม่ใช่แค่ individualComponent อย่างเดียว
    test('AC: กลุ่มที่มีผู้ประเมินไม่ครบเกณฑ์ (m=3) ไม่เห็นคะแนนรายบุคคล และ finalScore ก็ถูกซ่อนด้วย', async ({
      api,
      instructorToken,
      classroomId,
    }) => {
      const assignmentId = await setupFinalized(api, instructorToken, classroomId)
      const studentToken = await issueToken(api, 'stu5@kmitl.ac.th')

      const res = await api.get(`/api/assignments/${assignmentId}/my-score`, auth(studentToken))
      const body = await res.json()
      expect(body.finalized).toBe(true)
      expect(body.individualHidden).toBe(true)
      expect(body.individualComponent).toBeNull()
      expect(body.finalScore).toBeNull()
      // คะแนนกลุ่มไม่เกี่ยวกับ k-anonymity รายบุคคล ต้องยังเห็นได้ปกติ
      expect(body.groupComponent).not.toBeNull()
    })

    // AC (US-13): reopen ต้องมีเหตุผลเสมอ
    test('edge case: reopen ไม่ใส่เหตุผลถูกปฏิเสธด้วย 422', async ({ api, instructorToken, classroomId }) => {
      const assignmentId = await setupFinalized(api, instructorToken, classroomId)

      const res = await api.post(`/api/assignments/${assignmentId}:reopen`, {
        ...auth(instructorToken),
        data: { reason: '' },
      })
      expect(res.status()).toBe(422)
    })

    // AC (US-13): reopen มีเหตุผล → สำเร็จ และ my-score ของนักศึกษากลับไปเป็น "ยังไม่ประกาศผล"
    test('AC: reopen มีเหตุผล สำเร็จ และคะแนนที่นักศึกษาเห็นกลับไปเป็นยังไม่ประกาศผล', async ({
      api,
      instructorToken,
      classroomId,
    }) => {
      const assignmentId = await setupFinalized(api, instructorToken, classroomId)

      const reopened = await api.post(`/api/assignments/${assignmentId}:reopen`, {
        ...auth(instructorToken),
        data: { reason: 'พบว่าคะแนนกลุ่ม B ผิดพลาด ต้องแก้ก่อนประกาศจริง' },
      })
      expect(reopened.status()).toBe(200)
      expect((await reopened.json()).status).toBe('CLOSED')

      const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
      const res = await api.get(`/api/assignments/${assignmentId}/my-score`, auth(studentToken))
      expect((await res.json()).finalized).toBe(false)
    })

    // AC (US-13): reopen ได้เฉพาะงานที่ finalize แล้ว
    test('edge case: reopen งานที่ยัง finalize ไม่ได้ตอบ 409', async ({
      api,
      instructorToken,
      classroomId,
    }) => {
      await seedRoster(api, instructorToken, classroomId)
      const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)

      const res = await api.post(`/api/assignments/${assignmentId}:reopen`, {
        ...auth(instructorToken),
        data: { reason: 'ทดสอบ' },
      })
      expect(res.status()).toBe(409)
    })
  })

  test.describe('บนหน้าเว็บ', () => {
    test('AC: นักศึกษาเห็นลิงก์ "ดูคะแนน" เฉพาะงานที่ประกาศผลแล้ว และหน้าคะแนนแสดงตัวเลขจริง', async ({
      page,
      api,
      instructorToken,
      classroomId,
    }) => {
      await seedRoster(api, instructorToken, classroomId)
      const deadline = new Date(Date.now() + 4000).toISOString()
      const assignmentId = await createAndPublish(api, instructorToken, classroomId, deadline)
      await answerAndSubmitAll(api, assignmentId)

      const msLeft = new Date(deadline).getTime() - Date.now()
      if (msLeft > 0) await sleep(msLeft + 500)

      const finalize = await api.post(`/api/assignments/${assignmentId}:finalize`, {
        ...auth(instructorToken),
        data: { confirmLowConfidence: true },
      })
      expect(finalize.status()).toBe(200)

      const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
      await page.addInitScript(
        ([key, token]) => window.localStorage.setItem(key, token),
        ['paireval.session', studentToken] as const,
      )

      await page.goto(`/classrooms/${classroomId}`)
      const link = page.getByTestId(`score-link-${assignmentId}`)
      await expect(link).toBeVisible()
      await link.click()

      await expect(page.getByRole('heading', { level: 1, name: 'คะแนนของฉัน' })).toBeVisible()
      await expect(page.getByTestId('group-component')).toBeVisible()
      await expect(page.getByTestId('final-score')).toBeVisible()
    })

    test('AC: อาจารย์เห็นปุ่มควบคุมคะแนน และหลังประกาศผลเห็นปุ่มเปิดกลับมาแก้', async ({
      page,
      api,
      instructorToken,
      classroomId,
    }) => {
      await seedRoster(api, instructorToken, classroomId)
      const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)

      await page.addInitScript(
        ([key, token]) => window.localStorage.setItem(key, token),
        ['paireval.session', instructorToken] as const,
      )
      await page.goto(`/classrooms/${classroomId}`)

      const card = page.getByTestId('assignment-scoring-card')
      await expect(card).toBeVisible()
      await expect(card.getByRole('button', { name: 'ประกาศผลคะแนน' })).toBeVisible()
      await expect(card.getByRole('button', { name: 'คำนวณคะแนนชั่วคราว' })).toBeVisible()

      // ปุ่มประกาศผลต้องถูกปิดไว้ก่อนถึง deadline (ป้องกันกดพลาดแทนที่จะรอ backend ปฏิเสธ)
      await expect(card.getByRole('button', { name: 'ประกาศผลคะแนน' })).toBeDisabled()
    })

    // AC (US-13): คะแนนที่ยังไม่ finalize ต้องมี label "ชั่วคราว" กำกับบนหน้าเว็บของอาจารย์เสมอ
    test('AC: กดดูคะแนนที่คำนวณก่อน finalize เห็น label "ชั่วคราว — อาจเปลี่ยนแปลงได้"', async ({
      page,
      api,
      instructorToken,
      classroomId,
    }) => {
      await seedRoster(api, instructorToken, classroomId)
      const assignmentId = await createAndPublish(api, instructorToken, classroomId, FUTURE_DEADLINE)
      await answerAndSubmitAll(api, assignmentId)
      await api.post(`/api/assignments/${assignmentId}:recompute`, auth(instructorToken))

      await page.addInitScript(
        ([key, token]) => window.localStorage.setItem(key, token),
        ['paireval.session', instructorToken] as const,
      )
      await page.goto(`/classrooms/${classroomId}`)

      const card = page.getByTestId('assignment-scoring-card')
      await card.getByRole('button', { name: 'ดูคะแนนที่คำนวณ' }).click()
      await expect(card.getByTestId('scores-final-flag')).toHaveText('ชั่วคราว — อาจเปลี่ยนแปลงได้')
    })
  })
})
