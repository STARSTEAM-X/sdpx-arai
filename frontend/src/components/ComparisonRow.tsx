import { useEffect, useRef, useState } from 'react'

import { FOCUS, Pill } from './Ui'
import { IconAlert, IconCheck } from './icons'
import { ApiError, type EvaluationItem, saveComparison } from '../lib/api'
import { COMPARISON_SCALE } from '../lib/scale'

/** AC ของ US-08: "เลือกคำตอบ ผ่านไป 2 วินาทีโดยไม่กดอะไร ระบบบันทึกอัตโนมัติ" */
const AUTOSAVE_DELAY_MS = 2000

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** คู่หนึ่งที่ประเมินได้จริง — เลือกแล้ว autosave เอง ไม่มีปุ่ม "บันทึก" ให้กด
 *
 *  เก็บ state การเลือกไว้ในนี้เอง ไม่ยกขึ้นไปที่ EvaluatePage เพราะการ autosave (PUT)
 *  ไม่เปลี่ยน `completed` ของ item (นั่นต้องรอ submit ใน US-09) — parent จึงไม่มีอะไร
 *  ต้องรู้เพิ่มจากการกดแต่ละครั้ง
 */
export function ComparisonRow({
  item,
  position,
  total,
  readOnly = false,
}: {
  item: EvaluationItem
  /** ลำดับภายในเกณฑ์เดียวกัน — ช่วยให้ผู้ใช้รู้ว่ากำลังดูคู่ไหนจากทั้งหมด */
  position: number
  total: number
  /** FR-EVAL-08 — เลย deadline แล้วต้องแสดงคำตอบแบบ read-only ห้ามแก้ต่อ */
  readOnly?: boolean
}) {
  const [choice, setChoice] = useState<number | null>(item.choice)
  const [state, setState] = useState<SaveState>(item.choice ? 'saved' : 'idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleSelect(value: number) {
    setChoice(value)
    setError(null)
    // เลือกใหม่ = ยังไม่ได้บันทึกค่านี้ — ต้องเคลียร์ "บันทึกแล้ว" ค้างของค่าก่อนหน้าทันที
    // ไม่งั้นจะโชว์ว่าบันทึกแล้วทั้งที่ค่าที่เพิ่งเลือกยังรอ debounce อยู่ (สื่อสารผิด)
    setState('idle')

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setState('saving')
      saveComparison(item.pairAssignmentId, value)
        .then((saved) => {
          setState('saved')
          setSavedAt(saved.savedAt)
        })
        .catch((err: unknown) => {
          setState('error')
          setError(err instanceof ApiError ? err.message : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
        })
    }, AUTOSAVE_DELAY_MS)
  }

  const leftChoices = COMPARISON_SCALE.filter((option) => option.winner === 'left')
  const rightChoices = COMPARISON_SCALE.filter((option) => option.winner === 'right')

  function choiceButton(c: (typeof COMPARISON_SCALE)[number]) {
    const selected = choice === c.id

    return (
      <button
        key={c.id}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => handleSelect(c.id)}
        disabled={readOnly}
        className={`group flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm font-medium transition-colors ${FOCUS} disabled:cursor-not-allowed disabled:opacity-60 ${
          selected ? 'bg-accent-soft text-accent-ink' : 'text-ink-2 hover:bg-sand'
        }`}
      >
        <span
          aria-hidden="true"
          className={`grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
            selected
              ? 'border-brand-600 bg-white'
              : 'border-edge-strong bg-white group-hover:border-muted'
          }`}
        >
          {selected && <span className="size-2.5 rounded-full bg-brand-600" />}
        </span>
        <span>{c.label}</span>
      </button>
    )
  }

  return (
    <li className="rounded-xl border border-edge bg-cream p-4">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <p className="font-display text-sm font-semibold">
          คู่ที่ <span className="font-mono tabular">{position}</span> จาก{' '}
          <span className="font-mono tabular">{total}</span>
        </p>
        {item.completed && (
          <Pill tone="ok" icon={<IconCheck className="size-3" />}>
            ส่งแล้ว
          </Pill>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label={`เปรียบเทียบ ${item.leftLabel} กับ ${item.rightLabel}`}
        className="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-5"
      >
        <div className="min-w-0">
          <div className="grid min-h-20 place-items-center rounded-xl border border-accent-line bg-brand-50 px-3 py-4 text-center">
            <p className="text-xs text-muted">ผลงานฝั่งซ้าย</p>
            <p className="mt-1 font-display text-base font-semibold text-accent-ink wrap-break-word">
              {item.leftLabel}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-1">{leftChoices.map(choiceButton)}</div>
        </div>

        <span
          className="mx-auto grid size-9 place-items-center rounded-full bg-sand font-display text-xs font-semibold text-muted sm:mt-6"
          aria-hidden="true"
        >
          VS
        </span>

        <div className="min-w-0">
          <div className="grid min-h-20 place-items-center rounded-xl border border-comparison-right-line bg-comparison-right-soft px-3 py-4 text-center">
            <p className="text-xs text-muted">ผลงานฝั่งขวา</p>
            <p className="mt-1 font-display text-base font-semibold text-comparison-right-ink wrap-break-word">
              {item.rightLabel}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-1">{rightChoices.map(choiceButton)}</div>
        </div>
      </div>

      <p className="mt-2 flex min-h-[18px] items-center gap-1.5 text-[12.5px]" aria-live="polite">
        {state === 'idle' && choice !== null && (
          <span className="text-muted">เลือกแล้ว — กำลังจะบันทึกอัตโนมัติ…</span>
        )}
        {state === 'saving' && <span className="text-muted">กำลังบันทึก…</span>}
        {state === 'saved' && (
          <span className="flex items-center gap-1.5 text-ok-700">
            <IconCheck className="size-3.5" />
            บันทึกแล้ว
            {savedAt &&
              ` เมื่อ ${new Date(savedAt).toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
              })}`}
          </span>
        )}
        {state === 'error' && (
          <span className="flex items-center gap-1.5 text-err">
            <IconAlert className="size-3.5" />
            {error}
          </span>
        )}
      </p>
    </li>
  )
}
