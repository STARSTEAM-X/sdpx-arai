import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppNav } from '../components/AppNav'
import { Banner, Card, FOCUS, btn } from '../components/Ui'
import { IconBack, IconClipboardCheck } from '../components/icons'
import { type Notification, listNotifications, readNotification } from '../lib/api'

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => {
    setError(null)
    void listNotifications().then((result) => setItems(result.items)).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'โหลดการแจ้งเตือนไม่สำเร็จ')).finally(() => setLoaded(true))
  }
  useEffect(refresh, [])
  return <div className="min-h-screen bg-ground font-body text-ink">
    <AppNav context="การแจ้งเตือน" />
    <main className="mx-auto max-w-304 px-7 pt-7 pb-16 max-sm:px-4">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/classrooms" aria-label="กลับห้องเรียนของฉัน" className={`grid size-11 shrink-0 place-items-center rounded-full text-brand-600 ${FOCUS}`}><IconBack className="size-10" /></Link>
        <div><h1 className="font-display text-2xl font-bold">การแจ้งเตือน</h1><p className="mt-1 text-sm text-muted">ยังไม่ได้อ่าน {items.filter((item) => !item.read).length} รายการ</p></div>
      </div>
      {error && <Banner tone="err" role="alert" className="mb-5">{error}<button type="button" onClick={refresh} className={btn('ghost', 'sm', 'ml-3')}>ลองใหม่</button></Banner>}
      <Card className="overflow-hidden">
        {!loaded && <p role="status" className="p-5 text-sm text-muted">กำลังโหลดการแจ้งเตือน…</p>}
        {loaded && !items.length && !error && <p className="p-5 text-sm text-muted">ยังไม่มีการแจ้งเตือน</p>}
        <ul className="divide-y divide-edge">
          {items.map((item) => <li key={item.id} className={`flex items-start gap-3 p-5 max-sm:p-4 ${item.read ? 'bg-white' : 'bg-sand'}`}>
            <IconClipboardCheck className="mt-1 size-5 shrink-0 text-brand-600" />
            <div className="min-w-0"><h2 className="font-display text-base font-semibold">{item.title}</h2><p className="mt-2 text-sm leading-6 text-muted">{item.message}</p>
              <Link to={item.href} onClick={() => { void readNotification(item.id).catch(() => {}) }} className={`mt-1 inline-flex min-h-11 items-center rounded text-sm font-semibold text-accent-ink ${FOCUS}`}>{item.href.endsWith('/score') ? 'ดูคะแนนของฉัน' : item.href.endsWith('/appeal') ? 'ดูคำตอบคำร้อง' : 'ไปหน้าประเมิน'} →</Link>
              {!item.read && <button type="button" className={`ml-3 min-h-11 text-xs text-ink-2 underline underline-offset-4 ${FOCUS}`} onClick={() => { void readNotification(item.id).then(refresh).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'ทำเครื่องหมายอ่านไม่สำเร็จ')) }}>อ่านแล้ว</button>}
            </div>
          </li>)}
        </ul>
      </Card>
      <p className="mt-4 text-xs leading-5 text-muted">ทุกการแจ้งเตือนพาไปหน้าที่ต้องทำโดยตรง · ไม่มีคะแนนของใครอยู่ในข้อความ</p>
    </main>
  </div>
}
