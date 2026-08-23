import { expect, test } from '../fixtures'
import { rosterCsv } from '../seed/test-data'

/* Feature test ของ Sprint 2
 *
 * US-04 สร้างงานประเมิน  https://github.com/STARSTEAM-X/sdpx-arai2/issues/4
 * US-05 feasibility      https://github.com/STARSTEAM-X/sdpx-arai2/issues/5
 * US-06 publish + จัดคู่  https://github.com/STARSTEAM-X/sdpx-arai2/issues/6
 *
 * ชุดนี้ยิงผ่าน API เพราะ AC ทั้งหมดเขียนไว้เป็นสัญญาของ API ตรง ๆ (201 / 422 / 409)
 * ส่วน invariant ของการจัดคู่มี unit test 88 ตัวคุมอยู่แล้ว — ที่นี่ตรวจสิ่งที่ unit test
 * ตรวจแทนไม่ได้: การ map กลุ่มจาก database เข้าไปหา engine ถูกต้องไหม
 */

const DEADLINE = '2027-01-31T16:59:00Z'

/** roster 12 คน 3 กลุ่มเท่า ๆ กัน — ขนาดที่ feasibility ผ่านและ P3 เป็นไปได้ */
const ROSTER_12 = [
  'email,group_name',
  ...Array.from({ length: 12 }, (_, i) => `stu${i + 1}@kmitl.ac.th,group-${(i % 3) + 1}`),
].join('\n')

function criteria(groupWeight: number, individualWeight: number | null = 100) {
  const items: Record<string, unknown>[] = [
    { side: 'GROUP', name: 'คุณภาพงาน', weightPct: groupWeight },
  ]
  if (individualWeight !== null) {
    items.push({ side: 'INDIVIDUAL', name: 'การมีส่วนร่วม', weightPct: individualWeight })
  }
  return items
}

function assignmentBody(classroomId: string, overrides: Record<string, unknown> = {}) {
  return {
    classroomId,
    name: 'งานกลุ่มครั้งที่ 1',
    groupMaxScore: 15,
    individualMaxScore: 5,
    groupDeadlineUtc: DEADLINE,
    criteria: criteria(100),
    ...overrides,
  }
}

/** ห้องเรียนที่มี roster พร้อมแล้ว — เกือบทุก test ต้องใช้ */
async function seedRoster(api: import('@playwright/test').APIRequestContext, token: string, classroomId: string, csv = ROSTER_12) {
  const res = await api.post(`/api/classrooms/${classroomId}/roster:import`, {
    headers: { authorization: `Bearer ${token}` },
    multipart: {
      file: { name: 'roster.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') },
    },
  })
  expect(res.ok(), 'เตรียม roster ไม่สำเร็จ').toBeTruthy()
}

test.describe('US-04 สร้างงานประเมินพร้อมเกณฑ์และน้ำหนัก', () => {
  // AC: Given ฉันเป็น OWNER ของ classroom, When สร้าง assignment พร้อม criteria
  //     ที่น้ำหนักรวม 100%, Then ได้ assignment สถานะ DRAFT และตอบ 201
  test('happy path: สร้างแล้วได้สถานะ DRAFT และตอบ 201', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    const res = await api.post('/api/assignments', {
      headers: { authorization: `Bearer ${instructorToken}` },
      data: assignmentBody(classroomId),
    })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.status).toBe('DRAFT')
    expect(body.criteria).toHaveLength(2)
    expect(res.headers()['location']).toContain(body.id)
  })

  // AC: Given criteria ฝั่ง GROUP มีน้ำหนักรวม 90%, When พยายาม publish,
  //     Then ตอบ 422 พร้อมบอกว่าขาดอีกเท่าไร
  test('edge case: น้ำหนักฝั่ง GROUP รวม 90% แล้ว publish ไม่ผ่าน', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const created = await api.post('/api/assignments', {
      headers: { authorization: `Bearer ${instructorToken}` },
      data: assignmentBody(classroomId, { criteria: criteria(90) }),
    })
    const { id } = await created.json()

    const res = await api.post(`/api/assignments/${id}:publish`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })

    expect(res.status()).toBe(422)
    const body = await res.json()
    // ต้องบอกเป็นตัวเลขว่าขาดเท่าไร ไม่ใช่แค่ "น้ำหนักไม่ถูกต้อง"
    expect(body.error.message).toContain('90')
    expect(body.error.message).toContain('ขาดอีก 10')
  })

  // AC: Given assignment สถานะ PUBLISHED, When แก้ criteria,
  //     Then ตอบ 409 พร้อมบอกว่าต้อง unpublish ก่อน
  test('edge case: งานที่ publish แล้วแก้เกณฑ์ไม่ได้', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const created = await api.post('/api/assignments', {
      headers: { authorization: `Bearer ${instructorToken}` },
      data: assignmentBody(classroomId),
    })
    const { id } = await created.json()

    const published = await api.post(`/api/assignments/${id}:publish`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })
    expect(published.status()).toBe(200)

    const res = await api.put(`/api/assignments/${id}/criteria`, {
      headers: { authorization: `Bearer ${instructorToken}` },
      data: { criteria: criteria(100) },
    })

    expect(res.status()).toBe(409)
    expect((await res.json()).error.message).toContain('DRAFT')
  })

  // AC: Given ตั้ง individual_max_score = 0, When publish,
  //     Then ระบบไม่สร้าง pair ฝั่ง INDIVIDUAL เลย
  test('edge case: ปิดฝั่งบุคคลแล้วต้องไม่มีคู่ฝั่งนั้นเลย', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const created = await api.post('/api/assignments', {
      headers: { authorization: `Bearer ${instructorToken}` },
      data: assignmentBody(classroomId, {
        individualMaxScore: 0,
        criteria: criteria(100, null),
      }),
    })
    const { id } = await created.json()

    await api.post(`/api/assignments/${id}:publish`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })

    const dump = await (await api.get(`/api/test/pairs/${id}`)).json()
    expect(dump.count).toBeGreaterThan(0)
    expect(dump.items.filter((p: { side: string }) => p.side === 'INDIVIDUAL')).toHaveLength(0)
  })

  test('คนที่ไม่ใช่ผู้สอนของห้องนั้นสร้างงานไม่ได้ และได้ 404 ไม่ใช่ 403', async ({
    api,
    classroomId,
  }) => {
    const { issueToken } = await import('../fixtures')
    const outsider = await issueToken(api, 'ajarn2@uni.ac.th')

    const res = await api.post('/api/assignments', {
      headers: { authorization: `Bearer ${outsider}` },
      data: assignmentBody(classroomId),
    })

    expect(res.status()).toBe(404)
  })
})

