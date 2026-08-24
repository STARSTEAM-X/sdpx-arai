import { useState } from 'react'

import {
  Avatar,
  Banner,
  CTRL,
  Card,
  CardHead,
  FieldError,
  RolePill,
  Spinner,
  StatusPill,
  btn,
} from './Ui'
import { IconTeach } from './icons'
import {
  ApiError,
  type InstructorRole,
  type RosterEntry,
  addMember,
  removeMember,
} from '../lib/api'

const ROLE_OPTIONS: { value: InstructorRole; label: string; hint: string }[] = [
  {
    value: 'CO_TEACHER',
    label: 'ผู้สอนร่วม',
    hint: 'จัดการรายชื่อและงานประเมินได้ แต่ตัดสินคะแนนสุดท้ายไม่ได้',
  },
  { value: 'TA', label: 'ผู้ช่วยสอน', hint: 'ดูแลรายชื่อได้อย่างเดียว สร้างงานประเมินไม่ได้' },
]

/** ตรวจแค่ว่า "มีชื่อ @ โดเมน.สกุล" — ไม่พยายามทำ RFC 5322 ให้ครบ
 *  เพราะ regex ที่ครบจริงยาวเป็นบรรทัดและยังตัดสินไม่ได้อยู่ดีว่ากล่องนั้นมีอยู่จริงไหม
 *  หน้าที่ตรงนี้คือกันพิมพ์ผิดชัด ๆ ส่วนการตัดสินขั้นสุดท้ายเป็นของ server */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

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
  const [touched, setTouched] = useState(false)
  const [role, setRole] = useState<InstructorRole>('CO_TEACHER')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const owners = instructors.filter((m) => m.role === 'OWNER')
  const emailOk = EMAIL_RE.test(email.trim())
  const showEmailError = touched && email.trim().length > 0 && !emailOk

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
    setTouched(true)
    if (!emailOk) return

    void run(async () => {
      await addMember(classroomId, { email: email.trim(), role })
      setEmail('')
      setTouched(false)
    }, `เพิ่ม ${email.trim()} เรียบร้อย`)
  }

  return (
    <Card data-testid="member-panel" aria-labelledby="h-staff">
      <CardHead
        id="h-staff"
        icon={<IconTeach className="size-5" />}
        title="ผู้ร่วมสอนและผู้ช่วยสอน"
        hint="เพิ่มได้แม้เขายังไม่เคยเข้าระบบ ระบบจะจับคู่บัญชีให้เองตอนเขาเข้าครั้งแรก"
      />

      <div className="p-6 max-sm:p-4">
        {error && (
          <Banner tone="err" data-testid="member-error" role="alert" className="mb-5">
            {error}
          </Banner>
        )}

        {notice && (
          <Banner tone="ok" data-testid="member-notice" role="status" className="mb-5">
            {notice}
          </Banner>
        )}

        <form
          onSubmit={handleAdd}
          noValidate
          className="grid items-start gap-4 sm:grid-cols-[2fr_1fr_auto]"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="member-email" className="font-display text-sm font-semibold">
              อีเมล
            </label>
            <input
              id="member-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              aria-invalid={showEmailError}
              aria-describedby={showEmailError ? 'member-email-error' : undefined}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="somsak@kmitl.ac.th"
              className={CTRL}
            />
            {showEmailError && (
              <FieldError id="member-email-error">
                รูปแบบอีเมลไม่ถูกต้อง — ต้องเป็นแบบ ชื่อ@โดเมน เช่น somsak@kmitl.ac.th
              </FieldError>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="member-role" className="font-display text-sm font-semibold">
              บทบาท
            </label>
            <select
              id="member-role"
              value={role}
              onChange={(e) => setRole(e.target.value as InstructorRole)}
              className={CTRL}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-[12.5px] text-muted">
              {ROLE_OPTIONS.find((o) => o.value === role)?.hint}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span aria-hidden="true" className="invisible font-display text-sm font-semibold">
              เพิ่ม
            </span>
            <button
              type="submit"
              disabled={busy || !emailOk}
              className={btn('primary', 'md', 'max-sm:w-full')}
            >
              {busy && <Spinner />}
              {busy ? 'กำลังทำงาน…' : 'เพิ่ม'}
            </button>
          </div>
        </form>

        <ul data-testid="instructor-list" className="mt-5 flex list-none flex-col gap-2 p-0">
          {instructors.map((m) => {
            // เจ้าของห้องคนสุดท้ายถอดไม่ได้ — server ตอบ 409 LAST_OWNER อยู่แล้ว
            // ปิดปุ่มไว้ด้วยเพื่อไม่ให้กดแล้วเจอ error ที่คาดเดาได้ตั้งแต่แรก
            const isLastOwner = m.role === 'OWNER' && owners.length <= 1

            return (
              <li
                key={m.memberId}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-edge px-3.5 py-2.5 hover:bg-sand"
              >
                <Avatar name={m.displayName ?? m.email} muted={m.role !== 'OWNER'} />
                <span className="min-w-40 flex-1">
                  <span className="block truncate font-display text-sm font-semibold">
                    {m.displayName ?? m.email}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted">{m.email}</span>
                </span>

                <RolePill role={m.role} />
                <StatusPill status={m.status} />

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
                  className={btn('ghost', 'sm')}
                >
                  ถอดออก
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </Card>
  )
}
