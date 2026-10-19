import { describe, expect, it } from 'vitest'

import { classroomLocalToUtc, formatDeadline } from './datetime'

/* AC ของ US-07: เวลาที่เห็นต้องเป็น timezone ของ classroom เสมอ ไม่ใช่ timezone เครื่อง
   ทดสอบด้วยสอง timezone ที่ต่างกันมากพอจะเห็นวันคนละวัน (UTC เที่ยงคืนครึ่งของวันถัดไป) */

describe('formatDeadline', () => {
  it('แปลงเวลาตาม timezone ของห้องเรียน ไม่ใช่ timezone เครื่อง', () => {
    const utc = '2027-01-01T18:30:00Z'

    const bangkok = formatDeadline(utc, 'Asia/Bangkok') // UTC+7 → 01:30 ของวันถัดไป
    const tokyo = formatDeadline(utc, 'Asia/Tokyo') // UTC+9 → 03:30 ของวันถัดไป

    expect(bangkok).toContain('01:30')
    expect(tokyo).toContain('03:30')
    expect(bangkok).not.toBe(tokyo)
  })

  it('timezone เดียวกันให้ผลเดียวกันเสมอไม่ว่าจะเรียกกี่ครั้ง', () => {
    const utc = '2027-06-15T10:00:00Z'

    expect(formatDeadline(utc, 'Asia/Bangkok')).toBe(formatDeadline(utc, 'Asia/Bangkok'))
  })

  it('แปลงเวลาหน้าปัดของห้องเรียนเป็น UTC โดยไม่อิง timezone เครื่อง', () => {
    expect(classroomLocalToUtc('2027-01-02T01:30', 'Asia/Bangkok')).toBe(
      '2027-01-01T18:30:00.000Z',
    )
    expect(classroomLocalToUtc('2027-01-02T03:30', 'Asia/Tokyo')).toBe(
      '2027-01-01T18:30:00.000Z',
    )
  })
})
