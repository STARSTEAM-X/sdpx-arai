import { useEffect, useMemo, useState } from 'react'

import { Avatar, Card, CardHead, FOCUS, Pill, RolePill, StatusPill } from './Ui'
import { IconDots, IconRoster, IconSearch, IconUserMinus, IconUserPlus } from './icons'
import type { RosterEntry } from '../lib/api'

const PER_PAGE = 10

/** รายชื่อสมาชิกทั้งห้อง — US-03
 *
 *  ค้นหาและแบ่งหน้าทำฝั่ง client ทั้งคู่ เพราะ endpoint `/roster` ส่งมาทั้งชุดอยู่แล้ว
 *  และห้องเรียนหนึ่งมีหลักร้อยคนเป็นอย่างมาก การยิง API ใหม่ทุกครั้งที่พิมพ์
 *  จะช้ากว่าเดิมโดยไม่ได้อะไรกลับมา ถ้าวันหนึ่งห้องใหญ่กว่านี้จริงค่อยย้ายไปฝั่ง server
 */
export function RosterTable({
  items,
  loaded,
  canManageMembers,
  onRemove,
}: {
  items: RosterEntry[]
  loaded: boolean
  /** เฉพาะ OWNER — role อื่นเรียก endpoint นี้ได้ 403 อยู่แล้ว ซ่อนเมนูเพื่อไม่ให้กดแล้วพังเสมอ */
  canManageMembers: boolean
  onRemove: (entry: RosterEntry) => void
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((m) =>
      [m.displayName ?? '', m.email, m.groupName ?? ''].join(' ').toLowerCase().includes(q),
    )
  }, [items, query])

  const pageCount = Math.max(1, Math.ceil(visible.length / PER_PAGE))
  const current = Math.min(page, pageCount)
  const rows = visible.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  const students = items.filter((m) => m.role === 'STUDENT')
  const groupCount = new Set(students.map((s) => s.groupName)).size

  // ปิดเมนูเมื่อคลิกที่อื่นหรือกด Escape — เมนูลอยที่ปิดไม่ลงคือเมนูที่บังปุ่มอื่น
  useEffect(() => {
    if (openMenu === null) return
    const close = () => setOpenMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenu])

  return (
    <Card aria-labelledby="h-roster">
      <CardHead
        id="h-roster"
        icon={<IconRoster className="size-5" />}
        title="รายชื่อสมาชิก"
        badge={<Pill>{items.length} คน</Pill>}
        hint={
          students.length > 0 ? (
            <span data-testid="student-count">
              นักศึกษา <span className="font-mono tabular">{students.length}</span> คน ใน{' '}
              <span className="font-mono tabular">{groupCount}</span> กลุ่ม · ผู้สอน{' '}
              <span className="font-mono tabular">{items.length - students.length}</span> คน
            </span>
          ) : (
            'ยังไม่มีนักศึกษาในห้อง — นำเข้าไฟล์ CSV เพื่อเริ่มต้น'
          )
        }
      />

      <div className="p-6 max-sm:p-4">
        {loaded && items.length === 0 ? (
          <div
            data-testid="roster-empty"
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-edge-strong bg-ground px-6 py-10 text-center"
          >
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-2xl border border-edge bg-sand text-muted"
            >
              <IconUserPlus className="size-5" />
            </span>
            <span className="font-display text-[15.5px] font-semibold">
              ยังไม่มีรายชื่อในห้องเรียนนี้
            </span>
            <p className="max-w-[44ch] text-sm text-muted">
              นำเข้าไฟล์ CSV ที่มีคอลัมน์ email และ group_name เพื่อเพิ่มนักศึกษาทั้งห้องพร้อมกัน
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-55 flex-1">
                <IconSearch
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
                />
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
                  placeholder="ค้นหาจากชื่อ อีเมล หรือกลุ่ม"
                  className={
                    'min-h-11 w-full rounded-xl border border-edge-strong bg-white py-2.5 pr-3.5 pl-10 ' +
                    'outline-none transition-colors hover:border-muted focus:border-brand-600 focus:ring-3 focus:ring-accent-soft'
                  }
                />
              </div>
            </div>

            {/* ตารางกว้างกว่าจอมือถือเสมอ — ให้เลื่อนในกล่องตัวเอง ไม่ใช่ให้ทั้งหน้าเลื่อนตามขวาง */}
            <div className="overflow-x-auto rounded-xl border border-edge">
              <table data-testid="roster-list" className="w-full min-w-160 border-collapse">
                <caption className="sr-only">ตารางรายชื่อสมาชิกในห้องเรียน</caption>
                <thead>
                  <tr>
                    {['สมาชิก', 'กลุ่ม', 'บทบาท', 'สถานะ'].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="border-b border-edge bg-sand px-4 py-3 text-left font-display text-[12.5px] font-semibold tracking-wider text-ink-2 uppercase"
                      >
                        {h}
                      </th>
                    ))}
                    <th scope="col" className="border-b border-edge bg-sand px-4 py-3">
                      <span className="sr-only">จัดการ</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.memberId} className="hover:bg-sand">
                      <td className="border-b border-edge px-4 py-3 align-middle last:border-b-0">
                        <span className="flex min-w-0 items-center gap-3">
                          <Avatar name={m.displayName ?? m.email} muted={m.role === 'STUDENT'} />
                          <span className="min-w-0">
                            <span className="block truncate font-display text-[14.5px] font-semibold">
                              {m.displayName ?? m.email}
                            </span>
                            <span className="block truncate text-[12.5px] text-muted">{m.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="border-b border-edge px-4 py-3 align-middle">
                        {m.groupName ? (
                          <Pill>{m.groupName}</Pill>
                        ) : (
                          <span className="text-sm text-muted">—</span>
                        )}
                      </td>
                      <td className="border-b border-edge px-4 py-3 align-middle">
                        <RolePill role={m.role} />
                      </td>
                      <td className="border-b border-edge px-4 py-3 align-middle">
                        <StatusPill status={m.status} />
                      </td>
                      <td className="border-b border-edge px-4 py-3 text-right align-middle">
                        {canManageMembers && (
                          <span className="relative inline-block">
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={openMenu === m.memberId}
                              aria-label={`จัดการ ${m.displayName ?? m.email}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenu(openMenu === m.memberId ? null : m.memberId)
                              }}
                              className={`grid size-11 place-items-center rounded-lg border border-transparent text-muted transition-colors hover:border-edge hover:bg-sand hover:text-ink ${FOCUS}`}
                            >
                              <IconDots className="size-4.5" />
                            </button>

                            {openMenu === m.memberId && (
                              <span
                                role="menu"
                                className="absolute top-12 right-0 z-30 block min-w-52 rounded-xl border border-edge bg-white p-1.5 text-left shadow-[0_10px_30px_-12px_rgba(23,32,51,0.28)]"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenMenu(null)
                                    onRemove(m)
                                  }}
                                  className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-err hover:bg-err-soft ${FOCUS}`}
                                >
                                  <IconUserMinus className="size-4" />
                                  นำออกจากห้องเรียน
                                </button>
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                        ไม่พบสมาชิกที่ตรงกับ “{query}”
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-auto text-[13px] text-muted">
                แสดง{' '}
                <span className="font-mono tabular">
                  {visible.length === 0 ? 0 : (current - 1) * PER_PAGE + 1}–
                  {Math.min(current * PER_PAGE, visible.length)}
                </span>{' '}
                จาก <span className="font-mono tabular">{visible.length}</span> คน
              </span>

              {pageCount > 1 && (
                <nav aria-label="แบ่งหน้ารายชื่อ" className="flex flex-wrap gap-2">
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      aria-current={n === current ? 'page' : undefined}
                      className={
                        `min-h-11 min-w-11 rounded-lg border px-3 font-mono text-[13.5px] tabular transition-colors ${FOCUS} ` +
                        (n === current
                          ? 'border-cta bg-cta text-white'
                          : 'border-edge bg-white text-ink-2 hover:border-muted hover:bg-sand')
                      }
                    >
                      {n}
                    </button>
                  ))}
                </nav>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
