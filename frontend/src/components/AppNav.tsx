import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError, type Me, getMe } from '../lib/api'
import { clearToken, isSignedIn } from '../lib/session'
import { Avatar } from './Ui'
import {
  IconChevronDown,
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
  const menuRef = useRef<HTMLDivElement>(null)
  const [me, setMe] = useState<Me | null>(profile ?? null)
  const [open, setOpen] = useState(false)

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
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) clearToken()
      })
    return () => {
      active = false
    }
  }, [profile])

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

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
    <header className="sticky top-0 z-40 border-b border-edge bg-white/92 shadow-[0_1px_2px_rgba(23,32,51,0.05)] backdrop-blur">
      <nav
        data-testid="main-nav"
        aria-label="เมนูหลัก"
        className="mx-auto flex h-16 max-w-300 items-center gap-3 px-6 max-sm:px-4"
      >
        <Link
          to="/"
          className="flex min-h-11 shrink-0 items-center gap-2.5 font-display text-[19px] font-bold tracking-tight"
        >
          <LogoMark className="size-8" />
          <span className="max-[420px]:hidden">PairEval</span>
        </Link>

        <Link
          to="/classrooms"
          className="ml-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 border-brand-600 px-2 text-sm font-semibold text-ink max-sm:ml-0 max-sm:px-1"
        >
          <IconClassroom className="size-4" />
          ห้องเรียน
        </Link>

        {context && (
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted max-sm:hidden">
            <span aria-hidden="true">/</span>
            {contextTo ? (
              <Link to={contextTo} className="truncate transition-colors hover:text-ink">
                {context}
              </Link>
            ) : (
              <span className="truncate">{context}</span>
            )}
          </div>
        )}

        {isSignedIn() && (
          <div ref={menuRef} className="relative ml-auto">
            <button
              type="button"
              data-testid="current-user"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-left transition-colors hover:bg-sand"
            >
              {roleLabel && (
                <span className="rounded-full border border-edge bg-sand px-2.5 py-1 text-xs font-medium text-ink-2 max-md:hidden">
                  {roleLabel}
                </span>
              )}
              <Avatar name={displayName} />
              <span className="max-w-36 truncate text-sm font-medium max-lg:hidden">{displayName}</span>
              <IconChevronDown className={`size-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div
                role="menu"
                className="absolute top-[calc(100%+0.5rem)] right-0 w-64 overflow-hidden rounded-xl border border-edge bg-white p-1.5 shadow-[0_14px_36px_rgba(23,32,51,0.14)]"
              >
                <div className="border-b border-edge px-3 py-2.5">
                  <p className="truncate text-sm font-semibold">{me?.displayName ?? 'บัญชีของฉัน'}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{me?.email ?? 'กำลังโหลดข้อมูลบัญชี…'}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-sand hover:text-ink"
                >
                  <IconLogOut className="size-4" />
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}
