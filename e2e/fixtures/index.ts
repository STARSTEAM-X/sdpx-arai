import {
  type APIRequestContext,
  test as base,
  expect,
  request as playwrightRequest,
} from '@playwright/test'

import { testUsers } from '../seed/test-data'

/** API อยู่คนละ origin กับหน้าเว็บ จึงต้องมี base ของตัวเอง
 *  ค่าเดียวกับที่ frontend ใช้ผ่าน VITE_API_BASE_URL */
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8123'

const SESSION_KEY = 'paireval.session'

/** ขอ session ให้อีเมลหนึ่ง ๆ ผ่าน endpoint ที่ปิดสนิทใน production
 *
 *  Playwright login ผ่าน Google จริงไม่ได้ (Google บล็อก automated login)
 *  ผู้ใช้ต้องมีอยู่ใน database แล้ว — มาจาก seed หรือจากการ import roster
 */
export async function issueToken(api: APIRequestContext, email: string): Promise<string> {
  const res = await api.post('/api/test/session', { data: { email } })
  expect(res.ok(), `ขอ session ให้ ${email} ไม่สำเร็จ`).toBeTruthy()
  const { accessToken } = (await res.json()) as { accessToken: string }
  return accessToken
}

type Fixtures = {
  /** ตั้ง database ให้อยู่ในสภาพที่รู้แน่ก่อนทุก test แล้วล้างหลังจบ */
  cleanDb: void
  /** APIRequestContext ที่ชี้ไป backend — ใช้เตรียม state และยิง endpoint ตรง ๆ */
  api: APIRequestContext
  /** session token ของอาจารย์เจ้าของห้อง */
  instructorToken: string
  /** เปิดหน้าเว็บโดยมี session ของอาจารย์ติดมาแล้ว */
  signedInPage: import('@playwright/test').Page
  /** id ของห้องเรียนที่อาจารย์เป็น OWNER — สร้างใหม่ทุก test */
  classroomId: string
}

export const test = base.extend<Fixtures>({
  cleanDb: [
    async ({}, use) => {
      const api = await playwrightRequest.newContext({ baseURL: API_BASE_URL })

      const seeded = await api.post('/api/test/seed', {
        data: { users: [testUsers.instructor, testUsers.otherInstructor] },
      })
      expect(seeded.ok(), 'seed endpoint ต้องสำเร็จ ไม่งั้น test ที่เหลือไม่มีความหมาย').toBeTruthy()

      await use()

      // ล้างแม้ test จะ fail — ไม่งั้น test ตัวถัดไปจะเจอข้อมูลค้าง
      await api.post('/api/test/cleanup')
      await api.dispose()
    },
    { auto: true },
  ],

  api: async ({}, use) => {
    const api = await playwrightRequest.newContext({ baseURL: API_BASE_URL })
    await use(api)
    await api.dispose()
  },

  instructorToken: async ({ api }, use) => {
    await use(await issueToken(api, testUsers.instructor.email))
  },

  signedInPage: async ({ page, instructorToken }, use) => {
    // ใส่ token ก่อนหน้าเว็บจะรัน script ใด ๆ — ถ้าใส่ทีหลังหน้าจะ render แบบยังไม่ login ไปแล้ว
    await page.addInitScript(
      ([key, token]) => window.localStorage.setItem(key, token),
      [SESSION_KEY, instructorToken] as const,
    )

    await use(page)
  },

  classroomId: async ({ api, instructorToken }, use) => {
    // สร้างผ่าน API ไม่ใช่ผ่าน UI — test ที่ทดสอบเรื่อง roster ไม่ควรพังเพราะฟอร์มสร้างห้องเปลี่ยน
    const res = await api.post('/api/classrooms', {
      headers: { authorization: `Bearer ${instructorToken}` },
      data: { name: 'ห้องสำหรับทดสอบรายชื่อ', timezone: 'Asia/Bangkok' },
    })
    expect(res.ok(), 'สร้างห้องเรียนตั้งต้นไม่สำเร็จ').toBeTruthy()
    const { id } = (await res.json()) as { id: string }
    await use(id)
  },
})

export { expect }
