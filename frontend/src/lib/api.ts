import { useEffect, useState } from 'react'

import { getToken } from './session'

// build-time env ของ Vite — เปลี่ยนค่าแล้วต้อง rebuild ไม่ใช่แค่ restart
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

/** error shape มาตรฐานของ API — ตรงกับ docs/openapi.yaml */
export type ApiRowError = { row: number; reason: string }

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    field?: string | null
    details?: ApiRowError[]
    requestId: string
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly field?: string | null,
    /** ความผิดรายแถว — CSV ที่ import ไม่ผ่านจะส่งมาครบทุกแถว (R2) */
    readonly details: ApiRowError[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** เรียก API พร้อมแนบ session token และแปลง error ให้เป็น ApiError เสมอ
 *
 *  รวมไว้ที่เดียวเพื่อไม่ให้แต่ละหน้าตีความ error กันคนละแบบ
 *  หน้าจอจึงแสดงข้อความจาก `message` ได้ตรง ๆ โดยไม่ต้องรู้ status code
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()

  // FormData ต้องให้เบราว์เซอร์ตั้ง content-type เอง เพราะต้องแนบ boundary ที่มันสุ่มมา
  // ถ้าเรายัด application/json ทับ multipart จะพังทั้งก้อนโดยไม่มี error ที่อ่านรู้เรื่อง
  const isMultipart = init.body instanceof FormData

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isMultipart ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (res.ok) {
    return (res.status === 204 ? undefined : await res.json()) as T
  }

  let code = 'UNKNOWN'
  let message = `เกิดข้อผิดพลาด (HTTP ${res.status})`
  let field: string | null = null
  let details: ApiRowError[] = []

  try {
    const body = (await res.json()) as Partial<ApiErrorBody> & { detail?: unknown }
    if (body.error) {
      code = body.error.code
      message = body.error.message
      field = body.error.field ?? null
      details = body.error.details ?? []
    } else if (typeof body.detail === 'string') {
      // FastAPI ตอบ {"detail": "..."} เมื่อ error ไม่ได้ผ่าน handler ของเรา
      // เช่น request ที่ไม่ match route ใดเลย — ทิ้งข้อความนั้นไปทำให้ debug ยากขึ้นเปล่า ๆ
      message = body.detail
    }
  } catch {
    // response ที่ไม่ใช่ JSON — ใช้ข้อความ default ไป ไม่ต้องทำให้พังซ้ำ
  }

  // 404 ที่ยังได้ข้อความกลางอย่าง "Not Found" แปลว่าไม่มี route นี้บน server
  // ไม่ใช่ "ไม่พบข้อมูลที่ขอ" (ซึ่งฝั่งเราจะตอบเป็นข้อความไทยที่เจาะจงกว่านี้เสมอ)
  // เคสที่เกิดจริงคือหน้าเว็บถูก deploy ใหม่แล้วแต่ backend ยังเป็นเวอร์ชันเก่า
  // ถ้าไม่บอกตรงนี้ คนอ่าน error จะไล่หาสาเหตุที่ตัว request แทนที่จะดูว่า API เวอร์ชันอะไร
  if (res.status === 404 && (code === 'UNKNOWN' || message === 'Not Found')) {
    code = 'ENDPOINT_NOT_FOUND'
    message =
      `API ที่ ${API_BASE_URL} ไม่มี endpoint ${path} — ` +
      'backend ที่ deploy อยู่อาจเป็นเวอร์ชันเก่ากว่าหน้าเว็บ'
  }

  throw new ApiError(res.status, code, message, field, details)
}

export type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; version: string }
  | { status: 'error'; message: string }

/** ยิง /api/health เพื่อพิสูจน์ว่า backend ขึ้นจริงและ CORS ตั้งถูก */
export function useApiHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    fetch(`${API_BASE_URL}/api/health`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`API ตอบ ${res.status}`)
        const body = (await res.json()) as { status: string; version: string }
        setState({ status: 'ok', version: body.version })
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'เชื่อมต่อไม่ได้',
        })
      })

    return () => controller.abort()
  }, [])

  return state
}

// --- Auth (US-01) ---

export type Me = {
  userId: string
  email: string
  displayName: string | null
  status: string
  classrooms: { classroomId: string; classroomName: string; role: string }[]
}

