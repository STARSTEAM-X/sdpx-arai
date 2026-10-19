import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { type Notification, listNotifications, readNotification } from '../lib/api'
import { IconBell } from './icons'
import { FOCUS } from './Ui'
import { useMenu } from './useMenu'

export function presentation(item: Notification) {
  if (item.href.endsWith('/score')) return { icon: '📣', action: 'ดูคะแนนของฉัน' }
  if (item.href.endsWith('/appeal')) return { icon: '💬', action: 'ดูคำตอบคำร้อง' }
  if (item.id.includes(':due:')) return { icon: '⏳', action: 'ประเมินต่อ' }
  if (item.id.includes(':regenerated:')) return { icon: '🔁', action: 'ดูคู่ใหม่' }
  if (item.id.includes(':assigned:')) return { icon: '➕', action: 'ไปประเมิน' }
  return { icon: '🔔', action: 'ไปหน้าประเมิน' }
}

export function NotificationBell() {
  const { open, setOpen, rootRef, triggerRef, onKeyDown } = useMenu()
  const panelId = useId()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const requestSequence = useRef(0)

  const refresh = useCallback(() => {
    const request = ++requestSequence.current
      void listNotifications().then((result) => {
        if (request !== requestSequence.current) return
        setItems(result.items)
        setUnread(result.unreadCount)
        setError(false)
      }).catch(() => { if (request === requestSequence.current) setError(true) })
        .finally(() => { if (request === requestSequence.current) setLoaded(true) })
  }, [])
  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 60000)
    return () => { requestSequence.current += 1; window.clearInterval(timer) }
  }, [refresh])

  function follow(item: Notification) {
    setOpen(false)
    if (item.read) return
    void readNotification(item.id).then(() => {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry))
      setUnread((current) => Math.max(0, current - 1))
      refresh()
    }).catch(() => { /* Navigation remains available; next refresh retries the unread state. */ })
  }

  return <div ref={rootRef} onKeyDown={onKeyDown} className="relative">
    <button ref={triggerRef} type="button" aria-label={`การแจ้งเตือน ${unread} รายการยังไม่ได้อ่าน`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? panelId : undefined}
      onClick={() => { if (!open) refresh(); setOpen((value) => !value) }} className={`relative grid size-11 shrink-0 place-items-center rounded-full text-brand-600 hover:bg-accent-soft ${FOCUS}`}>
      <IconBell className="size-6" />
      {unread > 0 && <span aria-hidden="true" className="absolute top-0 right-0 grid min-w-4 place-items-center rounded-full bg-err px-1 text-[10px] text-white">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <div id={panelId} role="menu" aria-label="การแจ้งเตือน" className="absolute top-[calc(100%+0.5rem)] -right-16 z-50 w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-edge bg-white text-ink shadow-[0_12px_30px_rgba(50,16,7,0.16)] max-sm:fixed max-sm:top-18 max-sm:right-4">
      <h2 className="border-b border-edge px-4.5 py-3.5 font-display text-[17px] font-semibold">การแจ้งเตือน</h2>
      <div className="max-h-[min(470px,calc(100dvh-15rem))] overflow-y-auto overscroll-contain">
        {!loaded && <p role="status" className="px-5 py-4 text-sm text-muted">กำลังโหลดการแจ้งเตือน…</p>}
        {error && <div className="px-5 py-4"><p role="alert" className="text-sm text-err">โหลดการแจ้งเตือนไม่สำเร็จ</p><button role="menuitem" type="button" onClick={refresh} className={`min-h-11 rounded text-sm font-semibold text-accent-ink ${FOCUS}`}>ลองใหม่</button></div>}
        {loaded && !error && items.length === 0 && <p className="px-5 py-5 text-sm text-muted">ยังไม่มีการแจ้งเตือน</p>}
        {items.map((item) => {
          const { icon, action } = presentation(item)
          return <Link key={item.id} to={item.href} role="menuitem" onClick={() => follow(item)} className={`flex gap-3 border-b border-edge px-4.5 py-3.25 last:border-b-0 hover:bg-accent-soft ${item.read ? 'bg-white' : 'bg-sand'} ${FOCUS}`}>
            <span aria-hidden="true" className="mt-0.5 w-5 shrink-0 text-lg leading-5">{icon}</span>
            <span className="min-w-0"><span className="block text-sm leading-5 font-semibold">{item.title}</span><span className="mt-1 block text-[13px] leading-5 text-muted">{item.message}</span><span className="mt-1 block text-sm font-semibold text-accent-ink">{action} →</span></span>
          </Link>
        })}
      </div>
      <p className="border-t border-edge px-4.5 py-2.5 text-xs leading-5 text-muted">ทุกการแจ้งเตือนพาไปหน้าที่ต้องทำโดยตรง · ไม่มีคะแนนของใครอยู่ในข้อความ (อีเมลก็เช่นกัน)</p>
    </div>}
  </div>
}
