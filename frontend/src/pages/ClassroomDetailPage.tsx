import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import classroomIllustration from '../assets/enhanced/classroom.webp'
import welcomeIllustration from '../assets/figma/welcome.png'
import membersArt from '../assets/figma/members-heading.png'
import createAssignmentArt from '../assets/figma/create-assignment.png'
import reportsArt from '../assets/figma/owner-report-heading.png'
import { AppNav } from '../components/AppNav'
import { OrangeHero } from '../components/PageChrome'
import { AssignmentPanel } from '../components/AssignmentPanel'
import { EnrollmentDialog } from '../components/EnrollmentDialog'
import { AssignmentScoringCard } from '../components/AssignmentScoringCard'
import { AssignmentsToEvaluateCard } from '../components/AssignmentsToEvaluateCard'
import { AddInstructorDialog, RemoveMemberDialog, RoleChangeDialog } from '../components/MemberDialogs'
import { RosterImportCard } from '../components/RosterImportCard'
import { RosterTable } from '../components/RosterTable'
import { SetupStepper, type StepState } from '../components/SetupStepper'
import { Banner, FOCUS, btn } from '../components/Ui'
import { IconInstructor, IconStudent, IconTa } from '../components/icons'
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

const ROLE_COPY: Record<ClassroomRole, { label: string; title: string; description: string; icon: ReactNode }> = {
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

function SummaryTile({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center rounded-2xl border border-edge bg-white px-4 pt-4 pb-5 text-center">
      <span aria-hidden="true" className="hidden">
        {icon}
      </span>
      <div className="min-w-0">
        {/* Figma J12 — ป้าย 15px · ตัวเลข 32px · คำอธิบาย 14.5px */}
        <p className="font-display text-[15px] leading-5.5 font-semibold text-ink">{label}</p>
        <p className="mt-1.5 font-display text-[32px] leading-9.5 font-bold tabular">{value}</p>
        <p className="mt-1.5 text-[14.5px] leading-5.5 text-ink-2">{hint}</p>
      </div>
    </div>
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
  const [notice, setNotice] = useState<{ title: string; body?: string } | null>(null)
  const [addingInstructor, setAddingInstructor] = useState(false)
  const [roleTarget, setRoleTarget] = useState<RosterEntry | null>(null)
  const [removing, setRemoving] = useState<RosterEntry | null>(null)
  const [myEmail, setMyEmail] = useState<string | undefined>(undefined)
  useEffect(() => {
    let active = true
    void listClassroomAssignments(classroomId)
      .then((res) => {
        if (active) {
          setAssignmentCount(res.items.length)
          setRosterLocked(res.items.some((item) => !['DRAFT', 'ARCHIVED'].includes(item.status)))
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [classroomId, assignmentVersion])
  const [activeSection, setActiveSection] = useState<ClassroomSection>(() => {
    const hash = window.location.hash.slice(1)
    return ['overview', 'members', 'assignments', 'scores'].includes(hash) ? (hash as ClassroomSection) : 'overview'
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
      setMyEmail(profile.email)
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
  // Figma J11c / K04 — ยืนยันใน dialog ของเว็บแทน window.confirm
  async function removeConfirmed(entry: RosterEntry) {
    const label = entry.displayName ? `${entry.displayName} (${entry.email})` : entry.email
    await removeMember(classroomId, entry.memberId)
    await refresh()
    setError(null)
    setNotice({
      title: `ถอด ${label} ออกจากห้องแล้ว`,
      body: 'เข้าห้องนี้ไม่ได้อีก · คำตอบที่เคยส่งยังอยู่ · บันทึก audit แล้ว',
    })
  }

  // Figma ST13 / ST14 — หน้าห้องของนักศึกษามีแค่รายการงาน ไม่มีเครื่องมือจัดการห้อง
  if (myRole === 'STUDENT') {
    return (
      <div className="flex min-h-screen flex-col bg-ground font-body text-ink">
        <AppNav context={classroomName} classroomId={classroomId} />
        <main className="mx-auto w-full max-w-290 flex-1 pt-12 pb-10 max-xl:px-7 max-sm:px-4 max-sm:pt-4">
          {/* Figma M03 — หัวหน้า "‹ ห้องเรียน" เฉพาะมือถือ */}
          <Link
            to="/classrooms"
            className={`mb-3 inline-flex min-h-11 items-center gap-2 rounded font-display text-[20px] font-bold sm:hidden ${FOCUS}`}
          >
            <svg viewBox="0 0 24 28" className="h-7 w-6 text-brand-600" aria-hidden="true">
              <path
                d="M17 3 6 14l11 11"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            ห้องเรียน
          </Link>
          <OrangeHero
            title={classroomName}
            subtitle={
              <span className="font-display text-[23px] font-bold max-sm:text-[14px]">
                {roomContext?.groupName ? (
                  <Link to={`/classrooms/${classroomId}/group`} className={`inline-flex min-h-6 items-center rounded hover:underline ${FOCUS}`}>
                    กลุ่ม {roomContext.groupName}
                  </Link>
                ) : null}
                {roomContext?.groupName && roomContext?.instructorName ? ' · ' : null}
                {roomContext?.instructorName}
              </span>
            }
            image={welcomeIllustration}
            imageClassName="-top-[63px] -right-[12px] h-[248px] w-[331px]"
          />
          {error && (
            <Banner tone="err" data-testid="error-msg" role="alert" className="mt-6">
              {error}
            </Banner>
          )}
          {myEnrollment === 'WITHDRAWN' && (
            <Banner tone="info" className="mt-6">
              คุณถอนจากรายวิชานี้แล้ว จึงไม่มีงานประเมินหรือคะแนนในห้องนี้ บัญชีและห้องเรียนอื่นยังใช้งานได้
            </Banner>
          )}
          {myEnrollment !== 'WITHDRAWN' && (
            <div className="mt-12 max-sm:mt-4" data-testid="student-dashboard">
              <AssignmentsToEvaluateCard
                classroomId={classroomId}
                version={assignmentVersion}
                student
                timezone={classroomTimezone}
              />
            </div>
          )}
        </main>
        <div className="bg-white max-sm:hidden">
          <div className="mx-auto flex max-w-290 justify-end py-6.5 max-xl:px-7 max-sm:px-4">
            <Link
              to="/classrooms"
              className={`inline-flex min-h-12.5 min-w-53 items-center justify-center rounded-full border border-brand-600 bg-accent-soft px-6 font-display text-[14.5px] font-semibold text-accent-ink hover:bg-brand-100 ${FOCUS}`}
            >
              กลับหน้าห้องเรียน
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const pendingLogin = students.filter((s) => s.status === 'PENDING').length
  const groupSizes = [
    ...students
      .reduce((map, s) => map.set(s.groupName ?? '', (map.get(s.groupName ?? '') ?? 0) + 1), new Map<string, number>())
      .values(),
  ]
  const sizeRange = groupSizes.length
    ? Math.min(...groupSizes) === Math.max(...groupSizes)
      ? `${groupSizes[0]}`
      : `${Math.min(...groupSizes)}–${Math.max(...groupSizes)}`
    : '0'
  const openAssignments = roomContext?.openAssignmentCount ?? 0
  const toReview = roomContext?.openAppealCount ?? 0
  const go = (section: ClassroomSection) => {
    setActiveSection(section)
    window.history.replaceState(null, '', `#${section}`)
    window.scrollTo({ top: 0 })
  }
  const actionClass = `inline-flex min-h-12.5 items-center rounded-full border border-reference-border bg-white px-6 font-display text-[16px] font-semibold text-ink hover:border-muted ${FOCUS}`
  const scoresLink = (
    <a
      href="#scores"
      onClick={(event) => {
        event.preventDefault()
        go('scores')
      }}
      className={actionClass}
    >
      ดูคะแนนของงาน
    </a>
  )
  const sectionHead: Record<Exclude<ClassroomSection, 'overview'>, { title: string; subtitle: string; art: string }> = {
    members: {
      title: 'สมาชิกในห้องเรียน',
      subtitle: `${students.length} คน · ${groupCount} กลุ่ม · ผู้สอน ${instructors.length} คน`,
      art: membersArt,
    },
    assignments: {
      title: 'สร้างงานประเมิน',
      subtitle: `${classroomName} · ${students.length} คน · ${groupCount} กลุ่ม`,
      art: createAssignmentArt,
    },
    scores: { title: 'คะแนนของงาน', subtitle: `${classroomName} · ตรวจรายงาน ประกาศผล และส่งออก`, art: reportsArt },
  }

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <AppNav context={classroomName} classroomId={classroomId} />

      <main className={`mx-auto max-w-290 pt-8 max-xl:px-7 max-sm:px-4 ${canManageAssignment ? 'pb-36' : 'pb-20'}`}>
        <nav aria-label="breadcrumb" className="flex min-w-0 flex-wrap items-center gap-2.5 text-[14px] text-ink-2 [&_a]:inline-flex [&_a]:min-h-6 [&_a]:items-center">
          <Link to="/classrooms" className={`shrink-0 rounded-md transition-colors hover:text-accent-ink ${FOCUS}`}>
            ห้องเรียนของฉัน
          </Link>
          <span aria-hidden="true">›</span>
          {activeSection === 'overview' ? (
            <span className="truncate">{classroomName}</span>
          ) : (
            <a
              href="#overview"
              onClick={(event) => {
                event.preventDefault()
                go('overview')
              }}
              className={`truncate hover:text-accent-ink ${FOCUS}`}
            >
              {classroomName}
            </a>
          )}
        </nav>

        {notice && (
          <div
            role="status"
            data-testid="page-notice"
            className="mt-6 flex items-start gap-5 rounded-3xl bg-ok-banner px-6 py-5"
          >
            <span aria-hidden="true" className="mt-0.5 font-display text-xl font-bold text-ok-700">
              √
            </span>
            <div>
              <p className="font-display text-[17px] font-semibold text-ok-700">{notice.title}</p>
              {notice.body && <p className="mt-1 text-[13.5px] text-ink-2">{notice.body}</p>}
            </div>
          </div>
        )}
        {error && (
          <Banner tone="err" data-testid="error-msg" role="alert" className="mt-6">
            {error}
          </Banner>
        )}
        {isArchived && (
          <Banner tone="info" className="mt-6">
            ห้องเรียนนี้เก็บเข้าคลังแล้ว — อ่านข้อมูล ดูคะแนน และส่งออกได้ กรุณาคืนห้องเรียนก่อนแก้ไข
          </Banner>
        )}
        {enrollmentNotice && (
          <Banner tone="info" role="status" className="mt-6">
            {enrollmentNotice}
          </Banner>
        )}

        {activeSection === 'overview' ? (
          <section id="overview" aria-label="ภาพรวมห้องเรียน">
            <div className="mt-6">
              <OrangeHero
                title={classroomName}
                subtitle={
                  myRole === 'TA'
                    ? // Figma T04 — TA เห็นว่าใครเป็นเจ้าของห้อง เพื่อรู้ว่าต้องติดต่อใครเรื่องสิทธิ์
                      [
                        roomContext?.courseCode,
                        `${students.length} คน`,
                        `${groupCount} กลุ่ม`,
                        roomContext?.instructorName ? `${roomContext.instructorName} (เจ้าของห้อง)` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : [
                        roomContext?.courseCode,
                        `${students.length} คน`,
                        `${groupCount} กลุ่ม`,
                        myRole === 'OWNER' && instructors.length > 1 ? `ทีมผู้สอน ${instructors.length} คน` : null,
                        classroomTimezone,
                        roleCopy ? `คุณเป็น${roleCopy.label}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                }
                image={classroomIllustration}
                imageClassName="-top-[63px] right-[14px] h-[256px] w-[341px]"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {canImport && (
                <a
                  href="#members"
                  onClick={(event) => {
                    event.preventDefault()
                    go('members')
                  }}
                  className={actionClass}
                >
                  {myRole === 'TA' ? 'จัดการรายชื่อ' : 'จัดการสมาชิก'}
                </a>
              )}
              {/* Figma J12 (ยังไม่มีงาน): สร้างงานมาก่อนดูคะแนน · J16 (มีงานแล้ว): ดูคะแนนมาก่อนสร้างงานเพิ่ม */}
              {canFinalizeScores && assignmentCount > 0 && scoresLink}
              {canManageAssignment && !isArchived && (
                <a
                  href="#assignments"
                  onClick={(event) => {
                    event.preventDefault()
                    go('assignments')
                  }}
                  className={`inline-flex min-h-12.5 items-center rounded-full bg-[#e35205] px-6 font-display text-[16px] font-semibold text-white hover:bg-cta ${FOCUS}`}
                >
                  {assignmentCount ? '+ สร้างงานประเมิน' : 'สร้างงานประเมิน'}
                </a>
              )}
              {canFinalizeScores && !assignmentCount && scoresLink}
            </div>

            {myRole === 'OWNER' && !hasStudents && (
              <div className="mt-6">
                <SetupStepper steps={steps} />
              </div>
            )}

            {canManageAssignment && !isArchived && assignmentCount === 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-4 rounded-3xl bg-info-soft px-6 py-5">
                <span aria-hidden="true" className="text-xl">
                  📝
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[19px] font-semibold text-info-ink">พร้อมสร้างงานประเมินแรก</p>
                  <p className="mt-1 text-[14px] text-ink-2">ตั้งเกณฑ์ น้ำหนัก ลิงก์ผลงานของแต่ละกลุ่ม และกำหนดส่ง</p>
                </div>
                <a
                  href="#assignments"
                  onClick={(event) => {
                    event.preventDefault()
                    go('assignments')
                  }}
                  className={btn('ghost', 'sm', 'px-6')}
                >
                  สร้างงานประเมิน
                </a>
              </div>
            )}

            {myRole === 'TA' && (
              <div
                data-testid="ta-scope"
                className="mt-6 flex flex-wrap items-center gap-4 rounded-3xl bg-info-soft px-6 py-4"
              >
                <span aria-hidden="true" className="text-xl">
                  🧑‍🏫
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[16px] font-semibold text-info-ink">บทบาท TA: ดูแลรายชื่อนักศึกษา</p>
                  <p className="mt-0.5 text-[13px] text-ink-2">
                    นำเข้า/แก้ไขรายชื่อ ช่วยนักศึกษาที่เข้าห้องไม่ได้ · ไม่เห็นงานประเมินหรือคะแนนของใคร
                  </p>
                </div>
                <a
                  href="#members"
                  onClick={(event) => {
                    event.preventDefault()
                    go('members')
                  }}
                  className={btn('ghost', 'sm', 'px-5')}
                >
                  ไปที่รายชื่อ
                </a>
              </div>
            )}
            {myRole === 'CO_TEACHER' && (
              <Banner tone="warn" className="mt-6" data-testid="co-teacher-scope">
                คุณจัดการรายชื่อและงานประเมินได้ ส่วนการประกาศผลคะแนนขั้นสุดท้ายเป็นหน้าที่ของเจ้าของห้อง
              </Banner>
            )}

            <div className={`mt-6 grid gap-3.5 sm:grid-cols-2 ${myRole === 'TA' ? '' : 'lg:grid-cols-4'}`}>
              <SummaryTile
                icon={null}
                label="นักศึกษา"
                value={students.length}
                hint={
                  students.length === 0
                    ? 'รอนำเข้ารายชื่อ'
                    : pendingLogin
                      ? `ยังไม่เคย login ${pendingLogin} คน`
                      : 'เข้าสู่ระบบแล้วทุกคน'
                }
              />
              <SummaryTile
                icon={null}
                label="กลุ่ม"
                value={groupCount}
                hint={groupCount ? `กลุ่มละ ${sizeRange} คน` : '—'}
              />
              {myRole !== 'TA' && (
                <SummaryTile
                  icon={null}
                  label="งานประเมิน"
                  value={assignmentCount}
                  hint={assignmentCount ? `เปิดอยู่ ${openAssignments} งาน` : 'ยังไม่มีงาน'}
                />
              )}
              {myRole !== 'TA' && (
                <SummaryTile
                  icon={null}
                  label="ต้องตรวจ"
                  value={toReview}
                  hint={toReview ? `คำร้องอุทธรณ์รอตอบ ${toReview}` : assignmentCount ? 'ยังไม่มีสัญญาณ' : '—'}
                />
              )}
            </div>

            {myRole !== 'TA' && (
              <div className="mt-6">
                <AssignmentsToEvaluateCard
                  classroomId={classroomId}
                  version={assignmentVersion}
                  timezone={classroomTimezone}
                  onChanged={() => setAssignmentVersion((v) => v + 1)}
                  readOnly={isArchived}
                />
              </div>
            )}
          </section>
        ) : (
          <div className="relative mt-6 flex min-h-41 items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <a
                href="#overview"
                aria-label="กลับภาพรวมห้องเรียน"
                onClick={(event) => {
                  event.preventDefault()
                  go('overview')
                }}
                className={`grid size-12 shrink-0 place-items-center rounded-xl text-brand-600 hover:bg-accent-soft ${FOCUS}`}
              >
                <svg viewBox="0 0 24 28" className="h-9 w-8" aria-hidden="true">
                  <path
                    d="M17 3 6 14l11 11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
              <div>
                <h1 className="font-display text-[32px] font-bold max-sm:text-2xl">
                  {sectionHead[activeSection].title}
                </h1>
                <p className="mt-2 text-[15px] text-ink-2">{sectionHead[activeSection].subtitle}</p>
              </div>
            </div>
            <img
              src={sectionHead[activeSection].art}
              alt=""
              aria-hidden="true"
              className="h-41 w-55 shrink-0 object-contain max-sm:hidden"
            />
          </div>
        )}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-12">
            {canImport && (
              <section
                id="members"
                hidden={activeSection !== 'members'}
                className="flex scroll-mt-40 flex-col gap-6 [hidden]:hidden"
              >
                {rosterLocked && !isArchived && (
                  <Banner tone="info">
                    มีงานเผยแพร่แล้ว กรุณายกเลิกเผยแพร่งานก่อนแก้รายชื่อ เพื่อเก็บคำตอบเดิมไว้และจัดคู่ใหม่อย่างถูกต้อง
                  </Banner>
                )}
                {!isArchived && !rosterLocked && (
                  <RosterImportCard
                    classroomId={classroomId}
                    onImported={async () => {
                      await refresh()
                      setNotice({
                        title: 'นำเข้ารายชื่อแล้ว',
                        body: 'ตรวจรายชื่อด้านล่าง · นักศึกษาเข้าห้องได้เมื่อ login ด้วยอีเมลมหาวิทยาลัย',
                      })
                    }}
                    onError={setError}
                  />
                )}
                <RosterTable
                  items={items}
                  loaded={loaded}
                  myEmail={myEmail}
                  onEnrollment={!isArchived ? setSelectedEnrollment : undefined}
                  canManageMembers={canManageMembers && !isArchived}
                  onRemove={setRemoving}
                  onChangeRole={canManageMembers && !isArchived ? setRoleTarget : undefined}
                  onAddInstructor={canManageMembers && !isArchived ? () => setAddingInstructor(true) : undefined}
                />
              </section>
            )}

            {isInstructor && myRole !== 'TA' && (
              <section
                id="assignments"
                hidden={activeSection !== 'assignments'}
                className="flex scroll-mt-40 flex-col gap-6 [hidden]:hidden"
              >
                {canManageAssignment && !isArchived && (
                  <AssignmentPanel
                    editingId={searchParams.get('draft') ?? undefined}
                    classroomId={classroomId}
                    draft={draft}
                    onDraftChange={setDraft}
                    studentCount={students.length}
                    timezone={classroomTimezone}
                    onChanged={() => setAssignmentVersion((v) => v + 1)}
                    onPublished={(name, result) => {
                      setNotice({
                        title: `เผยแพร่ "${name}" แล้ว`,
                        body: `จัดคู่ ${result.pairsCreated} รายการ · แจ้งนักศึกษา ${students.length} คน · แก้เกณฑ์ไม่ได้แล้วจนกว่าจะยกเลิกเผยแพร่`,
                      })
                      void refresh()
                      go('overview')
                    }}
                    groupNames={[
                      ...new Set(
                        students.map((student) => student.groupName).filter((name): name is string => Boolean(name)),
                      ),
                    ]}
                  />
                )}
              </section>
            )}

            {canFinalizeScores && (
              <section id="scores" hidden={activeSection !== 'scores'} className="scroll-mt-40 [hidden]:hidden">
                <AssignmentScoringCard classroomId={classroomId} version={assignmentVersion} readOnly={isArchived} />
              </section>
            )}
          </div>
        </div>
      </main>
      {selectedEnrollment && (
        <EnrollmentDialog
          member={selectedEnrollment}
          classroomId={classroomId}
          onClose={() => setSelectedEnrollment(null)}
          onChanged={async (message) => {
            await refresh()
            setAssignmentVersion((value) => value + 1)
            setEnrollmentNotice(null)
            setNotice({ title: message.split(' · ')[0], body: message.split(' · ').slice(1).join(' · ') })
          }}
        />
      )}
      {addingInstructor && (
        <AddInstructorDialog
          classroomId={classroomId}
          classroomName={classroomName}
          domain={roomContext?.allowedEmailDomains[0] ?? null}
          onClose={() => setAddingInstructor(false)}
          onAdded={async (message) => {
            await refresh()
            setNotice(message)
          }}
        />
      )}
      {removing && (
        <RemoveMemberDialog
          member={removing}
          onClose={() => setRemoving(null)}
          onConfirm={() => removeConfirmed(removing)}
        />
      )}
      {roleTarget && (
        <RoleChangeDialog
          classroomId={classroomId}
          member={roleTarget}
          onClose={() => setRoleTarget(null)}
          onChanged={async (message) => {
            await refresh()
            setNotice(message)
          }}
        />
      )}
    </div>
  )
}
