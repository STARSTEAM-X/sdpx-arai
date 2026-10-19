import { useEffect, useState, type ReactNode } from 'react'
import { useModal } from './useModal'

import { ApiError, type ComputedScoreItem, type Scores, getAssignment } from '../lib/api'
import { CTRL, Spinner, btn } from './Ui'


function Shell({
  id,
  title,
  subtitle,
  onClose,
  children,
  footer,
  testId,
  tinted = false,
  done = false,
}: {
  id: string
  title: string
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  /** ได้ฟังก์ชันปิดไปผูกกับปุ่ม — ปิดผ่าน dialog.close() เพื่อให้ onClose ทำงานครั้งเดียว */
  footer: (dismiss: () => void) => ReactNode
  testId?: string
  tinted?: boolean
  /** true เมื่องานสำเร็จแล้ว ให้ปิดตัวเอง */
  done?: boolean
}) {
  const ref = useModal()
  const [closing, setClosing] = useState(false)
  useEffect(() => {
    if (closing || done) ref.current?.close()
  }, [closing, done, ref])
  const dismiss = () => setClosing(true)
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      data-testid={testId}
      onClose={onClose}
      className="fixed inset-0 m-auto max-h-[94dvh] w-[calc(100vw-2rem)] max-w-140 overflow-y-auto rounded-3xl bg-white p-0 text-ink shadow-[0_24px_60px_rgba(50,16,7,0.2)] backdrop:bg-ink/40"
    >
      <div className={`px-6 pt-6 pb-4 ${tinted ? 'bg-surface-cream' : ''}`}>
        <h2 id={id} className="font-display text-[22px] font-bold">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-[13.5px] leading-6 text-ink-2">{subtitle}</p>}
      </div>
      <div className="px-6 pb-2">{children}</div>
      <div
        className={`mt-4 flex flex-wrap justify-end gap-3 px-6 py-4 ${tinted ? 'border-t border-edge bg-table-head' : ''}`}
      >
        {footer(dismiss)}
      </div>
    </dialog>
  )
}

const closeButton = (onClick: () => void) => (
  <button type="button" onClick={onClick} className={btn('ghost', 'md', 'border-brand-600 px-6 text-accent-ink')}>
    ยกเลิก
  </button>
)

/** กล่องผิดพลาดแบบ Figma S04/S12 — ข้อมูลที่กรอกยังอยู่ ลองใหม่ได้ */
function ErrorBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="alert" className="mt-4 flex gap-3 rounded-2xl bg-err-soft px-4 py-3 text-err">
      <span aria-hidden="true" className="font-bold">
        ✕
      </span>
      <div>
        <p className="font-display text-[14.5px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-2">{children}</p>
      </div>
    </div>
  )
}

