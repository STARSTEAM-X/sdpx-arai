import { defineConfig } from '@playwright/test'
import path from 'node:path'
import { auditTargets } from './audit-targets'
const root = path.resolve(__dirname, '..')
const { baseURL } = auditTargets()
export default defineConfig({ testDir: '.', testMatch: 'visual.spec.ts', workers: 1, retries: 0, timeout: 90_000,
  outputDir: path.join(root, 'evidence/visual/test-results'),
  reporter: [['list'], ['json', { outputFile: path.join(root, 'evidence/visual-playwright.json') }]],
  use: { baseURL, locale: 'th-TH', timezoneId: 'Asia/Bangkok', viewport: { width: 1440, height: 900 }, trace: 'off', video: 'off', screenshot: 'off' },
})
