import { expect, test } from '@playwright/test'

/* Smoke test — ตอบคำถามเดียวว่า "ระบบขึ้นและใช้งานเบื้องต้นได้ไหม"
 *
 * ยังไม่ใช่ feature test — เพราะ WS-03 ยังไม่มี user journey ให้เดิน
 * feature test ที่อ้าง acceptance criteria จะเริ่มใน WS-04
 *
 * ลำดับการเลือก element ที่ใช้: getByRole → getByLabel → getByTestId
 * role สะท้อนสิ่งที่ user เห็นจริง และทำให้ test จับ bug ด้าน accessibility ให้ฟรี
 */

test.describe('หน้าแรก', () => {
  test('เปิดได้และมี title ที่ถูกต้อง', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/PairEval/)
  })

  test('มีแถบเมนูหลักที่มองเห็นได้', async ({ page }) => {
    await page.goto('/')

    // ใช้ role ไม่ใช่ testid — <nav> ให้ role="navigation" มาอยู่แล้ว
    await expect(page.getByRole('navigation', { name: 'เมนูหลัก' })).toBeVisible()
  })

  test('มีหัวเรื่องหลักระดับ h1 เพียงหนึ่งเดียว', async ({ page }) => {
    await page.goto('/')

    // หน้าที่มี h1 หลายอันหรือไม่มีเลย เป็นปัญหา accessibility และ SEO
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  })

  test('ปุ่ม call-to-action หลักกดได้', async ({ page }) => {
    await page.goto('/')

    const cta = page.getByTestId('main-cta')
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', /.+/)
  })

  test('ส่วนแสดงตัวอย่างฟีเจอร์หลักมองเห็นได้', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('feature-placeholder')).toBeVisible()
  })
})

test.describe('การเชื่อมต่อกับ backend', () => {
  // ป้ายสถานะ API บนหน้าแรกถูกเอาออกตามแบบ Figma — ตรวจ health ของ API ตรง ๆ แทน
  test('API ตอบ health check ได้', async ({ request }) => {
    const api = process.env.API_BASE_URL ?? 'http://localhost:8123'
    const res = await request.get(`${api}/api/health`)
    expect(res.ok()).toBeTruthy()
  })
})

test.describe('คู่มือการใช้งาน', () => {
  test('ปุ่มดูวิธีใช้งานบนหน้าแรกพาไปหน้าคู่มือ', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'ดูวิธีใช้งาน' }).first().click()
    await expect(page).toHaveURL(/\/guide$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('FR-SEC-01 header ความปลอดภัย', () => {
  test('หน้าเว็บที่ build แล้วมี CSP และ header ป้องกัน โดยไม่มีอะไรถูก CSP บล็อก', async ({ page }) => {
    const violations: string[] = []
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text())
    })
    const response = await page.goto('/')
    const headers = response?.headers() ?? {}
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain('https://accounts.google.com/gsi/client')
    await page.goto('/guide')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(violations).toEqual([])
  })
})
