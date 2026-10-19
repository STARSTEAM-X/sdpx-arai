import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppNav } from '../components/AppNav'
import { BackChevron, ForbiddenState, forbiddenCopy } from '../components/PageChrome'
import auditArt from '../assets/figma/privacy.png'
import { Banner, CTRL, FOCUS, btn } from '../components/Ui'
import { ApiError, type AuditRecord, getAudit, getMe, listClassrooms } from '../lib/api'
import { thaiDate } from '../lib/datetime'

const actions: Record<string, string> = {
  CLASSROOM_DELETED: 'ลบห้องเรียนว่าง',
  CLASSROOM_UPDATED: 'แก้ไขข้อมูลห้อง',
  DEADLINE_EXTENDED: 'ขยายกำหนดส่ง',
  ASSIGNMENT_COPIED: 'คัดลอกงานเป็นฉบับร่าง',
  MEMBER_ENROLLMENT_CHANGED: 'เปลี่ยนสถานะการเรียน',
  COMPARISONS_EXCLUDED: 'ตัดคำตอบจากการคำนวณ',
  COMPARISONS_INCLUDED: 'คืนคำตอบเข้าคำนวณ',
  EXTRA_EVALUATIONS_ASSIGNED: 'มอบหมายการประเมินเพิ่มเติม',
  INSTRUCTOR_COMPARISON_SUBMITTED: 'ผู้สอนส่งคำตอบเปรียบเทียบ',
  ASSIGNMENT_PUBLISHED: 'เผยแพร่งานประเมิน',
  ASSIGNMENT_UNPUBLISHED: 'ยกเลิกการเผยแพร่',
  PAIRS_REGENERATED: 'จัดคู่ใหม่',
  MEMBER_ROLE_CHANGED: 'เปลี่ยนบทบาทสมาชิก',
  MEMBER_REMOVED: 'ถอดสมาชิก',
  SCORE_OVERRIDDEN: 'แก้คะแนนด้วยมือ',
  SCORES_FINALIZED: 'ประกาศผลคะแนน',
  SCORES_REOPENED: 'เปิดผลคะแนนใหม่',
  IDENTIFIED_EXPORT: 'ส่งออกพร้อมตัวตน',
  EVALUATOR_IDENTITY_VIEWED: 'ดูตัวตนผู้ประเมิน',
  CLASSROOM_ARCHIVED: 'เก็บห้องเข้าคลัง',
  CLASSROOM_RESTORED: 'คืนห้องเรียน',
  APPEAL_CREATED: 'ยื่นอุทธรณ์',
  APPEAL_RESOLVED: 'ตอบคำร้องอุทธรณ์',
}
export default function AuditPage() {
  const { classroomId = '' } = useParams()
  const [items, setItems] = useState<AuditRecord[]>([])
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')
  const [selected, setSelected] = useState<AuditRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState<string | false>(false)
  const [loaded, setLoaded] = useState(false)
  const [roomName, setRoomName] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const refresh = useCallback(async () => {
    try {
      const [result, rooms] = await Promise.all([getAudit(classroomId), listClassrooms()])
      setItems(result.items)
      setRoomName(rooms.items.find((room) => room.id === classroomId)?.name ?? '')
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 403)
        void getMe()
          .then((me) => setForbidden(me.classrooms.find((room) => room.classroomId === classroomId)?.role ?? ''))
          .catch(() => setForbidden(''))
      setError(err instanceof ApiError ? err.message : 'โหลดประวัติไม่สำเร็จ')
    } finally {
      setLoaded(true)
    }
  }, [classroomId])
  useEffect(() => {
    void refresh()
  }, [refresh])
  const visible = items.filter(
    (item) =>
      (!action || item.action === action) &&
      `${item.actorEmail} ${actions[item.action] ?? item.action} ${item.reason ?? ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  function close() {
    dialog.current?.close()
    trigger.current?.focus()
  }
  const when = (iso: string) => thaiDate(iso, { year: false, time: true })
  function exportCsv() {
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
    const rows = [
      ['occurredAtUtc', 'actor', 'action', 'reason'],
      ...visible.map((item) => [
        item.occurredAt,
        item.actorEmail,
        actions[item.action] ?? item.action,
        item.reason ?? '',
      ]),
    ]
    const blob = new Blob(['\ufeff' + rows.map((row) => row.map((cell) => escape(cell)).join(',')).join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-${classroomId}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
  if (forbidden !== false) {
    const copy = forbiddenCopy(forbidden || null, classroomId)
    return (
      <div className="min-h-screen bg-ground text-ink">
        <AppNav context="บันทึกการตรวจสอบ" />
        <main className="px-4">
          <ForbiddenState {...copy} />
        </main>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-ground text-ink">
      <AppNav context="บันทึกการตรวจสอบ" contextTo={`/classrooms/${classroomId}`} classroomId={classroomId} />
      <main className="mx-auto max-w-260 pt-8 pb-16 max-xl:px-7 max-sm:px-4">
        <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-2.5 text-[14px] text-ink-2">
          <Link to="/classrooms" className={`hover:text-accent-ink ${FOCUS}`}>
            ห้องเรียนของฉัน
          </Link>
          <span aria-hidden="true">›</span>
          <Link to={`/classrooms/${classroomId}`} className={`hover:text-accent-ink ${FOCUS}`}>
            {roomName || 'ห้องเรียน'}
          </Link>
        </nav>
        <div className="relative mt-6 mb-6 flex min-h-41 items-center gap-4">
          <BackChevron to={`/classrooms/${classroomId}`} label="กลับหน้าห้องเรียน" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[32px] font-bold max-sm:text-2xl">บันทึกการตรวจสอบ</h1>
            <p className="mt-2 text-[15px] text-ink-2">
              {roomName ? `${roomName} · ` : ''}ประวัติการดำเนินการทั้งหมดในห้อง
            </p>
          </div>
          <img
            src={auditArt}
            alt=""
            aria-hidden="true"
            className="hidden h-32 w-auto shrink-0 object-contain sm:block"
          />
        </div>
        {error && (
          <Banner tone="err" role="alert" className="mb-5">
            {error}
          </Banner>
        )}
        <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-edge bg-white px-5 py-4">
          <label className="min-w-48 max-w-104 flex-1">
            <span className="sr-only">ค้นหาบันทึก</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาด้วยชื่อหรือรายการ"
              className={`${CTRL} min-h-11`}
            />
          </label>
          <label className="ml-auto">
            <span className="sr-only">กรองการกระทำ</span>
            <select
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className={`min-h-10 rounded-full border border-brand-600 bg-white px-4 font-display text-[14px] font-semibold text-accent-ink ${FOCUS}`}
            >
              <option value="">ทุกประเภท</option>
              {[...new Set(items.map((item) => item.action))].map((value) => (
                <option key={value} value={value}>
                  {actions[value] ?? value}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setAction('')
            }}
            className={`min-h-10 rounded-full border border-brand-600 bg-white px-5 font-display text-[14px] font-semibold text-accent-ink ${FOCUS}`}
          >
            ทั้งหมด
          </button>
        </section>
        <section className="mt-6 overflow-hidden rounded-3xl border border-edge bg-white">
          <div className="border-b border-edge bg-surface-cream px-5 py-4">
            <h2 className="font-display text-[16px] font-semibold">รายการทั้งหมด</h2>
            <p className="mt-1 text-[13.5px] text-ink-2">
              {visible.length} รายการ · ตั้งแต่สร้างห้องจนส่งออก · กดรายการเพื่อดูรายละเอียด
            </p>
          </div>
          {!loaded && (
            <p role="status" className="px-5 py-5">
              กำลังโหลดประวัติ…
            </p>
          )}
          {loaded && visible.length === 0 && <p className="px-5 py-5 text-sm text-muted">ไม่พบบันทึก</p>}
          <div className="overflow-x-auto" role="region" aria-label="ตารางบันทึกการตรวจสอบ" tabIndex={0}>
            <table className="w-full min-w-160 text-left text-[14.5px]">
              <caption className="sr-only">ประวัติการดำเนินการของห้องเรียน ข้อมูลแก้ไขไม่ได้</caption>
              <thead className="bg-table-head">
                <tr>
                  <th className="px-5 py-3 font-normal">การกระทำ</th>
                  <th className="px-5 py-3 text-right font-normal">ผู้กระทำ</th>
                  <th className="px-5 py-3 text-right font-normal">เวลา</th>
                  <th className="px-5 py-3 text-right font-normal">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {visible.map((item) => (
                  <tr key={item.id}>
                    <th scope="row" className="px-5 py-3 font-normal">
                      {actions[item.action] ?? item.action}
                      {item.reason ? <span className="text-ink-2"> · {item.reason}</span> : null}
                    </th>
                    <td className="px-5 py-3 text-right">{item.actorEmail.split('@')[0]}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">{when(item.occurredAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className={`text-accent-ink hover:underline ${FOCUS}`}
                        onClick={(event) => {
                          trigger.current = event.currentTarget
                          setSelected(item)
                          dialog.current?.showModal()
                        }}
                      >
                        ดูรายละเอียด<span className="sr-only"> {actions[item.action] ?? item.action}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!visible.length}
            className={btn('ghost', 'md', 'border-brand-600 px-4 text-accent-ink')}
          >
            ส่งออกบันทึก
          </button>
        </div>
        <dialog
          ref={dialog}
          aria-label="รายละเอียดบันทึก"
          onCancel={(event) => {
            event.preventDefault()
            close()
          }}
          className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-auto rounded-3xl border border-edge bg-white p-6 text-ink shadow-xl backdrop:bg-ink/40"
        >
          {selected && (
            <>
              <h2 className="font-display text-xl font-bold">รายละเอียดบันทึก</h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-muted">ผู้กระทำ</dt>
                  <dd className="mt-1 break-all">{selected.actorEmail}</dd>
                </div>
                <div>
                  <dt className="text-muted">การกระทำ</dt>
                  <dd className="mt-1">{actions[selected.action] ?? selected.action}</dd>
                </div>
                <div>
                  <dt className="text-muted">ทรัพยากร</dt>
                  <dd className="mt-1 break-all">
                    {selected.resourceType} · {selected.resourceId ?? '—'}
                  </dd>
                </div>
                {(
                  [
                    ['ค่าก่อนหน้า', selected.beforeState],
                    ['ค่าหลังแก้ไข', selected.afterState],
                  ] as const
                ).map(([label, state]) => (
                  <div key={label}>
                    <dt className="text-muted">{label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-all rounded-xl bg-sand p-3 font-mono text-xs">
                      {state ? JSON.stringify(state, null, 2) : '—'}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt className="text-muted">เหตุผล</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words">{selected.reason ?? 'ไม่ได้ระบุ'}</dd>
                </div>
                <div>
                  <dt className="text-muted">เวลา UTC</dt>
                  <dd className="mt-1">{selected.occurredAt}</dd>
                </div>
              </dl>
              <div className="mt-6 text-right">
                <button onClick={close} className={btn('primary')}>
                  ปิด
                </button>
              </div>
            </>
          )}
        </dialog>
      </main>
    </div>
  )
}
