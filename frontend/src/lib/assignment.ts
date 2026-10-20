import type { Assignment, CriterionSide } from './api'
import { classroomLocalToUtc, classroomUtcToLocal } from './datetime'

/** ค่าที่อาจารย์กรอกในฟอร์มสร้างงานประเมิน — ยังไม่ใช่รูปแบบที่ API รับ
 *
 *  แยกออกมาเป็น logic ล้วนเพื่อให้ทดสอบกฎน้ำหนักและการแปลงเวลาได้โดยไม่ต้อง render
 *  component ทั้งก้อน กฎพวกนี้คือส่วนที่พังแล้วเจ็บ ไม่ใช่ส่วนที่หน้าตาเพี้ยน
 */
export type AssignmentDraft = {
  name: string
  /** ค่าดิบจาก <input type="datetime-local"> — เวลาท้องถิ่นที่ไม่มี timezone ติดมา */
  deadline: string
  targetCoverage: number
  individualMaxScore: number
  groupWeight: number
  individualWeight: number
  description?: string
  artifactUrl?: string
  groupArtifactUrls?: Record<string, string>
  groupMaxScore?: number
  groupCriteria?: CriterionDraft[]
  individualCriteria?: CriterionDraft[]
  /** undefined = ใช้กำหนดส่งเดียวกับฝั่งกลุ่ม · string (แม้ว่าง) = ตั้งแยก
   *  โหมดต้องดูจาก undefined ไม่ใช่ค่าว่าง — ไม่งั้นเอาติ๊กออกตอนฝั่งกลุ่มยังว่างแล้วจะเด้งกลับ */
  individualDeadline?: string
  instructorWeight?: number
  minComparisons?: number
  scoreFloor?: number
  scoreCeiling?: number
  completionThreshold?: number
  opensAt?: string
  maxWorkload?: number
}

export type CriterionDraft = { name: string; weightPct: number; question?: string }

export function draftCriteria(draft: AssignmentDraft, side: CriterionSide): CriterionDraft[] {
  return side === 'GROUP'
    ? draft.groupCriteria ?? [{ name: 'คุณภาพงาน', weightPct: draft.groupWeight }]
    : draft.individualCriteria ?? [{ name: 'การมีส่วนร่วม', weightPct: draft.individualWeight }]
}

export const DEFAULT_DRAFT: AssignmentDraft = {
  name: 'งานกลุ่มครั้งที่ 1',
  deadline: '',
  targetCoverage: 5,
  individualMaxScore: 5,
  groupWeight: 100,
  individualWeight: 100,
}

/** คะแนนเต็มฝั่งกลุ่มเป็น 0 = ปิดฝั่งกลุ่ม (GAP-11) — ห้อง 2 กลุ่มไม่มีผู้มีสิทธิ์ประเมินฝั่งกลุ่มเลย */
export function groupEnabled(draft: AssignmentDraft): boolean {
  return (draft.groupMaxScore ?? 15) > 0
}

/** คะแนนเต็มรายบุคคลเป็น 0 = ปิดการประเมินฝั่งบุคคลทั้งฝั่ง ไม่ใช่แค่ให้คะแนนเต็ม 0 */
export function individualEnabled(draft: AssignmentDraft): boolean {
  return draft.individualMaxScore > 0
}

export function sameDeadline(draft: AssignmentDraft): boolean {
  return draft.individualDeadline === undefined
}

/** สลับโหมดกำหนดส่งรายบุคคล — ตั้งแยกครั้งแรกเริ่มจากวันเดียวกับฝั่งกลุ่มให้แก้ต่อได้เลย */
export function withSameDeadline(draft: AssignmentDraft, same: boolean): AssignmentDraft {
  return { ...draft, individualDeadline: same ? undefined : (draft.individualDeadline ?? draft.deadline) }
}

export type WeightCheck = {
  side: CriterionSide
  label: string
  total: number
  ok: boolean
  /** ข้อความบอกว่าขาดหรือเกินเท่าไร — null เมื่อครบ 100% พอดี */
  message: string | null
}

