import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import classroomIllustration from '../assets/enhanced/classroom.webp'
import createClassroomIllustration from '../assets/figma/create-classroom.png'
import { AppNav } from '../components/AppNav'
import { ClassroomCreateForm } from '../components/ClassroomCreateForm'
import { ClassroomActions } from '../components/ClassroomActions'
import { OrangeHero } from '../components/PageChrome'
import { Banner, CTRL, FOCUS, btn } from '../components/Ui'
import { IconSearch } from '../components/icons'
import { ApiError, type Classroom, type Me, getMe, listClassrooms } from '../lib/api'
import { thaiDate } from '../lib/datetime'

const ROLE_STYLE: Record<string, { label: string; chip: string; dot: string; pill: string }> = {
  OWNER: { label: 'เจ้าของห้อง', chip: 'เจ้าของห้อง', dot: 'bg-brand-600', pill: 'bg-peach text-accent-ink' },
  CO_TEACHER: { label: 'ผู้สอนร่วม', chip: 'ผู้สอนร่วม', dot: 'bg-[#3157a8]', pill: 'bg-[#e3ecff] text-[#3157a8]' },
  TA: { label: 'TA', chip: 'TA', dot: 'bg-role-ta', pill: 'bg-role-ta-soft text-role-ta' },
  STUDENT: { label: 'นักศึกษา', chip: 'นักศึกษา', dot: 'bg-ok-600', pill: 'bg-ok-50 text-ok-700' },
}



/** รหัสนักศึกษา KMITL เป็นตัวเลขล้วน — ใช้เดาว่าผู้ใช้ที่ยังไม่มีห้องเป็นนักศึกษา (Figma ST11)
 *  หรือผู้สอนที่ยังไม่ได้สร้างห้อง (Figma J02) เพราะระบบไม่มี role ระดับบัญชี */
function looksLikeStudent(email: string | undefined): boolean {
  return /^\d+@/.test(email ?? '')
}

