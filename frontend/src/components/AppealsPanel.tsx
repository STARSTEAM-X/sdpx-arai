import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, type Appeal, listAppeals, resolveAppeal } from '../lib/api'
import { Banner, Card, CTRL, Pill, btn } from './Ui'

const statusText = { OPEN: 'รอตอบ', RESOLVED: 'ตอบแล้ว', REJECTED: 'ไม่อนุมัติ' }

export function AppealsPanel({ classroomId, readOnly }: { classroomId: string; readOnly: boolean }) {
  const [items, setItems] = useState<Appeal[]>([])
  const [selected, setSelected] = useState<Appeal | null>(null)
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const refresh = useCallback(() => listAppeals(classroomId).then((result) => setItems(result.items)).catch((err) => setError(err instanceof ApiError ? err.message : 'โหลดคำร้องไม่สำเร็จ')), [classroomId])
  useEffect(() => { void refresh() }, [refresh])
  function close() { dialog.current?.close(); setSelected(null); trigger.current?.focus() }
  async function respond(status: 'RESOLVED' | 'REJECTED') {
    if (!selected) return
    setBusy(true); setError(null)
    try { await resolveAppeal(classroomId, selected.id, status, reply.trim()); await refresh(); close() }
    catch (err) { setError(err instanceof ApiError ? err.message : 'ตอบคำร้องไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  return <Card className="p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl font-bold">คำร้องอุทธรณ์</h2><p className="mt-2 text-sm text-muted">ยื่นได้ภายใน 7 วันหลังประกาศผล · รอตอบ {items.filter((item) => item.status === 'OPEN').length} รายการ</p></div><button type="button" onClick={() => void refresh()} className={btn('ghost', 'sm')}>รีเฟรชคำร้อง</button></div>
    {error && <Banner tone="err" role="alert" className="mt-4">{error}</Banner>}
    {items.length === 0 ? <p className="mt-6 text-sm text-muted">ยังไม่มีคำร้องอุทธรณ์</p> : <ul className="mt-5 divide-y divide-edge">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-4 py-4"><div className="min-w-0 flex-1"><h3 className="font-semibold">{item.studentName}</h3><p className="mt-1 text-sm text-muted">{item.assignmentName} · {new Date(item.createdAt).toLocaleDateString('th-TH')}</p></div><Pill tone={item.status === 'OPEN' ? 'warn' : 'ok'}>{statusText[item.status]}</Pill><button className={btn(item.status === 'OPEN' ? 'primary' : 'ghost', 'sm')} onClick={(event) => { trigger.current = event.currentTarget; setSelected(item); setReply(item.resolution ?? ''); setError(null); dialog.current?.showModal() }}>ดูคำร้อง<span className="sr-only"> {item.studentName}</span></button></li>)}</ul>}
    <dialog ref={dialog} aria-label="รายละเอียดคำร้องอุทธรณ์" onCancel={(event) => { if (busy) event.preventDefault(); else { event.preventDefault(); close() } }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl border border-edge bg-white p-6 text-ink shadow-xl backdrop:bg-ink/40">
      {selected && <><div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-xl font-bold">คำร้องของ {selected.studentName}</h2><p className="mt-2 text-sm text-muted">{selected.assignmentName}</p></div><button disabled={busy} onClick={close} aria-label="ปิดคำร้อง" className={btn('ghost', 'sm')}>×</button></div><h3 className="mt-6 font-semibold">เหตุผลที่นักศึกษาอุทธรณ์</h3><p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-sand p-4 text-sm leading-6">{selected.message}</p>
        <label htmlFor="appeal-reply" className="mt-5 block font-semibold">ตอบกลับนักศึกษา</label><textarea id="appeal-reply" value={reply} onChange={(event) => setReply(event.target.value)} maxLength={5000} disabled={busy || readOnly || selected.status !== 'OPEN'} className={`${CTRL} mt-3 min-h-32`} />
        {error && <Banner tone="err" role="alert" className="mt-4">{error}</Banner>}
        <p className="mt-3 text-xs leading-5 text-muted">คำตอบจะส่งถึงนักศึกษาและบันทึกในประวัติ การปรับคะแนนต้องทำผ่านเครื่องมือแก้คะแนนพร้อมเหตุผลในส่วนคะแนน</p>
        {!readOnly && selected.status === 'OPEN' && <div className="mt-5 flex flex-wrap justify-end gap-3"><button disabled={busy || !reply.trim()} onClick={() => void respond('REJECTED')} className={btn('ghost')}>ไม่อนุมัติคำร้อง</button><button disabled={busy || !reply.trim()} onClick={() => void respond('RESOLVED')} className={btn('primary')}>{busy ? 'กำลังบันทึก…' : 'ยืนยันคำตอบ'}</button></div>}
      </>}
    </dialog>
  </Card>
}