/** น้ำหนักต้องรวมได้ 100% **แยกกันในแต่ละฝั่ง** ไม่ใช่รวมกันทั้งสองฝั่งเป็น 100
 *
 *  นี่เป็นกฎของ backend ไม่ใช่ของหน้าจอ — ตอน publish server จะตอบ 422
 *  พร้อมข้อความว่า "ขาดอีก N%" ถ้าฝั่งไหนไม่ครบ (เห็นได้จาก e2e/specs/assignments.spec.ts)
 *  หน้าจอจึงเตือนล่วงหน้าด้วยกฎเดียวกัน แต่ไม่ปิดปุ่มสร้าง เพราะ DRAFT ที่น้ำหนัก
 *  ยังไม่ครบเป็นสิ่งที่ API ยอมรับ — อาจารย์อาจสร้างค้างไว้แล้วกลับมาแก้ทีหลัง
 */
export function weightChecks(draft: AssignmentDraft): WeightCheck[] {
  const groupTotal = draftCriteria(draft, 'GROUP').reduce((sum, c) => sum + c.weightPct, 0)
  const individualTotal = draftCriteria(draft, 'INDIVIDUAL').reduce((sum, c) => sum + c.weightPct, 0)
  const describe = (total: number): string | null => {
    if (total === 100) return null
    return total < 100 ? `ขาดอีก ${100 - total}%` : `เกินมา ${total - 100}%`
  }

  const checks: WeightCheck[] = []

  if (groupEnabled(draft)) {
    checks.push({
      side: 'GROUP',
      label: 'ฝั่งกลุ่ม',
      total: groupTotal,
      ok: Math.abs(groupTotal - 100) <= 0.01,
      message: describe(groupTotal),
    })
  }

  if (individualEnabled(draft)) {
    checks.push({
      side: 'INDIVIDUAL',
      label: 'ฝั่งบุคคล',
      total: individualTotal,
      ok: Math.abs(individualTotal - 100) <= 0.01,
      message: describe(individualTotal),
    })
  }

  return checks
}

