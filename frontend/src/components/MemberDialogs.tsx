import { useState } from 'react'
import { useModal } from './useModal'

import { ApiError, type InstructorRole, type RosterEntry, addMember, changeMemberRole } from '../lib/api'
import { CTRL, btn } from './Ui'

/** ตรวจแค่ว่า "มีชื่อ @ โดเมน.สกุล" ส่วนการตัดสินขั้นสุดท้ายเป็นของ server */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const ROLE_CHOICES: { value: InstructorRole; label: string; hint: string }[] = [
  {
    value: 'CO_TEACHER',
    label: 'ผู้สอนร่วม',
    hint: 'จัดการรายชื่อ สร้างงาน ดูรายงาน และประเมินเองได้ · ประกาศผล เพิ่มผู้สอน และดูตัวตนผู้ประเมินไม่ได้',
  },
  { value: 'TA', label: 'TA', hint: 'ดูแลรายชื่อนักศึกษาเท่านั้น · ไม่เห็นงานประเมินหรือคะแนน' },
]


function RolePicker({
  value,
  onChange,
  name,
}: {
  value: InstructorRole
  onChange: (role: InstructorRole) => void
  name: string
}) {
  return (
    <div role="radiogroup" aria-label="บทบาท" className="mt-2 space-y-2.5">
      {ROLE_CHOICES.map((choice) => {
        const checked = value === choice.value
        return (
          <label
            key={choice.value}
            className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 ${checked ? 'border-info-ink bg-info-soft' : 'border-edge bg-white'}`}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={checked}
              onChange={() => onChange(choice.value)}
              className="mt-1 size-4.5 accent-info-ink"
            />
            <span>
              <span className={`block font-display text-[15px] font-semibold ${checked ? 'text-info-ink' : ''}`}>
                {choice.label}
              </span>
              <span className="mt-0.5 block text-[13px] leading-5 text-ink-2">{choice.hint}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

/** Figma J10 · เพิ่มผู้สอน · กรอกอีเมล + เลือกบทบาท (J10b error เมื่ออีเมลเป็นนักศึกษาในห้องนี้) */
export function AddInstructorDialog({
  classroomId,
  classroomName,
  domain,
  onClose,
  onAdded,
}: {
  classroomId: string
  classroomName: string
  domain: string | null
  onClose: () => void
  onAdded: (notice: { title: string; body: string }) => Promise<void> | void
}) {
  const ref = useModal()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InstructorRole>('CO_TEACHER')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = email.trim()
  const valid = EMAIL_RE.test(trimmed)
  const inDomain = !domain || trimmed.toLowerCase().endsWith(`@${domain}`)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await addMember(classroomId, { email: trimmed, role })
      const label = role === 'TA' ? 'TA' : 'ผู้สอนร่วม'
      await onAdded({
        title: `เพิ่ม ${trimmed} เป็น${label}แล้ว`,
        body: `${trimmed} (${label}) จะเข้าห้องได้เมื่อ login ด้วยอีเมลนั้น`,
      })
      ref.current?.close()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เพิ่มผู้สอนไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="add-instructor-title"
      data-testid="member-panel"
      onClose={onClose}
      className="fixed inset-0 m-auto max-h-[94dvh] w-[calc(100vw-2rem)] max-w-135 overflow-y-auto rounded-3xl bg-white p-7 text-ink shadow-xl backdrop:bg-ink/40"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) void submit()
        }}
      >
        <h2 id="add-instructor-title" className="font-display text-[22px] font-bold">
          เพิ่มผู้สอนในห้องนี้
        </h2>
        <p className="mt-2 text-[14px] text-muted">{classroomName}</p>
        <label htmlFor="instructor-email" className="mt-5 block font-display text-[14.5px] font-semibold">
          อีเมล
        </label>
        <input
          id="instructor-email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setError(null)
          }}
          placeholder={domain ? `name@${domain}` : 'name@university.ac.th'}
          aria-invalid={Boolean(error) || (trimmed.length > 0 && !valid)}
          className={`${CTRL} mt-2 min-h-12.5`}
        />
        {error ? (
          <p role="alert" data-testid="member-error" className="mt-2 text-[13px] text-err">
            ✕ {error}
          </p>
        ) : valid && inDomain ? (
          <p className="mt-2 text-[13px] text-ok-700">
            √ อยู่ในโดเมน {domain ?? trimmed.split('@')[1]} · ตรวจซ้ำกับรายชื่อห้องตอนกดเพิ่ม
          </p>
        ) : trimmed.length > 0 ? (
          <p className="mt-2 text-[13px] text-err">
            {valid ? `อีเมลต้องอยู่ในโดเมน ${domain}` : 'รูปแบบอีเมลไม่ถูกต้อง'}
          </p>
        ) : null}

        <p className="mt-5 font-display text-[14.5px] font-semibold">บทบาท</p>
        <RolePicker value={role} onChange={setRole} name="new-instructor-role" />

        <p className="mt-4 text-[12px] text-muted">
          ถ้ายังไม่เคย login จะขึ้น "ไม่เคยเข้าสู่ระบบ" · การเพิ่มและเปลี่ยนบทบาทถูกบันทึก audit
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className={btn('ghost', 'md', 'border-brand-600 px-6 text-accent-ink')}
          >
            ยกเลิก
          </button>
          <button type="submit" disabled={busy || !valid || !inDomain} className={btn('primary', 'md', 'px-6')}>
            {busy ? 'กำลังเพิ่ม…' : role === 'TA' ? 'เพิ่มเป็น TA' : 'เพิ่มเป็นผู้สอนร่วม'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

/** Figma J11b · แก้ไขบทบาทผู้สอนร่วม ↔ TA (บังคับเหตุผลตาม audit) */
export function RoleChangeDialog({
  classroomId,
  member,
  onClose,
  onChanged,
}: {
  classroomId: string
  member: RosterEntry
  onClose: () => void
  onChanged: (notice: { title: string; body: string }) => Promise<void> | void
}) {
  const ref = useModal()
  const [role, setRole] = useState<InstructorRole>(member.role === 'TA' ? 'TA' : 'CO_TEACHER')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = member.displayName ?? member.email

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await changeMemberRole(classroomId, member.memberId, role, reason.trim())
      await onChanged({
        title: `เปลี่ยน ${name} เป็น${role === 'TA' ? ' TA' : 'ผู้สอนร่วม'}แล้ว`,
        body: 'สิทธิ์ใหม่มีผลทันที · บันทึก audit แล้ว',
      })
      ref.current?.close()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เปลี่ยนบทบาทไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="role-change-title"
      onClose={onClose}
      className="fixed inset-0 m-auto max-h-[94dvh] w-[calc(100vw-2rem)] max-w-135 overflow-y-auto rounded-3xl bg-white p-7 text-ink shadow-xl backdrop:bg-ink/40"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <h2 id="role-change-title" className="font-display text-[22px] font-bold">
          แก้ไขบทบาท {name}
        </h2>
        <p className="mt-2 text-[14px] text-muted">
          {member.email} · ตอนนี้: {member.role === 'TA' ? 'TA' : 'ผู้สอนร่วม'}
        </p>
        <p className="mt-5 font-display text-[14.5px] font-semibold">บทบาทใหม่</p>
        <RolePicker value={role} onChange={setRole} name="changed-role" />
        <label className="mt-5 block font-display text-[14.5px] font-semibold">
          เหตุผล
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            maxLength={2000}
            className={`${CTRL} mt-2 min-h-20 font-body font-normal`}
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-err">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2.5">
          <button type="button" onClick={() => ref.current?.close()} className={btn('ghost', 'md', 'px-6')}>
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={busy || !reason.trim() || role === member.role}
            className={btn('primary', 'md', 'px-6')}
          >
            {busy ? 'กำลังบันทึก…' : 'บันทึกบทบาท'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

/** Figma J11c / K04 · ยืนยันถอดผู้สอนร่วมหรือ TA ออกจากห้อง */
export function RemoveMemberDialog({
  member,
  onClose,
  onConfirm,
}: {
  member: RosterEntry
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const ref = useModal()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = member.displayName ?? member.email
  const role = member.role === 'TA' ? 'TA' : 'ผู้สอนร่วม'

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      ref.current?.close()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ถอดสมาชิกไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="remove-member-title"
      data-testid="remove-member-dialog"
      onClose={onClose}
      className="fixed inset-0 m-auto w-[calc(100vw-2rem)] max-w-96 rounded-3xl bg-white p-6 text-ink shadow-xl backdrop:bg-ink/40"
    >
      <h2 id="remove-member-title" className="font-display text-[19px] font-bold">
        ถอด {name} ออกจากห้อง?
      </h2>
      <p className="mt-1 text-[12.5px] text-muted">
        {member.email} · {role}
      </p>
      <div className="mt-4 rounded-2xl bg-info-soft px-4 py-3 text-[12.5px] text-info-ink">
        <p className="font-semibold">{name} จะเข้าห้องนี้ไม่ได้อีก</p>
        <p className="mt-0.5">คำตอบที่เคยประเมินเองยังอยู่ในการคำนวณ · บันทึก audit</p>
      </div>
      <p className="mt-3 text-[11.5px] text-muted">เจ้าของห้องคนสุดท้ายถอดไม่ได้ · แถวของเจ้าของห้องจึงไม่มีเมนู ···</p>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-err">
          ✕ {error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2.5">
        <button type="button" onClick={() => ref.current?.close()} className={btn('ghost', 'md', 'px-6')}>
          ยกเลิก
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className={btn('ghost', 'md', 'border-line-neutral px-6 text-err')}
        >
          {busy ? 'กำลังถอด…' : 'ถอดออกจากห้อง'}
        </button>
      </div>
    </dialog>
  )
}