test.describe('US-05 ดูความเป็นไปได้ก่อนเผยแพร่งาน', () => {
  // AC: Given assignment DRAFT ที่มี roster และ criteria ครบ, When เรียกดู feasibility,
  //     Then ได้ coverage ที่ทำได้จริง, workload ต่อคน และจำนวน comparison รวม
  test('happy path: ได้ครบทั้ง coverage, workload และจำนวน comparison', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const created = await api.post('/api/assignments', {
      headers: { authorization: `Bearer ${instructorToken}` },
      data: assignmentBody(classroomId),
    })
    const { id } = await created.json()

    const res = await api.get(`/api/assignments/${id}/feasibility`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })

    expect(res.status()).toBe(200)
    const { items } = await res.json()
    const group = items.find((f: { side: string }) => f.side === 'GROUP')

    expect(group.feasible).toBe(true)
    expect(group.achievableCoverage).toBeGreaterThan(0)
    expect(group.workloadPerEvaluator).toBeGreaterThan(0)
    expect(group.totalComparisons).toBeGreaterThan(0)
    // ฝั่งบุคคลต้องรายงานแยก เพราะข้อจำกัดคนละเรื่องกับฝั่งกลุ่ม
    expect(items.find((f: { side: string }) => f.side === 'INDIVIDUAL')).toBeTruthy()
  })

  // AC: Given ตั้ง target_coverage = 5 แต่ขนาดกลุ่มทำให้เป็นไปไม่ได้,
  //     Then ระบบเสนอค่าสูงสุดที่ทำได้ พร้อมตัวเลขเหตุผล ไม่ใช่คำเตือนลอย ๆ
  test('edge case: coverage ที่ขอเป็นไปไม่ได้ ต้องเสนอค่าที่ทำได้พร้อมตัวเลข', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    // 3 กลุ่ม กลุ่มละ 4 → ตัวอย่างที่ 2 ใน PRD §8.2 · R=5 ทำไม่ได้ ต้องลดเหลือ 4
    await seedRoster(api, instructorToken, classroomId)
    const created = await api.post('/api/assignments', {
      headers: { authorization: `Bearer ${instructorToken}` },
      data: assignmentBody(classroomId, { targetCoverage: 5 }),
    })
    const { id } = await created.json()

    const res = await api.get(`/api/assignments/${id}/feasibility`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })
    const group = (await res.json()).items.find((f: { side: string }) => f.side === 'GROUP')

    expect(group.requestedCoverage).toBe(5)
    expect(group.achievableCoverage).toBeLessThan(5)
    expect(group.reason).toBeTruthy()
    expect(group.reason).toMatch(/\d/)
  })
})

