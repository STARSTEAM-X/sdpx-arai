import { useEffect, useRef } from 'react'

import { btn } from './Ui'

/** อ่านอีเมลจาก id_token เพื่อแสดงในข้อความเท่านั้น — ไม่ได้ใช้ยืนยันตัวตน
 *  (backend ตรวจลายเซ็นและปฏิเสธไปแล้ว ค่านี้แค่ช่วยให้ผู้ใช้รู้ว่าเลือกบัญชีไหนไป) */
export function emailFromIdToken(credential: string): string {
  try {
    const payload = credential.split('.')[1] ?? ''
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const email = (JSON.parse(json) as { email?: unknown }).email
    return typeof email === 'string' ? email : 'บัญชีนี้'
  } catch {
    return 'บัญชีนี้'
  }
}

/** Figma ST02 · อีเมลนอกโดเมน · ปฏิเสธการเข้าสู่ระบบ */
export function DomainRejectedDialog({
  email,
  allowedDomain,
  onClose,
  onRetry,
}: {
  email: string
  allowedDomain: string
  onClose: () => void
  onRetry: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const node = dialog.current
    if (node && !node.open) node.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby="domain-rejected-title"
      data-testid="domain-rejected"
      onClose={onClose}
      className="fixed inset-0 m-auto w-[calc(100vw-2rem)] max-w-131 rounded-2xl bg-white p-5 text-left text-ink shadow-[0_16px_40px_rgba(50,16,7,0.22)] backdrop:bg-ink/45"
    >
      <h2 id="domain-rejected-title" className="font-display text-[19px] font-semibold">ใช้บัญชีนี้เข้าสู่ระบบไม่ได้</h2>
      <div className="mt-4 rounded-xl bg-err-soft px-4 py-3 text-[13px] leading-5 text-err">
        <p className="font-semibold">{email} ไม่อยู่ในโดเมนที่อนุญาต</p>
        <p className="mt-1">
          ห้องเรียนในระบบนี้รับเฉพาะอีเมล{allowedDomain ? ` @${allowedDomain}` : 'มหาวิทยาลัย'} · ออกจากบัญชีนี้
          แล้วเข้าสู่ระบบด้วย Google อีกครั้งโดยเลือกอีเมลมหาวิทยาลัย
        </p>
      </div>
      <div className="mt-4 flex justify-end gap-3">
        <button type="button" onClick={() => dialog.current?.close()} className={btn('ghost', 'sm', 'min-w-13 rounded-full px-5')}>ปิด</button>
        <button type="button" onClick={onRetry} className={btn('primary', 'sm', 'px-5')}>เข้าสู่ระบบด้วยบัญชีอื่น</button>
      </div>
    </dialog>
  )
}
