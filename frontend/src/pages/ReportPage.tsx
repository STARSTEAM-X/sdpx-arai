import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { AppNav } from '../components/AppNav'
import { AppealsPanel } from '../components/AppealsPanel'
import { BackChevron, ForbiddenState, forbiddenCopy } from '../components/PageChrome'
import { ReportTabs } from '../components/ReportTabs'
import { FinalizeDialog, OverrideScoreDialog, ReopenDialog } from '../components/ScoringDialogs'
import { ScoresTable } from '../components/ScoresTable'
import { Banner, FOCUS, Spinner, btn } from '../components/Ui'
import {
  ApiError,
  type Appeal,
  type AssignmentSummary,
  type Scores,
  createScoreOverride,
  finalizeAssignment,
  getMe,
  getScores,
  listAppeals,
  listClassroomAssignments,
  listClassrooms,
  recomputeScores,
  reopenAssignment,
} from '../lib/api'
import { thaiDate } from '../lib/datetime'
import appealsHeading from '../assets/figma/appeals-heading.png'
import scoreHeading from '../assets/figma/score-report-heading.png'

type View = 'group' | 'individual' | 'appeals'

const TITLES: Record<View, string> = {
  group: 'รายงานคะแนนกลุ่ม',
  individual: 'รายงานคะแนนรายบุคคล',
  appeals: 'คำร้องอุทธรณ์คะแนน',
}

