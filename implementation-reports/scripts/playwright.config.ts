import { defineConfig } from '@playwright/test'
import path from 'node:path'
export default defineConfig({
  testDir: '.', testMatch: '*.spec.ts', workers: 1, retries: 0, timeout: 45000,
  outputDir: '../test-results',
  reporter: [['list'], ['json', { outputFile: path.resolve(__dirname, '../results.json') }]],
  use: { baseURL: process.env.BASE_URL, locale: 'th-TH', timezoneId: 'Asia/Bangkok', screenshot: 'only-on-failure' },
})
