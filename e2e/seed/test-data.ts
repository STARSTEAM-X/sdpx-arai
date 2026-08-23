/** ข้อมูลตั้งต้นของ E2E
 *
 *  รวมไว้ที่เดียวเพื่อให้ test อ้างค่าเดียวกันได้ ไม่ต้องพิมพ์อีเมลซ้ำในแต่ละไฟล์
 *  ถ้าวันหนึ่ง seed เปลี่ยน จะแก้ที่นี่ที่เดียว
 */

export const testUsers = {
  instructor: { email: 'ajarn@uni.ac.th', displayName: 'อ.สมชาย' },
  otherInstructor: { email: 'ajarn2@uni.ac.th', displayName: 'อ.สมหญิง' },
} as const

/** ชื่อห้องเรียนที่ test สร้างขึ้น — ตั้งชื่อให้รู้ว่ามาจาก test */
export const testClassroom = {
  name: 'E2E Software Engineering',
  expectedSlug: 'e2e-software-engineering',
  timezone: 'Asia/Bangkok',
} as const

/** CSV ที่ใช้ทดสอบ US-03
 *
 *  เขียนเป็นฟังก์ชันแทนค่าคงที่ เพราะ AC ข้อหนึ่งบังคับให้มีไฟล์ 100 แถว
 *  ที่ผิดเฉพาะแถวที่ 42 — การพิมพ์มือ 100 บรรทัดทำให้อ่าน test ไม่ออก
 */
export const rosterCsv = {
  /** ไฟล์ปกติ 4 คน 2 กลุ่ม กลุ่มละ 2 — ไม่มี warning */
  valid: ['email,group_name', 'somchai@uni.ac.th,group-1', 'somsri@uni.ac.th,group-1', 'manee@uni.ac.th,group-2', 'mana@uni.ac.th,group-2'].join('\n'),

  /** header ตัวพิมพ์ใหญ่ตาม AC ข้อ 3 — ต้องยอมรับได้ */
  upperCaseHeader: ['Email,Group_Name', 'wichai@uni.ac.th,group-a', 'wanida@uni.ac.th,group-a'].join('\n'),

  /** กลุ่มที่มีสมาชิกคนเดียวตาม AC ข้อ 4 — สำเร็จแต่ต้องเตือน */
  loneGroup: ['email,group_name', 'alone@uni.ac.th,group-solo', 'duo1@uni.ac.th,group-duo', 'duo2@uni.ac.th,group-duo'].join('\n'),

  /** 100 แถวที่ผิดเฉพาะแถวที่ 42 ตาม AC ข้อ 2
   *
   *  แถวที่ 1 คือ header ดังนั้นแถวที่ 42 ในสายตาคนคือ record ลำดับที่ 41
   *  เลขที่ error รายงานต้องตรงกับที่คนเห็นใน Excel ไม่ใช่ index ใน array
   */
  badRow42(): string {
    const lines = ['email,group_name']
    for (let record = 1; record <= 100; record++) {
      const lineNumber = record + 1
      const email = lineNumber === 42 ? 'ไม่ใช่อีเมลเลย' : `stu${record}@uni.ac.th`
      lines.push(`${email},group-${Math.ceil(record / 2)}`)
    }
    return lines.join('\n')
  },
} as const
