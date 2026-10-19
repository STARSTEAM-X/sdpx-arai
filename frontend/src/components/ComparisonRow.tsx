import { useEffect, useRef } from 'react'
import { FOCUS, Pill } from './Ui'
import { IconAlert, IconCheck } from './icons'
import { type EvaluationItem } from '../lib/api'
import { type Draft } from '../lib/comparisonQueue'
import { COMPARISON_SCALE } from '../lib/scale'

/** Controlled by the page queue so changing side cannot discard a pending answer. */
export function ComparisonRow({
  item,
  position,
  total,
  readOnly = false,
  draft,
  onSelect,
  compact = false,
}: {
  item: EvaluationItem
  /** ลำดับภายในเกณฑ์เดียวกัน — ช่วยให้ผู้ใช้รู้ว่ากำลังดูคู่ไหนจากทั้งหมด */
  position: number
  total: number
  /** FR-EVAL-08 — เลย deadline แล้วต้องแสดงคำตอบแบบ read-only ห้ามแก้ต่อ */
  readOnly?: boolean
  draft?: Draft
  onSelect: (value: number, timeOnTaskMs?: number) => void
  compact?: boolean
}) {
  const choice = draft?.choice ?? item.choice
  const state = draft?.state ?? (item.choice ? 'saved' : 'idle')
  const root = useRef<HTMLLIElement>(null)
  const timing = useRef({ elapsed: draft?.timeOnTaskMs ?? 0, started: null as number | null })
  useEffect(() => {
    let visible = false
    const sync = () => {
      const current = timing.current
      if (current.started !== null) current.elapsed += performance.now() - current.started
      current.started = visible && document.visibilityState === 'visible' && !readOnly ? performance.now() : null
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    if (root.current) observer.observe(root.current)
    document.addEventListener('visibilitychange', sync)
    return () => { visible = false; sync(); observer.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [readOnly])
  const choose = (value: number) => onSelect(value, Math.round(timing.current.elapsed + (timing.current.started === null ? 0 : performance.now() - timing.current.started)))

  function choiceButton(c: (typeof COMPARISON_SCALE)[number]) {
    const selected = choice === c.id
    const left = c.winner === 'left'
    const circleSize = c.strength === 3 ? 'size-12' : c.strength === 2 ? 'size-9' : 'size-6'
    const circleColor = left
      ? c.strength === 3 ? 'bg-cta' : c.strength === 2 ? 'bg-[#EF7021]' : 'bg-[#FAC29F]'
      : c.strength === 3 ? 'bg-info-ink' : c.strength === 2 ? 'bg-[#5486CE]' : 'bg-[#9DB8F4]'

    return (
      <button
        key={c.id}
        type="button"
        role="radio"
        tabIndex={choice === c.id || (choice === null && c.id === 1) ? 0 : -1}
        aria-checked={selected}
        aria-label={`${c.winner === 'left' ? item.leftLabel : item.rightLabel} ${c.label.replace(/^(ซ้าย|ขวา)/, '')}`}
        onClick={() => choose(c.id)}
        onKeyDown={(event) => {
          if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const next = event.key === 'Home' ? 1 : event.key === 'End' ? 6 : ((c.id - 1 + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 5)) % 6) + 1
          choose(next)
          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next - 1]?.focus()
        }}
        disabled={readOnly}
        className={`group flex min-h-29 min-w-0 flex-col items-center justify-center gap-3 rounded-2xl px-1 py-4 text-center text-xs font-medium transition-colors max-sm:min-h-12 max-sm:flex-row max-sm:justify-start max-sm:rounded-xl max-sm:border max-sm:border-edge max-sm:px-4 max-sm:py-2 max-sm:text-left max-sm:text-sm ${FOCUS} disabled:cursor-not-allowed disabled:opacity-60 ${
          selected
            ? left ? 'bg-peach text-accent-ink' : 'bg-info-soft text-info-ink'
            : left ? 'text-accent-ink hover:bg-accent-soft/60' : 'text-info-ink hover:bg-info-soft/50'
        }`}
      >
        <span
          aria-hidden="true"
          className={`shrink-0 rounded-full transition-transform group-hover:scale-110 max-sm:size-5 ${circleSize} ${circleColor}`}
        />
        <span className={`leading-5 ${selected || c.strength === 2 ? 'font-semibold' : ''}`}><span className="hidden sm:inline">{c.label.replace(/^(ซ้าย|ขวา)/, '')}</span><span className="sm:hidden">{left ? item.leftLabel : item.rightLabel} {c.label.replace(/^(ซ้าย|ขวา)/, '')}</span></span>
        {selected && <IconCheck aria-hidden="true" className="ml-auto size-4 sm:hidden" />}
      </button>
    )
  }

  return (
    <li ref={root} className={compact ? '' : 'rounded-[20px] border border-edge bg-white p-5 max-sm:p-3.5'}>
      <div className={`${compact ? 'hidden' : 'flex'} flex-wrap items-center justify-between gap-3`}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="mr-1 font-display text-base font-bold" title={`คู่ที่ ${position} จาก ${total}`}>
            คู่ที่ <span className="tabular">{position}</span>
          </p>
          <span className="max-w-full rounded-xl bg-accent-soft px-3 py-2 font-display text-sm font-semibold text-ink wrap-break-word">
            {item.leftLabel}
          </span>
          <span className="text-xs text-muted">เทียบกับ</span>
          <span className="max-w-full rounded-xl bg-info-soft px-3 py-2 font-display text-sm font-semibold text-ink wrap-break-word">
            {item.rightLabel}
          </span>
        </div>
        {item.completed && (
          <Pill tone="ok" icon={<IconCheck className="size-3" />}>
            ส่งแล้ว
          </Pill>
        )}
        {!item.completed && choice === null && <Pill tone="warn">ยังไม่ได้ตอบ</Pill>}
      </div>

      <div className={compact ? 'rounded-2xl border border-edge p-5.25 max-sm:border-0 max-sm:p-0' : ''}>
        <div className={`${compact ? '' : 'mt-4'} flex justify-between gap-4 text-[15px] font-semibold max-sm:hidden`} aria-hidden="true">
          <span className="min-w-0 text-accent-ink wrap-break-word">{item.leftLabel} ดีกว่า</span>
          <span className="min-w-0 text-right text-info-ink wrap-break-word">{item.rightLabel} ดีกว่า</span>
        </div>
        <div
          role="radiogroup"
          aria-label={`เปรียบเทียบ ${item.leftLabel} กับ ${item.rightLabel}`}
          className="mt-5 grid grid-cols-1 items-stretch gap-2 max-sm:mt-3 sm:grid-cols-6"
        >
          {COMPARISON_SCALE.map(choiceButton)}
        </div>
      </div>

      <p className="mt-5 flex min-h-5 items-center gap-1.5 text-[14px] font-semibold max-sm:mt-4 max-sm:text-xs" aria-live="polite">
        {choice === null && state !== 'error' && <span className="text-ink-2">ยังไม่ได้เลือกคำตอบ</span>}
        {choice !== null && state !== 'error' && (() => {
          const picked = COMPARISON_SCALE.find((entry) => entry.id === choice)
          if (!picked) return null
          const left = picked.winner === 'left'
          return (
            <span className={left ? 'text-accent-ink' : 'text-info-ink'}>
              คำตอบของคุณ: {left ? item.leftLabel : item.rightLabel} {picked.label.replace(/^(ซ้าย|ขวา)/, '')}
              {(state === 'pending' || state === 'saving') && <span className="ml-2 font-normal text-muted">กำลังบันทึก…</span>}
              {/* Figma ไม่แสดงข้อความนี้ แต่ผู้ใช้ screen reader ควรรู้ว่าคำตอบถึง server แล้ว */}
              {state === 'saved' && <span className="sr-only"> · บันทึกแล้ว</span>}
            </span>
          )
        })()}
        {state === 'error' && (
          <span className="flex items-center gap-1.5 text-err">
            <IconAlert className="size-3.5" />
            {draft?.error} — {draft?.retryable === false ? 'กรุณาโหลดรายการใหม่เพื่อตรวจสถานะ' : 'จะลองบันทึกอีกครั้งเมื่อเชื่อมต่อ'}
          </span>
        )}
      </p>
    </li>
  )
}
