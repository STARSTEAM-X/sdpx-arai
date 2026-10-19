import { useEffect, useLayoutEffect, useState } from 'react'
import type { RosterEntry } from '../lib/api'
import { IconDots, IconUserMinus } from './icons'
import { FOCUS } from './Ui'
import { useMenu } from './useMenu'

export function MemberRowActions({ member, canRemove, onRemove, onEnrollment }: { member: RosterEntry; canRemove: boolean; onRemove: (member: RosterEntry) => void; onEnrollment?: (member: RosterEntry) => void }) {
  const { open, setOpen, rootRef, triggerRef, onKeyDown } = useMenu()
  const [position, setPosition] = useState({ top: 0, right: 16 })
  const canEnroll = member.role === 'STUDENT' && Boolean(onEnrollment)
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({ top: Math.max(8, Math.min(rect.bottom + 6, innerHeight - 64)), right: Math.max(16, innerWidth - rect.right) })
  }, [open, triggerRef])
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('resize', close) }
  }, [open, setOpen])
  if (!(canRemove && member.role !== 'STUDENT') && !canEnroll) return null
  return <div ref={rootRef} onKeyDown={onKeyDown} className="inline-block">
    <button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`จัดการ ${member.displayName ?? member.email}`} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setPosition({ top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - (canEnroll && canRemove ? 112 : 64))), right: Math.max(16, innerWidth - rect.right) }); setOpen(!open) }} className={`grid size-11 place-items-center rounded-lg text-muted hover:bg-sand ${FOCUS}`}><IconDots className="size-4.5" /></button>
    {open && <div role="menu" className="fixed z-50 min-w-52 rounded-xl border border-edge bg-white p-1.5 text-left shadow-lg" style={position}>
      {canEnroll && <button type="button" role="menuitem" className={`flex min-h-11 w-full items-center rounded-lg px-3 text-sm hover:bg-sand ${FOCUS}`} onClick={() => { setOpen(false); triggerRef.current?.focus(); onEnrollment?.(member) }}>{member.enrollmentStatus === 'WITHDRAWN' ? 'คืนสถานะนักศึกษา' : 'ถอนจากรายวิชา'}</button>}
      {canRemove && member.role !== 'STUDENT' && <button type="button" role="menuitem" onClick={() => { setOpen(false); triggerRef.current?.focus(); onRemove(member) }} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-err hover:bg-err-soft ${FOCUS}`}><IconUserMinus className="size-4" />นำออกจากห้องเรียน</button>}
    </div>}
  </div>
}
