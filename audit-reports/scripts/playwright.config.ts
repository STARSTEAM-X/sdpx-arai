import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import { auditTargets } from './audit-targets'

const EVIDENCE = path.resolve(__dirname, '../evidence')
const { baseURL } = auditTargets()

/** Audit-only runner. Use an isolated synthetic database; never staging/production. */
export default defineConfig({
  testDir: '.',
  testMatch: 'runtime.spec.ts',
  outputDir: '../evidence/test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(EVIDENCE, 'runtime-playwright.json') }],
    ['html', { outputFolder: path.join(EVIDENCE, 'runtime-playwright-report'), open: 'never' }],
  ],
  use: {
    baseURL,
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    screenshot: 'off',
    video: 'off',
    trace: 'off',
    actionTimeout: 5_000,
    navigationTimeout: 20_000,
  },
  projects: [{ name: 'audit-chromium', use: { ...devices['Desktop Chrome'] } }],
})
