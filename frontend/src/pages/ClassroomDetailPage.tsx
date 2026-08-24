import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { AppNav } from '../components/AppNav'
import { AssignmentPanel } from '../components/AssignmentPanel'
import { AssignmentScoringCard } from '../components/AssignmentScoringCard'
import { AssignmentsToEvaluateCard } from '../components/AssignmentsToEvaluateCard'
import { MemberPanel } from '../components/MemberPanel'
import { RosterImportCard } from '../components/RosterImportCard'
import { RosterTable } from '../components/RosterTable'
import { SetupStepper, type StepState } from '../components/SetupStepper'
import { SetupSummary } from '../components/SetupSummary'
import { Banner, Card, Pill } from '../components/Ui'
import {
  IconClipboardCheck,
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
  getMe,
  getRoster,
  removeMember,
} from '../lib/api'
import { DEFAULT_DRAFT, type AssignmentDraft } from '../lib/assignment'
import { clearToken, isSignedIn } from '../lib/session'

// ต้องตรงกับ role matrix ฝั่ง server ใน backend/app/domain/access.py
// หน้าจอที่ซ่อนปุ่มไม่ใช่การกันสิทธิ์ — server กันอยู่แล้ว — แต่ถ้าสองฝั่งไม่ตรงกัน
// TA จะเห็นปุ่มที่กดแล้วได้ 403 เสมอ ซึ่งดูเหมือนระบบพังมากกว่าดูเหมือนกฎ
type ClassroomRole = RosterEntry['role']

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
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-edge bg-white p-4">
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-xl bg-sand text-ink-2"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-0.5 font-display text-lg font-bold leading-tight">{value}</p>
        <p className="mt-1 text-xs text-muted">{hint}</p>
      </div>
    </div>
  )
}

