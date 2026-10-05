// k6 smoke test (WS-07 homework) — ยิงเบา ๆ เพื่อยืนยันว่าเป้าหมายตอบได้และตั้ง threshold ได้
//
//   BASE_URL=https://paireval-api.onrender.com k6 run performance/smoke.js
//   (ไม่มี k6 บนเครื่อง: docker run --rm -i -e BASE_URL=... grafana/k6 run - < performance/smoke.js)
//
// ยิงแค่ /api/health เพราะเป็น endpoint เดียวบน staging ที่ไม่ต้อง login
// journey จริงที่ต้องมี session อยู่ใน load-test.js
//
// threshold ไม่ผ่าน → k6 คืน exit code 99 → CI แดง (ทดสอบแล้ว ดู docs/performance-report.md)

import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: Number(__ENV.VUS || 3),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: [`p(95)<${__ENV.P95_MS || 500}`],
  },
}

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '')

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } })
  check(res, {
    'status 200': (r) => r.status === 200,
    'status ok': (r) => r.status === 200 && r.json('status') === 'ok',
    'response < 500ms': (r) => r.timings.duration < 500,
  })
  sleep(1)
}
