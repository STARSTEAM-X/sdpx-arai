import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link, Navigate, Outlet } from 'react-router-dom'

import { ApiError, getMe } from '../lib/api'
import { getToken, subscribeToSession } from '../lib/session'
import { PrivacyNotice } from './PrivacyNotice'
import { Spinner, btn } from './Ui'

export function RequireSession() {
  const token = useSyncExternalStore(subscribeToSession, getToken)
  const [verification, setVerification] = useState<{ token: string; valid: boolean; needsPrivacy?: boolean } | null>(null)

  useEffect(() => {
    if (!token) return
    let active = true
    // ยืนยันกับ server ก่อน mount หน้าภายใน ไม่ถือว่าแค่มี localStorage คือ login แล้ว
    getMe()
      .then((me) => { if (active) setVerification({ token, valid: true, needsPrivacy: !me.privacyAcknowledgedAt }) })
      .catch((error: unknown) => {
        // apiFetch ล้าง session เมื่อได้ 401; กรณีเครือข่ายผิดพลาดให้ลองใหม่ได้
        if (active && !(error instanceof ApiError && error.status === 401)) {
          setVerification({ token, valid: false })
        }
      })
    return () => { active = false }
  }, [token])

  if (!token) return <Navigate to="/" replace state={{ loginRequired: true }} />
  if (verification?.token === token && verification.valid) {
    return (
      <>
        <Outlet />
        {verification.needsPrivacy && (
          <PrivacyNotice onAcknowledged={() => setVerification({ ...verification, needsPrivacy: false })} />
        )}
      </>
    )
  }

  const failed = verification?.token === token && !verification.valid
  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5 text-ink">
      <div className="max-w-md text-center">
        {failed ? (
          <>
            <p role="alert" className="mb-5 leading-7">ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง</p>
            <button type="button" onClick={() => window.location.reload()} className={btn('primary')}>ลองใหม่</button>
            <Link to="/" className={`${btn('ghost')} ml-3`}>กลับหน้าแรก</Link>
          </>
        ) : (
          <p role="status" className="flex items-center gap-3"><Spinner />กำลังตรวจสอบการเข้าสู่ระบบ…</p>
        )}
      </div>
    </main>
  )
}
