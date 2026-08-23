import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, type Classroom, createClassroom, listClassrooms } from '../lib/api'
import { isSignedIn } from '../lib/session'
import { LogoMark } from '../components/icons'

const TIMEZONES = ['Asia/Bangkok', 'Asia/Tokyo', 'UTC']

export default function ClassroomsPage() {
  const [items, setItems] = useState<Classroom[]>([])
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(TIMEZONES[0])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const signedIn = isSignedIn()

  const refresh = useCallback(async () => {
    if (!signedIn) {
      setLoaded(true)
      return
    }
    try {
      const { items } = await listClassrooms()
      setItems(items)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดรายการห้องเรียนไม่สำเร็จ')
    } finally {
      setLoaded(true)
    }
  }, [signedIn])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await createClassroom({ name, timezone })
      setName('')
      await refresh()
    } catch (err) {
      // แสดงข้อความจาก API ตรง ๆ เพราะ backend เป็นเจ้าของกฎ
      // ถ้า frontend เขียนข้อความเองจะเพี้ยนจากกฎจริงทันทีที่ backend เปลี่ยน
      setError(err instanceof ApiError ? err.message : 'สร้างห้องเรียนไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-line bg-white">
        <nav
          data-testid="main-nav"
          aria-label="เมนูหลัก"
          className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3.5"
        >
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <LogoMark className="size-7" />
            PairEval
          </Link>
          <span className="ml-auto text-sm text-muted">ห้องเรียนของฉัน</span>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">ห้องเรียนของฉัน</h1>

        {!signedIn && (
          <p
            data-testid="signin-required"
            className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700"
          >
            ต้องเข้าสู่ระบบก่อนจึงจะสร้างห้องเรียนได้
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-line bg-white p-6">
          <h2 className="text-lg font-semibold">สร้างห้องเรียนใหม่</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="classroom-name" className="block text-sm font-medium">
                ชื่อห้องเรียน
              </label>
              <input
                id="classroom-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-500"
                placeholder="เช่น Software Engineering 2026"
              />
            </div>

            <div>
              <label htmlFor="classroom-timezone" className="block text-sm font-medium">
                เขตเวลา
              </label>
              <select
                id="classroom-timezone"
                name="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-500"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p
              data-testid="error-msg"
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !signedIn}
            className="mt-5 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'กำลังสร้าง…' : 'สร้างห้องเรียน'}
          </button>
        </form>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">รายการห้องเรียน</h2>

          {loaded && items.length === 0 ? (
            <p data-testid="empty-state" className="mt-3 text-sm text-muted">
              ยังไม่มีห้องเรียน
            </p>
          ) : (
            <ul data-testid="classroom-list" className="mt-3 space-y-2">
              {items.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-line bg-white px-4 py-3"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted">{c.slug}</span>
                  <span className="ml-auto text-xs text-muted">{c.timezone}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
