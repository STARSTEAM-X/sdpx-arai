import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppNav } from '../components/AppNav'
import { IconBack } from '../components/icons'
import { Banner, Card, CTRL, FOCUS, btn } from '../components/Ui'
import { ApiError, type AuditRecord, getAudit } from '../lib/api'

const actions: Record<string, string> = {
  CLASSROOM_DELETED: 'ลบห้องเรียนว่าง',
  DEADLINE_EXTENDED: 'ขยายกำหนดส่ง',
  ASSIGNMENT_COPIED: 'คัดลอกงานเป็นฉบับร่าง',
  MEMBER_ENROLLMENT_CHANGED: 'เปลี่ยนสถานะการเรียน',
  COMPARISONS_EXCLUDED: 'ตัดคำตอบจากการคำนวณ',
  COMPARISONS_INCLUDED: 'คืนคำตอบเข้าคำนวณ',
  EXTRA_EVALUATIONS_ASSIGNED: 'มอบหมายการประเมินเพิ่มเติม',
  INSTRUCTOR_COMPARISON_SUBMITTED: 'ผู้สอนส่งคำตอบเปรียบเทียบ', ASSIGNMENT_PUBLISHED: 'เผยแพร่งานประเมิน', ASSIGNMENT_UNPUBLISHED: 'ยกเลิกการเผยแพร่', PAIRS_REGENERATED: 'จัดคู่ใหม่', MEMBER_ROLE_CHANGED: 'เปลี่ยนบทบาทสมาชิก', MEMBER_REMOVED: 'ถอดสมาชิก', SCORE_OVERRIDDEN: 'แก้คะแนนด้วยมือ', SCORES_FINALIZED: 'ประกาศผลคะแนน', SCORES_REOPENED: 'เปิดผลคะแนนใหม่', IDENTIFIED_EXPORT: 'ส่งออกพร้อมตัวตน', EVALUATOR_IDENTITY_VIEWED: 'ดูตัวตนผู้ประเมิน', CLASSROOM_ARCHIVED: 'เก็บห้องเข้าคลัง', CLASSROOM_RESTORED: 'คืนห้องเรียน', APPEAL_CREATED: 'ยื่นอุทธรณ์', APPEAL_RESOLVED: 'ตอบคำร้องอุทธรณ์' }