/** Figma J25c · แก้คะแนนด้วยมือ (พร้อม inline error S05/S06 และ S12 เมื่อบันทึกไม่สำเร็จ) */
export function OverrideScoreDialog({
  assignmentId,
  scores,
  initial,
  onClose,
  onSave,
}: {
  assignmentId: string
  scores: Scores
  initial: ComputedScoreItem
  onClose: () => void
  onSave: (input: {
    side: ComputedScoreItem['side']
    itemId: string
    overrideValue: string
    reason: string
  }) => Promise<void>
}) {
  const [side, setSide] = useState(initial.side)
  const [itemId, setItemId] = useState(initial.itemId)
  const [value, setValue] = useState(initial.component)
  const [reason, setReason] = useState('')
  const [max, setMax] = useState<{ GROUP: number; INDIVIDUAL: number } | null>(null)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let active = true
    void getAssignment(assignmentId)
      .then((a) => {
        if (active) setMax({ GROUP: Number(a.groupMaxScore), INDIVIDUAL: Number(a.individualMaxScore) })
      })
      .catch(() => {
        /* ไม่มีเพดาน → ให้ server ตัดสิน */
      })
    return () => {
      active = false
    }
  }, [assignmentId])

  const rows = scores.items.filter((item) => item.side === side)
  const current = rows.find((item) => item.itemId === itemId) ?? rows[0]
  const limit = max?.[side]
  const numeric = Number(value)
  const valueError =
    !value.trim() || !Number.isFinite(numeric)
      ? 'กรุณาระบุคะแนนเป็นตัวเลข'
      : limit !== undefined && (numeric < 0 || numeric > limit)
        ? `คะแนนต้องอยู่ระหว่าง 0–${limit}`
        : null
  const reasonError = !reason.trim() ? 'กรุณาระบุเหตุผลก่อนบันทึก' : null

  async function submit() {
    setTouched(true)
    if (valueError || reasonError || !current) return
    setBusy(true)
    setError(null)
    try {
      await onSave({ side, itemId: current.itemId, overrideValue: value.trim(), reason: reason.trim() })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เชื่อมต่อระบบไม่ได้')
    } finally {
      setBusy(false)
    }
  }

  const tab = (active: boolean) =>
    `min-h-9 rounded-xl px-4 font-display text-[14px] font-semibold ${active ? 'bg-white shadow-sm' : 'text-ink-2'}`
  return (
    <Shell
      done={done}
      id="override-title"
      testId="override-dialog"
      title="แก้คะแนนด้วยมือ"
      subtitle="ใช้เมื่อคะแนนจากระบบไม่สะท้อนผลงานจริง · ทุกการแก้ต้องมีเหตุผล"
      onClose={onClose}
      footer={(dismiss) => (
        <>
          {closeButton(dismiss)}
          <button type="button" disabled={busy} onClick={() => void submit()} className={btn('primary', 'md', 'px-6')}>
            {busy && <Spinner />}
            {error ? 'ลองบันทึกอีกครั้ง' : 'บันทึกคะแนนที่แก้'}
          </button>
        </>
      )}
    >
      <div role="tablist" aria-label="ฝั่งคะแนน" className="inline-flex gap-1 rounded-2xl bg-[#f3efeb] p-1">
        {(['GROUP', 'INDIVIDUAL'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={side === option}
            disabled={!scores.items.some((item) => item.side === option)}
            onClick={() => {
              setSide(option)
              const first = scores.items.find((item) => item.side === option)
              if (first) {
                setItemId(first.itemId)
                setValue(first.component)
              }
            }}
            className={tab(side === option)}
          >
            {option === 'GROUP' ? 'รายกลุ่ม' : 'รายบุคคล'}
          </button>
        ))}
      </div>
      <label className="mt-4 block font-display text-[14.5px] font-semibold">
        {side === 'GROUP' ? 'กลุ่ม' : 'นักศึกษา'}
        <select
          value={current?.itemId ?? ''}
          onChange={(event) => {
            const next = rows.find((item) => item.itemId === event.target.value)
            setItemId(event.target.value)
            if (next) setValue(next.component)
          }}
          className={`${CTRL} mt-2 min-h-12 font-body font-normal`}
        >
          {rows.map((item) => (
            <option key={item.itemId} value={item.itemId}>
              {item.itemLabel}
            </option>
          ))}
        </select>
      </label>
      {current && (
        <dl className="mt-3 space-y-1.5 rounded-2xl bg-table-head px-4 py-3 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-ink-2">คะแนนจากระบบ</dt>
            <dd className="font-semibold">
              {current.component}
              {limit !== undefined ? ` / ${limit}` : ''}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">สถานะ</dt>
            <dd className="font-semibold">
              {current.flags.includes('LOW_CONFIDENCE') ? 'มีคู่ข้อมูลน้อย' : 'ข้อมูลพอ'}
            </dd>
          </div>
        </dl>
      )}
      <label className="mt-4 block font-display text-[14.5px] font-semibold">
        คะแนนใหม่{limit !== undefined ? ` · คะแนนเต็ม ${limit}` : ''}
        <input
          type="number"
          step="0.001"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={touched && Boolean(valueError)}
          className={`${CTRL} mt-2 min-h-12 font-body font-normal ${touched && valueError ? 'border-err-field' : ''}`}
        />
      </label>
      {touched && valueError ? (
        <p className="mt-1.5 text-[12.5px] text-err">✕ {valueError}</p>
      ) : (
        <p className="mt-1.5 text-[12.5px] text-muted">
          {side === 'GROUP' ? 'สมาชิกทุกคนในกลุ่มจะได้คะแนนกลุ่มนี้ · ' : ''}รายงานจะแสดงป้าย "แก้โดยอาจารย์"
        </p>
      )}
      <label className="mt-4 block font-display text-[14.5px] font-semibold">
        เหตุผล (บังคับ)
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={2000}
          placeholder="กรอกเหตุผลในการแก้คะแนน"
          aria-invalid={touched && Boolean(reasonError)}
          className={`${CTRL} mt-2 min-h-20 font-body font-normal ${touched && reasonError ? 'border-err-field' : ''}`}
        />
      </label>
      {touched && reasonError && <p className="mt-1.5 text-[12.5px] text-err">✕ {reasonError}</p>}
      {error ? (
        <ErrorBox title="ยังบันทึกการแก้คะแนนไม่ได้">
          {error} · ข้อมูลที่กรอกในหน้านี้ยังอยู่ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่
        </ErrorBox>
      ) : (
        <div className="mt-4 rounded-2xl bg-[#fff6d8] px-4 py-3 text-[13px] text-warn">
          <p className="font-semibold">บันทึก audit ค่าก่อน/หลัง พร้อมเหตุผล</p>
          <p className="mt-0.5">ถ้าคำนวณคะแนนใหม่ภายหลัง คะแนนที่แก้ด้วยมือจะยังคงอยู่</p>
        </div>
      )}
    </Shell>
  )
}

