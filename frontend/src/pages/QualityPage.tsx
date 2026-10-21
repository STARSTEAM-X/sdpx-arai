import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { AppNav } from '../components/AppNav'
import { BackChevron, ForbiddenState, forbiddenCopy } from '../components/PageChrome'
import { CoverageActions } from '../components/CoverageActions'
import { DistributionDialog } from '../components/DistributionDialog'
import { ReportTabs } from '../components/ReportTabs'
import { Banner, Card, CTRL, FOCUS, btn } from '../components/Ui'
import {
  ApiError,
  type Assignment,
  type CoveragePair,
  type CriterionAgreement,
  type QualityReport,
  type Reviewer,
  getAssignment,
  getMe,
  getQuality,
  listClassrooms,
  markReviewerReviewed,
  revealReviewer,
  setReviewerExclusion,
} from '../lib/api'
import { COMPARISON_SCALE } from '../lib/scale'
import coverageHeading from '../assets/figma/coverage-heading.png'
import reportHeading from '../assets/figma/owner-report-heading.png'

// ถ้อยคำตาม Figma J28
const signalLabels: Record<string, string> = {
  'QS-01': 'ได้ผลประเมินน้อย',
  'QS-02': 'ตอบค่าเดิมทุกข้อ',
  'QS-03': 'เลือกฝั่งเดียวเกือบทุกข้อ',
  'QS-04': 'ตอบวนกัน (A>B>C>A)',
  'QS-05': 'ตอบเร็วผิดปกติ',
  'QS-06': 'ลำเอียงให้เพื่อนร่วมกลุ่ม',
  'QS-07': 'ผู้ประเมินเห็นไม่ตรงกัน',
}

/** ค่าที่วัดได้และเกณฑ์ของแต่ละสัญญาณ (Figma J28) — คิดจากคำตอบที่ส่งแล้วด้วยกฎเดียวกับ backend/app/domain/quality.py */
function measure(reviewer: Reviewer, flag: string): { value: string; threshold: string } {
  const submitted = reviewer.answers.filter((answer) => answer.status === 'SUBMITTED')
  const n = submitted.length
  const pct = (count: number) => `${Math.round((count / Math.max(n, 1)) * 100)}%`
  if (flag === 'QS-02') {
    const counts = new Map<number, number>()
    for (const answer of submitted) counts.set(answer.choice, (counts.get(answer.choice) ?? 0) + 1)
    const top = Math.max(0, ...counts.values())
    return { value: `${top} / ${n} ข้อ (${pct(top)})`, threshold: '> 80%' }
  }
  if (flag === 'QS-03') {
    const left = submitted.filter((answer) => answer.choice <= 3).length
    const side = left >= n - left ? 'ฝั่งซ้าย' : 'ฝั่งขวา'
    const top = Math.max(left, n - left)
    return { value: `${side} ${top} / ${n} (${pct(top)})`, threshold: '> 80%' }
  }
  if (flag === 'QS-04') {
    const ratio = reviewer.checkedTriples ? Math.round((reviewer.cycles / reviewer.checkedTriples) * 100) : 0
    return { value: `${reviewer.cycles} จาก ${reviewer.checkedTriples} ชุด (${ratio}%)`, threshold: '> 20%' }
  }
  if (flag === 'QS-05') {
    const seconds = reviewer.meanTimeMs === null ? '—' : (reviewer.meanTimeMs / 1000).toFixed(1)
    return { value: `เฉลี่ย ${seconds} วิ / คู่`, threshold: '< 3 วิ' }
  }
  if (flag === 'QS-06')
    return { value: `ให้เพื่อนคนหนึ่งชนะมากกว่าคนอื่น +${reviewer.favoritismGapPct ?? 0}%`, threshold: 'z > 2' }
  return { value: `ส่งแล้ว ${reviewer.submittedCount} / ${reviewer.assignedCount}`, threshold: '—' }
}

type RowStatus = 'TODO' | 'PENDING' | 'DONE'
type SignalRow =
  | { kind: 'evaluator'; key: string; item: Reviewer; status: RowStatus; pill: string }
  | { kind: 'pair'; key: string; pair: CoveragePair; status: RowStatus; pill: string }
  | { kind: 'criterion'; key: string; criterion: CriterionAgreement; status: RowStatus; pill: string }

/** Figma J28/J28b — สถานะของแต่ละรายการ: ต้องตรวจ · รอผล (ส่งให้ประเมินเพิ่มแล้ว) · เรียบร้อย */
function pairKey(pair: CoveragePair): string {
  return `${pair.criterionId}-${pair.itemAId}-${pair.itemBId}`
}

