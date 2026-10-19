import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { emailFromIdToken } from '../components/DomainRejectedDialog'
import { type GoogleSignInOutcome } from '../components/GoogleSignInButton'
import { Spinner } from '../components/Ui'
import { ApiError, signInWithGoogle } from '../lib/api'
import { readGoogleCallback, takePendingSignIn } from '../lib/googleSignIn'
import { setToken } from '../lib/session'

/** ที่ที่ Google ส่ง id_token กลับมา (redirect URI) — แลกเป็น session ของเราแล้วพาไปหน้าที่ตั้งใจไว้
 *  ถ้าไม่สำเร็จพากลับหน้าแรก ให้ปุ่มเข้าสู่ระบบบนแถบเมนูแจ้งผลตรงจุดที่ผู้ใช้กด */
export default function GoogleCallbackPage() {
  const navigate = useNavigate()
  // StrictMode ตอน dev รัน effect สองรอบ — state/nonce ถูกลบหลังอ่านครั้งแรก รอบสองจะกลายเป็น "ไม่ตรง" ทั้งที่สำเร็จ
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const result = readGoogleCallback(window.location.hash, takePendingSignIn())
    // เอา id_token ออกจาก URL และประวัติของเบราว์เซอร์ทันที ไม่ว่าผลจะเป็นอย่างไร
    window.history.replaceState(window.history.state, '', window.location.pathname)
    const backHome = (googleSignIn: GoogleSignInOutcome) => navigate('/', { replace: true, state: { googleSignIn } })

    if (!result.ok) {
      backHome({ error: result.message })
      return
    }
    signInWithGoogle(result.idToken)
      .then(({ accessToken }) => {
        setToken(accessToken)
        navigate(result.returnTo, { replace: true })
      })
      .catch((err: unknown) => {
        // Figma ST02: อีเมลนอกโดเมนแสดงเป็นหน้าต่างแจ้ง พร้อมทางเลือกเข้าด้วยบัญชีอื่น
        if (err instanceof ApiError && err.code === 'DOMAIN_NOT_ALLOWED') {
          const allowed = err.message.split('ที่อนุญาต:')[1]?.trim().split(',')[0]?.trim() ?? ''
          backHome({ rejected: { email: emailFromIdToken(result.idToken), allowed } })
          return
        }
        backHome({ error: err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ' })
      })
  }, [navigate])

  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5 text-ink">
      <p role="status" className="flex items-center gap-3"><Spinner />กำลังเข้าสู่ระบบด้วย Google…</p>
    </main>
  )
}
