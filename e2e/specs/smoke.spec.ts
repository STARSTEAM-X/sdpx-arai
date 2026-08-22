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
  test('ป้ายสถานะระบบแสดงผลลัพธ์ ไม่ค้างอยู่ที่กำลังโหลด', async ({ page }) => {
    await page.goto('/')

    const badge = page.getByTestId('api-status')
    await expect(badge).toBeVisible()

    // web-first assertion รอให้เองจนกว่า attribute จะเปลี่ยน ไม่ต้องใช้ waitForTimeout
    // ยอมรับทั้ง ok และ error เพราะ smoke test ไม่ควรพังเมื่อ backend ล่ม
    // — หน้าที่ของมันคือบอกว่า frontend ยัง render ได้ ส่วนสถานะ backend เป็นคนละเรื่อง
    await expect(badge).toHaveAttribute('data-status', /^(ok|error)$/)
  })
})
