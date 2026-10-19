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
import { check, fail, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// ตัดสินจากเวลาที่ server ใช้จริง — Server-Timing: app;dur=<ms> (app/main.py) แบบเดียวกับ load-test.js
// run บน develop ที่ d8cf9dc ตกเพราะ round-trip p95 748ms ทั้งที่ server ใช้ ≤6.1ms ทุกครั้ง:
// runner ของ CI (สหรัฐฯ) ถึง staging (สิงคโปร์) ~220ms ซึ่งผู้ใช้ในไทยไม่ได้เจอ
const healthServerLatency = new Trend('health_server_latency', true)
// ไม่มี header = วัดไม่ได้ ต้องแดง ไม่ใช่ผ่านเงียบ ๆ
const missingServerTiming = new Rate('health_missing_server_timing')

export const options = {
  vus: Number(__ENV.VUS || 3),
  duration: __ENV.DURATION || '30s',
  // ค่า 500ms ยังเป็นตัวเลขเดิมจาก PRD ไม่ได้ผ่อนลง — request warm-up ใน setup() ไม่ถูกนับ
  // http_req_duration{name:health} (round-trip รวม network) ยังอยู่ใน summary ไว้ดูเท่านั้น
  thresholds: {
    'http_req_failed{name:health}': ['rate<0.01'],
    health_server_latency: [`p(95)<${__ENV.P95_MS || 500}`],
    health_missing_server_timing: ['rate==0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

// Server-Timing: app;dur=12.3 → 12.3 · ไม่มีหรือรูปแบบผิด → null
function serverTiming(res) {
  const match = /(?:^|,)\s*app;dur=([0-9.]+)/.exec(res.headers['Server-Timing'] || '')
  return match ? Number(match[1]) : null
}

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
const WARMUP_REQUESTS = Number(__ENV.WARMUP_REQUESTS || 5)

// warm-up ก่อนวัด: run 37252787108 ตกเพราะ p95 = 834.8ms ทั้งที่ median 283ms
// (6/69 request ช้าเกิน 500ms) — tail แบบนี้มาจาก instance บน Render ที่เพิ่ง deploy/ตื่น
// ไม่ใช่ความช้าของ steady state ที่ smoke test ตั้งใจวัด
// รอจนตอบ 200 (สูงสุด ~60s เผื่อ free tier ปลุกตัวเอง) แล้วยิงเพิ่มอีก WARMUP_REQUESTS ครั้ง
export function setup() {
  let ready = false
  for (let i = 0; i < 30 && !ready; i++) {
    ready = http.get(`${BASE_URL}/api/health`, { tags: { name: 'warmup' } }).status === 200
    if (!ready) sleep(2)
  }
  if (!ready) fail('Target never became healthy during warm-up')
  for (let i = 0; i < WARMUP_REQUESTS; i++) {
    http.get(`${BASE_URL}/api/health`, { tags: { name: 'warmup' } })
  }
}

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } })
  const serverMs = serverTiming(res)
  missingServerTiming.add(serverMs === null)
  if (serverMs !== null) healthServerLatency.add(serverMs)
  check(res, {
    'status 200': (r) => r.status === 200,
    'status ok': (r) => r.status === 200 && r.json('status') === 'ok',
    'มี Server-Timing': () => serverMs !== null,
    'server < 500ms': () => serverMs !== null && serverMs < 500,
  })
  sleep(1)
}