function StudentWelcome({ classroomName }: { classroomName: string }) {
  return (
    <Card className="overflow-hidden" data-testid="student-dashboard">
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#fff7f1_0%,#ffffff_48%,#eef9f3_100%)] px-6 py-7 max-sm:px-4">
        <div aria-hidden="true" className="absolute -right-8 -top-12 size-40 rounded-full bg-accent-soft/70" />
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

  const [items, setItems] = useState<RosterEntry[]>([])
  const [myRole, setMyRole] = useState<ClassroomRole | null>(null)
  const [classroomName, setClassroomName] = useState('ห้องเรียนนี้')
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState<AssignmentDraft>(DEFAULT_DRAFT)

  const refresh = useCallback(async () => {
    if (!isSignedIn()) {
      setLoaded(true)
      return
    }
    try {
      // สมาชิกทุก role มี VIEW_ROSTER ฝั่ง server; สิทธิ์ STUDENT เป็นแบบอ่านอย่างเดียว
      const profile = await getMe()
      const membership = profile.classrooms.find((c) => c.classroomId === classroomId)
      if (!membership || !isClassroomRole(membership.role)) {
        setError('ไม่พบห้องเรียน หรือคุณไม่มีสิทธิ์เข้าถึงห้องเรียนนี้')
        setItems([])
        setMyRole(null)
        return
      }

      setMyRole(membership.role)
      setClassroomName(membership.classroomName)
      const roster = await getRoster(classroomId)
      setItems(roster.items)
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken()
      }
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

  const students = items.filter((m) => m.role === 'STUDENT')
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

  /** ขั้นตอนคำนวณจากข้อมูลจริงเสมอ ไม่ได้เก็บเป็น flag — ดูเหตุผลใน SetupStepper */
  const stepState = (done: boolean, previousDone: boolean): StepState =>
    done ? 'done' : previousDone ? 'current' : 'todo'

  const hasStudents = students.length > 0
  const hasCoTeacher = instructors.length > 1
  const steps = [
    { title: 'เพิ่มสมาชิก', state: stepState(hasStudents, true) },
    { title: 'กำหนดผู้ร่วมสอน', state: stepState(hasCoTeacher, hasStudents) },
    { title: 'สร้างงานประเมิน', state: stepState(false, hasStudents) },
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
        className={`mx-auto max-w-300 px-6 pt-8 max-sm:px-4 ${canManageAssignment ? 'pb-36' : 'pb-16'}`}
      >
        <div className="mb-7 flex flex-wrap items-start gap-x-6 gap-y-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>{classroomName}</span>
              {roleCopy && (
                <Pill tone={myRole === 'STUDENT' ? 'brand' : 'neutral'} icon={roleCopy.icon}>
                  {roleCopy.label}
                </Pill>
              )}
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight max-sm:text-2xl">
              {roleCopy?.title ?? 'ห้องเรียน'}
            </h1>
            <p className="mt-1.5 max-w-[62ch] text-muted">
              {roleCopy?.description ?? 'กำลังโหลดข้อมูลห้องเรียน'}
            </p>
          </div>

          {isInstructor && (
            <span className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-edge bg-white px-4 font-display text-sm font-semibold shadow-[0_1px_2px_rgba(23,32,51,0.05)]">
              <span aria-hidden="true" className="size-2 rounded-full bg-brand-600" />
              สมาชิก <span className="font-mono tabular">{items.length}</span> คน
            </span>
          )}
        </div>

        {error && (
          <Banner tone="err" data-testid="error-msg" role="alert" className="mb-6">
            {error}
          </Banner>
        )}

        {myRole && (
          <nav
            aria-label="ส่วนต่าง ๆ ในห้องเรียน"
            className="sticky top-16 z-30 mb-6 flex gap-1 overflow-x-auto border-b border-edge bg-ground/95 pt-1 backdrop-blur"
          >
            {isInstructor && (
              <a
                href="#overview"
                className="min-h-11 shrink-0 border-b-2 border-brand-600 px-4 py-3 text-sm font-semibold text-accent-ink"
              >
                ภาพรวม
              </a>
            )}
            {canImport && (
              <a
                href="#members"
                className="min-h-11 shrink-0 border-b-2 border-transparent px-4 py-3 text-sm text-ink-2 transition-colors hover:border-edge-strong hover:text-ink"
              >
                สมาชิก
              </a>
            )}
            {myRole !== 'TA' && (
              <a
                href="#assignments"
                className="min-h-11 shrink-0 border-b-2 border-transparent px-4 py-3 text-sm text-ink-2 transition-colors hover:border-edge-strong hover:text-ink"
              >
                งานประเมิน
              </a>
            )}
            {canFinalizeScores && (
              <a
                href="#scores"
                className="min-h-11 shrink-0 border-b-2 border-transparent px-4 py-3 text-sm text-ink-2 transition-colors hover:border-edge-strong hover:text-ink"
              >
                คะแนน
              </a>
            )}
          </nav>
        )}

        {myRole === 'OWNER' && <SetupStepper steps={steps} />}

        {isInstructor && (
          <section id="overview" aria-label="ภาพรวมห้องเรียน" className="mb-6 grid scroll-mt-32 gap-3 sm:grid-cols-3">
            <SummaryTile
              icon={<IconStudent className="size-5" />}
              label="นักศึกษา"
              value={<span className="font-mono tabular">{students.length} คน</span>}
              hint={students.length > 0 ? 'พร้อมจัดกลุ่มและมอบหมายงาน' : 'รอนำเข้ารายชื่อ'}
            />
            <SummaryTile
              icon={<IconRoster className="size-5" />}
              label="กลุ่ม"
              value={<span className="font-mono tabular">{groupCount} กลุ่ม</span>}
              hint="คำนวณจากรายชื่อล่าสุด"
            />
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

        {myRole === 'STUDENT' && (
          <div className="mb-6">
            <StudentWelcome classroomName={classroomName} />
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div
            className={`flex min-w-0 flex-col gap-6 ${canManageAssignment ? 'lg:col-span-8' : 'lg:col-span-12'}`}
          >
            {canImport && (
              <section id="members" className="flex scroll-mt-32 flex-col gap-6">
                <RosterImportCard
                  classroomId={classroomId}
                  onImported={refresh}
                  onError={setError}
                />

                <RosterTable
                  items={items}
                  loaded={loaded}
                  canManageMembers={canManageMembers}
                  onRemove={handleRemove}
                />

                {/* เฉพาะเจ้าของห้อง — ผู้สอนร่วมและ TA เพิ่มคนไม่ได้ตาม role matrix */}
                {canManageMembers && (
                  <MemberPanel
                    classroomId={classroomId}
                    instructors={instructors}
                    onChanged={refresh}
                  />
                )}
              </section>
            )}

            {/* TA ดูแล roster เท่านั้น ส่วน role ที่มีหน้าที่ประเมินจะเห็นจุดเข้างานของตน */}
            {myRole !== null && myRole !== 'TA' && (
              <section id="assignments" className="flex scroll-mt-32 flex-col gap-6">
                <AssignmentsToEvaluateCard classroomId={classroomId} />

                {/* งานประเมินสร้างได้เฉพาะผู้สอน และต้องมีรายชื่อก่อนถึงจะจัดคู่ได้ */}
                {canManageAssignment && (
                  <AssignmentPanel
                    classroomId={classroomId}
                    draft={draft}
                    onDraftChange={setDraft}
                    studentCount={students.length}
                  />
                )}
              </section>
            )}

            {myRole === 'STUDENT' && (
              <section aria-label="รายชื่อสมาชิกในห้อง" className="scroll-mt-32">
                <RosterTable
                  items={items}
                  loaded={loaded}
                  canManageMembers={false}
                  onRemove={handleRemove}
                />
              </section>
            )}

            {/* ตัดสินและประกาศคะแนน — เฉพาะเจ้าของห้อง (US-13) */}
            {canFinalizeScores && (
              <section id="scores" className="scroll-mt-32">
                <AssignmentScoringCard classroomId={classroomId} />
              </section>
            )}
          </div>

          {canManageAssignment && (
            <aside aria-label="สรุปการตั้งค่า" className="lg:sticky lg:top-22 lg:col-span-4">
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
    </div>
  )
}
