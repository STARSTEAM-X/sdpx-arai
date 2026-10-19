import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { btn, FOCUS } from './Ui'
import { IconChevronDown, IconChevronLeft, IconClock, IconClose } from './icons'
import { classroomLocalToUtc } from '../lib/datetime'

type LocalParts = {
  year: number
  month: number
  day: number
  hour: string
  minute: string
}

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))
const QUICK_TIMES = ['09:00', '12:00', '16:30', '23:59']

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dateKey(parts: Pick<LocalParts, 'year' | 'month' | 'day'>): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

function draftValue(parts: LocalParts): string {
  return `${dateKey(parts)}T${parts.hour}:${parts.minute}`
}

function parseValue(value: string): LocalParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: match[4],
    minute: match[5],
  }
}

function zonedToday(timezone: string): Pick<LocalParts, 'year' | 'month' | 'day'> {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  )
  return { year: parts.year, month: parts.month, day: parts.day }
}

function addDays(
  parts: Pick<LocalParts, 'year' | 'month' | 'day'>,
  amount: number,
): Pick<LocalParts, 'year' | 'month' | 'day'> {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

function initialParts(value: string, timezone: string): LocalParts {
  const parsed = parseValue(value)
  if (parsed) return parsed
  return { ...addDays(zonedToday(timezone), 1), hour: '23', minute: '59' }
}

function formatThaiDate(parts: Pick<LocalParts, 'year' | 'month' | 'day'>): string {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)))
}

