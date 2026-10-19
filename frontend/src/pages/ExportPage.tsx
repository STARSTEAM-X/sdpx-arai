import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppNav } from '../components/AppNav'
import { BackChevron, ForbiddenState, forbiddenCopy } from '../components/PageChrome'
import { IdentifiedExportDialog } from '../components/ScoringDialogs'
import { Banner, FOCUS, Spinner, btn } from '../components/Ui'
import {
  ApiError,
  type Assignment,
  type Classroom,
  type ExportLog,
  type ExportOptions,
  type ExportReport,
  exportReports,
  getAssignment,
  getExportHistory,
  getMe,
  listClassrooms,
} from '../lib/api'
import { thaiDate, thaiParts } from '../lib/datetime'
import reportHeading from '../assets/figma/owner-report-heading.png'

// Figma J36 — 4 รายงานมาตรฐานอยู่ในไฟล์เสมอ เลือกเพิ่มได้เฉพาะผลเปรียบเทียบดิบ
const STANDARD: { id: ExportReport; label: string }[] = [
  { id: 'GROUP', label: 'รายงานคะแนนกลุ่ม' },
  { id: 'INDIVIDUAL', label: 'รายงานคะแนนรายบุคคล' },
  { id: 'PAIR_COVERAGE', label: 'รายงาน coverage รายคู่ (Pair Coverage)' },
  { id: 'METADATA', label: 'Metadata — สูตรคำนวณ ค่าตั้งค่า และเวลาที่ส่งออก' },
]

/** ชื่อไฟล์ตัวอย่าง — กฎเดียวกับ export_basename ใน backend/app/api/reports_export.py */
function previewName(room: Classroom | null, job: Assignment | null, raw: boolean, format: 'XLSX' | 'CSV', now: number) {
  const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const roomPart = slug(`${room?.courseCode ?? ''} ${room?.semester ?? ''}`) || 'classroom'
  let work = slug(job?.name ?? '')
  if (!/[a-z]/.test(work)) work = `assignment-${(job?.id ?? '').slice(0, 8)}`
  const d = thaiParts(new Date(now).toISOString(), room?.timezone ?? 'Asia/Bangkok')
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${d.year - 543}${pad(d.month)}${pad(d.day)}-${d.hour}${d.minute}`
  const ext = format === 'XLSX' ? 'xlsx' : 'zip'
  return `${roomPart}_${work}_${raw ? 'all-reports-raw' : 'all-reports'}_${stamp}.${ext}`
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="overflow-hidden rounded-[20px] border border-edge bg-white">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden="true" className="border-b border-edge bg-surface-cream px-4 py-3.5 sm:px-5">
        <p className="font-display text-[16px] font-semibold">{title}</p>
        {hint && <p className="mt-0.5 text-[13.5px] text-ink-2">{hint}</p>}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </fieldset>
  )
}

function Choice({
  type,
  checked,
  disabled,
  onChange,
  children,
  name,
}: {
  type: 'checkbox' | 'radio'
  checked: boolean
  disabled?: boolean
  onChange?: () => void
  children: ReactNode
  name?: string
}) {
  return (
    <label
      className={`flex min-h-9 items-center gap-3 font-display text-[14px] font-semibold ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className={`grid size-6 shrink-0 appearance-none place-content-center border-2 bg-white ${FOCUS} ${
          type === 'checkbox'
            ? "rounded-[5px] border-brand-600 checked:bg-brand-600 checked:after:block checked:after:h-3 checked:after:w-2 checked:after:-translate-y-px checked:after:rotate-45 checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white checked:after:content-['']"
            : 'rounded-full border-muted checked:border-brand-600 checked:shadow-[inset_0_0_0_3px_white] checked:bg-brand-600'
        }`}
      />
      <span className={disabled && !checked ? 'text-muted' : ''}>{children}</span>
    </label>
  )
}

