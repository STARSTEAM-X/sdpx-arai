import { useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { GoogleSignInButton } from './GoogleSignInButton'
import { isSignedIn } from '../lib/session'
import { LogoMark } from './icons'
import { FOCUS } from './Ui'

const LINKS = [
  { href: '#overview', label: 'ภาพรวม' },
  { href: '/classrooms', label: 'สมาชิก' },
  { href: '/classrooms', label: 'งานประเมิน' },
  { href: '/classrooms', label: 'คะแนน' },
]

export function SiteNav() {
  const navigate = useNavigate()
  const location = useLocation()
  // อ่านครั้งเดียวตอน render พอ — หน้านี้เป็น landing ที่ไม่ได้เปลี่ยนสถานะ login ระหว่างใช้งาน
  // ยกเว้นตอนกดปุ่มใน CtaBand ซึ่งพาไป /classrooms ทันทีอยู่แล้ว
  const signedIn = isSignedIn()
  const handleSignedIn = useCallback(() => navigate('/classrooms'), [navigate])

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

        {/* บนจอแคบใช้ปุ่มเข้าสู่ระบบ/ห้องเรียนเป็นทางเข้าหลัก */}
        <ul className="hidden flex-1 items-center justify-center gap-8 text-sm font-semibold text-ink-2 lg:flex">
          {LINKS.map((link) => (
            <li key={link.label}>
              <a href={link.href} className={`inline-flex min-h-11 items-center rounded-md transition-colors hover:text-accent-ink ${FOCUS}`}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2.5 lg:ml-0">
          {signedIn ? (
            <Link
              to="/classrooms"
              className={`inline-flex min-h-11 items-center justify-center rounded-full bg-cta px-5 text-sm font-semibold text-white transition-colors hover:bg-cta-hover sm:min-w-48 ${FOCUS}`}
            >
              ห้องเรียนของฉัน
            </Link>
          ) : (
            <div id="signin" className="relative flex min-h-11 w-49 shrink-0 items-center [&_[role=alert]]:absolute [&_[role=alert]]:top-full [&_[role=alert]]:right-0 [&_[role=alert]]:w-72 [&_[role=alert]]:rounded-2xl [&_[role=alert]]:bg-white [&_[role=alert]]:p-4 [&_[role=alert]]:shadow-lg">
              <GoogleSignInButton onSignedIn={handleSignedIn} width={196} shape="pill" text="signin" appearance="brand" />
            </div>
          )}
        </div>
      </nav>
      {!signedIn && location.state?.loginRequired && <p role="status" className="fixed inset-x-4 bottom-5 mx-auto max-w-xl rounded-2xl border border-accent-line bg-white px-5 py-3 text-center text-sm text-ink-2 shadow-lg">กรุณาเข้าสู่ระบบด้วย Google ก่อนใช้งานห้องเรียน</p>}
    </header>
  )
}
