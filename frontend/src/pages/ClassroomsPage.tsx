import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import classroomIllustration from '../assets/enhanced/classroom.webp'
import { AppNav } from '../components/AppNav'
import { ClassroomCreateForm } from '../components/ClassroomCreateForm'
import { ClassroomActions } from '../components/ClassroomActions'
import { Dropdown, type DropdownOption } from '../components/Dropdown'
import { Banner, CTRL, FOCUS, Pill, btn } from '../components/Ui'
import {
  IconClock,
  IconHistory,
  IconSearch,
  IconSortAZ,
  IconUsers,
} from '../components/icons'
import {
  ApiError,
  type Classroom,
  type Me,
  getMe,
  listClassrooms,
} from '../lib/api'

type SortOrder = 'recent' | 'name'

const SORT_OPTIONS: DropdownOption<SortOrder>[] = [
  {
    value: 'recent',
    label: 'อัปเดตล่าสุด',
    description: 'ห้องที่มีความเคลื่อนไหวล่าสุดอยู่ก่อน',
    icon: <IconHistory className="size-4" />,
  },
  {
    value: 'name',
    label: 'ชื่อ ก-ฮ',
    description: 'เรียงชื่อตามลำดับตัวอักษร',
    icon: <IconSortAZ className="size-4" />,
  },
]

/** สถานะห้องเรียนตาม PRD §11 (`ACTIVE|ARCHIVED`) — คนละชุดกับสถานะสมาชิกใน Ui.tsx */
function ClassroomStatusPill({ status }: { status: string }) {
  if (status === 'ARCHIVED') return <Pill>เก็บถาวร</Pill>
  return null
}

const CLASSROOM_ROLE_STYLE: Record<string, { label: string; className: string }> = {
  OWNER: { label: 'เจ้าของห้อง', className: 'bg-accent-soft text-accent-ink' },
  CO_TEACHER: { label: 'ผู้สอนร่วม', className: 'bg-[#e3ecff] text-[#3157a8]' },
  TA: { label: 'ผู้ช่วยสอน', className: 'bg-[#f1e8ff] text-[#7041a6]' },
  STUDENT: { label: 'นักศึกษา', className: 'bg-ok-50 text-ok-700' },
}

function ClassroomRolePill({ role }: { role?: string }) {
  const style = role ? CLASSROOM_ROLE_STYLE[role] : undefined
  if (!style) return null


  return (
    <span className={`inline-flex min-h-9 items-center justify-center rounded-full px-5 text-xs font-semibold ${style.className}`}>
      {style.label}
    </span>
  )
}

