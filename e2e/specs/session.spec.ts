import { createHmac } from 'node:crypto'

import { expect, test } from '../fixtures'

/* FR-AUTH-04 — session ที่ใกล้หมดอายุถูกต่ออายุเงียบ ๆ ระหว่างใช้งาน
 * สร้าง token ที่เหลืออายุ 1 ชม. ด้วย secret ของ stack ทดสอบ (compose.test.yaml — ค่าทดสอบเท่านั้น)
 * แล้วยืนยันว่าหน้าเว็บได้ token ใหม่ผ่าน header X-Session-Token และเก็บทับของเดิม
 */
const TEST_SECRET = 'test-only-secret-value-that-is-long-enough-32b'

function sign(payload: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const body = `${part({ alg: 'HS256', typ: 'JWT' })}.${part(payload)}`
  return `${body}.${createHmac('sha256', TEST_SECRET).update(body).digest('base64url')}`
}

function expiry(token: string): number {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp
}

test('FR-AUTH-04: token ที่เหลือไม่ถึง 2 ชม. ถูกต่ออายุโดยผู้ใช้ไม่ต้องล็อกอินใหม่', async ({ page, instructorToken }) => {
  const email = JSON.parse(Buffer.from(instructorToken.split('.')[1], 'base64url').toString()).sub
  const nearlyExpired = sign({ sub: email, exp: Math.floor(Date.now() / 1000) + 3600 })
  await page.addInitScript(
    ([key, token]) => {
      if (!window.sessionStorage.getItem('seeded')) {
        window.localStorage.setItem(key, token)
        window.sessionStorage.setItem('seeded', '1')
      }
    },
    ['paireval.session', nearlyExpired] as const,
  )
  await page.goto('/classrooms')
  await expect(page.getByRole('heading', { name: 'ห้องเรียนของฉัน', level: 1 })).toBeVisible()
  await expect
    .poll(async () => page.evaluate(() => window.localStorage.getItem('paireval.session')))
    .not.toBe(nearlyExpired)
  const renewed = await page.evaluate(() => window.localStorage.getItem('paireval.session'))
  expect(expiry(renewed!) - Math.floor(Date.now() / 1000)).toBeGreaterThan(11 * 3600)
})
