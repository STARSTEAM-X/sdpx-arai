/** จัดรูปแบบวันเวลาให้ตรง timezone ของห้องเรียนเสมอ ไม่ใช่ timezone เครื่องผู้ใช้
 *
 *  AC ของ US-07: "ฉันอยู่คนละ timezone, เวลาที่เห็นเป็น timezone ของ classroom เสมอ"
 *  `toLocaleString` เฉย ๆ ใช้ timezone ของเบราว์เซอร์ ต้องส่ง `timeZone` เข้าไปตรง ๆ
 */
export function formatDeadline(isoUtc: string, timezone: string): string {
  return new Date(isoUtc).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
    timeZone: timezone,
  })
}

export function classroomUtcToLocal(isoUtc: string, timezone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(isoUtc)).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/** แปลงเวลาหน้าปัดของห้องเรียนเป็น UTC โดยไม่อิง timezone ของเครื่องผู้ใช้
 *
 * ค่า `datetime-local` ไม่มี offset ติดมาด้วย จึงต้องคำนวณ offset จาก IANA timezone
 * ของห้องเรียนก่อนส่ง API ตาม FR-ASSIGN-05
 */
export function classroomLocalToUtc(localValue: string, timezone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localValue)
  if (!match) throw new RangeError('รูปแบบวันเวลาไม่ถูกต้อง')

  const [, year, month, day, hour, minute] = match
  const wallClockUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  )
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  let candidate = wallClockUtc
  // สองรอบพอสำหรับ timezone ปกติ; รอบที่สามรองรับจุดเปลี่ยน DST โดยไม่เพิ่ม dependency
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(candidate))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    )
    const representedWallClock = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    )
    candidate += wallClockUtc - representedWallClock
  }

  return new Date(candidate).toISOString()
}

export const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

export const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
]

/** แยกวัน/เดือน/ปี พ.ศ./เวลา ตาม timezone ที่กำหนด (ค่าเริ่มต้นเวลาไทย ไม่ใช่เวลาเครื่องผู้ใช้) */
export function thaiParts(isoUtc: string, timeZone = 'Asia/Bangkok') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(isoUtc))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    day: Number(get('day')),
    month: Number(get('month')),
    year: Number(get('year')) + 543,
    hour: get('hour'),
    minute: get('minute'),
  }
}

/** วันที่แบบไทยที่ใช้ทั้งเว็บ เช่น "19 ต.ค. 2569", "19 ต.ค. 16:21", "19 ตุลาคม 2569" */
export function thaiDate(
  isoUtc: string,
  { timeZone = 'Asia/Bangkok', long = false, year = true, time = false } = {},
): string {
  const d = thaiParts(isoUtc, timeZone)
  const month = (long ? THAI_MONTHS : THAI_MONTHS_SHORT)[d.month - 1]
  return `${d.day} ${month}${year ? ` ${d.year}` : ''}${time ? ` ${d.hour}:${d.minute}` : ''}`
}
