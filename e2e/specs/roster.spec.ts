import { expect, issueToken, test } from '../fixtures'
import { ClassroomDetailPage } from '../pages/ClassroomDetailPage'
import { rosterCsv, testUsers } from '../seed/test-data'

/* Feature test ของ US-03 นำเข้ารายชื่อจาก CSV
 * https://github.com/STARSTEAM-X/sdpx-arai2/issues/3
 *
 * และ US-11 สองข้อที่เพิ่งบังคับใช้ได้จริงเมื่อมี endpoint ของ roster
 * https://github.com/STARSTEAM-X/sdpx-arai2/issues/11
 *
 * ทุก test อ้าง acceptance criteria จาก issue ตรง ๆ — เขียนไว้เหนือ test แต่ละตัว
 */

test.describe('US-03 นำเข้ารายชื่อจาก CSV', () => {
  // AC: Given CSV ถูกต้องทั้งไฟล์, When import,
  //     Then สร้าง user, group และ membership ครบทุกแถว
  test('happy path: ไฟล์ถูกต้องนำเข้าครบทุกแถว', async ({ signedInPage, classroomId }) => {
    const roster = new ClassroomDetailPage(signedInPage)
    await roster.goto(classroomId)

    await expect(roster.importForm).toBeVisible()

    await roster.importCsv('roster.csv', rosterCsv.valid)

    await expect(roster.importResult).toContainText('นำเข้าสำเร็จ 4 คน')
    await expect(roster.importResult).toContainText('2 กลุ่ม')
    await expect(roster.memberRow('somchai@uni.ac.th')).toBeVisible()
    await expect(roster.memberRow('mana@uni.ac.th')).toBeVisible()
    await expect(roster.studentCount).toContainText('นักศึกษา 4 คน')
  })

  test('นักศึกษาที่เพิ่ง import ยังไม่เคยเข้าระบบ จึงขึ้นสถานะรอ', async ({
    signedInPage,
    classroomId,
  }) => {
    const roster = new ClassroomDetailPage(signedInPage)
    await roster.goto(classroomId)
    await roster.importCsv('roster.csv', rosterCsv.valid)

    await expect(roster.memberRow('somchai@uni.ac.th')).toContainText('ยังไม่เคยเข้าระบบ')
  })

  // AC: Given CSV 100 แถว มีแถวที่ 42 อีเมลผิดรูปแบบ, When import,
  //     Then ไม่มีแถวไหนถูกบันทึกเลย และ error ระบุว่า row 42
  test('edge case: แถวที่ 42 ผิด แล้วทั้งไฟล์ต้องไม่ถูกบันทึก', async ({
    signedInPage,
    classroomId,
  }) => {
    const roster = new ClassroomDetailPage(signedInPage)
    await roster.goto(classroomId)

    await roster.importCsv('roster-100.csv', rosterCsv.badRow42())

    await expect(roster.rowErrors).toBeVisible()
    await expect(roster.rowErrors).toContainText('แถว 42')
    await expect(roster.rowErrors).toContainText('แก้ 1 แถวนี้แล้วอัปโหลดใหม่')

    // หัวใจของกฎ atomic — 99 แถวที่ถูกต้องต้องไม่หลุดลงไปแม้แถวเดียว
    // ห้องมีอาจารย์เป็นสมาชิกอยู่แล้วเสมอ รายชื่อจึงไม่มีวันว่าง
    // ตัวชี้ขาดคือ "ไม่มีนักศึกษาเพิ่มเข้ามาเลย" ซึ่งดูที่ตัวนับที่จะไม่ถูก render
    await expect(roster.studentCount).toHaveCount(0)
    await expect(roster.memberRow('stu1@uni.ac.th')).toHaveCount(0)
    await expect(roster.memberRow('stu100@uni.ac.th')).toHaveCount(0)
    await expect(roster.importResult).toHaveCount(0)
  })

  // AC: Given CSV มี header ตัวพิมพ์ใหญ่ Email,Group_Name, When import, Then ยอมรับได้
  test('edge case: header ตัวพิมพ์ใหญ่ยอมรับได้', async ({ signedInPage, classroomId }) => {
    const roster = new ClassroomDetailPage(signedInPage)
    await roster.goto(classroomId)

    await roster.importCsv('upper.csv', rosterCsv.upperCaseHeader)

    await expect(roster.importResult).toContainText('นำเข้าสำเร็จ 2 คน')
    await expect(roster.memberRow('wichai@uni.ac.th')).toBeVisible()
  })

  // AC: Given CSV มีกลุ่มที่มีสมาชิกคนเดียว, When import,
  //     Then สำเร็จแต่รายงานเตือนแยกประเภทว่ากลุ่มไหนมีสมาชิกน้อยกว่า 2
  test('edge case: กลุ่มที่มีสมาชิกคนเดียวสำเร็จแต่ต้องเตือน', async ({
    signedInPage,
    classroomId,
  }) => {
    const roster = new ClassroomDetailPage(signedInPage)
    await roster.goto(classroomId)

    await roster.importCsv('lone.csv', rosterCsv.loneGroup)

    await expect(roster.importResult).toContainText('นำเข้าสำเร็จ 3 คน')
    await expect(roster.importWarnings).toContainText('group-solo')
    await expect(roster.importWarnings).toContainText('น้อยกว่า 2')
    // เตือนเฉพาะกลุ่มที่เล็กจริง ไม่เหมารวมกลุ่มที่ครบ
    await expect(roster.importWarnings).not.toContainText('group-duo')
  })

  test('import ไฟล์ใหม่แทนที่รายชื่อเดิมทั้งชุด', async ({ signedInPage, classroomId }) => {
    const roster = new ClassroomDetailPage(signedInPage)
    await roster.goto(classroomId)

    await roster.importCsv('roster.csv', rosterCsv.valid)
    await expect(roster.memberRow('somchai@uni.ac.th')).toBeVisible()

    await roster.importCsv('upper.csv', rosterCsv.upperCaseHeader)

    await expect(roster.memberRow('wichai@uni.ac.th')).toBeVisible()
    await expect(roster.memberRow('somchai@uni.ac.th')).toHaveCount(0)
  })
})