export default function AuditPage() {
  const { classroomId = '' } = useParams()
  const [items, setItems] = useState<AuditRecord[]>([])
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')
  const [selected, setSelected] = useState<AuditRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const refresh = useCallback(async () => {
    try { const result = await getAudit(classroomId); setItems(result.items); setError(null) }
    catch (err) { setError(err instanceof ApiError ? err.message : 'โหลดประวัติไม่สำเร็จ') }
    finally { setLoaded(true) }
  }, [classroomId])
  useEffect(() => { void refresh() }, [refresh])
  const visible = items.filter((item) => (!action || item.action === action) && `${item.actorEmail} ${actions[item.action] ?? item.action} ${item.reason ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  function close() { dialog.current?.close(); trigger.current?.focus() }
  return <div className="min-h-screen bg-ground text-ink"><AppNav context="บันทึกการตรวจสอบ" contextTo={`/classrooms/${classroomId}`} classroomId={classroomId} />
    <main className="mx-auto max-w-304 px-4 py-8 sm:px-7"><div className="mb-6 flex items-start gap-3"><Link to={`/classrooms/${classroomId}`} aria-label="กลับหน้าห้องเรียน" className={`grid size-11 shrink-0 place-items-center rounded ${FOCUS}`}><IconBack className="size-10" /></Link><div><h1 className="font-display text-2xl font-bold">บันทึกการตรวจสอบ</h1><p className="mt-2 text-sm text-muted">ประวัติแก้ไขไม่ได้ · แสดง 100 รายการล่าสุดของห้องเรียน</p></div></div>
      {error && <Banner tone="err" role="alert" className="mb-5">{error}</Banner>}
      <Card className="p-4 sm:p-6"><div className="flex flex-wrap gap-3"><label className="min-w-48 flex-1"><span className="sr-only">ค้นหาบันทึก</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาผู้ทำรายการหรือเหตุผล" className={CTRL} /></label><label><span className="sr-only">กรองการกระทำ</span><select value={action} onChange={(event) => setAction(event.target.value)} className={CTRL}><option value="">การกระทำทั้งหมด</option>{[...new Set(items.map((item) => item.action))].map((value) => <option key={value} value={value}>{actions[value] ?? value}</option>)}</select></label><button onClick={() => void refresh()} className={btn('ghost', 'sm')}>รีเฟรช</button></div>
        <h2 className="mt-6 font-display text-lg font-bold">รายการทั้งหมด <span className="font-mono text-sm text-muted">{visible.length}</span></h2>
        {!loaded && <p role="status" className="mt-5">กำลังโหลดประวัติ…</p>}
        {loaded && visible.length === 0 && <p className="mt-5 text-sm text-muted">ไม่พบบันทึก</p>}
        <div className="mt-4 overflow-x-auto" role="region" aria-label="ตารางบันทึกการตรวจสอบ" tabIndex={0}>
          <table className="w-full min-w-180 text-left text-sm">
            <caption className="sr-only">ประวัติการดำเนินการของห้องเรียน ข้อมูลแก้ไขไม่ได้</caption>
            <thead className="bg-sand"><tr>{['เวลา (UTC)', 'ผู้กระทำ', 'การกระทำ', 'เหตุผล', 'รายละเอียด'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody>{visible.map((item) => <tr key={item.id} className="border-b border-edge">
              <td className="whitespace-nowrap px-4 py-4 font-mono text-xs">{new Date(item.occurredAt).toISOString().replace('T', ' ').slice(0, 19)}</td>
              <td className="max-w-56 break-all px-4 py-4 text-muted">{item.actorEmail}</td>
              <th scope="row" className="px-4 py-4 font-semibold">{actions[item.action] ?? item.action}</th>
              <td className="max-w-64 whitespace-pre-wrap break-words px-4 py-4 text-muted">{item.reason ?? '—'}</td>
              <td className="px-4 py-4"><button className={btn('ghost', 'sm')} onClick={(event) => { trigger.current = event.currentTarget; setSelected(item); dialog.current?.showModal() }}>ดูรายละเอียด<span className="sr-only"> {actions[item.action] ?? item.action}</span></button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </Card>
      <dialog ref={dialog} aria-label="รายละเอียดบันทึก" onCancel={(event) => { event.preventDefault(); close() }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-auto rounded-3xl border border-edge bg-white p-6 text-ink shadow-xl backdrop:bg-ink/40">
        {selected && <><h2 className="font-display text-xl font-bold">รายละเอียดบันทึก</h2><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-muted">ผู้กระทำ</dt><dd className="mt-1 break-all">{selected.actorEmail}</dd></div><div><dt className="text-muted">การกระทำ</dt><dd className="mt-1">{actions[selected.action] ?? selected.action}</dd></div><div><dt className="text-muted">ทรัพยากร</dt><dd className="mt-1 break-all">{selected.resourceType} · {selected.resourceId ?? '—'}</dd></div>{([['ค่าก่อนหน้า', selected.beforeState], ['ค่าหลังแก้ไข', selected.afterState]] as const).map(([label, state]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-all rounded-xl bg-sand p-3 font-mono text-xs">{state ? JSON.stringify(state, null, 2) : '—'}</dd></div>)}<div><dt className="text-muted">เหตุผล</dt><dd className="mt-1 whitespace-pre-wrap break-words">{selected.reason ?? 'ไม่ได้ระบุ'}</dd></div><div><dt className="text-muted">เวลา UTC</dt><dd className="mt-1">{selected.occurredAt}</dd></div></dl><div className="mt-6 text-right"><button onClick={close} className={btn('primary')}>ปิด</button></div></>}
      </dialog>
    </main></div>
}
