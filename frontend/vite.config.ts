/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tailwind v4 ติดตั้งเป็น Vite plugin — ไม่ต้องมี tailwind.config.js หรือ postcss.config.js
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      // PRD §14.3 FR-SEC-01 — CSP ใส่เป็น <meta> ตอน build เท่านั้น เพราะ connect-src ต้องรู้ URL ของ API
      // ของ build นั้น (Render / E2E ต่างกัน) และ dev server ของ Vite ฉีด inline script ที่ CSP นี้จะบล็อก
      // header อื่น (HSTS, nosniff, frame) อยู่ใน render.yaml และ nginx.conf · frame-ancestors ใช้ใน meta ไม่ได้
      name: 'content-security-policy',
      apply: 'build',
      transformIndexHtml() {
        const api = new URL(process.env.VITE_API_BASE_URL || 'http://localhost:8000').origin
        const policy = [
          "default-src 'self'",
          // Google Identity Services: สคริปต์ ปุ่ม (iframe) และ style ของปุ่ม
          "script-src 'self' https://accounts.google.com/gsi/client",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
          'font-src https://fonts.gstatic.com',
          "img-src 'self' data: blob: https:",
          `connect-src 'self' ${api} https://accounts.google.com/gsi/`,
          'frame-src https://accounts.google.com/gsi/',
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
        ].join('; ')
        return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }]
      },
    },
    {
      name: 'build-version',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'build-info.json',
          source: JSON.stringify({
            version: process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || process.env.APP_VERSION || 'dev',
          }),
        })
      },
    },
  ],
  server: {
    port: 5173,
    // Docker Desktop บน Windows/macOS ไม่ส่ง file event ข้าม bind mount — compose เปิด polling ให้
    watch: process.env.WATCH_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
    headers: {
      // Google Sign-In เปิด popup แล้วคุยกลับมาด้วย window.postMessage
      // ค่า default ของเบราว์เซอร์ปิดกั้นการคุยข้าม origin แบบนั้น
      // same-origin-allow-popups เปิดช่องเฉพาะ popup ที่หน้านี้เปิดเอง
      // โดยยังกันหน้าอื่นไม่ให้มายุ่งกับ window ของเรา
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  test: {
    // มองหา test ทุกไฟล์ใน src/ ที่ลงท้ายด้วย .test.ts หรือ .test.tsx
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reportsDirectory: '../docs/coverage/frontend',
      // all: true บังคับให้นับไฟล์ที่ test ยังไม่แตะด้วย
      // ถ้าไม่ตั้ง vitest จะนับเฉพาะไฟล์ที่ถูก import เข้ามา แล้วรายงาน 100%
      // ทั้งที่ยังไม่ได้ทดสอบอะไรเลย — ตัวเลขแบบนั้นหลอกตัวเองมากกว่าไม่มีตัวเลข
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx'],
    },
  },
})
