import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppNav } from '../components/AppNav'
import { presentation } from '../components/NotificationBell'
import { BackChevron } from '../components/PageChrome'
import { Banner, FOCUS, btn } from '../components/Ui'
import { type Notification, listNotifications, readNotification } from '../lib/api'

/** หน้าการแจ้งเตือนเต็มหน้า ตาม Figma M02 — การ์ดเดียว ไอคอนตามประเภท กดแล้วถือว่าอ่าน */
export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => {
    setError(null)
    void listNotifications()
      .then((result) => setItems(result.items))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'โหลดการแจ้งเตือนไม่สำเร็จ'))
      .finally(() => setLoaded(true))
  }
  useEffect(refresh, [])
  function follow(item: Notification) {
    if (item.read) return
    void readNotification(item.id).catch(() => {})
  }
  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <AppNav context="การแจ้งเตือน" />
      <main className="mx-auto max-w-200 px-7 pt-8 pb-16 max-sm:px-4">
        <div className="relative mb-5 flex items-center gap-3">
          <BackChevron to="/classrooms" label="กลับห้องเรียนของฉัน" />
          <div>
            <h1 className="font-display text-[26px] font-bold">การแจ้งเตือน</h1>
            <p className="mt-1 text-sm text-ink-2">ยังไม่ได้อ่าน {items.filter((item) => !item.read).length} รายการ</p>
          </div>
        </div>
        {error && (
          <Banner tone="err" role="alert" className="mb-5">
            {error}
            <button type="button" onClick={refresh} className={btn('ghost', 'sm', 'ml-3')}>
              ลองใหม่
            </button>
          </Banner>
        )}
        <section className="overflow-hidden rounded-2xl border border-edge bg-white">
          {!loaded && (
            <p role="status" className="p-5 text-sm text-muted">
              กำลังโหลดการแจ้งเตือน…
            </p>
          )}
          {loaded && !items.length && !error && <p className="p-5 text-sm text-muted">ยังไม่มีการแจ้งเตือน</p>}
          <ul className="divide-y divide-edge">
            {items.map((item) => {
              const { icon, action } = presentation(item)
              return (
                <li
                  key={item.id}
                  className={`flex items-start gap-3 px-4.5 py-4 ${item.read ? 'bg-white' : 'bg-sand'}`}
                >
                  <span aria-hidden="true" className="mt-0.5 w-6 shrink-0 text-lg leading-6">
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-[15px] font-semibold leading-6">{item.title}</h2>
                    <p className="mt-1 text-[13.5px] leading-6 text-ink-2">{item.message}</p>
                    <Link
                      to={item.href}
                      onClick={() => follow(item)}
                      className={`mt-1 inline-flex min-h-9 items-center rounded text-sm font-semibold text-accent-ink ${FOCUS}`}
                    >
                      {action} →
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
        <p className="mt-4 text-xs leading-5 text-muted">
          ทุกการแจ้งเตือนพาไปหน้าที่ต้องทำโดยตรง · ไม่มีคะแนนของใครอยู่ในข้อความ (อีเมลก็เช่นกัน)
        </p>
      </main>
    </div>
  )
}
