import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import classroomIllustration from '../assets/enhanced/classroom.webp'
import { AppNav } from '../components/AppNav'
import { BackChevron, SectionCard } from '../components/PageChrome'
import { CTRL, FOCUS, btn } from '../components/Ui'
import {
  ApiError,
  type Classroom,
  type Me,
  type MyGroupArtifact,
  type RosterEntry,
  getMe,
  getMyGroupArtifact,
  getRoster,
  listClassrooms,
} from '../lib/api'

type MemberTab = 'ALL' | 'STUDENT' | 'STAFF'

/** Figma ST15 · กลุ่มของฉัน — สมาชิกกลุ่ม ผลงานของกลุ่ม และสมาชิกทั้งห้องแบบอ่านอย่างเดียว */
export default function GroupPage() {
  const { classroomId = '' } = useParams()
  const [me, setMe] = useState<Me | null>(null)
  const [room, setRoom] = useState<Classroom | null>(null)
  const [members, setMembers] = useState<RosterEntry[]>([])
  const [artifact, setArtifact] = useState<MyGroupArtifact | null>(null)
  const [tab, setTab] = useState<MemberTab>('ALL')
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([getMe(), listClassrooms(), getRoster(classroomId), getMyGroupArtifact(classroomId)])
      .then(([profile, rooms, roster, mine]) => {
        if (!active) return
        setMe(profile)
        setRoom(rooms.items.find((item) => item.id === classroomId) ?? null)
        setMembers(roster.items)
        setArtifact(mine)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลกลุ่มไม่สำเร็จ')
      })
    return () => {
      active = false
    }
  }, [classroomId])

  const myGroup = artifact?.groupName ?? members.find((member) => member.email === me?.email)?.groupName ?? null
  const groupMembers = members.filter(
    (member) => member.role === 'STUDENT' && member.groupName === myGroup && member.enrollmentStatus !== 'WITHDRAWN',
  )
  const students = members.filter((member) => member.role === 'STUDENT')
  const withdrawn = students.filter((member) => member.enrollmentStatus === 'WITHDRAWN').length
  const staff = members.filter((member) => member.role !== 'STUDENT')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members
      .filter((member) => tab === 'ALL' || (tab === 'STUDENT' ? member.role === 'STUDENT' : member.role !== 'STUDENT'))
      .filter((member) => !q || [member.displayName, member.email].some((value) => value?.toLowerCase().includes(q)))
  }, [members, tab, query])

  const name = (member: RosterEntry) =>
    `${member.displayName ?? member.email}${member.email === me?.email ? ' (คุณ)' : ''}`
  const row = (member: RosterEntry) => (
    <li key={member.memberId} className="flex justify-between gap-4 text-[15px] leading-6">
      <span className="min-w-0 truncate text-ink-2">{name(member)}</span>
      <span className="shrink-0 text-ink">{member.email}</span>
    </li>
  )

  const tabButton = (value: MemberTab, label: string, count: number) => (
    <button
      type="button"
      aria-pressed={tab === value}
      onClick={() => setTab(value)}
      className={`min-h-10 rounded-full border px-4 font-display text-[14.5px] font-semibold ${FOCUS} ${tab === value ? 'border-brand-600 bg-accent-soft text-accent-ink' : 'border-edge bg-white text-ink'}`}
    >
      {label} {count}
    </button>
  )

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <AppNav context="สมาชิก" classroomId={classroomId} />
      <main className="mx-auto max-w-290 pt-5 pb-16 max-xl:px-7 max-sm:px-4">
        <div className="relative flex min-h-43.5 items-center gap-3">
          <BackChevron to={`/classrooms/${classroomId}`} label="กลับหน้าห้องเรียน" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[34px] leading-12 font-bold">สมาชิก</h1>
            <p className="mt-2 text-[15px] text-ink-2">
              {[myGroup ? `กลุ่ม ${myGroup}` : null, room?.name, room?.instructorName].filter(Boolean).join(' · ')}
            </p>
          </div>
          <img
            src={classroomIllustration}
            alt=""
            aria-hidden="true"
            className="h-43.5 w-58 object-contain max-sm:hidden"
          />
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-err">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-5">
          <SectionCard
            title={`สมาชิกกลุ่ม ${groupMembers.length} คน`}
            hint="รายชื่อจาก roster ของอาจารย์ · ถ้าข้อมูลไม่ถูกต้อง ติดต่อ TA"
          >
            <ul className="space-y-2.5">{groupMembers.map(row)}</ul>
          </SectionCard>

          <SectionCard
            title="ผลงานของกลุ่ม"
            hint="ลิงก์นี้คือสิ่งที่กลุ่มอื่นเปิดดูตอนประเมิน (ตั้งค่าโดยอาจารย์)"
            action={
              artifact?.url ? (
                <a
                  href={artifact.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex min-h-12.5 min-w-53 items-center justify-center rounded-full border border-brand-600 bg-[#f6c39f] px-6 font-display text-[15px] font-semibold text-ink hover:bg-[#f2b285] ${FOCUS}`}
                >
                  เปิดผลงานกลุ่ม ↗
                </a>
              ) : (
                <span className={btn('ghost', 'md', 'pointer-events-none min-h-12.5 min-w-53 opacity-60')}>
                  ยังไม่มีลิงก์ผลงาน
                </span>
              )
            }
          />

          <SectionCard
            title="สมาชิกในห้องเรียน"
            hint={`${members.length} คน · นักศึกษา ${students.length}${withdrawn ? ` (ถอนรายวิชา ${withdrawn})` : ''} · ทีมผู้สอน ${staff.length}`}
            bodyClassName="p-0"
          >
            <div className="flex flex-wrap items-center gap-2.5 border-b border-edge px-5 py-3.5">
              <div role="group" aria-label="กรองสมาชิก" className="flex flex-wrap gap-1.5">
                {tabButton('ALL', 'ทั้งหมด', members.length)}
                {tabButton('STUDENT', 'นักศึกษา', students.length)}
                {tabButton('STAFF', 'ทีมผู้สอน', staff.length)}
              </div>
              <div className="w-75 max-w-full">
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหาชื่อหรืออีเมล"
                  aria-label="ค้นหาชื่อหรืออีเมล"
                  className={`${CTRL} min-h-11`}
                />
              </div>
            </div>
            <ul className="space-y-2.5 px-6 py-4.5">{visible.map(row)}</ul>
          </SectionCard>
        </div>
      </main>
    </div>
  )
}
