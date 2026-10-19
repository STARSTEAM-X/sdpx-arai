import { useState, type FormEvent } from 'react'

import { ApiError, createClassroom } from '../lib/api'
import { Dropdown, type DropdownOption } from './Dropdown'
import { Banner, CTRL, btn } from './Ui'
import { IconGlobe } from './icons'

type Timezone = 'Asia/Bangkok' | 'Asia/Tokyo' | 'UTC'
const TIMEZONES: DropdownOption<Timezone>[] = [
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok', description: 'เวลาไทย · UTC+7', icon: <IconGlobe className="size-4" /> },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo', description: 'เวลาญี่ปุ่น · UTC+9', icon: <IconGlobe className="size-4" /> },
  { value: 'UTC', label: 'UTC', description: 'เวลามาตรฐานสากล · UTC+0', icon: <IconGlobe className="size-4" /> },
]

export function ClassroomCreateForm({ disabled, onCreated, onCancel }: {
  disabled: boolean
  onCreated: () => Promise<void>
  onCancel?: () => void
}) {
  const [name, setName] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [semester, setSemester] = useState('')
  const [timezone, setTimezone] = useState<Timezone>('Asia/Bangkok')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!courseCode.trim() || !semester.trim()) {
      setError('กรุณากรอกรหัสวิชาและภาคเรียนให้ครบ')
      return
    }
    setSubmitting(true)
    try {
      await createClassroom({ name, timezone, courseCode: courseCode.trim(), semester: semester.trim() })
      setName('')
      setCourseCode('')
      setSemester('')
      await onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'สร้างห้องเรียนไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-7 max-sm:p-5">
      <h2 id="h-create-classroom" className="font-display text-2xl font-bold">สร้างห้องเรียนใหม่</h2>
      <p className="mt-2 text-sm leading-6 text-muted">ตั้งชื่อและเขตเวลา แล้วเพิ่มสมาชิกในหน้าห้องเรียน</p>
      <div className="mt-6 space-y-5">
        <div>
          <label htmlFor="classroom-name" className="mb-2 block text-sm font-semibold">ชื่อห้องเรียน <span className="text-err">*</span></label>
          <input id="classroom-name" name="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น วิศวกรรมซอฟต์แวร์ 1/2569" className={CTRL} />
        </div>
        <div>
          <label id="classroom-timezone-label" className="mb-2 block text-sm font-semibold">เขตเวลา <span className="text-err">*</span></label>
          <Dropdown id="classroom-timezone" name="timezone" value={timezone} options={TIMEZONES} onChange={setTimezone} ariaLabelledby="classroom-timezone-label" />
        </div>
      </div>
      {error && <Banner tone="err" data-testid="error-msg" role="alert" className="mt-5">{error}</Banner>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">รหัสวิชา <span className="text-err">*</span><input name="courseCode" required pattern=".*\S.*" title="กรุณากรอกรหัสวิชา" value={courseCode} onChange={(event) => setCourseCode(event.target.value)} maxLength={100} className={`${CTRL} mt-2`} /></label>
        <label className="text-sm font-semibold">ภาคเรียน <span className="text-err">*</span><input name="semester" required pattern=".*\S.*" title="กรุณากรอกภาคเรียน" value={semester} onChange={(event) => setSemester(event.target.value)} maxLength={100} placeholder="เช่น 1/2569" className={`${CTRL} mt-2`} /></label>
      </div>
      <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-edge pt-5">
        {onCancel && <button type="button" onClick={onCancel} className={btn('ghost')}>ยกเลิก</button>}
        <button type="submit" disabled={submitting || disabled} className={btn('primary')}>{submitting ? 'กำลังสร้าง…' : 'สร้างห้องเรียน'}</button>
      </div>
    </form>
  )
}
