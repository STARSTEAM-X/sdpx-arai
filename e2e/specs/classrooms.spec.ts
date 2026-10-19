import { expect, issueToken, test } from '../fixtures'
import { ClassroomsPage } from '../pages/ClassroomsPage'
import { testClassroom } from '../seed/test-data'

/* Feature test ของ US-02 สร้างห้องเรียน
 * https://github.com/STARSTEAM-X/sdpx-arai2/issues/2
 *
 * ทุก test อ้าง acceptance criteria จาก issue ตรง ๆ — เขียนไว้เหนือ test แต่ละตัว
 */

test.describe('US-02 สร้างห้องเรียน', () => {
  // AC: Given ฉันเป็นผู้ใช้ที่ login แล้ว, When สร้าง classroom ด้วยชื่อและ timezone,
  //     Then ได้ classroom ที่ฉันเป็น OWNER และตอบ 201 พร้อม body ของ classroom ที่สร้าง
  test('happy path: สร้างแล้วเห็นห้องเรียนในรายการ', async ({ signedInPage }) => {
    const classrooms = new ClassroomsPage(signedInPage)
    await classrooms.goto()

    await expect(classrooms.emptyState).toBeVisible()

    await classrooms.createClassroom(testClassroom.name, testClassroom.timezone)

    // web-first assertion รอให้เองจนกว่ารายการจะอัปเดต ไม่ต้องใช้ waitForTimeout
    await expect(classrooms.classroomNamed(testClassroom.name)).toBeVisible()
    // Figma J04b — การ์ดแสดงรหัสวิชาและบทบาทของฉัน (ไม่แสดง slug แล้ว; slug ยังตรวจในเคสชื่อซ้ำ)
    await expect(classrooms.classroomNamed(testClassroom.name)).toContainText('CE-SDPX')
    await expect(classrooms.classroomNamed(testClassroom.name)).toContainText('เจ้าของห้อง')
  })

  // AC: Given มี classroom ชื่อ slug ซ้ำอยู่แล้ว, When สร้างซ้ำ, Then ตอบ 409
  test('edge case: ชื่อซ้ำถูกปฏิเสธและแสดงข้อความบนหน้าจอ', async ({ signedInPage }) => {
    const classrooms = new ClassroomsPage(signedInPage)
    await classrooms.goto()

    await classrooms.createClassroom(testClassroom.name)
    await expect(classrooms.classroomNamed(testClassroom.name)).toBeVisible()

    await classrooms.createClassroom(testClassroom.name)

    await expect(classrooms.errorMessage).toBeVisible()
    await expect(classrooms.errorMessage).toContainText(testClassroom.expectedSlug)

    // ต้องยังมีห้องเรียนเดียว — การถูกปฏิเสธต้องไม่สร้างของซ้ำ (กฎ C6)
    await expect(classrooms.classroomList.getByRole('listitem')).toHaveCount(1)
  })

  // AC: Given ส่งชื่อว่าง, When สร้าง classroom, Then ตอบ 422 พร้อมระบุ field ที่ผิด
  test('edge case: ชื่อว่างถูกปฏิเสธ', async ({ signedInPage }) => {
    const classrooms = new ClassroomsPage(signedInPage)
    await classrooms.goto()

    await classrooms.createClassroom('   ')

    await expect(classrooms.errorMessage).toBeVisible()
    await expect(classrooms.emptyState).toBeVisible()
  })

  // AC จาก US-11: Given ไม่ได้แนบ token, When เรียก endpoint ที่ต้องใช้สิทธิ์, Then ตอบ 401
  // requirement login ล่าสุด: ยังไม่ login ต้องกลับหน้าแรก ไม่แสดงหน้าภายในหรือฟอร์มสร้าง
  test('ผู้ที่ยังไม่ login เข้าหน้าห้องเรียนไม่ได้', async ({ page }) => {
    const classrooms = new ClassroomsPage(page)
    await classrooms.goto()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('main-cta')).toBeVisible()
    await expect(classrooms.nameInput).toHaveCount(0)
    await expect(classrooms.submitButton).toHaveCount(0)
  })
})

