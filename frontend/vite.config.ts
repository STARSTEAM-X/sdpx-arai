/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tailwind v4 ติดตั้งเป็น Vite plugin — ไม่ต้องมี tailwind.config.js หรือ postcss.config.js
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  test: {
    // มองหา test ทุกไฟล์ใน src/ ที่ลงท้ายด้วย .test.ts หรือ .test.tsx
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reportsDirectory: '../docs/coverage/frontend',
    },
  },
})
