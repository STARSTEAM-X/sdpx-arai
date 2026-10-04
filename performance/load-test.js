// k6 load test (WS-07) — journey จริงของ PairEval ในช่วงที่โหลดหนักที่สุด:
// นักศึกษาทั้งห้องเปิดงานแล้วประเมินคู่พร้อมกันก่อน deadline (autosave ทุกครั้งที่เลือกคำตอบ)
//
//   BASE_URL=http://localhost:8000 k6 run --summary-export=performance/baseline.json performance/load-test.js
//
// staging:
//   BASE_URL=https://<staging-api> TEST_SUPPORT_TOKEN=<secret> k6 run performance/load-test.js
//
// ยิงได้เฉพาะ backend ที่ ENVIRONMENT ≠ production — setup() ใช้ /api/test/* สร้างห้องเรียน ผู้ใช้
// และออก session ให้นักศึกษาแต่ละคน (login จริงต้องผ่าน Google ซึ่ง k6 ทำไม่ได้)
// บน staging endpoint ชุดนี้เปิดเฉพาะเมื่อแนบ X-Test-Support-Token ที่ตรงกับ env ของ server
//
// seed แบบ reset: false — ไม่ลบของเดิม ทุก run สร้างห้องใหม่เพิ่ม ข้อมูลบน staging จึงสะสมให้ใหญ่ขึ้นเรื่อย ๆ

