import { useEffect, useState } from 'react'
import { useModal } from './useModal'
import { Link } from 'react-router-dom'

import { DeadlinePicker } from './DeadlinePicker'
import { CriteriaEditor } from './CriteriaEditor'
import { Banner, CTRL, FOCUS, Spinner, btn } from './Ui'
import {
  ApiError,
  type Assignment,
  type Feasibility,
  type PublishResult,
  createAssignment,
  getFeasibility,
  publishAssignment,
  getAssignment,
  updateAssignment,
} from '../lib/api'
import {
  type AssignmentDraft,
  draftBlocker,
  draftCriteria,
  individualEnabled,
  toCreateInput,
  weightChecks,
  assignmentToDraft,
} from '../lib/assignment'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'ฉบับร่าง',
  PUBLISHED: 'เผยแพร่แล้ว',
  OPEN: 'เปิดให้ประเมิน',
  CLOSED: 'ปิดรับแล้ว',
  FINALIZED: 'ตัดคะแนนแล้ว',
  ARCHIVED: 'เก็บเข้าคลัง',
}

/** ช่องตัวเลขพร้อมหน่วยท้ายช่อง (Figma J13a: "60%", "3 คน", "3 ครั้ง") */
function Unit({ unit, className = '', children }: { unit: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative w-full ${className}`}>
      {children}
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[14px] text-muted">
        {unit}
      </span>
    </div>
  )
}

/** สัดส่วน 0–1 → เปอร์เซ็นต์ที่แสดงในช่อง (ปัดทศนิยมลอยของ JS เช่น 0.29 × 100) */
const percent = (ratio: number) => Math.round(ratio * 10000) / 100

function Field({
  id,
  label,
  help,
  children,
}: {
  id: string
  label: string
  help?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-display text-[13.5px] font-semibold">
        {label}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-[12.5px] leading-relaxed text-muted">
          {help}
        </p>
      )}
    </div>
  )
}

/** สร้างงานประเมิน ตรวจความเป็นไปได้ แล้วเผยแพร่ — US-04, US-05, US-06
 *
 *  สามขั้นนี้อยู่ในกล่องเดียวกันเพราะอาจารย์ทำติดกันเสมอ และขั้นกลาง (feasibility)
 *  มีไว้เพื่อไม่ให้กด publish ด้วยค่าที่เป็นไปไม่ได้ การแยกไปคนละหน้าจะทำให้คนข้ามขั้นนั้น
 *
 *  ค่าในฟอร์มอยู่ที่หน้าแม่ (`draft`) เพราะกล่องสรุปด้านข้างต้องอ่านค่าเดียวกันแบบ real-time
 */
export function AssignmentPanel({
  classroomId,
  draft,
  onDraftChange,
  studentCount,
  timezone,
  onChanged,
  onPublished,
  groupNames = [],
  editingId,
}: {
  classroomId: string
  draft: AssignmentDraft
  onDraftChange: (next: AssignmentDraft) => void
  studentCount: number
  timezone: string
  onChanged?: () => void
  /** Figma J16 — หน้าแม่แสดงแบนเนอร์ "เผยแพร่แล้ว" และกลับไปหน้าภาพรวม */
  onPublished?: (name: string, result: PublishResult) => void
  groupNames?: string[]
  editingId?: string
}) {
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [feasibility, setFeasibility] = useState<Feasibility[] | null>(null)
  const [published, setPublished] = useState<PublishResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'create' | 'feasibility' | 'publish' | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [savedDraft, setSavedDraft] = useState<string | null>(null)
  const [view, setView] = useState<'form' | 'feasibility'>('form')
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    if (!editingId) {
      setAssignment(null)
      return
    }
    let active = true
    setLoadingDraft(true)
    void getAssignment(editingId)
      .then((value) => {
        if (!active) return
        if (value.status !== 'DRAFT') {
          setError('แก้ไขได้เฉพาะงานฉบับร่าง')
          return
        }
        setAssignment(value)
        setFeasibility(null)
        setPublished(null)
        setError(null)
        const loaded = assignmentToDraft(value, timezone)
        onDraftChange(loaded)
        setSavedDraft(JSON.stringify(loaded))
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'โหลดฉบับร่างไม่สำเร็จ')
      })
      .finally(() => {
        if (active) setLoadingDraft(false)
      })
    return () => {
      active = false
    }
  }, [editingId, onDraftChange, timezone])

  const individual = individualEnabled(draft)
  const checks = weightChecks(draft)
  const blocker = draftBlocker(draft, studentCount)
  const weightProblem = (() => {
    const bad = checks.find((check) => !check.ok)
    return bad ? `แก้น้ำหนัก${bad.label}ให้ครบ 100% ก่อนเผยแพร่${bad.message ? ` (${bad.message})` : ''}` : null
  })()
  const dirty = Boolean(assignment && savedDraft !== JSON.stringify(draft))
  const draftId = editingId ?? (assignment?.status === 'DRAFT' ? assignment.id : undefined)

  const set = <K extends keyof AssignmentDraft>(key: K, value: AssignmentDraft[K]) =>
    onDraftChange({ ...draft, [key]: value })

  async function run<T>(
    kind: 'create' | 'feasibility' | 'publish',
    action: () => Promise<T>,
    onDone: (value: T) => void,
  ) {
    setBusy(kind)
    setError(null)
    try {
      onDone(await action())
    } catch (err) {
      // แสดงข้อความจาก API ตรง ๆ — backend เป็นเจ้าของกฎ และข้อความของมัน
      // บอกเป็นตัวเลขอยู่แล้วว่าขาดอะไร (เช่น "ขาดอีก 10%")
      setError(err instanceof ApiError ? err.message : 'ทำรายการไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  /** บันทึกค่าปัจจุบันเป็นฉบับร่าง (สร้างใหม่หรืออัปเดต) แล้วคืนงานที่บันทึกแล้ว */
  async function saveDraft(): Promise<Assignment> {
    if (assignment && assignment.status === 'DRAFT' && !dirty) return assignment
    const input = toCreateInput(draft, classroomId, timezone)
    const saved = draftId ? await updateAssignment(draftId, input) : await createAssignment(input)
    setAssignment(saved)
    setSavedDraft(JSON.stringify(draft))
    onChanged?.()
    return saved
  }

  function checkFeasibility() {
    if (blocker || weightProblem) return
    void run(
      'feasibility',
      async () => {
        const saved = await saveDraft()
        return (await getFeasibility(saved.id)).items
      },
      (items) => {
        setFeasibility(items)
        setView('feasibility')
        window.scrollTo({ top: 0 })
      },
    )
  }

  function requestPublish() {
    if (blocker || weightProblem) return
    void run(
      'feasibility',
      async () => {
        const saved = await saveDraft()
        return (await getFeasibility(saved.id)).items
      },
      (items) => {
        setFeasibility(items)
        setConfirming(true)
      },
    )
  }

  function publish() {
    if (!assignment) return
    void run(
      'publish',
      () => publishAssignment(assignment.id),
      (result) => {
        setPublished(result)
        setConfirming(false)
        setAssignment({ ...assignment, status: 'PUBLISHED' })
        onChanged?.()
        onPublished?.(assignment.name, result)
      },
    )
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    checkFeasibility()
  }

  const groupFeasibility = feasibility?.find((f) => f.side === 'GROUP')
  const sectionHead = (title: string, hint: string, tone: 'muted' | 'err' = 'muted') => (
    <div className="border-b border-edge bg-surface-cream px-5 py-4">
      <h3 className="font-display text-[16px] font-semibold">{title}</h3>
      <p className={`mt-1 text-[13px] ${tone === 'err' ? 'text-err' : 'text-ink-2'}`}>{hint}</p>
    </div>
  )
  const card = 'overflow-hidden rounded-3xl border border-edge bg-white'
  const input = `${CTRL} max-w-95 min-h-10 text-[14px]`

  return (
    <div data-testid="assignment-panel" aria-labelledby="h-asg" className="flex flex-col gap-4">
      <h2 id="h-asg" className="sr-only">
        {draftId ? 'แก้ไขงานฉบับร่าง' : 'สร้างงานประเมิน'}
      </h2>
      {error && (
        <Banner tone="err" data-testid="assignment-error" role="alert">
          {error}
        </Banner>
      )}
      {loadingDraft && <p role="status">กำลังโหลดฉบับร่าง…</p>}
      {editingId && (
        <Link to={`/classrooms/${classroomId}#assignments`} className={btn('ghost', 'sm', 'w-fit')}>
          สร้างงานใหม่แทน
        </Link>
      )}
      {dirty && (
        <Banner tone="warn">มีการแก้ไขที่ยังไม่ได้บันทึก · ระบบจะบันทึกฉบับร่างให้เมื่อกดตรวจหรือเผยแพร่</Banner>
      )}

      {view === 'feasibility' && feasibility ? (
        <div data-testid="feasibility" className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setView('form')}
              className={`text-[14px] font-semibold text-accent-ink hover:underline ${FOCUS}`}
            >
              ‹ กลับไปแก้ไข
            </button>
            <h3 className="font-display text-[22px] font-bold">ตรวจความเป็นไปได้ก่อนเผยแพร่</h3>
          </div>
          {feasibility.map((f) => (
            <section key={f.side} data-testid={`feasibility-${f.side}`} className={card}>
              {sectionHead(
                f.side === 'GROUP' ? 'ฝั่งกลุ่ม' : 'ฝั่งรายบุคคล',
                f.reason ?? (f.feasible ? 'ทำได้ด้วยค่าปัจจุบัน' : 'ทำไม่ได้ด้วยค่าปัจจุบัน'),
              )}
              <table className="w-full text-[14.5px]">
                <thead className="bg-table-head text-left">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-normal">
                      รายการ
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-normal">
                      ค่า
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  <tr>
                    <td className="px-5 py-3">จำนวนนักศึกษา (S)</td>
                    <td className="px-5 py-3 text-right">{studentCount}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3">coverage ที่ตั้งไว้ (R)</td>
                    <td className="px-5 py-3 text-right">{f.requestedCoverage}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3">coverage ที่ทำได้จริง</td>
                    <td className="px-5 py-3 text-right">{f.achievableCoverage}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3">ภาระต่อคนต่อเกณฑ์ (k)</td>
                    <td className="px-5 py-3 text-right">{f.workloadPerEvaluator} คู่</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3">เกณฑ์ทั้งหมด</td>
                    <td className="px-5 py-3 text-right">{draftCriteria(draft, f.side).length} เกณฑ์</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3">ผลประเมินรวมทั้งงาน</td>
                    <td className="px-5 py-3 text-right">{f.totalComparisons} รายการ</td>
                  </tr>
                </tbody>
              </table>
            </section>
          ))}
          {feasibility.map(
            (f) =>
              f.lowAnonymityNote && (
                <div
                  key={`note-${f.side}`}
                  data-testid={`low-anonymity-note-${f.side}`}
                  className="flex items-center gap-4 rounded-3xl bg-caution-soft px-6 py-5"
                >
                  <span aria-hidden="true" className="text-xl">
                    ⚠️
                  </span>
                  <div>
                    <p className="font-display text-[17px] font-semibold text-warn">anonymity ต่ำ</p>
                    <p className="mt-1 text-[14px] text-ink-2">{f.lowAnonymityNote}</p>
                  </div>
                </div>
              ),
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setView('form')}
              className={btn('ghost', 'md', 'border-brand-600 px-4 text-accent-ink')}
            >
              กลับไปแก้ไข
            </button>
            <button
              type="button"
              disabled={busy !== null || assignment?.status !== 'DRAFT'}
              onClick={() => setConfirming(true)}
              className={btn('primary', 'md', 'px-4')}
            >
              เผยแพร่และจัดคู่
            </button>
          </div>
        </div>
      ) : (
        <form id="assignment-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <section className={card}>
            {sectionHead('ข้อมูลพื้นฐาน', 'ชื่องาน คะแนนเต็ม และกำหนดส่งของแต่ละฝั่ง')}
            <div className="flex flex-col gap-3 px-5 py-5">
              <Field id="assignment-name" label="ชื่องานประเมิน">
                <input
                  id="assignment-name"
                  value={draft.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="งานกลุ่มครั้งที่ 1"
                  className={input}
                />
              </Field>
              <Field id="assignment-description" label="คำอธิบายงาน">
                <input
                  id="assignment-description"
                  value={draft.description ?? ''}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="ส่งต้นแบบ UI พร้อมลิงก์ Figma ของกลุ่ม"
                  className={input}
                />
              </Field>
              <Field id="assignment-group-max" label="คะแนนเต็มฝั่งกลุ่ม">
                <input
                  id="assignment-group-max"
                  type="number"
                  min={0}
                  value={draft.groupMaxScore ?? 15}
                  onChange={(e) => set('groupMaxScore', Number(e.target.value))}
                  className={input}
                />
              </Field>
              <Field
                id="assignment-individual-max"
                label="คะแนนเต็มรายบุคคล"
                help="ใส่ 0 ถ้าไม่ต้องการให้ประเมินเพื่อนในกลุ่ม"
              >
                <input
                  id="assignment-individual-max"
                  type="number"
                  min={0}
                  max={100}
                  value={draft.individualMaxScore}
                  aria-describedby="assignment-individual-max-help"
                  onChange={(e) => set('individualMaxScore', Number(e.target.value))}
                  className={input}
                />
              </Field>
            </div>
          </section>

          <CriteriaEditor side="GROUP" draft={draft} onChange={onDraftChange} />
          {individual && <CriteriaEditor side="INDIVIDUAL" draft={draft} onChange={onDraftChange} />}

          <section className={card}>
            {sectionHead(
              'การคำนวณคะแนน',
              'ค่าตั้งต้นของระบบ · ตั้งค่าได้ต่องาน · นักศึกษาเห็นแบบเดียวกันตั้งแต่เปิดงาน',
            )}
            <div className="flex flex-col gap-3 px-5 py-5">
              {/* Figma J13a — สัดส่วนแสดงเป็นเปอร์เซ็นต์ จำนวนแสดงหน่วย · เก็บเป็นสัดส่วน 0–1 ตาม API */}
              <Field id="score-floor" label="ช่วงคะแนน (floor – ceiling)">
                <div className="flex max-w-95 items-center gap-2">
                  <Unit unit="%">
                    <input
                      id="score-floor"
                      aria-label="คะแนนขั้นต่ำ (เปอร์เซ็นต์)"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={percent(draft.scoreFloor ?? 0.6)}
                      onChange={(event) => set('scoreFloor', Number(event.target.value) / 100)}
                      className={`${CTRL} min-h-10 pr-9 text-[14px]`}
                    />
                  </Unit>
                  <span aria-hidden="true">–</span>
                  <Unit unit="%">
                    <input
                      id="score-ceiling"
                      aria-label="คะแนนขั้นสูง (เปอร์เซ็นต์)"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={percent(draft.scoreCeiling ?? 1)}
                      onChange={(event) => set('scoreCeiling', Number(event.target.value) / 100)}
                      className={`${CTRL} min-h-10 pr-9 text-[14px]`}
                    />
                  </Unit>
                </div>
              </Field>
              <Field id="instructor-weight" label="น้ำหนักคำตอบของอาจารย์ (instructor_weight)">
                <input
                  id="instructor-weight"
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={draft.instructorWeight ?? 1}
                  onChange={(event) => set('instructorWeight', Number(event.target.value))}
                  className={input}
                />
              </Field>
              <Field id="completion-threshold" label="เกณฑ์การมีส่วนร่วม (completion threshold)">
                <Unit unit="%" className="max-w-95">
                  <input
                    id="completion-threshold"
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={percent(draft.completionThreshold ?? 0.9)}
                    onChange={(event) => set('completionThreshold', Number(event.target.value) / 100)}
                    className={`${input} pr-9`}
                  />
                </Unit>
              </Field>
              <Field id="min-comparisons" label="ผู้ประเมินขั้นต่ำก่อนแสดงคะแนนรายบุคคล (k_min)">
                <Unit unit="คน" className="max-w-95">
                  <input
                    id="min-comparisons"
                    type="number"
                    min={1}
                    max={100}
                    value={draft.minComparisons ?? 3}
                    onChange={(event) => set('minComparisons', Number(event.target.value))}
                    className={`${input} pr-11`}
                  />
                </Unit>
              </Field>
              {/* targetCoverage = จำนวนผลประเมินที่แต่ละคู่ควรได้ · คู่ที่ได้น้อยกว่านี้ขึ้น "ข้อมูลไม่พอ" ในรายงาน coverage */}
              <Field
                id="assignment-coverage"
                label="จำนวนผลประเมินขั้นต่ำก่อนถือว่าข้อมูลพอ"
                help="จำนวนผลที่แต่ละคู่ควรได้ · ยิ่งมาก ผลอันดับยิ่งนิ่ง แต่ภาระของนักศึกษาก็มากขึ้นตาม"
              >
                <Unit unit="ครั้ง" className="max-w-95">
                  <input
                    id="assignment-coverage"
                    type="number"
                    min={1}
                    max={20}
                    value={draft.targetCoverage}
                    aria-describedby="assignment-coverage-help"
                    onChange={(e) => set('targetCoverage', Number(e.target.value))}
                    className={`${input} pr-13`}
                  />
                </Unit>
              </Field>
            </div>
          </section>

          {groupNames.length > 0 && (
            <section className={card}>
              {sectionHead(
                'ลิงก์ผลงานของแต่ละกลุ่ม',
                'นักศึกษาจะเปิดดูผลงานได้จากหน้าประเมิน — ถ้าไม่มีลิงก์ การเปรียบเทียบจะไม่มีความหมาย',
              )}
              <div className="flex flex-col gap-2.5 px-5 py-5">
                {groupNames.map((name) => (
                  <label key={name} className="grid items-center gap-2 text-[14px] sm:grid-cols-[4.5rem_1fr]">
                    กลุ่ม {name}
                    <input
                      aria-label={`ลิงก์ผลงาน ${name}`}
                      type="url"
                      placeholder="https://drive.google.com/…"
                      value={draft.groupArtifactUrls?.[name] ?? ''}
                      onChange={(event) =>
                        set('groupArtifactUrls', { ...draft.groupArtifactUrls, [name]: event.target.value })
                      }
                      className={`${CTRL} min-h-10 text-[14px]`}
                    />
                  </label>
                ))}
              </div>
            </section>
          )}

          <section className={card}>
            {sectionHead('เวลาเปิดรับและกำหนดส่ง', `วันเปิดต้องก่อนกำหนดส่งทั้งสองฝั่ง · เก็บ UTC แสดง ${timezone}`)}
            <div className="flex flex-col gap-4 px-5 py-5">
              <div role="radiogroup" aria-label="เวลาเปิดรับประเมิน" className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    scheduled: false,
                    title: 'เปิดรับทันทีเมื่อเผยแพร่',
                    hint: 'นักศึกษาเริ่มประเมินได้ทันทีหลังเผยแพร่',
                  },
                  { scheduled: true, title: 'กำหนดวันและเวลาเปิดรับ', hint: 'ก่อนถึงเวลา งานจะขึ้นว่า "รอเปิดรับ"' },
                ].map((option) => {
                  const checked = (draft.opensAt !== undefined) === option.scheduled
                  return (
                    <label
                      key={option.title}
                      className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 ${checked ? 'border-brand-600 bg-accent-soft' : 'border-edge bg-white'}`}
                    >
                      <input
                        type="radio"
                        name="opens-mode"
                        checked={checked}
                        onChange={() => set('opensAt', option.scheduled ? '' : undefined)}
                        className="mt-1 accent-cta"
                      />
                      <span>
                        <span className="block text-[14px] font-semibold">{option.title}</span>
                        <span className="block text-[12px] text-muted">{option.hint}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              {draft.opensAt !== undefined && (
                <Field
                  id="assignment-opens"
                  label="วันและเวลาเปิดรับ"
                  help="ต้องอยู่ก่อนกำหนดส่ง ระบบจะเปิดรับเมื่อถึงเวลานี้"
                >
                  <DeadlinePicker
                    id="assignment-opens"
                    value={draft.opensAt}
                    timezone={timezone}
                    describedBy="assignment-opens-help"
                    onChange={(value) => set('opensAt', value)}
                  />
                </Field>
              )}
              {individual && (
                <label className="flex items-start gap-3 text-[14px]">
                  <input
                    type="checkbox"
                    checked={!draft.individualDeadline}
                    onChange={(event) => set('individualDeadline', event.target.checked ? '' : draft.deadline)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold">ใช้กำหนดส่งเดียวกันทั้งฝั่งกลุ่มและรายบุคคล</span>
                    <span className="block text-[12px] text-muted">
                      ตั้งกำหนดส่งแยกกันอยู่ · ติ๊กเพื่อใช้วันเวลาเดียวกัน
                    </span>
                  </span>
                </label>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="assignment-deadline"
                  label={individual ? 'ฝั่งกลุ่ม' : 'กำหนดส่ง'}
                  help="เลือกด้วยปี พ.ศ. และเวลาแบบ 24 ชั่วโมง"
                >
                  <DeadlinePicker
                    id="assignment-deadline"
                    value={draft.deadline}
                    timezone={timezone}
                    describedBy="assignment-deadline-help"
                    onChange={(value) => set('deadline', value)}
                  />
                </Field>
                {individual && draft.individualDeadline !== '' && draft.individualDeadline !== undefined && (
                  <Field id="individual-deadline" label="รายบุคคล">
                    <DeadlinePicker
                      id="individual-deadline"
                      value={draft.individualDeadline ?? ''}
                      timezone={timezone}
                      onChange={(value) => set('individualDeadline', value)}
                    />
                  </Field>
                )}
              </div>
            </div>
          </section>
        </form>
      )}

      {published && (
        <Banner tone="ok" data-testid="publish-result" role="status">
          เผยแพร่แล้ว · สร้างคู่ประเมิน <b className="font-mono tabular">{published.pairsCreated}</b> คู่
        </Banner>
      )}
      {assignment && (
        <span data-testid="assignment-status" className="sr-only">
          {STATUS_LABEL[assignment.status] ?? assignment.status} · {assignment.status}
        </span>
      )}

      {view === 'form' && (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <p
            data-testid="assignment-readiness"
            className={`mr-auto text-[17px] ${blocker || weightProblem ? 'text-err' : 'text-ink-2'}`}
          >
            {blocker ??
              weightProblem ??
              (assignment && assignment.status !== 'DRAFT' ? 'เผยแพร่งานนี้แล้ว' : 'พร้อมตรวจและเผยแพร่')}
          </p>
          <button
            type="submit"
            form="assignment-form"
            disabled={
              loadingDraft ||
              busy !== null ||
              blocker !== null ||
              weightProblem !== null ||
              Boolean(assignment && assignment.status !== 'DRAFT')
            }
            className={btn('ghost', 'md', 'border-brand-600 px-4 text-accent-ink')}
          >
            {busy === 'feasibility' && <Spinner />}
            ตรวจความเป็นไปได้
          </button>
          <button
            type="button"
            onClick={requestPublish}
            disabled={
              loadingDraft ||
              busy !== null ||
              blocker !== null ||
              weightProblem !== null ||
              Boolean(assignment && assignment.status !== 'DRAFT')
            }
            className={btn('primary', 'md', 'px-4')}
          >
            เผยแพร่และจัดคู่
          </button>
        </div>
      )}

      {confirming && assignment && (
        <PublishConfirmDialog
          feasibility={groupFeasibility ?? null}
          groupCount={groupNames.length}
          opensLabel={draft.opensAt ? draft.opensAt.replace('T', ' ') : 'ทันทีเมื่อเผยแพร่'}
          busy={busy === 'publish'}
          onCancel={() => setConfirming(false)}
          onConfirm={publish}
        />
      )}
    </div>
  )
}

/** Figma J15 · ยืนยันเผยแพร่และจัดคู่ */
function PublishConfirmDialog({
  feasibility,
  groupCount,
  opensLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  feasibility: Feasibility | null
  groupCount: number
  opensLabel: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const ref = useModal()
  const rows: [string, string][] = [
    ['เปิดรับ', opensLabel],
    ['จำนวนกลุ่ม', `${groupCount} กลุ่ม`],
    ...(feasibility
      ? [
          ['coverage ที่ตั้งไว้', `${feasibility.requestedCoverage} ครั้ง/คู่`] as [string, string],
          ['coverage ที่ทำได้จริง', `${feasibility.achievableCoverage} ครั้ง/คู่`] as [string, string],
          ['ภาระต่อคน', `${feasibility.workloadPerEvaluator} คู่/เกณฑ์`] as [string, string],
        ]
      : []),
  ]
  return (
    <dialog
      ref={ref}
      aria-labelledby="publish-confirm-title"
      data-testid="publish-confirm"
      onClose={onCancel}
      className="fixed inset-0 m-auto w-[calc(100vw-2rem)] max-w-130 overflow-hidden rounded-3xl bg-white p-0 text-ink shadow-xl backdrop:bg-ink/40"
    >
      <div className="bg-surface-cream px-6 pt-6 pb-4">
        <h2 id="publish-confirm-title" className="font-display text-[22px] font-bold">
          เผยแพร่งานประเมินและจัดคู่
        </h2>
        <p className="mt-1 text-[14px] text-ink-2">ระบบคำนวณความเป็นไปได้จากจำนวนกลุ่มและนักศึกษาในห้องนี้แล้ว</p>
      </div>
      <div className="px-6 py-4">
        {feasibility?.reason && (
          <p className="flex gap-2 rounded-2xl bg-caution-soft px-4 py-3 text-[13.5px] text-warn">
            <span aria-hidden="true">⚠</span>
            {feasibility.reason}
          </p>
        )}
        <dl className="mt-3 space-y-1.5 rounded-2xl bg-table-head px-4 py-3 text-[14px]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt>{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex justify-end gap-3 border-t border-edge bg-table-head px-6 py-4">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className={btn('ghost', 'md', 'border-brand-600 px-4 text-accent-ink')}
        >
          ยกเลิก
        </button>
        <button type="button" disabled={busy} onClick={onConfirm} className={btn('primary', 'md', 'px-4')}>
          {busy && <Spinner />}เผยแพร่และจัดคู่
        </button>
      </div>
    </dialog>
  )
}
