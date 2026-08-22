import { useEffect, useState } from 'react'

// build-time env ของ Vite — เปลี่ยนค่าแล้วต้อง rebuild ไม่ใช่แค่ restart
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; version: string }
  | { status: 'error'; message: string }

/** ยิง /api/health เพื่อพิสูจน์ว่า backend ขึ้นจริงและ CORS ตั้งถูก */
function useApiHealth(): HealthState {
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
        setState({ status: 'error', message: err instanceof Error ? err.message : 'เชื่อมต่อไม่ได้' })
      })

    return () => controller.abort()
  }, [])

  return state
}

function ApiStatusBadge() {
  const health = useApiHealth()

  const style = {
    loading: 'bg-slate-100 text-slate-600 ring-slate-300',
    ok: 'bg-emerald-50 text-emerald-700 ring-emerald-300',
    error: 'bg-rose-50 text-rose-700 ring-rose-300',
  }[health.status]

  const label = {
    loading: 'กำลังตรวจสอบ API…',
    ok: health.status === 'ok' ? `API พร้อมใช้งาน · ${health.version}` : '',
    error: health.status === 'error' ? `API ไม่ตอบสนอง — ${health.message}` : '',
  }[health.status]

  return (
    <span
      data-testid="api-status"
      data-status={health.status}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ring-1 ${style}`}
    >
      <span className="size-2 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav data-testid="main-nav" className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <a href="/" className="text-lg font-semibold tracking-tight">
            Pair<span className="text-indigo-600">Eval</span>
          </a>
          <ul className="flex items-center gap-6 text-sm text-slate-600">
            <li>
              <a href="/" className="hover:text-slate-900">
                หน้าแรก
              </a>
            </li>
            <li>
              <a href="/assignments" className="hover:text-slate-900">
                งานที่ต้องประเมิน
              </a>
            </li>
            <li>
              <a href="/reports" className="hover:text-slate-900">
                รายงาน
              </a>
            </li>
          </ul>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-16">
        <ApiStatusBadge />

        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
          ระบบประเมินผลแบบ<span className="text-indigo-600">จับคู่เปรียบเทียบ</span>
        </h1>

        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          แทนที่จะให้คะแนนงานทีละชิ้นด้วยมาตรฐานที่เลื่อนไปมา PairEval
          ให้ผู้ประเมินเทียบงานครั้งละสองชิ้น แล้วคำนวณคะแนนจากผลการเปรียบเทียบทั้งหมด
        </p>

        <div className="mt-8">
          <a
            data-testid="main-cta"
            href="/assignments"
            className="inline-flex rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-500"
          >
            เริ่มประเมินงาน
          </a>
        </div>

        {/* Placeholder ของ feature หลัก — ของจริงจะมาแทนที่ตั้งแต่ WS-03 เป็นต้นไป */}
        <section
          data-testid="feature-placeholder"
          className="mt-16 rounded-xl border border-dashed border-slate-300 bg-white p-8"
        >
          <h2 className="text-xl font-semibold">หน้าจอเปรียบเทียบงาน</h2>
          <p className="mt-2 text-slate-600">
            ส่วนนี้จะเป็นหน้าที่แสดงงานสองชิ้นคู่กัน ให้ผู้ประเมินเลือกด้วยมาตรวัด 6 ระดับ
            โดยสลับตำแหน่งซ้าย-ขวาแบบสุ่มเพื่อลด position bias
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="h-32 rounded-lg bg-slate-100" />
            <div className="h-32 rounded-lg bg-slate-100" />
          </div>
          <p className="mt-4 text-sm text-slate-500">ยังไม่เปิดใช้งาน — จะพัฒนาใน WS-03 เป็นต้นไป</p>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-12 text-sm text-slate-500">
        SDPX-AI · WS-01 First Deploy
      </footer>
    </div>
  )
}