function evaluatorRow(item: Reviewer): SignalRow {
  if (item.excluded) return { kind: 'evaluator', key: item.key, item, status: 'DONE', pill: 'ตัดคำตอบแล้ว' }
  if (item.reviewedAt) return { kind: 'evaluator', key: item.key, item, status: 'DONE', pill: 'ดูแล้ว · เก็บไว้' }
  return { kind: 'evaluator', key: item.key, item, status: 'TODO', pill: 'ต้องตรวจ' }
}

function pairRow(pair: CoveragePair): SignalRow | null {
  const short = pair.submittedCount < pair.expectedCount
  if (!short && !pair.instructorCount) return null
  const key = `${pair.criterionId}-${pair.itemAId}-${pair.itemBId}`
  if (!short) return { kind: 'pair', key, pair, status: 'DONE', pill: 'อาจารย์ประเมินเองแล้ว' }
  if (pair.pendingCount > 0) return { kind: 'pair', key, pair, status: 'PENDING', pill: 'รอผล' }
  return { kind: 'pair', key, pair, status: 'TODO', pill: 'ต้องตรวจ' }
}

const pillTone: Record<RowStatus, string> = {
  TODO: 'bg-accent-soft text-accent-ink',
  PENDING: 'bg-info-soft text-info-ink',
  DONE: 'bg-ok-50 text-ok-700',
}

