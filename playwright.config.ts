import { defineConfig, devices } from '@playwright/test'

/* E2E อยู่ระดับ root เพราะทดสอบระบบที่ประกอบเสร็จแล้ว ไม่ใช่ของ frontend หรือ backend ฝ่ายใดฝ่ายหนึ่ง
 *
 * รันกับ local:    npm run e2e
 * รันกับ staging:  BASE_URL=... API_BASE_URL=... npm run e2e
 *
 * ต้องมี Postgres ขึ้นอยู่ก่อน:  docker compose up -d db
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173'
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8123'

// ถ้าชี้ไป staging แล้ว ไม่ต้องยก server ขึ้นมาเอง
const isLocal = BASE_URL.includes('localhost')

// Playwright รันคำสั่งผ่าน shell ของ OS — Windows ใช้ cmd.exe ที่ไม่รู้จัก forward slash
// เขียนแยกตาม platform เพื่อให้คำสั่งเดียวกันรันได้ทั้งบน Windows และ mac/Linux
const PYTHON_BIN =
  process.platform === 'win32' ? '.venv\\Scripts\\python.exe' : '.venv/bin/python'

export default defineConfig({
  testDir: './e2e/specs',
  outputDir: './e2e/test-results',

  // local รันขนานเพื่อความเร็ว · CI รันเรียงเพื่อความนิ่ง
  // (test ชุดนี้ share database เดียวกัน การรันขนานจึงยังทำไม่ได้จนกว่าจะแยก schema ต่อ worker)
  fullyParallel: false,
  workers: 1,

  // กัน .only ที่ลืมลบ ไม่ให้เล็ดลอดขึ้น CI แล้วทำให้ test ตัวอื่นไม่ถูกรัน
  forbidOnly: !!process.env.CI,
  // retry น้อย ๆ เพื่อไม่ให้ซ่อน flaky
  retries: process.env.CI ? 1 : 0,

  timeout: 30_000,
  expect: { timeout: 5_000 },

  reporter: [['html', { outputFolder: 'e2e/playwright-report', open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // trace เฉพาะตอน retry — ไฟล์ใหญ่ ไม่ควรเก็บทุกรอบ
    trace: 'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // ยกทั้ง API และ frontend ให้เอง — กันเคส "ลืมเปิด server แล้ว test แดงเพราะเหตุผลผิด ๆ"
  webServer: isLocal
    ? [
        {
          command: `${PYTHON_BIN} -m uvicorn app.main:app --host 127.0.0.1 --port 8123`,
          cwd: 'backend',
          url: `${API_BASE_URL}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
          env: {
            ENVIRONMENT: 'development',
            // ต้องยาว >= 32 bytes ตาม RFC 7518 §3.2 — backend ตรวจและ throw ถ้าสั้นกว่านี้
            SESSION_SECRET: 'e2e-only-secret-value-that-is-long-enough-32b',
            CORS_ORIGINS: BASE_URL,
          },
        },
        {
          command: 'npm run dev --prefix frontend',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ]
    : undefined,
})
