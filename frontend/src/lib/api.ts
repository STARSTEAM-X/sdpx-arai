import { useEffect, useState } from 'react'

import { getToken } from './session'

// build-time env ของ Vite — เปลี่ยนค่าแล้วต้อง rebuild ไม่ใช่แค่ restart
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

/** error shape มาตรฐานของ API — ตรงกับ docs/openapi.yaml */
export type ApiErrorBody = {
  error: {
    code: string
    message: string
    field?: string | null
    requestId: string
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly field?: string | null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** เรียก API พร้อมแนบ session token และแปลง error ให้เป็น ApiError เสมอ
 *
 *  รวมไว้ที่เดียวเพื่อไม่ให้แต่ละหน้าตีความ error กันคนละแบบ
 *  หน้าจอจึงแสดงข้อความจาก `message` ได้ตรง ๆ โดยไม่ต้องรู้ status code
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (res.ok) {
    return (res.status === 204 ? undefined : await res.json()) as T
  }

  let code = 'UNKNOWN'
  let message = `เกิดข้อผิดพลาด (HTTP ${res.status})`
  let field: string | null = null

  try {
    const body = (await res.json()) as Partial<ApiErrorBody> & { detail?: unknown }
    if (body.error) {
      code = body.error.code
      message = body.error.message
      field = body.error.field ?? null
    } else if (typeof body.detail === 'string') {
      // FastAPI ตอบ {"detail": "..."} เมื่อ error ไม่ได้ผ่าน handler ของเรา
      // เช่น request ที่ไม่ match route ใดเลย — ทิ้งข้อความนั้นไปทำให้ debug ยากขึ้นเปล่า ๆ
      message = body.detail
    }
  } catch {
    // response ที่ไม่ใช่ JSON — ใช้ข้อความ default ไป ไม่ต้องทำให้พังซ้ำ
  }

  // 404 ที่ยังได้ข้อความกลางอย่าง "Not Found" แปลว่าไม่มี route นี้บน server
  // ไม่ใช่ "ไม่พบข้อมูลที่ขอ" (ซึ่งฝั่งเราจะตอบเป็นข้อความไทยที่เจาะจงกว่านี้เสมอ)
  // เคสที่เกิดจริงคือหน้าเว็บถูก deploy ใหม่แล้วแต่ backend ยังเป็นเวอร์ชันเก่า
  // ถ้าไม่บอกตรงนี้ คนอ่าน error จะไล่หาสาเหตุที่ตัว request แทนที่จะดูว่า API เวอร์ชันอะไร
  if (res.status === 404 && (code === 'UNKNOWN' || message === 'Not Found')) {
    code = 'ENDPOINT_NOT_FOUND'
    message =
      `API ที่ ${API_BASE_URL} ไม่มี endpoint ${path} — ` +
      'backend ที่ deploy อยู่อาจเป็นเวอร์ชันเก่ากว่าหน้าเว็บ'
  }

  throw new ApiError(res.status, code, message, field)
}

export type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; version: string }
  | { status: 'error'; message: string }

/** ยิง /api/health เพื่อพิสูจน์ว่า backend ขึ้นจริงและ CORS ตั้งถูก */
export function useApiHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: 'loading' })

  useEffect(() => {
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

// --- Auth (US-01) ---

export type Me = {
  userId: string
  email: string
  displayName: string | null
  status: string
  classrooms: { classroomId: string; classroomName: string; role: string }[]
}

/** ส่ง id_token ของ Google ให้ backend ตรวจ แล้วรับ session ของระบบเรากลับมา
 *
 *  ห้ามใช้ id_token ของ Google เป็น session ตรง ๆ — frontend ตรวจลายเซ็นเองไม่ได้
 *  และ token ของ Google ไม่ได้ผูกกับสิทธิ์ในระบบเรา
 */
export function signInWithGoogle(idToken: string): Promise<{ accessToken: string; user: Me }> {
  return apiFetch<{ accessToken: string; user: Me }>('/api/auth/session', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })
}

export function getMe(): Promise<Me> {
  return apiFetch<Me>('/api/me')
}

// --- Classroom (US-02) ---

export type Classroom = {
  id: string
  name: string
  slug: string
  timezone: string
  allowedEmailDomains: string[]
  status: string
}

export function listClassrooms(): Promise<{ items: Classroom[] }> {
  return apiFetch<{ items: Classroom[] }>('/api/classrooms')
}

export function createClassroom(input: {
  name: string
  timezone: string
  allowedEmailDomains?: string[]
}): Promise<Classroom> {
  return apiFetch<Classroom>('/api/classrooms', {
    method: 'POST',
    body: JSON.stringify({ allowedEmailDomains: [], ...input }),
  })
}
