import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { startGoogleSignIn } from '../lib/googleSignIn'
import { DomainRejectedDialog } from './DomainRejectedDialog'
import { FOCUS } from './Ui'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/** ผลที่หน้า callback ส่งกลับมาทาง history state เมื่อเข้าสู่ระบบไม่สำเร็จ */
export type GoogleSignInOutcome =
  | { error: string }
  | { rejected: { email: string; allowed: string } }

type Props = {
  /** หน้าที่จะไปต่อหลังเข้าสู่ระบบสำเร็จ — ต้องเป็น path ภายในเว็บ */
  returnTo?: string
  /** ความกว้างของปุ่มเป็น px */
  width?: number
}

/* ปุ่มสีส้มของเราเองพาไปหน้า login ของ Google ตรง ๆ (lib/googleSignIn.ts)
 * ห้ามกลับไปซ่อนปุ่มของ GIS ไว้ใต้ปุ่มนี้ (opacity-0 / ทับด้วยปุ่มของเรา) — GIS ตรวจว่าปุ่มมองเห็นจริง
 * ก่อนเปิด popup เพื่อกัน clickjacking ถ้ามองไม่เห็น คลิกจะถูกเมินเงียบ ๆ เคยทำให้ production login ไม่ได้ */
export function GoogleSignInButton({ returnTo = '/classrooms', width = 196 }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const [outcome] = useState(() => (location.state as { googleSignIn?: GoogleSignInOutcome } | null)?.googleSignIn ?? null)
  const [error, setError] = useState<string | null>(() => (
    !CLIENT_ID ? 'ยังไม่ได้ตั้งค่า VITE_GOOGLE_CLIENT_ID' : outcome && 'error' in outcome ? outcome.error : null
  ))
  const [rejected, setRejected] = useState(outcome && 'rejected' in outcome ? outcome.rejected : null)
  const [redirecting, setRedirecting] = useState(false)

  // ล้างผลออกจาก history state หลังอ่านแล้ว — กด reload จะได้ไม่เห็นข้อความเดิมซ้ำ
  // ทำครั้งเดียว: navigate ทำให้ location เปลี่ยน effect จะรันซ้ำ ถ้าไม่กันไว้จะวนไม่จบ
  const cleared = useRef(false)
  useEffect(() => {
    if (!outcome || cleared.current) return
    cleared.current = true
    const rest = { ...(location.state as Record<string, unknown>) }
    delete rest.googleSignIn
    navigate(`${location.pathname}${location.search}`, { replace: true, state: Object.keys(rest).length ? rest : null })
  }, [outcome, location, navigate])

  // กด Back จากหน้า Google แล้วเบราว์เซอร์คืนหน้านี้จาก bfcache — ปุ่มต้องกดได้อีก ไม่ค้างที่ "กำลังไป"
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => { if (event.persisted) setRedirecting(false) }
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  function start() {
    if (!CLIENT_ID) return
    setError(null)
    setRejected(null)
    setRedirecting(true)
    startGoogleSignIn({ clientId: CLIENT_ID, returnTo })
  }

  return (
    <div data-testid="google-signin">
      <button
        type="button"
        onClick={start}
        disabled={!CLIENT_ID || redirecting}
        aria-busy={redirecting}
        style={{ width }}
        className={`flex min-h-10 items-center justify-center whitespace-nowrap rounded-full bg-cta px-4 font-display text-sm font-semibold text-white transition-colors hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-70 ${FOCUS}`}
      >
        เข้าสู่ระบบด้วย Google
      </button>
      {error && (
        <p role="alert" data-testid="signin-error" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {rejected && (
        <DomainRejectedDialog
          email={rejected.email}
          allowedDomain={rejected.allowed}
          onClose={() => setRejected(null)}
          onRetry={start}
        />
      )}
    </div>
  )
}
