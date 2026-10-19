import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { type Me, getMe } from '../lib/api'
import { clearToken, isSignedIn } from '../lib/session'
import { Avatar, FOCUS } from './Ui'
import { NotificationBell } from './NotificationBell'
import { IconDoorExit, LogoMark } from './icons'
import { useMenu } from './useMenu'

type AppNavProps = {
  context?: string
  /** คงไว้เพื่อให้หน้าที่ส่งค่ามาเดิมยังคอมไพล์ได้ — Figma ไม่มีเมนูบัญชีจึงไม่ได้ใช้แล้ว */
  contextTo?: string
  classroomId?: string
  profile?: Me | null
}

/** Navbar กลางของหน้าหลังเข้าสู่ระบบ ตาม Figma (Nav 1440×63)
 *
 *  แบรนด์ทางซ้าย · อีเมล + อักษรย่อ + กระดิ่ง + ปุ่มออกจากระบบทางขวา
 *  มือถือ (Figma M01–M09): โลโก้ใหญ่ขึ้น · กระดิ่งก่อนอักษรย่อ · ไม่มีไอคอนออกจากระบบในแถบ
 *  จึงให้อักษรย่อเปิดเมนูที่มี "ออกจากระบบ" แทน ไม่งั้นบนมือถือจะออกจากระบบไม่ได้
 */
export function AppNav({ context, profile }: AppNavProps) {
  const navigate = useNavigate()
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

  const displayName = me?.displayName ?? me?.email ?? ''
  const { open: menuOpen, setOpen: setMenuOpen, rootRef, triggerRef, onKeyDown } = useMenu()

  function handleSignOut() {
    clearToken()
    void navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 bg-white">
      <nav
        data-testid="main-nav"
        aria-label="เมนูหลัก"
        aria-description={context}
        className="mx-auto flex h-15.5 max-w-360 items-center gap-5 px-12.5 max-sm:gap-2 max-sm:px-4"
      >
        <Link
          to="/"
          aria-label="PairEval หน้าแรก"
          className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg font-display text-[18px] font-semibold tracking-tight ${FOCUS}`}
        >
          <LogoMark className="size-7.5 max-sm:size-10" />
          <span className="max-sm:text-[24px]">PairEval</span>
        </Link>

        {isSignedIn() && (
          <div className="ml-auto flex min-w-0 items-center gap-5 max-sm:gap-1">
            <p
              data-testid="current-user"
              role="group"
              aria-label={`บัญชีของ ${displayName}`}
              className="flex min-w-0 items-center gap-5"
            >
              <span className="max-w-60 truncate text-[15px] text-muted max-md:hidden">{me?.email ?? ''}</span>
              {displayName && (
                <span className="max-sm:hidden">
                  <Avatar name={displayName} small />
                </span>
              )}
            </p>
            <NotificationBell />
            {displayName && (
              <div ref={rootRef} onKeyDown={onKeyDown} className="relative sm:hidden">
                <button
                  ref={triggerRef}
                  type="button"
                  aria-label={`เมนูบัญชีของ ${displayName}`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                  className={`grid size-11 place-items-center rounded-full ${FOCUS}`}
                >
                  <Avatar name={displayName} small />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    aria-label="บัญชี"
                    className="absolute top-[calc(100%+0.25rem)] right-0 z-50 w-56 rounded-xl border border-edge bg-white p-2 shadow-[0_12px_30px_rgba(50,16,7,0.16)]"
                  >
                    <p className="truncate px-3 py-2 text-[13px] text-muted">{me?.email}</p>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-[15px] text-brand-600 hover:bg-accent-soft ${FOCUS}`}
                    >
                      <IconDoorExit className="size-5" />
                      ออกจากระบบ
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              aria-label="ออกจากระบบ"
              onClick={handleSignOut}
              className={`grid size-11 place-items-center rounded-full text-brand-600 hover:bg-accent-soft max-sm:hidden ${FOCUS}`}
            >
              <IconDoorExit className="size-6" />
            </button>
          </div>
        )}
      </nav>
    </header>
  )
}
