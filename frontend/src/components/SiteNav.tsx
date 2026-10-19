import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { GoogleSignInButton } from './GoogleSignInButton'
import { NotificationBell } from './NotificationBell'
import { type Me, getMe } from '../lib/api'
import { clearToken, isSignedIn } from '../lib/session'
import { IconDoorExit, LogoMark } from './icons'
import { Avatar, FOCUS } from './Ui'

export function SiteNav() {
  const navigate = useNavigate()
  const location = useLocation()
  // อ่านครั้งเดียวตอน render พอ — หน้านี้เป็น landing ที่ไม่ได้เปลี่ยนสถานะ login ระหว่างใช้งาน
  // ยกเว้นตอนกดปุ่มใน CtaBand ซึ่งพาไป /classrooms ทันทีอยู่แล้ว
  const signedIn = isSignedIn()
  const handleSignedIn = useCallback(() => navigate('/classrooms'), [navigate])
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    if (!signedIn) return
    let active = true
    void getMe().then((value) => { if (active) setMe(value) }).catch(() => { /* 401 ล้าง session ให้แล้ว */ })
    return () => { active = false }
  }, [signedIn])

  return (
    <header className="absolute inset-x-0 top-5 z-40 px-4 sm:top-7 sm:px-6">
      <nav
        data-testid="main-nav"
        aria-label="เมนูหลัก"
        className="mx-auto flex min-h-16 max-w-300 items-center gap-6 rounded-full border border-white/60 bg-cream/85 py-2 pr-2 pl-5 backdrop-blur sm:pl-7"
      >
        <Link to="/" aria-label="PairEval หน้าแรก" className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg font-display text-xl font-bold tracking-tight sm:text-2xl ${FOCUS}`}>
          <LogoMark className="size-8" />
          <span className="max-[420px]:hidden">PairEval</span>
        </Link>

        <div className="ml-auto flex items-center gap-2.5">
          {signedIn ? (
            // Figma ST04: หน้าแรกหลังเข้าสู่ระบบแสดงบัญชีในแถบเดียวกัน ไม่มีปุ่มห้องเรียน
            <div className="flex items-center gap-3 pr-3 max-sm:gap-1 max-sm:pr-0">
              <p data-testid="current-user" role="group" aria-label={`บัญชีของ ${me?.displayName ?? me?.email ?? ''}`} className="flex items-center gap-3">
                <span className="max-w-60 truncate text-[13px] text-muted max-md:hidden">{me?.email}</span>
                {me && <Avatar name={me.displayName ?? me.email} small />}
              </p>
              <NotificationBell />
              <button type="button" aria-label="ออกจากระบบ" onClick={() => { clearToken(); window.location.assign('/') }} className={`grid size-11 place-items-center rounded-full text-brand-600 hover:bg-white/70 ${FOCUS}`}>
                <IconDoorExit className="size-5.5" />
              </button>
            </div>
          ) : (
            <div id="signin" className="relative flex min-h-11 w-49 shrink-0 items-center [&_[role=alert]]:absolute [&_[role=alert]]:top-full [&_[role=alert]]:right-0 [&_[role=alert]]:w-72 [&_[role=alert]]:rounded-2xl [&_[role=alert]]:bg-white [&_[role=alert]]:p-4 [&_[role=alert]]:shadow-lg">
              <GoogleSignInButton onSignedIn={handleSignedIn} width={196} shape="pill" text="signin" />
            </div>
          )}
        </div>
      </nav>
      {!signedIn && location.state?.loginRequired && <p role="status" className="fixed inset-x-4 bottom-5 mx-auto max-w-xl rounded-2xl border border-accent-line bg-white px-5 py-3 text-center text-sm text-ink-2 shadow-lg">กรุณาเข้าสู่ระบบด้วย Google ก่อนใช้งานห้องเรียน</p>}
    </header>
  )
}
