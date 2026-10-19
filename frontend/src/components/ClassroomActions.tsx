import { useRef, useState } from 'react'
import { type Classroom, archiveClassroom, deleteClassroom } from '../lib/api'
import { Banner, btn } from './Ui'
import { IconDots } from './icons'
import { useMenu } from './useMenu'

export function ClassroomActions({ room, onChanged }: { room: Classroom; onChanged: () => Promise<void> }) {
  const { open, setOpen, rootRef, triggerRef, onKeyDown } = useMenu()
  const dialog = useRef<HTMLDialogElement>(null)
  const [action, setAction] = useState<'archive' | 'restore' | 'delete'>('archive')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  function show(next: typeof action) {
    setAction(next); setError(null); setOpen(false); dialog.current?.showModal()
  }
  async function submit() {
    setBusy(true); setError(null)
    try {
      if (action === 'delete') await deleteClassroom(room.id)
      else await archiveClassroom(room.id, action === 'archive')
      dialog.current?.close()
      await onChanged()
      triggerRef.current?.focus()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'ทำรายการไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  const title = action === 'archive' ? 'Archive ห้องเรียนนี้?' : action === 'restore' ? 'คืนห้องเรียนนี้?' : 'ลบห้องเรียนนี้?'
  return <div ref={rootRef} onKeyDown={onKeyDown} className="relative">
    <button ref={triggerRef} type="button" aria-label={`จัดการห้องเรียน ${room.name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className={btn('ghost', 'sm')}><IconDots className="size-5" /></button>
    {open && <div role="menu" className="absolute top-full right-0 z-20 mt-2 w-52 rounded-2xl border border-edge bg-white p-2 shadow-lg">
      <button type="button" role="menuitem" onClick={() => show(room.status === 'ARCHIVED' ? 'restore' : 'archive')} className="min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-sand">{room.status === 'ARCHIVED' ? 'คืนห้องเรียน' : 'Archive ห้องเรียน'}</button>
      <button type="button" role="menuitem" onClick={() => show('delete')} className="min-h-11 w-full rounded-lg px-3 text-left text-sm text-err hover:bg-err-soft">ลบห้องเรียนว่าง</button>
    </div>}
    <dialog ref={dialog} aria-labelledby={`room-action-${room.id}`} onClose={() => triggerRef.current?.focus()} onCancel={(event) => { if (busy) event.preventDefault() }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-3xl border border-edge bg-white p-7 text-ink shadow-xl backdrop:bg-ink/40">
      <h2 id={`room-action-${room.id}`} className="font-display text-xl font-bold">{title}</h2><p className="mt-2 text-sm text-muted">{room.name}</p>
      <Banner tone={action === 'delete' ? 'warn' : 'info'} className="mt-5">{action === 'archive' ? 'ห้องจะเป็นอ่านอย่างเดียวและย้ายไปแท็บเก็บถาวร ยังดูคะแนน รายงาน และส่งออกได้ คืนห้องเรียนได้ทุกเมื่อ' : action === 'restore' ? 'ห้องจะกลับมาอยู่ในรายการใช้งาน และแก้ไขข้อมูลได้ตามสิทธิ์เดิม' : 'ลบได้เฉพาะห้องว่างที่ไม่มีสมาชิกเพิ่มเติม งาน กลุ่ม หรือประวัติการใช้งาน การลบย้อนกลับไม่ได้'}</Banner>
      {error && <Banner tone="err" role="alert" className="mt-4">{error}</Banner>}
      <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => { dialog.current?.close(); triggerRef.current?.focus() }} className={btn('ghost')}>ยกเลิก</button><button type="button" disabled={busy} onClick={() => void submit()} className={btn('primary')}>{busy ? 'กำลังดำเนินการ…' : action === 'archive' ? 'Archive' : action === 'restore' ? 'คืนห้องเรียน' : 'ยืนยันลบห้องเรียน'}</button></div>
    </dialog>
  </div>
}
