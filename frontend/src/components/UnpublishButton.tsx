import { useRef, useState } from 'react'
import { ApiError, unpublishAssignment, unpublishImpact } from '../lib/api'
import { Banner, CTRL, btn } from './Ui'

export function UnpublishButton({ id, name, onChanged }: { id: string; name: string; onChanged: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [impact, setImpact] = useState<Awaited<ReturnType<typeof unpublishImpact>> | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  function close() { dialog.current?.close(); trigger.current?.focus() }
  async function open() {
    setImpact(null); setReason(''); setError(null); dialog.current?.showModal()
    try { setImpact(await unpublishImpact(id)) }
    catch (err) { setError(err instanceof ApiError ? err.message : 'โหลดผลกระทบไม่สำเร็จ') }
  }
  async function submit() {
    setBusy(true); setError(null)
    try { await unpublishAssignment(id, reason.trim()); onChanged(); close() }
    catch (err) { setError(err instanceof ApiError ? err.message : 'ยกเลิกเผยแพร่ไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  return <><button ref={trigger} type="button" onClick={() => void open()} className={btn('ghost', 'sm')}>ยกเลิกเผยแพร่</button>
    <dialog ref={dialog} aria-label="ยืนยันยกเลิกเผยแพร่" onCancel={(event) => { if (busy) event.preventDefault(); else { event.preventDefault(); close() } }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-auto rounded-3xl border border-edge bg-white p-6 text-ink shadow-xl backdrop:bg-ink/40">
      <form onSubmit={(event) => { event.preventDefault(); void submit() }}><h2 className="font-display text-xl font-bold">ยกเลิกเผยแพร่ “{name}”?</h2><p className="mt-2 text-sm text-muted">งานจะกลับเป็นฉบับร่าง เพื่อแก้เกณฑ์หรือรายชื่อ แล้วเผยแพร่ใหม่</p>
        {impact ? <Banner tone="err" className="mt-5">นักศึกษา {impact.submittedEvaluators} คนส่งแล้ว · คำตอบที่ส่งแล้ว {impact.submittedComparisons} จาก {impact.assignedComparisons} ข้อจะไม่ใช้คำนวณในรอบใหม่ เก็บหลักฐานเดิมไว้ตรวจย้อนหลัง</Banner> : !error && <p role="status" className="mt-4">กำลังตรวจสอบผลกระทบ…</p>}
        <div className="mt-4 rounded-xl bg-sand p-4 text-sm leading-6">หลังจากนี้ นักศึกษาจะประเมินไม่ได้ชั่วคราว เมื่อเผยแพร่ใหม่ ระบบจะจัดคู่ใหม่และให้นักศึกษาประเมินอีกครั้ง</div>
        <label className="mt-5 block text-sm font-semibold">เหตุผลที่ยกเลิกเผยแพร่<textarea value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={2000} disabled={busy} className={`${CTRL} mt-2 min-h-24`} /></label>
        {error && <Banner tone="err" role="alert" className="mt-4">{error}</Banner>}
        <p className="mt-3 text-xs text-muted">การเปลี่ยนแปลงและเหตุผลจะถูกบันทึกในประวัติการตรวจสอบ</p><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={close} className={btn('ghost')}>ไม่ยกเลิก</button><button type="submit" disabled={busy || !impact || !reason.trim()} className={btn('primary')}>{busy ? 'กำลังบันทึก…' : 'ยืนยันยกเลิกเผยแพร่'}</button></div>
      </form>
    </dialog></>
}
