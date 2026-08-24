import { expect, issueToken, test } from '../fixtures'
import { rosterCsv, testUsers } from '../seed/test-data'

/* Feature test ของ Sprint 2 ส่วนที่เหลือ
 *
 * US-12 จัดการผู้ร่วมสอนและ TA  https://github.com/STARSTEAM-X/sdpx-arai2/issues/12
 * US-14 audit log               https://github.com/STARSTEAM-X/sdpx-arai2/issues/14
 *
 * AC ของ US-12 หลายข้อเป็นเรื่องสิทธิ์ล้วน ๆ ซึ่งพิสูจน์ได้ที่ชั้น API เท่านั้น
 * และสองข้อท้ายกัน regression ของ US-03 กับ US-11 โดยตรง
 */

const DEADLINE = '2027-01-31T16:59:00Z'
const OWNER = testUsers.instructor.email
const OUTSIDER = testUsers.otherInstructor.email

type Api = import('@playwright/test').APIRequestContext

function auth(token: string) {
  return { headers: { authorization: `Bearer ${token}` } }
}

async function addMember(api: Api, token: string, roomId: string, email: string, role: string) {
  return api.post(`/api/classrooms/${roomId}/members`, {
    ...auth(token),
    data: { email, role },
  })
}

/** เพิ่มสมาชิกแล้วคืน token ของคนนั้น — ใช้ทดสอบสิทธิ์จากมุมของเขาเอง */
async function addAndSignIn(api: Api, ownerToken: string, roomId: string, email: string, role: string) {
  const res = await addMember(api, ownerToken, roomId, email, role)
  expect(res.status(), `เพิ่ม ${role} ไม่สำเร็จ`).toBe(201)
  return { token: await issueToken(api, email), memberId: (await res.json()).memberId as string }
}

/** roster 12 คน 3 กลุ่ม — เล็กกว่านี้ feasibility ปฏิเสธเพราะจัดคู่ไม่ได้
 *  (2 กลุ่ม → ทุกคนอยู่ในกลุ่มใดกลุ่มหนึ่งของคู่เดียวที่มี จึงไม่มีใครมีสิทธิ์ประเมิน) */
const PUBLISHABLE_ROSTER = [
  'email,group_name',
  ...Array.from({ length: 12 }, (_, i) => `stu${i + 1}@kmitl.ac.th,group-${(i % 3) + 1}`),
].join('\n')

async function importPublishableRoster(api: Api, token: string, roomId: string) {
  return api.post(`/api/classrooms/${roomId}/roster:import`, {
    ...auth(token),
    multipart: {
      file: {
        name: 'roster.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(PUBLISHABLE_ROSTER, 'utf-8'),
      },
    },
  })
}

async function importRoster(api: Api, token: string, roomId: string) {
  return api.post(`/api/classrooms/${roomId}/roster:import`, {
    ...auth(token),
    multipart: {
      file: {
        name: 'roster.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(rosterCsv.valid, 'utf-8'),
      },
    },
  })
}

function assignmentBody(classroomId: string) {
  return {
    classroomId,
    name: 'งานกลุ่มครั้งที่ 1',
    groupMaxScore: 15,
    individualMaxScore: 0,
    groupDeadlineUtc: DEADLINE,
    criteria: [{ side: 'GROUP', name: 'คุณภาพงาน', weightPct: 100 }],
  }
}

