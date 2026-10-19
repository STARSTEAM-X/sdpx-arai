import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, type Appeal, listAppeals, resolveAppeal } from '../lib/api'
import { Banner, CTRL, FOCUS, btn } from './Ui'
import { thaiDate } from '../lib/datetime'

const statusText = { OPEN: 'รอตอบ', RESOLVED: 'ตอบแล้ว', REJECTED: 'ยืนยันคะแนนเดิม' }
const statusTone = {
  OPEN: 'bg-accent-soft text-accent-ink',
  RESOLVED: 'bg-info-soft text-info-ink',
  REJECTED: 'bg-ok-50 text-ok-700',
}
const when = (iso: string) => thaiDate(iso, { year: false, time: true })

/** คำร้องอุทธรณ์ของงาน ตาม Figma J35 — กรองสถานะ ตารางนักศึกษา/กลุ่ม/เรื่อง/เวลา/สถานะ */
export function AppealsPanel({
  classroomId,
  assignmentId,
  readOnly,
}: {
  classroomId: string
  assignmentId?: string
  readOnly: boolean
}) {
  const [all, setItems] = useState<Appeal[]>([])
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'DONE'>('ALL')
  const [selected, setSelected] = useState<Appeal | null>(null)
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const refresh = useCallback(
    () =>
      listAppeals(classroomId)
        .then((result) => setItems(result.items))
        .catch((err) => setError(err instanceof ApiError ? err.message : 'โหลดคำร้องไม่สำเร็จ')),
    [classroomId],
  )
  useEffect(() => {
    void refresh()
  }, [refresh])
  function close() {
    dialog.current?.close()
    setSelected(null)
    trigger.current?.focus()
  }
  async function respond(status: 'RESOLVED' | 'REJECTED') {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      await resolveAppeal(classroomId, selected.id, status, reply.trim())
      await refresh()
      close()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ตอบคำร้องไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }
  const items = all.filter((item) => !assignmentId || item.assignmentId === assignmentId)
  const open = items.filter((item) => item.status === 'OPEN').length
  const shown = items.filter(
    (item) => filter === 'ALL' || (filter === 'OPEN' ? item.status === 'OPEN' : item.status !== 'OPEN'),
  )
  const chip = (value: typeof filter, label: string, count: number, dot: string) => (
    <button
      key={value}
      type="button"
      aria-pressed={filter === value}
      onClick={() => setFilter(value)}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full border bg-white px-4 font-display text-[14px] font-semibold ${FOCUS} ${filter === value ? 'border-ink' : 'border-edge'}`}
    >
      {dot && <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />}
      {label}
      <span className="rounded-full bg-sand px-2 text-[12px]">{count}</span>
    </button>
  )
  return (
    <section aria-labelledby="h-appeals" className="overflow-hidden rounded-3xl border border-edge bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge bg-surface-cream px-5 py-4">
        <div>
          <h2 id="h-appeals" className="font-display text-[16px] font-semibold">
            คำร้องอุทธรณ์
          </h2>
          <p className="mt-1 text-[13.5px] text-ink-2">ยื่นได้ภายใน 7 วันหลังประกาศผล · การตอบทุกครั้งบันทึก audit</p>
        </div>
        <div role="group" aria-label="กรองคำร้อง" className="flex flex-wrap gap-2">
          {chip('ALL', 'ทั้งหมด', items.length, '')}
          {chip('OPEN', 'รอตอบ', open, 'bg-brand-600')}
          {chip('DONE', 'ตอบแล้ว', items.length - open, 'bg-ok-600')}
        </div>
      </div>
      {error && (
        <Banner tone="err" role="alert" className="m-5">
          {error}
        </Banner>
      )}
      {shown.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">
          {items.length ? 'ไม่พบคำร้องตามตัวกรอง' : 'ยังไม่มีคำร้องอุทธรณ์'}
        </p>
      ) : (
        <div className="overflow-x-auto" role="region" aria-label="ตารางคำร้องอุทธรณ์" tabIndex={0}>
          <table className="w-full min-w-180 text-left text-[14px]">
            <thead className="bg-table-head">
              <tr>
                {['นักศึกษา', 'กลุ่ม', 'เรื่องที่อุทธรณ์', 'ยื่นเมื่อ', 'สถานะ', ''].map((label, index) => (
                  <th key={index} scope="col" className={`px-5 py-3 font-normal ${index === 4 ? 'text-right' : ''}`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {shown.map((item) => (
                <tr key={item.id}>
                  <th scope="row" className="px-5 py-3.5 text-left font-semibold">
                    {item.studentName}
                    {item.studentEmail && (
                      <span className="block text-[12px] font-normal text-muted">{item.studentEmail}</span>
                    )}
                  </th>
                  <td className="px-5 py-3.5">{item.groupName ?? '—'}</td>
                  <td className="max-w-60 truncate px-5 py-3.5 text-ink-2" title={item.message}>
                    {item.message}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5">{when(item.createdAt)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span
                      className={`inline-flex rounded-full px-3 py-1.5 font-display text-[13px] font-semibold ${statusTone[item.status]}`}
                    >
                      {statusText[item.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      className={btn(item.status === 'OPEN' && !readOnly ? 'primary' : 'ghost', 'sm', 'px-5')}
                      onClick={(event) => {
                        trigger.current = event.currentTarget
                        setSelected(item)
                        setReply(item.resolution ?? '')
                        setError(null)
                        dialog.current?.showModal()
                      }}
                    >
                      {item.status === 'OPEN' && !readOnly ? 'ตอบคำร้อง' : 'ดูรายละเอียด'}
                      <span className="sr-only"> {item.studentName}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dialog
        ref={dialog}
        aria-label="รายละเอียดคำร้องอุทธรณ์"
        onCancel={(event) => {
          if (busy) event.preventDefault()
          else {
            event.preventDefault()
            close()
          }
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl border border-edge bg-white p-6 text-ink shadow-xl backdrop:bg-ink/40"
      >
        {selected && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">คำร้องของ {selected.studentName}</h2>
                <p className="mt-2 text-sm text-muted">{selected.assignmentName}</p>
              </div>
              <button disabled={busy} onClick={close} aria-label="ปิดคำร้อง" className={btn('ghost', 'sm')}>
                ×
              </button>
            </div>
            <h3 className="mt-6 font-semibold">เหตุผลที่นักศึกษาอุทธรณ์</h3>
            <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-sand p-4 text-sm leading-6">
              {selected.message}
            </p>
            <label htmlFor="appeal-reply" className="mt-5 block font-semibold">
              ตอบกลับนักศึกษา
            </label>
            <textarea
              id="appeal-reply"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              maxLength={5000}
              disabled={busy || readOnly || selected.status !== 'OPEN'}
              className={`${CTRL} mt-3 min-h-32`}
            />
            {error && (
              <Banner tone="err" role="alert" className="mt-4">
                {error}
              </Banner>
            )}
            <p className="mt-3 text-xs leading-5 text-muted">
              คำตอบจะส่งถึงนักศึกษาและบันทึกในประวัติ การปรับคะแนนต้องทำผ่านเครื่องมือแก้คะแนนพร้อมเหตุผลในส่วนคะแนน
            </p>
            {!readOnly && selected.status === 'OPEN' && (
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  disabled={busy || !reply.trim()}
                  onClick={() => void respond('REJECTED')}
                  className={btn('ghost')}
                >
                  ยืนยันคะแนนเดิม
                </button>
                <button
                  disabled={busy || !reply.trim()}
                  onClick={() => void respond('RESOLVED')}
                  className={btn('primary')}
                >
                  {busy ? 'กำลังบันทึก…' : 'ตอบคำร้อง'}
                </button>
              </div>
            )}
          </>
        )}
      </dialog>
    </section>
  )
}
