import { expect, issueToken, test } from '../fixtures'
import { testUsers } from '../seed/test-data'

/* Feature test ของ Sprint 3
 *
 * US-07 นักศึกษาเห็นรายการงานที่ต้องประเมิน  https://github.com/STARSTEAM-X/sdpx-arai2/issues/7
 *
 * ชุด API ตรวจสัญญาของ /my-evaluations และ /classrooms/{id}/assignments โดยตรง
 * ส่วน timezone (AC ข้อ 4) ต้องผ่านหน้าเว็บจริงเท่านั้น เพราะแปลงค่าฝั่ง frontend
 * ไม่ใช่สิ่งที่ API เห็น — API คืนแค่ UTC ดิบ ๆ เสมอ
 */

const DEADLINE = '2027-01-01T18:30:00Z' // 01:30 ของวันถัดไปใน Asia/Bangkok (UTC+7)

type Api = import('@playwright/test').APIRequestContext

function auth(token: string) {
  return { headers: { authorization: `Bearer ${token}` } }
}

/** roster 6 คน 3 กลุ่มเท่า ๆ กัน — เล็กที่สุดที่ยัง publish ได้จริง
 *  (2 กลุ่มจัดคู่ไม่ได้เลย เพราะทุกคนอยู่ในกลุ่มใดกลุ่มหนึ่งของคู่เดียวที่มี) */
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

async function createAssignment(api: Api, token: string, classroomId: string) {
  const res = await api.post('/api/assignments', {
    ...auth(token),
    data: {
      classroomId,
      name: 'งานกลุ่มครั้งที่ 1',
      artifactUrl: 'https://drive.example.com/shared-folder',
      groupMaxScore: 15,
      individualMaxScore: 0, // ปิดฝั่งบุคคลไว้ตั้งใจ — ใช้ทดสอบ AC ของฝั่งที่ไม่มีการประเมิน
      groupDeadlineUtc: DEADLINE,
      targetCoverage: 1,
      criteria: [
        { side: 'GROUP', name: 'UX', weightPct: 60 },
        { side: 'GROUP', name: 'Completeness', weightPct: 40 },
      ],
    },
  })
  expect(res.status(), 'สร้างงานประเมินไม่สำเร็จ').toBe(201)
  return (await res.json()).id as string
}

