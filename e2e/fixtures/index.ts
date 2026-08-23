import { test as base, expect, request as playwrightRequest } from '@playwright/test'

import { testUsers } from '../seed/test-data'

/** API อยู่คนละ origin กับหน้าเว็บ จึงต้องมี base ของตัวเอง
 *  ค่าเดียวกับที่ frontend ใช้ผ่าน VITE_API_BASE_URL */
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8123'

const SESSION_KEY = 'paireval.session'

type Fixtures = {
  /** ตั้ง database ให้อยู่ในสภาพที่รู้แน่ก่อนทุก test แล้วล้างหลังจบ */
  cleanDb: void
  /** เปิดหน้าเว็บโดยมี session ของอาจารย์ติดมาแล้ว */
  signedInPage: import('@playwright/test').Page
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

  signedInPage: async ({ page }, use) => {
    const api = await playwrightRequest.newContext({ baseURL: API_BASE_URL })

    // Playwright login ผ่าน Google จริงไม่ได้ (Google บล็อก automated login)
    // จึงใช้ test-only endpoint ที่ปิดสนิทใน production ออก session ให้แทน
    const res = await api.post('/api/test/session', {
      data: { email: testUsers.instructor.email },
    })
    expect(res.ok(), 'test-session endpoint ต้องสำเร็จ').toBeTruthy()
    const { accessToken } = (await res.json()) as { accessToken: string }
    await api.dispose()

    // ใส่ token ก่อนหน้าเว็บจะรัน script ใด ๆ — ถ้าใส่ทีหลังหน้าจะ render แบบยังไม่ login ไปแล้ว
    await page.addInitScript(
      ([key, token]) => window.localStorage.setItem(key, token),
      [SESSION_KEY, accessToken] as const,
    )

    await use(page)
  },
})

export { expect }
