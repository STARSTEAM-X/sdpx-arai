import { useRef, useState } from 'react'
import { ApiError, type CoveragePair, assignAdditional, submitInstructorComparison } from '../lib/api'
import { ComparisonRow } from './ComparisonRow'
import { Banner, CTRL, btn } from './Ui'

export function CoverageActions({
  pair,
  assignmentId,
  canAssign,
  canReview,
  onChanged,
}: {
  pair: CoveragePair
  assignmentId: string
  canAssign: boolean
  canReview: boolean
  onChanged: () => Promise<boolean>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  // blocked = Figma J27 · ส่งให้ประเมินเพิ่มไม่ได้เพราะไม่มีผู้มีสิทธิ์เหลือ
  const [mode, setMode] = useState<'extra' | 'teacher' | 'blocked' | null>(null)
  const [count, setCount] = useState(1)
  const [choice, setChoice] = useState<number | null>(null)
  const [timeMs, setTimeMs] = useState<number | undefined>()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  function open(next: 'extra' | 'teacher' | 'blocked', button: HTMLButtonElement) {
    trigger.current = button
    setMode(next)
    setCount(1)
    setChoice(null)
    setTimeMs(undefined)
    setReason('')
    setError(null)
    dialog.current?.showModal()
  }
  function close() {
    dialog.current?.close()
    setMode(null)
    trigger.current?.focus()
  }
  async function submit() {
    setBusy(true)
    setError(null)
    const input = { criterionId: pair.criterionId, itemAId: pair.itemAId, itemBId: pair.itemBId, reason: reason.trim() }
    try {
      if (mode === 'extra') {
        const result = await assignAdditional(assignmentId, { ...input, count })
        setNotice(`มอบหมายคู่เพิ่มเติม ${result.pairsAdded} คนแล้ว`)
      } else if (choice !== null) {
        await submitInstructorComparison(assignmentId, { ...input, choice, timeOnTaskMs: timeMs })
        setNotice('บันทึกคำตอบของผู้สอนและคำนวณคะแนนชั่วคราวใหม่แล้ว')
      }
      const loaded = await onChanged()
      if (!loaded) setNotice('บันทึกรายการแล้ว แต่โหลดรายงานใหม่ไม่สำเร็จ กรุณารีเฟรช')
      close()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ทำรายการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <div className="flex flex-wrap justify-end gap-2.5">
        <button
          type="button"
          disabled={!canAssign}
          title={canAssign ? undefined : 'ขยายกำหนดส่งก่อนมอบหมายเพิ่มเติม'}
          onClick={(event) => open(pair.eligibleCount === 0 ? 'blocked' : 'extra', event.currentTarget)}
          className={btn('primary', 'sm', 'order-2')}
        >
          ส่งให้ประเมินเพิ่ม
        </button>
        <button
          type="button"
          disabled={!canReview}
          onClick={(event) => open('teacher', event.currentTarget)}
          className={btn('ghost', 'md', 'border-brand-600 text-accent-ink')}
        >
          ประเมินเอง
        </button>
      </div>
      {notice && (
        <p role="status" className="mt-2 text-xs text-ok-700">
          {notice}
        </p>
      )}
      <dialog
        ref={dialog}
        aria-label={
          mode === 'blocked' ? 'ส่งให้ประเมินเพิ่มไม่ได้' : mode === 'extra' ? 'ส่งให้ประเมินเพิ่ม' : 'ผู้สอนประเมินเอง'
        }
        onCancel={(event) => {
          event.preventDefault()
          if (!busy) close()
        }}
        data-testid="coverage-dialog"
        className={`fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-auto rounded-3xl border border-edge bg-white text-ink shadow-xl backdrop:bg-ink/40 ${mode === 'blocked' ? 'max-w-130 p-0' : 'max-w-3xl p-6'}`}
      >
        {mode === 'blocked' && (
          <>
            <div className="border-b border-edge bg-surface-cream px-6 pt-6 pb-3.5">
              <h2 className="font-display text-[22px] leading-[35px] font-bold">
                ส่งให้ประเมินเพิ่มไม่ได้ — {pair.itemALabel} เทียบ {pair.itemBLabel}
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-5 text-ink-2">
                ผู้มีสิทธิ์ทุกคนได้รับคู่นี้แล้ว หรือเป็นสมาชิกของกลุ่มในคู่
                <br />
                และคนเดิมประเมินคู่เดิมซ้ำในเกณฑ์เดียวกันไม่ได้
              </p>
            </div>
            <dl className="mx-6 my-5 space-y-2 rounded-2xl bg-table-head px-4 py-3.5 text-[13.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">coverage ปัจจุบัน</dt>
                <dd className="font-semibold">
                  {pair.submittedCount} ครั้ง (ควรได้อย่างน้อย {pair.expectedCount})
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">ผู้มีสิทธิ์ที่ยังไม่ได้รับคู่นี้</dt>
                <dd className="font-semibold">0 คน</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">ทางเลือก</dt>
                <dd className="font-semibold">ประเมินเอง หรือแก้คะแนนด้วยมือ</dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2.5 border-t border-edge bg-table-head px-6 py-4">
              <button type="button" onClick={close} className={btn('ghost')}>
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!canReview}
                onClick={() => setMode('teacher')}
                className={btn('primary')}
              >
                ประเมินเอง
              </button>
            </div>
          </>
        )}
        {mode && mode !== 'blocked' && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <h2 className="font-display text-xl font-bold">
              {mode === 'extra' ? 'ส่งให้ประเมินเพิ่ม' : 'ผู้สอนประเมินเอง'}
            </h2>
            <p className="mt-3 text-sm text-muted">
              {pair.criterionName} · {pair.itemALabel} เทียบกับ {pair.itemBLabel}
            </p>
            {mode === 'extra' ? (
              <>
                <Banner tone="info" className="mt-5">
                  เหลือผู้มีสิทธิ์ {pair.eligibleCount} คน ระบบสุ่มจากนักศึกษาที่ยังไม่ได้รับคู่นี้และภาระยังไม่เต็ม
                  โดยไม่มอบหมายให้ประเมินตนเอง
                </Banner>
                <label className="mt-4 block text-sm font-semibold">
                  จำนวนผู้ประเมินเพิ่มเติม
                  <input
                    type="number"
                    min={1}
                    max={Math.min(20, pair.eligibleCount)}
                    value={count}
                    onChange={(event) => setCount(Number(event.target.value))}
                    required
                    disabled={busy}
                    className={`${CTRL} mt-2`}
                  />
                </label>
              </>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-3">
                  {[
                    { label: pair.itemALabel, url: pair.artifactAUrl },
                    { label: pair.itemBLabel, url: pair.artifactBUrl },
                  ].map(
                    (item) =>
                      item.url && (
                        <a
                          key={item.label}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className={btn('ghost', 'sm')}
                        >
                          ดูผลงาน {item.label} ↗
                        </a>
                      ),
                  )}
                </div>
                <ul>
                  <ComparisonRow
                    item={{
                      pairAssignmentId: `${pair.criterionId}-${pair.itemAId}-${pair.itemBId}`,
                      criterionId: pair.criterionId,
                      criterionName: pair.criterionName,
                      leftId: pair.itemAId,
                      rightId: pair.itemBId,
                      leftLabel: pair.itemALabel,
                      rightLabel: pair.itemBLabel,
                      choice,
                      completed: false,
                    }}
                    position={1}
                    total={1}
                    compact
                    readOnly={busy}
                    onSelect={(value, elapsed) => {
                      setChoice(value)
                      setTimeMs(elapsed)
                    }}
                  />
                </ul>
              </>
            )}
            <label className="mt-4 block text-sm font-semibold">
              เหตุผลที่เพิ่มการประเมิน
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                maxLength={2000}
                disabled={busy}
                className={`${CTRL} mt-2 min-h-24`}
              />
            </label>
            {error && (
              <Banner tone="err" role="alert" className="mt-4">
                {error}
              </Banner>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={busy} onClick={close} className={btn('ghost')}>
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={
                  busy ||
                  !reason.trim() ||
                  (mode === 'extra' ? count < 1 || count > pair.eligibleCount : choice === null)
                }
                className={btn('primary')}
              >
                {busy ? 'กำลังบันทึก…' : mode === 'extra' ? 'ยืนยันส่งประเมินเพิ่ม' : 'บันทึกคำตอบผู้สอน'}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  )
}
