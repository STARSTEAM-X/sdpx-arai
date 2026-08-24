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
      expect(['left', 'right']).toContain(choice.winner)
    }
  })

  it('แบ่งฝั่งซ้ายและขวาเท่ากันฝั่งละ 3 ระดับ', () => {
    const left = COMPARISON_SCALE.filter((c) => c.winner === 'left')
    const right = COMPARISON_SCALE.filter((c) => c.winner === 'right')
    expect(left).toHaveLength(3)
    expect(right).toHaveLength(3)
  })

  it('ความห่างของสองฝั่งสมมาตรกัน — ไม่เอนไปทางใดทางหนึ่ง', () => {
    const strengthsOf = (w: 'left' | 'right') =>
      COMPARISON_SCALE.filter((c) => c.winner === w)
        .map((c) => c.strength)
        .sort()
    expect(strengthsOf('left')).toEqual(strengthsOf('right'))
  })

  it('ข้อความตรงกับ PRD §9.1 คำต่อคำ — s_left/s_right ของ scoring engine ผูกกับข้อความนี้', () => {
    expect(COMPARISON_SCALE.map((c) => c.label)).toEqual([
      'ซ้ายดีกว่ามาก',
      'ซ้ายดีกว่า',
      'ซ้ายดีกว่าเล็กน้อย',
      'ขวาดีกว่าเล็กน้อย',
      'ขวาดีกว่า',
      'ขวาดีกว่ามาก',
    ])
  })

  it('id ไม่ซ้ำกัน', () => {
    const ids = COMPARISON_SCALE.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
