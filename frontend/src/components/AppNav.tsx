import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { type Me, getMe } from '../lib/api'
import { clearToken, isSignedIn } from '../lib/session'
import { Avatar, FOCUS } from './Ui'
import { NotificationBell } from './NotificationBell'
import { IconDoorExit, LogoMark } from './icons'

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
 *  ไม่มีเมนูบัญชีแบบ dropdown เพราะไม่มีในแบบ
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
          <LogoMark className="size-7.5" />
          <span>PairEval</span>
        </Link>

        {isSignedIn() && (
          <div className="ml-auto flex min-w-0 items-center gap-5 max-sm:gap-1">
            <p
              data-testid="current-user"
              aria-label={`บัญชีของ ${displayName}`}
              className="flex min-w-0 items-center gap-5"
            >
              <span className="max-w-60 truncate text-[15px] text-muted max-md:hidden">{me?.email ?? ''}</span>
              {displayName && <Avatar name={displayName} small />}
            </p>
            <NotificationBell />
            <button
              type="button"
              aria-label="ออกจากระบบ"
              onClick={handleSignOut}
              className={`grid size-11 place-items-center rounded-full text-brand-600 hover:bg-accent-soft ${FOCUS}`}
            >
              <IconDoorExit className="size-6" />
            </button>
          </div>
        )}
      </nav>
    </header>
  )
}
