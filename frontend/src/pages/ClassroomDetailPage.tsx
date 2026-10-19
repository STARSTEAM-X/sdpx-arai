import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import classroomIllustration from '../assets/enhanced/classroom.webp'
import welcomeIllustration from '../assets/figma/welcome.png'
import { AppNav } from '../components/AppNav'
import { AssignmentPanel } from '../components/AssignmentPanel'
import { AppealsPanel } from '../components/AppealsPanel'
import { EnrollmentDialog } from '../components/EnrollmentDialog'
import { AssignmentScoringCard } from '../components/AssignmentScoringCard'
import { AssignmentsToEvaluateCard } from '../components/AssignmentsToEvaluateCard'
import { MemberPanel } from '../components/MemberPanel'
import { RosterImportCard } from '../components/RosterImportCard'
import { RosterTable } from '../components/RosterTable'
import { SetupStepper, type StepState } from '../components/SetupStepper'
import { SetupSummary } from '../components/SetupSummary'
import { Banner, Card, FOCUS, Pill } from '../components/Ui'
import {
  IconClipboardCheck,
  IconBack,
  IconInstructor,
  IconLock,
  IconRoster,
  IconShield,
  IconStudent,
  IconTa,
} from '../components/icons'
import {
  ApiError,
  type RosterEntry,
  type Classroom,
  getMe,
  getRoster,
  listClassrooms,
  listClassroomAssignments,
  removeMember,
} from '../lib/api'
import { DEFAULT_DRAFT, type AssignmentDraft } from '../lib/assignment'
import { isSignedIn } from '../lib/session'

// ต้องตรงกับ role matrix ฝั่ง server ใน backend/app/domain/access.py
// หน้าจอที่ซ่อนปุ่มไม่ใช่การกันสิทธิ์ — server กันอยู่แล้ว — แต่ถ้าสองฝั่งไม่ตรงกัน
// TA จะเห็นปุ่มที่กดแล้วได้ 403 เสมอ ซึ่งดูเหมือนระบบพังมากกว่าดูเหมือนกฎ
type ClassroomRole = RosterEntry['role']
type ClassroomSection = 'overview' | 'members' | 'assignments' | 'scores'

const CAN_MANAGE_ROSTER: ClassroomRole[] = ['OWNER', 'CO_TEACHER', 'TA']
const CAN_MANAGE_ASSIGNMENT: ClassroomRole[] = ['OWNER', 'CO_TEACHER']
const CAN_MANAGE_MEMBERS: ClassroomRole[] = ['OWNER']
const INSTRUCTOR_ROLES: ClassroomRole[] = ['OWNER', 'CO_TEACHER', 'TA']

const ROLE_COPY: Record<
  ClassroomRole,
  { label: string; title: string; description: string; icon: ReactNode }
> = {
  OWNER: {
    label: 'เจ้าของห้อง',
    title: 'จัดการสมาชิกและงานประเมิน',
    description: 'ดูภาพรวม ตั้งค่าห้องเรียน และควบคุมการประกาศผลจากที่เดียว',
    icon: <IconInstructor className="size-5" />,
  },
  CO_TEACHER: {
    label: 'ผู้สอนร่วม',
    title: 'ดูแลงานประเมิน',
    description: 'จัดการรายชื่อและงานประเมินร่วมกับเจ้าของห้องเรียน',
    icon: <IconInstructor className="size-5" />,
  },
  TA: {
    label: 'ผู้ช่วยสอน',
    title: 'ดูแลรายชื่อนักศึกษา',
    description: 'นำเข้า ตรวจสอบ และจัดระเบียบรายชื่อสำหรับห้องเรียนนี้',
    icon: <IconTa className="size-5" />,
  },
  STUDENT: {
    label: 'นักศึกษา',
    title: 'งานประเมินของฉัน',
    description: 'ติดตามงานที่ได้รับมอบหมาย ประเมินให้ครบ และดูคะแนนเมื่อประกาศผล',
    icon: <IconStudent className="size-5" />,
  },
}

function isClassroomRole(value: string | undefined): value is ClassroomRole {
  return value !== undefined && ['OWNER', 'CO_TEACHER', 'TA', 'STUDENT'].includes(value)
}

function SummaryTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  hint: string
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-edge bg-white px-4 py-5 text-center">
      <span
        aria-hidden="true"
        className="hidden"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-2">{label}</p>
        <p className="mt-2 font-display text-[30px] font-bold leading-tight">{value}</p>
        <p className="mt-2 text-xs leading-5 text-muted">{hint}</p>
      </div>
    </div>
  )
}

