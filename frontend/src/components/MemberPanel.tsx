import { useState } from 'react'

import {
  ApiError,
  type InstructorRole,
  type RosterEntry,
  addMember,
  removeMember,
} from '../lib/api'

const ROLE_OPTIONS: { value: InstructorRole; label: string; hint: string }[] = [
  { value: 'CO_TEACHER', label: 'ผู้สอนร่วม', hint: 'จัดการรายชื่อและงานประเมินได้ แต่ตัดสินคะแนนสุดท้ายไม่ได้' },
  { value: 'TA', label: 'ผู้ช่วยสอน', hint: 'ดูแลรายชื่อได้อย่างเดียว สร้างงานประเมินไม่ได้' },
]

/** เพิ่มและถอดผู้ร่วมสอนกับ TA — US-12
 *
 *  แสดงเฉพาะ OWNER · role อื่นเรียก endpoint นี้ได้ 403 อยู่แล้ว
 *  การซ่อนตรงนี้จึงไม่ใช่การกันสิทธิ์ แต่กันไม่ให้เห็นปุ่มที่กดแล้วพังเสมอ
 */
export function MemberPanel({
  classroomId,
  instructors,
  onChanged,
}: {
  classroomId: string
  /** สมาชิกฝั่งผู้สอนที่มีอยู่ — ส่งมาจากหน้าแม่เพื่อไม่ต้องยิง roster ซ้ำ */
  instructors: RosterEntry[]
  onChanged: () => Promise<void> | void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InstructorRole>('CO_TEACHER')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const owners = instructors.filter((m) => m.role === 'OWNER')

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      setNotice(success)
      await onChanged()
    } catch (err) {
      // ข้อความจาก API บอกเหตุผลเป็นรูปธรรมอยู่แล้ว เช่นบอกว่าเขาเป็น role อะไรอยู่
      // หรือ domain ไหนที่ห้องนี้รับ — เขียนข้อความเองจะสูญเสียรายละเอียดนั้นไป
      setError(err instanceof ApiError ? err.message : 'ทำรายการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    void run(async () => {
      await addMember(classroomId, { email, role })
      setEmail('')
    }, `เพิ่ม ${email} เรียบร้อย`)
  }

  return (
    <section
      data-testid="member-panel"
      className="mt-8 rounded-xl border border-line bg-white p-6"
    >
      <h2 className="text-lg font-semibold">ผู้ร่วมสอนและผู้ช่วยสอน</h2>
      <p className="mt-1 text-sm text-muted">
        เพิ่มได้แม้เขายังไม่เคยเข้าระบบ — ระบบจะจับคู่ให้เองตอนเขาเข้าครั้งแรก
      </p>

      {error && (
        <p
          data-testid="member-error"
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          data-testid="member-notice"
          role="status"
          className="mt-4 rounded-lg border border-ok-500 bg-ok-50 px-4 py-2.5 text-sm text-ok-600"
        >
          {notice}
        </p>
      )}

      <form onSubmit={handleAdd} className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="member-email" className="block text-sm font-medium">
            อีเมล
          </label>
          <input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="somsak@kmitl.ac.th"
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <label htmlFor="member-role" className="block text-sm font-medium">
            บทบาท
          </label>
          <select
            id="member-role"
            value={role}
            onChange={(e) => setRole(e.target.value as InstructorRole)}
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-500"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'กำลังทำงาน…' : 'เพิ่ม'}
        </button>
      </form>

      <p className="mt-2 text-xs text-muted">
        {ROLE_OPTIONS.find((o) => o.value === role)?.hint}
      </p>

      <ul data-testid="instructor-list" className="mt-5 space-y-2">
        {instructors.map((m) => {
          // เจ้าของห้องคนสุดท้ายถอดไม่ได้ — server ตอบ 409 LAST_OWNER อยู่แล้ว
          // ปิดปุ่มไว้ด้วยเพื่อไม่ให้กดแล้วเจอ error ที่คาดเดาได้ตั้งแต่แรก
          const isLastOwner = m.role === 'OWNER' && owners.length <= 1

          return (
            <li
              key={m.memberId}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-2.5 text-sm"
            >
              <span className="font-medium">{m.displayName ?? m.email}</span>
              {m.displayName && <span className="text-xs text-muted">{m.email}</span>}
              {m.status === 'PENDING' && (
                <span className="rounded bg-cream px-2 py-0.5 text-xs">ยังไม่เคยเข้าระบบ</span>
              )}
              <span className="ml-auto text-xs text-muted">
                {m.role === 'OWNER' ? 'เจ้าของห้อง' : m.role === 'CO_TEACHER' ? 'ผู้สอนร่วม' : 'ผู้ช่วยสอน'}
              </span>

              <button
                type="button"
                disabled={busy || isLastOwner}
                title={isLastOwner ? 'ถอดเจ้าของห้องคนสุดท้ายไม่ได้' : undefined}
                onClick={() =>
                  void run(
                    () => removeMember(classroomId, m.memberId),
                    `ถอด ${m.email} ออกจากห้องแล้ว`,
                  )
                }
                className="rounded-lg border border-line px-3 py-1 text-xs transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
              >
                ถอดออก
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
