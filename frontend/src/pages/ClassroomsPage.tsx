import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { GoogleSignInButton } from '../components/GoogleSignInButton'
import { Avatar, Banner, CTRL, Card, Pill, btn } from '../components/Ui'
import {
  IconBulb,
  IconChevronDown,
  IconClock,
  IconDots,
  IconGlobe,
  IconLogOut,
  IconSearch,
  IconUsers,
  LogoMark,
} from '../components/icons'
import {
  ApiError,
  type Classroom,
  type Me,
  createClassroom,
  getMe,
  listClassrooms,
} from '../lib/api'
import { clearToken, isSignedIn } from '../lib/session'

const TIMEZONES = ['Asia/Bangkok', 'Asia/Tokyo', 'UTC']

type SortOrder = 'recent' | 'name'

/** สถานะห้องเรียนตาม PRD §11 (`ACTIVE|ARCHIVED`) — คนละชุดกับสถานะสมาชิกใน Ui.tsx */
function ClassroomStatusPill({ status }: { status: string }) {
  if (status === 'ARCHIVED') return <Pill>เก็บถาวร</Pill>
  return <Pill tone="ok">พร้อมใช้งาน</Pill>
}

export default function ClassroomsPage() {
  const [signedIn, setSignedIn] = useState(isSignedIn)
  const [me, setMe] = useState<Me | null>(null)
  const [items, setItems] = useState<Classroom[]>([])
  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(TIMEZONES[0])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOrder>('recent')

  const refresh = useCallback(async () => {
    if (!signedIn) {
      setLoaded(true)
      return
    }
    try {
      const [profile, { items }] = await Promise.all([getMe(), listClassrooms()])
      setMe(profile)
      setItems(items)
    } catch (err) {
      // session หมดอายุหรือถูกเพิกถอน — พากลับไปสถานะยังไม่ login แทนที่จะค้างหน้าเปล่า
      if (err instanceof ApiError && err.status === 401) {
        clearToken()
        setSignedIn(false)
        setMe(null)
      } else {
        setError(err instanceof ApiError ? err.message : 'โหลดรายการห้องเรียนไม่สำเร็จ')
      }
    } finally {
      setLoaded(true)
    }
  }, [signedIn])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function handleSignedIn() {
    setSignedIn(true)
    setError(null)
  }

  function handleSignOut() {
    clearToken()
    setSignedIn(false)
    setMe(null)
    setItems([])
  }

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

  // ค้นหา + เรียงลำดับทำฝั่ง client เพราะจำนวนห้องเรียนต่ออาจารย์เล็กมาก
  // (ไม่คุ้มเพิ่ม query param ให้ backend สำหรับ list ที่ไม่เกินไม่กี่สิบแถว)
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? items.filter(
          (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
        )
      : items
    return sort === 'name'
      ? [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'th'))
      : filtered
  }, [items, search, sort])

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <header className="sticky top-0 z-40 border-b border-edge bg-white/88 shadow-[0_1px_2px_rgba(23,32,51,0.05)] backdrop-blur">
        <nav
          data-testid="main-nav"
          aria-label="เมนูหลัก"
          className="mx-auto flex h-16 max-w-300 items-center gap-4 px-6 max-sm:px-4"
        >
          <Link
            to="/"
            className="flex min-h-11 items-center gap-2.5 font-display text-[19px] font-bold tracking-tight"
          >
            <LogoMark className="size-8" />
            PairEval
          </Link>

          {signedIn && (
            <div className="ml-auto flex items-center gap-2">
              <span
                data-testid="current-user"
                className="flex min-h-11 items-center gap-2 rounded-lg px-2"
              >
                <Avatar name={me?.displayName ?? me?.email ?? '?'} />
                <span className="text-sm font-medium max-sm:hidden">
                  {me?.displayName ?? me?.email ?? 'กำลังโหลด…'}
                </span>
                <IconChevronDown className="size-4 text-muted" />
              </span>
              <button type="button" onClick={handleSignOut} className={btn('ghost', 'sm')}>
                <IconLogOut className="size-4" />
                ออกจากระบบ
              </button>
            </div>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-300 px-6 pt-8 pb-16 max-sm:px-4">
        <div className="mb-8 flex flex-wrap items-start gap-x-6 gap-y-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight max-sm:text-2xl">
              ห้องเรียนของฉัน
            </h1>
            <p className="mt-1.5 max-w-[62ch] text-muted">
              สร้างและจัดการห้องเรียนสำหรับการประเมินแบบเพื่อนประเมินเพื่อน
            </p>
          </div>

          <span className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-accent-line bg-accent-soft px-4 font-display text-sm font-semibold text-accent-ink">
            <IconUsers className="size-4" />
            <span className="font-mono tabular">{items.length}</span> ห้องเรียน
          </span>
        </div>

        {!signedIn && (
          <div
            data-testid="signin-required"
            className="mb-6 rounded-2xl border border-accent-line bg-accent-soft p-6"
          >
            <p className="text-[14.5px] text-accent-ink">
              ต้องเข้าสู่ระบบด้วยบัญชีมหาวิทยาลัยก่อนจึงจะสร้างห้องเรียนได้
            </p>
            <div className="mt-4">
              <GoogleSignInButton onSignedIn={handleSignedIn} />
            </div>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-12">
          <Card className="min-w-0 lg:col-span-8">
            <div className="p-6 max-sm:p-4">
              <h2 className="font-display text-lg font-semibold">รายการห้องเรียน</h2>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <IconSearch className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ค้นหาห้องเรียน"
                    aria-label="ค้นหาห้องเรียน"
                    className={`${CTRL} pl-10`}
                  />
                </div>
                {/* ห่อด้วย div ที่กำหนดความกว้างแทนการต่อ "w-auto" ท้าย CTRL
                    เพราะ CTRL มี w-full ฝังอยู่แล้ว — ลำดับ class ของ Tailwind ตัดสินกันที่
                    stylesheet ไม่ใช่ตัวที่เขียนทีหลัง จึง "w-auto" แพ้ไม่แน่นอน (ดู btn() ใน Ui.tsx) */}
                <div className="relative shrink-0 sm:w-48">
                  {/* appearance-none ปิดลูกศรเดิมของ browser เพราะตำแหน่งมันชิดขอบเกินไป
                      ไม่ตรงกับ padding ที่เหลือ component ในหน้านี้ใช้ — วาดเองแทนให้ระยะเท่ากันทุกช่อง */}
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOrder)}
                    aria-label="เรียงลำดับ"
                    className={`${CTRL} appearance-none pr-10`}
                  >
                    <option value="recent">อัปเดตล่าสุด</option>
                    <option value="name">ชื่อ ก-ฮ</option>
                  </select>
                  <IconChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
                </div>
              </div>

              <div className="mt-5">
                {loaded && items.length === 0 ? (
                  <p data-testid="empty-state" className="py-10 text-center text-sm text-muted">
                    ยังไม่มีห้องเรียน
                  </p>
                ) : visibleItems.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted">ไม่พบห้องเรียนที่ค้นหา</p>
                ) : (
                  <ul data-testid="classroom-list" className="flex flex-col gap-3">
                    {visibleItems.map((c) => (
                      <li key={c.id}>
                        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-edge bg-white p-4 transition-colors hover:border-edge-strong">
                          <Avatar name={c.name} />

                          <div className="min-w-0">
                            <p className="truncate font-display font-semibold">{c.name}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                              <span>{c.slug}</span>
                              <span className="inline-flex items-center gap-1">
                                <IconClock className="size-3.5" />
                                {c.timezone}
                              </span>
                            </p>
                          </div>

                          <div className="ml-auto flex shrink-0 items-center gap-2">
                            <ClassroomStatusPill status={c.status} />
                            <Link to={`/classrooms/${c.id}`} className={btn('primary', 'sm')}>
                              จัดการรายชื่อ
                            </Link>
                            <button
                              type="button"
                              disabled
                              title="ยังไม่เปิดใช้งานเมนูนี้"
                              aria-label={`ตัวเลือกเพิ่มเติมของห้องเรียน ${c.name} (ยังไม่เปิดใช้งาน)`}
                              className="grid size-9 shrink-0 place-items-center rounded-lg text-muted disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <IconDots className="size-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-4 lg:col-span-4">
            <Card>
              <form onSubmit={handleSubmit} className="p-6 max-sm:p-4">
                <h2 className="font-display text-lg font-semibold">สร้างห้องเรียนใหม่</h2>
                <p className="mt-1 text-[13.5px] text-muted">
                  ตั้งชื่อห้องเรียนและเลือกเขตเวลาที่ใช้กำหนดวันส่งงาน
                </p>

                <div className="mt-5 flex flex-col gap-4">
                  <div>
                    <label htmlFor="classroom-name" className="mb-1.5 block text-sm font-medium">
                      ชื่อห้องเรียน <span className="text-err">*</span>
                    </label>
                    <input
                      id="classroom-name"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="เช่น Software Engineering 2026"
                      className={CTRL}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="classroom-timezone"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      เขตเวลา <span className="text-err">*</span>
                    </label>
                    <div className="relative">
                      <IconGlobe className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
                      <select
                        id="classroom-timezone"
                        name="timezone"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className={`${CTRL} appearance-none pl-10 pr-10`}
                      >
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                      <IconChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
                    </div>
                    <p className="mt-1.5 text-[12.5px] text-muted">
                      ใช้สำหรับกำหนดวันและเวลาส่งงาน
                    </p>
                  </div>
                </div>

                {error && (
                  <Banner tone="err" data-testid="error-msg" role="alert" className="mt-4">
                    {error}
                  </Banner>
                )}

                <button
                  type="submit"
                  disabled={submitting || !signedIn}
                  className={btn('primary', 'md', 'mt-5 w-full')}
                >
                  {submitting ? 'กำลังสร้าง…' : 'สร้างห้องเรียน'}
                </button>
              </form>
            </Card>

            <div className="flex items-start gap-3 rounded-2xl border border-accent-line bg-accent-soft p-4">
              <IconBulb className="mt-0.5 size-4.5 shrink-0 text-accent-ink" />
              <p className="text-[12.5px] leading-relaxed text-accent-ink">
                คุณสามารถเพิ่มสมาชิกหลังสร้างห้องเรียนได้
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