function StudentWelcome({ classroomName }: { classroomName: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative overflow-hidden bg-sand px-7 py-8 max-sm:px-5">
        <div aria-hidden="true" className="absolute -right-8 -top-12 size-48 rounded-full bg-accent-soft/70" />
        <div className="relative max-w-2xl">
          <Pill tone="brand" icon={<IconStudent className="size-3.5" />}>
            พื้นที่นักศึกษา
          </Pill>
          <h2 className="mt-4 font-display text-2xl font-bold">พร้อมเริ่มประเมินแล้ว</h2>
          <p className="mt-2 text-sm leading-6 text-ink-2">
            เลือกงานของ {classroomName} ด้านล่าง ระบบจะบันทึกคำตอบอัตโนมัติและแสดงความคืบหน้าในหน้าประเมิน
          </p>
        </div>
      </div>
      <div className="grid gap-3 border-t border-edge bg-white p-5 sm:grid-cols-2 max-sm:p-4">
        <div className="flex gap-3 rounded-xl bg-sand p-4">
          <IconClipboardCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent-ink" />
          <div>
            <p className="font-display text-sm font-semibold">ประเมินทีละคู่</p>
            <p className="mt-1 text-xs leading-5 text-muted">ตอบได้ 6 ระดับและกลับมาทำต่อก่อนหมดเวลาได้</p>
          </div>
        </div>
        <div className="flex gap-3 rounded-xl bg-sand p-4">
          <IconLock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ok-700" />
          <div>
            <p className="font-display text-sm font-semibold">รักษาความเป็นส่วนตัว</p>
            <p className="mt-1 text-xs leading-5 text-muted">ไม่เปิดเผยว่าใครให้คำตอบ และซ่อนคะแนนรายบุคคลเมื่อข้อมูลยังไม่พอ</p>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function ClassroomDetailPage() {
  const { classroomId = '' } = useParams()
  const [searchParams] = useSearchParams()

  const [items, setItems] = useState<RosterEntry[]>([])
  const [myRole, setMyRole] = useState<ClassroomRole | null>(null)
  const [classroomName, setClassroomName] = useState('ห้องเรียนนี้')
  const [classroomTimezone, setClassroomTimezone] = useState('Asia/Bangkok')
  const [roomContext, setRoomContext] = useState<Classroom | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [selectedEnrollment, setSelectedEnrollment] = useState<RosterEntry | null>(null)
  const [enrollmentNotice, setEnrollmentNotice] = useState<string | null>(null)
  const [myEnrollment, setMyEnrollment] = useState('ACTIVE')
  const [draft, setDraft] = useState<AssignmentDraft>(DEFAULT_DRAFT)
  const [assignmentVersion, setAssignmentVersion] = useState(0)
  const [assignmentCount, setAssignmentCount] = useState(0)
  const [rosterLocked, setRosterLocked] = useState(false)
  useEffect(() => {
    let active = true
    void listClassroomAssignments(classroomId).then((res) => {
      if (active) { setAssignmentCount(res.items.length); setRosterLocked(res.items.some((item) => !['DRAFT', 'ARCHIVED'].includes(item.status))) }
    }).catch(() => {})
    return () => { active = false }
  }, [classroomId, assignmentVersion])
  const [activeSection, setActiveSection] = useState<ClassroomSection>(() => {
    const hash = window.location.hash.slice(1)
    return ['overview', 'members', 'assignments', 'scores'].includes(hash)
      ? (hash as ClassroomSection)
      : 'overview'
  })

  const refresh = useCallback(async () => {
    if (!isSignedIn()) {
      setLoaded(true)
      return
    }
    try {
      // สมาชิกทุก role มี VIEW_ROSTER ฝั่ง server; สิทธิ์ STUDENT เป็นแบบอ่านอย่างเดียว
      const [profile, classrooms] = await Promise.all([getMe(), listClassrooms()])
      const membership = profile.classrooms.find((c) => c.classroomId === classroomId)
      if (!membership || !isClassroomRole(membership.role)) {
        setError('ไม่พบห้องเรียน หรือคุณไม่มีสิทธิ์เข้าถึงห้องเรียนนี้')
        setItems([])
        setMyRole(null)
        return
      }

      setMyRole(membership.role)
      setClassroomName(membership.classroomName)
      setRoomContext(classrooms.items.find((classroom) => classroom.id === classroomId) ?? null)
      setClassroomTimezone(
        classrooms.items.find((classroom) => classroom.id === classroomId)?.timezone ?? 'Asia/Bangkok',
      )
      const roster = await getRoster(classroomId)
      setItems(roster.items)
      setMyEnrollment(roster.items.find((member) => member.email === profile.email)?.enrollmentStatus ?? 'ACTIVE')
      setError(null)
    } catch (err) {
      // 404 ที่นี่กินความสองอย่างพร้อมกันโดยตั้งใจ (US-11): ห้องไม่มีอยู่จริง
      // หรือมีอยู่แต่เราไม่ใช่สมาชิก — หน้าจอต้องไม่แยกสองกรณีนี้ให้ผู้ใช้เห็น
      setError(err instanceof ApiError ? err.message : 'โหลดรายชื่อไม่สำเร็จ')
      setItems([])
      setMyRole(null)
    } finally {
      setLoaded(true)
    }
  }, [classroomId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const students = items.filter((m) => m.role === 'STUDENT' && m.enrollmentStatus !== 'WITHDRAWN')
  const instructors = items.filter((m) => INSTRUCTOR_ROLES.includes(m.role))
  const groupCount = new Set(students.map((s) => s.groupName)).size

  const canImport = myRole !== null && CAN_MANAGE_ROSTER.includes(myRole)
  const canManageAssignment = myRole !== null && CAN_MANAGE_ASSIGNMENT.includes(myRole)
  const canManageMembers = myRole !== null && CAN_MANAGE_MEMBERS.includes(myRole)
  // FINALIZE_SCORES เป็นของ OWNER เท่านั้นตาม role matrix — CO_TEACHER จัดการ assignment ได้
  // แต่ตัดสินคะแนนสุดท้ายไม่ได้ เพราะ reopen/override ย้อนกลับไม่ได้เหมือนงานอื่น
  const canFinalizeScores = myRole === 'OWNER'
  const isInstructor = myRole !== null && INSTRUCTOR_ROLES.includes(myRole)
  const roleCopy = myRole ? ROLE_COPY[myRole] : null
  const isArchived = roomContext?.status === 'ARCHIVED'

  useEffect(() => {
    if (!myRole) return
    const available: ClassroomSection[] = []
    if (isInstructor) available.push('overview')
    if (canImport) available.push('members')
    if (myRole !== 'TA') available.push('assignments')
    if (canFinalizeScores) available.push('scores')
    if (available.length === 0) return

    const updateFromHash = () => {
      const hash = window.location.hash.slice(1) as ClassroomSection
      if (!available.includes(hash)) return false
      setActiveSection(hash)
      return true
    }
    if (!available.includes(activeSection)) setActiveSection(available[0])
    updateFromHash()
    window.addEventListener('hashchange', updateFromHash)
    return () => window.removeEventListener('hashchange', updateFromHash)
  }, [myRole, isInstructor, canImport, canFinalizeScores, activeSection])

  const sectionLinkClass = (section: ClassroomSection) =>
    `inline-flex min-h-11 shrink-0 items-center rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors ${FOCUS} ${
      activeSection === section
        ? 'border-cta bg-cta text-white'
        : 'border-edge-strong bg-white text-ink-2 hover:border-brand-600 hover:text-accent-ink'
    }`

  /** ขั้นตอนคำนวณจากข้อมูลจริงเสมอ ไม่ได้เก็บเป็น flag — ดูเหตุผลใน SetupStepper */
  const stepState = (done: boolean, previousDone: boolean): StepState =>
    done ? 'done' : previousDone ? 'current' : 'todo'

  const hasStudents = students.length > 0
  const hasCoTeacher = instructors.length > 1
  const steps = [
    { title: 'เพิ่มสมาชิก', state: stepState(hasStudents, true) },
    { title: 'กำหนดผู้ร่วมสอน', state: stepState(hasCoTeacher, hasStudents) },
    { title: 'สร้างงานประเมิน', state: stepState(assignmentCount > 0, hasStudents) },
  ]

  /** ถอดสมาชิกออกจากเมนูในตาราง — ถามยืนยันก่อนเพราะย้อนกลับไม่ได้
   *  และคนที่ถูกถอดจะหลุดจากคู่ประเมินที่จัดไว้แล้วทันที */
  function handleRemove(entry: RosterEntry) {
    const label = entry.displayName ? `${entry.displayName} (${entry.email})` : entry.email
    if (!window.confirm(`นำ ${label} ออกจากห้องเรียนนี้? การถอดออกย้อนกลับไม่ได้`)) return

    void (async () => {
      try {
        await removeMember(classroomId, entry.memberId)
        await refresh()
        setError(null)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'ถอดสมาชิกไม่สำเร็จ')
      }
    })()
  }

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <AppNav context={classroomName} classroomId={classroomId} />

      <main
        className={`mx-auto max-w-304 px-7 pt-7 max-sm:px-4 ${canManageAssignment ? 'pb-36' : 'pb-20'}`}
      >
        <div className={`mb-6 flex min-w-0 items-center gap-2 text-[13px] text-muted ${myRole === 'STUDENT' ? 'hidden' : ''}`}>
          <Link to="/classrooms" className={`shrink-0 rounded-md py-1 transition-colors hover:text-accent-ink ${FOCUS}`}>
            ห้องเรียนของฉัน
          </Link>
          <span aria-hidden="true">›</span>
          <span className="truncate">{classroomName}</span>
        </div>

        {myRole === 'STUDENT' && <div className="mb-3 flex items-center gap-2"><Link to="/classrooms" aria-label="กลับห้องเรียนของฉัน" className={`grid size-11 place-items-center rounded text-brand-600 ${FOCUS}`}><IconBack className="size-10" /></Link><h1 className="font-display text-2xl font-bold">ห้องเรียน</h1></div>}
        <div className={`relative isolate rounded-3xl bg-[linear-gradient(110deg,#ff7d3d_0%,#ffb558_100%)] px-10 py-7 max-sm:px-4 ${myRole === 'STUDENT' ? 'mb-3 min-h-31 max-sm:py-4' : 'mb-6 min-h-37'}`}>
          <div className="relative z-10 max-w-[calc(100%-14rem)] max-md:max-w-full">
            {myRole === 'STUDENT' ? <h2 className="max-w-[70%] font-display text-[28px] leading-tight font-bold text-white max-sm:text-xl">{classroomName}</h2> : <h1 className="font-display text-[32px] leading-tight font-bold tracking-tight text-white max-sm:text-2xl">
              {classroomName}
            </h1>}
            <p className="mt-3 max-w-[62ch] text-sm leading-6 text-ink-2 max-sm:max-w-[70%]">
              {myRole === 'STUDENT' ? [roomContext?.groupName ? `กลุ่ม ${roomContext.groupName}` : null, roomContext?.instructorName].filter(Boolean).join(' · ') : [roomContext?.courseCode, `${students.length} คน`, `${groupCount} กลุ่ม`, `ทีมผู้สอน ${instructors.length} คน`, classroomTimezone, roleCopy ? `คุณเป็น${roleCopy.label}` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
          <img
            src={myRole === 'STUDENT' ? welcomeIllustration : classroomIllustration}
            alt=""
            width={640}
            height={480}
            className={`pointer-events-none absolute -top-5 right-0 -z-10 h-56 w-72 object-contain ${myRole === 'STUDENT' ? 'max-md:top-auto max-md:bottom-3 max-md:right-2 max-md:h-24 max-md:w-28' : 'max-md:hidden'}`}
          />
        </div>

        {error && (
          <Banner tone="err" data-testid="error-msg" role="alert" className="mb-6">
            {error}
          </Banner>
        )}
        {isArchived && <Banner tone="info" className="mb-6">ห้องเรียนนี้เก็บเข้าคลังแล้ว — อ่านข้อมูล ดูคะแนน และส่งออกได้ กรุณาคืนห้องเรียนก่อนแก้ไข</Banner>}
        {myEnrollment === 'WITHDRAWN' && <Banner tone="info" className="mb-6">คุณถอนจากรายวิชานี้แล้ว จึงไม่มีงานประเมินหรือคะแนนในห้องนี้ บัญชีและห้องเรียนอื่นยังใช้งานได้</Banner>}
        {enrollmentNotice && <Banner tone="info" role="status" className="mb-6">{enrollmentNotice}</Banner>}

        {isInstructor && (
          <nav
            aria-label="ส่วนต่าง ๆ ในห้องเรียน"
            className="sticky top-16 z-30 -mx-1 mb-6 flex gap-2 overflow-x-auto bg-ground/95 px-1 py-3 backdrop-blur"
          >
            {isInstructor && (
              <a
                href="#overview"
                aria-current={activeSection === 'overview' ? 'location' : undefined}
                onClick={() => setActiveSection('overview')}
                className={sectionLinkClass('overview')}
              >
                ภาพรวม
              </a>
            )}
            {canImport && (
              <a
                href="#members"
                aria-current={activeSection === 'members' ? 'location' : undefined}
                onClick={() => setActiveSection('members')}
                className={sectionLinkClass('members')}
              >
                สมาชิก
              </a>
            )}
            {myRole !== 'TA' && (
              <a
                href="#assignments"
                aria-current={activeSection === 'assignments' ? 'location' : undefined}
                onClick={() => setActiveSection('assignments')}
                className={sectionLinkClass('assignments')}
              >
                งานประเมิน
              </a>
            )}
            {canFinalizeScores && (
              <a
                href="#scores"
                aria-current={activeSection === 'scores' ? 'location' : undefined}
                onClick={() => setActiveSection('scores')}
                className={sectionLinkClass('scores')}
              >
                คะแนน
              </a>
            )}
            <Link to={`/classrooms/${classroomId}/audit`} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-edge-strong bg-white px-5 py-2.5 text-sm font-semibold">บันทึกการตรวจสอบ</Link>
          </nav>
        )}

        {myRole === 'OWNER' && activeSection === 'overview' && !hasStudents && <SetupStepper steps={steps} />}

          {isInstructor && activeSection === 'overview' && canManageAssignment && !isArchived && <Banner tone="info" className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><span>{assignmentCount ? 'ติดตามงานและการประเมินของห้องเรียน' : 'พร้อมสร้างงานประเมินแรก'}</span><a href="#assignments" className="rounded-full border border-edge-strong bg-white px-5 py-3 text-sm font-semibold text-ink">สร้างงานประเมิน</a></div>
          </Banner>}

        {isInstructor && (
          <section id="overview" aria-label="ภาพรวมห้องเรียน" hidden={activeSection !== 'overview'} className="mb-7 grid scroll-mt-40 gap-4 sm:grid-cols-4 [hidden]:hidden">
            <SummaryTile
              icon={<IconStudent className="size-5" />}
              label="นักศึกษา"
              value={<span className="font-mono tabular">{students.length}</span>}
              hint={students.length > 0 ? 'พร้อมจัดกลุ่มและมอบหมายงาน' : 'รอนำเข้ารายชื่อ'}
            />
            <SummaryTile
              icon={<IconRoster className="size-5" />}
              label="กลุ่ม"
              value={<span className="font-mono tabular">{groupCount}</span>}
              hint="คำนวณจากรายชื่อล่าสุด"
            />
            <SummaryTile icon={<IconClipboardCheck className="size-5" />} label="งานประเมิน" value={assignmentCount} hint={assignmentCount ? 'งานทั้งหมดในห้อง' : 'ยังไม่มีงาน'} />
            <SummaryTile
              icon={<IconInstructor className="size-5" />}
              label="ทีมผู้สอน"
              value={<span className="font-mono tabular">{instructors.length} คน</span>}
              hint={myRole === 'TA' ? 'คุณดูแลรายชื่อในห้องนี้' : 'เจ้าของห้อง ผู้สอนร่วม และ TA'}
            />
          </section>
        )}

        {myRole === 'CO_TEACHER' && (
          <Banner tone="warn" className="mb-6" data-testid="co-teacher-scope">
            คุณจัดการรายชื่อและงานประเมินได้ ส่วนการประกาศผลคะแนนขั้นสุดท้ายเป็นหน้าที่ของเจ้าของห้อง
          </Banner>
        )}

        {myRole === 'TA' && (
          <Banner tone="ok" className="mb-6" data-testid="ta-scope">
            หน้านี้แสดงเฉพาะเครื่องมือดูแลรายชื่อ งานประเมินและคะแนนจะไม่แสดงในสิทธิ์ผู้ช่วยสอน
          </Banner>
        )}

        {myRole === 'STUDENT' && myEnrollment !== 'WITHDRAWN' && (
          <div className="mb-6" data-testid="student-dashboard">
            <AssignmentsToEvaluateCard classroomId={classroomId} version={assignmentVersion} student timezone={classroomTimezone} />
          </div>
        )}
        {isInstructor && activeSection === 'overview' && <div className="mb-6">

          <AssignmentsToEvaluateCard classroomId={classroomId} version={assignmentVersion} />
        </div>}

        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div
            className={`flex min-w-0 flex-col gap-6 ${canManageAssignment && activeSection === 'assignments' ? 'lg:col-span-8' : 'lg:col-span-12'}`}
          >
            {canImport && (
              <section id="members" hidden={activeSection !== 'members'} className="flex scroll-mt-40 flex-col gap-6 [hidden]:hidden">
                {rosterLocked && !isArchived && <Banner tone="info">มีงานเผยแพร่แล้ว กรุณายกเลิกเผยแพร่งานก่อนแก้รายชื่อ เพื่อเก็บคำตอบเดิมไว้และจัดคู่ใหม่อย่างถูกต้อง</Banner>}
                {!isArchived && !rosterLocked && <RosterImportCard
                  classroomId={classroomId}
                  onImported={refresh}
                  onError={setError}
                />}

                <RosterTable
                  items={items}
                  loaded={loaded}
                  onEnrollment={!isArchived ? setSelectedEnrollment : undefined}
                  canManageMembers={canManageMembers && !isArchived}
                  onRemove={handleRemove}
                />

                {/* เฉพาะเจ้าของห้อง — ผู้สอนร่วมและ TA เพิ่มคนไม่ได้ตาม role matrix */}
                {canManageMembers && !isArchived && (
                  <MemberPanel
                    classroomId={classroomId}
                    instructors={instructors}
                    onChanged={refresh}
                  />
                )}
              </section>
            )}

            {/* TA ดูแล roster เท่านั้น ส่วน role ที่มีหน้าที่ประเมินจะเห็นจุดเข้างานของตน */}
            {isInstructor && myRole !== 'TA' && (
              <section id="assignments" hidden={activeSection !== 'assignments'} className="flex scroll-mt-40 flex-col gap-6 [hidden]:hidden">
                <AssignmentsToEvaluateCard classroomId={classroomId} version={assignmentVersion} timezone={classroomTimezone} onChanged={() => setAssignmentVersion((v) => v + 1)} readOnly={isArchived} />

                {canManageAssignment && <AppealsPanel classroomId={classroomId} readOnly={isArchived} />}

                {/* งานประเมินสร้างได้เฉพาะผู้สอน และต้องมีรายชื่อก่อนถึงจะจัดคู่ได้ */}
                {canManageAssignment && !isArchived && (
                  <AssignmentPanel
                    editingId={searchParams.get('draft') ?? undefined}
                    classroomId={classroomId}
                    draft={draft}
                    onDraftChange={setDraft}
                    studentCount={students.length}
                    timezone={classroomTimezone}
                    onChanged={() => setAssignmentVersion((v) => v + 1)}
                    groupNames={[...new Set(students.map((student) => student.groupName).filter((name): name is string => Boolean(name)))]}
                  />
                )}
              </section>
            )}

            {myRole === 'STUDENT' && (
              <details aria-label="รายชื่อสมาชิกในห้อง" className="scroll-mt-40"><summary className="mb-4 cursor-pointer font-semibold">ข้อมูลห้องและสมาชิก</summary><StudentWelcome classroomName={classroomName} />
                <RosterTable
                  items={items}
                  loaded={loaded}
                  canManageMembers={false}
                  onRemove={handleRemove}
                />
              </details>
            )}

            {/* ตัดสินและประกาศคะแนน — เฉพาะเจ้าของห้อง (US-13) */}
            {canFinalizeScores && (
              <section id="scores" hidden={activeSection !== 'scores'} className="scroll-mt-40 [hidden]:hidden">
                <AssignmentScoringCard classroomId={classroomId} version={assignmentVersion} readOnly={isArchived} />
              </section>
            )}
          </div>

          {canManageAssignment && !isArchived && activeSection === 'assignments' && (
            <aside aria-label="สรุปการตั้งค่า" className="lg:sticky lg:top-36 lg:col-span-4">
              <SetupSummary
                draft={draft}
                memberCount={items.length}
                studentCount={students.length}
                groupCount={groupCount}
              />
            </aside>
          )}
        </div>

        {myRole === 'STUDENT' && loaded && (
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm text-muted">
            <IconShield aria-hidden="true" className="size-4" />
            รายชื่อเป็นข้อมูลอ่านอย่างเดียว คุณแก้ไขสมาชิกหรือดูคำตอบของผู้อื่นไม่ได้
          </p>
        )}
      </main>
      {selectedEnrollment && <EnrollmentDialog member={selectedEnrollment} classroomId={classroomId} onClose={() => setSelectedEnrollment(null)} onChanged={async (notice) => { await refresh(); setAssignmentVersion((value) => value + 1); setEnrollmentNotice(notice) }} />}
    </div>
  )
}