test.describe('US-07 นักศึกษาเห็นรายการงานที่ต้องประเมิน', () => {
  // AC: Given assignment ยังไม่ถึงเวลาเปิด, When เปิดหน้ารายการ,
  //     Then ไม่เห็นคู่ใด ๆ และเห็นข้อความบอกว่าเปิดเมื่อไร
  test('edge case: ยังไม่ publish นักศึกษาไม่เห็นคู่ พร้อมข้อความอธิบาย', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAssignment(api, instructorToken, classroomId)
    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')

    const res = await api.get(
      `/api/assignments/${assignmentId}/my-evaluations?side=GROUP`,
      auth(studentToken),
    )

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.opened).toBe(false)
    expect(body.items).toHaveLength(0)
    expect(body.message).toContain('ยังไม่เปิด')
  })

  // AC: Given ฉันมีคู่ที่ต้องประเมิน, When เปิดหน้ารายการ, Then เห็นความคืบหน้าและรายการคู่
  test('happy path: publish แล้วนักศึกษาเห็นคู่ครบตามเกณฑ์ พร้อมนับความคืบหน้า', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAssignment(api, instructorToken, classroomId)
    const published = await api.post(
      `/api/assignments/${assignmentId}:publish`,
      auth(instructorToken),
    )
    expect(published.status()).toBe(200)

    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
    const res = await api.get(
      `/api/assignments/${assignmentId}/my-evaluations?side=GROUP`,
      auth(studentToken),
    )

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.opened).toBe(true)
    // 2 เกณฑ์ × ไม่เข้ากลุ่มตัวเอง = ได้ 1 คู่ต่อเกณฑ์ ต่อคน (3 กลุ่ม)
    expect(body.totalCount).toBe(2)
    expect(body.completedCount).toBe(0) // ยังไม่มี endpoint ให้ตอบ (US-08) — ต้องเป็น 0 เสมอตอนนี้
    expect(body.items).toHaveLength(2)
    // ต้องแยก section ตามเกณฑ์ได้ (FR-EVAL-01) — สอง item ต้องมาจากคนละเกณฑ์
    const criterionNames = body.items.map((i: { criterionName: string }) => i.criterionName).sort()
    expect(criterionNames).toEqual(['Completeness', 'UX'])
    expect(body.artifactUrl).toBe('https://drive.example.com/shared-folder')
  })

  // AC: individualMaxScore = 0 ไม่ใช่แค่ list ว่างเฉย ๆ ต้องอธิบายว่าทำไม (FR-ASSIGN-07)
  test('edge case: ฝั่งบุคคลถูกปิดไว้ ไม่เห็น item แต่มีข้อความอธิบาย', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAssignment(api, instructorToken, classroomId)
    await api.post(`/api/assignments/${assignmentId}:publish`, auth(instructorToken))

    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
    const res = await api.get(
      `/api/assignments/${assignmentId}/my-evaluations?side=INDIVIDUAL`,
      auth(studentToken),
    )

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.opened).toBe(true) // publish แล้ว ไม่ใช่ "ยังไม่เปิด"
    expect(body.items).toHaveLength(0)
    expect(body.message).toContain('ไม่มีการประเมินรายบุคคล')
  })

  // regression ของ US-11 — คนนอกห้องเรียกตรง ๆ ต้องได้ 404 ไม่ใช่ 403
  test('regression US-11: คนนอกห้องเรียกไม่ได้ ได้ 404', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const assignmentId = await createAssignment(api, instructorToken, classroomId)
    await api.post(`/api/assignments/${assignmentId}:publish`, auth(instructorToken))

    // otherInstructor ถูก seed ไว้แล้วโดย fixture แต่ไม่ใช่สมาชิกห้องนี้ — ใช้แทน "คนนอก"
    const outsider = await issueToken(api, testUsers.otherInstructor.email)
    const res = await api.get(
      `/api/assignments/${assignmentId}/my-evaluations?side=GROUP`,
      auth(outsider),
    )

    expect(res.status()).toBe(404)
  })

  test.describe('บนหน้าเว็บ', () => {
    // AC: Given แสดง deadline, When ฉันอยู่คนละ timezone,
    //     Then เวลาที่เห็นเป็น timezone ของ classroom เสมอ
    test('การ์ดในห้องเรียนพาไปหน้าประเมิน และ deadline แสดงตาม timezone ของห้องเรียน', async ({
      page,
      api,
      instructorToken,
      classroomId,
    }) => {
      await seedRoster(api, instructorToken, classroomId)
      const assignmentId = await createAssignment(api, instructorToken, classroomId)
      await api.post(`/api/assignments/${assignmentId}:publish`, auth(instructorToken))

      const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
      await page.addInitScript(
        ([key, token]) => window.localStorage.setItem(key, token),
        ['paireval.session', studentToken] as const,
      )

      await page.goto(`/classrooms/${classroomId}`)

      const link = page.getByTestId(`evaluate-link-${assignmentId}`)
      await expect(link).toBeVisible()
      await link.click()

      await expect(page.getByRole('heading', { level: 1, name: 'งานที่ต้องประเมิน' })).toBeVisible()
      // classroomId fixture ตั้ง timezone Asia/Bangkok (UTC+7) — 18:30 UTC จึงเป็น 01:30 วันถัดไป
      await expect(page.getByText('01:30')).toBeVisible()
      await expect(page.getByRole('link', { name: 'ดูผลงาน' })).toHaveAttribute(
        'href',
        'https://drive.example.com/shared-folder',
      )
    })

    // AC: assignment ยังเป็น DRAFT — นักศึกษาไม่ควรเห็นด้วยซ้ำว่ามีงานนี้อยู่
    test('งานที่ยังไม่ publish ไม่ปรากฏในการ์ดของนักศึกษา', async ({
      page,
      api,
      instructorToken,
      classroomId,
    }) => {
      await seedRoster(api, instructorToken, classroomId)
      const assignmentId = await createAssignment(api, instructorToken, classroomId)

      const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')
      await page.addInitScript(
        ([key, token]) => window.localStorage.setItem(key, token),
        ['paireval.session', studentToken] as const,
      )

      await page.goto(`/classrooms/${classroomId}`)

      await expect(page.getByTestId(`evaluate-link-${assignmentId}`)).toHaveCount(0)
    })
  })
})