export default function ExportPage() {
  const { classroomId = '', assignmentId = '' } = useParams()
  const navigate = useNavigate()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [room, setRoom] = useState<Classroom | null>(null)
  const [owner, setOwner] = useState(false)
  const [forbidden, setForbidden] = useState<string | false>(false)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState(false)
  const [format, setFormat] = useState<'XLSX' | 'CSV'>('XLSX')
  const [identity, setIdentity] = useState<'PSEUDONYM' | 'EMAIL'>('PSEUDONYM')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [confirmIdentified, setConfirmIdentified] = useState(false)
  const [history, setHistory] = useState<ExportLog[] | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    // ชื่อไฟล์ตัวอย่างมีเวลาถึงนาที — อัปเดตให้ตรงกับไฟล์ที่จะได้จริง
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  const drawer = useRef<HTMLDialogElement>(null)
  const historyTrigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([getAssignment(assignmentId), getMe(), listClassrooms()])
      .then(([job, me, rooms]) => {
        if (cancelled) return
        if (job.classroomId !== classroomId) throw new Error('ไม่พบงานนี้ในห้องเรียน')
        const role = me.classrooms.find((item) => item.classroomId === classroomId)?.role ?? ''
        if (role !== 'OWNER' && role !== 'CO_TEACHER') {
          setForbidden(role)
          return
        }
        setAssignment(job)
        setOwner(role === 'OWNER')
        setRoom(rooms.items.find((item) => item.id === classroomId) ?? null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 403) setForbidden('')
        else setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
      })
    return () => {
      cancelled = true
    }
  }, [assignmentId, classroomId])

  const options = (reason?: string): ExportOptions => ({
    reports: [...STANDARD.map((item) => item.id), ...(raw ? (['RAW_COMPARISONS'] as const) : [])],
    format,
    identity,
    reason,
  })

  async function run(reason?: string) {
    setBusy(true)
    setExportError(null)
    setNotice(null)
    try {
      await exportReports(assignmentId, options(reason))
      setNotice(
        identity === 'EMAIL'
          ? 'เริ่มดาวน์โหลดไฟล์แล้ว · ไฟล์นี้มีอีเมลจริงของผู้ประเมิน · บันทึก audit แล้ว'
          : 'เริ่มดาวน์โหลดไฟล์แล้ว · ผู้ประเมินเป็นรหัสแทนชื่อ',
      )
      setHistory(null)
    } catch (err) {
      // dialog ยืนยันตัวตนแสดง error เอง — ส่งต่อเพื่อให้ผู้ใช้ลองใหม่ได้โดยไม่ต้องกรอกเหตุผลซ้ำ
      if (reason) throw err
      setExportError(err instanceof ApiError ? err.message : 'ส่งออกไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const openHistory = useCallback(() => {
    drawer.current?.showModal()
    setHistoryError(null)
    void getExportHistory(assignmentId)
      .then((result) => setHistory(result.items))
      .catch((err: unknown) => setHistoryError(err instanceof ApiError ? err.message : 'โหลดประวัติไม่สำเร็จ'))
  }, [assignmentId])

  function closeHistory() {
    drawer.current?.close()
    historyTrigger.current?.focus()
  }

  if (forbidden !== false) {
    const copy = forbiddenCopy(forbidden || null, classroomId)
    return (
      <div className="min-h-screen bg-ground text-ink">
        <AppNav context="ส่งออกข้อมูล" />
        <main className="px-4">
          <ForbiddenState {...copy} />
        </main>
      </div>
    )
  }

  const back = `/classrooms/${classroomId}/assignments/${assignmentId}`
  return (
    <div className="min-h-screen bg-ground text-ink">
      <AppNav context="ส่งออกข้อมูล" contextTo={back} classroomId={classroomId} />
      <main className="mx-auto max-w-290 pt-8 pb-16 max-xl:px-7 max-sm:px-4">
        <nav
          aria-label="breadcrumb"
          className="flex flex-wrap items-center gap-2.5 text-[14px] text-ink-2 [&_a]:inline-flex [&_a]:min-h-6 [&_a]:items-center"
        >
          <Link to="/classrooms" className={`hover:text-accent-ink ${FOCUS}`}>
            ห้องเรียนของฉัน
          </Link>
          <span aria-hidden="true">›</span>
          <Link to={`/classrooms/${classroomId}`} className={`hover:text-accent-ink ${FOCUS}`}>
            {room?.name || 'ห้องเรียน'}
          </Link>
          <span aria-hidden="true">›</span>
          <Link to={back} className={`hover:text-accent-ink ${FOCUS}`}>
            {assignment?.name}
          </Link>
        </nav>
        <div className="relative mt-6 mb-6 flex min-h-41 items-center gap-4">
          <BackChevron to={back} label="กลับหน้างานประเมิน" inline />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[32px] font-bold max-sm:text-2xl">ส่งออกข้อมูล</h1>
            <p className="mt-2 text-[15px] text-ink-2">
              {assignment?.name}
              {assignment && (assignment.status === 'FINALIZED' ? ' · ประกาศผลแล้ว' : ' · คะแนนชั่วคราว ยังไม่ประกาศผล')}
            </p>
          </div>
          <img src={reportHeading} alt="" width={220} height={165} className="hidden shrink-0 sm:block sm:w-40 lg:w-55" />
        </div>
        {error && (
          <Banner tone="err" role="alert" className="mb-5">
            {error}
          </Banner>
        )}
        {!assignment && !error && <p role="status">กำลังโหลด…</p>}
        {assignment && (
          <form
            className="max-w-208 space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              if (identity === 'EMAIL') setConfirmIdentified(true)
              else void run()
            }}
          >
            <Section
              title="รายงานในไฟล์"
              hint="XLSX มี 4 sheet มาตรฐานเสมอ: Group Summary · Individual Summary · Pair Coverage · Metadata · เลือกเพิ่มได้เฉพาะผลเปรียบเทียบดิบ"
            >
              {STANDARD.map((item) => (
                <Choice key={item.id} type="checkbox" checked disabled>
                  {item.label} · รวมเสมอ
                </Choice>
              ))}
              <Choice
                type="checkbox"
                checked={raw}
                onChange={() => {
                  setRaw(!raw)
                  if (raw) setIdentity('PSEUDONYM')
                }}
              >
                ผลเปรียบเทียบดิบรายรายการ
              </Choice>
            </Section>
            <Section title="รูปแบบไฟล์">
              <Choice type="radio" name="format" checked={format === 'XLSX'} onChange={() => setFormat('XLSX')}>
                XLSX — แยก sheet ตามรายงาน เปิดใน Excel ได้ทันที
              </Choice>
              <Choice type="radio" name="format" checked={format === 'CSV'} onChange={() => setFormat('CSV')}>
                CSV — ไฟล์เดียวต่อรายงาน เข้ารหัส UTF-8 แบบมี BOM
              </Choice>
              <p className="mt-1 text-[13.5px] text-ink-2">
                CSV ต้องมี BOM ไม่งั้นภาษาไทยจะเพี้ยนเมื่อเปิดด้วย Excel · เซลล์ที่ขึ้นต้นด้วย = + - @ จะถูก escape
                เพื่อกัน formula injection
              </p>
            </Section>
            <Section title="ตัวตนผู้ประเมิน" hint="ค่าตั้งต้นคือไม่เปิดเผย">
              <Choice
                type="radio"
                name="identity"
                checked={identity === 'PSEUDONYM'}
                onChange={() => setIdentity('PSEUDONYM')}
              >
                รหัสแทนตัว (E1, E2, E3 …) — แนะนำ
              </Choice>
              <Choice
                type="radio"
                name="identity"
                checked={identity === 'EMAIL'}
                disabled={!owner}
                onChange={() => {
                  setIdentity('EMAIL')
                  setRaw(true) // ตัวตนผู้ประเมินอยู่ในผลเปรียบเทียบดิบเท่านั้น
                }}
              >
                อีเมลจริงของผู้ประเมิน
                {!owner && <span className="ml-1 font-body font-normal text-muted">· เฉพาะเจ้าของห้อง</span>}
              </Choice>
              {identity === 'EMAIL' && (
                <p className="mt-1 text-[13.5px] text-ink-2">
                  อีเมลอยู่ในผลเปรียบเทียบดิบ จึงเลือกรายงานนี้ให้แล้ว · ต้องระบุเหตุผลก่อนส่งออก และบันทึก audit ทุกครั้ง
                </p>
              )}
            </Section>
            <Section title="ชื่อไฟล์ที่จะได้">
              <p className="rounded-xl bg-table-head px-4 py-3 text-[14px] break-all">
                {previewName(room, assignment, raw, format, now)}
              </p>
              <p className="mt-2 text-[13.5px] text-ink-2">
                รูปแบบ: {'{ห้องเรียน}_{งาน}_{รายงาน}_{YYYYMMDD-HHmm}.{นามสกุล}'}
                {format === 'CSV' && ' · CSV หลายรายงานรวมเป็นไฟล์ .zip'}
              </p>
            </Section>
            {exportError && (
              <Banner tone="err" role="alert" data-testid="export-error">
                {exportError}
              </Banner>
            )}
            {notice && (
              <Banner tone="ok" role="status" data-testid="export-notice">
                {notice}
              </Banner>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                ref={historyTrigger}
                type="button"
                onClick={openHistory}
                className={btn('ghost', 'md', 'border-brand-600 px-5 text-accent-ink')}
              >
                ดูประวัติการส่งออก
              </button>
              <div className="ml-auto flex gap-3">
                <button type="button" onClick={() => navigate(back)} className={btn('ghost', 'md', 'px-5')}>
                  ยกเลิก
                </button>
                <button type="submit" disabled={busy} className={btn('primary', 'md', 'px-6')}>
                  {busy && <Spinner />}
                  ส่งออก
                </button>
              </div>
            </div>
          </form>
        )}
        {confirmIdentified && (
          <IdentifiedExportDialog onClose={() => setConfirmIdentified(false)} onConfirm={(reason) => run(reason)} />
        )}
        {/* Figma S10 — ประวัติการส่งออกเป็น drawer ด้านขวา แสดงเวลา รูปแบบ ตัวตน และผู้ดำเนินการ */}
        <dialog
          ref={drawer}
          aria-labelledby="export-history-title"
          onCancel={(event) => {
            event.preventDefault()
            closeHistory()
          }}
          className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(26rem,100vw)] max-w-none overflow-y-auto rounded-none bg-white p-0 text-ink shadow-[-12px_0_40px_rgba(50,16,7,0.18)] backdrop:bg-ink/40"
        >
          <div className="flex min-h-full flex-col px-5 py-5">
            <div className="flex items-start gap-3">
              <h2 id="export-history-title" className="flex-1 font-display text-[22px] font-bold">
                ประวัติการส่งออก
              </h2>
              <img src={reportHeading} alt="" width={88} height={66} className="w-22" />
              <button
                type="button"
                onClick={closeHistory}
                aria-label="ปิดประวัติการส่งออก"
                className={`grid size-9 place-items-center rounded-full text-ink-2 hover:bg-sand ${FOCUS}`}
              >
                ✕
              </button>
            </div>
            <p className="mt-4 text-[13px] text-ink-2">
              {assignment?.name}
              {history && ` · แสดง ${history.length} รายการล่าสุด`}
            </p>
            {historyError && (
              <Banner tone="err" role="alert" className="mt-3">
                {historyError}
              </Banner>
            )}
            {!history && !historyError && (
              <p role="status" className="mt-3 text-sm text-muted">
                กำลังโหลด…
              </p>
            )}
            {history && !history.length && <p className="mt-3 text-sm text-muted">ยังไม่มีการส่งออกในงานนี้</p>}
            <ul className="mt-3 space-y-2.5">
              {history?.map((item, index) => (
                <li key={index} className="rounded-2xl bg-table-head px-4 py-3">
                  <p className="font-display text-[14px] font-semibold">
                    {thaiDate(item.createdAt, { timeZone: room?.timezone })} ·{' '}
                    {thaiParts(item.createdAt, room?.timezone).hour}:{thaiParts(item.createdAt, room?.timezone).minute}
                  </p>
                  <p className="mt-0.5 text-[13px]">
                    {item.format} · {item.identified ? 'มีตัวตนผู้ประเมิน' : 'รหัสแทนชื่อ'}
                    {item.reports.includes('RAW_COMPARISONS') && ' · มีผลเปรียบเทียบดิบ'}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {item.actorName} · {item.actorRole}
                    {item.identified && ' · บันทึก audit'}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12.5px] text-muted">
              การส่งออกที่มีตัวตนจริงทำได้เฉพาะ Owner และต้องยืนยันก่อนทุกครั้ง
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={closeHistory}
                className={btn('ghost', 'md', 'border-brand-600 px-5 text-accent-ink')}
              >
                กลับไปส่งออก
              </button>
            </div>
          </div>
        </dialog>
      </main>
    </div>
  )
}
