import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import closedIllustration from '../assets/figma/closed.png'
import assignmentIllustration from '../assets/figma/create-assignment.png'
import { AppNav } from '../components/AppNav'
import { AppealsPanel } from '../components/AppealsPanel'
import { AssignmentActions } from '../components/AssignmentActions'
import { BackChevron } from '../components/PageChrome'
import { btn, FOCUS } from '../components/Ui'
import {
  ApiError,
  type Appeal,
  type AssignmentSummary,
  type Classroom,
  listAppeals,
  listClassroomAssignments,
  listClassrooms,
} from '../lib/api'
import { formatDeadline, thaiDate } from '../lib/datetime'


function Tile({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-edge bg-white px-4 py-5 text-center">
      <p className="font-display text-[14.5px] font-semibold">{label}</p>
      <p className="mt-1.5 font-display text-[30px] leading-tight font-bold">{value}</p>
      <p className="mt-1.5 text-[14px] text-ink-2">{hint}</p>
    </div>
  )
}

/** หน้างานประเมินของผู้สอน — Figma J23 (เปิดรับ) · J24 (ปิดรับ) · J31b (ประกาศผลแล้ว) */
export default function AssignmentOverviewPage() {
  const { classroomId = '', assignmentId = '' } = useParams()
  const [item, setItem] = useState<AssignmentSummary | null>(null)
  const [room, setRoom] = useState<Classroom | null>(null)
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const refresh = useCallback(async () => {
    try {
      const [list, rooms, requests] = await Promise.all([
        listClassroomAssignments(classroomId),
        listClassrooms(),
        listAppeals(classroomId).catch(() => ({ items: [] as Appeal[] })),
      ])
      setItem(list.items.find((entry) => entry.id === assignmentId) ?? null)
      setRoom(rooms.items.find((entry) => entry.id === classroomId) ?? null)
      setAppeals(requests.items.filter((entry) => entry.assignmentId === assignmentId))
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดงานประเมินไม่สำเร็จ')
    }
  }, [classroomId, assignmentId])

  useEffect(() => {
    void refresh()
  }, [refresh])
  const { hash } = useLocation()
  useEffect(() => {
    if (hash && item) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash, item])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const timezone = room?.timezone ?? 'Asia/Bangkok'
  const base = `/classrooms/${classroomId}`
  const total = item?.studentCount ?? room?.studentCount ?? 0
  const submitted = item?.submittedStudents ?? 0
  const deadline = item ? Date.parse(item.groupDeadlineUtc) : 0
  const finalized = item?.status === 'FINALIZED'
  const closed = Boolean(item && !finalized && deadline <= now)
  const draft = item?.status === 'DRAFT'
  const openAppeals = appeals.filter((entry) => entry.status === 'OPEN').length
  const left = Math.max(0, deadline - now)
  const deadlineText = item ? formatDeadline(item.groupDeadlineUtc, timezone) : ''

  const status = finalized ? 'ประกาศผลแล้ว' : closed ? 'ปิดรับแล้ว' : draft ? 'ฉบับร่าง' : 'เปิดให้ประเมิน'

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <AppNav context={item?.name ?? 'งานประเมิน'} classroomId={classroomId} />
      <main className="mx-auto max-w-290 pt-8 pb-16 max-xl:px-7 max-sm:px-4">
        <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-2.5 text-[14px] text-ink-2">
          <Link to="/classrooms" className={`hover:text-accent-ink ${FOCUS}`}>
            ห้องเรียนของฉัน
          </Link>
          <span aria-hidden="true">›</span>
          <Link to={base} className={`hover:text-accent-ink ${FOCUS}`}>
            {room?.name ?? 'ห้องเรียน'}
          </Link>
          <span aria-hidden="true">›</span>
          <span>{item?.name}</span>
        </nav>

        {error && (
          <p role="alert" className="mt-6 text-sm text-err">
            {error}
          </p>
        )}

        {item && (
          <>
            {finalized && openAppeals > 0 ? (
              <StatusBanner
                tone="warn"
                icon="💬"
                title={`มีคำร้องอุทธรณ์รอตอบ ${openAppeals} คำร้อง`}
                body={`ประกาศผลแล้ว · ตอบแล้ว ${appeals.length - openAppeals} จาก ${appeals.length}`}
                action={
                  <Link to={`${base}/assignments/${assignmentId}#appeals`} className={btn('ghost', 'sm', 'px-6')}>
                    ดูคำร้อง
                  </Link>
                }
              />
            ) : finalized ? (
              <StatusBanner
                tone="ok"
                icon="📣"
                title="ประกาศผลคะแนนแล้ว"
                body={`นักศึกษาดูคะแนนและยื่นอุทธรณ์ได้ภายใน 7 วัน · ส่งคำตอบ ${submitted} / ${total} คน`}
                action={
                  <Link to={`${base}#scores`} className={btn('ghost', 'sm', 'px-6')}>
                    ดูคะแนนและรายงาน
                  </Link>
                }
              />
            ) : closed ? (
              <StatusBanner
                tone="info"
                icon="🔒"
                title={`ปิดรับคำตอบแล้ว · ${deadlineText}`}
                body={`ส่งครบ ${submitted} / ${total} คน · ตรวจรายงานก่อนประกาศผล · รายการที่ข้อมูลไม่พอให้ผู้สอนตรวจหรือแก้คะแนนก่อน`}
                action={
                  <Link to={`${base}#scores`} className={btn('ghost', 'sm', 'px-6')}>
                    ดูคะแนนและรายงาน
                  </Link>
                }
              />
            ) : !draft ? (
              <StatusBanner
                tone="info"
                icon="⏳"
                title={`เปิดให้ประเมินอยู่ · ปิดรับ ${deadlineText}`}
                body={`เหลืออีก ${Math.floor(left / 86400000)} วัน ${Math.floor(left / 3600000) % 24} ชม. · ส่งแจ้งเตือนคนที่ยังส่งไม่ครบแล้วเมื่อ 48 ชม. ก่อนปิด`}
              />
            ) : null}

            <div className="relative mt-6 flex min-h-41 items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <BackChevron to={base} label="กลับหน้าห้องเรียน" />
                <div>
                  <h1 className="font-display text-[32px] font-bold max-sm:text-2xl">{item.name}</h1>
                  <p className="mt-2 text-[15px] text-ink-2">
                    {[
                      room?.name,
                      status,
                      closed
                        ? `กำหนดส่ง ${deadlineText}`
                        : item.publishedAt
                          ? `${finalized ? 'ประกาศผลแล้ว' : 'เผยแพร่'} ${thaiDate(item.publishedAt)}`
                          : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
              <img
                src={closed ? closedIllustration : assignmentIllustration}
                alt=""
                aria-hidden="true"
                className="h-36 w-auto object-contain max-sm:hidden"
              />
            </div>

            <div className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <Tile
                label="นักศึกษา"
                value={total}
                hint={
                  finalized
                    ? 'ประกาศคะแนนแล้วทุกคน'
                    : `${room?.groupCount ?? 0} กลุ่ม${closed && total > submitted ? ` · ${total - submitted} คนส่งไม่ครบ` : ''}`
                }
              />
              <Tile label="ส่งคำตอบแล้ว" value={submitted} hint={`จากทั้งหมด ${total} คน`} />
              {finalized ? (
                <Tile
                  label="คำร้องอุทธรณ์"
                  value={appeals.length}
                  hint={`ตอบแล้ว ${appeals.length - openAppeals} คำร้อง`}
                />
              ) : (
                <Tile
                  label={closed ? 'ยังไม่ส่ง' : 'ยังส่งไม่ครบ'}
                  value={Math.max(0, total - submitted)}
                  hint={closed ? 'ตัวคูณ M ลดตามสัดส่วน' : 'ดูรายชื่อได้ในรายงาน'}
                />
              )}
              <Tile
                label="ต้องตรวจ"
                value={finalized ? openAppeals : closed ? '—' : '–'}
                hint={finalized ? 'คำร้องอุทธรณ์รอตอบ' : closed ? 'ดูในรายงานคุณภาพ' : 'ดูได้หลังปิดรับ'}
              />
            </div>

            <section className="mt-6 rounded-3xl border border-edge bg-white px-6 py-6 shadow-[0_8px_30px_-24px_rgba(101,73,63,0.24)]">
              <h2 className="font-display text-[19px] font-semibold">จัดการงานประเมินนี้</h2>
              <p className="mt-3 text-[14.5px] text-ink-2">
                {finalized
                  ? `ตอบคำร้องอุทธรณ์ ดูคะแนน หรือส่งออกข้อมูลของ${item.name}`
                  : closed
                    ? `เลือกดูคะแนน รายงาน หรือประวัติของ${item.name}`
                    : draft
                      ? 'งานยังเป็นฉบับร่าง · แก้ไขแล้วเผยแพร่เมื่อพร้อม'
                      : 'งานยังเปิดรับอยู่ · ขยายกำหนดส่ง หรือยกเลิกเผยแพร่ได้'}
              </p>
              <div className="mt-4 flex flex-wrap items-start gap-3">
                {finalized && (
                  <Link to={`${base}/assignments/${assignmentId}#appeals`} className={btn('primary', 'md', 'px-6')}>
                    ดูคำร้องอุทธรณ์{openAppeals ? ` (${openAppeals})` : ''}
                  </Link>
                )}
                {!finalized && !closed && !draft && (
                  <Link to={`${base}/assignments/${assignmentId}/quality`} className={btn('primary', 'md', 'px-6')}>
                    ติดตามการส่งรายคน
                  </Link>
                )}
                {(finalized || closed) && (
                  <Link to={`${base}#scores`} className={btn(closed ? 'primary' : 'ghost', 'md', 'px-6')}>
                    ดูคะแนนและรายงาน
                  </Link>
                )}
                {(finalized || closed) && (
                  <Link to={`${base}#scores`} className={btn('ghost', 'md', 'px-6')}>
                    ส่งออกข้อมูล
                  </Link>
                )}
                {closed && (
                  <Link to={`${base}/audit`} className={btn('ghost', 'md', 'px-6')}>
                    ดูประวัติการดำเนินการ
                  </Link>
                )}
                {!finalized && (
                  <AssignmentActions
                    item={item}
                    classroomId={classroomId}
                    timezone={timezone}
                    onChanged={() => void refresh()}
                    inline
                    showCopy={draft}
                  />
                )}
                {!finalized && !closed && !draft && (
                  <Link to={`${base}#members`} className={btn('ghost', 'md', 'px-6')}>
                    จัดการถอนรายวิชา
                  </Link>
                )}
                {finalized && (
                  <Link to={`${base}#scores`} className={btn('ghost', 'md', 'px-6 text-err')}>
                    เปิดผลใหม่
                  </Link>
                )}
              </div>
            </section>

            {finalized && (
              <div id="appeals" className="mt-6 scroll-mt-24">
                <AppealsPanel
                  classroomId={classroomId}
                  assignmentId={assignmentId}
                  readOnly={room?.status === 'ARCHIVED'}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function StatusBanner({
  tone,
  icon,
  title,
  body,
  action,
}: {
  tone: 'info' | 'warn' | 'ok'
  icon: string
  title: string
  body: string
  action?: ReactNode
}) {
  const style =
    tone === 'warn'
      ? 'bg-caution-soft text-warn'
      : tone === 'ok'
        ? 'bg-ok-banner text-ok-700'
        : 'bg-info-soft text-info-ink'
  return (
    <div role="status" className={`mt-6 flex flex-wrap items-center gap-5 rounded-3xl px-6 py-5 ${style}`}>
      <span aria-hidden="true" className="text-xl">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[19px] font-semibold">{title}</p>
        <p className="mt-1 text-[14px] text-ink-2">{body}</p>
      </div>
      {action}
    </div>
  )
}