/** ส่ง id_token ของ Google ให้ backend ตรวจ แล้วรับ session ของระบบเรากลับมา
 *
 *  ห้ามใช้ id_token ของ Google เป็น session ตรง ๆ — frontend ตรวจลายเซ็นเองไม่ได้
 *  และ token ของ Google ไม่ได้ผูกกับสิทธิ์ในระบบเรา
 */
export function signInWithGoogle(idToken: string): Promise<{ accessToken: string; user: Me }> {
  return apiFetch<{ accessToken: string; user: Me }>('/api/auth/session', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })
}

export function getMe(): Promise<Me> {
  return apiFetch<Me>('/api/me')
}

// --- Classroom (US-02) ---

export type Classroom = {
  id: string
  name: string
  slug: string
  timezone: string
  allowedEmailDomains: string[]
  status: string
}

export function listClassrooms(): Promise<{ items: Classroom[] }> {
  return apiFetch<{ items: Classroom[] }>('/api/classrooms')
}

export function createClassroom(input: {
  name: string
  timezone: string
  allowedEmailDomains?: string[]
}): Promise<Classroom> {
  return apiFetch<Classroom>('/api/classrooms', {
    method: 'POST',
    body: JSON.stringify({ allowedEmailDomains: [], ...input }),
  })
}

// --- Roster (US-03) ---

export type RosterEntry = {
  /** id ของแถวสมาชิก — ใช้ตอนถอดออกจากห้อง ต่างจาก userId ที่ใช้ร่วมกันทุกห้อง */
  memberId: string
  userId: string
  email: string
  displayName: string | null
  role: 'OWNER' | 'CO_TEACHER' | 'TA' | 'STUDENT'
  groupName: string | null
  status: 'PENDING' | 'ACTIVE' | 'DISABLED'
}

export type RosterImportResult = {
  imported: number
  groupsCreated: number
  warnings: { type: string; message: string }[]
}

export function getRoster(classroomId: string): Promise<{ items: RosterEntry[] }> {
  return apiFetch<{ items: RosterEntry[] }>(
    `/api/classrooms/${encodeURIComponent(classroomId)}/roster`,
  )
}

/** อัปโหลด CSV — ทั้งไฟล์ผ่านหรือไม่บันทึกเลย
 *
 *  ถ้าไฟล์มีแถวผิด จะได้ ApiError ที่ `details` บอกเลขแถวและเหตุผลครบทุกแถว
 *  หน้าจอมีหน้าที่แสดงให้ครบ ไม่ใช่แสดงแค่แถวแรก — คนแก้ไฟล์อยากรู้ทีเดียวจบ
 */
export function importRoster(classroomId: string, file: File): Promise<RosterImportResult> {
  const form = new FormData()
  form.append('file', file)

  return apiFetch<RosterImportResult>(
    `/api/classrooms/${encodeURIComponent(classroomId)}/roster:import`,
    { method: 'POST', body: form },
  )
}

// --- Assignment (US-04, US-05, US-06) ---

export type CriterionSide = 'GROUP' | 'INDIVIDUAL'

export type Criterion = {
  id: string
  side: CriterionSide
  name: string
  weightPct: number
  displayOrder: number
}

export type Assignment = {
  id: string
  classroomId: string
  name: string
  status: 'DRAFT' | 'PUBLISHED' | 'OPEN' | 'CLOSED' | 'FINALIZED' | 'ARCHIVED'
  groupDeadlineUtc: string
  individualDeadlineUtc: string | null
  criteria: Criterion[]
}

export type Feasibility = {
  side: CriterionSide
  requestedCoverage: number
  achievableCoverage: number
  workloadPerEvaluator: number
  totalComparisons: number
  feasible: boolean
  reason: string | null
}

export type PublishResult = {
  assignmentId: string
  status: string
  pairsCreated: number
  pairingSeed: number
}