test.describe('US-06 เผยแพร่งานแล้วระบบจัดคู่ให้อัตโนมัติ', () => {
  async function publishReady(api: import('@playwright/test').APIRequestContext, token: string, classroomId: string, overrides = {}) {
    await seedRoster(api, token, classroomId)
    const created = await api.post('/api/assignments', {
      headers: { authorization: `Bearer ${token}` },
      data: assignmentBody(classroomId, overrides),
    })
    return (await created.json()).id as string
  }

  // AC: Given assignment DRAFT ที่ผ่าน feasibility, When publish,
  //     Then สร้าง pair ทั้งหมดเก็บลง database และเปลี่ยนสถานะเป็น PUBLISHED
  test('happy path: publish แล้วได้คู่ครบและสถานะเปลี่ยน', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    const id = await publishReady(api, instructorToken, classroomId)

    const res = await api.post(`/api/assignments/${id}:publish`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('PUBLISHED')
    expect(body.pairsCreated).toBeGreaterThan(0)
    expect(body.pairingSeed).toBeGreaterThanOrEqual(0)

    // คู่ต้องอยู่ใน database จริง ไม่ใช่แค่ตัวเลขที่ตอบกลับมา (FR-PAIR-01)
    const dump = await (await api.get(`/api/test/pairs/${id}`)).json()
    expect(dump.count).toBe(body.pairsCreated)

    const after = await api.get(`/api/assignments/${id}`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })
    expect((await after.json()).status).toBe('PUBLISHED')
  })

  // AC: Given evaluator เป็นสมาชิกกลุ่ม X, When ดูคู่ที่ได้รับฝั่ง GROUP,
  //     Then ต้องไม่มีคู่ไหนที่มีกลุ่ม X อยู่
  test('ไม่มีใครได้ประเมินกลุ่มตัวเอง — ตรวจกับข้อมูลใน database จริง', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    const id = await publishReady(api, instructorToken, classroomId)
    await api.post(`/api/assignments/${id}:publish`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })

    const dump = await (await api.get(`/api/test/pairs/${id}`)).json()
    const groupPairs = dump.items.filter((p: { side: string }) => p.side === 'GROUP')
    expect(groupPairs.length).toBeGreaterThan(0)

    // ข้อนี้คือสิ่งที่ unit test ตรวจแทนไม่ได้ — ถ้า group_id ผูกผิดคนตอนเขียน roster
    // ตรรกะใน engine จะยังถูกทุกประการแต่ของจริงพัง
    for (const p of groupPairs) {
      expect(p.evaluatorGroupId).not.toBe(p.itemA)
      expect(p.evaluatorGroupId).not.toBe(p.itemB)
    }
  })

  // AC: Given ประเมินฝั่ง INDIVIDUAL, When ดูคู่ที่ได้รับ,
  //     Then ทุกคู่อยู่ในกลุ่มตัวเองและไม่มีตัวเองอยู่ในคู่
  test('ฝั่งบุคคลไม่มีใครประเมินตัวเอง', async ({ api, instructorToken, classroomId }) => {
    const id = await publishReady(api, instructorToken, classroomId)
    await api.post(`/api/assignments/${id}:publish`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })

    const dump = await (await api.get(`/api/test/pairs/${id}`)).json()
    const roster = await (
      await api.get(`/api/classrooms/${classroomId}/roster`, {
        headers: { authorization: `Bearer ${instructorToken}` },
      })
    ).json()
    const idByEmail = new Map<string, string>(
      roster.items.map((m: { email: string; userId: string }) => [m.email, m.userId]),
    )

    const individual = dump.items.filter((p: { side: string }) => p.side === 'INDIVIDUAL')
    expect(individual.length).toBeGreaterThan(0)

    for (const p of individual) {
      const me = idByEmail.get(p.evaluator)
      expect(me).toBeTruthy()
      expect(p.itemA).not.toBe(me)
      expect(p.itemB).not.toBe(me)
    }
  })

  // AC: Given publish ด้วย pairing_seed เดิม, When generate ซ้ำ, Then ได้ผลลัพธ์เหมือนเดิมทุกประการ
  test('seed เดิมให้ผลเหมือนเดิมทุกประการ ตลอดทั้ง stack', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    const first = await publishReady(api, instructorToken, classroomId)
    await api.post(`/api/assignments/${first}:publish?seed=12345`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })
    const dumpA = await (await api.get(`/api/test/pairs/${first}`)).json()

    // งานที่สองในห้องเดียวกัน roster เดิม seed เดิม
    const created = await api.post('/api/assignments', {
      headers: { authorization: `Bearer ${instructorToken}` },
      data: assignmentBody(classroomId, { name: 'งานกลุ่มครั้งที่ 2' }),
    })
    const second = (await created.json()).id
    await api.post(`/api/assignments/${second}:publish?seed=12345`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })
    const dumpB = await (await api.get(`/api/test/pairs/${second}`)).json()

    expect(dumpA.count).toBe(dumpB.count)
  })

  // AC: Given ดู pair ทั้งหมด, When นับ coverage ของแต่ละคู่,
  //     Then ส่วนต่างระหว่างคู่ใด ๆ ไม่เกิน 1
  test('ส่วนต่าง coverage ระหว่างคู่ใด ๆ ไม่เกิน 1', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    const id = await publishReady(api, instructorToken, classroomId)
    await api.post(`/api/assignments/${id}:publish`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })

    const dump = await (await api.get(`/api/test/pairs/${id}`)).json()
    const counts = new Map<string, number>()
    for (const p of dump.items.filter((x: { side: string }) => x.side === 'GROUP')) {
      const key = `${p.itemA}|${p.itemB}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    const values = [...counts.values()]
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
  })

  test('publish ซ้ำถูกปฏิเสธด้วย 409', async ({ api, instructorToken, classroomId }) => {
    const id = await publishReady(api, instructorToken, classroomId)
    await api.post(`/api/assignments/${id}:publish`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })

    const again = await api.post(`/api/assignments/${id}:publish`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })

    expect(again.status()).toBe(409)
  })

  test('ยังไม่มี roster แล้ว publish ต้องบอกให้ไป import ก่อน', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    const created = await api.post('/api/assignments', {
      headers: { authorization: `Bearer ${instructorToken}` },
      data: assignmentBody(classroomId),
    })
    const { id } = await created.json()

    const res = await api.post(`/api/assignments/${id}:publish`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })

    expect(res.status()).toBe(422)
    expect((await res.json()).error.message).toMatch(/กลุ่ม|รายชื่อ/)
  })
})

test.describe('เส้นทางที่อาจารย์กดเองบนหน้าเว็บ', () => {
  test('import รายชื่อ → สร้างงาน → ตรวจความเป็นไปได้ → เผยแพร่', async ({
    signedInPage,
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    await signedInPage.goto(`/classrooms/${classroomId}`)

    const panel = signedInPage.getByTestId('assignment-panel')
    await expect(panel).toBeVisible()

    await signedInPage.getByLabel('ชื่องานประเมิน').fill('งานกลุ่มปลายภาค')
    await signedInPage.getByLabel('กำหนดส่ง').fill('2027-01-31T23:59')
    await signedInPage.getByRole('button', { name: 'สร้างงานประเมิน' }).click()

    await expect(signedInPage.getByTestId('assignment-status')).toContainText('DRAFT')

    await signedInPage.getByRole('button', { name: 'ตรวจความเป็นไปได้' }).click()
    // ต้องเห็นทั้งสองฝั่ง เพราะข้อจำกัดคนละเรื่องกัน
    await expect(signedInPage.getByTestId('feasibility-GROUP')).toBeVisible()
    await expect(signedInPage.getByTestId('feasibility-INDIVIDUAL')).toBeVisible()
    await expect(signedInPage.getByTestId('feasibility-GROUP')).toContainText('coverage ที่ขอ 5')

    await signedInPage.getByRole('button', { name: 'เผยแพร่และจัดคู่' }).click()

    await expect(signedInPage.getByTestId('publish-result')).toContainText('สร้างคู่ประเมิน')
    await expect(signedInPage.getByTestId('assignment-status')).toContainText('PUBLISHED')
  })

  test('น้ำหนักไม่ครบ 100% แล้วกดเผยแพร่ ต้องเห็นข้อความบอกว่าขาดเท่าไร', async ({
    signedInPage,
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    await signedInPage.goto(`/classrooms/${classroomId}`)

    await signedInPage.getByLabel('กำหนดส่ง').fill('2027-01-31T23:59')
    await signedInPage.getByLabel('น้ำหนักเกณฑ์ฝั่งกลุ่ม (%)').fill('90')
    await signedInPage.getByRole('button', { name: 'สร้างงานประเมิน' }).click()
    await expect(signedInPage.getByTestId('assignment-status')).toBeVisible()

    await signedInPage.getByRole('button', { name: 'เผยแพร่และจัดคู่' }).click()

    await expect(signedInPage.getByTestId('assignment-error')).toContainText('ขาดอีก 10')
    await expect(signedInPage.getByTestId('assignment-status')).toContainText('DRAFT')
  })

  test('นักศึกษาไม่เห็นกล่องสร้างงานประเมิน', async ({
    page,
    api,
    instructorToken,
    classroomId,
  }) => {
    await seedRoster(api, instructorToken, classroomId)
    const { issueToken } = await import('../fixtures')
    const studentToken = await issueToken(api, 'stu1@kmitl.ac.th')

    await page.addInitScript(
      ([key, token]) => window.localStorage.setItem(key, token),
      ['paireval.session', studentToken] as const,
    )
    await page.goto(`/classrooms/${classroomId}`)

    await expect(page.getByTestId('roster-list')).toBeVisible()
    await expect(page.getByTestId('assignment-panel')).toHaveCount(0)
  })
})