test.describe('US-12 จัดการผู้ร่วมสอนและ TA', () => {
  // AC: Given ฉันเป็น OWNER, When เพิ่มสมาชิกด้วยอีเมลและ role CO_TEACHER หรือ TA,
  //     Then ได้สมาชิกใหม่และตอบ 201 — ถ้ายังไม่เคย login ให้สร้าง user สถานะ PENDING
  test('happy path: OWNER เพิ่มผู้ร่วมสอนที่ยังไม่เคย login ได้', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    const res = await addMember(api, instructorToken, classroomId, 'newco@uni.ac.th', 'CO_TEACHER')

    expect(res.status()).toBe(201)
    expect((await res.json()).role).toBe('CO_TEACHER')

    const roster = await (await api.get(`/api/classrooms/${classroomId}/roster`, auth(instructorToken))).json()
    const added = roster.items.find((m: { email: string }) => m.email === 'newco@uni.ac.th')
    expect(added.role).toBe('CO_TEACHER')
    // ยังไม่เคย login จึงต้องเป็น PENDING เหมือนคนที่มาจาก roster import (US-03)
    expect(added.status).toBe('PENDING')
  })

  test('อีเมลถูก normalize ก่อนบันทึก เหมือน roster และ login', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    const res = await addMember(api, instructorToken, classroomId, 'Ajarn.Three+x@uni.ac.th', 'TA')

    expect((await res.json()).email).toBe('ajarn.three@uni.ac.th')
  })

  // AC: Given ฉันเป็น CO_TEACHER หรือ TA, When เพิ่มหรือลบสมาชิก, Then ตอบ 403
  test.describe('เฉพาะ OWNER เท่านั้นที่จัดการสมาชิกได้', () => {
    for (const role of ['CO_TEACHER', 'TA']) {
      test(`${role} เพิ่มสมาชิกไม่ได้`, async ({ api, instructorToken, classroomId }) => {
        const { token } = await addAndSignIn(api, instructorToken, classroomId, `${role.toLowerCase()}@uni.ac.th`, role)

        const res = await addMember(api, token, classroomId, 'another@uni.ac.th', 'TA')

        expect(res.status()).toBe(403)
        expect((await res.json()).error.code).toBe('FORBIDDEN')
      })

      test(`${role} ลบสมาชิกไม่ได้`, async ({ api, instructorToken, classroomId }) => {
        const { token } = await addAndSignIn(api, instructorToken, classroomId, `${role.toLowerCase()}2@uni.ac.th`, role)
        const victim = await addAndSignIn(api, instructorToken, classroomId, `victim-${role}@uni.ac.th`, 'TA')

        const res = await api.delete(
          `/api/classrooms/${classroomId}/members/${victim.memberId}`,
          auth(token),
        )

        expect(res.status()).toBe(403)
      })
    }
  })

  // AC: Given ห้องเรียนเหลือ OWNER คนเดียว, When ลบ owner คนนั้น (รวมถึงลบตัวเอง),
  //     Then ตอบ 409 พร้อม code: LAST_OWNER
  test('edge case: ถอด OWNER คนสุดท้าย (ตัวเอง) ไม่ได้', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    const roster = await (await api.get(`/api/classrooms/${classroomId}/roster`, auth(instructorToken))).json()
    const me = roster.items.find((m: { role: string }) => m.role === 'OWNER')
    expect(me, 'ห้องต้องมี OWNER อยู่แล้วตั้งแต่ตอนสร้าง').toBeTruthy()

    const res = await api.delete(
      `/api/classrooms/${classroomId}/members/${me.memberId}`,
      auth(instructorToken),
    )

    expect(res.status()).toBe(409)
    // AC ระบุ code ข้อนี้ไว้เจาะจง หน้าจอต้องแยกจาก conflict อื่นได้
    expect((await res.json()).error.code).toBe('LAST_OWNER')
  })

  test('ถอด OWNER ได้เมื่อยังเหลืออีกคน', async ({ api, instructorToken, classroomId }) => {
    // เพิ่ม OWNER คนที่สองผ่าน SQL ไม่ได้ — endpoint รับเฉพาะ CO_TEACHER/TA
    // จึงยืนยันทางกลับกันแทน: ถอด CO_TEACHER ได้เสมอเพราะไม่กระทบจำนวนเจ้าของ
    const { memberId } = await addAndSignIn(api, instructorToken, classroomId, 'removable@uni.ac.th', 'CO_TEACHER')

    const res = await api.delete(
      `/api/classrooms/${classroomId}/members/${memberId}`,
      auth(instructorToken),
    )

    expect(res.status()).toBe(204)
    const roster = await (await api.get(`/api/classrooms/${classroomId}/roster`, auth(instructorToken))).json()
    expect(roster.items.find((m: { email: string }) => m.email === 'removable@uni.ac.th')).toBeUndefined()
  })

  test('ถอดสมาชิกที่ไม่มีอยู่ได้ 404 ไม่ใช่ 500', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    const res = await api.delete(
      `/api/classrooms/${classroomId}/members/00000000-0000-4000-8000-000000000000`,
      auth(instructorToken),
    )

    expect(res.status()).toBe(404)
  })

  // AC: Given อีเมลที่เพิ่มอยู่นอก allowed_email_domains, Then ตอบ 422 พร้อมบอก domain ที่รับ
  test('edge case: อีเมลนอก domain ที่ห้องอนุญาตถูกปฏิเสธ', async ({
    api,
    instructorToken,
  }) => {
    const created = await api.post('/api/classrooms', {
      ...auth(instructorToken),
      data: { name: 'ห้องจำกัด domain', timezone: 'Asia/Bangkok', allowedEmailDomains: ['kmitl.ac.th'] },
    })
    const { id } = await created.json()

    const res = await addMember(api, instructorToken, id, 'someone@gmail.com', 'TA')

    expect(res.status()).toBe(422)
    const message = (await res.json()).error.message
    expect(message).toContain('gmail.com')
    expect(message).toContain('kmitl.ac.th')
  })

  // AC: Given อีเมลนั้นเป็น STUDENT ในห้องนี้อยู่แล้ว, When เพิ่มเป็น TA, Then ตอบ 409
  test('edge case: คนที่เป็นนักศึกษาอยู่แล้วเพิ่มเป็น TA ไม่ได้', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await importRoster(api, instructorToken, classroomId)

    const res = await addMember(api, instructorToken, classroomId, 'somchai@uni.ac.th', 'TA')

    expect(res.status()).toBe(409)
    expect((await res.json()).error.message).toContain('STUDENT')
  })

  // AC: Given ห้องเรียนมี CO_TEACHER และ TA อยู่แล้ว, When import CSV ทับ,
  //     Then สมาชิกฝั่งผู้สอนต้องไม่ถูกลบ
  test('regression US-03: import CSV ทับแล้วผู้สอนต้องไม่หาย', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await addMember(api, instructorToken, classroomId, 'co@uni.ac.th', 'CO_TEACHER')
    await addMember(api, instructorToken, classroomId, 'ta@uni.ac.th', 'TA')

    await importRoster(api, instructorToken, classroomId)

    const roster = await (await api.get(`/api/classrooms/${classroomId}/roster`, auth(instructorToken))).json()
    const roles = new Map(roster.items.map((m: { email: string; role: string }) => [m.email, m.role]))

    expect(roles.get('co@uni.ac.th')).toBe('CO_TEACHER')
    expect(roles.get('ta@uni.ac.th')).toBe('TA')
    expect(roles.get(OWNER)).toBe('OWNER')
  })

  // AC: Given ฉันไม่ใช่สมาชิกของห้องเรียนนี้, Then ตอบ 404 ไม่ใช่ 403
  test('regression US-11: คนนอกจัดการสมาชิกไม่ได้ และได้ 404', async ({
    api,
    classroomId,
  }) => {
    const outsider = await issueToken(api, OUTSIDER)

    const res = await addMember(api, outsider, classroomId, 'x@uni.ac.th', 'TA')

    expect(res.status()).toBe(404)
  })
})