/** Figma J25 / J25b / J35 — รายงานคะแนนและคำร้องอุทธรณ์ของงานหนึ่งชิ้น เป็นหน้าแยกที่ใช้แท็บร่วมกับ J26 / J28 */
export default function ReportPage() {
  const { classroomId = '', assignmentId = '' } = useParams()
  const { hash } = useLocation()
  const view: View = hash === '#individual' ? 'individual' : hash === '#appeals' ? 'appeals' : 'group'
  const [item, setItem] = useState<AssignmentSummary | null>(null)
  const [room, setRoom] = useState<{
    name: string
    timezone: string
    archived: boolean
  } | null>(null)
  const [owner, setOwner] = useState(false)
  const [scores, setScores] = useState<Scores | null>(null)
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState<string | false>(false)
  const [busy, setBusy] = useState(false)
  const [overriding, setOverriding] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [list, rooms, me, result, appealList] = await Promise.all([
        listClassroomAssignments(classroomId),
        listClassrooms(),
        getMe(),
        getScores(assignmentId),
        listAppeals(classroomId).catch(() => ({ items: [] as Appeal[] })),
      ])
      const found = list.items.find((entry) => entry.id === assignmentId)
      if (!found) throw new Error('ไม่พบงานนี้ในห้องเรียน')
      const current = rooms.items.find((entry) => entry.id === classroomId)
      setItem(found)
      setRoom(
        current
          ? {
              name: current.name,
              timezone: current.timezone,
              archived: current.status === 'ARCHIVED',
            }
          : null,
      )
      setOwner(me.classrooms.find((entry) => entry.classroomId === classroomId)?.role === 'OWNER')
      setScores(result)
      setAppeals(appealList.items.filter((appeal) => appeal.assignmentId === assignmentId))
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        void getMe()
          .then((me) => setForbidden(me.classrooms.find((entry) => entry.classroomId === classroomId)?.role ?? ''))
          .catch(() => setForbidden(''))
        return
      }
      setError(err instanceof Error ? err.message : 'โหลดรายงานไม่สำเร็จ')
    }
  }, [assignmentId, classroomId])
  useEffect(() => {
    void refresh()
  }, [refresh])

  if (forbidden !== false) {
    const copy = forbiddenCopy(forbidden || null, classroomId)
    return (
      <div className="min-h-screen bg-ground text-ink">
        <AppNav context="รายงานคะแนน" />
        <main className="px-4">
          <ForbiddenState {...copy} />
        </main>
      </div>
    )
  }

  const timezone = room?.timezone ?? 'Asia/Bangkok'
  const finalized = item?.status === 'FINALIZED'
  const writable = owner && !room?.archived
  const canFinalize = item ? ['PUBLISHED', 'OPEN', 'CLOSED'].includes(item.status) : false
  const deadlinePassed = item
    ? Math.max(Date.parse(item.groupDeadlineUtc), Date.parse(item.individualDeadlineUtc ?? item.groupDeadlineUtc)) <=
      now
    : false
  const side = view === 'individual' ? 'INDIVIDUAL' : 'GROUP'
  const rows = scores?.items.filter((entry) => entry.side === side) ?? []
  const openAppeals = appeals.filter((appeal) => appeal.status === 'OPEN').length
  // Figma J35 — ยื่นได้ภายใน 7 วันหลังประกาศ (กฎเดียวกับ backend/app/api/appeals.py)
  const appealUntil = item?.finalizedAt
    ? thaiDate(new Date(Date.parse(item.finalizedAt) + 7 * 86400000).toISOString(), {
        timeZone: timezone,
        year: false,
        time: true,
      })
    : null
  const computedAt = scores?.computedAt
    ? new Date(scores.computedAt).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
      })
    : null
  const subtitle =
    view === 'appeals'
      ? `${item?.name ?? ''} · รอตอบ ${openAppeals} · ตอบแล้ว ${appeals.length - openAppeals}`
      : [
          item?.name,
          scores
            ? `${scores.isFinal ? 'คะแนนสุดท้าย' : 'คะแนนชั่วคราว'}${computedAt ? ` คำนวณล่าสุด ${computedAt} น.` : ''}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')

  async function recompute() {
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      const result = await recomputeScores(assignmentId)
      const at = new Date(result.computedAt).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
      })
      // Figma S02 — บอกเวลาอัปเดตและย้ำว่าคะแนนที่แก้ด้วยมือยังอยู่
      setNotice(
        `คำนวณคะแนนชั่วคราวใหม่แล้ว · อัปเดตล่าสุด ${at} น. · ` +
          (result.hasLowConfidenceItems
            ? 'มีบาง item ที่ผู้ประเมินยังไม่ถึงเกณฑ์ขั้นต่ำ'
            : 'ทุก item มีผู้ประเมินครบเกณฑ์') +
          ' · คะแนนที่อาจารย์แก้ด้วยมือยังคงอยู่',
      )
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'คำนวณคะแนนไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  /** Figma J31 — คืนข้อความเตือนถ้า server ขอให้ยืนยันเรื่องข้อมูลน้อย */
  async function finalize(confirmLowConfidence: boolean): Promise<string | null> {
    try {
      await finalizeAssignment(assignmentId, confirmLowConfidence)
      setNotice(confirmLowConfidence ? 'ประกาศผลคะแนนแล้ว (ยืนยันแม้มี item ความเชื่อมั่นต่ำ)' : 'ประกาศผลคะแนนแล้ว')
      await refresh()
      return null
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.field === 'confirmLowConfidence')
        return err.message
      throw err
    }
  }

  async function reopen(reason: string) {
    await reopenAssignment(assignmentId, reason)
    setNotice('เปิดผลคะแนนใหม่แล้ว — คะแนนกลับเป็นชั่วคราว นักศึกษาจะไม่เห็นจนกว่าจะประกาศอีกครั้ง')
    await refresh()
  }

  return (
    <div className="min-h-screen bg-ground text-ink">
      <AppNav context="รายงานคะแนน" />
      <main className="mx-auto max-w-290 pt-8 pb-16 max-xl:px-7 max-sm:px-4">
        <nav
          aria-label="breadcrumb"
          className="flex flex-wrap items-center gap-2.5 text-[14px] text-ink-2 [&_a]:inline-flex [&_a]:min-h-6 [&_a]:items-center"
        >
          <Link to="/classrooms" className={`hover:text-accent-ink ${FOCUS}`}>
            ห้องเรียนของฉัน
          </Link>
          <span aria-hidden="true">›</span>
          <Link to={`/classrooms/${classroomId}`} className={`hover:text-accent-ink ${FOCUS}`}>
            {room?.name || 'ห้องเรียน'}
          </Link>
          <span aria-hidden="true">›</span>
          <Link
            to={`/classrooms/${classroomId}/assignments/${assignmentId}`}
            className={`hover:text-accent-ink ${FOCUS}`}
          >
            {item?.name}
          </Link>
        </nav>
        <div className="relative mt-6 mb-6 flex min-h-41 items-center gap-4">
          <BackChevron
            to={`/classrooms/${classroomId}/assignments/${assignmentId}`}
            label="กลับหน้างานประเมิน"
            inline
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[32px] font-bold max-sm:text-2xl">{TITLES[view]}</h1>
            <p className="mt-2 text-[15px] text-ink-2">{subtitle}</p>
          </div>
          <img
            src={view === 'appeals' ? appealsHeading : scoreHeading}
            alt=""
            width={view === 'appeals' ? 156 : 220}
            height={165}
            className="hidden h-auto shrink-0 sm:block sm:w-40 lg:w-auto"
          />
        </div>
        {error && (
          <Banner tone="err" role="alert" data-testid="scoring-error" className="mb-5">
            {error}
          </Banner>
        )}
        {notice && (
          <Banner tone="ok" role="status" data-testid="scoring-notice" className="mb-5">
            {notice}
          </Banner>
        )}
        <ReportTabs classroomId={classroomId} assignmentId={assignmentId} active={view} showAppeals={finalized} />
        {view === 'appeals' ? (
          finalized ? (
            <AppealsPanel
              classroomId={classroomId}
              assignmentId={assignmentId}
              readOnly={!writable}
              until={appealUntil}
            />
          ) : (
            <p className="text-sm text-muted">นักศึกษายื่นคำร้องได้หลังประกาศผลคะแนนแล้วเท่านั้น</p>
          )
        ) : !scores ? (
          !error && (
            <p role="status" className="text-sm text-muted">
              กำลังโหลดรายงาน…
            </p>
          )
        ) : (
          <>
            <ScoresTable key={side} scores={scores} side={side} />
            {/* Figma J25 — ปุ่มใต้ตาราง: คำนวณ · แก้คะแนน · ส่งออก · ประกาศผล */}
            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              {writable && canFinalize && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void recompute()}
                  className={btn('ghost', 'md', 'border-brand-600 px-5 text-accent-ink')}
                >
                  {busy && <Spinner className="size-3.5" />}
                  คำนวณคะแนนชั่วคราว
                </button>
              )}
              {writable && rows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOverriding(true)}
                  className={btn('ghost', 'md', 'border-brand-600 px-5 text-accent-ink')}
                >
                  แก้คะแนนด้วยมือ
                </button>
              )}
              <Link
                to={`/classrooms/${classroomId}/assignments/${assignmentId}/export`}
                className={btn('ghost', 'md', 'border-brand-600 px-5 text-accent-ink')}
              >
                ส่งออก
              </Link>
              {writable && canFinalize && (
                <button
                  type="button"
                  disabled={!deadlinePassed}
                  title={deadlinePassed ? undefined : 'ยังไม่ถึงกำหนดส่ง — ประกาศผลได้หลัง deadline ผ่านแล้ว'}
                  onClick={() => setFinalizing(true)}
                  className={btn('primary', 'md', 'px-5')}
                >
                  ประกาศผลคะแนน
                </button>
              )}
              {writable && finalized && (
                <button
                  type="button"
                  onClick={() => setReopening(true)}
                  className={btn('ghost', 'md', 'border-brand-600 px-5 text-err')}
                >
                  เปิดผลใหม่
                </button>
              )}
            </div>
          </>
        )}
      </main>
      {overriding && scores && rows[0] && (
        <OverrideScoreDialog
          assignmentId={assignmentId}
          scores={scores}
          initial={rows[0]}
          onClose={() => setOverriding(false)}
          onSave={async (input) => {
            await createScoreOverride(assignmentId, input)
            setScores(await getScores(assignmentId))
          }}
        />
      )}
      {finalizing && item && (
        <FinalizeDialog
          name={item.name}
          assignmentId={assignmentId}
          studentCount={item.studentCount ?? null}
          onClose={() => setFinalizing(false)}
          onConfirm={finalize}
        />
      )}
      {reopening && item && (
        <ReopenDialog
          name={item.name}
          finalizedLabel={item.finalizedAt ? thaiDate(item.finalizedAt, { timeZone: timezone }) : null}
          onClose={() => setReopening(false)}
          onConfirm={reopen}
        />
      )}
    </div>
  )
}