export function createAssignment(input: {
  classroomId: string
  name: string
  groupMaxScore: number
  individualMaxScore: number
  groupDeadlineUtc: string
  targetCoverage: number
  criteria: { side: CriterionSide; name: string; weightPct: number }[]
}): Promise<Assignment> {
  return apiFetch<Assignment>('/api/assignments', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getFeasibility(assignmentId: string): Promise<{ items: Feasibility[] }> {
  return apiFetch<{ items: Feasibility[] }>(
    `/api/assignments/${encodeURIComponent(assignmentId)}/feasibility`,
  )
}

/** publish แล้วระบบจัดคู่ให้ทั้งหมด — ทำได้ครั้งเดียว ครั้งที่สองจะได้ 409 */
export function publishAssignment(assignmentId: string): Promise<PublishResult> {
  return apiFetch<PublishResult>(
    `/api/assignments/${encodeURIComponent(assignmentId)}:publish`,
    { method: 'POST' },
  )
}

export type AssignmentSummary = {
  id: string
  name: string
  status: Assignment['status']
  groupDeadlineUtc: string
  individualDeadlineUtc: string | null
}

/** งานประเมินทั้งหมดในห้องนี้ — นักศึกษาเห็นเฉพาะที่ไม่ใช่ DRAFT (US-07) */
export function listClassroomAssignments(
  classroomId: string,
): Promise<{ items: AssignmentSummary[] }> {
  return apiFetch<{ items: AssignmentSummary[] }>(
    `/api/classrooms/${encodeURIComponent(classroomId)}/assignments`,
  )
}

// --- รายการที่ต้องประเมิน (US-07) ---

export type EvaluationItem = {
  pairAssignmentId: string
  criterionId: string
  criterionName: string
  leftId: string
  leftLabel: string
  rightId: string
  rightLabel: string
  completed: boolean
  choice: number | null
}

export type MyEvaluations = {
  side: CriterionSide
  opened: boolean
  message: string | null
  deadlineUtc: string | null
  artifactUrl: string | null
  completedCount: number
  totalCount: number
  items: EvaluationItem[]
}

export function getMyEvaluations(
  assignmentId: string,
  side: CriterionSide,
): Promise<MyEvaluations> {
  return apiFetch<MyEvaluations>(
    `/api/assignments/${encodeURIComponent(assignmentId)}/my-evaluations?side=${side}`,
  )
}

// --- บันทึกคำตอบ (US-08) ---

export type SavedComparison = {
  id: string
  pairAssignmentId: string
  choice: number
  status: 'DRAFT' | 'SUBMITTED' | 'EXCLUDED'
  savedAt: string
}

/** autosave — idempotent ฝั่ง server เรียกซ้ำด้วย choice เดิมได้ผลเดิมเสมอ (FR-API-01) */
export function saveComparison(
  pairAssignmentId: string,
  choice: number,
): Promise<SavedComparison> {
  return apiFetch<SavedComparison>(
    `/api/comparisons/${encodeURIComponent(pairAssignmentId)}`,
    { method: 'PUT', body: JSON.stringify({ choice }) },
  )
}

// --- ส่งคำตอบทั้งชุด (US-09) ---

export type SubmissionResult = {
  side: CriterionSide
  submittedCount: number
  submittedAt: string
}

/** ส่งเท่าที่ตอบไว้จริง — server ไม่ปฏิเสธแม้ตอบไม่ครบ (FR-EVAL-05)
 *
 *  สุ่ม Idempotency-Key ใหม่ทุกครั้งที่ "ผู้ใช้ตั้งใจกดส่ง" หนึ่งครั้ง — ถ้ากดซ้ำเพราะ
 *  เครือข่ายค้าง ต้อง reuse key เดิมของการกดครั้งนั้น ไม่ใช่สุ่มใหม่ทุก retry (FR-API-02)
 */
export function submitEvaluations(
  assignmentId: string,
  side: CriterionSide,
  idempotencyKey: string,
): Promise<SubmissionResult> {
  return apiFetch<SubmissionResult>(
    `/api/assignments/${encodeURIComponent(assignmentId)}/submissions`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ side }),
    },
  )
}

// --- สมาชิกฝั่งผู้สอน (US-12) ---

export type InstructorRole = 'CO_TEACHER' | 'TA'

export type AddedMember = {
  memberId: string
  email: string
  role: string
}

/** เพิ่มผู้ร่วมสอนหรือ TA — เฉพาะ OWNER เท่านั้นที่เรียกสำเร็จ
 *
 *  ถ้าอีเมลนั้นยังไม่เคย login ระบบสร้างบัญชีสถานะ PENDING ให้
 *  แล้วจับคู่ให้เองตอนเขา login ครั้งแรก จึงเพิ่มล่วงหน้าได้
 */
