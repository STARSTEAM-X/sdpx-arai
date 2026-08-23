import { useCallback, useEffect, useRef, useState } from 'react'

import { signInWithGoogle } from '../lib/api'
import { setToken } from '../lib/session'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/** ชนิดของ Google Identity Services เท่าที่ใช้จริง
 *  ประกาศเองเพราะไม่อยากเพิ่ม @types/google.accounts เข้ามาเพื่อใช้ 2 method */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string
            callback: (res: { credential: string }) => void
          }): void
          renderButton(parent: HTMLElement, options: Record<string, unknown>): void
        }
      }
    }
  }
}

/** โหลด script ของ Google ครั้งเดียวแล้วใช้ซ้ำ
 *  ถ้าเรียกซ้ำจะได้ promise เดิม ไม่ยิงโหลดใหม่ — สำคัญเพราะตอนนี้มีปุ่ม 2 ที่ในเว็บ */
let gisLoader: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (gisLoader) return gisLoader

  gisLoader = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()

    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('โหลดสคริปต์ของ Google ไม่สำเร็จ'))
    document.head.appendChild(script)
  })

  return gisLoader
}

type Props = {
  /** เรียกเมื่อ login สำเร็จ เพื่อให้หน้าที่ใช้อยู่ตัดสินใจเองว่าจะทำอะไรต่อ */
  onSignedIn: () => void
  /** ความกว้างของปุ่มเป็น px — Google รับค่าได้สูงสุด 400 */
  width?: number
  /** พื้นหลังรอบปุ่ม: ถ้าอยู่บนพื้นสีเข้มให้ใช้ outline เพื่อให้ปุ่มขาวตัดกับพื้น */
  theme?: 'outline' | 'filled_blue' | 'filled_black'
}

export function GoogleSignInButton({ onSignedIn, width = 280, theme = 'outline' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  // ห่อด้วย useCallback เพื่อไม่ให้ effect รันซ้ำทุกครั้งที่ parent re-render
  // ถ้ารันซ้ำ Google จะ render ปุ่มซ้อนกันหลายอัน
  const handleCredential = useCallback(
    (credential: string) => {
      // id_token จาก Google ยังใช้เป็น session ของเราไม่ได้
      // ต้องให้ backend ตรวจลายเซ็นและ aud ก่อนเสมอ
      signInWithGoogle(credential)
        .then(({ accessToken }) => {
          setToken(accessToken)
          onSignedIn()
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ')
        })
    },
    [onSignedIn],
  )

  useEffect(() => {
    if (!CLIENT_ID) {
      setError('ยังไม่ได้ตั้งค่า VITE_GOOGLE_CLIENT_ID')
      return
    }

    let cancelled = false

    loadGis()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (res) => handleCredential(res.credential),
        })

        // ล้างของเดิมก่อน render ใหม่ กันปุ่มซ้อนกันตอน React re-mount ใน StrictMode
        containerRef.current.innerHTML = ''

        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme,
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          locale: 'th',
          width,
        })
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'โหลด Google Sign-In ไม่สำเร็จ')
      })

    return () => {
      cancelled = true
    }
  }, [handleCredential, theme, width])

  return (
    <div data-testid="google-signin">
      {/* Google บังคับให้ใช้ปุ่มที่เขา render เอง จัดสไตล์เองไม่ได้
          ทำได้แค่เลือก theme / size / shape ที่เขาเตรียมไว้ */}
      <div ref={containerRef} />
      {error && (
        <p role="alert" data-testid="signin-error" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
