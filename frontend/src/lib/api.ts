import { useEffect, useState } from 'react'

import { clearToken, getToken, renewToken } from './session'

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

  // FR-AUTH-04 — server ต่ออายุ session ให้เมื่อใกล้หมด (ไม่ทับถ้าระหว่างนั้นผู้ใช้ออก/เปลี่ยนบัญชีแล้ว)
  const renewed = res.headers.get('x-session-token')
  if (renewed && token && token === getToken()) renewToken(renewed)

  if (res.ok) {
    return (res.status === 204 ? undefined : await res.json()) as T
  }

  // 401 หมายถึง session ใช้ไม่ได้แล้ว — guard ต้องปิดหน้าภายในทันที
  if (res.status === 401 && token === getToken()) clearToken()

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
  /** STUDENT = ส่วนหน้า @ เป็นตัวเลขล้วน สร้างห้องเรียนไม่ได้ · INSTRUCTOR = แบบอื่นทั้งหมด */
  accountType?: 'STUDENT' | 'INSTRUCTOR'
  classrooms: { classroomId: string; classroomName: string; role: string }[]
  /** null = ยังไม่เคยกดรับทราบประกาศความเป็นส่วนตัว (Figma ST03) */
  privacyAcknowledgedAt?: string | null
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

export function acknowledgePrivacy(): Promise<{ privacyAcknowledgedAt: string }> {
  return apiFetch('/api/me/privacy-ack', { method: 'POST' })
}

export type DataCopyRequest = {
  id: number
  requestedAt: string
  status: 'IN_PROGRESS' | 'SENT'
  /** FR-PRIV-03 — กำหนดส่งสำเนา 30 วันนับจากรับคำขอ */
  dueAt: string
  fulfilledAt?: string | null
  overdue?: boolean
}
export function listDataRequests(): Promise<{ items: DataCopyRequest[] }> {
  return apiFetch('/api/me/data-requests')
}
export function createDataRequest(): Promise<DataCopyRequest> {
  return apiFetch('/api/me/data-requests', { method: 'POST' })
}
/** GAP-02 — ดาวน์โหลดสำเนาข้อมูลของตัวเอง (JSON) · server ปิดคำขอที่ค้างเป็น SENT ให้ */
export function downloadDataCopy(): Promise<void> {
  return downloadCsv('/api/me/data-copy', { method: 'GET' }, 'paireval-my-data.json')
}

export type Notification = { id: string; title: string; message: string; href: string; occurredAt: string; read: boolean }
export function listNotifications(): Promise<{ items: Notification[]; unreadCount: number }> {
  return apiFetch('/api/notifications')
}
export function readNotification(id: string): Promise<void> {
  return apiFetch(`/api/notifications/${encodeURIComponent(id)}:read`, { method: 'POST' })
}

// --- Classroom (US-02) ---

export type Classroom = {
  id: string
  name: string
  slug: string
  timezone: string
  allowedEmailDomains: string[]
  status: string
  courseCode?: string | null
  semester?: string | null
  instructorName?: string | null
  groupName?: string | null
  studentCount?: number
  groupCount?: number
  assignmentCount?: number
  pendingAssignmentCount?: number
  openAssignmentCount?: number
  openSubmittedStudents?: number
  openAppealCount?: number
  finalizedAssignmentCount?: number
  nextDeadlineUtc?: string | null
  archivedAt?: string | null
}

