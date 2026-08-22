import { defineConfig, devices } from '@playwright/test'

/* E2E อยู่ระดับ root เพราะทดสอบระบบที่ประกอบเสร็จแล้ว ไม่ใช่ของ frontend หรือ backend ฝ่ายใดฝ่ายหนึ่ง
 *
 * รันกับ local:    npm run e2e
 * รันกับ staging:  BASE_URL=https://paireval-web.onrender.com npm run e2e
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'

// ถ้าชี้ไป staging แล้ว ไม่ต้องยก dev server ขึ้นมาอีก
const isLocal = BASE_URL.includes('localhost')

export default defineConfig({
  testDir: './e2e/specs',
  outputDir: './e2e/test-results',

  // กัน .only ที่ลืมลบไว้ ไม่ให้เล็ดลอดขึ้น CI แล้วทำให้ test ตัวอื่นไม่ถูกรัน
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: [['html', { outputFolder: 'e2e/playwright-report', open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    // เก็บ trace เฉพาะตอน retry — ไฟล์ใหญ่ ไม่ควรเก็บทุกรอบ
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: isLocal
    ? {
        command: 'npm run dev --prefix frontend',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      }
    : undefined,
})
