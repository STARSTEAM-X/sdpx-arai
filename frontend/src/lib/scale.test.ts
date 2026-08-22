import { describe, expect, it } from 'vitest'

import { COMPARISON_SCALE } from './scale'

/* test ชุดนี้ปกป้องกฎ D1 ของ PRD — ถ้ามีใครเผลอเพิ่มตัวเลือก "เท่ากัน"
   หรือลดระดับเหลือ 5 ระดับ test ต้องแดงทันที */

describe('มาตรวัดเปรียบเทียบ', () => {
  it('มี 6 ระดับพอดี', () => {
    expect(COMPARISON_SCALE).toHaveLength(6)
  })

  it('ไม่มีตัวเลือกกลาง — ทุกตัวเลือกต้องชี้ว่าฝั่งไหนดีกว่า', () => {
    for (const choice of COMPARISON_SCALE) {
      expect(['A', 'B']).toContain(choice.winner)
    }
  })

  it('แบ่งฝั่ง A และ B เท่ากันฝั่งละ 3 ระดับ', () => {
    const a = COMPARISON_SCALE.filter((c) => c.winner === 'A')
    const b = COMPARISON_SCALE.filter((c) => c.winner === 'B')
    expect(a).toHaveLength(3)
    expect(b).toHaveLength(3)
  })

  it('ความห่างของสองฝั่งสมมาตรกัน — ไม่เอนไปทางใดทางหนึ่ง', () => {
    const strengthsOf = (w: 'A' | 'B') =>
      COMPARISON_SCALE.filter((c) => c.winner === w)
        .map((c) => c.strength)
        .sort()
    expect(strengthsOf('A')).toEqual(strengthsOf('B'))
  })

  it('id ไม่ซ้ำกัน', () => {
    const ids = COMPARISON_SCALE.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