test.describe('การแยกข้อมูลระหว่างผู้ใช้ — US-11', () => {
  // AC: Given ฉันเป็นสมาชิก classroom A, When ขอ resource ของ classroom B, Then ไม่เห็น
  test('เห็นเฉพาะห้องเรียนของตัวเอง ไม่เห็นของคนอื่น', async ({ signedInPage, request }) => {
    const classrooms = new ClassroomsPage(signedInPage)
    await classrooms.goto()
    await classrooms.createClassroom(testClassroom.name)
    await expect(classrooms.classroomNamed(testClassroom.name)).toBeVisible()

    // อาจารย์อีกคนสร้างห้องเรียนของตัวเองผ่าน API โดยตรง
    const apiBase = process.env.API_BASE_URL ?? 'http://localhost:8123'
    const session = await request.post(`${apiBase}/api/test/session`, {
      data: { email: 'ajarn2@uni.ac.th' },
    })
    const { accessToken } = (await session.json()) as { accessToken: string }
    await request.post(`${apiBase}/api/classrooms`, {
      headers: { authorization: `Bearer ${accessToken}` },
      data: { name: 'ห้องเรียนของอาจารย์อีกคน', timezone: 'Asia/Bangkok' },
    })

    await signedInPage.reload()

    await expect(classrooms.classroomList.getByRole('listitem')).toHaveCount(1)
    await expect(classrooms.classroomNamed('ห้องเรียนของอาจารย์อีกคน')).toHaveCount(0)
  })
})

/* ประเภทบัญชีจากรูปแบบอีเมล (ทีมกำหนด 2026-10-20) — app/domain/account.py
 * ส่วนหน้า @ เป็นตัวเลขล้วน = นักศึกษา สร้างห้องไม่ได้ · แบบอื่นทั้งหมด = อาจารย์ */
test.describe('บัญชีนักศึกษาและอาจารย์', () => {
  const studentEmail = '67015090@kmitl.ac.th'
  const instructorEmail = 'Arjan.0001@kmitl.ac.th'

  test('อีเมลตัวเลขล้วนสร้างห้องไม่ได้ทั้งทาง API และไม่เห็นปุ่มสร้าง', async ({ api, page }) => {
    await api.post('/api/test/seed', { data: { users: [{ email: studentEmail, displayName: 'นักศึกษา' }], reset: false } })
    const token = await issueToken(api, studentEmail)
    const auth = { headers: { authorization: `Bearer ${token}` } }

    expect((await (await api.get('/api/me', auth)).json()).accountType).toBe('STUDENT')
    const res = await api.post('/api/classrooms', { ...auth, data: { name: 'ห้องของนักศึกษา', timezone: 'Asia/Bangkok' } })
    expect(res.status()).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')

    await page.addInitScript((value) => window.localStorage.setItem('paireval.session', value), token)
    await page.goto('/classrooms')
    await expect(page.getByTestId('empty-state')).toContainText('ยังไม่มีห้องเรียนของคุณ')
    await expect(page.getByRole('button', { name: /สร้างห้องเรียน/ })).toHaveCount(0)
  })

  test('อีเมลแบบอื่น (มีตัวอักษร) เป็นอาจารย์และสร้างห้องได้ ไม่ว่าจะเป็น domain ไหน', async ({ api }) => {
    for (const email of [instructorEmail, 'someone@gmail.com']) {
      await api.post('/api/test/seed', { data: { users: [{ email, displayName: 'อาจารย์' }], reset: false } })
      const auth = { headers: { authorization: `Bearer ${await issueToken(api, email)}` } }
      expect((await (await api.get('/api/me', auth)).json()).accountType).toBe('INSTRUCTOR')
      const res = await api.post('/api/classrooms', { ...auth, data: { name: `ห้องของ ${email}`, timezone: 'Asia/Bangkok' } })
      expect(res.status()).toBe(201)
    }
  })
})