function formatThaiMonth(year: number, month: number): string {
  return new Intl.DateTimeFormat('th-TH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function timezoneLabel(timezone: string): string {
  if (timezone === 'Asia/Bangkok') return 'เวลาไทย (UTC+7)'
  if (timezone === 'Asia/Tokyo') return 'เวลาญี่ปุ่น (UTC+9)'
  if (timezone === 'UTC') return 'เวลาสากล (UTC)'
  return timezone
}

export function DeadlinePicker({
  id,
  value,
  timezone,
  describedBy,
  onChange,
}: {
  id: string
  value: string
  timezone: string
  describedBy?: string
  onChange: (value: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(() => initialParts(value, timezone))
  const [cursor, setCursor] = useState(() => ({ year: pending.year, month: pending.month }))
  const today = zonedToday(timezone)
  const tomorrow = addDays(today, 1)
  const currentValue = parseValue(value)
  const pendingValue = draftValue(pending)
  const pendingIsPast = classroomLocalToUtc(pendingValue, timezone) <= new Date().toISOString()
  const cursorIsCurrentMonth = cursor.year === today.year && cursor.month === today.month

  const days = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(cursor.year, cursor.month - 1, 1)).getUTCDay()
    const dayCount = new Date(Date.UTC(cursor.year, cursor.month, 0)).getUTCDate()
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: dayCount }, (_, index) => index + 1),
    ]
  }, [cursor])

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  /* ปฏิทินอยู่ในการ์ด/dialog ที่ตั้ง overflow-hidden หรือ overflow-y-auto ไว้ ถ้าวางแบบ absolute
   * ส่วนที่ล้นการ์ดจะถูกตัดจนดูเหมือนจมลงไป จึงยกขึ้น top layer ด้วย Popover API
   * (อยู่เหนือ modal dialog ที่เปิดก่อนหน้าได้ด้วย) แล้ววางตำแหน่งเองจากขอบของปุ่ม */
  useLayoutEffect(() => {
    const panel = popoverRef.current
    const trigger = triggerRef.current
    if (!open || !panel || !trigger) return
    panel.showPopover?.()

    const GAP = 8
    const EDGE = 16
    const MIN_WIDTH = 320
    const MAX_WIDTH = 512
    const place = () => {
      panel.style.maxHeight = ''
      const anchor = trigger.getBoundingClientRect()
      // กว้างเท่าช่องที่กดเปิดและชิดขอบเดียวกัน (ใน dialog จะไม่ล้นกรอบ) แต่ไม่เกิน 32rem
      // และไม่แคบกว่า 320px ซึ่งเป็นความกว้างต่ำสุดที่ปฏิทิน 7 คอลัมน์ยังกดง่าย
      const width = Math.min(Math.max(Math.min(anchor.width, MAX_WIDTH), MIN_WIDTH), window.innerWidth - EDGE * 2)
      panel.style.width = `${width}px`
      const { height } = panel.getBoundingClientRect()
      const below = window.innerHeight - anchor.bottom - GAP - EDGE
      const above = anchor.top - GAP - EDGE
      // ลงล่างก่อน ขึ้นบนเมื่อล่างไม่พอแต่บนพอ — ถ้าไม่พอทั้งคู่แต่ฝั่งที่ว่างกว่ายังมีที่ราวหนึ่งเดือนเต็ม
      // ให้วางฝั่งนั้นแล้วเลื่อนในกล่องนิดหน่อย; ที่เหลือน้อยกว่านั้น (จอเตี้ย/มือถือ) วางกลางจอเป็นแผ่นเดียว
      // ทับปุ่มได้เพราะแผ่นมีหัวเรื่องและปุ่มปิดของตัวเอง ดีกว่ากล่องเตี้ย ๆ ที่ต้องเลื่อนตลอด
      const SIDE_MIN_HEIGHT = 360
      if (height <= below) {
        panel.style.top = `${anchor.bottom + GAP}px`
      } else if (height <= above) {
        panel.style.top = `${anchor.top - GAP - height}px`
      } else if (Math.max(below, above) >= SIDE_MIN_HEIGHT) {
        const downward = below >= above
        const fitted = downward ? below : above
        panel.style.maxHeight = `${fitted}px`
        panel.style.top = `${downward ? anchor.bottom + GAP : anchor.top - GAP - fitted}px`
      } else {
        const fitted = Math.min(height, window.innerHeight - EDGE * 2)
        panel.style.maxHeight = `${fitted}px`
        panel.style.top = `${(window.innerHeight - fitted) / 2}px`
      }
      // ชิดขวาตามปุ่ม แต่ไม่ให้ล้นขอบจอทั้งสองข้าง
      const left = Math.min(Math.max(anchor.right - width, EDGE), window.innerWidth - width - EDGE)
      panel.style.left = `${Math.max(left, EDGE)}px`
    }
    place()
    window.addEventListener('resize', place)
    // capture เพื่อจับการเลื่อนของทุก container ที่ครอบปุ่มอยู่ ไม่ใช่แค่ window
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      // ปกติ React ถอด element ออกไปแล้ว (popover ปิดเอง) — เหลือกรณี effect รันซ้ำขณะยังเปิดอยู่
      if (panel.isConnected && typeof panel.hidePopover === 'function' && panel.matches(':popover-open')) panel.hidePopover()
    }
  }, [open])

  function showPicker() {
    const next = initialParts(value, timezone)
    setPending(next)
    setCursor({ year: next.year, month: next.month })
    setOpen(true)
  }

  function closePicker() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function selectDate(date: Pick<LocalParts, 'year' | 'month' | 'day'>) {
    setPending((current) => ({ ...current, ...date }))
    setCursor({ year: date.year, month: date.month })
  }

  function moveMonth(amount: number) {
    const date = new Date(Date.UTC(cursor.year, cursor.month - 1 + amount, 1))
    setCursor({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 })
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${id}-popover`}
        aria-describedby={describedBy}
        onClick={() => (open ? setOpen(false) : showPicker())}
        className={`flex min-h-13 w-full items-center gap-3 rounded-xl border border-edge-strong bg-white px-3.5 text-left transition-colors hover:border-muted focus:border-brand-600 focus:ring-3 focus:ring-accent-soft ${FOCUS}`}
      >
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
          <IconClock className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm ${currentValue ? 'font-semibold text-ink' : 'text-muted'}`}>
            {currentValue
              ? `${formatThaiDate(currentValue)} เวลา ${currentValue.hour}:${currentValue.minute} น.`
              : 'เลือกวันและเวลา'}
          </span>
          <span className="mt-0.5 block text-xs text-muted">{timezoneLabel(timezone)}</span>
        </span>
        <IconChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          id={`${id}-popover`}
          role="dialog"
          aria-label="เลือกวันและเวลากำหนดส่ง"
          popover="manual"
          // ล้าง inset/margin ตั้งต้นของ [popover] ที่จัดไว้กลางจอ — top/left/width มาจาก effect ด้านบน
          // @container: จัด layout ข้างในตามความกว้างของกล่องเอง ไม่ใช่ความกว้างจอ
          className="@container fixed inset-auto m-0 max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-auto rounded-2xl border border-edge bg-white p-0 text-ink shadow-[0_18px_50px_rgba(23,32,51,0.18)]"
        >
          <div className="flex items-start gap-3 border-b border-edge px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold">เลือกวันและเวลาส่ง</p>
              <p className="mt-0.5 text-xs text-muted">ปี พ.ศ. · เวลา 24 ชั่วโมง · {timezoneLabel(timezone)}</p>
            </div>
            <button type="button" aria-label="ปิด" onClick={closePicker} className={`grid size-9 place-items-center rounded-lg hover:bg-sand ${FOCUS}`}>
              <IconClose className="size-4" />
            </button>
          </div>

          <div className="grid @md:grid-cols-[1.1fr_0.9fr]">
            <section aria-label="เลือกวันที่" className="p-3">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <span className="font-display text-sm font-semibold">{formatThaiMonth(cursor.year, cursor.month)}</span>
                <div className="flex gap-1">
                  <button type="button" disabled={cursorIsCurrentMonth} aria-label="เดือนก่อนหน้า" onClick={() => moveMonth(-1)} className={`grid size-9 place-items-center rounded-lg hover:bg-sand disabled:cursor-not-allowed disabled:opacity-35 ${FOCUS}`}>
                    <IconChevronLeft className="size-4" />
                  </button>
                  <button type="button" aria-label="เดือนถัดไป" onClick={() => moveMonth(1)} className={`grid size-9 place-items-center rounded-lg hover:bg-sand ${FOCUS}`}>
                    <IconChevronLeft className="size-4 rotate-180" />
                  </button>
                </div>
              </div>

              <div className="mb-2.5 flex gap-2">
                <button type="button" onClick={() => selectDate(today)} className={`min-h-10 rounded-lg border border-edge-strong bg-white px-3 text-[13px] font-semibold hover:bg-sand ${FOCUS}`}>วันนี้</button>
                <button type="button" onClick={() => selectDate(tomorrow)} className={`min-h-10 rounded-lg border border-edge-strong bg-white px-3 text-[13px] font-semibold hover:bg-sand ${FOCUS}`}>พรุ่งนี้</button>
              </div>

              <div className="grid grid-cols-7 gap-1" aria-hidden="true">
                {WEEKDAYS.map((weekday) => (
                  <span key={weekday} className="py-1 text-center text-xs text-muted">{weekday}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {days.map((day, index) => {
                  if (day === null) return <span key={`blank-${index}`} aria-hidden="true" />
                  const date = { year: cursor.year, month: cursor.month, day }
                  const isPastDate = dateKey(date) < dateKey(today)
                  const selected = dateKey(date) === dateKey(pending)
                  const isToday = dateKey(date) === dateKey(today)
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isPastDate}
                      aria-pressed={selected}
                      aria-label={`${day} ${formatThaiMonth(cursor.year, cursor.month)}`}
                      onClick={() => selectDate(date)}
                      className={`relative h-9 rounded-lg text-[13px] transition-colors disabled:cursor-not-allowed disabled:text-edge-strong ${FOCUS} ${
                        selected
                          ? 'bg-cta font-semibold text-white hover:bg-cta-hover'
                          : 'hover:bg-accent-soft hover:text-accent-ink'
                      }`}
                    >
                      {day}
                      {isToday && !selected && <span aria-hidden="true" className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-brand-600" />}
                    </button>
                  )
                })}
              </div>
            </section>

            <section aria-label="เลือกเวลาแบบ 24 ชั่วโมง" className="border-edge bg-sand/55 p-3 @md:border-l">
              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <span className="font-display text-sm font-semibold">เวลา</span>
                <span className="text-xs text-muted">รูปแบบ 24 ชั่วโมง</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <label className="text-xs text-muted">
                  ชั่วโมง
                  <select aria-label="ชั่วโมง" value={pending.hour} onChange={(event) => setPending((current) => ({ ...current, hour: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-edge-strong bg-white px-2 font-mono text-base text-ink focus:border-brand-600 focus:ring-3 focus:ring-accent-soft">
                    {HOURS.map((hour) => <option key={hour}>{hour}</option>)}
                  </select>
                </label>
                <span className="pb-2.5 font-semibold">:</span>
                <label className="text-xs text-muted">
                  นาที
                  <select aria-label="นาที" value={pending.minute} onChange={(event) => setPending((current) => ({ ...current, minute: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-edge-strong bg-white px-2 font-mono text-base text-ink focus:border-brand-600 focus:ring-3 focus:ring-accent-soft">
                    {MINUTES.map((minute) => <option key={minute}>{minute}</option>)}
                  </select>
                </label>
              </div>

              <p className="mb-2 mt-3.5 text-xs text-muted">เวลาที่ใช้บ่อย</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_TIMES.map((time) => {
                  const [hour, minute] = time.split(':')
                  const selected = pending.hour === hour && pending.minute === minute
                  return (
                    <button key={time} type="button" aria-pressed={selected} onClick={() => setPending((current) => ({ ...current, hour, minute }))} className={`min-h-9 rounded-lg border px-2.5 font-mono text-xs ${FOCUS} ${selected ? 'border-accent-line bg-accent-soft text-accent-ink' : 'border-edge-strong bg-white hover:bg-sand'}`}>
                      {time}
                    </button>
                  )
                })}
              </div>

              <div className={`mt-3.5 rounded-xl border px-3 py-2 text-xs ${pendingIsPast ? 'border-err-line bg-err-soft text-err' : 'border-ok-line bg-ok-50 text-ok-700'}`} aria-live="polite">
                <b className="block font-display font-semibold">กำหนดส่ง {formatThaiDate(pending)} เวลา {pending.hour}:{pending.minute} น.</b>
                <span>{pendingIsPast ? 'เวลานี้ผ่านไปแล้ว กรุณาเลือกเวลาใหม่' : timezoneLabel(timezone)}</span>
              </div>
            </section>
          </div>

          <div className="flex justify-end gap-2 border-t border-edge px-3.5 py-2.5 @max-md:grid @max-md:grid-cols-2">
            <button type="button" onClick={closePicker} className={btn('ghost', 'sm')}>ยกเลิก</button>
            <button type="button" disabled={pendingIsPast} onClick={() => { onChange(pendingValue); closePicker() }} className={btn('primary', 'sm')}>ยืนยันกำหนดส่ง</button>
          </div>
        </div>
      )}
    </div>
  )
}