export type ClassroomDetails = { name: string; timezone: string; courseCode?: string | null; semester?: string | null }
export function updateClassroom(id: string, body: ClassroomDetails): Promise<Classroom> {
  return apiFetch(`/api/classrooms/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function listClassrooms(): Promise<{ items: Classroom[] }> {
  return apiFetch<{ items: Classroom[] }>('/api/classrooms')
}

export function archiveClassroom(id: string, archived: boolean): Promise<Classroom> {
  return apiFetch(`/api/classrooms/${encodeURIComponent(id)}:${archived ? 'archive' : 'restore'}`, { method: 'POST' })
}
export function deleteClassroom(id: string): Promise<void> {
  return apiFetch(`/api/classrooms/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function createClassroom(input: {
  name: string
  timezone: string
  allowedEmailDomains?: string[]
  courseCode?: string
  semester?: string
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
  enrollmentStatus?: 'ACTIVE' | 'WITHDRAWN'
}

export const changeEnrollment = (classroomId: string, memberId: string, withdrawn: boolean, reason: string) => apiFetch<{ enrollmentStatus: 'ACTIVE' | 'WITHDRAWN'; repairs: { assignmentId: string; generation: number; pairsAdded: number; warnings: string[] }[] }>(`/api/classrooms/${encodeURIComponent(classroomId)}/members/${encodeURIComponent(memberId)}/enrollment`, { method: 'PATCH', body: JSON.stringify({ withdrawn, reason }) })

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
  question?: string | null
}

export type Assignment = {
  id: string
  classroomId: string
  name: string
  status: 'DRAFT' | 'PUBLISHED' | 'OPEN' | 'CLOSED' | 'FINALIZED' | 'ARCHIVED'
  groupDeadlineUtc: string
  individualDeadlineUtc: string | null
  criteria: Criterion[]
  opensAtUtc?: string | null
  description?: string | null
  artifactUrl?: string | null
  groupArtifactUrls?: Record<string, string>
  groupMaxScore: string | number
  individualMaxScore: string | number
  targetCoverage: number
  maxWorkload: number
  instructorWeight: string | number
  minComparisons: number
  scoreFloor: string | number
  scoreCeiling: string | number
  completionThreshold: string | number
}

export const getAssignment = (id: string) => apiFetch<Assignment>(`/api/assignments/${encodeURIComponent(id)}`)
export const updateAssignment = (id: string, input: Parameters<typeof createAssignment>[0]) => apiFetch<Assignment>(`/api/assignments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) })
export const extendDeadline = (id: string, input: { groupDeadlineUtc: string; individualDeadlineUtc: string | null; reason: string }) => apiFetch<Assignment>(`/api/assignments/${encodeURIComponent(id)}:extend-deadline`, { method: 'POST', body: JSON.stringify(input) })
export const copyAssignment = (id: string, input: { name: string; groupDeadlineUtc: string; individualDeadlineUtc: string | null }) => apiFetch<Assignment>(`/api/assignments/${encodeURIComponent(id)}:copy`, { method: 'POST', body: JSON.stringify(input) })
export const unpublishImpact = (id: string) => apiFetch<{ submittedEvaluators: number; submittedComparisons: number; assignedComparisons: number }>(`/api/assignments/${encodeURIComponent(id)}/unpublish-impact`)
export const unpublishAssignment = (id: string, reason: string) => apiFetch<Assignment>(`/api/assignments/${encodeURIComponent(id)}:unpublish`, { method: 'POST', body: JSON.stringify({ reason, confirmInvalidate: true }) })

export type Feasibility = {
  side: CriterionSide
  requestedCoverage: number
  achievableCoverage: number
  workloadPerEvaluator: number
  totalComparisons: number
  feasible: boolean
  reason: string | null
  /** เฉพาะฝั่ง INDIVIDUAL — มีกลุ่มที่คะแนนรายบุคคลจะถูกซ่อนโดย k-anonymity ตลอดไป (US-15) */
  lowAnonymityNote: string | null
  /** FR-PAIR-15 — เฉพาะฝั่ง INDIVIDUAL · มีกลุ่มขนาดนอกช่วงแนะนำ 4–7 คน */
  groupSizeNote?: string | null
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
  opensAtUtc?: string | null
  id: string
  name: string
  status: Assignment['status']
  groupDeadlineUtc: string
  individualDeadlineUtc: string | null
  assignedCount?: number
  answeredCount?: number
  submittedCount?: number
  submittedAt?: string | null
  publishedAt?: string | null
  finalizedAt?: string | null
  /** Figma J24 — วันที่ระบบจะประกาศผลให้อัตโนมัติ (null เมื่อเคยประกาศแล้วหรือยังไม่เผยแพร่) */
  autoFinalizeAt?: string | null
  submittedStudents?: number | null
  studentCount?: number | null
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
  leftArtifactUrl?: string | null
  rightArtifactUrl?: string | null
  pairAssignmentId: string
  criterionId: string
  criterionName: string
  leftId: string
  leftLabel: string
  rightId: string
  rightLabel: string
  completed: boolean
  choice: number | null
  weightPct?: string | number
  question?: string | null
}

export type MyEvaluations = {
  opensAtUtc?: string | null
  readOnly?: boolean
  assignmentName?: string
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
    timeOnTaskMs?: number,
): Promise<SavedComparison> {
  return apiFetch<SavedComparison>(
    `/api/comparisons/${encodeURIComponent(pairAssignmentId)}`,
      { method: 'PUT', body: JSON.stringify({ choice, timeOnTaskMs }) },
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

export type CriterionScore = {
  criterionId: string
  name: string
  weightPct: string
  q: string | null
  comparisonCount: number
  score: string
  maxScore: string
  flags: string[]
}

export type ComputedScoreItem = {
  itemId: string
  side: CriterionSide
  itemLabel: string
  component: string
  flags: string[]
  /** Figma J25 — คะแนนรายเกณฑ์ของ item นี้ */
  criteria?: CriterionScore[]
  /** มีการแก้คะแนนด้วยมือที่ยังมีผล (Figma J31 ป้าย "แก้โดยอาจารย์") */
  overridden?: boolean
}

export type Scores = {
  isFinal: boolean
  items: ComputedScoreItem[]
  formulaVersion?: string | null
  /** เวลาคำนวณของชุดล่าสุด — Figma J25 "คำนวณล่าสุด 02:00 น." */
  computedAt?: string | null
  /** FR-REPORT-02 Individual Summary — ตัวเลขชุดเดียวกับ /my-score ของนักศึกษาแต่ละคน */
  students?: StudentScore[]
}

export type StudentScore = {
  userId: string
  label: string
  email: string
  groupLabel: string | null
  groupComponent: string
  individualComponent: string
  individualHiddenFromStudent: boolean
  submittedCount: number
  assignedCount: number
  participationRatio: string
  participationMultiplier: string
  finalScore: string
  maxScore: string
}

/** คะแนนที่คำนวณล่าสุดของทุก item ในงาน — เฉพาะอาจารย์เรียกได้ (US-13)
 *
 *  ไม่ใช่คู่กับ getMyScore — endpoint นี้ตอบคะแนนชั่วคราวได้ (isFinal: false) ให้อาจารย์
 *  ตรวจก่อนกด finalize ส่วน getMyScore ของนักศึกษาล็อกไว้ที่ FINALIZED เท่านั้นเสมอ (US-15)
 */
export function getScores(assignmentId: string): Promise<Scores> {
  return apiFetch<Scores>(`/api/assignments/${encodeURIComponent(assignmentId)}/scores`)
}

export function createScoreOverride(
  assignmentId: string,
  input: { side: 'GROUP' | 'INDIVIDUAL'; itemId: string; overrideValue: string; reason: string },
): Promise<{ id: string; originalValue: string; overrideValue: string }> {
  return apiFetch(`/api/assignments/${encodeURIComponent(assignmentId)}/score-overrides`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

// --- export raw comparison (US-15, FR-EXPORT-03/04) ---

/** ดาวน์โหลดไฟล์แล้วสั่งเซฟเลย — เบราว์เซอร์เป็นคนจัดการ ไม่ผ่าน apiFetch เพราะนี่ไม่ใช่ JSON */
async function downloadCsv(path: string, init: RequestInit, filenameFallback: string) {
  const token = getToken()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) {
    if (res.status === 401 && token === getToken()) clearToken()
    let message = `เกิดข้อผิดพลาด (HTTP ${res.status})`
    try {
      const body = (await res.json()) as Partial<ApiErrorBody>
      if (body.error) message = body.error.message
    } catch {
      // ไม่ใช่ JSON — ใช้ข้อความ default
    }
    throw new ApiError(res.status, 'EXPORT_FAILED', message)
  }

  const disposition = res.headers.get('content-disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const filename = match?.[1] ?? filenameFallback

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** export ปกติ — ผู้ประเมินแสดงเป็นรหัส E1, E2, ... ไม่ใช่ตัวตนจริง (ค่าเริ่มต้นตาม FR-EXPORT-03) */
export function exportComparisons(assignmentId: string): Promise<void> {
  return downloadCsv(
    `/api/assignments/${encodeURIComponent(assignmentId)}/comparisons:export`,
    { method: 'GET' },
    `comparisons_${assignmentId}.csv`,
  )
}

/** export พร้อมอีเมลจริงของผู้ประเมิน — เฉพาะ OWNER ต้องระบุเหตุผล ถูกบันทึก audit เสมอ (FR-EXPORT-04) */
export function exportComparisonsIdentified(assignmentId: string, reason: string): Promise<void> {
  return downloadCsv(
    `/api/assignments/${encodeURIComponent(assignmentId)}/comparisons:export-identified`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason }) },
    `comparisons_identified_${assignmentId}.csv`,
  )
}

// --- ส่งออกรายงาน (Figma J36) และประวัติ (Figma S10) ---
export type ExportReport = 'GROUP' | 'INDIVIDUAL' | 'PAIR_COVERAGE' | 'METADATA' | 'RAW_COMPARISONS'
export type ExportOptions = { reports: ExportReport[]; format: 'XLSX' | 'CSV'; identity: 'PSEUDONYM' | 'EMAIL'; reason?: string }
export type ExportLog = { createdAt: string; format: 'XLSX' | 'CSV'; reports: ExportReport[]; identified: boolean; actorName: string; actorRole: string }

export function exportReports(assignmentId: string, options: ExportOptions): Promise<void> {
  return downloadCsv(
    `/api/assignments/${encodeURIComponent(assignmentId)}/reports:export`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(options) },
    `reports_${assignmentId}.${options.format === 'XLSX' ? 'xlsx' : 'csv'}`,
  )
}

export const getExportHistory = (assignmentId: string, limit = 10) =>
  apiFetch<{ items: ExportLog[] }>(`/api/assignments/${encodeURIComponent(assignmentId)}/exports?limit=${limit}`)

export type MyScore = {
  groupOverridden?: boolean
  individualOverridden?: boolean
  assignmentName?: string | null
  groupMaxScore?: string | number | null
  individualMaxScore?: string | number | null
  finalizedAt?: string | null
  submittedCount?: number | null
  assignedCount?: number | null
  criterionScores?: { id: string; side: CriterionSide; name: string; weightPct: string | number; score: string | number; maxScore: string | number }[]
  finalized: boolean
  message: string | null
  groupComponent: string | null
  individualComponent: string | null
  individualHidden: boolean
  participationRatio: string | null
  participationMultiplier: string | null
  finalScore: string | null
  /** Figma ST31 — คะแนนชั่วคราวก่อนประกาศผล */
  provisional?: boolean
  individualEvaluatorCount?: number | null
  minComparisons?: number | null
}

/** คะแนนของฉันเอง — เห็นได้ก็ต่อเมื่องานประกาศผลแล้ว (US-10)
 *
 *  ถ้า individualHidden เป็น true แปลว่าจำนวนผู้ประเมินรายบุคคลยังไม่ถึงเกณฑ์
 *  k-anonymity (US-15) — ระบบซ่อนตัวเลขนั้นและ finalScore ที่รวมมันไว้ด้วย
 */
export function getMyScore(assignmentId: string): Promise<MyScore> {
  return apiFetch<MyScore>(`/api/assignments/${encodeURIComponent(assignmentId)}/my-score`)
}

export type Appeal = {
  id: string; assignmentId: string; assignmentName: string; studentName: string
  studentEmail?: string; groupName?: string | null
  message: string; status: 'OPEN' | 'RESOLVED' | 'REJECTED'; resolution: string | null
  createdAt: string; resolvedAt: string | null
}

/** FR-CLASS-05 (GAP-12) — สิ่งที่จะเปลี่ยนเมื่อยืนยัน เทียบกับรายชื่อนักศึกษาปัจจุบัน */
export type RosterDiff = {
  added: string[]
  moved: { email: string; fromGroup: string | null; toGroup: string }[]
  unchanged: string[]
  removed: string[]
}
export type RosterPreview = RosterImportResult & {
  rows: { email: string; displayName: string | null; groupName: string }[]
  diff: RosterDiff
}
export function previewRoster(classroomId: string, file: File): Promise<RosterPreview> {
  const body = new FormData()
  body.append('file', file)
  return apiFetch<RosterPreview>(`/api/classrooms/${encodeURIComponent(classroomId)}/roster:preview`, { method: 'POST', body })
}
export const listAppeals = (classroomId: string) => apiFetch<{ items: Appeal[] }>(`/api/classrooms/${encodeURIComponent(classroomId)}/appeals`)
export const createAppeal = (assignmentId: string, message: string) => apiFetch<Appeal>(`/api/assignments/${encodeURIComponent(assignmentId)}/appeals`, { method: 'POST', body: JSON.stringify({ message }) })
export const resolveAppeal = (classroomId: string, appealId: string, status: 'RESOLVED' | 'REJECTED', resolution: string) => apiFetch<Appeal>(`/api/classrooms/${encodeURIComponent(classroomId)}/appeals/${encodeURIComponent(appealId)}:resolve`, { method: 'POST', body: JSON.stringify({ status, resolution }) })

export type AuditRecord = { id: string; actorEmail: string; actorName?: string | null; action: string; resourceType: string; resourceId: string | null; beforeState: Record<string, unknown> | null; afterState: Record<string, unknown> | null; reason: string | null; occurredAt: string }
export const getAudit = (classroomId: string) => apiFetch<{ items: AuditRecord[] }>(`/api/classrooms/${encodeURIComponent(classroomId)}/audit`)
export type Reviewer = { key: string; label: string; excluded: boolean; reviewedAt: string | null; assignedCount: number; submittedCount: number; flags: string[]; unassessed: string[]; meanTimeMs: number | null; timedCount: number; checkedTriples: number; cycles: number; favoritismGapPct?: number; answers: { criterionName: string; side: CriterionSide; leftLabel: string; rightLabel: string; choice: number; timeOnTaskMs: number | null; status: string }[] }
export type CoveragePair = { criterionId: string; criterionName: string; side: CriterionSide; itemAId: string; itemBId: string; itemALabel: string; itemBLabel: string; artifactAUrl: string | null; artifactBUrl: string | null; assignedCount: number; submittedCount: number; expectedCount: number; eligibleCount: number; instructorCount: number; pendingCount: number; meanScoreA: number | null }
export type PairSelection = { criterionId: string; itemAId: string; itemBId: string; reason: string }
export const assignAdditional = (assignmentId: string, input: PairSelection & { count: number }) => apiFetch<{ pairsAdded: number }>(`/api/assignments/${encodeURIComponent(assignmentId)}/additional-evaluations`, { method: 'POST', body: JSON.stringify(input) })
export const submitInstructorComparison = (assignmentId: string, input: PairSelection & { choice: number; timeOnTaskMs?: number }) => apiFetch<{ pairsAdded: number }>(`/api/assignments/${encodeURIComponent(assignmentId)}/instructor-comparisons`, { method: 'POST', body: JSON.stringify(input) })
/** Figma J28 แถว QS-07 / J28c — ความสอดคล้อง (Kendall's u) และการกระจายคำตอบ 6 ระดับต่อเกณฑ์ */
export type CriterionAgreement = { criterionId: string; name: string; side: CriterionSide; weightPct: number; instructorAnswers: number; distribution: number[]; answerCount: number; pairsChecked: number; agreement: number | null; flags: string[] }
export type QualityReport = { pairCoverage: CoveragePair[]; evaluators: Reviewer[]; criteria?: CriterionAgreement[]; favoritismAssessed?: boolean; coverage: { itemId: string; side: CriterionSide; criterionId: string; criterionName: string; itemLabel: string; assignedCount: number; submittedCount: number; minimum: number; flags: string[] }[]; limitations: string[] }
export const getQuality = (assignmentId: string) => apiFetch<QualityReport>(`/api/assignments/${encodeURIComponent(assignmentId)}/quality`)
export const revealReviewer = (assignmentId: string, key: string, reason: string) => apiFetch<{ displayName: string | null; email: string }>(`/api/assignments/${encodeURIComponent(assignmentId)}/quality/${encodeURIComponent(key)}:identity`, { method: 'POST', body: JSON.stringify({ reason }) })
export const setReviewerExclusion = (assignmentId: string, key: string, excluded: boolean, reason: string) => apiFetch<{ excluded: boolean; computedAt: string }>(`/api/assignments/${encodeURIComponent(assignmentId)}/quality/${encodeURIComponent(key)}:exclusion`, { method: 'POST', body: JSON.stringify({ excluded, reason }) })
/** Figma J28 "ดูแล้ว · เก็บไว้" — บันทึกว่าผู้สอนเปิดดูคำตอบแล้ว (ครั้งแรกเท่านั้น) */
export const markReviewerReviewed = (assignmentId: string, key: string) => apiFetch<{ reviewedAt: string }>(`/api/assignments/${encodeURIComponent(assignmentId)}/quality/${encodeURIComponent(key)}:reviewed`, { method: 'POST' })
export const changeMemberRole = (classroomId: string, memberId: string, role: InstructorRole, reason: string) => apiFetch(`/api/classrooms/${encodeURIComponent(classroomId)}/members/${encodeURIComponent(memberId)}`, { method: 'PATCH', body: JSON.stringify({ role, reason }) })

export type MyGroupArtifact = { groupName: string | null; url: string | null; assignmentName: string | null }
export function getMyGroupArtifact(classroomId: string): Promise<MyGroupArtifact> {
  return apiFetch(`/api/classrooms/${encodeURIComponent(classroomId)}/my-group-artifact`)
}