/** พร้อมกดสร้างหรือยัง — ถ้ายัง ต้องบอกได้ว่าเพราะอะไร ไม่ใช่แค่ปิดปุ่มเงียบ ๆ */
export function draftBlocker(draft: AssignmentDraft, studentCount: number): string | null {
  if (studentCount === 0) return 'ยังไม่มีนักศึกษาในห้อง'
  if (!draft.name.trim()) return 'ยังไม่ได้ตั้งชื่องาน'
  if (!draft.deadline) return 'ยังไม่ได้ระบุกำหนดส่ง'
  if (individualEnabled(draft) && draft.individualDeadline === '') return 'ยังไม่ได้ระบุกำหนดส่งรายบุคคล'
  if (draft.opensAt !== undefined && !draft.opensAt) return 'ยังไม่ได้ระบุวันและเวลาเปิดรับ'
  if ((draft.scoreFloor ?? 0.6) >= (draft.scoreCeiling ?? 1)) return 'คะแนนขั้นต่ำต้องน้อยกว่าคะแนนขั้นสูง'
  if (!groupEnabled(draft) && !individualEnabled(draft)) return 'ต้องเปิดการประเมินอย่างน้อย 1 ฝั่ง (คะแนนเต็มมากกว่า 0)'
  const criteria = [...(groupEnabled(draft) ? draftCriteria(draft, 'GROUP') : []), ...(individualEnabled(draft) ? draftCriteria(draft, 'INDIVIDUAL') : [])]
  if (!criteria.length || criteria.some((c) => !c.name.trim())) return 'กรุณาระบุชื่อเกณฑ์ทุกข้อ'
  if (criteria.some((c) => !Number.isFinite(c.weightPct) || c.weightPct < 0 || c.weightPct > 100)) return 'น้ำหนักเกณฑ์ต้องอยู่ระหว่าง 0 ถึง 100'
  if (draft.artifactUrl && !/^https?:\/\//i.test(draft.artifactUrl)) return 'ลิงก์ผลงานต้องขึ้นต้นด้วย https:// หรือ http://'
  if (Object.values(draft.groupArtifactUrls ?? {}).some((url) => url && !/^https?:\/\//i.test(url))) return 'ลิงก์ผลงานต้องขึ้นต้นด้วย https:// หรือ http://'
  return null
}

/** แปลง draft เป็น body ของ POST /api/assignments
 *
 *  input type="datetime-local" ให้เวลาท้องถิ่นที่ไม่มี timezone — ถ้าส่งดิบ ๆ
 *  backend จะตีความเป็น UTC แล้ว deadline จะเพี้ยนไปตามเขตเวลาของเครื่องผู้ใช้
 */
export function toCreateInput(draft: AssignmentDraft, classroomId: string, timezone?: string) {
  const individual = individualEnabled(draft)
  const group = groupEnabled(draft)

  return {
    classroomId,
    name: draft.name.trim(),
    groupMaxScore: draft.groupMaxScore ?? 15,
    description: draft.description?.trim() || null,
    artifactUrl: draft.artifactUrl?.trim() || null,
    groupArtifactUrls: Object.fromEntries(Object.entries(draft.groupArtifactUrls ?? {}).filter(([, url]) => url.trim()).map(([name, url]) => [name, url.trim()])),
    individualMaxScore: draft.individualMaxScore,
    groupDeadlineUtc: timezone
      ? classroomLocalToUtc(draft.deadline, timezone)
      : new Date(draft.deadline).toISOString(),
    targetCoverage: draft.targetCoverage,
    maxWorkload: draft.maxWorkload ?? 8,
    individualDeadlineUtc: individual ? (timezone ? classroomLocalToUtc(draft.individualDeadline || draft.deadline, timezone) : new Date(draft.individualDeadline || draft.deadline).toISOString()) : null,
    instructorWeight: draft.instructorWeight ?? 1,
    minComparisons: draft.minComparisons ?? 3,
    scoreFloor: draft.scoreFloor ?? 0.6,
    scoreCeiling: draft.scoreCeiling ?? 1,
    completionThreshold: draft.completionThreshold ?? 0.9,
    opensAtUtc: draft.opensAt ? (timezone ? classroomLocalToUtc(draft.opensAt, timezone) : new Date(draft.opensAt).toISOString()) : null,
    criteria: [
      ...(group ? draftCriteria(draft, 'GROUP') : []).map((c, displayOrder) => ({ ...c, name: c.name.trim(), side: 'GROUP' as CriterionSide, displayOrder })),
      ...(individual ? draftCriteria(draft, 'INDIVIDUAL').map((c, displayOrder) => ({ ...c, name: c.name.trim(), side: 'INDIVIDUAL' as CriterionSide, displayOrder })) : []),
    ],
  }
}

export function assignmentToDraft(value: Assignment, timezone: string): AssignmentDraft {
  const criteria = (side: CriterionSide) => value.criteria.filter((criterion) => criterion.side === side).map((criterion) => ({ name: criterion.name, weightPct: Number(criterion.weightPct), question: criterion.question ?? '' }))
  return {
    name: value.name,
    deadline: classroomUtcToLocal(value.groupDeadlineUtc, timezone),
    // API เก็บวันเดียวกันซ้ำไว้ทั้งสองช่อง — ถ้าเท่ากันคือโหมด "ใช้เดียวกัน" ไม่ใช่ตั้งแยก
    individualDeadline:
      value.individualDeadlineUtc && value.individualDeadlineUtc !== value.groupDeadlineUtc
        ? classroomUtcToLocal(value.individualDeadlineUtc, timezone)
        : undefined,
    opensAt: value.opensAtUtc ? classroomUtcToLocal(value.opensAtUtc, timezone) : undefined,
    description: value.description ?? '', artifactUrl: value.artifactUrl ?? '', groupArtifactUrls: value.groupArtifactUrls,
    groupMaxScore: Number(value.groupMaxScore), individualMaxScore: Number(value.individualMaxScore),
    targetCoverage: value.targetCoverage, maxWorkload: value.maxWorkload,
    groupWeight: 100, individualWeight: 100,
    groupCriteria: criteria('GROUP'), individualCriteria: criteria('INDIVIDUAL'),
    instructorWeight: Number(value.instructorWeight), minComparisons: value.minComparisons,
    scoreFloor: Number(value.scoreFloor), scoreCeiling: Number(value.scoreCeiling), completionThreshold: Number(value.completionThreshold),
  }
}
