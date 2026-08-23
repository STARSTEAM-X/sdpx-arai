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
