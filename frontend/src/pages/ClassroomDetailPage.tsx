import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AssignmentPanel } from '../components/AssignmentPanel'
import { LogoMark } from '../components/icons'
import {
  ApiError,
  type ApiRowError,
  type RosterEntry,
  type RosterImportResult,
  getMe,
  getRoster,
  importRoster,
} from '../lib/api'
import { clearToken, isSignedIn } from '../lib/session'

// ต้องตรงกับ role matrix ฝั่ง server ใน backend/app/domain/access.py
// หน้าจอที่ซ่อนปุ่มไม่ใช่การกันสิทธิ์ — server กันอยู่แล้ว — แต่ถ้าสองฝั่งไม่ตรงกัน
// TA จะเห็นปุ่มที่กดแล้วได้ 403 เสมอ ซึ่งดูเหมือนระบบพังมากกว่าดูเหมือนกฎ
const CAN_MANAGE_ROSTER = ['OWNER', 'CO_TEACHER', 'TA']
const CAN_MANAGE_ASSIGNMENT = ['OWNER', 'CO_TEACHER']

const ROLE_LABEL: Record<RosterEntry['role'], string> = {
  OWNER: 'เจ้าของห้อง',
  CO_TEACHER: 'ผู้สอนร่วม',
  TA: 'ผู้ช่วยสอน',
  STUDENT: 'นักศึกษา',
}

const STATUS_LABEL: Record<RosterEntry['status'], string> = {
  PENDING: 'ยังไม่เคยเข้าระบบ',
  ACTIVE: 'ใช้งานอยู่',
  DISABLED: 'ถูกระงับ',
}

export default function ClassroomDetailPage() {
  const { classroomId = '' } = useParams()

  const [items, setItems] = useState<RosterEntry[]>([])
  const [myRole, setMyRole] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<ApiRowError[]>([])
  const [result, setResult] = useState<RosterImportResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const fileInput = useRef<HTMLInputElement>(null)

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

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    const file = fileInput.current?.files?.[0]
    if (!file) {
      setError('เลือกไฟล์ CSV ก่อน')
      return
    }

    setUploading(true)
    setError(null)
    setRowErrors([])
    setResult(null)

    try {
      setResult(await importRoster(classroomId, file))
      await refresh()
      if (fileInput.current) fileInput.current.value = ''
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        // แสดงทุกแถวที่ผิด ไม่ใช่แค่แถวแรก — คนแก้ไฟล์จะได้แก้ทีเดียวจบ (R2)
        setRowErrors(err.details)
      } else {
        setError('นำเข้ารายชื่อไม่สำเร็จ')
      }
    } finally {
      setUploading(false)
    }
  }

  const students = items.filter((m) => m.role === 'STUDENT')
  const canImport = myRole !== null && CAN_MANAGE_ROSTER.includes(myRole)
  const canManageAssignment = myRole !== null && CAN_MANAGE_ASSIGNMENT.includes(myRole)

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-line bg-white">
        <nav
          data-testid="main-nav"
          aria-label="เมนูหลัก"
          className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3.5"
        >
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <LogoMark className="size-7" />
            PairEval
          </Link>
          <Link to="/classrooms" className="ml-auto text-sm text-muted hover:text-ink">
            ← ห้องเรียนทั้งหมด
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">รายชื่อในห้องเรียน</h1>

        {error && (
          <p
            data-testid="error-msg"
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {rowErrors.length > 0 && (
          <div
            data-testid="row-errors"
            className="mt-3 rounded-lg border border-red-200 bg-white p-4"
          >
            <p className="text-sm font-medium text-red-700">
              ไม่มีแถวใดถูกบันทึก — แก้ {rowErrors.length} แถวนี้แล้วอัปโหลดใหม่
            </p>
            <ul className="mt-2 space-y-1 text-sm text-red-700">
              {rowErrors.map((e) => (
                <li key={`${e.row}-${e.reason}`}>
                  <span className="font-mono">แถว {e.row}</span> — {e.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result && (
          <div
            data-testid="import-result"
            role="status"
            className="mt-4 rounded-lg border border-ok-500 bg-ok-50 px-4 py-2.5 text-sm text-ok-600"
          >
            นำเข้าสำเร็จ {result.imported} คน · {result.groupsCreated} กลุ่ม
            {result.warnings.length > 0 && (
              <ul data-testid="import-warnings" className="mt-2 list-disc pl-5 text-ink">
                {result.warnings.map((w) => (
                  <li key={w.message}>{w.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {canImport && (
          <form
            onSubmit={handleUpload}
            data-testid="roster-import"
            className="mt-6 rounded-xl border border-line bg-white p-6"
          >
            <h2 className="text-lg font-semibold">นำเข้ารายชื่อจาก CSV</h2>
            <p className="mt-1 text-sm text-muted">
              ต้องมี column <code>email</code> และ <code>group_name</code> (ไม่สนตัวพิมพ์เล็กใหญ่)
              · ไฟล์ใหม่จะแทนที่รายชื่อนักศึกษาทั้งชุด
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label htmlFor="roster-file" className="sr-only">
                ไฟล์รายชื่อ CSV
              </label>
              <input
                id="roster-file"
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-cream file:px-3 file:py-1.5 file:text-sm"
              />
              <button
                type="submit"
                disabled={uploading}
                className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? 'กำลังนำเข้า…' : 'นำเข้ารายชื่อ'}
              </button>
            </div>
          </form>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-semibold">สมาชิก {items.length} คน</h2>

          {loaded && items.length === 0 ? (
            <p data-testid="roster-empty" className="mt-3 text-sm text-muted">
              ยังไม่มีรายชื่อในห้องเรียนนี้
            </p>
          ) : (
            <ul data-testid="roster-list" className="mt-3 space-y-2">
              {items.map((m) => (
                <li
                  key={m.userId}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white px-4 py-3"
                >
                  <span className="font-medium">{m.displayName ?? m.email}</span>
                  {m.displayName && <span className="text-xs text-muted">{m.email}</span>}
                  {m.groupName && (
                    <span className="rounded bg-cream px-2 py-0.5 text-xs">{m.groupName}</span>
                  )}
                  <span className="ml-auto text-xs text-muted">{ROLE_LABEL[m.role]}</span>
                  <span className="text-xs text-muted">· {STATUS_LABEL[m.status]}</span>
                </li>
              ))}
            </ul>
          )}

          {students.length > 0 && (
            <p data-testid="student-count" className="mt-3 text-sm text-muted">
              นักศึกษา {students.length} คน ใน{' '}
              {new Set(students.map((s) => s.groupName)).size} กลุ่ม
            </p>
          )}
        </section>

        {/* งานประเมินสร้างได้เฉพาะผู้สอน และต้องมีรายชื่อก่อนถึงจะจัดคู่ได้ */}
        {canManageAssignment && <AssignmentPanel classroomId={classroomId} />}
      </main>
    </div>
  )
}
