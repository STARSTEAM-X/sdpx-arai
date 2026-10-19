/** มาตรวัดเปรียบเทียบ 6 ระดับแบบ forced choice
 *
 *  กฎจาก PRD D1: **ห้ามมีตัวเลือกกลาง** ("เท่ากัน")
 *  เพราะตัวเลือกกลางทำให้เกิด central tendency bias —
 *  ผู้ประเมินจะเลือกกลางเมื่อไม่อยากคิด ทำให้ข้อมูลไม่มีสัญญาณ
 *
 *  ข้อความ label ต้องตรงกับ PRD §9.1 คำต่อคำ เพราะตารางเดียวกันนี้ผูกกับ s_left/s_right
 *  ที่ scoring engine ใช้คำนวณ (US-16) — id คือสิ่งที่ backend เก็บ ไม่ใช่ label
 *  แยกออกจาก component เพราะ scoring engine ฝั่ง backend ต้องใช้นิยามชุดเดียวกัน
 */

/** ฝั่งที่ผู้ประเมินตัดสินว่าดีกว่า — ใช้ left/right ไม่ใช่ A/B เพราะหน้าจอแสดงผลจริง
 *  วางสองฝั่งเป็นซ้าย/ขวา (D8 สุ่มตำแหน่ง) ไม่ใช่เรียงตามตัวอักษร */
export type Winner = 'left' | 'right'

/** ระดับความห่าง 1 = เล็กน้อย, 2 = ปกติ (ไม่มีคำขยาย), 3 = มาก */
export type Strength = 1 | 2 | 3

export type ComparisonChoice = {
  id: number
  winner: Winner
  strength: Strength
  label: string
}

// คำต่อคำจาก PRD §9.1 — ห้ามแก้ให้ "สวยขึ้น" โดยไม่เช็คว่า s_left/s_right ยังตรงกัน
export const COMPARISON_SCALE: readonly ComparisonChoice[] = [
  { id: 1, winner: 'left', strength: 3, label: 'ซ้ายดีกว่ามาก' },
  { id: 2, winner: 'left', strength: 2, label: 'ซ้ายดีกว่า' },
  { id: 3, winner: 'left', strength: 1, label: 'ซ้ายดีกว่าเล็กน้อย' },
  { id: 4, winner: 'right', strength: 1, label: 'ขวาดีกว่าเล็กน้อย' },
  { id: 5, winner: 'right', strength: 2, label: 'ขวาดีกว่า' },
  { id: 6, winner: 'right', strength: 3, label: 'ขวาดีกว่ามาก' },
] as const