import http from 'k6/http'
import { check, fail, group, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// ---------------------------------------------------------------------------
// custom metrics
// ---------------------------------------------------------------------------
// error ระดับ journey (status ไม่ตรงที่คาด) แยกจาก http_req_failed ที่นับแค่ 4xx/5xx
const journeyErrors = new Rate('journey_errors')
// autosave คือสิ่งที่นักศึกษารู้สึกได้ตรง ๆ ว่า "ระบบหน่วง" — ติดตามแยกเป็นตัวเลขของมันเอง
const autosaveLatency = new Trend('autosave_latency', true)

const STUDENTS = Number(__ENV.STUDENTS || 60) // คนในห้อง (seed) — 15 กลุ่ม กลุ่มละ 4
const PEAK_VUS = Number(__ENV.PEAK_VUS || 10)

export const options = {
  scenarios: {
    // นักศึกษา: ramp ขึ้น → คงที่ → ลง ตาม profile ของ lab
    students: {
      executor: 'ramping-vus',
      exec: 'student',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '30s', target: Math.ceil(PEAK_VUS / 2) },
        { duration: __ENV.STEADY || '1m', target: PEAK_VUS },
        { duration: __ENV.RAMP || '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
    // อาจารย์ 1 คนเปิดดูคะแนนชั่วคราวและรายชื่อเป็นระยะระหว่างที่นักศึกษาประเมิน
    instructor: {
      executor: 'constant-vus',
      exec: 'instructor',
      vus: 1,
      duration: __ENV.INSTRUCTOR_DURATION || '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99'],
    journey_errors: ['rate<0.05'],
    autosave_latency: [`p(95)<${__ENV.AUTOSAVE_P95_MS || 300}`],
    // ราย endpoint ด้วย tag `name` — รู้ทันทีว่าตัวไหนทำให้ภาพรวมแดง
    'http_req_duration{name:me}': ['p(95)<300'],
    'http_req_duration{name:classrooms}': ['p(95)<300'],
    'http_req_duration{name:my_evaluations}': ['p(95)<400'],
    'http_req_duration{name:save_comparison}': ['p(95)<300'],
    'http_req_duration{name:scores}': ['p(95)<500'],
  },
  // setup ยิงหลายสิบ request (seed + session รายคน) — ไม่ให้มันปนในสถิติของ journey
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  setupTimeout: '120s',
}

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
// domain เดียวกับ ALLOWED_EMAIL_DOMAINS ของ staging · ชื่อขึ้นต้นด้วย perf- ไม่ชนกับรหัสนักศึกษาจริง
const DOMAIN = __ENV.EMAIL_DOMAIN || 'kmitl.ac.th'
const INSTRUCTOR = `perf-ajarn@${DOMAIN}`
const RUN_ID = `${Date.now()}`
const SETUP = { tags: { name: 'setup' } }
const TEST_SUPPORT = { 'X-Test-Support-Token': __ENV.TEST_SUPPORT_TOKEN || '' }

const json = (token) => ({
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
})
const testSupport = () => ({ headers: { 'Content-Type': 'application/json', ...TEST_SUPPORT }, ...SETUP })
const auth = (token, name) => ({ headers: { Authorization: `Bearer ${token}` }, tags: { name } })

function must(res, status, what) {
  if (res.status !== status) {
    fail(`${what}: ได้ HTTP ${res.status} (คาด ${status}) — ${String(res.body).slice(0, 200)}`)
  }
  return res
}

function session(email) {
  return must(http.post(`${BASE_URL}/api/test/session`, JSON.stringify({ email }), testSupport()), 200, `session ${email}`).json('accessToken')
}

// ---------------------------------------------------------------------------
// setup — สร้างสถานการณ์จริงหนึ่งห้อง: ห้อง 60 คน 15 กลุ่ม งานที่ publish แล้ว (มีคู่ให้ประเมิน)
// ---------------------------------------------------------------------------
export function setup() {
  const health = http.get(`${BASE_URL}/api/health`, SETUP)
  if (health.status !== 200) fail(`backend ไม่พร้อม: /api/health ได้ ${health.status}`)
  if (health.json('environment') === 'production') {
    fail('เป้าหมายเป็น production — /api/test/* ถูกปิด และห้ามยิง load ใส่ production')
  }

  const seeded = http.post(`${BASE_URL}/api/test/seed`, JSON.stringify({ users: [{ email: INSTRUCTOR, displayName: 'อ.โหลดเทสต์' }], reset: false }), testSupport())
  if (seeded.status === 404) fail('/api/test/* ปิดอยู่ — บน staging ต้องตั้ง TEST_SUPPORT_TOKEN ให้ตรงกับของ server')
  must(seeded, 200, 'seed')
  const ajarn = session(INSTRUCTOR)

  const classroomId = must(
    http.post(`${BASE_URL}/api/classrooms`, JSON.stringify({ name: `Load test ${RUN_ID}`, timezone: 'Asia/Bangkok' }), { ...json(ajarn), ...SETUP }),
    201,
    'สร้างห้องเรียน',
  ).json('id')

  // นักศึกษาชุดเดิมทุก run (อีเมลซ้ำได้) แต่ห้องใหม่ — คนเดียวอยู่หลายห้องได้เหมือนของจริง
  const emails = Array.from({ length: STUDENTS }, (_, i) => `perf-stu${String(i + 1).padStart(3, '0')}@${DOMAIN}`)
  const csv = ['email,group_name', ...emails.map((e, i) => `${e},group-${String(Math.floor(i / 4) + 1).padStart(2, '0')}`)].join('\n')
  must(
    http.post(`${BASE_URL}/api/classrooms/${classroomId}/roster:import`, { file: http.file(csv, 'roster.csv', 'text/csv') }, { headers: { Authorization: `Bearer ${ajarn}` }, ...SETUP }),
    200,
    'นำเข้ารายชื่อ',
  )

  const assignmentId = must(
    http.post(
      `${BASE_URL}/api/assignments`,
      JSON.stringify({
        classroomId,
        name: 'งานกลุ่ม (load test)',
        groupMaxScore: 15,
        individualMaxScore: 0,
        groupDeadlineUtc: '2099-01-01T00:00:00Z',
        targetCoverage: 1,
        criteria: [
          { side: 'GROUP', name: 'UX', weightPct: 50 },
          { side: 'GROUP', name: 'Code quality', weightPct: 50 },
        ],
      }),
      { ...json(ajarn), ...SETUP },
    ),
    201,
    'สร้างงานประเมิน',
  ).json('id')
  must(http.post(`${BASE_URL}/api/assignments/${assignmentId}:publish`, null, { headers: { Authorization: `Bearer ${ajarn}` }, ...SETUP }), 200, 'publish')

  const students = emails.map(session)
  return { classroomId, assignmentId, ajarn, students }
}

// ---------------------------------------------------------------------------
// journey ของนักศึกษา — ลำดับเดียวกับที่หน้าเว็บเรียกจริง
// ---------------------------------------------------------------------------
export function student(data) {
  // VU แต่ละตัวเป็นนักศึกษาคนละคน (วนใช้ถ้า VU มากกว่าคนในห้อง)
  const token = data.students[(__VU - 1) % data.students.length]

  let pairs = []
  group('เปิดแอปและเข้าห้องเรียน', () => {
    const me = http.get(`${BASE_URL}/api/me`, auth(token, 'me'))
    const list = http.get(`${BASE_URL}/api/classrooms`, auth(token, 'classrooms'))
    const ok = check(me, { 'me 200': (r) => r.status === 200 }) &&
      check(list, { 'classrooms 200 และเห็นห้อง': (r) => r.status === 200 && r.json('items').length > 0 })
    journeyErrors.add(!ok)
    sleep(1 + Math.random()) // อ่านหน้าแรก
  })

  group('เปิดงานที่ต้องประเมิน', () => {
    const assignments = http.get(`${BASE_URL}/api/classrooms/${data.classroomId}/assignments`, auth(token, 'assignments'))
    const evals = http.get(`${BASE_URL}/api/assignments/${data.assignmentId}/my-evaluations?side=GROUP`, auth(token, 'my_evaluations'))
    const ok = check(assignments, { 'assignments 200': (r) => r.status === 200 }) &&
      check(evals, { 'my-evaluations 200 และมีคู่': (r) => r.status === 200 && r.json('items').length > 0 })
    journeyErrors.add(!ok)
    if (evals.status === 200) pairs = evals.json('items')
    sleep(2 + Math.random() * 2) // อ่านคำอธิบายงาน
  })

  group('ประเมินคู่ (autosave)', () => {
    // คนจริงประเมินทีละคู่แล้วใช้เวลาดูงานก่อนเลือก — ไม่กดรัว
    for (const pair of pairs.slice(0, 3)) {
      const res = http.put(
        `${BASE_URL}/api/comparisons/${pair.pairAssignmentId}`,
        JSON.stringify({ choice: 1 + Math.floor(Math.random() * 6), timeOnTaskMs: 4000 }),
        { ...json(token), tags: { name: 'save_comparison' } },
      )
      autosaveLatency.add(res.timings.duration)
      journeyErrors.add(!check(res, { 'autosave 200': (r) => r.status === 200 }))
      sleep(3 + Math.random() * 3)
    }
  })
}

// ---------------------------------------------------------------------------
// อาจารย์ — เปิดดูคะแนนชั่วคราวกับรายชื่อระหว่างที่นักศึกษาประเมินอยู่
// ---------------------------------------------------------------------------
export function instructor(data) {
  group('อาจารย์ติดตามความคืบหน้า', () => {
    const scores = http.get(`${BASE_URL}/api/assignments/${data.assignmentId}/scores`, auth(data.ajarn, 'scores'))
    const roster = http.get(`${BASE_URL}/api/classrooms/${data.classroomId}/roster`, auth(data.ajarn, 'roster'))
    journeyErrors.add(!(check(scores, { 'scores 200': (r) => r.status === 200 }) && check(roster, { 'roster 200': (r) => r.status === 200 })))
    sleep(5)
  })
}
