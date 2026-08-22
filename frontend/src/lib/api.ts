import { useEffect, useState } from 'react'

// build-time env ของ Vite — เปลี่ยนค่าแล้วต้อง rebuild ไม่ใช่แค่ restart
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; version: string }
  | { status: 'error'; message: string }

/** ยิง /api/health เพื่อพิสูจน์ว่า backend ขึ้นจริงและ CORS ตั้งถูก */
export function useApiHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: 'loading' })

  useEffect(() => {
    // ยกเลิก request ถ้า component ถูก unmount ก่อนได้คำตอบ กัน state update หลัง unmount
    const controller = new AbortController()

    fetch(`${API_BASE_URL}/api/health`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`API ตอบ ${res.status}`)
        const body = (await res.json()) as { status: string; version: string }
        setState({ status: 'ok', version: body.version })
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'เชื่อมต่อไม่ได้',
        })
      })

    return () => controller.abort()
  }, [])

  return state
}
