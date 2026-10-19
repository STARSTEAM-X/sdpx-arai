import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import heroComparison from '../assets/enhanced/hero-comparison.webp'
import noAssignments from '../assets/figma/no-assignments.png'
import { AppNav } from '../components/AppNav'
import { ComparisonRow } from '../components/ComparisonRow'
import { BackChevron } from '../components/PageChrome'
import { SubmitConfirmDialog, SubmitSuccessDialog } from '../components/SubmitDialogs'
import { Banner, FOCUS, btn } from '../components/Ui'
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

  const [confirming, setConfirming] = useState<number | null>(null)
  const [succeeded, setSucceeded] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])
  const drafts = [...queue.drafts.values()]
  const unsaved = drafts.filter((draft) => draft.state !== 'saved').length
  const showOffline = (!online && unsaved > 0) || drafts.some((draft) => draft.state === 'error' && draft.retryable !== false)

  function requestSubmit() {
    if (!current || readOnly) return
    // "ยังไม่ตอบ" หมายถึงยังไม่เคยเลือกคำตอบเลย (choice === null) ไม่ใช่ยังไม่เคย submit
    // ถ้าใช้ completedCount (นับเฉพาะ SUBMITTED) คนที่ตอบครบแต่ยังไม่เคยกดส่งจะถูกเตือนผิด ๆ
    const unanswered = current.items.filter((i) => (queue.drafts.get(i.pairAssignmentId)?.choice ?? i.choice) === null).length
    // AC: ตอบไม่ครบต้องแสดงจำนวนที่เหลือให้ยืนยันก่อน แต่ยัง submit ได้ตามปกติ (Figma ST21)
    if (unanswered > 0) setConfirming(unanswered)
    else void handleSubmit()
  }

  async function handleSubmit() {
    if (!current || readOnly) return
    setConfirming(null)
    setSubmitting(true)
    setError(null)
    try {
      await queue.flush()
      const key = crypto.randomUUID()
      const result = await submitEvaluations(assignmentId, side, key)
      setSubmitResult(`ส่งแล้ว ${result.submittedCount} คู่`)
      setSucceeded(true)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ส่งคำตอบไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  const pairAnswered = pairItems.filter((item) => (queue.drafts.get(item.pairAssignmentId)?.choice ?? item.choice) !== null).length
  const lastPair = position >= pairs.length - 1
  const deadlineText = current?.deadlineUtc ? formatDeadline(current.deadlineUtc, timezone) : ''

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <AppNav
        context="งานที่ต้องประเมิน"
        contextTo={`/classrooms/${classroomId}`}
        classroomId={classroomId}
      />
      {showOffline && (
        <p role="status" data-testid="offline-banner" className="bg-[#fff1c9] px-3 py-1.5 text-[12.5px] font-semibold text-warn">
          📶 ออฟไลน์อยู่ · คำตอบ {unsaved} ข้อล่าสุดเก็บไว้ในเครื่องแล้ว จะส่งให้อัตโนมัติเมื่อเชื่อมต่อได้ · ไม่ต้องกดซ้ำ
        </p>
      )}

      <main className="mx-auto max-w-290 pt-5 pb-16 max-xl:px-7 max-sm:px-4">
        <div className="relative flex min-h-43 items-center gap-3 max-sm:min-h-0 max-sm:py-4">
          <BackChevron to={`/classrooms/${classroomId}`} label="กลับหน้าห้องเรียน" />
          <div className="relative z-10 min-w-0 flex-1">
            <h1 className="font-display text-[30px] leading-tight font-bold max-sm:text-2xl">งานที่ต้องประเมิน</h1>
            <p className="mt-2 font-display text-[14px] font-semibold max-sm:mt-1 max-sm:font-body max-sm:font-normal max-sm:text-ink-2">{[current?.assignmentName, classroomName].filter(Boolean).join(' · ')}</p>
          </div>
          <img src={heroComparison} alt="" aria-hidden="true" className="h-38 w-auto object-contain max-md:hidden" />
        </div>

        {error && (
          <Banner tone="err" data-testid="error-msg" role="alert" className="mt-4">
            {error}
          </Banner>
        )}
        {queue.storageError && <Banner tone="warn" className="mt-4">พื้นที่เก็บข้อมูลในเครื่องใช้ไม่ได้ กรุณาบันทึกคำตอบให้สำเร็จก่อนปิดหน้านี้</Banner>}

        <div role="tablist" aria-label="เลือกฝั่งที่ต้องการประเมิน" className="mt-1 flex flex-wrap gap-2">
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
              className={`min-h-11 min-w-40 rounded-full px-6 font-display text-[13.5px] transition-colors ${FOCUS} ${
                side === s ? 'bg-[#fde5d4] font-semibold text-accent-ink' : 'bg-white text-ink-2 hover:bg-sand'
              }`}
            >
              {SIDE_LABEL[s]}
              {data[s] && <span className="ml-1 tabular">{data[s]?.completedCount}/{data[s]?.totalCount}</span>}
            </button>
          ))}
        </div>

        <div id="evaluation-panel" role="tabpanel" aria-labelledby={`side-${side}`} aria-busy={!loaded} className="mt-4 flex flex-col gap-5">
          {loaded && current && <>
            {!current.opened || current.items.length === 0 ? (
              side === 'INDIVIDUAL' && current.opened ? (
                // Figma ST25 · ไม่มีการประเมินรายบุคคล (กลุ่ม ≤ 2 คน)
                <div className="rounded-3xl border-2 border-dashed border-[#e88a4f] px-6 py-10 text-center">
                  <img src={noAssignments} alt="" width={220} height={150} className="mx-auto" />
                  <p className="mt-4 font-display text-[19px] font-semibold">งานนี้ไม่มีการประเมินรายบุคคลสำหรับกลุ่มของคุณ</p>
                  <p className="mt-3 text-[15px] text-ink-2">{current.message ?? 'กลุ่มของคุณมีสมาชิกน้อยเกินไป · ถ้าให้ประเมินกันเอง แต่ละคู่จะไม่มีผู้ประเมินที่ไม่ใช่เจ้าตัว · ประเมินระดับกลุ่มได้ตามปกติ'}</p>
                  <button type="button" onClick={() => setSide('GROUP')} className={btn('ghost', 'md', 'mt-4 border-brand-600 px-2 text-accent-ink')}>ไปประเมินระดับกลุ่ม</button>
                </div>
              ) : (
                <Banner tone="warn">{current.opensAtUtc && !current.opened ? `เปิดรับ ${formatDeadline(current.opensAtUtc, timezone)}` : current.message ?? 'ยังไม่มีคู่ให้ประเมินในฝั่งนี้'}<button type="button" onClick={() => void refresh()} className={btn('ghost', 'sm', 'ml-3')}>โหลดรายการใหม่</button></Banner>
              )
            ) : (
              <>
                <section className="rounded-3xl bg-white px-5.5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-display text-[17px] font-semibold">{SIDE_LABEL[side]}</p>
                    <p className="font-display text-[17px] font-semibold">ตอบแล้ว <span className="tabular">{answeredCount} / {current.totalCount}</span> ข้อ</p>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={answeredCount}
                    aria-label="ความคืบหน้าการตอบคำถาม"
                    aria-valuemin={0}
                    aria-valuemax={current.totalCount}
                    className="mt-2 h-2 overflow-hidden rounded-full bg-[#d9d9d9]"
                  >
                    <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${progressPct}%` }} />
                  </div>
                  {deadlineText && (
                    <p className="mt-3 text-[13px] text-ink-2">
                      กำหนดส่ง {deadlineText.replace(/ (\d{1,2}:\d{2})$/, ' เวลา $1')}
                      <span className="block text-[11px] text-muted">{timezone === 'Asia/Bangkok' ? 'เวลาไทย ' : ''}({timezone})</span>
                    </p>
                  )}
                </section>

                {readOnly && (
                  // Figma ST26 · ปิดรับแล้ว · คำตอบอ่านอย่างเดียว
                  <p data-testid="read-only-banner" className="flex items-center gap-1.5 rounded-xl bg-[#ebe9e6] px-4 py-2 text-[12.5px] text-ink-2">
                    🔒 {classroomArchived
                      ? 'ห้องเรียนนี้เก็บเข้าคลังแล้ว · คำตอบเป็นแบบอ่านอย่างเดียว'
                      : `ปิดรับแล้ว ${deadlineText} · คำตอบเป็นแบบอ่านอย่างเดียว · ระบบใช้คำตอบที่ส่งครั้งล่าสุด · ข้อที่ไม่เคยกดส่งจะไม่ถูกนำไปคำนวณ`}
                  </p>
                )}

                {pair && <section id="pair-context" aria-label="คู่ที่กำลังประเมิน">
                  <h2 className="flex flex-wrap items-center gap-3 font-display text-[17px] font-semibold">
                    {pairs.length === 1 ? 'คู่เดียวของคุณ' : `คู่ที่ ${position + 1} จาก ${pairs.length}`} · {pair.leftLabel} เทียบ {pair.rightLabel}
                    <span className="rounded-full bg-ok-50 px-2 py-0.5 text-[11px] font-semibold text-ok-700">√ บันทึก {pairAnswered}/{pairItems.length} เกณฑ์</span>
                  </h2>
                  <div className="mt-4 grid grid-cols-2 gap-4 max-sm:gap-2">
                    {[
                      // ไม่มีลิงก์รายกลุ่ม → ใช้ลิงก์ผลงานรวมของงาน (โฟลเดอร์ที่อาจารย์แชร์) แทน
                      { label: pair.leftLabel, url: pair.leftArtifactUrl ?? current?.artifactUrl, tone: 'bg-[#fde5d4]', ink: 'text-accent-ink' },
                      { label: pair.rightLabel, url: pair.rightArtifactUrl ?? current?.artifactUrl, tone: 'bg-info-soft', ink: 'text-info-ink' },
                    ].map((team, index) => (
                      <div key={index} className={`flex min-h-19 min-w-0 items-center gap-4 rounded-2xl px-8 py-3 max-sm:px-3 ${team.tone}`}>
                        <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-8 shrink-0 ${team.ink} max-sm:hidden`} fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 3h7l4 4v6" /><path d="M14 3v4h4" /><path d="M7 3v17h6" /><path d="M9.5 9h5M9.5 12h5M9.5 15h2" /><circle cx="17" cy="16.5" r="2" fill="currentColor" /><path d="M13.5 21a3.5 3.5 0 0 1 7 0z" fill="currentColor" /></svg>
                        <div className="min-w-0">
                          <h3 className="font-display text-[17px] font-semibold wrap-break-word">{side === 'GROUP' ? `กลุ่ม ${team.label}` : team.label}</h3>
                          {team.url
                            ? <a href={team.url} target="_blank" rel="noreferrer" className={`inline-flex items-center font-display text-[13px] font-semibold ${team.ink} hover:underline ${FOCUS}`}>ดูผลงาน ↗</a>
                            : <p className="text-[12px] text-ink-2">ยังไม่มีลิงก์ผลงานแยก</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>}

                {sections.map((section) => (
                  <section key={section.criterionId} aria-labelledby={`h-${section.criterionId}`} className="rounded-3xl bg-white px-6 pt-5 pb-5 shadow-[0_8px_30px_-24px_rgba(101,73,63,0.24)] max-sm:px-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] text-muted">เกณฑ์ที่ {allSections.findIndex((entry) => entry.criterionId === section.criterionId) + 1} จาก {allSections.length}</p>
                        <h2 id={`h-${section.criterionId}`} className="mt-1 font-display text-[20px] font-semibold">{section.criterionName}</h2>
                        {section.items[0]?.question && <p className="mt-1 text-[14px] text-ink-2">{section.items[0].question}</p>}
                      </div>
                      {section.items[0]?.weightPct != null && <span className="mt-4 rounded-full bg-ok-50 px-3 py-1 text-[11px] text-ok-700">น้ำหนัก {section.items[0].weightPct}%</span>}
                    </div>
                    <ul className="mt-4 flex flex-col gap-5">
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
                  </section>
                ))}

                {/* Figma M04 — บนมือถือเป็นแถบล่างติดจอ: ส่งคำตอบ + คู่ถัดไป */}
                <div className="mt-2 flex flex-wrap items-center gap-3 max-sm:sticky max-sm:bottom-0 max-sm:z-20 max-sm:-mx-4 max-sm:grid max-sm:grid-cols-2 max-sm:border-t max-sm:border-edge max-sm:bg-white max-sm:px-4 max-sm:py-3" aria-live="polite">
                  <div className="mr-auto text-[13px] text-muted max-sm:col-span-2 max-sm:mr-0">
                    <p className="max-sm:hidden">คู่นี้ตอบแล้ว {pairAnswered} / {pairItems.length} เกณฑ์</p>
                    {submitResult && <p className="mt-1 font-semibold text-ok-700">{submitResult}</p>}
                  </div>
                  {position > 0 && <button type="button" onClick={() => setPairIndex((value) => ({ ...value, [side]: position - 1 }))} className={btn('ghost', 'md', `min-h-12 min-w-53 px-6 max-sm:min-w-0 ${lastPair ? '' : 'max-sm:hidden'}`)}>คู่ก่อนหน้า</button>}
                  {/* ส่งได้ทุกเมื่อ ไม่ต้องไล่ไปคู่สุดท้าย — ตอบไม่ครบระบบจะถามยืนยันก่อน (ST21) */}
                  {!lastPair && !readOnly && <button type="button" onClick={requestSubmit} disabled={submitting} className={btn('ghost', 'md', 'min-h-12 min-w-40 border-[#cfc9c4] px-6 max-sm:min-w-0 max-sm:px-4')}>{submitting ? 'กำลังส่ง…' : 'ส่งคำตอบ'}</button>}
                  {!lastPair && <button type="button" onClick={() => setPairIndex((value) => ({ ...value, [side]: position + 1 }))} className={btn('primary', 'md', 'min-h-12 min-w-53 px-6 max-sm:min-w-0')}>คู่ถัดไป →</button>}
                  {lastPair && (
                    <button type="button" onClick={requestSubmit} disabled={submitting || readOnly} className={btn('primary', 'md', `min-h-12 min-w-53 px-6 max-sm:min-w-0 ${position > 0 ? '' : 'max-sm:col-span-2'}`)}>
                      {submitting ? 'กำลังส่ง…' : 'ส่งคำตอบ'}
                    </button>
                  )}
                </div>
              </>
            )}
          </>}
        </div>
      </main>

      {confirming !== null && current && (
        <SubmitConfirmDialog
          answered={current.totalCount - confirming}
          unanswered={confirming}
          deadline={deadlineText ? deadlineText.replace(/ (\d{1,2}:\d{2})$/, ' · $1') : null}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void handleSubmit()}
        />
      )}
      {succeeded && <SubmitSuccessDialog classroomId={classroomId} onClose={() => setSucceeded(false)} />}
    </div>
  )
}
