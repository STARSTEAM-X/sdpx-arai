import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DRAFT,
  type AssignmentDraft,
  draftBlocker,
  individualEnabled,
  toCreateInput,
  weightChecks,
} from './assignment'

const draft = (over: Partial<AssignmentDraft> = {}): AssignmentDraft => ({
  ...DEFAULT_DRAFT,
  deadline: '2027-01-31T23:59',
  ...over,
})

/* กฎที่ test ชุดนี้ปกป้อง มาจากสัญญาของ API ไม่ใช่จากความชอบของหน้าจอ
   ถ้าใครเผลอเปลี่ยนเป็น "น้ำหนักสองฝั่งรวมกัน 100" หน้าจอจะยอมให้กด publish
   ด้วยค่าที่ server ตอบ 422 เสมอ — test ต้องแดงก่อนที่ผู้ใช้จะเจอ */

describe('น้ำหนักเกณฑ์', () => {
  it('แต่ละฝั่งต้องครบ 100% แยกกัน ไม่ใช่รวมกันสองฝั่ง', () => {
    const checks = weightChecks(draft({ groupWeight: 60, individualWeight: 40 }))

    expect(checks.map((c) => c.ok)).toEqual([false, false])
  })

  it('100/100 ผ่านทั้งสองฝั่ง', () => {
    const checks = weightChecks(draft({ groupWeight: 100, individualWeight: 100 }))

    expect(checks.every((c) => c.ok)).toBe(true)
    expect(checks.every((c) => c.message === null)).toBe(true)
  })

  it('บอกเป็นตัวเลขว่าขาดหรือเกินเท่าไร ไม่ใช่แค่ว่าผิด', () => {
    const [group] = weightChecks(draft({ groupWeight: 90 }))
    const [over] = weightChecks(draft({ groupWeight: 130 }))

    expect(group.message).toBe('ขาดอีก 10%')
    expect(over.message).toBe('เกินมา 30%')
  })

  it('ปิดการประเมินรายบุคคลแล้วไม่ต้องตรวจฝั่งบุคคลอีก', () => {
    const checks = weightChecks(draft({ individualMaxScore: 0, individualWeight: 40 }))

    expect(checks).toHaveLength(1)
    expect(checks[0].side).toBe('GROUP')
  })
})

describe('คะแนนเต็มรายบุคคล', () => {
  it('0 = ปิดฝั่งบุคคล', () => {
    expect(individualEnabled(draft({ individualMaxScore: 0 }))).toBe(false)
    expect(individualEnabled(draft({ individualMaxScore: 5 }))).toBe(true)
  })

  it('ปิดแล้วต้องไม่ส่งเกณฑ์ฝั่งบุคคลไปด้วย — ไม่งั้นระบบจะจัดคู่ฝั่งที่ไม่มีอยู่', () => {
    const body = toCreateInput(draft({ individualMaxScore: 0 }), 'room-1')

    expect(body.criteria).toHaveLength(1)
    expect(body.criteria[0].side).toBe('GROUP')
  })
})

describe('เงื่อนไขก่อนสร้างงาน', () => {
  it('ห้องที่ยังไม่มีนักศึกษาสร้างงานไม่ได้', () => {
    expect(draftBlocker(draft(), 0)).toBe('ยังไม่มีนักศึกษาในห้อง')
  })

  it('ไม่ระบุกำหนดส่งก็สร้างไม่ได้', () => {
    expect(draftBlocker(draft({ deadline: '' }), 12)).toBe('ยังไม่ได้ระบุกำหนดส่ง')
  })

  it('น้ำหนักไม่ครบ 100 ยัง "สร้าง" ได้ เพราะ API ยอมรับ DRAFT แบบนั้น', () => {
    expect(draftBlocker(draft({ groupWeight: 90 }), 12)).toBeNull()
  })

  it('ครบทุกอย่างแล้วไม่มีอะไรขวาง', () => {
    expect(draftBlocker(draft(), 12)).toBeNull()
  })
})

describe('แปลงเป็น body ของ API', () => {
  it('กำหนดส่งถูกแปลงเป็น UTC ตามเขตเวลาเครื่อง ไม่ส่งเวลาท้องถิ่นดิบ ๆ', () => {
    const local = '2027-01-31T23:59'
    const body = toCreateInput(draft({ deadline: local }), 'room-1')

    expect(body.groupDeadlineUtc).toBe(new Date(local).toISOString())
    expect(body.groupDeadlineUtc).toMatch(/Z$/)
  })

  it('ตัดช่องว่างหัวท้ายของชื่องานก่อนส่ง', () => {
    expect(toCreateInput(draft({ name: '  งานที่ 2  ' }), 'room-1').name).toBe('งานที่ 2')
  })
})