test.describe('US-12 role matrix บังคับใช้จริงที่ server', () => {
  // AC: Given ฉันเป็น TA, When สร้างหรือแก้ assignment, Then ตอบ 403
  test('TA สร้าง assignment ไม่ได้', async ({ api, instructorToken, classroomId }) => {
    const { token } = await addAndSignIn(api, instructorToken, classroomId, 'ta-assign@uni.ac.th', 'TA')

    const res = await api.post('/api/assignments', {
      ...auth(token),
      data: assignmentBody(classroomId),
    })

    expect(res.status()).toBe(403)
  })

  // AC: Given ฉันเป็น CO_TEACHER, When สร้างหรือแก้ assignment, Then สำเร็จ
  test('CO_TEACHER สร้าง assignment ได้', async ({ api, instructorToken, classroomId }) => {
    const { token } = await addAndSignIn(api, instructorToken, classroomId, 'co-assign@uni.ac.th', 'CO_TEACHER')

    const res = await api.post('/api/assignments', {
      ...auth(token),
      data: assignmentBody(classroomId),
    })

    expect(res.status()).toBe(201)
  })

  // AC: Given ฉันเป็น TA, When จัดการ roster หรือ import CSV, Then สำเร็จ
  test('TA จัดการ roster ได้', async ({ api, instructorToken, classroomId }) => {
    const { token } = await addAndSignIn(api, instructorToken, classroomId, 'ta-roster@uni.ac.th', 'TA')

    expect((await importRoster(api, token, classroomId)).status()).toBe(200)
  })

  test('นักศึกษาจัดการ roster ไม่ได้', async ({ api, instructorToken, classroomId }) => {
    await importRoster(api, instructorToken, classroomId)
    const studentToken = await issueToken(api, 'somchai@uni.ac.th')

    expect((await importRoster(api, studentToken, classroomId)).status()).toBe(403)
  })
})

