import { useCallback, useEffect, useRef, useState } from 'react'

import { signInWithGoogle } from '../lib/api'
import { setToken } from '../lib/session'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/** เวลาที่รอให้ Google วาดปุ่มเสร็จก่อนจะถือว่าวาดไม่ขึ้น
 *  ปุ่มมาจาก iframe ข้าม origin จึงต้องเผื่อเวลาโหลดบนเน็ตช้า */
const RENDER_TIMEOUT_MS = 4000

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

/* GSI ยอมให้เรียก initialize() ได้ครั้งเดียวต่อการโหลดหน้า
 * เรียกซ้ำจะขึ้น warning และใช้ instance สุดท้ายเท่านั้น
 *
 * React StrictMode ตอน dev จะ mount/unmount ซ้ำหนึ่งรอบ ทำให้ effect รันสองครั้ง
 * จึงต้องกันด้วยตัวแปรระดับ module ไม่ใช่ระดับ component
 *
 * ส่วน callback เก็บไว้ตรงกลาง เพื่อให้ initialize ครั้งเดียว
 * ยังส่งผลไปยังปุ่มที่กำลังแสดงอยู่ ณ ตอนนั้นได้ถูกตัว
 *
 * เก็บสถานะไว้บน window ไม่ใช่ตัวแปรระดับ module เพราะตอน dev
 * HMR จะโหลดไฟล์นี้ใหม่ทุกครั้งที่แก้ ทำให้ตัวแปรระดับ module ถูกรีเซ็ต
 * แล้ว initialize() จะถูกเรียกซ้ำทุกครั้งที่เซฟไฟล์ */
type GisState = {
  initialized: boolean
  callback: ((credential: string) => void) | null
}

function gisState(): GisState {
  const w = window as unknown as { __paireval_gis?: GisState }
  w.__paireval_gis ??= { initialized: false, callback: null }
  return w.__paireval_gis
}

function ensureInitialized(clientId: string): void {
  const state = gisState()
  if (state.initialized || !window.google) return

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (res) => state.callback?.(res.credential),
  })
  state.initialized = true
}

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
    let renderCheck: ReturnType<typeof setTimeout> | undefined

    loadGis()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return

        ensureInitialized(CLIENT_ID)
        gisState().callback = handleCredential

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

        // GSI ไม่มี error callback ให้ดักตอนวาดปุ่มไม่สำเร็จ
        // เคสที่เจอบ่อยที่สุดคือ origin ปัจจุบันไม่ได้อยู่ใน Authorized JavaScript origins
        // ของ OAuth client — Google จะตอบ 403 แล้วเขียน
        // "The given origin is not allowed for the given client ID" ลง console เท่านั้น
        // ฝั่งหน้าเว็บจะเหลือแค่กล่องว่าง ผู้ใช้ไม่รู้เลยว่าเกิดอะไรขึ้น
        // จึงวัดความสูงจริงของกล่องหลังหมดเวลารอ แล้วบอกวิธีแก้ให้ตรงจุด
        renderCheck = setTimeout(() => {
          const box = containerRef.current
          if (cancelled || !box) return
          if (box.getBoundingClientRect().height > 0) return

          setError(
            `Google ปฏิเสธการวาดปุ่มสำหรับ origin ${window.location.origin} — ` +
              'ต้องเพิ่ม origin นี้ใน Authorized JavaScript origins ของ OAuth client ' +
              'ที่ Google Cloud Console แล้วรอสักครู่ก่อนโหลดหน้าใหม่',
          )
        }, RENDER_TIMEOUT_MS)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'โหลด Google Sign-In ไม่สำเร็จ')
      })

    return () => {
      cancelled = true
      clearTimeout(renderCheck)
      // ปลด callback ตอน unmount ไม่ให้ปุ่มที่หายไปแล้วยังรับผลลัพธ์ได้
      const state = gisState()
      if (state.callback === handleCredential) state.callback = null
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
