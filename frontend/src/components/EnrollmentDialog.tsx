import { useEffect, useRef, useState } from 'react'
import { ApiError, type RosterEntry, changeEnrollment } from '../lib/api'
import { Banner, CTRL, btn } from './Ui'

export function EnrollmentDialog({ member, classroomId, onClose, onChanged }: { member: RosterEntry; classroomId: string; onClose: () => void; onChanged: (notice: string) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const restoring = member.enrollmentStatus === 'WITHDRAWN'
  useEffect(() => { trigger.current = document.activeElement as HTMLElement; if (!dialog.current?.open) dialog.current?.showModal() }, [])
  function close() { dialog.current?.close(); trigger.current?.focus(); onClose() }
  async function submit() {
    setBusy(true); setError(null)
    try {
      const result = await changeEnrollment(classroomId, member.memberId, !restoring, reason.trim())
      const warnings = result.repairs.flatMap((repair) => repair.warnings)
      await onChanged(`${restoring ? 'คืนสถานะนักศึกษา' : 'ถอนจากรายวิชา'}แล้ว · จัดคู่ที่ยังไม่ส่งใหม่ ${result.repairs.reduce((total, repair) => total + repair.pairsAdded, 0)} ข้อ${warnings.length ? ` · กรุณาตรวจความครอบคลุม: ${warnings.join(' · ')}` : ''}`)
      close()
    } catch (err) { setError(err instanceof ApiError ? err.message : 'เปลี่ยนสถานะไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} aria-label={restoring ? 'คืนสถานะนักศึกษา' : 'ยืนยันถอนจากรายวิชา'} onCancel={(event) => { event.preventDefault(); if (!busy) close() }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl border border-edge bg-white p-6 text-ink shadow-xl backdrop:bg-ink/40">
    <form onSubmit={(event) => { event.preventDefault(); void submit() }}><h2 className="font-display text-xl font-bold">{restoring ? 'คืนสถานะ' : 'ทำเครื่องหมายถอน'} {member.displayName ?? member.email}{restoring ? ' เป็นนักศึกษา?' : ' จากรายวิชา?'}</h2><p className="mt-2 break-all text-sm text-muted">{member.email} · {member.groupName ?? 'ไม่มีกลุ่ม'}</p>
      <Banner tone="info" className="mt-5">{restoring ? 'กลับมารับคู่ประเมินในห้องนี้อีกครั้ง' : 'ถอนเฉพาะห้องเรียนนี้ บัญชีและห้องเรียนอื่นยังใช้งานได้ คะแนนของผู้ถอนจะไม่ใช้คำนวณ'} คำตอบที่ส่งแล้วของสมาชิกคนอื่นยังคงอยู่ ระบบจัดคู่ที่ยังไม่ส่งใหม่ และเก็บประวัติไว้ตรวจย้อนหลัง</Banner>
      <p className="mt-3 text-xs leading-5 text-muted">สมาชิกที่มีร่างคำตอบค้างอยู่ต้องโหลดรายการใหม่ หากมีงานปิดรับหรือประกาศผลแล้ว ต้องให้ผู้สอนขยายกำหนดส่งหรือเปิดผลใหม่ก่อน</p>
      <label className="mt-5 block text-sm font-semibold">เหตุผลที่เปลี่ยนสถานะ<textarea value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={2000} disabled={busy} className={`${CTRL} mt-2 min-h-24`} /></label>
      {error && <Banner tone="err" role="alert" className="mt-4">{error}</Banner>}
      <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={close} className={btn('ghost')}>ยกเลิก</button><button type="submit" disabled={busy || !reason.trim()} className={btn('primary')}>{busy ? 'กำลังบันทึก…' : restoring ? 'ยืนยันคืนสถานะ' : 'ยืนยันถอนจากรายวิชา'}</button></div>
    </form>
  </dialog>
}
