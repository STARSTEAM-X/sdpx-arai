import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Card, CardHead, Pill, btn, FOCUS } from './Ui'
import { IconArrowRight, IconClipboardCheck, IconTransparentScore } from './icons'
import { ApiError, type AssignmentSummary, listClassroomAssignments } from '../lib/api'
import { formatDeadline } from '../lib/datetime'
import { AssignmentActions } from './AssignmentActions'

const STATUS_LABEL: Record<AssignmentSummary['status'], string> = {
  DRAFT: 'ร่าง',
  PUBLISHED: 'เปิดให้ประเมิน',
  OPEN: 'เปิดให้ประเมิน',
  CLOSED: 'ปิดรับแล้ว',
  FINALIZED: 'ประกาศผลแล้ว',
  ARCHIVED: 'เก็บถาวร',
}

/** รายการงานประเมินของห้องเรียน — จุดเข้าเดียวที่นักศึกษามีไปหน้าประเมิน (US-07)
 *
 *  ก่อนหน้านี้นักศึกษาเปิดห้องเรียนแล้วเห็นแค่รายชื่อ ไม่มีทางไปต่อได้เลยแม้จะมีงาน
 *  ประกาศแล้วก็ตาม — การ์ดนี้คือช่องว่างที่ปิดให้ครบ ไม่ใช่แค่ backend มี endpoint
 */
export function AssignmentsToEvaluateCard({ classroomId, version = 0, student = false, timezone = 'Asia/Bangkok', onChanged, readOnly = false }: { classroomId: string; version?: number; student?: boolean; timezone?: string; onChanged?: () => void; readOnly?: boolean }) {
  const [items, setItems] = useState<AssignmentSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState('ALL')
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
  const visible = items.filter((item) => filter === 'ALL' || (filter === 'FINALIZED' ? item.status === 'FINALIZED' : item.status !== 'FINALIZED' && (item.submittedCount ?? 0) < (item.assignedCount ?? 0)))
  const done = (item: AssignmentSummary) => item.status === 'FINALIZED' || ((item.assignedCount ?? 0) > 0 && (item.submittedCount ?? 0) >= (item.assignedCount ?? 0))
  const studentItems = [...visible].sort((a, b) => Number(done(a)) - Number(done(b)))

  if (student) return <section aria-labelledby="h-evaluations">
    <div role="group" aria-label="กรองงานประเมิน" className="mb-5 flex flex-wrap gap-2">
      {[['ALL', 'ทั้งหมด'], ['PENDING', 'ยังไม่ได้ประเมิน'], ['FINALIZED', 'ออกคะแนนแล้ว']].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${FOCUS} ${filter === value ? 'border-cta bg-cta text-white' : 'border-edge-strong bg-white text-ink-2'}`}>{label}</button>)}
    </div>
    <h2 id="h-evaluations" className="sr-only">งานประเมิน</h2>
    {error && <p role="alert" className="mb-4 text-sm text-err">{error}</p>}
    {loaded && visible.length === 0 && <Card className="p-6 text-sm text-muted">ยังไม่มีงานประเมินตามตัวกรองที่เลือก</Card>}
    <div className="space-y-3">
      {studentItems.map((item, index) => {
        const scheduled = Boolean(item.opensAtUtc && Date.parse(item.opensAtUtc) > now)
        const expired = Math.max(Date.parse(item.groupDeadlineUtc), Date.parse(item.individualDeadlineUtc ?? item.groupDeadlineUtc)) <= now
        const finalized = item.status === 'FINALIZED'
        const complete = (item.assignedCount ?? 0) > 0 && (item.submittedCount ?? 0) >= (item.assignedCount ?? 0)
        return <div key={item.id}>{(index === 0 || done(studentItems[index - 1]) !== done(item)) && <h2 className="mb-4 pt-1 font-display text-lg font-bold">{done(item) ? 'งานประเมินที่ทำไปแล้ว' : 'งานประเมิน'}</h2>}<Card radius="md" shadow={false} surface={expired && !finalized ? 'sand' : 'white'} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold">{item.name}</h3>
            {finalized && <Pill tone="ok">ประกาศผลแล้ว</Pill>}
          </div>
          <p className={`mt-2 text-xs ${expired && !finalized ? 'text-err' : 'text-muted'}`}>{finalized ? 'ประกาศผลแล้ว' : scheduled ? `เปิดรับ ${formatDeadline(item.opensAtUtc!, timezone)}` : expired ? 'หมดเวลา' : `ปิดรับ ${formatDeadline(item.groupDeadlineUtc, timezone)}`}</p>
          {!finalized && <div className="mt-3"><Pill tone={complete ? 'ok' : 'warn'} className="px-3 py-2">{complete ? 'ส่งคำตอบครบแล้ว' : `ต้องประเมิน ${Math.max(0, (item.assignedCount ?? 0) - (item.submittedCount ?? 0))} ข้อ`}</Pill></div>}
          <Link to={`/classrooms/${classroomId}/assignments/${item.id}/${finalized ? 'score' : 'evaluate'}`} data-testid={`${finalized ? 'score' : 'evaluate'}-link-${item.id}`} className={btn(finalized || expired ? 'ghost' : 'primary', 'md', 'mt-4 w-full')}>
            {finalized ? 'ดูคะแนน' : scheduled ? 'ดูเวลาเปิดรับ' : expired || complete ? 'ดูคำตอบ' : 'ไปประเมิน'}
          </Link>
        </Card></div>
      })}
    </div>
  </section>

  return (
    <Card>
      <CardHead
        id="h-evaluations"
        icon={<IconClipboardCheck className="size-5" />}
        title="งานประเมิน"
        hint="สถานะล่าสุดของแต่ละงาน"
      />

      <div className="flex flex-col gap-2 p-6 max-sm:p-4">
        {error && (
          <p role="alert" className="text-sm text-err">
            {error}
          </p>
        )}

        {items.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-edge px-4 py-3"
          >
            <span className="font-display font-medium">{a.name}</span>
            <Pill tone={a.status === 'DRAFT' ? 'neutral' : 'ok'} className="ml-auto">
              {STATUS_LABEL[a.status]}
            </Pill>

            {/* ประกาศผลแล้วให้ไปดูคะแนนแทน — คำตอบปิดแก้ไขอยู่แล้ว ไปหน้าประเมินซ้ำไม่มีประโยชน์ (US-10) */}
            {a.status === 'FINALIZED' ? (
              <Link
                to={`/classrooms/${classroomId}/assignments/${a.id}/score`}
                data-testid={`score-link-${a.id}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-accent-ink transition-colors hover:underline"
              >
                ดูคะแนน
                <IconTransparentScore className="size-4" />
              </Link>
            ) : (
              <Link
                to={`/classrooms/${classroomId}/assignments/${a.id}/evaluate`}
                data-testid={`evaluate-link-${a.id}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-accent-ink transition-colors hover:underline"
              >
                ประเมิน
                <IconArrowRight className="size-4" />
              </Link>
            )}
            {onChanged && !readOnly && <AssignmentActions item={a} classroomId={classroomId} timezone={timezone} onChanged={onChanged} />}
            {onChanged && a.status !== 'DRAFT' && <Link to={`/classrooms/${classroomId}/assignments/${a.id}/quality`} className={btn('ghost', 'sm')}>รายงานคุณภาพ</Link>}
          </div>
        ))}
      </div>
    </Card>
  )
}
