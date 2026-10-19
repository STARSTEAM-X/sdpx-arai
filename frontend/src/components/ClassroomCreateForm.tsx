import { useState, type FormEvent } from 'react'

import { ApiError, type Classroom, createClassroom, updateClassroom } from '../lib/api'
import { Banner, CTRL, btn } from './Ui'

/** ฟอร์มสร้าง/แก้ไขห้องเรียน ตาม Figma J03
 *
 *  ช่องเรียงลงมาทีละแถว: ชื่อ → รหัสวิชา → ภาคเรียน → เขตเวลา → โดเมนที่อนุญาต (อ่านอย่างเดียว)
 *  โดเมนเป็น policy ระดับระบบ จึงแสดงให้เห็นแต่แก้ไม่ได้ */
export function ClassroomCreateForm({ disabled, onCreated, onCancel, room }: {
  disabled: boolean
  onCreated: (created: Classroom) => Promise<void> | void
  onCancel?: () => void
  /** ส่งมาเมื่อแก้ไขห้องเดิม (เมนู "แก้ไขข้อมูลห้อง") */
  room?: Classroom
}) {
  const [name, setName] = useState(room?.name ?? '')
  const [courseCode, setCourseCode] = useState(room?.courseCode ?? '')
  const [semester, setSemester] = useState(room?.semester ?? '')
  const [timezone, setTimezone] = useState(room?.timezone ?? 'Asia/Bangkok')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const domains = room?.allowedEmailDomains.join(', ') || 'kmitl.ac.th'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('กรุณากรอกชื่อห้องเรียน')
      return
    }
    if (!courseCode.trim() || !semester.trim()) {
      setError('กรุณากรอกรหัสวิชาและภาคเรียนให้ครบ')
      return
    }
    setSubmitting(true)
    try {
      const body = { name: name.trim(), timezone: timezone.trim(), courseCode: courseCode.trim(), semester: semester.trim() }
      const saved = room ? await updateClassroom(room.id, body) : await createClassroom(body)
      if (!room) {
        setName('')
        setCourseCode('')
        setSemester('')
      }
      await onCreated(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : room ? 'บันทึกข้อมูลห้องไม่สำเร็จ' : 'สร้างห้องเรียนไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  const label = 'mb-2 block font-display text-[14.5px] font-semibold'
  const input = `${CTRL} min-h-12.5`

  return (
    <form onSubmit={handleSubmit} noValidate className="p-7 max-sm:p-5">
      <h2 id="h-create-classroom" className="font-display text-[22px] font-semibold">{room ? 'แก้ไขข้อมูลห้อง' : 'สร้างห้องเรียน'}</h2>
      <p className="mt-5 text-[14.5px] text-ink-2">{room ? 'แก้ชื่อ รหัสวิชา ภาคเรียน หรือเขตเวลาของห้อง' : 'สร้างห้องก่อนเพิ่มสมาชิกและงานประเมิน'}</p>
      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="classroom-name" className={label}>ชื่อห้องเรียน</label>
          <input id="classroom-name" name="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="วิศวกรรมซอฟต์แวร์ 1/2569" maxLength={200} className={input} />
        </div>
        <div>
          <label htmlFor="classroom-course" className={label}>รหัสวิชา</label>
          <input id="classroom-course" name="courseCode" value={courseCode} onChange={(event) => setCourseCode(event.target.value)} placeholder="CE-SDPX" maxLength={100} className={input} />
        </div>
        <div>
          <label htmlFor="classroom-semester" className={label}>ภาคเรียน</label>
          <input id="classroom-semester" name="semester" value={semester} onChange={(event) => setSemester(event.target.value)} placeholder="1/2569" maxLength={100} className={input} />
        </div>
        <div>
          <label htmlFor="classroom-timezone" className={label}>เขตเวลาของห้อง</label>
          <input id="classroom-timezone" name="timezone" list="classroom-timezones" value={timezone} onChange={(event) => setTimezone(event.target.value)} className={input} />
          <datalist id="classroom-timezones">
            <option value="Asia/Bangkok" />
            <option value="Asia/Tokyo" />
            <option value="UTC" />
          </datalist>
        </div>
        <div>
          <label htmlFor="classroom-domains" className="mb-2 block font-display text-[14.5px] text-muted">โดเมนอีเมลที่อนุญาต</label>
          <input id="classroom-domains" value={domains} disabled className="min-h-12 w-full rounded-xl border border-transparent bg-[#e2e2e2] px-3.5 text-muted" />
        </div>
      </div>
      {error && <Banner tone="err" data-testid="error-msg" role="alert" className="mt-5">{error}</Banner>}
      <div className="mt-5 flex flex-wrap gap-3">
        {onCancel && <button type="button" onClick={onCancel} className={btn('ghost', 'md', 'px-6')}>ยกเลิก</button>}
        <button type="submit" disabled={submitting || disabled} className={btn('primary', 'md', 'px-6')}>
          {submitting ? (room ? 'กำลังบันทึก…' : 'กำลังสร้าง…') : room ? 'บันทึก' : 'สร้างห้องเรียน'}
        </button>
      </div>
    </form>
  )
}