/** Figma J31 · ยืนยันประกาศผลคะแนน — ถ้ามีคู่ข้อมูลน้อย server จะบอก แล้วให้ยืนยันซ้ำในกล่องเดิม */
export function FinalizeDialog({
  name,
  summary,
  onClose,
  onConfirm,
}: {
  name: string
  summary: { label: string; value: string }[]
  onClose: () => void
  /** คืนข้อความเตือนถ้า server ขอให้ยืนยันเรื่องข้อมูลน้อย (ยังไม่ประกาศ) */
  onConfirm: (confirmLowConfidence: boolean) => Promise<string | null>
}) {
  const [warning, setWarning] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Shell
      id="finalize-title"
      testId="finalize-dialog"
      tinted
      title="ประกาศผลคะแนน"
      subtitle={<>{name} · หลังประกาศผล คะแนนจะถูกล็อก · ถ้าต้องแก้ ต้องเปิดผลใหม่ (ระบุเหตุผล) แล้วประกาศอีกครั้ง</>}
      onClose={onClose}
      footer={(dismiss) => (
        <>
          {closeButton(dismiss)}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              setError(null)
              void onConfirm(Boolean(warning))
                .then((nextWarning) => {
                  if (nextWarning) setWarning(nextWarning)
                  else dismiss()
                })
                .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'ประกาศผลไม่สำเร็จ'))
                .finally(() => setBusy(false))
            }}
            className={btn('primary', 'md', 'px-6')}
          >
            {busy && <Spinner />}
            {warning ? 'ยืนยันประกาศผล' : 'ประกาศผลคะแนน'}
          </button>
        </>
      )}
    >
      {warning && (
        <p
          role="alert"
          className="mt-3 flex gap-2 rounded-2xl bg-info-soft px-4 py-3 text-[13.5px] leading-6 text-info-ink"
        >
          <span aria-hidden="true">⚠</span>
          <span>{warning} · ประกาศได้ คะแนนของรายการนั้นจะแสดงพร้อมป้ายว่าความเชื่อมั่นต่ำ</span>
        </p>
      )}
      <dl className="mt-3 space-y-1.5 rounded-2xl bg-table-head px-4 py-3 text-[14px]">
        {summary.map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <dt>{row.label}</dt>
            <dd className="font-semibold">{row.value}</dd>
          </div>
        ))}
      </dl>
      {error && <ErrorBox title="ยังประกาศผลไม่ได้">{error}</ErrorBox>}
    </Shell>
  )
}

