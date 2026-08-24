/** จัดรูปแบบวันเวลาให้ตรง timezone ของห้องเรียนเสมอ ไม่ใช่ timezone เครื่องผู้ใช้
 *
 *  AC ของ US-07: "ฉันอยู่คนละ timezone, เวลาที่เห็นเป็น timezone ของ classroom เสมอ"
 *  `toLocaleString` เฉย ๆ ใช้ timezone ของเบราว์เซอร์ ต้องส่ง `timeZone` เข้าไปตรง ๆ
 */
export function formatDeadline(isoUtc: string, timezone: string): string {
  return new Date(isoUtc).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  })
}
