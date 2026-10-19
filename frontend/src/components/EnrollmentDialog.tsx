import { useEffect, useRef, useState } from 'react'
import { ApiError, type RosterEntry, changeEnrollment } from '../lib/api'
import { Banner, btn } from './Ui'

/** Figma J09e · ทำเครื่องหมายถอนรายวิชา (และการคืนสถานะ)
 *
 *  แบบไม่มีช่องเหตุผล — การกระทำนี้มีความหมายในตัวเองและบันทึก audit อยู่แล้ว
 *  จึงส่งเหตุผลมาตรฐานให้ backend ที่บังคับว่าต้องมีเหตุผลกำกับ */
export function EnrollmentDialog({ member, classroomId, onClose, onChanged }: { member: RosterEntry; classroomId: string; onClose: () => void; onChanged: (notice: string) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const restoring = member.enrollmentStatus === 'WITHDRAWN'
  const name = member.displayName ?? member.email
  useEffect(() => { trigger.current = document.activeElement as HTMLElement; if (!dialog.current?.open) dialog.current?.showModal() }, [])
  function close() { dialog.current?.close(); trigger.current?.focus(); onClose() }
  async function submit() {
    setBusy(true); setError(null)
    try {
      const reason = restoring ? 'ยกเลิกเครื่องหมายถอนรายวิชาโดยผู้สอน' : 'ทำเครื่องหมายถอนรายวิชาโดยผู้สอน'
      const result = await changeEnrollment(classroomId, member.memberId, !restoring, reason)
      const warnings = result.repairs.flatMap((repair) => repair.warnings)
      await onChanged(`${restoring ? 'คืนสถานะนักศึกษา' : 'ทำเครื่องหมายถอนรายวิชา'} ${name} แล้ว · แจกคู่ที่ยังไม่ส่งใหม่ ${result.repairs.reduce((total, repair) => total + repair.pairsAdded, 0)} ข้อ${warnings.length ? ` · กรุณาตรวจความครอบคลุม: ${warnings.join(' · ')}` : ''}`)
      close()
    } catch (err) { setError(err instanceof ApiError ? err.message : 'เปลี่ยนสถานะไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  return (
    <dialog ref={dialog} aria-label={restoring ? 'คืนสถานะนักศึกษา' : 'ยืนยันถอนจากรายวิชา'} onCancel={(event) => { event.preventDefault(); if (!busy) close() }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-140 overflow-y-auto rounded-3xl bg-white p-7 text-ink shadow-xl backdrop:bg-ink/40">
      <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
        <h2 className="font-display text-[20px] font-bold">{restoring ? `คืนสถานะ ${name} เป็นนักศึกษา?` : `ทำเครื่องหมาย ${name} ว่าถอนรายวิชา?`}</h2>
        <p className="mt-2 break-all text-[13px] text-muted">{member.email} · นักศึกษา{member.groupName ? ` · กลุ่ม ${member.groupName}` : ''}</p>
        <div className="mt-5 space-y-1.5 rounded-xl bg-info-soft px-3.5 py-2.5 text-[13px] leading-[21px] text-info-ink">
          {restoring ? (
            <>
              <p className="font-semibold">กลับมารับคู่ประเมินในห้องนี้อีกครั้ง</p>
              <p>• คำตอบที่เคยส่งกลับมานับ · ระบบแจกคู่ที่ยังไม่ส่งให้ตามปกติ</p>
            </>
          ) : (
            <>
              <p className="font-semibold">ต่างจาก "ถอดออกจากห้อง" — ทำได้แม้มีงานที่เผยแพร่แล้ว</p>
              <p>• สถานะเปลี่ยนเป็น "ถอนรายวิชา" ยังเห็นในรายชื่อ ไม่ลบ</p>
              <p>• คำตอบที่{name}เคยส่ง และคะแนนที่{name}ได้ ไม่ถูกนำไปคำนวณ</p>
              <p>• คู่ที่{name}ยังไม่ได้ประเมิน ระบบแจกให้คนอื่นที่มีสิทธิ์อัตโนมัติ และแจ้งคนที่ได้คู่เพิ่ม</p>
              <p>• ถ้าไม่มีผู้มีสิทธิ์เหลือ คู่นั้นจะขึ้นเป็น "ข้อมูลไม่พอ" ในรายงาน coverage ให้ผู้สอนประเมินเองหรือแก้คะแนนด้วยมือ</p>
            </>
          )}
        </div>
        <p className="mt-4 text-[11.5px] leading-5 text-muted">บันทึก audit · ยกเลิกเครื่องหมายได้ก่อนประกาศผล: คำตอบของ{name}กลับมานับ<br />ส่วนคู่ที่แจกให้คนอื่นแล้วยังคงอยู่ · หลังประกาศผลต้องเปิดผลใหม่ก่อน</p>
        {error && <Banner tone="err" role="alert" className="mt-4">{error}</Banner>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={close} className={btn('ghost', 'md', 'px-6')}>ยกเลิก</button>
          <button type="submit" disabled={busy} className={btn('primary', 'md', 'px-6')}>{busy ? 'กำลังบันทึก…' : restoring ? 'คืนสถานะนักศึกษา' : 'ทำเครื่องหมายถอนรายวิชา'}</button>
        </div>
      </form>
    </dialog>
  )
}
