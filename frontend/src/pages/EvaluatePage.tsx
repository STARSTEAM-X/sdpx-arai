import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ComparisonRow } from '../components/ComparisonRow'
import { Banner, Card, CardHead, FOCUS, btn } from '../components/Ui'
import {
  IconArrowRight,
  IconChevronLeft,
  IconCircleDashed,
  IconClock,
  IconLock,
  LogoMark,
} from '../components/icons'
import {
  ApiError,
  type CriterionSide,
  type EvaluationItem,
  type MyEvaluations,
  getMyEvaluations,
  listClassrooms,
  submitEvaluations,
} from '../lib/api'
import { formatDeadline } from '../lib/datetime'

const SIDE_LABEL: Record<CriterionSide, string> = {
  GROUP: 'ระดับกลุ่ม',
  INDIVIDUAL: 'รายบุคคล',
}

type BySide = Record<CriterionSide, MyEvaluations | null>

function groupByCriterion(items: EvaluationItem[]) {
  const order: string[] = []
  const map = new Map<string, { criterionName: string; items: EvaluationItem[] }>()
  for (const item of items) {
    if (!map.has(item.criterionId)) {
      map.set(item.criterionId, { criterionName: item.criterionName, items: [] })
      order.push(item.criterionId)
    }
    map.get(item.criterionId)?.items.push(item)
  }
  return order.map((id) => {
    const group = map.get(id)
    return { criterionId: id, criterionName: group?.criterionName ?? '', items: group?.items ?? [] }
  })
}

