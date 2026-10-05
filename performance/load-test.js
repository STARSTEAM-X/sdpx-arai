// WS-07: fixture เตรียมจากสิทธิ์ DB ของ staging; ไม่เรียก /api/test/*
// PERF_FIXTURE_FILE อยู่ใน performance/.secrets/ และไม่เข้า Git หรือ artifact
import http from 'k6/http'
import { check, fail, group, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const journeyErrors = new Rate('journey_errors')
const autosaveLatency = new Trend('autosave_latency', true)
const submissionLatency = new Trend('submission_latency', true)
const PEAK_VUS = Number(__ENV.PEAK_VUS || 10)

let fixture
try {
  fixture = JSON.parse(__ENV.PERF_FIXTURE_JSON || open(__ENV.PERF_FIXTURE_FILE || '.secrets/fixture.json'))
} catch (_) {
  throw new Error('Missing or invalid private performance fixture; run app.perf_fixture first')
}
const BASE_URL = (__ENV.BASE_URL || fixture.baseUrl || '').replace(/\/$/, '')
const auth = (token, name) => ({ headers: { Authorization: `Bearer ${token}` }, tags: { name } })
const json = (token) => ({ headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })

export const options = {
  scenarios: {
    students: {
      executor: 'ramping-vus', exec: 'student', startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '30s', target: Math.ceil(PEAK_VUS / 2) },
        { duration: __ENV.STEADY || '1m', target: PEAK_VUS },
        { duration: __ENV.RAMP || '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
    instructor: {
      executor: 'constant-vus', exec: 'instructor', vus: 1,
      duration: __ENV.INSTRUCTOR_DURATION || '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99'],
    journey_errors: ['rate<0.05'],
    autosave_latency: [`p(95)<=${__ENV.AUTOSAVE_P95_MS || 300}`],
    submission_latency: [`p(95)<=${__ENV.SUBMISSION_P95_MS || 800}`],
    'http_req_duration{name:my_evaluations}': ['p(95)<400'],
    'http_req_duration{name:save_comparison}': ['p(95)<=300'],
    'http_req_duration{name:submit}': ['p(95)<=800'],
    'http_req_duration{name:scores}': ['p(95)<500'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

export function setup() {
  if (!BASE_URL || BASE_URL !== fixture.baseUrl || !fixture.teacherToken ||
      !fixture.classroomId || !fixture.assignmentId || !Array.isArray(fixture.students) ||
      fixture.students.length < PEAK_VUS + 1 || !fixture.students.every(t => typeof t === 'string' && t)) {
    fail('Fixture must match target and provide distinct accounts for all VUs')
  }
  if (!fixture.expiresAt || Date.parse(fixture.expiresAt) < Date.now() + 5 * 60 * 1000) {
    fail('Fixture sessions expire too soon; regenerate using staging credentials')
  }
  const health = http.get(`${BASE_URL}/api/health`, { tags: { name: 'setup' } })
  if (health.status !== 200) fail('Target health check failed')
  const tier = health.json('deploymentTier')
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL)
  if (tier !== 'staging' && !(local && tier === 'local')) fail('Refusing production or unknown target')
  if (!local && (!BASE_URL.startsWith('https://') || health.json('environment') !== 'production')) {
    fail('Public staging requires HTTPS and ENVIRONMENT=production')
  }
  const me = http.get(`${BASE_URL}/api/me`, auth(fixture.students[0], 'setup'))
  if (me.status !== 200) fail('Fixture authentication failed; regenerate private sessions')
  const pairs = http.get(`${BASE_URL}/api/assignments/${fixture.assignmentId}/my-evaluations?side=GROUP`, auth(fixture.students[0], 'setup'))
  if (pairs.status !== 200 || !pairs.json('items').length) fail('Fixture has no evaluation pairs')
  return { ...fixture, ajarn: fixture.teacherToken, runId: String(Date.now()) }
}

// ---------------------------------------------------------------------------
// journey ของนักศึกษา — ลำดับเดียวกับที่หน้าเว็บเรียกจริง
// ---------------------------------------------------------------------------
export function student(data) {
  // setup บังคับจำนวนบัญชี >= VUs รวม เพื่อไม่ให้หลาย VU ใช้บัญชีเดียวกัน
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
      const thinkSeconds = 3 + Math.random() * 3
      sleep(thinkSeconds)
      const res = http.put(
        `${BASE_URL}/api/comparisons/${pair.pairAssignmentId}`,
        JSON.stringify({ choice: 1 + Math.floor(Math.random() * 6), timeOnTaskMs: Math.round(thinkSeconds * 1000) }),
        { ...json(token), tags: { name: 'save_comparison' } },
      )
      autosaveLatency.add(res.timings.duration)
      journeyErrors.add(!check(res, { 'autosave 200': (r) => r.status === 200 }))
    }
  })

  group('ส่งผลประเมิน', () => {
    if (!pairs.length) {
      journeyErrors.add(true)
      return
    }
    const res = http.post(
      `${BASE_URL}/api/assignments/${data.assignmentId}/submissions`,
      JSON.stringify({ side: 'GROUP' }),
      {
        headers: {
          ...json(token).headers,
          'Idempotency-Key': `${data.runId}-${__VU}-${__ITER}`,
        },
        tags: { name: 'submit' },
      },
    )
    submissionLatency.add(res.timings.duration)
    journeyErrors.add(!check(res, {
      'submit 200 และมีคำตอบที่ส่งจริง': r => r.status === 200 && r.json('submittedCount') > 0,
    }))
    sleep(2)
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
