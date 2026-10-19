import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { btn, FOCUS } from './Ui'
import { formatDeadline, thaiDate } from '../lib/datetime'
import { ApiError, type AssignmentSummary, listClassroomAssignments } from '../lib/api'
import { AssignmentActions } from './AssignmentActions'

/** รายการงานประเมินของห้องเรียน — จุดเข้าเดียวที่นักศึกษามีไปหน้าประเมิน (US-07)
 *
 *  ก่อนหน้านี้นักศึกษาเปิดห้องเรียนแล้วเห็นแค่รายชื่อ ไม่มีทางไปต่อได้เลยแม้จะมีงาน
 *  ประกาศแล้วก็ตาม — การ์ดนี้คือช่องว่างที่ปิดให้ครบ ไม่ใช่แค่ backend มี endpoint
 */
export function AssignmentsToEvaluateCard({
  classroomId,
  version = 0,
  student = false,
  timezone = 'Asia/Bangkok',
  onChanged,
  readOnly = false,
}: {
  classroomId: string
  version?: number
  student?: boolean
  timezone?: string
  onChanged?: () => void
  readOnly?: boolean
}) {
  const [items, setItems] = useState<AssignmentSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    listClassroomAssignments(classroomId)
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'โหลดรายการงานประเมินไม่สำเร็จ')
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [classroomId, version])

  if (loaded && items.length === 0 && !error && !student) return null
  if (student)
    return <StudentAssignments classroomId={classroomId} items={items} loaded={loaded} error={error} now={now} />

  const short = (iso: string) => thaiDate(iso, { year: false })

  // Figma J12 / J16 — รายการงานของผู้สอนบนหน้าภาพรวมห้อง
  return (
    <section aria-labelledby="h-evaluations" className="overflow-hidden rounded-3xl border border-edge bg-white">
      <div className="border-b border-edge bg-surface-cream px-5 py-5">
        <h2 id="h-evaluations" className="font-display text-[17px] font-semibold">
          งานประเมิน
        </h2>
        <p className="mt-1 text-[14px] text-ink-2">สถานะล่าสุดของแต่ละงาน</p>
      </div>
      {error && (
        <p role="alert" className="px-5 pt-4 text-sm text-err">
          {error}
        </p>
      )}
      {loaded && items.length === 0 ? (
        <div className="px-5 py-6 text-[15px]">
          <p>ยังไม่มีงานประเมิน</p>
          <p>กด "สร้างงานประเมิน" ด้านบนเพื่อเริ่ม</p>
        </div>
      ) : (
        <ul className="divide-y divide-edge">
          {items.map((a) => {
            const expired = Date.parse(a.groupDeadlineUtc) <= now
            const label =
              a.status === 'DRAFT'
                ? 'ร่าง'
                : a.status === 'FINALIZED'
                  ? 'ประกาศผลแล้ว'
                  : expired
                    ? 'ปิดรับแล้ว'
                    : 'เปิดให้ประเมิน'
            const tone =
              a.status === 'DRAFT'
                ? 'bg-neutral-soft text-ink-2'
                : a.status === 'FINALIZED'
                  ? 'bg-ok-50 text-ok-700'
                  : expired
                    ? 'bg-caution-soft text-warn'
                    : 'bg-info-soft text-info-ink'
            const meta = [
              a.publishedAt ? `เผยแพร่ ${short(a.publishedAt)}` : a.status === 'DRAFT' ? 'ยังไม่เผยแพร่' : null,
              `${expired ? 'ปิดรับแล้ว' : 'ปิดรับ'} ${formatDeadline(a.groupDeadlineUtc, timezone)}`,
              a.status !== 'DRAFT' && a.studentCount != null
                ? `ส่งแล้ว ${a.submittedStudents ?? 0} / ${a.studentCount} คน`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-5">
                <div className="min-w-0 flex-1 text-[15px]">
                  <p className="text-[16px]">{a.name}</p>
                  <p className="mt-0.5 text-ink-2">{meta}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-display text-[13.5px] font-semibold ${tone}`}
                >
                  {a.status !== 'DRAFT' && !expired ? '✓ ' : ''}
                  {label}
                </span>
                {a.status === 'DRAFT' ? (
                  <Link
                    to={`/classrooms/${classroomId}?draft=${a.id}#assignments`}
                    className={btn('ghost', 'md', 'min-h-11 border-brand-600 px-6 text-accent-ink')}
                  >
                    แก้ไขร่าง
                  </Link>
                ) : (
                  <Link
                    to={`/classrooms/${classroomId}/assignments/${a.id}`}
                    data-testid={`${a.status === 'FINALIZED' ? 'score' : 'evaluate'}-link-${a.id}`}
                    className={btn('ghost', 'md', 'min-h-11 border-brand-600 px-6 text-accent-ink')}
                  >
                    ดูงานประเมิน
                  </Link>
                )}
                {onChanged && !readOnly && a.status === 'DRAFT' && (
                  <AssignmentActions item={a} classroomId={classroomId} timezone={timezone} onChanged={onChanged} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}


function submittedOn(iso: string): string {
  return `ส่งเมื่อ ${thaiDate(iso, { long: true })}`
}

/** "เหลือเวลา 1 วัน 10 ชม." ตาม Figma ST13 */
function remaining(deadlineMs: number, now: number): string {
  const minutes = Math.max(0, Math.floor((deadlineMs - now) / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `เหลือเวลา ${days} วัน ${hours} ชม.`
  if (hours > 0) return `เหลือเวลา ${hours} ชม. ${minutes % 60} นาที`
  return `เหลือเวลา ${minutes % 60} นาที`
}

type StudentFilter = 'FINALIZED' | 'PENDING' | null

/** รายการงานของนักศึกษาในหน้าห้อง — Figma ST13 (ทั้งหมด) และ ST14 (กรองออกคะแนนแล้ว) */
function StudentAssignments({
  classroomId,
  items,
  loaded,
  error,
  now,
}: {
  classroomId: string
  items: AssignmentSummary[]
  loaded: boolean
  error: string | null
  now: number
}) {
  const [filter, setFilter] = useState<StudentFilter>(null)
  const complete = (item: AssignmentSummary) =>
    (item.assignedCount ?? 0) > 0 && (item.submittedCount ?? 0) >= (item.assignedCount ?? 0)
  const done = (item: AssignmentSummary) => item.status === 'FINALIZED' || complete(item)
  const matches = (item: AssignmentSummary) =>
    filter === null || (filter === 'FINALIZED' ? item.status === 'FINALIZED' : !done(item))
  const pending = items.filter((item) => !done(item) && matches(item))
  const finished = items.filter((item) => done(item) && matches(item))

  const chip = (value: Exclude<StudentFilter, null>, label: string) => {
    const active = filter === value
    const tone =
      value === 'FINALIZED'
        ? active
          ? 'border-ok-700 bg-[#b8e3cc] text-ok-700'
          : 'border-cta bg-white text-accent-ink'
        : active
          ? 'border-cta bg-accent-soft text-accent-ink'
          : 'border-cta bg-white text-accent-ink'
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => setFilter(active ? null : value)}
        className={`inline-flex min-h-10 items-center rounded-full border px-5 font-display text-[13.5px] font-semibold ${value === 'FINALIZED' ? 'max-sm:order-2' : ''} ${FOCUS} ${tone}`}
      >
        {label}
      </button>
    )
  }

  const card = (item: AssignmentSummary) => {
    const deadline = Math.max(
      Date.parse(item.groupDeadlineUtc),
      Date.parse(item.individualDeadlineUtc ?? item.groupDeadlineUtc),
    )
    const scheduled = Boolean(item.opensAtUtc && Date.parse(item.opensAtUtc) > now)
    const expired = deadline <= now
    const finalized = item.status === 'FINALIZED'
    const isDone = done(item)
    const left = Math.max(0, (item.assignedCount ?? 0) - (item.submittedCount ?? 0))
    const muted = expired && !isDone
    const meta = isDone
      ? item.submittedAt
        ? submittedOn(item.submittedAt)
        : finalized
          ? 'ประกาศผลแล้ว'
          : 'ส่งคำตอบครบแล้ว'
      : scheduled
        ? `เปิดรับ ${new Date(item.opensAtUtc!).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}`
        : expired
          ? 'หมดเวลา'
          : remaining(deadline, now)
    const to = `/classrooms/${classroomId}/assignments/${item.id}/${isDone ? 'score' : 'evaluate'}`
    // Figma M03 — บนมือถือเพิ่มเวลาปิดรับต่อท้าย และย้ายป้าย "ต้องประเมิน" ลงใต้ชื่องาน
    const closes =
      !isDone && !expired && !scheduled
        ? ` · ปิดรับ ${formatDeadline(new Date(deadline).toISOString(), 'Asia/Bangkok')}`
        : ''
    return (
      <li
        key={item.id}
        className={`flex min-h-25 flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-edge px-5 py-4 max-sm:rounded-2xl max-sm:p-4 ${muted ? 'bg-[#f6f6f6]' : 'bg-white'}`}
      >
        <div className="min-w-0 flex-1">
          <h3 className={`font-display text-[17px] font-semibold ${muted ? 'text-muted' : ''}`}>{item.name}</h3>
          <p
            className={`mt-1 text-[12.5px] ${!isDone ? (expired ? 'text-err sm:text-accent-ink' : 'text-accent-ink') : 'text-muted'}`}
          >
            {meta}
            <span className="sm:hidden">{closes}</span>
          </p>
          {!isDone && !expired && left > 0 && (
            <span className="mt-3 inline-flex min-h-9 items-center rounded-full bg-[#fbf0d9] px-3.5 font-display text-[13px] font-semibold text-[#7a5200] sm:hidden">
              ต้องประเมิน {left} ข้อ
            </span>
          )}
        </div>
        {!isDone && !expired && left > 0 && (
          <span className="rounded-full bg-peach px-5 py-0.5 text-[11.5px] text-accent-ink max-sm:hidden">
            ต้องประเมิน {left} ข้อ
          </span>
        )}
        {isDone && finalized && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-line bg-ok-50 px-5 py-0.5 text-[11.5px] text-ok-700">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3">
              <path
                d="m3 8.5 3 3 7-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            ประกาศผลแล้ว
          </span>
        )}
        {isDone && !finalized && (
          <span className="rounded-full border border-[#9a918b] bg-[#f3f1ef] px-4 py-0.5 text-[11.5px] text-ink-2">
            ยังไม่ประกาศผล
          </span>
        )}
        <Link
          to={to}
          data-testid={`${isDone ? 'score' : 'evaluate'}-link-${item.id}`}
          className={
            muted || (isDone && !finalized)
              ? btn(
                  'ghost',
                  'sm',
                  'min-h-10 border-line-neutral bg-[#f6f6f6] px-4 text-muted max-sm:min-h-12 max-sm:w-full max-sm:text-[15px]',
                )
              : isDone
                ? btn(
                    'primary',
                    'sm',
                    'min-h-10 px-4 max-sm:min-h-12 max-sm:w-full max-sm:border max-sm:border-ink max-sm:bg-white max-sm:text-[15px] max-sm:text-ink',
                  )
                : btn('primary', 'sm', 'min-h-10 px-4 max-sm:min-h-12 max-sm:w-full max-sm:text-[15px]')
          }
        >
          {isDone ? 'ดูคะแนน' : scheduled ? 'ดูเวลาเปิดรับ' : 'ไปประเมิน'}
        </Link>
      </li>
    )
  }

  return (
    <section aria-labelledby="h-evaluations">
      <div role="group" aria-label="กรองงานประเมิน" className="flex flex-wrap items-center gap-2.5 max-sm:gap-2">
        <span className="mr-0.5 font-display text-[16px] font-semibold max-sm:hidden">Sort by</span>
        <button
          type="button"
          aria-pressed={filter === null}
          onClick={() => setFilter(null)}
          className={`inline-flex min-h-10 items-center rounded-full border px-4 font-display text-[13.5px] font-semibold sm:hidden ${FOCUS} ${filter === null ? 'border-cta bg-cta text-white' : 'border-edge bg-white text-ink'}`}
        >
          ทั้งหมด
        </button>
        {chip('FINALIZED', 'ออกคะแนนแล้ว')}
        {chip('PENDING', 'ยังไม่ได้ประเมิน')}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-err">
          {error}
        </p>
      )}

      <h2 id="h-evaluations" className="mt-5 font-display text-[20px] font-bold max-sm:text-[17px]">
        {filter ? 'งานประเมินใหม่' : 'งานประเมิน'}
      </h2>
      {loaded && pending.length === 0 ? (
        <p className="py-6 text-center text-[17px] text-muted">ไม่พบงานประเมิน</p>
      ) : (
        <ul className="mt-5 space-y-5">{pending.map(card)}</ul>
      )}
      {filter !== 'PENDING' && (
        <>
          <h2 className="mt-8 font-display text-[20px] font-bold max-sm:text-[17px]">งานประเมินที่ทำไปแล้ว</h2>
          {loaded && finished.length === 0 ? (
            <p className="py-6 text-center text-[17px] text-muted">ไม่พบงานประเมิน</p>
          ) : (
            <ul className="mt-5 space-y-5">{finished.map(card)}</ul>
          )}
        </>
      )}
    </section>
  )
}
