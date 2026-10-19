import { useEffect, useLayoutEffect, useState } from 'react'
import type { RosterEntry } from '../lib/api'
import { FOCUS } from './Ui'
import { useMenu } from './useMenu'

/** เมนู "···" ของแต่ละแถวสมาชิก ตาม Figma J09 / J11 */
export function MemberRowActions({ member, canRemove, onRemove, onEnrollment, onChangeRole }: {
  member: RosterEntry
  canRemove: boolean
  onRemove: (member: RosterEntry) => void
  onEnrollment?: (member: RosterEntry) => void
  onChangeRole?: (member: RosterEntry) => void
}) {
  const { open, setOpen, rootRef, triggerRef, onKeyDown } = useMenu()
  const [position, setPosition] = useState({ top: 0, right: 16 })
  const canEnroll = member.role === 'STUDENT' && Boolean(onEnrollment)
  const canRole = canRemove && Boolean(onChangeRole) && (member.role === 'CO_TEACHER' || member.role === 'TA')
  const canRemoveThis = canRemove && member.role !== 'STUDENT' && member.role !== 'OWNER'
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({ top: Math.max(8, Math.min(rect.bottom + 6, innerHeight - 160)), right: Math.max(16, innerWidth - rect.right) })
  }, [open, triggerRef])
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('resize', close) }
  }, [open, setOpen])
  if (!canRole && !canEnroll && !canRemoveThis) return null
  const item = `flex w-full flex-col items-start rounded-lg px-3.5 py-2 text-left hover:bg-sand ${FOCUS}`
  const pick = (action?: (member: RosterEntry) => void) => () => { setOpen(false); triggerRef.current?.focus(); action?.(member) }
  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`จัดการ ${member.displayName ?? member.email}`}
        onClick={() => setOpen(!open)}
        className={`grid size-9 place-items-center rounded-full border border-edge bg-white text-ink-2 hover:bg-sand ${FOCUS}`}
      >
        ···
      </button>
      {open && (
        <div role="menu" className="fixed z-50 w-65 rounded-2xl border border-edge bg-white p-2 shadow-[0_12px_30px_rgba(50,16,7,0.12)]" style={position}>
          {canRole && (
            <button type="button" role="menuitem" className={item} onClick={pick(onChangeRole)}>
              <span className="font-display text-[14.5px] font-semibold">แก้ไขบทบาท</span>
              <span className="text-[12px] text-muted">ตอนนี้: {member.role === 'TA' ? 'TA' : 'ผู้สอนร่วม'} · บันทึก audit</span>
            </button>
          )}
          {canEnroll && (
            <button type="button" role="menuitem" className={item} onClick={pick(onEnrollment)}>
              <span className="font-display text-[14.5px] font-semibold">{member.enrollmentStatus === 'WITHDRAWN' ? 'คืนสถานะนักศึกษา' : 'ทำเครื่องหมายถอนรายวิชา'}</span>
            </button>
          )}
          {canRemoveThis && (
            <button type="button" role="menuitem" className={`${item} hover:bg-err-soft`} onClick={pick(onRemove)}>
              <span className="font-display text-[14.5px] font-semibold text-err">ถอดออกจากห้อง</span>
              <span className="text-[12px] text-muted">เข้าห้องนี้ไม่ได้อีก · คำตอบที่เคยส่งยังอยู่</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
