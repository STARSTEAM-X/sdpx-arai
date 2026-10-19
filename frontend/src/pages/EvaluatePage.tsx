import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import heroComparison from '../assets/enhanced/hero-comparison.webp'
import { AppNav } from '../components/AppNav'
import { ComparisonRow } from '../components/ComparisonRow'
import { Banner, Card, FOCUS, Pill, btn } from '../components/Ui'
import {
  IconArrowRight,
  IconBack,
  IconClock,
  IconInfo,
  IconLock,
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
import { useComparisonQueue } from '../lib/useComparisonQueue'
import { evaluationPairs } from '../lib/evaluationPairs'

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
  const [classroomName, setClassroomName] = useState('')
  const [classroomArchived, setClassroomArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<string | null>(null)
  const queue = useComparisonQueue(assignmentId)
  const [pairIndex, setPairIndex] = useState<Record<CriterionSide, number>>({ GROUP: 0, INDIVIDUAL: 0 })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [])

  const refresh = useCallback(async () => {
    const saved = queue.savedSnapshot()
    try {
      const [group, individual, classrooms] = await Promise.all([
        getMyEvaluations(assignmentId, 'GROUP'),
        getMyEvaluations(assignmentId, 'INDIVIDUAL'),
        listClassrooms(),
      ])
      queue.reconcile(saved)
      if (group.opened && individual.opened) queue.retain(new Set([...group.items, ...individual.items].map((item) => item.pairAssignmentId)))
      setData({ GROUP: group, INDIVIDUAL: individual })

      // AC ของ US-07 บังคับให้แสดงเวลาตาม timezone ของห้องเรียน ไม่ใช่ของเครื่องผู้ใช้
      const room = classrooms.items.find((c) => c.id === classroomId)
      if (room) {
        setTimezone(room.timezone)
        setClassroomName(room.name)
        setClassroomArchived(room.status === 'ARCHIVED')
      }

      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดรายการที่ต้องประเมินไม่สำเร็จ')
    } finally {
      setLoaded(true)
    }
  }, [assignmentId, classroomId, queue])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // สลับ side แล้วล้างผลของการส่งครั้งก่อน — ข้อความ "ส่งสำเร็จ" ของฝั่งเดิมไม่ควรค้างข้ามฝั่ง
  useEffect(() => {
    setSubmitResult(null)
  }, [side])

  const current = data[side]
  useEffect(() => {
    if (!current?.opensAtUtc || current.opened) return
    let loading = false
    const timer = window.setInterval(() => {
      if (Date.now() < Date.parse(current.opensAtUtc!) || loading) return
      loading = true
      void refresh().finally(() => { loading = false })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [current?.opensAtUtc, current?.opened, refresh])
  const allSections = useMemo(() => groupByCriterion(current?.items ?? []), [current])
  const pairs = useMemo(() => evaluationPairs(current?.items ?? []), [current])
  const position = Math.min(pairIndex[side], Math.max(0, pairs.length - 1))
  const pairItems = pairs[position]?.items ?? []
  const sections = groupByCriterion(pairItems)
  const pair = pairItems[0]
  const answeredCount = current?.items.filter((item) => (queue.drafts.get(item.pairAssignmentId)?.choice ?? item.choice) !== null).length ?? 0

  const progressPct =
    current && current.totalCount > 0
      ? Math.round((answeredCount / current.totalCount) * 100)
      : 0

  // FR-EVAL-08 — เลย deadline แล้วต้องปิดการแก้ไข ไม่ใช่แค่ปิดปุ่มส่ง
  const deadlinePassed = Boolean(current?.deadlineUtc && Date.parse(current.deadlineUtc) <= now)
  const readOnly = deadlinePassed || classroomArchived || Boolean(current?.readOnly)

  async function handleSubmit() {
    if (!current || readOnly) return

    // "ยังไม่ตอบ" หมายถึงยังไม่เคยเลือกคำตอบเลย (choice === null) ไม่ใช่ยังไม่เคย submit
    // ถ้าใช้ completedCount (นับเฉพาะ SUBMITTED) คนที่ตอบครบแต่ยังไม่เคยกดส่งมาก่อน
    // จะเห็น dialog เตือนผิด ๆ ว่า "ยังไม่ตอบ" ทั้งที่ตอบไว้ครบแล้วในตอน submit ครั้งแรก
    const unanswered = current.items.filter((i) => (queue.drafts.get(i.pairAssignmentId)?.choice ?? i.choice) === null).length
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
      await queue.flush()
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
      <AppNav
        context="งานที่ต้องประเมิน"
        contextTo={`/classrooms/${classroomId}`}
        classroomId={classroomId}
      />

      <main className="mx-auto max-w-304 px-7 pt-8 pb-32 max-sm:px-4 max-sm:pt-6">
        <div className="relative grid items-center gap-4 md:min-h-48 md:grid-cols-[1fr_26rem]">
          <div className="relative z-10 max-sm:pl-12">
            <Link to={`/classrooms/${classroomId}`} aria-label="กลับหน้าห้องเรียน" className={`mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-ink-2 hover:text-accent-ink max-sm:absolute max-sm:top-0 max-sm:left-0 max-sm:mb-0 max-sm:text-brand-600 ${FOCUS}`}>
              <IconBack className="size-10" />
              <span className="max-sm:hidden">กลับหน้าห้องเรียน</span>
            </Link>
            <h1 className="font-display text-3xl font-bold tracking-tight max-sm:text-2xl">
              งานที่ต้องประเมิน
            </h1>
            <p className="mt-2 text-sm font-medium text-ink-2">{[current?.assignmentName, classroomName].filter(Boolean).join(' · ') || 'เปรียบเทียบผลงานทีละคู่'}</p>
          </div>
          <div aria-hidden="true" className="relative h-40 overflow-hidden max-md:hidden">
            <img src={heroComparison} alt="" className="absolute right-0 bottom-0 w-full" />
          </div>
        </div>

        {error && (
          <Banner tone="err" data-testid="error-msg" role="alert" className="mt-6">
            {error}
          </Banner>
        )}
        {queue.storageError && <Banner tone="warn" className="mt-4">พื้นที่เก็บข้อมูลในเครื่องใช้ไม่ได้ กรุณาบันทึกคำตอบให้สำเร็จก่อนปิดหน้านี้</Banner>}

        <div
          role="tablist"
          aria-label="เลือกฝั่งที่ต้องการประเมิน"
          className="mt-4 grid max-w-md grid-cols-2 gap-1 rounded-full border border-edge bg-white p-1"
        >
          {(['GROUP', 'INDIVIDUAL'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              id={`side-${s}`}
              aria-controls="evaluation-panel"
              tabIndex={side === s ? 0 : -1}
              aria-selected={side === s}
              disabled={submitting}
              onClick={() => setSide(s)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const next = event.key === 'Home' ? 'GROUP' : event.key === 'End' ? 'INDIVIDUAL' : s === 'GROUP' ? 'INDIVIDUAL' : 'GROUP'
                setSide(next)
                document.getElementById(`side-${next}`)?.focus()
              }}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors ${FOCUS} ${
                side === s ? 'bg-accent-soft text-accent-ink' : 'bg-white text-muted hover:bg-sand'
              }`}
            >
              {SIDE_LABEL[s]}
              {data[s] && (
                <span className="ml-2 font-mono text-xs tabular">
                  {data[s]?.completedCount}/{data[s]?.totalCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div id="evaluation-panel" role="tabpanel" aria-labelledby={`side-${side}`} aria-busy={!loaded} className="mt-6 flex flex-col gap-6 max-sm:mt-4 max-sm:gap-4">
          {loaded && current && <>
            {!current.opened || current.items.length === 0 ? (
              <Banner tone="warn">{current.opensAtUtc && !current.opened ? `เปิดรับ ${formatDeadline(current.opensAtUtc, timezone)}` : current.message ?? 'ยังไม่มีคู่ให้ประเมินในฝั่งนี้'}<button type="button" onClick={() => void refresh()} className={btn('ghost', 'sm', 'ml-3')}>โหลดรายการใหม่</button></Banner>
            ) : (
              <>
                {readOnly && (
                  <Banner tone="warn">
                    <span className="flex items-center gap-1.5">
                      <IconLock className="size-4 shrink-0" />
                      {classroomArchived ? 'ห้องเรียนนี้เก็บเข้าคลังแล้ว — ดูคำตอบได้อย่างเดียว' : current.readOnly ? 'ปิดรับคำตอบแล้ว — ดูคำตอบได้อย่างเดียว' : 'เลยกำหนดส่งแล้ว — ดูคำตอบได้อย่างเดียว แก้ไขหรือส่งเพิ่มไม่ได้'}
                    </span>
                  </Banner>
                )}

                <Card radius="md" shadow={false}>
                  <div className="p-5 max-sm:p-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-display text-lg font-semibold max-sm:text-sm">{SIDE_LABEL[side]}</p>
                      <p className="font-display text-lg font-semibold max-sm:text-sm">
                        ความคืบหน้า{' '}
                        <span className="tabular">
                          {answeredCount} / {current.totalCount}
                        </span>{' '}
                        คู่
                      </p>
                    </div>

                    <div
                      role="progressbar"
                      aria-valuenow={answeredCount}
                      aria-label="ความคืบหน้าการตอบคำถาม"
                      aria-valuemin={0}
                      aria-valuemax={current.totalCount}
                      className="mt-3 h-2 overflow-hidden rounded-full bg-edge"
                    >
                      <div
                        className="h-full rounded-full bg-brand-600 transition-[width]"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      {current.deadlineUtc && (
                        <p className="flex items-center gap-1.5 text-sm text-muted max-sm:text-xs">
                          <IconClock className="size-4 shrink-0" />
                          กำหนดส่ง {formatDeadline(current.deadlineUtc, timezone)}
                        </p>
                      )}
                      {current.artifactUrl && (
                        <a
                          href={current.artifactUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border border-edge-strong bg-white px-4 text-sm font-semibold transition-colors hover:bg-sand ${FOCUS}`}
                        >
                          ดูผลงาน
                          <IconArrowRight className="size-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </Card>

                <div className="flex items-start gap-3 rounded-[20px] bg-[#DDE9FF] px-5 py-4 text-[#2455A6] max-sm:hidden">
                  <IconInfo aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">ทุกคำตอบมีผลต่อการมีส่วนร่วมของคุณ</p>
                    <p className="mt-1 text-xs leading-5">ประเมินให้ครบทุกคู่ที่ได้รับมอบหมาย — คำตอบบันทึกอัตโนมัติ และกดส่งเมื่อพร้อม</p>
                  </div>
                </div>

                {pair && <section id="pair-context" aria-label="คู่ที่กำลังประเมิน">
                  <h2 className="mb-4 font-display text-lg font-bold max-sm:text-sm">คู่ของคุณ · {pair.leftLabel} เทียบ {pair.rightLabel} <span className="font-body text-sm font-normal text-muted">({position + 1} / {pairs.length} คู่)</span></h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ label: pair.leftLabel, url: pair.leftArtifactUrl, tone: 'bg-accent-soft' }, { label: pair.rightLabel, url: pair.rightArtifactUrl, tone: 'bg-info-soft' }].map((item, index) => <div key={index} className={`relative min-w-0 rounded-2xl p-5 max-sm:min-h-20 max-sm:px-4 max-sm:py-3 ${item.tone}`}>
                      <h3 className="font-display text-lg font-bold wrap-break-word max-sm:text-sm">{item.label}</h3>
                      {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className={`mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4 max-sm:absolute max-sm:inset-0 max-sm:mt-0 max-sm:items-end max-sm:px-4 max-sm:pb-3 max-sm:text-xs ${FOCUS}`}>ดูผลงาน ↗</a> : <p className="mt-2 text-xs text-ink-2">ยังไม่มีลิงก์ผลงานแยก</p>}
                    </div>)}
                  </div>
                </section>}

                {sections.map((section) => (
                  <Card key={section.criterionId} aria-labelledby={`h-${section.criterionId}`} radius="md" shadow={false}>
                    <div className="flex flex-wrap items-center justify-between gap-3 px-7 pt-7 max-sm:px-4 max-sm:pt-5">
                      <div>
                        <div className="flex flex-wrap items-center gap-4"><p className="text-xs text-muted">เกณฑ์ที่ {allSections.findIndex((entry) => entry.criterionId === section.criterionId) + 1} จาก {allSections.length}</p>{section.items[0]?.weightPct != null && <Pill tone="ok" className="px-5 py-2">น้ำหนัก {section.items[0].weightPct}%</Pill>}</div>
                        <h2 id={`h-${section.criterionId}`} className="mt-3 font-display text-xl font-bold">{section.criterionName}</h2>
                        {section.items[0]?.question && <p className="mt-3 text-sm leading-6 text-muted">{section.items[0].question}</p>}
                      </div>
                    </div>
                    <ul className="flex flex-col gap-5 p-7 max-sm:p-4 max-sm:pt-0">
                      {section.items.map((item, index) => (
                        <ComparisonRow
                          key={item.pairAssignmentId}
                          item={item}
                          position={index + 1}
                          total={section.items.length}
                          compact
                          readOnly={readOnly || submitting}
                          draft={queue.drafts.get(item.pairAssignmentId)}
                          onSelect={(value, timeOnTaskMs) => queue.select(item.pairAssignmentId, value, timeOnTaskMs)}
                        />
                      ))}
                    </ul>
                  </Card>
                ))}
              </>
            )}
          </>}
        </div>
      </main>
      {loaded && current?.opened && current.items.length > 0 && (
        <footer className="sticky bottom-0 z-20 border-t border-edge/70 bg-white/95 backdrop-blur">
          <div className="mx-auto flex min-h-24 max-w-304 flex-wrap items-center justify-between gap-3 px-7 py-4 max-sm:min-h-20 max-sm:px-4 max-sm:py-3">
            <div className="text-sm text-muted max-sm:hidden" aria-live="polite">
              <p>{SIDE_LABEL[side]} · ความคืบหน้า {current.completedCount} / {current.totalCount} คู่</p>
              {submitResult && <p className="mt-1 font-semibold text-ok-700">{submitResult}</p>}
              {deadlinePassed && <p className="mt-1">ปิดรับคำตอบแล้ว</p>}
            </div>
            {position > 0 && <button type="button" onClick={() => setPairIndex((value) => ({ ...value, [side]: position - 1 }))} className={btn('ghost', 'md', 'order-1 max-sm:flex-1 max-sm:px-3')}>คู่ก่อนหน้า</button>}
            {position < pairs.length - 1 && <button type="button" onClick={() => setPairIndex((value) => ({ ...value, [side]: position + 1 }))} className={btn('primary', 'md', 'order-3 max-sm:flex-1 max-sm:px-3')}>คู่ถัดไป →</button>}
            {!readOnly && (
              <button type="button" onClick={() => void handleSubmit()} disabled={submitting} className={btn('ghost', 'md', 'order-2 max-sm:flex-1 max-sm:px-3')}>
                {submitting ? 'กำลังส่ง…' : 'ส่งคำตอบ'}
                <IconArrowRight aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}
