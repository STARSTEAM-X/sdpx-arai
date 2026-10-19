import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { auditTargets } from './audit-targets'

const ROOT = path.resolve(__dirname, '..')
const { baseURL } = auditTargets()

export default defineConfig({
  testDir: '.',
  testMatch: 'failure.spec.ts',
  outputDir: path.join(ROOT, 'evidence/failure/test-results'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(ROOT, 'evidence/failure-playwright.json') }],
    ['html', { outputFolder: path.join(ROOT, 'evidence/failure-playwright-report'), open: 'never' }],
  ],
  use: {
    baseURL,
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    viewport: { width: 1440, height: 900 },
    screenshot: 'off',
    video: 'off',
    trace: 'off',
    actionTimeout: 5_000,
    navigationTimeout: 20_000,
  },
  projects: [{ name: 'failure-audit-chromium', use: { ...devices['Desktop Chrome'] } }],
})
