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
  readOnly = false,
}: {
  item: EvaluationItem
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

  return (
    <li className="rounded-xl border border-edge p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display font-medium">
          {item.leftLabel} <span className="font-normal text-muted">เทียบกับ</span>{' '}
          {item.rightLabel}
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
        className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
      >
        {COMPARISON_SCALE.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={choice === c.id}
            onClick={() => handleSelect(c.id)}
            disabled={readOnly}
            className={`min-h-11 rounded-lg border px-2 text-[12.5px] font-medium transition-colors ${FOCUS} disabled:cursor-not-allowed disabled:opacity-60 ${
              choice === c.id
                ? 'border-accent-line bg-accent-soft text-accent-ink'
                : 'border-edge-strong bg-white text-ink-2 hover:bg-sand'
            }`}
          >
            {c.label}
          </button>
        ))}
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
