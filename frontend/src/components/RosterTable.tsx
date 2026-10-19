import { useMemo, useState } from 'react'

import { Avatar, CTRL, FOCUS } from './Ui'
import type { RosterEntry } from '../lib/api'
import { MemberRowActions } from './MemberRowActions'

const PER_PAGE = 20

type Tab = 'ALL' | 'STUDENT' | 'STAFF'

const ROLE_PILL: Record<RosterEntry['role'], { label: string; tone: string }> = {
  OWNER: { label: 'เจ้าของห้อง', tone: 'bg-peach text-accent-ink' },
  CO_TEACHER: { label: 'ผู้สอนร่วม', tone: 'bg-info-soft text-info-ink' },
  TA: { label: 'TA', tone: 'bg-role-ta-soft text-role-ta' },
  STUDENT: { label: 'นักศึกษา', tone: 'bg-ok-50 text-ok-700' },
}

/** รายชื่อสมาชิกทั้งห้อง ตาม Figma J09 / J11 — US-03
 *
 *  ค้นหา กรองบทบาท และแบ่งหน้าทำฝั่ง client เพราะ `/roster` ส่งมาทั้งชุดอยู่แล้ว */
export function RosterTable({
  items,
  loaded,
  canManageMembers,
  onRemove,
  onEnrollment,
  onChangeRole,
  onAddInstructor,
  myEmail,
}: {
  items: RosterEntry[]
  loaded: boolean
  /** เฉพาะ OWNER — role อื่นเรียก endpoint นี้ได้ 403 อยู่แล้ว ซ่อนเมนูเพื่อไม่ให้กดแล้วพังเสมอ */
  canManageMembers: boolean
  onEnrollment?: (entry: RosterEntry) => void
  onRemove: (entry: RosterEntry) => void
  onChangeRole?: (entry: RosterEntry) => void
  onAddInstructor?: () => void
  myEmail?: string
}) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('ALL')
  const [page, setPage] = useState(1)

  const students = items.filter((m) => m.role === 'STUDENT')
  const staff = items.filter((m) => m.role !== 'STUDENT')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    // เจ้าของห้องและทีมผู้สอนอยู่บนสุดตามแบบ แล้วตามด้วยนักศึกษาเรียงตามกลุ่ม
    const order = { OWNER: 0, CO_TEACHER: 1, TA: 2, STUDENT: 3 }
    return items
      .filter((m) => tab === 'ALL' || (tab === 'STUDENT' ? m.role === 'STUDENT' : m.role !== 'STUDENT'))
      .filter((m) => !q || [m.displayName ?? '', m.email, m.groupName ?? ''].join(' ').toLowerCase().includes(q))
      .sort(
        (a, b) =>
          order[a.role] - order[b.role] ||
          (a.groupName ?? '').localeCompare(b.groupName ?? '') ||
          (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email, 'th'),
      )
  }, [items, query, tab])

  const pageCount = Math.max(1, Math.ceil(visible.length / PER_PAGE))
  const current = Math.min(page, pageCount)
  const rows = visible.slice((current - 1) * PER_PAGE, current * PER_PAGE)
  const tabLabel =
    tab === 'STAFF' ? 'แสดงทีมผู้สอน' : tab === 'STUDENT' ? 'แสดงนักศึกษา' : `แสดง ${rows.length} จาก ${visible.length}`

  const chip = (value: Tab, label: string, count: number) => (
    <button
      key={value}
      type="button"
      aria-pressed={tab === value}
      onClick={() => {
        setTab(value)
        setPage(1)
      }}
      className={`min-h-10.5 rounded-full border px-4 font-display text-[14.5px] font-semibold ${FOCUS} ${tab === value ? 'border-brand-600 bg-accent-soft text-accent-ink' : 'border-edge bg-white text-ink'}`}
    >
      {label} {count}
    </button>
  )

  return (
    <section aria-labelledby="h-roster" className="overflow-hidden rounded-3xl border border-edge bg-white">
      <div className="border-b border-edge bg-surface-cream px-5 py-4.5">
        <h2 id="h-roster" className="font-display text-[17px] leading-6.5 font-semibold">
          สมาชิกในห้องเรียน
        </h2>
        <p className="mt-1 text-[14px] leading-5 text-ink-2">
          {students.length > 0 ? (
            <span data-testid="student-count">
              {items.length} คน · นักศึกษา {students.length} · ทีมผู้สอน {staff.length} · {tabLabel}
            </span>
          ) : (
            // Figma J06 — ห้องที่ยังไม่มีนักศึกษายังแสดงทีมผู้สอนพร้อมตัวกรองตามปกติ
            `${items.length} คน · ยังไม่มีนักศึกษา — นำเข้า CSV ด้านบน`
          )}
        </p>
      </div>

      {loaded && items.length === 0 ? (
        <div data-testid="roster-empty" className="px-6 py-10 text-center text-[15px] text-muted">
          <p className="font-display font-semibold text-ink">ยังไม่มีรายชื่อในห้องเรียนนี้</p>
          <p className="mt-2">นำเข้าไฟล์ CSV ที่มีคอลัมน์ email และ group_name เพื่อเพิ่มนักศึกษาทั้งห้องพร้อมกัน</p>
          {onAddInstructor && (
            <button
              type="button"
              onClick={onAddInstructor}
              className={`mt-4 min-h-10 rounded-full border border-brand-600 px-5 font-display text-[14.5px] font-semibold text-accent-ink ${FOCUS}`}
            >
              + เพิ่มผู้สอน
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2.5 border-b border-edge px-5 py-3.5">
            <div role="group" aria-label="กรองสมาชิก" className="flex flex-wrap gap-1.5">
              {chip('ALL', 'ทั้งหมด', items.length)}
              {chip('STUDENT', 'นักศึกษา', students.length)}
              {chip('STAFF', 'ทีมผู้สอน', staff.length)}
            </div>
            <div className="w-75 max-w-full">
              <label className="sr-only" htmlFor="roster-search">
                ค้นหาสมาชิก
              </label>
              <input
                id="roster-search"
                type="search"
                autoComplete="off"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder="ค้นหาชื่อหรืออีเมล"
                className={`${CTRL} min-h-11`}
              />
            </div>
            {onAddInstructor && (
              <button
                type="button"
                onClick={onAddInstructor}
                className={`ml-auto min-h-10 rounded-full border border-brand-600 bg-white px-6 font-display text-[14.5px] font-semibold text-accent-ink hover:bg-accent-soft ${FOCUS}`}
              >
                + เพิ่มผู้สอน
              </button>
            )}
          </div>

          <ul data-testid="roster-list" aria-label="รายชื่อสมาชิกในห้องเรียน" className="divide-y divide-edge">
            {rows.map((m) => {
              const role = ROLE_PILL[m.role]
              const withdrawn = m.enrollmentStatus === 'WITHDRAWN'
              return (
                <li key={m.memberId} className="flex min-h-17.5 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <Avatar name={m.displayName ?? m.email} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] ${withdrawn ? 'text-muted line-through' : ''}`}>
                      {m.displayName ?? m.email}
                      {m.email === myEmail ? ' (คุณ)' : ''}
                    </p>
                    <p className="truncate text-[13px] text-muted">{m.email}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 font-display text-[13px] font-semibold ${role.tone}`}>
                    {role.label}
                    {m.role === 'STUDENT' && m.groupName ? ` · ${m.groupName}` : ''}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 font-display text-[13px] font-semibold ${withdrawn ? 'bg-err-soft text-err' : m.status === 'ACTIVE' ? 'bg-ok-50 text-ok-700' : m.status === 'DISABLED' ? 'bg-err-soft text-err' : 'bg-neutral-soft text-ink-2'}`}
                  >
                    {withdrawn
                      ? 'ถอนรายวิชา'
                      : m.status === 'ACTIVE'
                        ? 'ใช้งานอยู่'
                        : m.status === 'DISABLED'
                          ? 'ถูกระงับ'
                          : 'ไม่เคยเข้าสู่ระบบ'}
                  </span>
                  <span className="w-9">
                    <MemberRowActions
                      member={m}
                      canRemove={canManageMembers}
                      onRemove={onRemove}
                      onEnrollment={onEnrollment}
                      onChangeRole={onChangeRole}
                    />
                  </span>
                </li>
              )
            })}
            {rows.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-muted">ไม่พบสมาชิกที่ตรงกับ “{query}”</li>
            )}
          </ul>

          {pageCount > 1 && (
            <nav
              aria-label="แบ่งหน้ารายชื่อ"
              className="flex flex-wrap justify-end gap-2 border-t border-edge px-5 py-3"
            >
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === current ? 'page' : undefined}
                  className={`min-h-10 min-w-10 rounded-lg border px-3 font-mono text-[13.5px] ${FOCUS} ${n === current ? 'border-cta bg-cta text-white' : 'border-edge bg-white text-ink-2 hover:bg-sand'}`}
                >
                  {n}
                </button>
              ))}
            </nav>
          )}
        </>
      )}
    </section>
  )
}