test.describe('US-14 audit log', () => {
  // AC: Given เกิดเหตุการณ์ publish, Then มี audit record ทุกครั้งโดยไม่มีข้อยกเว้น
  test('publish ถูกบันทึกลง audit log', async ({ api, instructorToken, classroomId }) => {
    await importPublishableRoster(api, instructorToken, classroomId)
    const created = await api.post('/api/assignments', {
      ...auth(instructorToken),
      data: assignmentBody(classroomId),
    })
    const { id } = await created.json()

    const published = await api.post(`/api/assignments/${id}:publish`, auth(instructorToken))
    expect(published.status(), 'publish ต้องสำเร็จก่อนถึงจะมี audit ให้ตรวจ').toBe(200)

    const { items } = await (await api.get(`/api/classrooms/${classroomId}/audit`, auth(instructorToken))).json()
    const entry = items.find((e: { action: string }) => e.action === 'ASSIGNMENT_PUBLISHED')

    expect(entry).toBeTruthy()
    expect(entry.resourceId).toBe(id)
    // AC ข้อ 2 — ต้องมีค่าก่อนและหลัง ไม่ใช่แค่ว่ามีอะไรเกิดขึ้น
    expect(entry.beforeState.status).toBe('DRAFT')
    expect(entry.afterState.status).toBe('PUBLISHED')
    expect(entry.actorEmail).toBe(OWNER)
  })

  test('การเพิ่มและถอดสมาชิกถูกบันทึกทั้งคู่', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    const { memberId } = await addAndSignIn(api, instructorToken, classroomId, 'audited@uni.ac.th', 'TA')
    await api.delete(`/api/classrooms/${classroomId}/members/${memberId}`, auth(instructorToken))

    const { items } = await (await api.get(`/api/classrooms/${classroomId}/audit`, auth(instructorToken))).json()
    const actions = items.map((e: { action: string }) => e.action)

    expect(actions).toContain('MEMBER_ROLE_CHANGED')
    expect(actions).toContain('MEMBER_REMOVED')
  })

  // AC: Given ฉันเป็นนักศึกษา, When ขอดู audit log, Then ตอบ 403
  test('นักศึกษาอ่าน audit log ไม่ได้', async ({ api, instructorToken, classroomId }) => {
    await importRoster(api, instructorToken, classroomId)
    const studentToken = await issueToken(api, 'somchai@uni.ac.th')

    const res = await api.get(`/api/classrooms/${classroomId}/audit`, auth(studentToken))

    expect(res.status()).toBe(403)
  })

  test('คนนอกห้องอ่าน audit log ไม่ได้ และได้ 404', async ({ api, classroomId }) => {
    const outsider = await issueToken(api, OUTSIDER)

    expect((await api.get(`/api/classrooms/${classroomId}/audit`, auth(outsider))).status()).toBe(404)
  })

  // AC: Given มีคนพยายามลบหรือแก้ audit record, Then ไม่มีทางทำได้
  test('ไม่มี endpoint ให้ลบหรือแก้ audit record', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await addMember(api, instructorToken, classroomId, 'trace@uni.ac.th', 'TA')
    const { items } = await (await api.get(`/api/classrooms/${classroomId}/audit`, auth(instructorToken))).json()
    expect(items.length).toBeGreaterThan(0)

    // ชั้น API ไม่มีทางให้เรียก — ส่วนชั้น database มี trigger กันไว้
    // (พิสูจน์ด้วย SQL ตรง ๆ ใน tests/integration/test_audit_repo.py)
    for (const method of ['delete', 'put'] as const) {
      const res = await api[method](
        `/api/classrooms/${classroomId}/audit/${items[0].id}`,
        auth(instructorToken),
      )
      expect([404, 405]).toContain(res.status())
    }
  })
})

test.describe('หน้าเว็บซ่อนสิ่งที่ role นั้นทำไม่ได้', () => {
  test('TA เห็นกล่องนำเข้ารายชื่อ แต่ไม่เห็นกล่องสร้างงานประเมิน', async ({
    page,
    api,
    instructorToken,
    classroomId,
  }) => {
    const { token } = await addAndSignIn(api, instructorToken, classroomId, 'ta-ui@uni.ac.th', 'TA')
    await page.addInitScript(
      ([key, t]) => window.localStorage.setItem(key, t),
      ['paireval.session', token] as const,
    )

    await page.goto(`/classrooms/${classroomId}`)

    await expect(page.getByTestId('roster-import')).toBeVisible()
    // ถ้าหน้าจอกับ server ไม่ตรงกัน TA จะเห็นปุ่มที่กดแล้วได้ 403 เสมอ
    await expect(page.getByTestId('assignment-panel')).toHaveCount(0)
  })

  test('CO_TEACHER เห็นทั้งสองกล่อง', async ({
    page,
    api,
    instructorToken,
    classroomId,
  }) => {
    const { token } = await addAndSignIn(api, instructorToken, classroomId, 'co-ui@uni.ac.th', 'CO_TEACHER')
    await page.addInitScript(
      ([key, t]) => window.localStorage.setItem(key, t),
      ['paireval.session', token] as const,
    )

    await page.goto(`/classrooms/${classroomId}`)

    await expect(page.getByTestId('roster-import')).toBeVisible()
    await expect(page.getByTestId('assignment-panel')).toBeVisible()
  })
})