export default function QualityPage() {
  const { classroomId = '', assignmentId = '' } = useParams()
  const [data, setData] = useState<QualityReport | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [owner, setOwner] = useState(false)
  const [archived, setArchived] = useState(false)
  const { hash } = useLocation()
  // Figma J26 / J28 — แท็บเป็นลิงก์ (ReportTabs) จึงอ่านมุมมองจาก hash ทุกครั้ง
  const view = hash === '#coverage' ? 'coverage' : 'signals'
  const [roomName, setRoomName] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState<string | false>(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [selected, setSelected] = useState<Reviewer | null>(null)
  // Figma J26 — ปุ่มท้ายการ์ดทำกับคู่ที่เลือก (คลิกแถวที่ข้อมูลไม่พอ) · เริ่มที่คู่แรกที่ข้อมูลไม่พอ
  const [pickedPair, setPickedPair] = useState<string | null>(null)
  const [showDistribution, setShowDistribution] = useState(false)
  const distributionTrigger = useRef<HTMLButtonElement | null>(null)
  const [mode, setMode] = useState<'answers' | 'identity' | 'exclusion'>('answers')
  const [identity, setIdentity] = useState<{ displayName: string | null; email: string } | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const refresh = useCallback(async () => {
    try {
      const [report, job, profile, rooms] = await Promise.all([
        getQuality(assignmentId),
        getAssignment(assignmentId),
        getMe(),
        listClassrooms(),
      ])
      if (job.classroomId !== classroomId) throw new Error('ไม่พบงานนี้ในห้องเรียน')
      setData(report)
      setAssignment(job)
      setOwner(profile.classrooms.find((room) => room.classroomId === classroomId)?.role === 'OWNER')
      setArchived(rooms.items.find((room) => room.id === classroomId)?.status === 'ARCHIVED')
      setRoomName(rooms.items.find((room) => room.id === classroomId)?.name ?? '')
      setError(null)
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 403)
        void getMe()
          .then((me) => setForbidden(me.classrooms.find((room) => room.classroomId === classroomId)?.role ?? ''))
          .catch(() => setForbidden(''))
      setError(err instanceof Error ? err.message : 'โหลดรายงานไม่สำเร็จ')
      return false
    }
  }, [assignmentId, classroomId])
  useEffect(() => {
    void refresh()
  }, [refresh])
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal()
  }, [selected])
  function close() {
    dialog.current?.close()
    setSelected(null)
    setIdentity(null)
    trigger.current?.focus()
  }
  async function act() {
    if (!selected) return
    setBusy(true)
    setActionError(null)
    try {
      if (mode === 'identity') {
        setIdentity(await revealReviewer(assignmentId, selected.key, reason.trim()))
        setMode('answers')
      } else {
        await setReviewerExclusion(assignmentId, selected.key, !selected.excluded, reason.trim())
        const loaded = await refresh()
        setNotice(
          `${selected.excluded ? 'คืนคำตอบ' : 'ตัดคำตอบจากการคำนวณ'}แล้ว คะแนนชั่วคราวคำนวณใหม่ โดยเก็บคำตอบและการมีส่วนร่วมไว้${loaded ? '' : ' · โหลดรายงานใหม่ไม่สำเร็จ กรุณาลองใหม่'}`,
        )
        close()
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'ทำรายการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }
  const writable = !archived && assignment && ['PUBLISHED', 'OPEN', 'CLOSED'].includes(assignment.status)
  const shortPairs = (data?.pairCoverage ?? [])
    .filter((pair) => pair.submittedCount < pair.expectedCount)
    .map((pair) => ({ key: pairKey(pair), pair }))
  const currentPair = shortPairs.find((entry) => entry.key === pickedPair) ?? shortPairs[0] ?? null
  // Figma J28 แสดงเฉพาะรายการที่มีสัญญาณ: ผู้ประเมิน (QS-02–05) และคู่ที่ได้ผลน้อย (QS-01)
  const signalled: SignalRow[] = [
    ...(data?.evaluators.filter((item) => item.flags.length > 0 || item.excluded).map(evaluatorRow) ?? []),
    ...(data?.pairCoverage.map(pairRow).filter((row): row is SignalRow => row !== null) ?? []),
    // Figma J28 — เกณฑ์ที่ผู้ประเมินเห็นไม่ตรงกัน แก้คำอธิบายในงานถัดไป (แก้หลังเผยแพร่ไม่ได้) จึงนับเป็นเรียบร้อย
    ...(data?.criteria ?? [])
      .filter((criterion) => criterion.flags.includes('QS-07'))
      .map(
        (criterion): SignalRow => ({
          kind: 'criterion',
          key: criterion.criterionId,
          criterion,
          status: 'DONE',
          pill: 'ปรับในงานถัดไป',
        }),
      ),
  ]
  const visible = signalled.filter((row) => filter === 'ALL' || row.status === filter)
  const flagCount = signalled.reduce((sum, row) => sum + (row.kind === 'evaluator' ? row.item.flags.length : 1), 0)
  const counts: Record<string, number> = {
    ALL: signalled.length,
    TODO: signalled.filter((row) => row.status === 'TODO').length,
    PENDING: signalled.filter((row) => row.status === 'PENDING').length,
    DONE: signalled.filter((row) => row.status === 'DONE').length,
  }
  const filterLabels: Record<string, string> = { TODO: 'ต้องตรวจ', PENDING: 'รอผล', DONE: 'เรียบร้อย' }
  const multiCriteria = new Set(data?.pairCoverage.map((pair) => pair.criterionId)).size > 1
  function openAnswers(item: Reviewer, button: HTMLButtonElement) {
    trigger.current = button
    setSelected(item)
    setMode('answers')
    setReason('')
    setIdentity(null)
    setActionError(null)
    // เปิดดูครั้งแรก = "ดูแล้ว · เก็บไว้" จนกว่าจะตัดคำตอบ · ห้องที่เก็บเข้าคลังอ่านอย่างเดียวจึงไม่บันทึก
    if (item.flags.length && !item.reviewedAt && !item.excluded && !archived)
      void markReviewerReviewed(assignmentId, item.key)
        .then(({ reviewedAt }) =>
          setData((current) =>
            current && {
              ...current,
              evaluators: current.evaluators.map((row) => (row.key === item.key ? { ...row, reviewedAt } : row)),
            },
          ),
        )
        .catch(() => undefined)
  }
  if (forbidden !== false) {
    const copy = forbiddenCopy(forbidden || null, classroomId)
    return (
      <div className="min-h-screen bg-ground text-ink">
        <AppNav context="รายงานคุณภาพ" />
        <main className="px-4">
          <ForbiddenState {...copy} />
        </main>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-ground text-ink">
      <AppNav context="รายงานคุณภาพ" contextTo={`/classrooms/${classroomId}#assignments`} classroomId={classroomId} />
      <main className="mx-auto max-w-290 pt-8 pb-16 max-xl:px-7 max-sm:px-4">
        <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-2.5 text-[14px] text-ink-2 [&_a]:inline-flex [&_a]:min-h-6 [&_a]:items-center">
          <Link to="/classrooms" className={`hover:text-accent-ink ${FOCUS}`}>
            ห้องเรียนของฉัน
          </Link>
          <span aria-hidden="true">›</span>
          <Link to={`/classrooms/${classroomId}`} className={`hover:text-accent-ink ${FOCUS}`}>
            {roomName || 'ห้องเรียน'}
          </Link>
          <span aria-hidden="true">›</span>
          <Link
            to={`/classrooms/${classroomId}/assignments/${assignmentId}`}
            className={`hover:text-accent-ink ${FOCUS}`}
          >
            {assignment?.name}
          </Link>
        </nav>
        <div className="relative mt-6 mb-6 flex min-h-41 items-center gap-4">
          <BackChevron to={`/classrooms/${classroomId}/assignments/${assignmentId}`} label="กลับหน้างานประเมิน" inline />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[32px] font-bold max-sm:text-2xl">
              {view === 'coverage' ? 'coverage รายคู่' : 'รายงานคุณภาพการประเมิน'}
            </h1>
            <p className="mt-2 text-[15px] text-ink-2">
              {view === 'coverage'
                ? 'ดูว่าแต่ละคู่ได้รับการประเมินกี่ครั้ง และสั่งเพิ่มได้'
                : 'สัญญาณที่ระบบตรวจพบ — เป็นข้อมูลให้ตัดสิน ไม่ใช่การลงโทษอัตโนมัติ'}
            </p>
          </div>
          <img
            src={view === 'coverage' ? coverageHeading : reportHeading}
            alt=""
            width={220}
            height={165}
            className="hidden shrink-0 sm:block sm:w-40 lg:w-55"
          />
        </div>
        {error && (
          <Banner tone="err" role="alert" className="mb-5">
            {error}
            <button onClick={() => void refresh()} className={btn('ghost', 'sm', 'ml-3')}>
              ลองใหม่
            </button>
          </Banner>
        )}
        {notice && (
          <Banner tone="info" role="status" className="mb-5">
            {notice}
          </Banner>
        )}
        {view === 'signals' && data?.evaluators.some((item) => item.excluded) && (
          <Banner tone="info" className="mb-5">
            ระบบไม่เคยตัดคำตอบทิ้งเองจากสัญญาณเหล่านี้ การยกเว้นคำตอบใดเป็นการตัดสินของอาจารย์ และคำตอบเดิมยังเก็บไว้เสมอ
          </Banner>
        )}
        {!data && !error && <p role="status">กำลังโหลดรายงาน…</p>}
        {data && (
          <>
            <ReportTabs
              classroomId={classroomId}
              assignmentId={assignmentId}
              active={view}
              showAppeals={assignment?.status === 'FINALIZED'}
            />
            {view === 'signals' ? (
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge bg-surface-cream px-5 py-4">
                  <div>
                    <h2 className="font-display text-[16px] font-semibold">สัญญาณคุณภาพ</h2>
                    <p className="mt-1 text-[13.5px] text-ink-2">
                      ตรวจครบ 7 แบบ ·{' '}
                      {filter === 'ALL'
                        ? `พบ ${flagCount} สัญญาณใน ${signalled.length} รายการ`
                        : `แสดง${filterLabels[filter]} ${visible.length} จาก ${signalled.length} รายการ`}{' '}
                      · ระบบไม่ตัดคำตอบให้เอง
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['ALL', 'ทั้งหมด', '', 'border-ink bg-white'],
                        ['TODO', 'ต้องตรวจ', 'bg-brand-600', 'border-accent-ink bg-accent-soft'],
                        ['PENDING', 'รอผล', 'bg-info-ink', 'border-info-ink bg-info-soft'],
                        ['DONE', 'เรียบร้อย', 'bg-ok-600', 'border-ok-700 bg-ok-50 text-ok-700'],
                      ] as const
                    ).map(([value, label, dot, active]) => (
                      <button
                        key={value}
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 font-display text-[14px] font-semibold ${FOCUS} ${filter === value ? active : 'border-edge bg-white'}`}
                      >
                        {dot && <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />}
                        {label}
                        <span className="rounded-full bg-sand px-2 text-[12px]">{counts[value]}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative overflow-x-auto" role="region" aria-label="ตารางสัญญาณคุณภาพ" tabIndex={0}>
                  <table className="w-full min-w-160 text-left text-sm">
                    <caption className="sr-only">รายงานผู้ประเมินแบบไม่แสดงตัวตน</caption>
                    <thead className="border-y border-edge bg-white">
                      <tr>
                        {['รายการ', 'สัญญาณ', 'ค่าที่วัดได้', 'เกณฑ์', 'สถานะ', ''].map((label, index) => (
                          <th key={index} className="bg-table-head px-5 py-3.5 font-normal">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row) => (
                        <tr key={row.key} className="border-b border-edge">
                          {row.kind === 'evaluator' ? (
                            <>
                              <th scope="row" className="px-5 py-4 text-left font-semibold">
                                <span className="block text-[12px] font-normal text-muted">ผู้ประเมิน</span>
                                {row.item.label}
                              </th>
                              <td className="px-5 py-4">
                                {row.item.flags.length ? (
                                  row.item.flags.map((flag) => (
                                    <p key={flag}>
                                      {signalLabels[flag]} · {flag}
                                    </p>
                                  ))
                                ) : (
                                  <p>{row.item.submittedCount ? 'ไม่พบสัญญาณที่ตรวจได้' : 'ยังไม่มีคำตอบที่ส่ง'}</p>
                                )}
                                {row.item.submittedCount > 0 && row.item.submittedCount < 3 && (
                                  <p className="mt-1 text-xs text-muted">ข้อมูลยังน้อย กรุณาพิจารณาประกอบ</p>
                                )}
                              </td>
                              <td className="px-5 py-4">
                                {row.item.flags.map((flag) => (
                                  <p key={flag}>{measure(row.item, flag).value}</p>
                                ))}
                              </td>
                              <td className="px-5 py-4 text-ink-2">
                                {row.item.flags.map((flag) => (
                                  <p key={flag}>{measure(row.item, flag).threshold}</p>
                                ))}
                              </td>
                            </>
                          ) : row.kind === 'criterion' ? (
                            <>
                              <th scope="row" className="px-5 py-4 text-left font-semibold">
                                <span className="block text-[12px] font-normal text-muted">เกณฑ์</span>
                                {row.criterion.name}
                              </th>
                              <td className="px-5 py-4">
                                {signalLabels['QS-07']} · QS-07
                                {/* FR-QS-03 — ต่ำต่อเนื่องหลายงาน แปลว่าปัญหาอยู่ที่ตัวเกณฑ์ ไม่ใช่ผู้ประเมินรอบนี้ */}
                                {row.criterion.flags.includes('QS-07-REPEATED') && (
                                  <p data-testid="criterion-repeated-low-agreement" className="mt-1 text-[13px] text-warn">
                                    ต่ำติดต่อกัน {row.criterion.lowAgreementStreak} งาน — เกณฑ์นี้อาจเขียนไม่ชัด ควรแก้คำอธิบาย
                                  </p>
                                )}
                              </td>
                              <td className="px-5 py-4" title="Kendall's u — ค่าความสอดคล้องสำหรับข้อมูลเปรียบเทียบเป็นคู่">
                                u = {row.criterion.agreement?.toFixed(2)}
                              </td>
                              <td className="px-5 py-4 text-ink-2">&lt; 0.20</td>
                            </>
                          ) : (
                            <>
                              <th scope="row" className="px-5 py-4 text-left font-semibold">
                                <span className="block text-[12px] font-normal text-muted">คู่</span>
                                {row.pair.itemALabel} – {row.pair.itemBLabel}
                              </th>
                              <td className="px-5 py-4">
                                <p>
                                  {signalLabels['QS-01']} · QS-01
                                </p>
                                {multiCriteria && <p className="mt-1 text-xs text-muted">{row.pair.criterionName}</p>}
                              </td>
                              <td className="px-5 py-4">
                                {row.pair.instructorCount
                                  ? `${row.pair.submittedCount - row.pair.instructorCount} ครั้ง → ${row.pair.submittedCount} (รวมอาจารย์)`
                                  : `${row.pair.submittedCount} ครั้ง${row.pair.pendingCount ? ` · รออีก ${row.pair.pendingCount}` : ''}`}
                              </td>
                              <td className="px-5 py-4 text-ink-2">&lt; {row.pair.expectedCount} ครั้ง</td>
                            </>
                          )}
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex min-h-9.5 min-w-33 items-center justify-center rounded-full px-4 font-display text-[13.5px] font-semibold ${pillTone[row.status]}`}
                            >
                              {row.pill}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {row.kind === 'evaluator' ? (
                              <button
                                className={btn(row.status === 'TODO' ? 'primary' : 'ghost', 'sm', 'px-5')}
                                onClick={(event) => openAnswers(row.item, event.currentTarget)}
                              >
                                ดูคำตอบ<span className="sr-only"> {row.item.label}</span>
                              </button>
                            ) : row.kind === 'criterion' ? (
                              <button
                                className={btn('ghost', 'sm', 'px-5')}
                                onClick={(event) => {
                                  distributionTrigger.current = event.currentTarget
                                  setShowDistribution(true)
                                }}
                              >
                                ดูการกระจาย<span className="sr-only"> {row.criterion.name}</span>
                              </button>
                            ) : (
                              <Link to="#coverage" className={btn('ghost', 'sm', 'px-5')}>
                                ดู coverage
                                <span className="sr-only">
                                  {' '}
                                  {row.pair.itemALabel} เทียบ {row.pair.itemBLabel}
                                </span>
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!visible.length && (
                  <p className="p-6 text-sm text-muted">
                    {signalled.length
                      ? 'ไม่พบรายการตามตัวกรอง'
                      : 'ยังไม่พบสัญญาณคุณภาพ · ระบบตรวจซ้ำทุกครั้งที่มีคำตอบใหม่'}
                  </p>
                )}
                {/* Figma J28 — บรรทัดท้ายบอกผล QS-06 เมื่อไม่พบ */}
                {!data.evaluators.some((item) => item.flags.includes('QS-06')) && (
                  <p className="px-5 py-3.5 text-[13px] text-ink-2">
                    {data.favoritismAssessed
                      ? '✓ ไม่พบ: ลำเอียงให้เพื่อนร่วมกลุ่ม · QS-06 (ไม่มีใครได้คะแนนรายบุคคลสูงผิดปกติ)'
                      : 'QS-06 ลำเอียงให้เพื่อนร่วมกลุ่ม · ยังตรวจไม่ได้ — คำตอบรายบุคคลยังไม่พอเทียบ'}
                  </p>
                )}
              </Card>
            ) : (
              assignment && (
                <Card className="overflow-hidden">
                  {/* Figma J26 — ตารางเดียว "ทุกคู่ในงานนี้" · คู่ที่ได้ผลน้อยกว่าเป้าหมายติดป้ายข้อมูลไม่พอ · ปุ่มสั่งเพิ่มอยู่ท้ายการ์ด */}
                  <div className="border-b border-edge bg-surface-cream px-5 py-4">
                    <h2 className="font-display text-[16px] font-semibold">ทุกคู่ในงานนี้</h2>
                    <p className="mt-1 text-[13.5px] text-ink-2">
                      {data.pairCoverage.length
                        ? `คู่ที่ได้รับน้อยกว่า ${data.pairCoverage[0].expectedCount} ครั้งจะถูกทำเครื่องหมายว่าข้อมูลไม่พอ · สั่งให้คนอื่นประเมินเพิ่ม หรืออาจารย์ประเมินเองก็ได้`
                        : 'คู่ที่ได้รับน้อยกว่าเป้าหมายจะถูกทำเครื่องหมายว่าข้อมูลไม่พอ'}
                    </p>
                  </div>
                  <div className="relative overflow-x-auto" role="region" aria-label="ตารางความครอบคลุมรายคู่" tabIndex={0}>
                    <table className="w-full min-w-180 text-left text-[14px]">
                      <caption className="sr-only">
                        ส่งแล้วเทียบกับที่มอบหมายและเป้าหมาย ไม่รวมผู้ประเมินที่ถูกตัดคำตอบ
                      </caption>
                      <thead className="bg-table-head">
                        <tr>
                          {['คู่ที่เทียบ', 'เกณฑ์', 'ส่งแล้ว / มอบหมาย', 'ผลเฉลี่ย', 'สถานะ'].map((label, index) => (
                            <th
                              key={index}
                              scope="col"
                              title={index === 3 ? 'คะแนนเฉลี่ยที่ฝั่งแรกของคู่ได้ (0–1) จากคำตอบที่นับเข้าคะแนน' : undefined}
                              className={`px-5 py-3 font-normal ${index >= 2 && index <= 4 ? 'text-right' : ''}`}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-edge">
                        {data.pairCoverage.map((pair) => {
                          const short = pair.submittedCount < pair.expectedCount
                          const key = pairKey(pair)
                          const picked = short && key === currentPair?.key
                          return (
                            <tr
                              key={key}
                              onClick={short ? () => setPickedPair(key) : undefined}
                              className={picked ? 'bg-caution-soft/40' : short ? 'cursor-pointer hover:bg-sand/40' : ''}
                            >
                              <th scope="row" className="px-5 py-3.5 font-normal">
                                {short ? (
                                  <button
                                    type="button"
                                    aria-pressed={picked}
                                    onClick={() => setPickedPair(key)}
                                    className={`min-h-6 text-left ${FOCUS}`}
                                  >
                                    {pair.itemALabel} เทียบ {pair.itemBLabel}
                                    <span className="sr-only"> · เลือกคู่นี้เพื่อสั่งประเมินเพิ่ม</span>
                                  </button>
                                ) : (
                                  <>
                                    {pair.itemALabel} เทียบ {pair.itemBLabel}
                                  </>
                                )}
                              </th>
                              <td className="px-5 py-3.5">{pair.criterionName}</td>
                              <td className="px-5 py-3.5 text-right font-mono tabular">
                                {pair.submittedCount} / {pair.assignedCount}
                                {pair.expectedCount !== data.pairCoverage[0].expectedCount && (
                                  <span className="block font-body text-[11.5px] text-muted">
                                    เป้าหมาย {pair.expectedCount}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono tabular">
                                {pair.meanScoreA === null ? '—' : pair.meanScoreA.toFixed(2)}
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                {short ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-caution-soft px-3 py-1.5 font-display text-[13px] font-semibold text-warn">
                                    ◷ ข้อมูลไม่พอ
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-ok-50 px-3 py-1.5 font-display text-[13px] font-semibold text-ok-700">
                                    ✓ ข้อมูลพอ
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!data.pairCoverage.length && (
                    <p className="p-5 text-sm text-muted">ยังไม่มีคู่ที่เปรียบเทียบได้จากสมาชิกปัจจุบัน</p>
                  )}
                  {currentPair && (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-edge px-5 py-4">
                      <p className="flex-1 text-[13.5px] text-ink-2">
                        คู่ที่ข้อมูลไม่พอ สั่งให้คนอื่นประเมินเพิ่ม หรืออาจารย์ประเมินเองก็ได้
                        <span className="block text-[12.5px] text-muted">
                          คู่ที่เลือก: {currentPair.pair.itemALabel} เทียบ {currentPair.pair.itemBLabel} ·{' '}
                          {currentPair.pair.criterionName}
                        </span>
                      </p>
                      <CoverageActions
                        key={currentPair.key}
                        pair={currentPair.pair}
                        assignmentId={assignmentId}
                        canReview={Boolean(writable)}
                        canAssign={
                          Boolean(writable) &&
                          now <
                            Date.parse(
                              currentPair.pair.side === 'GROUP'
                                ? assignment.groupDeadlineUtc
                                : (assignment.individualDeadlineUtc ?? assignment.groupDeadlineUtc),
                            )
                        }
                        onChanged={refresh}
                      />
                    </div>
                  )}
                </Card>
              )
            )}
            {view === 'coverage' && (
              // Figma J26 — ปุ่มส่งออกใต้การ์ด
              <div className="mt-5 flex justify-end">
                <Link
                  to={`/classrooms/${classroomId}/assignments/${assignmentId}/export`}
                  className={btn('ghost', 'md', 'border-brand-600 px-6 text-accent-ink')}
                >
                  ส่งออก
                </Link>
              </div>
            )}
          </>
        )}
        {showDistribution && data?.criteria && (
          <DistributionDialog
            assignmentName={assignment?.name ?? ''}
            criteria={data.criteria}
            onClose={() => {
              setShowDistribution(false)
              distributionTrigger.current?.focus()
            }}
          />
        )}
        {/* Figma J29 / J30 — รายละเอียดผู้ประเมินเป็น drawer ด้านขวา · ตัวตนจริงซ่อนจนกว่าเจ้าของห้องจะเปิดดูพร้อมเหตุผล */}
        <dialog
          ref={dialog}
          aria-label={`คำตอบของ ${selected?.label ?? 'ผู้ประเมิน'}`}
          onCancel={(event) => {
            event.preventDefault()
            if (!busy) close()
          }}
          className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(35rem,100vw)] max-w-none overflow-y-auto rounded-none bg-white p-0 text-ink shadow-[-12px_0_40px_rgba(50,16,7,0.18)] backdrop:bg-ink/40"
        >
          {selected && (
            <div className="flex min-h-full flex-col">
              <div className="flex items-start gap-3 px-5 pt-5 sm:px-7 sm:pt-7">
                <span
                  aria-hidden="true"
                  className={`mt-1 grid size-12 shrink-0 place-items-center rounded-full font-display text-[16px] font-semibold ${identity ? 'bg-ok-50 text-ok-700' : 'bg-sand text-ink-2'}`}
                >
                  {identity ? (identity.displayName ?? identity.email).slice(0, 2) : selected.label}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-[22px] leading-[33px] font-bold">
                    {identity ? (identity.displayName ?? identity.email) : `ผู้ประเมิน ${selected.label}`}
                  </h2>
                  <p className="break-all text-[14px] text-muted">
                    {identity
                      ? `${identity.email} · รหัสในรายงาน ${selected.label}`
                      : 'รหัสแทนชื่อ · ตัวตนจริงยังไม่แสดง'}
                  </p>
                </div>
                <button
                  disabled={busy}
                  onClick={close}
                  aria-label="ปิดคำตอบ"
                  className={`grid size-9 place-items-center rounded-full text-ink-2 hover:bg-sand ${FOCUS}`}
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 px-5 pb-4 sm:px-7">
                {identity ? (
                  <p className="mt-4.5 rounded-2xl bg-info-soft px-3.5 py-3 text-[14px] text-info-ink">
                    บันทึกการเปิดดูแล้ว · ดูได้ในบันทึกการตรวจสอบ
                  </p>
                ) : (
                  <p className="mt-4.5 rounded-2xl bg-[#f3f1ef] px-3.5 py-3 text-[14px] text-ink-2">
                    {owner ? 'เจ้าของห้องเปิดดูตัวตนได้ทุกเมื่อ · ทุกครั้งที่เปิดดูจะถูกบันทึก audit อัตโนมัติ · ' : ''}
                    ผู้สอนร่วมและ TA ไม่เห็นตัวตน
                  </p>
                )}
                {selected.flags.length > 0 && (
                  <div className="mt-4.5 flex flex-wrap gap-2">
                    {selected.flags.map((flag) => (
                      <span
                        key={flag}
                        className="rounded-full bg-accent-soft px-2.5 py-1 font-display text-[13px] font-semibold text-accent-ink"
                      >
                        {flag} {signalLabels[flag] ?? ''}
                      </span>
                    ))}
                  </div>
                )}
                {mode === 'answers' ? (
                  <>
                    <div className="mt-4.5 overflow-hidden rounded-2xl border border-edge">
                      <table className="w-full text-[14px]">
                        <thead className="bg-surface-cream text-left">
                          <tr>
                            <th scope="col" className="px-3.5 py-2.5 font-normal sm:w-[234px]">
                              คู่ · เกณฑ์
                            </th>
                            <th scope="col" className="px-3.5 py-2.5 font-normal">
                              คำตอบ
                            </th>
                            <th scope="col" className="px-3.5 py-2.5 text-right font-normal">
                              เวลา
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-edge">
                          {selected.answers.map((answer, index) => {
                            const left = answer.choice <= 3
                            return (
                              <tr key={index}>
                                <td className="px-3.5 py-2.5">
                                  {answer.leftLabel} – {answer.rightLabel} · {answer.criterionName}
                                </td>
                                <td className="px-3.5 py-2.5 font-semibold">
                                  {left ? answer.leftLabel : answer.rightLabel}{' '}
                                  {COMPARISON_SCALE.find((choice) => choice.id === answer.choice)?.label.replace(
                                    /^(ซ้าย|ขวา)/,
                                    '',
                                  )}{' '}
                                  ({left ? 'ฝั่งซ้าย' : 'ฝั่งขวา'})
                                </td>
                                <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                  {answer.timeOnTaskMs === null ? '—' : `${(answer.timeOnTaskMs / 1000).toFixed(1)} วิ`}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      <p className="border-t border-edge px-3.5 py-2.5 text-[13px] text-muted">
                        ส่งแล้ว {selected.submittedCount} จาก {selected.assignedCount} ข้อ · ตรวจได้{' '}
                        {selected.checkedTriples} วงสามรายการ พบวงขัดกัน {selected.cycles} วง
                      </p>
                    </div>
                    {!selected.answers.length && <p className="mt-4 text-sm text-muted">ยังไม่มีคำตอบที่ส่งแล้ว</p>}
                  </>
                ) : (
                  <>
                    <Banner tone="warn" className="mt-5">
                      {mode === 'identity'
                        ? 'เฉพาะเจ้าของห้อง การเปิดตัวตนต้องมีเหตุผลและบันทึกประวัติ'
                        : 'การตัดหรือคืนคำตอบจะคำนวณคะแนนชั่วคราวใหม่ คำตอบต้นฉบับและการมีส่วนร่วมยังอยู่ครบ'}
                    </Banner>
                    <label className="mt-4 block text-sm font-semibold">
                      เหตุผลในการดำเนินการ
                      <textarea
                        autoFocus
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        maxLength={2000}
                        disabled={busy}
                        className={`${CTRL} mt-2 min-h-24`}
                      />
                    </label>
                    {actionError && (
                      <Banner tone="err" role="alert" className="mt-4">
                        {actionError}
                      </Banner>
                    )}
                  </>
                )}
              </div>
              <div className="sticky bottom-0 grid grid-cols-2 gap-2.5 bg-white px-5 pt-4 pb-6 sm:grid-cols-[212px_212px] sm:justify-end sm:px-7">
                {mode === 'answers' ? (
                  <>
                    {owner && !identity ? (
                      <button
                        onClick={() => {
                          setMode('identity')
                          setReason('')
                        }}
                        className={btn('ghost', 'md')}
                      >
                        ดูตัวตน
                      </button>
                    ) : (
                      <button onClick={close} className={btn('ghost', 'md')}>
                        ปิด
                      </button>
                    )}
                    {owner && writable ? (
                      <button
                        onClick={() => {
                          setMode('exclusion')
                          setReason('')
                        }}
                        className={btn('ghost', 'md', 'border-line-neutral text-err')}
                      >
                        {selected.excluded ? 'คืนคำตอบเข้าคำนวณ' : `ตัดคำตอบทั้งหมดของ ${selected.label}`}
                      </button>
                    ) : (
                      <span />
                    )}
                  </>
                ) : (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setMode('answers')
                        setActionError(null)
                      }}
                      className={btn('ghost', 'md')}
                    >
                      กลับ
                    </button>
                    <button
                      disabled={busy || !reason.trim()}
                      onClick={() => void act()}
                      className={btn('primary', 'md')}
                    >
                      {busy
                        ? 'กำลังบันทึก…'
                        : mode === 'identity'
                          ? 'ยืนยันดูตัวตน'
                          : selected.excluded
                            ? 'ยืนยันคืนคำตอบ'
                            : 'ยืนยันตัดคำตอบ'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </dialog>
      </main>
    </div>
  )
}
