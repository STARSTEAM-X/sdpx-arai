import { useRef, useState } from 'react'

import { type Classroom, archiveClassroom, deleteClassroom } from '../lib/api'
import { ClassroomCreateForm } from './ClassroomCreateForm'
import { CTRL, btn } from './Ui'
import { useMenu } from './useMenu'
import { thaiDate } from '../lib/datetime'

type Action = 'archive' | 'restore' | 'delete' | 'blocked' | 'edit'


/** เมนู "···" ของห้องที่เป็นเจ้าของ ตาม Figma J04 · J04c · J04d · J04e · J04f */
export function ClassroomActions({ room, onChanged }: { room: Classroom; onChanged: () => Promise<void> }) {
  const { open, setOpen, rootRef, triggerRef, onKeyDown } = useMenu()
  const dialog = useRef<HTMLDialogElement>(null)
  const [action, setAction] = useState<Action>('archive')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const archived = room.status === 'ARCHIVED'
  // ห้องที่ยังไม่มีนักศึกษาและงานประเมินลบได้ (J04e) นอกนั้นให้ archive แทน (J04f)
  const empty = (room.studentCount ?? 0) === 0 && (room.assignmentCount ?? 0) === 0

  function show(next: Action) {
    setAction(next === 'delete' && !empty ? 'blocked' : next)
    setError(null)
    setConfirmName('')
    setOpen(false)
    dialog.current?.showModal()
  }

  function close() {
    dialog.current?.close()
    triggerRef.current?.focus()
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      if (action === 'delete') await deleteClassroom(room.id)
      else await archiveClassroom(room.id, action === 'archive')
      dialog.current?.close()
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ทำรายการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const item = 'flex min-h-11 w-full items-center rounded-lg px-5 text-left font-display text-[14.5px] font-semibold hover:bg-sand'

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`จัดการห้องเรียน ${room.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`${btn('ghost', 'sm', 'h-9.5 min-h-9.5 w-15.5 border-brand-600 text-accent-ink')}`}
      >
        ···
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-20 mt-2 w-50 rounded-2xl border border-edge bg-white py-2.5 shadow-[0_12px_30px_rgba(50,16,7,0.12)]">
          {!archived && <button type="button" role="menuitem" onClick={() => show('edit')} className={item}>แก้ไขข้อมูลห้อง</button>}
          <button type="button" role="menuitem" onClick={() => show(archived ? 'restore' : 'archive')} className={item}>
            {archived ? 'Unarchive ห้องเรียน' : 'Archive ห้องเรียน'}
          </button>
          <button type="button" role="menuitem" onClick={() => show('delete')} className={`${item} text-err hover:bg-err-soft`}>ลบห้องเรียน</button>
        </div>
      )}

      <dialog
        ref={dialog}
        aria-labelledby={`room-action-${room.id}`}
        onClose={() => triggerRef.current?.focus()}
        onCancel={(event) => { if (busy) event.preventDefault() }}
        className={`fixed inset-0 m-auto max-h-[90dvh] w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl bg-white text-ink shadow-xl backdrop:bg-ink/40 ${action === 'edit' ? 'max-w-150 p-0' : 'max-w-135 p-7'}`}
      >
        {action === 'edit' ? (
          <ClassroomCreateForm
            disabled={false}
            room={room}
            onCancel={close}
            onCreated={async () => { dialog.current?.close(); await onChanged() }}
          />
        ) : (
          <>
            <h2 id={`room-action-${room.id}`} className="font-display text-[22px] font-semibold">
              {action === 'archive' ? 'Archive ห้องเรียนนี้?' : action === 'restore' ? 'Unarchive ห้องเรียนนี้?' : action === 'blocked' ? 'ลบห้องนี้ไม่ได้' : 'ลบห้องเรียนนี้ถาวร?'}
            </h2>
            <p className="mt-2 text-[13px] text-muted">
              {[room.name, action === 'blocked' && archived ? 'Archive แล้ว' : action === 'delete' ? createdLabel(room) : room.courseCode].filter(Boolean).join(' · ')}
            </p>

            {action === 'archive' && (
              <>
                <div className="mt-5 rounded-xl bg-info-soft px-3.5 py-3 text-[13px] leading-5 text-info-ink">
                  <p className="font-semibold">ห้องจะกลายเป็นอ่านอย่างเดียว</p>
                  <p className="mt-1">ไม่แสดงในรายการหลัก ย้ายไปอยู่แท็บ Archive · ยังดูคะแนน รายงาน และส่งออกได้ · กู้คืน (Unarchive) ได้ทุกเมื่อ</p>
                </div>
                <p className="mt-4 text-xs text-muted">สมาชิกทุกคนในห้องจะเห็นห้องนี้ในแท็บ Archive เช่นกัน</p>
              </>
            )}
            {action === 'restore' && (
              <div className="mt-5 rounded-xl bg-info-soft px-3.5 py-3 text-[13px] leading-5 text-info-ink">
                ห้องจะกลับมาอยู่ในรายการใช้งาน และแก้ไขข้อมูลได้ตามสิทธิ์เดิม
              </div>
            )}
            {action === 'delete' && (
              <>
                <div className="mt-5 rounded-xl bg-err-soft px-3.5 py-3 text-[13px] leading-5 text-err">
                  <p className="font-semibold">ลบแล้วกู้คืนไม่ได้</p>
                  <p className="mt-1">ลบได้เพราะห้องยังไม่มีนักศึกษาและงานประเมิน · ห้องที่มีข้อมูลแล้วให้ใช้ Archive แทน</p>
                </div>
                <label htmlFor={`confirm-${room.id}`} className="mt-5 block font-display text-[14.5px] font-semibold">พิมพ์ชื่อห้องเพื่อยืนยัน</label>
                <input id={`confirm-${room.id}`} value={confirmName} onChange={(event) => setConfirmName(event.target.value)} placeholder={room.name} className={`${CTRL} mt-2 min-h-12`} />
              </>
            )}
            {action === 'blocked' && (
              <div className="mt-5 rounded-xl bg-[#fff6dc] px-3.5 py-3 text-[13px] leading-5 text-warn">
                <p className="font-semibold">ห้องนี้มีคะแนน คำตอบ และบันทึก audit แล้ว</p>
                <p className="mt-1">ข้อมูลต้องเก็บไว้ 2 ปีการศึกษาเพื่อตรวจสอบความสุจริตทางวิชาการ · พ้นระยะแล้วระบบจะแปลงตัวตนเป็นนามแฝงให้อัตโนมัติ</p>
              </div>
            )}

            {error && <p role="alert" className="mt-4 text-sm text-err">{error}</p>}

            <div className="mt-5 flex justify-end gap-2.5">
              {action === 'blocked' ? (
                <button type="button" onClick={close} className={btn('primary', 'md', 'min-h-12 px-6')}>ปิด</button>
              ) : (
                <>
                  <button type="button" disabled={busy} onClick={close} className={btn('ghost', 'md', 'min-h-12 px-6')}>ยกเลิก</button>
                  <button
                    type="button"
                    disabled={busy || (action === 'delete' && confirmName.trim() !== room.name)}
                    onClick={() => void submit()}
                    className={action === 'delete' ? btn('ghost', 'md', 'min-h-12 px-6 text-err') : btn('primary', 'md', 'min-h-12 px-6')}
                  >
                    {busy ? 'กำลังดำเนินการ…' : action === 'archive' ? 'Archive' : action === 'restore' ? 'Unarchive' : 'ลบห้องเรียน'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </dialog>
    </div>
  )
}

function createdLabel(room: Classroom & { createdAt?: string }): string | null {
  if (!room.createdAt) return null
  return `สร้างเมื่อ ${thaiDate(room.createdAt)}`
}
