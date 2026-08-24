import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AssignmentPanel } from '../components/AssignmentPanel'
import { AssignmentScoringCard } from '../components/AssignmentScoringCard'
import { AssignmentsToEvaluateCard } from '../components/AssignmentsToEvaluateCard'
import { MemberPanel } from '../components/MemberPanel'
import { RosterImportCard } from '../components/RosterImportCard'
import { RosterTable } from '../components/RosterTable'
import { SetupStepper, type StepState } from '../components/SetupStepper'
import { SetupSummary } from '../components/SetupSummary'
import { Banner, Pill } from '../components/Ui'
import { IconChevronLeft, LogoMark } from '../components/icons'
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
const CAN_MANAGE_ROSTER = ['OWNER', 'CO_TEACHER', 'TA']
const CAN_MANAGE_ASSIGNMENT = ['OWNER', 'CO_TEACHER']
const CAN_MANAGE_MEMBERS = ['OWNER']
const INSTRUCTOR_ROLES = ['OWNER', 'CO_TEACHER', 'TA']

export default function ClassroomDetailPage() {
  const { classroomId = '' } = useParams()

  const [items, setItems] = useState<RosterEntry[]>([])
  const [myRole, setMyRole] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState<AssignmentDraft>(DEFAULT_DRAFT)

  const refresh = useCallback(async () => {
    if (!isSignedIn()) {
      setLoaded(true)
      return
    }
    try {
      // ยิงคู่กันเพราะ /me เป็นตัวเดียวที่บอกได้ว่า *เรา* มี role อะไรในห้องนี้
      // การเดา role จากรายชื่อที่ได้มาไม่ได้ เพราะรายชื่อไม่ได้บอกว่าแถวไหนคือเรา
      const [profile, roster] = await Promise.all([getMe(), getRoster(classroomId)])
      setItems(roster.items)
      setMyRole(profile.classrooms.find((c) => c.classroomId === classroomId)?.role ?? null)
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
      <header className="sticky top-0 z-40 border-b border-edge bg-white/88 shadow-[0_1px_2px_rgba(23,32,51,0.05)] backdrop-blur">
        <nav
          data-testid="main-nav"
          aria-label="เมนูหลัก"
          className="mx-auto flex h-16 max-w-300 items-center gap-4 px-6 max-sm:px-4"
        >
          <Link
            to="/"
            className="flex min-h-11 items-center gap-2.5 font-display text-[19px] font-bold tracking-tight"
          >
            <LogoMark className="size-8" />
            PairEval
          </Link>

          <Link
            to="/classrooms"
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-sand hover:text-ink"
          >
            <IconChevronLeft className="size-4" />
            ห้องเรียนทั้งหมด
          </Link>
        </nav>
      </header>

      <main
        className={`mx-auto max-w-300 px-6 pt-8 max-sm:px-4 ${canManageAssignment ? 'pb-36' : 'pb-16'}`}
      >
        <div className="mb-8 flex flex-wrap items-start gap-x-6 gap-y-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight max-sm:text-2xl">
              จัดการสมาชิกและงานประเมิน
            </h1>
            <p className="mt-1.5 max-w-[62ch] text-muted">
              เพิ่มสมาชิก กำหนดผู้ร่วมสอน และสร้างงานประเมินสำหรับห้องเรียนนี้
            </p>
          </div>

          <span className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-edge bg-white px-4 font-display text-sm font-semibold shadow-[0_1px_2px_rgba(23,32,51,0.05)]">
            <span aria-hidden="true" className="size-2 rounded-full bg-brand-600" />
            สมาชิก <span className="font-mono tabular">{items.length}</span> คน
          </span>
        </div>

        {error && (
          <Banner tone="err" data-testid="error-msg" role="alert" className="mb-6">
            {error}
          </Banner>
        )}

        {isInstructor && <SetupStepper steps={steps} />}

        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
            {canImport && (
              <RosterImportCard
                classroomId={classroomId}
                onImported={refresh}
                onError={setError}
              />
            )}

            <RosterTable
              items={items}
              loaded={loaded}
              canManageMembers={canManageMembers}
              onRemove={handleRemove}
            />

            {/* ทุก role ที่เป็นสมาชิกเห็นได้ — นักศึกษาคือผู้ใช้หลักของการ์ดนี้ (US-07)
                การ์ดซ่อนตัวเองถ้าห้องนี้ยังไม่มีงานประเมินที่เผยแพร่แล้วเลย */}
            {myRole !== null && <AssignmentsToEvaluateCard classroomId={classroomId} />}

            {/* เฉพาะเจ้าของห้อง — ผู้สอนร่วมและ TA เพิ่มคนไม่ได้ตาม role matrix */}
            {canManageMembers && (
              <MemberPanel
                classroomId={classroomId}
                instructors={instructors}
                onChanged={refresh}
              />
            )}

            {/* งานประเมินสร้างได้เฉพาะผู้สอน และต้องมีรายชื่อก่อนถึงจะจัดคู่ได้ */}
            {canManageAssignment && (
              <AssignmentPanel
                classroomId={classroomId}
                draft={draft}
                onDraftChange={setDraft}
                studentCount={students.length}
              />
            )}

            {/* ตัดสินและประกาศคะแนน — เฉพาะเจ้าของห้อง (US-13) */}
            {canFinalizeScores && <AssignmentScoringCard classroomId={classroomId} />}
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

        {!isInstructor && loaded && items.length > 0 && (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted">
            <Pill>นักศึกษา</Pill>
            คุณดูรายชื่อได้อย่างเดียว การจัดการรายชื่อและงานประเมินเป็นสิทธิ์ของผู้สอน
          </p>
        )}
      </main>
    </div>
  )
}
