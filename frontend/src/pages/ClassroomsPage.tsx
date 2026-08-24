import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { AppNav } from '../components/AppNav'
import { Dropdown, type DropdownOption } from '../components/Dropdown'
import { GoogleSignInButton } from '../components/GoogleSignInButton'
import { Avatar, Banner, CTRL, Card, Pill, btn } from '../components/Ui'
import {
  IconBulb,
  IconClock,
  IconGlobe,
  IconHistory,
  IconSearch,
  IconSortAZ,
  IconUsers,
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

const TIMEZONES = ['Asia/Bangkok', 'Asia/Tokyo', 'UTC'] as const
type Timezone = (typeof TIMEZONES)[number]

type SortOrder = 'recent' | 'name'

const SORT_OPTIONS: DropdownOption<SortOrder>[] = [
  {
    value: 'recent',
    label: 'อัปเดตล่าสุด',
    description: 'ห้องที่มีความเคลื่อนไหวล่าสุดอยู่ก่อน',
    icon: <IconHistory className="size-4" />,
  },
  {
    value: 'name',
    label: 'ชื่อ ก-ฮ',
    description: 'เรียงชื่อตามลำดับตัวอักษร',
    icon: <IconSortAZ className="size-4" />,
  },
]

const TIMEZONE_OPTIONS: DropdownOption<Timezone>[] = [
  {
    value: 'Asia/Bangkok',
    label: 'Asia/Bangkok',
    description: 'เวลาไทย · UTC+7',
    icon: <IconGlobe className="size-4" />,
  },
  {
    value: 'Asia/Tokyo',
    label: 'Asia/Tokyo',
    description: 'เวลาญี่ปุ่น · UTC+9',
    icon: <IconGlobe className="size-4" />,
  },
  {
    value: 'UTC',
    label: 'UTC',
    description: 'เวลามาตรฐานสากล · UTC+0',
    icon: <IconGlobe className="size-4" />,
  },
]

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
  const [timezone, setTimezone] = useState<Timezone>(TIMEZONES[0])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOrder>('recent')
  const [showCreate, setShowCreate] = useState(true)

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
      <AppNav context="ห้องเรียนของฉัน" profile={me} />

      <main className="mx-auto max-w-300 px-6 pt-8 pb-16 max-sm:px-4">
        <div className="mb-7 flex flex-wrap items-start gap-x-6 gap-y-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight max-sm:text-2xl">
              ห้องเรียนของฉัน
            </h1>
            <p className="mt-1.5 max-w-[62ch] text-muted">
              สร้างและจัดการห้องเรียนสำหรับการประเมินแบบเพื่อนประเมินเพื่อน
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-accent-line bg-accent-soft px-4 font-display text-sm font-semibold text-accent-ink">
              <IconUsers className="size-4" />
              <span className="font-mono tabular">{items.length}</span> ห้องเรียน
            </span>
            {signedIn && (
              <button
                type="button"
                onClick={() => setShowCreate((value) => !value)}
                className={btn(showCreate ? 'ghost' : 'primary', 'md')}
              >
                {showCreate ? 'ซ่อนแบบฟอร์ม' : 'เพิ่มห้องเรียน'}
              </button>
            )}
          </div>
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

        {(showCreate || !signedIn) && (
          <Card className="mb-5">
            <form onSubmit={handleSubmit} className="p-5 max-sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">สร้างห้องเรียนใหม่</h2>
                  <p className="mt-1 text-[13.5px] text-muted">
                    ตั้งชื่อและเขตเวลาให้เรียบร้อย แล้วจึงเพิ่มสมาชิกในหน้าห้องเรียน
                  </p>
                </div>
                <p className="flex items-center gap-2 text-xs text-accent-ink">
                  <IconBulb className="size-4" /> เพิ่มสมาชิกภายหลังได้
                </p>
              </div>

              <div className="mt-4 grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto]">
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
                  <label id="classroom-timezone-label" className="mb-1.5 block text-sm font-medium">
                    เขตเวลา <span className="text-err">*</span>
                  </label>
                  <Dropdown
                    id="classroom-timezone"
                    name="timezone"
                    value={timezone}
                    options={TIMEZONE_OPTIONS}
                    onChange={setTimezone}
                    ariaLabelledby="classroom-timezone-label"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || !signedIn}
                  className={btn('primary', 'md', 'md:mb-px')}
                >
                  {submitting ? 'กำลังสร้าง…' : 'สร้างห้องเรียน'}
                </button>
              </div>

              {error && (
                <Banner tone="err" data-testid="error-msg" role="alert" className="mt-4">
                  {error}
                </Banner>
              )}
            </form>
          </Card>
        )}

        <div>
          <Card className="min-w-0">
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
                <Dropdown
                  value={sort}
                  options={SORT_OPTIONS}
                  onChange={setSort}
                  ariaLabel="เรียงลำดับ"
                  className="shrink-0 sm:w-52"
                />
              </div>

              <div className="mt-5">
                {loaded && items.length === 0 ? (
                  <p data-testid="empty-state" className="py-10 text-center text-sm text-muted">
                    ยังไม่มีห้องเรียน
                  </p>
                ) : visibleItems.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted">ไม่พบห้องเรียนที่ค้นหา</p>
                ) : (
                  <ul data-testid="classroom-list" className="grid gap-3 md:grid-cols-2">
                    {visibleItems.map((c) => (
                      <li key={c.id}>
                        <div className="flex h-full flex-col rounded-xl border border-edge bg-white p-4 transition-colors hover:border-edge-strong hover:shadow-[0_4px_16px_rgba(23,32,51,0.06)]">
                          <div className="flex items-start gap-3">
                            <Avatar name={c.name} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-display font-semibold">{c.name}</p>
                              <p className="mt-0.5 truncate text-[13px] text-muted">{c.slug}</p>
                            </div>
                            <ClassroomStatusPill status={c.status} />
                          </div>

                          <div className="mt-4 flex items-center gap-1.5 text-[13px] text-muted">
                            <IconClock className="size-3.5" />
                            เขตเวลา {c.timezone}
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3 border-t border-edge pt-3">
                            <span className="text-xs text-muted">
                              {me?.classrooms.find((item) => item.classroomId === c.id)?.role === 'STUDENT'
                                ? 'นักศึกษา'
                                : 'ทีมผู้สอน'}
                            </span>
                            <Link to={`/classrooms/${c.id}`} className={btn('primary', 'sm')}>
                              เปิดห้องเรียน
                            </Link>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