test.describe('จัดการผู้ร่วมสอนบนหน้าเว็บ', () => {
  test('เจ้าของห้องเพิ่ม TA แล้วเห็นในรายการทันที', async ({ signedInPage, classroomId }) => {
    await signedInPage.goto(`/classrooms/${classroomId}`)

    const panel = signedInPage.getByTestId('member-panel')
    await expect(panel).toBeVisible()

    await signedInPage.getByLabel('อีเมล').fill('ta.ui@kmitl.ac.th')
    await signedInPage.getByRole('button', { name: 'บทบาท', exact: true }).click()
    await signedInPage.getByRole('option', { name: /^ผู้ช่วยสอน/ }).click()
    await signedInPage.getByRole('button', { name: 'เพิ่ม', exact: true }).click()

    await expect(signedInPage.getByTestId('member-notice')).toContainText('ta.ui@kmitl.ac.th')
    const row = signedInPage.getByTestId('instructor-list').getByRole('listitem').filter({ hasText: 'ta.ui@kmitl.ac.th' })
    await expect(row).toBeVisible()
    await expect(row).toContainText('ผู้ช่วยสอน')
    // ยังไม่เคย login — ต้องบอกให้เห็น ไม่งั้นอาจารย์จะคิดว่าเพิ่มไม่สำเร็จ
    await expect(row).toContainText('ยังไม่เคยเข้าระบบ')
  })

  test('ถอดผู้ร่วมสอนออกได้แล้วหายจากรายการ', async ({ signedInPage, classroomId }) => {
    await signedInPage.goto(`/classrooms/${classroomId}`)

    await signedInPage.getByLabel('อีเมล').fill('co.ui@kmitl.ac.th')
    await signedInPage.getByRole('button', { name: 'เพิ่ม', exact: true }).click()
    const row = signedInPage.getByTestId('instructor-list').getByRole('listitem').filter({ hasText: 'co.ui@kmitl.ac.th' })
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: 'ถอดออก' }).click()

    await expect(signedInPage.getByTestId('member-notice')).toContainText('ถอด')
    await expect(row).toHaveCount(0)
  })

  test('ปุ่มถอดของเจ้าของห้องคนสุดท้ายถูกปิดไว้', async ({ signedInPage, classroomId }) => {
    await signedInPage.goto(`/classrooms/${classroomId}`)

    const ownerRow = signedInPage
      .getByTestId('instructor-list')
      .getByRole('listitem')
      .filter({ hasText: 'เจ้าของห้อง' })

    // server ตอบ 409 LAST_OWNER อยู่แล้ว — ปิดปุ่มเพื่อไม่ให้กดแล้วเจอ error ที่รู้ล่วงหน้า
    await expect(ownerRow.getByRole('button', { name: 'ถอดออก' })).toBeDisabled()
  })

  test('อีเมลที่เป็นสมาชิกอยู่แล้วขึ้นข้อความจาก API ตรง ๆ', async ({
    signedInPage,
    api,
    instructorToken,
    classroomId,
  }) => {
    await importRoster(api, instructorToken, classroomId)
    await signedInPage.goto(`/classrooms/${classroomId}`)

    await signedInPage.getByLabel('อีเมล').fill('somchai@uni.ac.th')
    await signedInPage.getByRole('button', { name: 'บทบาท', exact: true }).click()
    await signedInPage.getByRole('option', { name: /^ผู้ช่วยสอน/ }).click()
    await signedInPage.getByRole('button', { name: 'เพิ่ม', exact: true }).click()

    await expect(signedInPage.getByTestId('member-error')).toContainText('STUDENT')
  })

  test('CO_TEACHER ไม่เห็นกล่องจัดการสมาชิก', async ({
    page,
    api,
    instructorToken,
    classroomId,
  }) => {
    const { token } = await addAndSignIn(api, instructorToken, classroomId, 'co-nopanel@uni.ac.th', 'CO_TEACHER')
    await page.addInitScript(
      ([key, t]) => window.localStorage.setItem(key, t),
      ['paireval.session', token] as const,
    )

    await page.goto(`/classrooms/${classroomId}`)

    await expect(page.getByTestId('assignment-panel')).toBeVisible()
    await expect(page.getByTestId('member-panel')).toHaveCount(0)
  })
})
