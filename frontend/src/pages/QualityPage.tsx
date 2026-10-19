import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { AppNav } from '../components/AppNav'
import { BackChevron, ForbiddenState, forbiddenCopy } from '../components/PageChrome'
import { CoverageActions } from '../components/CoverageActions'
import { Banner, Card, CTRL, FOCUS, btn } from '../components/Ui'
import {
  ApiError,
  type Assignment,
  type QualityReport,
  type Reviewer,
  getAssignment,
  getMe,
  getQuality,
  listClassrooms,
  revealReviewer,
  setReviewerExclusion,
} from '../lib/api'
import { COMPARISON_SCALE } from '../lib/scale'
import reportHeading from '../assets/figma/owner-report-heading.png'

const signalLabels: Record<string, string> = {
  'QS-01': 'คำตอบยังน้อย',
  'QS-02': 'เลือกค่าเดิมซ้ำ',
  'QS-03': 'เลือกข้างเดียวบ่อย',
  'QS-04': 'คำตอบเป็นวง',
  'QS-05': 'เวลาเฉลี่ยต่ำ',
}

export default function QualityPage() {
  const { classroomId = '', assignmentId = '' } = useParams()
  const [data, setData] = useState<QualityReport | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [owner, setOwner] = useState(false)
  const [archived, setArchived] = useState(false)
  const { hash } = useLocation()
  const [view, setView] = useState(hash === '#coverage' ? 'coverage' : 'signals')
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
  // Figma J28 แสดงเฉพาะรายการที่มีสัญญาณหรือถูกตัดคำตอบ — แถวที่ไม่มีอะไรให้ตรวจไม่ต้องรก
  const signalled = data?.evaluators.filter((item) => item.flags.length > 0 || item.excluded) ?? []
  const visible = signalled.filter(
    (item) => filter === 'ALL' || (filter === 'EXCLUDED' ? item.excluded : item.flags.length > 0 && !item.excluded),
  )
  const flagCount = signalled.reduce((sum, item) => sum + item.flags.length, 0)
  const counts = {
    ALL: signalled.length,
    FLAGGED: signalled.filter((item) => item.flags.length > 0 && !item.excluded).length,
    EXCLUDED: signalled.filter((item) => item.excluded).length,
  }
  const tabClass = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-xl px-4 font-display text-[14.5px] font-semibold ${FOCUS} ${active ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-sand'}`
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
        <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-2.5 text-[14px] text-ink-2">
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
          <BackChevron to={`/classrooms/${classroomId}/assignments/${assignmentId}`} label="กลับหน้างานประเมิน" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[32px] font-bold max-sm:text-2xl">
              {view === 'coverage' ? 'Coverage รายคู่' : 'รายงานคุณภาพการประเมิน'}
            </h1>
            <p className="mt-2 text-[15px] text-ink-2">
              {view === 'coverage'
                ? `${assignment?.name ?? ''} · จำนวนผลประเมินต่อคู่เทียบกับเป้าหมาย`
                : 'สัญญาณที่ระบบตรวจพบ — เป็นข้อมูลให้ตัดสิน ไม่ใช่การลงโทษอัตโนมัติ'}
            </p>
          </div>
          <img
            src={reportHeading}
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
        {!data && !error && <p role="status">กำลังโหลดรายงาน…</p>}
        {data && (
          <>
            <div
              role="group"
              aria-label="เลือกรายงาน"
              className="mb-5 inline-flex flex-wrap gap-1 rounded-2xl border border-edge bg-white p-1.5"
            >
              <Link to={`/classrooms/${classroomId}#scores`} className={tabClass(false)}>
                คะแนนกลุ่ม
              </Link>
              <Link to={`/classrooms/${classroomId}#scores`} className={tabClass(false)}>
                คะแนนรายบุคคล
              </Link>
              <button
                aria-pressed={view === 'coverage'}
                onClick={() => setView('coverage')}
                className={tabClass(view === 'coverage')}
              >
                coverage รายคู่
              </button>
              <button
                aria-pressed={view === 'signals'}
                onClick={() => setView('signals')}
                className={tabClass(view === 'signals')}
              >
                คุณภาพการประเมิน
              </button>
            </div>
            {view === 'signals' ? (
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge bg-surface-cream px-5 py-4">
                  <div>
                    <h2 className="font-display text-[16px] font-semibold">สัญญาณคุณภาพ</h2>
                    <p className="mt-1 text-[13.5px] text-ink-2">
                      ตรวจครบ 7 แบบ · พบ {flagCount} สัญญาณใน {signalled.length} รายการ · ระบบไม่ตัดคำตอบให้เอง
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['ALL', 'ทั้งหมด', ''],
                        ['FLAGGED', 'ต้องตรวจ', 'bg-brand-600'],
                        ['EXCLUDED', 'ตัดคำตอบแล้ว', 'bg-ok-600'],
                      ] as const
                    ).map(([value, label, dot]) => (
                      <button
                        key={value}
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 font-display text-[14px] font-semibold ${FOCUS} ${filter === value ? 'border-ink bg-white' : 'border-edge bg-white'}`}
                      >
                        {dot && <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />}
                        {label}
                        <span className="rounded-full bg-sand px-2 text-[12px]">{counts[value]}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto" role="region" aria-label="ตารางสัญญาณคุณภาพ" tabIndex={0}>
                  <table className="w-full min-w-160 text-left text-sm">
                    <caption className="sr-only">รายงานผู้ประเมินแบบไม่แสดงตัวตน</caption>
                    <thead className="border-y border-edge bg-white">
                      <tr>
                        {['รายการ', 'สัญญาณ', 'ส่งแล้ว', 'เวลาเฉลี่ย', 'สถานะ', ''].map((label, index) => (
                          <th key={index} className="bg-table-head px-5 py-3.5 font-normal">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((item) => (
                        <tr key={item.key} className="border-b border-edge">
                          <th scope="row" className="px-5 py-4 text-left font-semibold">
                            <span className="block text-[12px] font-normal text-muted">ผู้ประเมิน</span>
                            {item.label}
                          </th>
                          <td className="px-5 py-4">
                            {item.flags.length
                              ? item.flags.map((flag) => `${signalLabels[flag]} · ${flag}`).join(' / ')
                              : item.submittedCount
                                ? 'ไม่พบสัญญาณที่ตรวจได้'
                                : 'ยังไม่มีคำตอบที่ส่ง'}
                            {item.submittedCount > 0 && item.submittedCount < 3 && (
                              <p className="mt-1 text-xs text-muted">ข้อมูลยังน้อย กรุณาพิจารณาประกอบ</p>
                            )}
                          </td>
                          <td className="px-5 py-4 font-mono">
                            {item.submittedCount}/{item.assignedCount}
                          </td>
                          <td className="px-5 py-4">
                            {item.meanTimeMs === null
                              ? 'ยังไม่มีข้อมูล'
                              : `${(item.meanTimeMs / 1000).toFixed(1)} วินาที`}
                            <p className="mt-1 text-xs text-muted">วัดได้ {item.timedCount} ข้อ</p>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex min-h-9.5 min-w-33 items-center justify-center rounded-full px-4 font-display text-[13.5px] font-semibold ${item.excluded ? 'bg-ok-50 text-ok-700' : 'bg-accent-soft text-accent-ink'}`}
                            >
                              {item.excluded ? 'ตัดคำตอบแล้ว' : 'ต้องตรวจ'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              className={btn(item.excluded ? 'ghost' : 'primary', 'sm', 'px-5')}
                              onClick={(event) => {
                                trigger.current = event.currentTarget
                                setSelected(item)
                                setMode('answers')
                                setReason('')
                                setIdentity(null)
                                setActionError(null)
                              }}
                            >
                              ดูคำตอบ<span className="sr-only"> {item.label}</span>
                            </button>
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
              </Card>
            ) : (
              assignment && (
                <Card className="overflow-hidden">
                  {/* Figma J26 — ตารางเดียว "ทุกคู่ในงานนี้" · คู่ที่ได้ผลน้อยกว่าเป้าหมายติดป้ายข้อมูลไม่พอ และสั่งเพิ่มได้ในแถวนั้น */}
                  <div className="border-b border-edge bg-surface-cream px-5 py-4">
                    <h2 className="font-display text-[16px] font-semibold">ทุกคู่ในงานนี้</h2>
                    <p className="mt-1 text-[13.5px] text-ink-2">
                      คู่ที่ได้รับน้อยกว่าเป้าหมายจะถูกทำเครื่องหมายว่าข้อมูลไม่พอ · สั่งให้คนอื่นประเมินเพิ่ม
                      หรืออาจารย์ประเมินเองก็ได้
                    </p>
                  </div>
                  <div className="overflow-x-auto" role="region" aria-label="ตารางความครอบคลุมรายคู่" tabIndex={0}>
                    <table className="w-full min-w-180 text-left text-[14px]">
                      <caption className="sr-only">
                        ส่งแล้วเทียบกับที่มอบหมายและเป้าหมาย ไม่รวมผู้ประเมินที่ถูกตัดคำตอบ
                      </caption>
                      <thead className="bg-table-head">
                        <tr>
                          {['คู่ที่เทียบ', 'เกณฑ์', 'ส่งแล้ว / มอบหมาย', 'สถานะ', ''].map((label, index) => (
                            <th
                              key={index}
                              scope="col"
                              className={`px-5 py-3 font-normal ${index === 2 || index === 3 ? 'text-right' : ''}`}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-edge">
                        {data.pairCoverage.map((pair) => {
                          const short = pair.submittedCount < pair.expectedCount
                          return (
                            <tr key={`${pair.criterionId}-${pair.itemAId}-${pair.itemBId}`}>
                              <th scope="row" className="px-5 py-3.5 font-normal">
                                {pair.itemALabel} เทียบ {pair.itemBLabel}
                              </th>
                              <td className="px-5 py-3.5">{pair.criterionName}</td>
                              <td className="px-5 py-3.5 text-right font-mono tabular">
                                {pair.submittedCount} / {pair.assignedCount}
                                <span className="block font-body text-[11.5px] text-muted">
                                  เป้าหมาย {pair.expectedCount}
                                </span>
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
                              <td className="px-5 py-3.5 text-right">
                                {short && (
                                  <CoverageActions
                                    pair={pair}
                                    assignmentId={assignmentId}
                                    canReview={Boolean(writable)}
                                    canAssign={
                                      Boolean(writable) &&
                                      now <
                                        Date.parse(
                                          pair.side === 'GROUP'
                                            ? assignment.groupDeadlineUtc
                                            : (assignment.individualDeadlineUtc ?? assignment.groupDeadlineUtc),
                                        )
                                    }
                                    onChanged={refresh}
                                  />
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
                </Card>
              )
            )}
          </>
        )}
        {/* Figma J29 / J30 — รายละเอียดผู้ประเมินเป็น drawer ด้านขวา · ตัวตนจริงซ่อนจนกว่าเจ้าของห้องจะเปิดดูพร้อมเหตุผล */}
        <dialog
          ref={dialog}
          aria-label={`คำตอบของ ${selected?.label ?? 'ผู้ประเมิน'}`}
          onCancel={(event) => {
            event.preventDefault()
            if (!busy) close()
          }}
          className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(26rem,100vw)] max-w-none overflow-y-auto rounded-none bg-white p-0 text-ink shadow-[-12px_0_40px_rgba(50,16,7,0.18)] backdrop:bg-ink/40"
        >
          {selected && (
            <div className="flex min-h-full flex-col">
              <div className="flex items-start gap-3 px-5 pt-5">
                <span
                  aria-hidden="true"
                  className={`grid size-11 shrink-0 place-items-center rounded-full font-display text-[14px] font-semibold ${identity ? 'bg-ok-50 text-ok-700' : 'bg-sand text-ink-2'}`}
                >
                  {identity ? (identity.displayName ?? identity.email).slice(0, 2) : selected.label}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-[19px] font-bold">
                    {identity ? (identity.displayName ?? identity.email) : `ผู้ประเมิน ${selected.label}`}
                  </h2>
                  <p className="mt-0.5 break-all text-[12.5px] text-muted">
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
              <div className="flex-1 px-5 pb-4">
                {identity ? (
                  <p className="mt-4 rounded-2xl bg-info-soft px-4 py-3 text-[12.5px] text-info-ink">
                    บันทึกการเปิดดูแล้ว · ดูได้ในบันทึกการตรวจสอบ
                  </p>
                ) : (
                  <p className="mt-4 rounded-2xl bg-[#f3f1ef] px-4 py-3 text-[12.5px] text-ink-2">
                    {owner ? 'เจ้าของห้องเปิดดูตัวตนได้ทุกเมื่อ · ทุกครั้งที่เปิดดูจะถูกบันทึก audit อัตโนมัติ · ' : ''}
                    ผู้สอนร่วมและ TA ไม่เห็นตัวตน
                  </p>
                )}
                {selected.flags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.flags.map((flag) => (
                      <span
                        key={flag}
                        className="rounded-full bg-accent-soft px-3 py-1 font-display text-[12px] font-semibold text-accent-ink"
                      >
                        {flag} {signalLabels[flag] ?? ''}
                      </span>
                    ))}
                  </div>
                )}
                {mode === 'answers' ? (
                  <>
                    <div className="mt-4 overflow-hidden rounded-2xl border border-edge">
                      <table className="w-full text-[12.5px]">
                        <thead className="bg-surface-cream text-left">
                          <tr>
                            <th scope="col" className="px-3 py-2.5 font-normal">
                              คู่ · เกณฑ์
                            </th>
                            <th scope="col" className="px-3 py-2.5 font-normal">
                              คำตอบ
                            </th>
                            <th scope="col" className="px-3 py-2.5 text-right font-normal">
                              เวลา
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-edge">
                          {selected.answers.map((answer, index) => {
                            const left = answer.choice <= 3
                            return (
                              <tr key={index}>
                                <td className="px-3 py-2.5">
                                  {answer.leftLabel} – {answer.rightLabel} · {answer.criterionName}
                                </td>
                                <td className="px-3 py-2.5 font-semibold">
                                  {left ? answer.leftLabel : answer.rightLabel}{' '}
                                  {COMPARISON_SCALE.find((choice) => choice.id === answer.choice)?.label.replace(
                                    /^(ซ้าย|ขวา)/,
                                    '',
                                  )}{' '}
                                  ({left ? 'ฝั่งซ้าย' : 'ฝั่งขวา'})
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  {answer.timeOnTaskMs === null ? '—' : `${(answer.timeOnTaskMs / 1000).toFixed(1)} วิ`}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      <p className="border-t border-edge px-3 py-2.5 text-[11.5px] text-muted">
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
              <div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-edge bg-white px-5 py-4">
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