/** Figma J31e · เปิดผลคะแนนใหม่ (บังคับเหตุผล) */
export function ReopenDialog({
  name,
  finalizedLabel,
  onClose,
  onConfirm,
}: {
  name: string
  finalizedLabel: string | null
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Shell
      id="reopen-title"
      testId="reopen-dialog"
      title="เปิดผลคะแนนใหม่?"
      subtitle={[name, finalizedLabel].filter(Boolean).join(' · ')}
      onClose={onClose}
      footer={(dismiss) => (
        <>
          <button type="button" onClick={dismiss} className={btn('ghost', 'md', 'px-6')}>
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setTouched(true)
              if (!reason.trim()) return
              setBusy(true)
              setError(null)
              void onConfirm(reason.trim())
                .then(dismiss)
                .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'เปิดผลใหม่ไม่สำเร็จ'))
                .finally(() => setBusy(false))
            }}
            className={btn('ghost', 'md', 'border-line-neutral px-6 text-err')}
          >
            {busy && <Spinner />}เปิดผลใหม่
          </button>
        </>
      )}
    >
      <div className="mt-2 rounded-2xl bg-err-soft px-4 py-3 text-[13px] leading-6 text-err">
        <p className="font-semibold">คะแนนจะกลับเป็น "ชั่วคราว"</p>
        <p>
          นักศึกษาจะไม่เห็นคะแนนจนกว่าจะประกาศอีกครั้ง · คำร้องอุทธรณ์ที่ค้างอยู่ยังเก็บไว้ · ถ้าต้องให้ประเมินเพิ่ม
          ให้ขยายกำหนดส่งต่อจากนี้
        </p>
      </div>
      <label className="mt-4 block font-display text-[14.5px] font-semibold">
        เหตุผล (บังคับ)
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={2000}
          aria-invalid={touched && !reason.trim()}
          className={`${CTRL} mt-2 min-h-20 font-body font-normal ${touched && !reason.trim() ? 'border-err-field' : ''}`}
        />
      </label>
      {touched && !reason.trim() ? (
        <p className="mt-1.5 text-[12.5px] text-err">✕ กรุณาระบุเหตุผลก่อนเปิดผลใหม่</p>
      ) : (
        <p className="mt-1.5 text-[12px] text-muted">
          ระบบแจ้งนักศึกษาทุกคน (ไม่มีตัวเลขคะแนนในอีเมล) · บันทึก audit พร้อมเหตุผล
        </p>
      )}
      {error && <ErrorBox title="ยังเปิดผลใหม่ไม่ได้">{error}</ErrorBox>}
    </Shell>
  )
}

/** Figma J37 · ส่งออกข้อมูลพร้อมตัวตนผู้ประเมิน — เหตุผลบังคับตาม FR-EXPORT-04 */
export function IdentifiedExportDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Shell
      id="export-identified-title"
      testId="export-identified-dialog"
      tinted
      title="ส่งออกข้อมูลพร้อมตัวตนผู้ประเมิน"
      subtitle={
        <>
          ปกติไฟล์ส่งออกใช้รหัสแทนตัว (E1, E2, …)
          <br />
          ครั้งนี้จะมีอีเมลจริงของผู้ประเมินอยู่ในไฟล์
        </>
      }
      onClose={onClose}
      footer={(dismiss) => (
        <>
          {closeButton(dismiss)}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setTouched(true)
              if (!reason.trim()) return
              setBusy(true)
              setError(null)
              void onConfirm(reason.trim())
                .then(dismiss)
                .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'ส่งออกไม่สำเร็จ'))
                .finally(() => setBusy(false))
            }}
            className={btn('primary', 'md', 'px-6')}
          >
            {busy && <Spinner />}
            {error ? 'ลองส่งออกอีกครั้ง' : 'ส่งออกพร้อมตัวตน'}
          </button>
        </>
      )}
    >
      <p className="mt-3 flex gap-2 rounded-2xl bg-info-soft px-4 py-3 text-[13px] leading-6 text-info-ink">
        <span aria-hidden="true">⚠</span>
        <span>
          เจ้าของห้องเท่านั้นที่ทำได้ · การเข้าถึงครั้งนี้จะถูกบันทึก audit พร้อมชื่อ เวลา และเหตุผล ·
          ไฟล์นี้เปิดเผยได้ว่าใครให้คะแนนใคร
        </span>
      </p>
      <label className="mt-4 block font-display text-[14.5px] font-semibold">
        เหตุผล (บังคับ)
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={2000}
          aria-invalid={touched && !reason.trim()}
          className={`${CTRL} mt-2 min-h-20 font-body font-normal ${touched && !reason.trim() ? 'border-err-field' : ''}`}
        />
      </label>
      {touched && !reason.trim() && <p className="mt-1.5 text-[12.5px] text-err">✕ กรุณาระบุเหตุผลก่อนส่งออก</p>}
      {error && <ErrorBox title="ยังส่งออกไฟล์ไม่ได้">{error} · ตัวเลือกการส่งออกยังอยู่ กรุณาลองใหม่</ErrorBox>}
    </Shell>
  )
}