export default function EvaluatePage() {
  const { classroomId = '', assignmentId = '' } = useParams()

  const [side, setSide] = useState<CriterionSide>('GROUP')
  const [data, setData] = useState<BySide>({ GROUP: null, INDIVIDUAL: null })
  const [timezone, setTimezone] = useState('UTC')
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [group, individual, classrooms] = await Promise.all([
        getMyEvaluations(assignmentId, 'GROUP'),
        getMyEvaluations(assignmentId, 'INDIVIDUAL'),
        listClassrooms(),
      ])
      setData({ GROUP: group, INDIVIDUAL: individual })

      // AC ของ US-07 บังคับให้แสดงเวลาตาม timezone ของห้องเรียน ไม่ใช่ของเครื่องผู้ใช้
      const room = classrooms.items.find((c) => c.id === classroomId)
      if (room) setTimezone(room.timezone)

      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดรายการที่ต้องประเมินไม่สำเร็จ')
    } finally {
      setLoaded(true)
    }
  }, [assignmentId, classroomId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // สลับ side แล้วล้างผลของการส่งครั้งก่อน — ข้อความ "ส่งสำเร็จ" ของฝั่งเดิมไม่ควรค้างข้ามฝั่ง
  useEffect(() => {
    setSubmitResult(null)
  }, [side])

  const current = data[side]
  const sections = useMemo(() => groupByCriterion(current?.items ?? []), [current])

  const progressPct =
    current && current.totalCount > 0
      ? Math.round((current.completedCount / current.totalCount) * 100)
      : 0

  // FR-EVAL-08 — เลย deadline แล้วต้องปิดการแก้ไข ไม่ใช่แค่ปิดปุ่มส่ง
  const deadlinePassed = Boolean(current?.deadlineUtc && new Date(current.deadlineUtc) <= new Date())

  async function handleSubmit() {
    if (!current) return

    // "ยังไม่ตอบ" หมายถึงยังไม่เคยเลือกคำตอบเลย (choice === null) ไม่ใช่ยังไม่เคย submit
    // ถ้าใช้ completedCount (นับเฉพาะ SUBMITTED) คนที่ตอบครบแต่ยังไม่เคยกดส่งมาก่อน
    // จะเห็น dialog เตือนผิด ๆ ว่า "ยังไม่ตอบ" ทั้งที่ตอบไว้ครบแล้วในตอน submit ครั้งแรก
    const unanswered = current.items.filter((i) => i.choice === null).length
    if (unanswered > 0) {
      // AC: ตอบไม่ครบต้องแสดงจำนวนที่เหลือให้ยืนยันก่อน แต่ยัง submit ได้ตามปกติ (ไม่ใช่ปุ่มถูกปิด)
      const ok = window.confirm(
        `ยังเหลือ ${unanswered} คู่ที่ยังไม่ได้ตอบ — ต้องการส่งเท่าที่ตอบไว้ตอนนี้เลยไหม?`,
      )
      if (!ok) return
    }

    setSubmitting(true)
    setError(null)
    try {
      const key = crypto.randomUUID()
      const result = await submitEvaluations(assignmentId, side, key)
      setSubmitResult(`ส่งแล้ว ${result.submittedCount} คู่`)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ส่งคำตอบไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <header className="sticky top-0 z-40 border-b border-edge bg-white/88 shadow-[0_1px_2px_rgba(23,32,51,0.05)] backdrop-blur">
        <nav
          data-testid="main-nav"
          aria-label="เมนูหลัก"
          className="mx-auto flex h-16 max-w-300 items-center gap-4 px-6 max-sm:px-4"
        >
          <Link
            to="/"
            className="flex min-h-11 items-center gap-2.5 font-display text-[19px] font-bold tracking-tight"
          >
            <LogoMark className="size-8" />
            PairEval
          </Link>

          <Link
            to={`/classrooms/${classroomId}`}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-sand hover:text-ink"
          >
            <IconChevronLeft className="size-4" />
            กลับไปห้องเรียน
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-300 px-6 pt-8 pb-16 max-sm:px-4">
        <h1 className="font-display text-3xl font-bold tracking-tight max-sm:text-2xl">
          งานที่ต้องประเมิน
        </h1>
        <p className="mt-1.5 max-w-[62ch] text-muted">
          เปรียบเทียบผลงานทีละคู่ — ทุกคำตอบบันทึกอัตโนมัติ
        </p>

        {error && (
          <Banner tone="err" data-testid="error-msg" role="alert" className="mt-6">
            {error}
          </Banner>
        )}

        <div
          role="tablist"
          aria-label="เลือกฝั่งที่ต้องการประเมิน"
          className="mt-6 inline-flex rounded-xl border border-edge bg-white p-1"
        >
          {(['GROUP', 'INDIVIDUAL'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={side === s}
              onClick={() => setSide(s)}
              className={`min-h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${FOCUS} ${
                side === s ? 'bg-accent-soft text-accent-ink' : 'text-ink-2 hover:bg-sand'
              }`}
            >
              {SIDE_LABEL[s]}
            </button>
          ))}
        </div>

        {loaded && current && (
          <div className="mt-6 flex flex-col gap-4">
            {!current.opened || current.items.length === 0 ? (
              <Banner tone="warn">{current.message ?? 'ยังไม่มีคู่ให้ประเมินในฝั่งนี้'}</Banner>
            ) : (
              <>
                {deadlinePassed && (
                  <Banner tone="warn">
                    <span className="flex items-center gap-1.5">
                      <IconLock className="size-4 shrink-0" />
                      เลยกำหนดส่งแล้ว — ดูคำตอบได้อย่างเดียว แก้ไขหรือส่งเพิ่มไม่ได้
                    </span>
                  </Banner>
                )}

                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3 p-6 max-sm:p-4">
                    <div>
                      <p className="font-display text-lg font-semibold">
                        ทำแล้ว{' '}
                        <span className="font-mono tabular">{current.completedCount}</span> /{' '}
                        <span className="font-mono tabular">{current.totalCount}</span> คู่
                      </p>
                      {current.deadlineUtc && (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                          <IconClock className="size-3.5" />
                          กำหนดส่ง {formatDeadline(current.deadlineUtc, timezone)}
                        </p>
                      )}
                    </div>

                    {current.artifactUrl && (
                      <a
                        href={current.artifactUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-edge-strong bg-white px-4 text-sm font-semibold transition-colors hover:bg-sand ${FOCUS}`}
                      >
                        ดูผลงาน
                        <IconArrowRight className="size-4" />
                      </a>
                    )}
                  </div>

                  <div className="border-t border-edge px-6 pb-5 max-sm:px-4">
                    <div
                      role="progressbar"
                      aria-valuenow={current.completedCount}
                      aria-valuemin={0}
                      aria-valuemax={current.totalCount}
                      className="mt-4 h-2 overflow-hidden rounded-full bg-sand"
                    >
                      <div
                        className="h-full rounded-full bg-ok-600 transition-[width]"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    {!deadlinePassed && (
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void handleSubmit()}
                          disabled={submitting}
                          className={btn('primary', 'md')}
                        >
                          {submitting ? 'กำลังส่ง…' : 'ส่งคำตอบ'}
                        </button>
                        {submitResult && (
                          <span className="text-sm text-ok-700">{submitResult}</span>
                        )}
                      </div>
                    )}
                  </div>
                </Card>

                {sections.map((section) => (
                  <Card key={section.criterionId}>
                    <CardHead
                      id={`h-${section.criterionId}`}
                      icon={<IconCircleDashed className="size-5" />}
                      title={section.criterionName}
                      hint={`${section.items.filter((i) => i.completed).length} / ${section.items.length} คู่`}
                    />
                    <ul className="flex flex-col gap-3 p-6 max-sm:p-4">
                      {section.items.map((item) => (
                        <ComparisonRow
                          key={item.pairAssignmentId}
                          item={item}
                          readOnly={deadlinePassed}
                        />
                      ))}
                    </ul>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