export function addMember(
  classroomId: string,
  input: { email: string; role: InstructorRole },
): Promise<AddedMember> {
  return apiFetch<AddedMember>(
    `/api/classrooms/${encodeURIComponent(classroomId)}/members`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

/** ถอดสมาชิกออกจากห้อง — ใช้ memberId ไม่ใช่ userId
 *
 *  คนเดียวกันเป็นสมาชิกได้หลายห้อง แต่ละห้องคนละแถว การอ้างด้วย userId
 *  จึงไม่พอที่จะบอกว่าจะถอดเขาออกจากห้องไหน
 */
export function removeMember(classroomId: string, memberId: string): Promise<void> {
  return apiFetch<void>(
    `/api/classrooms/${encodeURIComponent(classroomId)}/members/${encodeURIComponent(memberId)}`,
    { method: 'DELETE' },
  )
}

// --- คำนวณและประกาศคะแนน (US-13, US-15, US-16) ---

export type RecomputeResult = {
  hasLowConfidenceItems: boolean
  computedAt: string
}

/** คำนวณคะแนนชั่วคราวใหม่ — เรียกได้ตลอดหลัง publish ไม่ต้องรอ deadline */
export function recomputeScores(assignmentId: string): Promise<RecomputeResult> {
  return apiFetch<RecomputeResult>(
    `/api/assignments/${encodeURIComponent(assignmentId)}:recompute`,
    { method: 'POST' },
  )
}

export type FinalizeResult = {
  status: string
  finalizedAt: string
  hadLowConfidenceItems: boolean
}

/** ตัดสินและประกาศคะแนน — เฉพาะ OWNER เรียกได้ ต้องเลย deadline แล้ว
 *
 *  ถ้ามี item ที่ยังผู้ประเมินไม่ถึงเกณฑ์ (LOW_CONFIDENCE) จะถูกปฏิเสธจนกว่าจะส่ง
 *  confirmLowConfidence: true มายืนยันว่ารู้แล้วและต้องการประกาศต่อไป
 */
export function finalizeAssignment(
  assignmentId: string,
  confirmLowConfidence = false,
): Promise<FinalizeResult> {
  return apiFetch<FinalizeResult>(
    `/api/assignments/${encodeURIComponent(assignmentId)}:finalize`,
    { method: 'POST', body: JSON.stringify({ confirmLowConfidence }) },
  )
}

/** เปิดคะแนนที่ finalize แล้วกลับมาแก้ — ต้องระบุเหตุผลเสมอ */
export function reopenAssignment(assignmentId: string, reason: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(
    `/api/assignments/${encodeURIComponent(assignmentId)}:reopen`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  )
}

export type ComputedScoreItem = {
  itemId: string
  side: CriterionSide
  itemLabel: string
  component: string
  flags: string[]
}

export type Scores = {
  isFinal: boolean
  items: ComputedScoreItem[]
}

/** คะแนนที่คำนวณล่าสุดของทุก item ในงาน — เฉพาะอาจารย์เรียกได้ (US-13)
 *
 *  ไม่ใช่คู่กับ getMyScore — endpoint นี้ตอบคะแนนชั่วคราวได้ (isFinal: false) ให้อาจารย์
 *  ตรวจก่อนกด finalize ส่วน getMyScore ของนักศึกษาล็อกไว้ที่ FINALIZED เท่านั้นเสมอ (US-15)
 */
export function getScores(assignmentId: string): Promise<Scores> {
  return apiFetch<Scores>(`/api/assignments/${encodeURIComponent(assignmentId)}/scores`)
}

export type MyScore = {
  finalized: boolean
  message: string | null
  groupComponent: string | null
  individualComponent: string | null
  individualHidden: boolean
  participationRatio: string | null
  participationMultiplier: string | null
  finalScore: string | null
}

/** คะแนนของฉันเอง — เห็นได้ก็ต่อเมื่องานประกาศผลแล้ว (US-10)
 *
 *  ถ้า individualHidden เป็น true แปลว่าจำนวนผู้ประเมินรายบุคคลยังไม่ถึงเกณฑ์
 *  k-anonymity (US-15) — ระบบซ่อนตัวเลขนั้นและ finalScore ที่รวมมันไว้ด้วย
 */
export function getMyScore(assignmentId: string): Promise<MyScore> {
  return apiFetch<MyScore>(`/api/assignments/${encodeURIComponent(assignmentId)}/my-score`)
}