export default function ClassroomsPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [items, setItems] = useState<Classroom[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const [semester, setSemester] = useState('ALL')
  const [created, setCreated] = useState<Classroom | null>(null)
  const createDialog = useRef<HTMLDialogElement>(null)
  const roleByRoom = useMemo(() => new Map(me?.classrooms.map((room) => [room.classroomId, room.role])), [me])
  const studentOnly = Boolean(me?.classrooms.length && me.classrooms.every((room) => room.role === 'STUDENT'))
  // Figma C03 / T03 — ผู้สอนร่วมหรือ TA ที่ไม่ได้เป็นเจ้าของห้องไหน เห็นรายการแบบเรียบ ไม่มีแท็บ ตัวกรองบทบาท หรือปุ่มสร้างห้อง
  const staffOnly = Boolean(
    me?.classrooms.length && me.classrooms.every((room) => room.role === 'CO_TEACHER' || room.role === 'TA'),
  )
  const staffLabel = me?.classrooms.every((room) => room.role === 'TA')
    ? 'ผู้ช่วยสอน (TA)'
    : me?.classrooms.every((room) => room.role === 'CO_TEACHER')
      ? 'ผู้สอนร่วม'
      : 'ทีมผู้สอน'
  const semesters = [...new Set(items.map((room) => room.semester).filter((value): value is string => Boolean(value)))]
  const currentSemester = items.find((room) => room.status === 'ACTIVE' && room.semester)?.semester

  const refresh = useCallback(async () => {
    try {
      const [profile, { items: classroomItems }] = await Promise.all([getMe(), listClassrooms()])
      setMe(profile)
      setItems(classroomItems)
    } catch (err) {
      // apiFetch ล้าง session และ RequireSession พากลับหน้าแรกเมื่อได้ 401
      if (!(err instanceof ApiError && err.status === 401)) {
        setError(err instanceof ApiError ? err.message : 'โหลดรายการห้องเรียนไม่สำเร็จ')
      }
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleCreated(room: Classroom) {
    createDialog.current?.close()
    setCreated(room)
    setStatusFilter('ACTIVE')
    await refresh()
  }

  const statusItems = items.filter((room) => room.status === statusFilter)
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(
      (room) =>
        (studentOnly || room.status === statusFilter) &&
        (roleFilter === 'ALL' || roleByRoom.get(room.id) === roleFilter) &&
        (semester === 'ALL' || room.semester === semester) &&
        (!q || [room.name, room.courseCode, room.instructorName].some((value) => value?.toLowerCase().includes(q))),
    )
  }, [items, search, roleFilter, statusFilter, roleByRoom, semester, studentOnly])

  const noRooms = loaded && items.length === 0
  const studentEmpty = noRooms && looksLikeStudent(me?.email)
  const archivedTab = !studentOnly && statusFilter === 'ARCHIVED'

  const subtitle =
    studentOnly || studentEmpty
      ? 'งานที่ต้องประเมินจะขึ้นที่นี่เมื่ออาจารย์เปิดให้ประเมิน'
      : noRooms
        ? 'ยังไม่มีห้องเรียนที่คุณเป็นผู้สอน'
        : staffOnly
          ? `ห้องที่คุณเป็น${staffLabel}${currentSemester ? ` · ภาคเรียน ${currentSemester}` : ''}`
          : `ทุกห้องที่คุณอยู่ พร้อมบทบาทของแต่ละห้อง${currentSemester ? ` · ภาคเรียน ${currentSemester}` : ''}`

  const searchBox = (
    <div className="relative">
      <IconSearch className="pointer-events-none absolute top-1/2 left-6 size-8 -translate-y-1/2 text-brand-600 max-sm:left-4 max-sm:size-4.5" />
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={
          archivedTab
            ? 'ค้นหาในห้องที่ archive แล้ว'
            : studentOnly || noRooms
              ? 'ค้นหาห้องเรียนของฉัน'
              : 'ค้นหาชื่อห้อง รหัสวิชา หรือชื่ออาจารย์'
        }
        aria-label="ค้นหาห้องเรียน"
        className={`${CTRL.replace('rounded-xl', 'rounded-full')} min-h-15 pl-20 text-[15px] max-sm:min-h-12 max-sm:pl-10.5 max-sm:text-[14px]`}
      />
    </div>
  )

  const createButton = (
    <button
      type="button"
      aria-label="เปิดหน้าต่างสร้างห้องเรียน"
      onClick={() => createDialog.current?.showModal()}
      className={btn('primary', 'md', 'min-h-12 px-6 text-[15px]')}
    >
      + สร้างห้องเรียน
    </button>
  )

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <AppNav context="ห้องเรียนของฉัน" profile={me} />

      {/* Figma ST10 (นักศึกษา) กับ J04b (ผู้สอน) วางหัวหน้าต่างกัน — ยึดเฟรมของแต่ละบทบาท */}
      <main
        className={`mx-auto max-w-290 pb-20 max-xl:px-7 max-sm:px-4 max-sm:pt-5 ${studentOnly || !me ? 'pt-12.5' : 'pt-8'}`}
      >
        <OrangeHero
          title="ห้องเรียนของฉัน"
          subtitle={subtitle}
          image={classroomIllustration}
          imageClassName={
            studentOnly || !me ? '-top-[63px] right-[14px] h-[256px] w-[341px]' : '-top-[72px] right-0 h-[273px] w-[364px]'
          }
        />

        <dialog
          ref={createDialog}
          aria-labelledby="h-create-classroom"
          className="fixed inset-0 m-auto max-h-[94dvh] w-[calc(100vw-2rem)] max-w-150 overflow-y-auto rounded-3xl bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40"
        >
          <ClassroomCreateForm
            disabled={false}
            onCreated={handleCreated}
            onCancel={() => createDialog.current?.close()}
          />
        </dialog>

        {error && (
          <Banner tone="err" data-testid="error-msg" role="alert" className="mt-6">
            {error}
          </Banner>
        )}

        {/* --- นักศึกษา (ST10) และผู้ที่ยังไม่มีห้อง (ST11 / J02) --- */}
        {(studentOnly || noRooms) && (
          <section aria-labelledby="h-classrooms" className="mt-6 max-sm:mt-3.5">
            <h2 id="h-classrooms" className="sr-only">
              ห้องเรียน
            </h2>
            {searchBox}
            {studentEmpty ? (
              <div data-testid="empty-state" className="mt-6 text-center">
                <img
                  src={createClassroomIllustration}
                  alt=""
                  width={504}
                  height={255}
                  className="mx-auto h-auto w-126 max-w-full"
                />
                <p className="mt-6 font-display text-[19px] font-semibold">ยังไม่มีห้องเรียนของคุณ</p>
                <p className="mt-4 text-[15px] leading-6 text-ink-2">
                  คุณเข้าสู่ระบบด้วย {me?.email}
                  <br />
                  ห้องเรียนจะแสดงที่นี่เมื่ออาจารย์หรือ TA เพิ่มอีเมลนี้เข้ารายชื่อห้อง
                </p>
              </div>
            ) : noRooms ? (
              <div
                data-testid="empty-state"
                className="mt-6 flex flex-wrap items-center gap-4 rounded-3xl border border-edge bg-white px-5 py-4 shadow-[0_6px_20px_rgba(50,16,7,0.045)]"
              >
                <div className="min-w-0 flex-1 text-[14.5px] leading-6">
                  <p className="text-[17px]">ยังไม่มีห้องเรียน</p>
                  <p className="mt-1">สร้างห้องเรียนแรก แล้วนำเข้ารายชื่อนักศึกษาจาก CSV</p>
                  <p>ถ้าเป็นผู้สอนร่วมในห้องอื่น ห้องนั้นจะแสดงที่นี่เมื่อเจ้าของห้องเพิ่มคุณ</p>
                </div>
                <button
                  type="button"
                  aria-label="เปิดหน้าต่างสร้างห้องเรียน"
                  onClick={() => createDialog.current?.showModal()}
                  className={btn('ghost', 'md', 'min-h-11 border-brand-600 px-6 text-accent-ink')}
                >
                  + สร้างห้องเรียน
                </button>
              </div>
            ) : visibleItems.length === 0 ? (
              <p data-testid="filtered-empty" className="py-10 text-center text-sm text-muted">
                ไม่พบห้องเรียนที่ค้นหา
              </p>
            ) : (
              <ul data-testid="classroom-list" className="mt-6 flex flex-col gap-6 max-sm:mt-3.5 max-sm:gap-3.5">
                {visibleItems.map((c) => (
                  <li key={c.id}>
                    <div className="flex min-h-22.5 flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl border border-edge bg-white px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[17px] font-semibold wrap-break-word">{c.name}</p>
                        <p className="mt-1 text-[13px] text-ink-2">
                          {[c.groupName ? `กลุ่ม ${c.groupName}` : null, c.instructorName].filter(Boolean).join(' · ')}
                        </p>
                        {(c.pendingAssignmentCount ?? 0) > 0 && (
                          <span className="mt-3 inline-flex min-h-9 items-center rounded-full bg-[#fbf0d9] px-3.5 font-display text-[13px] font-semibold text-[#7a5200] sm:hidden">
                            ยังไม่ได้ประเมิน {c.pendingAssignmentCount} งาน
                          </span>
                        )}
                      </div>
                      {(c.pendingAssignmentCount ?? 0) > 0 && (
                        <span className="rounded-full bg-peach px-3.5 py-0.5 text-[11.5px] text-accent-ink max-sm:hidden">
                          ยังไม่ได้ประเมิน {c.pendingAssignmentCount} งาน
                        </span>
                      )}
                      <Link
                        to={`/classrooms/${c.id}`}
                        className={btn(
                          'primary',
                          'sm',
                          'min-h-9.5 px-4.5 max-sm:min-h-12 max-sm:w-full max-sm:text-[15px]',
                        )}
                      >
                        ดูงานประเมิน
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* --- ผู้สอน / หลายบทบาท (J04 · J04b · J04c) --- */}
        {!studentOnly && !noRooms && loaded && (
          <section aria-labelledby="h-classrooms" className="mt-6">
            {!staffOnly && (
              <div role="group" aria-label="สถานะห้องเรียน" className="flex gap-1 border-b border-edge">
                {(
                  [
                    ['ACTIVE', 'ใช้งานอยู่'],
                    ['ARCHIVED', 'Archive'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={statusFilter === value}
                    onClick={() => setStatusFilter(value)}
                    className={`-mb-px min-h-12 border-b-2 px-4.5 pb-2 text-[16px] ${FOCUS} ${statusFilter === value ? 'border-brand-600 font-semibold text-accent-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}
                  >
                    {label} · {items.filter((room) => room.status === value).length}
                  </button>
                ))}
              </div>
            )}

            {created && statusFilter === 'ACTIVE' && (
              <div role="status" className="mt-6 flex items-start gap-5 rounded-3xl bg-ok-banner px-6 py-5 text-ok-700">
                <span aria-hidden="true" className="mt-1 font-display text-xl font-bold">
                  √
                </span>
                <div>
                  <p className="font-display text-[17px] font-semibold">สร้างห้องเรียนแล้ว</p>
                  <p className="mt-1 text-[13.5px] text-ink-2">
                    {created.name} · คุณเป็นเจ้าของห้อง · ขั้นต่อไป: นำเข้ารายชื่อนักศึกษา
                  </p>
                </div>
              </div>
            )}

            <div className={staffOnly ? '' : 'mt-6'}>{searchBox}</div>

            {staffOnly ? null : archivedTab ? (
              <div className="mt-6 flex items-center gap-4 rounded-3xl bg-neutral-soft px-6 py-5">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 text-ink-2">
                  <path fill="currentColor" d="M5 3h14v18H5zm2 2v5h10V5zm0 7v7h10v-7zm3-5h4v1.5h-4zm0 7h4v1.5h-4z" />
                </svg>
                <div>
                  <p className="font-display text-[17px] font-semibold">ห้องที่ archive แล้ว · อ่านอย่างเดียว</p>
                  <p className="mt-1 text-[13.5px] text-ink-2">
                    ไม่แสดงในรายการหลัก ดูรายงานและส่งออกได้ · เจ้าของห้องยกเลิก archive ได้จากเมนู ···
                  </p>
                </div>
              </div>
            ) : (
              <div role="group" aria-label="กรองตามบทบาท" className="mt-6 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[13px] text-muted">บทบาท</span>
                {[['ALL', 'ทั้งหมด'], ...Object.entries(ROLE_STYLE).map(([value, style]) => [value, style.chip])].map(
                  ([value, label]) => {
                    const count =
                      value === 'ALL'
                        ? statusItems.length
                        : statusItems.filter((room) => roleByRoom.get(room.id) === value).length
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={roleFilter === value}
                        onClick={() => setRoleFilter(value)}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 font-display text-[13.5px] font-semibold transition-colors ${FOCUS} ${roleFilter === value ? 'border-brand-600 bg-accent-soft text-accent-ink' : 'border-edge bg-white text-ink hover:border-accent-line'}`}
                      >
                        {value !== 'ALL' && (
                          <span aria-hidden="true" className={`size-2 rounded-full ${ROLE_STYLE[value].dot}`} />
                        )}
                        {label} {count}
                      </button>
                    )
                  },
                )}
                {semesters.length > 0 && (
                  <select
                    aria-label="กรองภาคเรียน"
                    value={semester}
                    onChange={(event) => setSemester(event.target.value)}
                    className={`ml-auto min-h-10 rounded-full border border-edge bg-white px-4 font-display text-[13.5px] font-semibold ${FOCUS}`}
                  >
                    <option value="ALL">ทุกภาคเรียน</option>
                    {semesters.map((value) => (
                      <option key={value} value={value}>
                        ภาคเรียน {value}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className={`mt-6 flex items-center justify-between gap-4 ${staffOnly ? 'sr-only' : ''}`}>
              <h2 id="h-classrooms" className="font-display text-[17px] font-semibold">
                {archivedTab ? `Archive ${visibleItems.length} ห้อง` : `ห้องเรียน ${visibleItems.length} ห้อง`}
              </h2>
              {!archivedTab && !staffOnly && createButton}
            </div>

            {visibleItems.length === 0 ? (
              <p data-testid="filtered-empty" className="py-10 text-center text-sm text-muted">
                ไม่พบห้องเรียนตามตัวกรองที่เลือก
              </p>
            ) : (
              <ul data-testid="classroom-list" className="mt-6 flex flex-col gap-6">
                {visibleItems.map((c) => {
                  const role = roleByRoom.get(c.id) ?? 'STUDENT'
                  const style = ROLE_STYLE[role] ?? ROLE_STYLE.STUDENT
                  return (
                    <li key={c.id}>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl border border-edge bg-white px-5 py-4 shadow-[0_6px_20px_rgba(50,16,7,0.045)]">
                        <div className="min-w-0 flex-1 text-[13.5px] leading-6">
                          <p className="text-[17px] wrap-break-word">{c.name}</p>
                          <p className="mt-0.5">{metaLine(c, role, me)}</p>
                          <p>{statusLine(c, role)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 max-sm:w-full max-sm:justify-between">
                          <span
                            className={`inline-flex min-h-9.5 min-w-33 items-center justify-center rounded-full px-5 font-display text-[13.5px] font-semibold ${style.pill}`}
                          >
                            {style.label}
                          </span>
                          <Link
                            to={`/classrooms/${c.id}`}
                            className={
                              staffOnly
                                ? btn('ghost', 'sm', 'min-h-9.5 border-brand-600 px-6 text-accent-ink')
                                : btn('primary', 'sm', `min-h-9.5 ${archivedTab ? 'min-w-14 px-4' : 'px-6'}`)
                            }
                          >
                            {archivedTab ? 'ดู' : role === 'STUDENT' ? 'ไปประเมิน' : 'เปิดห้องเรียน'}
                          </Link>
                          {role === 'OWNER' && <ClassroomActions room={c} onChanged={refresh} />}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

function metaLine(c: Classroom, role: string, me: Me | null): string {
  const instructor = c.instructorName ? `${c.instructorName}${role === 'OWNER' && me ? ' (คุณ)' : ''}` : null
  if (role === 'STUDENT')
    return [c.courseCode, c.instructorName, c.groupName ? `กลุ่ม ${c.groupName}` : null].filter(Boolean).join(' · ')
  return [c.courseCode, instructor, `${c.studentCount ?? 0} คน`, `${c.groupCount ?? 0} กลุ่ม`]
    .filter(Boolean)
    .join(' · ')
}

function statusLine(c: Classroom, role: string): string {
  if (c.status === 'ARCHIVED') {
    const when = c.archivedAt ? `archive เมื่อ ${thaiDate(c.archivedAt, { timeZone: c.timezone })}` : 'archive แล้ว'
    return role === 'OWNER'
      ? `${when} · ประกาศผลครบ ${c.finalizedAssignmentCount ?? 0} งาน`
      : `${when} · โดยเจ้าของห้อง`
  }
  if (role === 'STUDENT') {
    if (!c.pendingAssignmentCount) return 'ไม่มีงานที่ต้องประเมิน'
    return `⏳ ต้องประเมิน ${c.pendingAssignmentCount} งาน${c.nextDeadlineUtc ? ` · ปิด ${thaiDate(c.nextDeadlineUtc, { timeZone: c.timezone, time: true })}` : ''}`
  }
  const parts: string[] = []
  if (c.openAppealCount) parts.push(`คำร้องอุทธรณ์รอตอบ ${c.openAppealCount}`)
  if (c.openAssignmentCount)
    parts.unshift(
      `งานเปิดอยู่ ${c.openAssignmentCount} · ส่งแล้ว ${c.openSubmittedStudents ?? 0} / ${c.studentCount ?? 0} คน`,
    )
  if (parts.length) return parts.join(' · ')
  if (!c.assignmentCount)
    return `${c.timezone}${c.allowedEmailDomains.length ? ` · ${c.allowedEmailDomains.join(', ')}` : ''} · ${c.assignmentCount ?? 0} งานประเมิน`
  return 'ยังไม่มีงานที่เปิดอยู่'
}
