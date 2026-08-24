import type { CriterionSide } from './api'
import { classroomLocalToUtc } from './datetime'

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
}

export const DEFAULT_DRAFT: AssignmentDraft = {
  name: 'งานกลุ่มครั้งที่ 1',
  deadline: '',
  targetCoverage: 5,
  individualMaxScore: 5,
  groupWeight: 100,
  individualWeight: 100,
}

/** คะแนนเต็มรายบุคคลเป็น 0 = ปิดการประเมินฝั่งบุคคลทั้งฝั่ง ไม่ใช่แค่ให้คะแนนเต็ม 0 */
export function individualEnabled(draft: AssignmentDraft): boolean {
  return draft.individualMaxScore > 0
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
  const describe = (total: number): string | null => {
    if (total === 100) return null
    return total < 100 ? `ขาดอีก ${100 - total}%` : `เกินมา ${total - 100}%`
  }

  const checks: WeightCheck[] = [
    {
      side: 'GROUP',
      label: 'ฝั่งกลุ่ม',
      total: draft.groupWeight,
      ok: draft.groupWeight === 100,
      message: describe(draft.groupWeight),
    },
  ]

  if (individualEnabled(draft)) {
    checks.push({
      side: 'INDIVIDUAL',
      label: 'ฝั่งบุคคล',
      total: draft.individualWeight,
      ok: draft.individualWeight === 100,
      message: describe(draft.individualWeight),
    })
  }

  return checks
}

/** พร้อมกดสร้างหรือยัง — ถ้ายัง ต้องบอกได้ว่าเพราะอะไร ไม่ใช่แค่ปิดปุ่มเงียบ ๆ */
export function draftBlocker(draft: AssignmentDraft, studentCount: number): string | null {
  if (studentCount === 0) return 'ยังไม่มีนักศึกษาในห้อง'
  if (!draft.name.trim()) return 'ยังไม่ได้ตั้งชื่องาน'
  if (!draft.deadline) return 'ยังไม่ได้ระบุกำหนดส่ง'
  return null
}

/** แปลง draft เป็น body ของ POST /api/assignments
 *
 *  input type="datetime-local" ให้เวลาท้องถิ่นที่ไม่มี timezone — ถ้าส่งดิบ ๆ
 *  backend จะตีความเป็น UTC แล้ว deadline จะเพี้ยนไปตามเขตเวลาของเครื่องผู้ใช้
 */
export function toCreateInput(draft: AssignmentDraft, classroomId: string, timezone?: string) {
  const individual = individualEnabled(draft)

  return {
    classroomId,
    name: draft.name.trim(),
    groupMaxScore: 15,
    individualMaxScore: draft.individualMaxScore,
    groupDeadlineUtc: timezone
      ? classroomLocalToUtc(draft.deadline, timezone)
      : new Date(draft.deadline).toISOString(),
    targetCoverage: draft.targetCoverage,
    criteria: [
      { side: 'GROUP' as CriterionSide, name: 'คุณภาพงาน', weightPct: draft.groupWeight },
      ...(individual
        ? [
            {
              side: 'INDIVIDUAL' as CriterionSide,
              name: 'การมีส่วนร่วม',
              weightPct: draft.individualWeight,
            },
          ]
        : []),
    ],
  }
}