test.describe('US-11 สิทธิ์บน endpoint ของรายชื่อ', () => {
  // AC: Given ฉันเป็น student, When เรียก endpoint ที่เป็นของ instructor ตรง ๆ, Then ตอบ 403
  test('นักศึกษาในห้องเรียก roster:import ตรง ๆ ได้ 403', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    // ต้อง import ก่อน เพื่อให้มีบัญชีนักศึกษาอยู่จริงในห้องนี้
    await api.post(`/api/classrooms/${classroomId}/roster:import`, {
      headers: { authorization: `Bearer ${instructorToken}` },
      multipart: {
        file: {
          name: 'roster.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(rosterCsv.valid, 'utf-8'),
        },
      },
    })

    const studentToken = await issueToken(api, 'somchai@uni.ac.th')

    const res = await api.post(`/api/classrooms/${classroomId}/roster:import`, {
      headers: { authorization: `Bearer ${studentToken}` },
      multipart: {
        file: {
          name: 'roster.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(rosterCsv.upperCaseHeader, 'utf-8'),
        },
      },
    })

    expect(res.status()).toBe(403)
    expect((await res.json()).error.code).toBe('FORBIDDEN')
  })

  test('นักศึกษาในห้องยังดูรายชื่อได้ตามปกติ', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    await api.post(`/api/classrooms/${classroomId}/roster:import`, {
      headers: { authorization: `Bearer ${instructorToken}` },
      multipart: {
        file: {
          name: 'roster.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(rosterCsv.valid, 'utf-8'),
        },
      },
    })

    const studentToken = await issueToken(api, 'somchai@uni.ac.th')

    const res = await api.get(`/api/classrooms/${classroomId}/roster`, {
      headers: { authorization: `Bearer ${studentToken}` },
    })

    expect(res.status()).toBe(200)
  })

  // AC: Given ฉันเป็นสมาชิก classroom A, When ขอ resource ของ classroom B,
  //     Then ตอบ 404 ไม่ใช่ 403 เพื่อไม่ให้รู้ว่า resource นั้นมีอยู่จริง
  test('อาจารย์อีกคนขอ roster ของห้องที่ไม่ใช่ของตัวเองได้ 404 ไม่ใช่ 403', async ({
    api,
    classroomId,
  }) => {
    const otherToken = await issueToken(api, testUsers.otherInstructor.email)

    const res = await api.get(`/api/classrooms/${classroomId}/roster`, {
      headers: { authorization: `Bearer ${otherToken}` },
    })

    expect(res.status()).toBe(404)
    expect((await res.json()).error.code).toBe('NOT_FOUND')
  })

  test('ห้องที่ไม่มีอยู่จริงตอบเหมือนห้องของคนอื่นทุกประการ', async ({
    api,
    instructorToken,
    classroomId,
  }) => {
    const ghost = '00000000-0000-4000-8000-000000000000'

    const otherToken = await issueToken(api, testUsers.otherInstructor.email)
    const notMine = await api.get(`/api/classrooms/${classroomId}/roster`, {
      headers: { authorization: `Bearer ${otherToken}` },
    })
    const notExist = await api.get(`/api/classrooms/${ghost}/roster`, {
      headers: { authorization: `Bearer ${instructorToken}` },
    })

    // ถ้าสองอันนี้ตอบต่างกันแม้แต่ข้อความเดียว คนนอกจะไล่ยิงหา id ที่มีอยู่จริงได้
    expect(notMine.status()).toBe(notExist.status())
    expect((await notMine.json()).error.message).toBe((await notExist.json()).error.message)
  })

  test('ไม่แนบ token เรียก roster ไม่ได้', async ({ api, classroomId }) => {
    const res = await api.get(`/api/classrooms/${classroomId}/roster`)

    expect(res.status()).toBe(401)
  })
})
