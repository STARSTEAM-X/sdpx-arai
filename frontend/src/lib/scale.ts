/** มาตรวัดเปรียบเทียบ 6 ระดับแบบ forced choice
 *
 *  กฎจาก PRD D1: **ห้ามมีตัวเลือกกลาง** ("เท่ากัน")
 *  เพราะตัวเลือกกลางทำให้เกิด central tendency bias —
 *  ผู้ประเมินจะเลือกกลางเมื่อไม่อยากคิด ทำให้ข้อมูลไม่มีสัญญาณ
 *
 *  แยกออกจาก component เพราะ scoring engine ฝั่ง backend ต้องใช้นิยามชุดเดียวกัน
 */

/** ฝั่งที่ผู้ประเมินตัดสินว่าดีกว่า */
export type Winner = 'A' | 'B'

/** ระดับความห่าง 1 = เล็กน้อย, 2 = ค่อนข้างมาก, 3 = มากที่สุด */
export type Strength = 1 | 2 | 3

export type ComparisonChoice = {
  id: number
  winner: Winner
  strength: Strength
  label: string
}

export const COMPARISON_SCALE: readonly ComparisonChoice[] = [
  { id: 1, winner: 'A', strength: 3, label: 'A ดีกว่า B มากที่สุด' },
  { id: 2, winner: 'A', strength: 2, label: 'A ดีกว่า B ค่อนข้างมาก' },
  { id: 3, winner: 'A', strength: 1, label: 'A ดีกว่า B เล็กน้อย' },
  { id: 4, winner: 'B', strength: 1, label: 'B ดีกว่า A เล็กน้อย' },
  { id: 5, winner: 'B', strength: 2, label: 'B ดีกว่า A ค่อนข้างมาก' },
  { id: 6, winner: 'B', strength: 3, label: 'B ดีกว่า A มากที่สุด' },
] as const
