import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, type AssignmentSummary, copyAssignment, extendDeadline } from '../lib/api'
import { classroomLocalToUtc, classroomUtcToLocal, formatDeadline } from '../lib/datetime'
import { DeadlinePicker } from './DeadlinePicker'
import { Banner, CTRL, btn } from './Ui'
import { UnpublishButton } from './UnpublishButton'

export function AssignmentActions({ item, classroomId, timezone, onChanged, inline = false, showCopy = true, showUnpublish = true }: { item: AssignmentSummary; classroomId: string; timezone: string; onChanged: () => void; inline?: boolean; showCopy?: boolean; showUnpublish?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const [mode, setMode] = useState<'copy' | 'extend'>('copy')
  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [individual, setIndividual] = useState('')
  const [same, setSame] = useState(true)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  function open(next: 'copy' | 'extend', button: HTMLButtonElement) {
    trigger.current = button; setMode(next); setName(`${item.name} (สำเนา)`)
    setGroup(classroomUtcToLocal(item.groupDeadlineUtc, timezone))
    setIndividual(item.individualDeadlineUtc ? classroomUtcToLocal(item.individualDeadlineUtc, timezone) : '')
    setSame(true); setReason(''); setError(null); dialog.current?.showModal()
  }
  function close() { dialog.current?.close(); trigger.current?.focus() }
  async function submit() {
    setBusy(true); setError(null)
    try {
      const groupDeadlineUtc = classroomLocalToUtc(group, timezone)
      const individualDeadlineUtc = same ? groupDeadlineUtc : individual ? classroomLocalToUtc(individual, timezone) : null
      if (mode === 'copy') {
        await copyAssignment(item.id, { name, groupDeadlineUtc, individualDeadlineUtc })
        setSuccess('คัดลอกเป็นฉบับร่างแล้ว เปิดแก้ไขร่างเพื่อตรวจสอบก่อนเผยแพร่')
      } else {
        await extendDeadline(item.id, { groupDeadlineUtc, individualDeadlineUtc, reason })
        setSuccess('บันทึกกำหนดส่งใหม่แล้ว คำตอบเดิมยังอยู่ครบ')
      }
      onChanged(); close()
    } catch (err) { setError(err instanceof ApiError ? err.message : 'ทำรายการไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  const size = inline ? 'md' : 'sm'
  return <div className={inline ? 'contents' : 'w-full'}>
    <div className={inline ? 'contents' : 'flex flex-wrap gap-2'}>
      {item.status === 'DRAFT' && <Link to={`/classrooms/${classroomId}?draft=${item.id}#assignments`} className={btn('ghost', size, inline ? 'px-6' : '')}>แก้ไขร่าง</Link>}
      {['PUBLISHED', 'OPEN', 'CLOSED'].includes(item.status) && <button type="button" onClick={(event) => open('extend', event.currentTarget)} className={btn('ghost', size, inline ? 'px-6' : '')}>ขยายกำหนดส่ง</button>}
      {showCopy && <button type="button" onClick={(event) => open('copy', event.currentTarget)} className={btn('ghost', size, inline ? 'px-6' : '')}>คัดลอกงาน</button>}
      {showUnpublish && ['PUBLISHED', 'OPEN', 'CLOSED'].includes(item.status) && <UnpublishButton id={item.id} name={item.name} onChanged={onChanged} size={size} />}
    </div>
    {success && <p role="status" className="mt-3 text-sm text-ok-700">{success}</p>}
    <dialog ref={dialog} aria-label={mode === "copy" ? "คัดลอกจากงานเดิม" : "ขยายกำหนดส่ง"} onCancel={(event) => { if (busy) event.preventDefault(); else { event.preventDefault(); close() } }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl border border-edge bg-white p-6 text-ink shadow-xl backdrop:bg-ink/40">
      <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <h2 className="font-display text-xl font-bold">{mode === 'copy' ? 'คัดลอกจากงานเดิม' : 'ขยายกำหนดส่ง'}</h2><p className="mt-2 text-sm text-muted">{item.name} · เขตเวลา {timezone}</p>
        {error && <Banner tone="err" role="alert" className="mt-4">{error}</Banner>}
        {mode === 'copy' ? <label className="mt-5 block text-sm font-semibold">ชื่องานสำเนา<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} disabled={busy} className={`${CTRL} mt-2`} /></label> : <p className="mt-5 rounded-xl bg-sand p-3 text-sm">กำหนดส่งเดิม {formatDeadline(item.groupDeadlineUtc, timezone)}</p>}
        <label className="mt-4 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={same} disabled={busy} onChange={(event) => setSame(event.target.checked)} />ใช้กำหนดส่งเดียวกันทั้งกลุ่มและรายบุคคล</label>
        <label htmlFor={`new-deadline-${item.id}`} className="mt-4 block text-sm font-semibold">กำหนดส่งใหม่</label><DeadlinePicker id={`new-deadline-${item.id}`} value={group} timezone={timezone} onChange={setGroup} />
        {!same && <><label htmlFor={`new-individual-${item.id}`} className="mt-4 block text-sm font-semibold">กำหนดส่งรายบุคคลใหม่</label><DeadlinePicker id={`new-individual-${item.id}`} value={individual} timezone={timezone} onChange={setIndividual} /></>}
        {mode === 'extend' && <label className="mt-4 block text-sm font-semibold">เหตุผลที่ขยายกำหนดส่ง<textarea value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={2000} disabled={busy} className={`${CTRL} mt-2`} /></label>}
        <Banner tone="info" className="mt-4">{mode === 'copy' ? 'คัดลอกเกณฑ์และการตั้งค่าเป็นฉบับร่าง โดยไม่คัดลอกคู่ คำตอบ หรือคะแนน' : 'คำตอบเดิมยังคงอยู่ นักศึกษาประเมินต่อได้จนถึงกำหนดใหม่'}</Banner>
        <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={close} className={btn('ghost')}>ยกเลิก</button><button type="submit" disabled={busy || !group || (mode === 'extend' && !reason.trim())} className={btn('primary')}>{busy ? 'กำลังบันทึก…' : mode === 'copy' ? 'สร้างฉบับร่างสำเนา' : 'บันทึกกำหนดส่งใหม่'}</button></div>
      </form>
    </dialog>
  </div>
}
