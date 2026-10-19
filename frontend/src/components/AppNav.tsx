import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { type Me, getMe } from '../lib/api'
import { clearToken, isSignedIn } from '../lib/session'
import { Avatar, FOCUS } from './Ui'
import { useMenu } from './useMenu'
import { NotificationBell } from './NotificationBell'
import {
  IconClassroom,
  IconLogOut,
  LogoMark,
} from './icons'

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'เจ้าของห้อง',
  CO_TEACHER: 'ผู้สอนร่วม',
  TA: 'ผู้ช่วยสอน',
  STUDENT: 'นักศึกษา',
}

type AppNavProps = {
  context?: string
  contextTo?: string
  classroomId?: string
  profile?: Me | null
}

/** Navbar กลางของหน้าหลังเข้าสู่ระบบ
 *
 *  ทุกหน้าใช้โครงเดียวกัน: แบรนด์ → ทางเข้าห้องเรียน → บริบทปัจจุบัน → บัญชี
 *  ชื่อ role อ่านจาก membership จริง จึงไม่สร้างความเข้าใจผิดเมื่อผู้ใช้มี role ต่างกันในแต่ละห้อง
 */
export function AppNav({ context, contextTo, classroomId, profile }: AppNavProps) {
  const navigate = useNavigate()
  const { open, setOpen, rootRef, triggerRef, onKeyDown } = useMenu()
  const [me, setMe] = useState<Me | null>(profile ?? null)

  useEffect(() => {
    if (profile !== undefined) {
      setMe(profile)
      return
    }
    if (!isSignedIn()) return

    let active = true
    void getMe()
      .then((value) => {
        if (active) setMe(value)
      })
      .catch(() => { /* apiFetch จัดการ session 401 ตาม token ของ request แล้ว */ })
    return () => {
      active = false
    }
  }, [profile])

  const membership = classroomId
    ? me?.classrooms.find((item) => item.classroomId === classroomId)
    : undefined
  const roleLabel = membership ? ROLE_LABEL[membership.role] : undefined
  const displayName = me?.displayName ?? me?.email ?? 'กำลังโหลด…'

  function handleSignOut() {
    clearToken()
    setOpen(false)
    void navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-edge/50 bg-white/95 backdrop-blur">
      <nav
        data-testid="main-nav"
        aria-label="เมนูหลัก" aria-description={context}
        className="mx-auto flex h-16 max-w-360 items-center gap-5 px-7 sm:px-10 lg:px-14 max-sm:gap-3 max-sm:px-4"
      >
        <Link
          to="/"
          aria-label="PairEval หน้าแรก"
          className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg font-display text-[24px] font-bold tracking-tight ${FOCUS}`}
        >
          <LogoMark className="size-9" />
          <span>PairEval</span>
        </Link>

        {isSignedIn() && (
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <NotificationBell />
          <div ref={rootRef} onKeyDown={onKeyDown} className="relative order-2 min-w-0 md:order-1">
            <button
              ref={triggerRef}
              type="button"
              data-testid="current-user"
              aria-label={`บัญชีของ ${displayName}`}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className={`flex min-h-11 items-center gap-2.5 rounded-full px-1.5 text-left transition-colors hover:bg-accent-soft ${FOCUS}`}
            >
              <span className="max-w-52 truncate text-[13px] text-muted max-md:hidden">
                {me?.email ?? displayName}
              </span>
              <Avatar name={displayName} small />
            </button>

            {open && (
              <div
                role="menu"
                className="absolute top-[calc(100%+0.75rem)] right-0 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-edge bg-white p-2 shadow-[0_12px_30px_rgba(50,16,7,0.10)]"
              >
                <div className="border-b border-edge px-3 py-2.5">
                  <p className="truncate text-sm font-semibold">{me?.displayName ?? 'บัญชีของฉัน'}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{me?.email ?? 'กำลังโหลดข้อมูลบัญชี…'}</p>
                  {roleLabel && <p className="mt-1 text-xs text-muted">{roleLabel}</p>}
                </div>
                <Link to="/classrooms" role="menuitem" onClick={() => setOpen(false)} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm hover:bg-accent-soft ${FOCUS}`}><IconClassroom className="size-4" />ห้องเรียนของฉัน</Link>
                {contextTo && <Link to={contextTo} role="menuitem" onClick={() => setOpen(false)} className={`flex min-h-11 items-center rounded-xl px-3 text-sm hover:bg-accent-soft ${FOCUS}`}>{context ?? 'กลับหน้าห้องเรียน'}</Link>}
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className={`mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm text-ink-2 transition-colors hover:bg-accent-soft hover:text-ink ${FOCUS}`}
                >
                  <IconLogOut className="size-4" />
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
          <button type="button" aria-label="ออกจากระบบ" onClick={handleSignOut} className={`order-3 grid size-11 place-items-center rounded-full text-brand-600 hover:bg-accent-soft max-sm:hidden ${FOCUS}`}><IconLogOut className="size-5" /></button>
          </div>
        )}
      </nav>
    </header>
  )
}