export default function ClassroomsPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [items, setItems] = useState<Classroom[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOrder>('recent')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [semester, setSemester] = useState('ALL')
  const createDialog = useRef<HTMLDialogElement>(null)
  const roleByRoom = useMemo(() => new Map(me?.classrooms.map((room) => [room.classroomId, room.role])), [me])
  const statusItems = items.filter((room) => room.status === statusFilter)
  const studentOnly = Boolean(me?.classrooms.length && me.classrooms.every((room) => room.role === 'STUDENT'))
  const semesters = [...new Set(items.map((room) => room.semester).filter((value): value is string => Boolean(value)))]

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

  async function handleCreated() {
    createDialog.current?.close()
    await refresh()
  }

  // ค้นหา + เรียงลำดับทำฝั่ง client เพราะจำนวนห้องเรียนต่ออาจารย์เล็กมาก
  // (ไม่คุ้มเพิ่ม query param ให้ backend สำหรับ list ที่ไม่เกินไม่กี่สิบแถว)
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = items.filter((room) => (
      room.status === statusFilter
      && (roleFilter === 'ALL' || roleByRoom.get(room.id) === roleFilter)
      && (semester === 'ALL' || room.semester === semester)
      && (!q || [room.name, room.slug, room.courseCode, room.instructorName].some((value) => value?.toLowerCase().includes(q)))
    ))
    return sort === 'name'
      ? [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'th'))
      : filtered
  }, [items, search, sort, roleFilter, statusFilter, roleByRoom, semester])

  const classroomTools = <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge pb-5">
    <div role="group" aria-label="สถานะห้องเรียน" className="flex flex-wrap gap-5">
      {[{ value: 'ACTIVE', label: 'ใช้งานอยู่' }, { value: 'ARCHIVED', label: 'เก็บถาวร' }].map(({ value, label }) => <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)} className={`min-h-11 border-b-2 px-1 text-sm font-semibold ${FOCUS} ${statusFilter === value ? 'border-brand-600 text-accent-ink' : 'border-transparent text-muted hover:text-ink'}`}>{label} · {items.filter((room) => room.status === value).length}</button>)}
    </div>
    <button type="button" aria-label="เปิดหน้าต่างสร้างห้องเรียน" onClick={() => createDialog.current?.showModal()} className={btn('primary', 'md')}>+ สร้างห้องเรียน</button>
  </div>

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <AppNav context="ห้องเรียนของฉัน" profile={me} />

      <main className="mx-auto max-w-304 px-7 pt-8 pb-20 max-sm:px-4 max-sm:pt-5">
        <div className={`relative isolate flex items-center rounded-3xl bg-[linear-gradient(110deg,#ff7d3d_0%,#ffb558_100%)] ${studentOnly ? 'mb-3 min-h-29 px-4 py-4 sm:mb-7 sm:min-h-37 sm:px-12 sm:py-6' : 'mb-7 min-h-37 px-12 py-6 max-sm:px-5'}`}>
          <div className="relative z-10 max-w-[70%] max-sm:max-w-[70%]">
            <h1 className="font-display text-[32px] leading-tight font-bold text-white max-sm:text-xl">
              ห้องเรียนของฉัน
            </h1>
            <p className="mt-2 max-w-[54ch] text-[14px] leading-6 text-white max-sm:max-w-[24ch]">
              {studentOnly ? 'งานที่ต้องประเมินจะขึ้นที่นี่เมื่ออาจารย์เปิดให้ประเมิน' : 'ทุกห้องที่คุณอยู่ พร้อมบทบาทของแต่ละห้อง'}
            </p>
          </div>
          <img
            src={classroomIllustration}
            alt=""
            width={640}
            height={480}
            className="pointer-events-none absolute -top-9 right-1 -z-10 h-52 w-72 object-contain max-sm:top-auto max-sm:right-2 max-sm:h-24 max-sm:w-28"
          />
        </div>

        {!studentOnly && <div className="mb-6">{classroomTools}</div>}

          <dialog ref={createDialog} aria-labelledby="h-create-classroom" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto rounded-3xl border border-edge bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40">
            <ClassroomCreateForm disabled={false} onCreated={handleCreated} onCancel={() => createDialog.current?.close()} />
          </dialog>

        {error && <Banner tone="err" data-testid="error-msg" role="alert" className="mb-6">{error}</Banner>}

        <section className="min-w-0" aria-labelledby="h-classrooms">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <IconSearch className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-brand-600" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={studentOnly ? 'ค้นหาห้องเรียนของฉัน' : 'ค้นหาห้องเรียน'}
                aria-label="ค้นหาห้องเรียน"
                className={`${CTRL.replace('rounded-xl', 'rounded-full')} min-h-12.5 pl-13`}
              />
            </div>
            {!studentOnly && <Dropdown
              value={sort}
              options={SORT_OPTIONS}
              onChange={setSort}
              ariaLabel="เรียงลำดับ"
              className="shrink-0 sm:w-52"
            />}
          </div>

          {!studentOnly && <div role="group" aria-label="กรองตามบทบาท" className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs text-muted">บทบาท</span>
            {[{ value: 'ALL', label: 'ทั้งหมด' }, ...Object.entries(CLASSROOM_ROLE_STYLE).map(([value, style]) => ({ value, label: style.label }))].map(({ value, label }) => (
              <button key={value} type="button" aria-pressed={roleFilter === value} onClick={() => setRoleFilter(value)} className={`min-h-11 rounded-full border px-4 text-xs font-semibold transition-colors ${FOCUS} ${roleFilter === value ? 'border-accent-line bg-accent-soft text-accent-ink' : 'border-edge bg-white text-ink-2 hover:border-accent-line'}`}>
                {label} · {value === 'ALL' ? statusItems.length : statusItems.filter((room) => roleByRoom.get(room.id) === value).length}
              </button>
            ))}
            {semesters.length > 0 && <label className="ml-auto text-xs text-muted">ภาคเรียน <select aria-label="กรองภาคเรียน" value={semester} onChange={(event) => setSemester(event.target.value)} className="min-h-11 rounded-full border border-edge bg-white px-4 text-ink"><option value="ALL">ทุกภาคเรียน</option>{semesters.map((value) => <option key={value}>{value}</option>)}</select></label>}
          </div>}

          <h2 id="h-classrooms" className={studentOnly ? 'sr-only' : 'mt-6 flex items-center gap-2 font-display text-lg font-semibold'}><IconUsers className="size-4 text-brand-600" />ห้องเรียน {visibleItems.length} ห้อง</h2>

          <div className={studentOnly ? 'mt-3' : 'mt-6'}>
            {loaded && items.length === 0 ? (
              <p data-testid="empty-state" className="py-10 text-center text-sm text-muted">
                ยังไม่มีห้องเรียน
              </p>
            ) : visibleItems.length === 0 ? (
              <p data-testid="filtered-empty" className="py-10 text-center text-sm text-muted">ไม่พบห้องเรียนตามตัวกรองที่เลือก</p>
            ) : (
              <ul data-testid="classroom-list" className="flex flex-col gap-4">
                {visibleItems.map((c) => (
                  <li key={c.id}>
                    <div className={`flex flex-wrap items-center gap-x-6 gap-y-4 border border-edge bg-white transition-colors hover:border-edge-strong ${studentOnly ? 'rounded-2xl p-4' : 'rounded-3xl px-6 py-5 shadow-[0_6px_20px_rgba(50,16,7,0.045)] max-sm:px-4'}`}>
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-[17px] font-semibold wrap-break-word">{c.name}</p>
                          <p className="mt-1 text-[13px] text-ink-2">{[c.courseCode ?? (studentOnly ? null : c.slug), c.groupName ? `กลุ่ม ${c.groupName}` : null, c.instructorName, !studentOnly ? `${c.studentCount ?? 0} คน · ${c.groupCount ?? 0} กลุ่ม` : null].filter(Boolean).join(' · ')}</p>
                          {!studentOnly && <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
                            <IconClock className="size-3.5 shrink-0" />
                            {c.assignmentCount ? `งานประเมิน ${c.assignmentCount} งาน` : `เขตเวลา ${c.timezone}`}
                          </p>}
                          {studentOnly && (c.pendingAssignmentCount ?? 0) > 0 && <Pill tone="warn" className="mt-3 px-3 py-2">ยังไม่ได้ประเมิน {c.pendingAssignmentCount} งาน</Pill>}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 max-sm:w-full max-sm:justify-between">
                        {!studentOnly && <><ClassroomStatusPill status={c.status} /><ClassroomRolePill role={roleByRoom.get(c.id)} /></>}
                        <Link to={`/classrooms/${c.id}`} className={btn('primary', studentOnly ? 'md' : 'sm', studentOnly ? 'max-sm:w-full' : '')}>
                          {studentOnly ? 'ดูงานประเมิน' : 'เปิดห้องเรียน'}
                        </Link>
                        {roleByRoom.get(c.id) === 'OWNER' && <ClassroomActions room={c} onChanged={refresh} />}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        {studentOnly && <details className="mt-6"><summary className="cursor-pointer text-sm text-muted">ตัวกรองและเครื่องมือห้องเรียน</summary><div className="mt-4">{classroomTools}</div></details>}
      </main>
    </div>
  )
}
