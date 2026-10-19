import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { DeadlinePicker } from './DeadlinePicker'
import { CriteriaEditor } from './CriteriaEditor'
import { Banner, CTRL, Card, CardHead, Pill, Spinner, btn } from './Ui'
import { IconAlert, IconCheckCircle, IconClipboardCheck } from './icons'
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

/** แถบวัดน้ำหนักของฝั่งหนึ่ง — ตัวเลขเปลี่ยนตามที่พิมพ์ทันที ไม่ต้องรอกดปุ่ม */
function WeightMeter({ label, total, ok, message }: {
  label: string
  total: number
  ok: boolean
  message: string | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-sand px-4 py-3">
      <span className="text-[13.5px] text-ink-2">{label}ต้องรวมได้ 100%</span>
      <span
        aria-hidden="true"
        className="h-2 w-full max-w-45 overflow-hidden rounded-full border border-edge bg-white"
      >
        <span
          className={`block h-full rounded-full ${ok ? 'bg-ok-700' : 'bg-err'}`}
          style={{ width: `${Math.min(100, Math.max(0, total))}%` }}
        />
      </span>
      <span
        className={`ml-auto font-mono text-lg tabular ${ok ? 'text-ok-700' : 'text-err'}`}
      >
        {total}%
      </span>
      {message && (
        <span className="flex w-full items-center gap-1.5 text-[12.5px] font-semibold text-err">
          <IconAlert className="size-3.5 shrink-0" />
          {message} — ปรับให้ครบ 100% ก่อนเผยแพร่ ไม่งั้นระบบจะปฏิเสธตอนจัดคู่
        </span>
      )}
    </div>
  )
}

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
      <label htmlFor={id} className="font-display text-sm font-semibold">
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
  groupNames = [],
  editingId,
}: {
  classroomId: string
  draft: AssignmentDraft
  onDraftChange: (next: AssignmentDraft) => void
  studentCount: number
  timezone: string
  onChanged?: () => void
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
  useEffect(() => {
    if (!editingId) { setAssignment(null); return }
    let active = true
    setLoadingDraft(true)
    void getAssignment(editingId).then((value) => {
      if (!active) return
      if (value.status !== 'DRAFT') { setError('แก้ไขได้เฉพาะงานฉบับร่าง'); return }
      setAssignment(value); setFeasibility(null); setPublished(null); setError(null)
      const loaded = assignmentToDraft(value, timezone)
      onDraftChange(loaded); setSavedDraft(JSON.stringify(loaded))
    }).catch((err) => { if (active) setError(err instanceof ApiError ? err.message : 'โหลดฉบับร่างไม่สำเร็จ') }).finally(() => { if (active) setLoadingDraft(false) })
    return () => { active = false }
  }, [editingId, onDraftChange, timezone])

  const individual = individualEnabled(draft)
  const checks = weightChecks(draft)
  const blocker = draftBlocker(draft, studentCount)
  const dirty = Boolean(assignment && savedDraft !== JSON.stringify(draft))
  const draftId = editingId ?? (assignment?.status === 'DRAFT' ? assignment.id : undefined)

  const set = <K extends keyof AssignmentDraft>(key: K, value: AssignmentDraft[K]) =>
    onDraftChange({ ...draft, [key]: value })

  async function run<T>(kind: 'create' | 'feasibility' | 'publish', action: () => Promise<T>, onDone: (value: T) => void) {
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

  function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (blocker) return

    setFeasibility(null)
    setPublished(null)
    void run(
      'create',
      () => draftId ? updateAssignment(draftId, toCreateInput(draft, classroomId, timezone)) : createAssignment(toCreateInput(draft, classroomId, timezone)),
      (created) => { setAssignment(created); setSavedDraft(JSON.stringify(draft)); onChanged?.() },
    )
  }

  return (
    <>
      <Card data-testid="assignment-panel" aria-labelledby="h-asg">
        <CardHead
          id="h-asg"
          icon={<IconClipboardCheck className="size-5" />}
          title={draftId ? 'แก้ไขงานฉบับร่าง' : 'สร้างงานประเมิน'}
          hint="สร้างงาน → ตรวจความเป็นไปได้ → เผยแพร่ให้ระบบจัดคู่อัตโนมัติ"
        />

        <div className="p-6 max-sm:p-4">
          {error && (
            <Banner tone="err" data-testid="assignment-error" role="alert" className="mb-5">
              {error}
            </Banner>
          )}

          {editingId && <Link to={`/classrooms/${classroomId}#assignments`} className={btn('ghost', 'sm', 'mb-4')}>สร้างงานใหม่</Link>}
          {!editingId && assignment && <button type="button" onClick={() => { setAssignment(null); setFeasibility(null); setPublished(null); setSavedDraft(null); setError(null) }} className={btn('ghost', 'sm', 'mb-4')}>เริ่มสร้างงานใหม่</button>}
          {loadingDraft && <p role="status">กำลังโหลดฉบับร่าง…</p>}
          <form id="assignment-form" onSubmit={handleCreate} noValidate>
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-4 font-display text-[13px] font-semibold tracking-widest text-muted uppercase">
                ข้อมูลงาน
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="assignment-name" label="ชื่องานประเมิน">
                  <input
                    id="assignment-name"
                    value={draft.name}
                    onChange={(e) => set('name', e.target.value)}
                    className={CTRL}
                  />
                </Field>

                <Field
                  id="assignment-deadline"
                  label="กำหนดส่ง"
                  help="เลือกด้วยปี พ.ศ. และเวลาแบบ 24 ชั่วโมง ระบบบันทึกตามเขตเวลาของห้องเรียน"
                >
                  <DeadlinePicker
                    id="assignment-deadline"
                    value={draft.deadline}
                    timezone={timezone}
                    describedBy="assignment-deadline-help"
                    onChange={(value) => set('deadline', value)}
                  />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field id="assignment-description" label="คำอธิบายงาน">
                  <textarea id="assignment-description" value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} className={CTRL} />
                </Field>
                <Field id="assignment-artifact" label="ลิงก์รวมผลงาน">
                  <input id="assignment-artifact" type="url" value={draft.artifactUrl ?? ''} onChange={(e) => set('artifactUrl', e.target.value)} className={CTRL} />
                </Field>
                <Field id="assignment-group-max" label="คะแนนเต็มฝั่งกลุ่ม">
                  <input id="assignment-group-max" type="number" min={0} value={draft.groupMaxScore ?? 15} onChange={(e) => set('groupMaxScore', Number(e.target.value))} className={CTRL} />
                </Field>
              </div>
            </fieldset>

            <fieldset className="m-0 mt-6 border-0 border-t border-edge p-0 pt-6">
              <legend className="mb-4 font-display text-[13px] font-semibold tracking-widest text-muted uppercase">
                การจับคู่ประเมิน
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="assignment-coverage"
                  label="จำนวนคู่ที่ผู้ประเมินแต่ละคนต้องประเมิน"
                  help="ยิ่งมาก ผลอันดับยิ่งนิ่ง แต่ภาระของนักศึกษาก็มากขึ้นตาม ตรวจความเป็นไปได้จะบอกว่าจำนวนสมาชิกรองรับได้จริงเท่าไร"
                >
                  <input
                    id="assignment-coverage"
                    type="number"
                    min={1}
                    max={20}
                    value={draft.targetCoverage}
                    aria-describedby="assignment-coverage-help"
                    onChange={(e) => set('targetCoverage', Number(e.target.value))}
                    className={`${CTRL} font-mono tabular`}
                  />
                </Field>

                <Field
                  id="assignment-individual-max"
                  label="คะแนนเต็มรายบุคคล"
                  help={
                    <>
                      ใส่ <b>0</b> เพื่อประเมินเฉพาะระดับกลุ่ม เกณฑ์ฝั่งบุคคลจะถูกปิดทั้งฝั่ง
                    </>
                  }
                >
                  <input
                    id="assignment-individual-max"
                    type="number"
                    min={0}
                    max={100}
                    value={draft.individualMaxScore}
                    aria-describedby="assignment-individual-max-help"
                    onChange={(e) => set('individualMaxScore', Number(e.target.value))}
                    className={`${CTRL} font-mono tabular`}
                  />
                </Field>
              </div>
            </fieldset>

            <CriteriaEditor side="GROUP" draft={draft} onChange={onDraftChange} />
            {individual && <CriteriaEditor side="INDIVIDUAL" draft={draft} onChange={onDraftChange} />}
            <details className="mt-6 rounded-2xl border border-edge p-5">
              <summary className="min-h-11 cursor-pointer font-display font-semibold">ตั้งค่าการคำนวณคะแนน</summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field id="score-floor" label="คะแนนขั้นต่ำ (สัดส่วน 0–1)"><input id="score-floor" type="number" min={0} max={1} step={0.001} value={draft.scoreFloor ?? 0.6} onChange={(event) => set('scoreFloor', Number(event.target.value))} className={CTRL} /></Field>
                <Field id="score-ceiling" label="คะแนนขั้นสูง (สัดส่วน 0–1)"><input id="score-ceiling" type="number" min={0} max={1} step={0.001} value={draft.scoreCeiling ?? 1} onChange={(event) => set('scoreCeiling', Number(event.target.value))} className={CTRL} /></Field>
                <Field id="instructor-weight" label="น้ำหนักผู้สอน"><input id="instructor-weight" type="number" min={0} max={10} step={0.01} value={draft.instructorWeight ?? 1} onChange={(event) => set('instructorWeight', Number(event.target.value))} className={CTRL} /></Field>
                <Field id="completion-threshold" label="เกณฑ์การมีส่วนร่วม (สัดส่วน 0–1)"><input id="completion-threshold" type="number" min={0.001} max={1} step={0.001} value={draft.completionThreshold ?? 0.9} onChange={(event) => set('completionThreshold', Number(event.target.value))} className={CTRL} /></Field>
                <Field id="min-comparisons" label="จำนวนเปรียบเทียบขั้นต่ำ" help="ใช้ตรวจความเชื่อมั่นและเกณฑ์ซ่อนคะแนนรายบุคคลตามกฎปัจจุบัน"><input id="min-comparisons" type="number" min={1} max={100} value={draft.minComparisons ?? 3} onChange={(event) => set('minComparisons', Number(event.target.value))} className={CTRL} /></Field>
              </div>
            </details>
            {individual && <div className="mt-5"><Field id="individual-deadline" label="กำหนดส่งรายบุคคล" help="หากไม่ระบุ ใช้กำหนดส่งเดียวกับฝั่งกลุ่ม"><DeadlinePicker id="individual-deadline" value={draft.individualDeadline ?? ''} timezone={timezone} describedBy="individual-deadline-help" onChange={(value) => set('individualDeadline', value)} /></Field></div>}
            <fieldset className="mt-6 rounded-2xl border border-edge p-5"><legend className="px-2 font-display font-semibold">เวลาเปิดรับประเมิน</legend><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.opensAt !== undefined} onChange={(event) => set('opensAt', event.target.checked ? '' : undefined)} />ตั้งเวลาเปิดรับล่วงหน้า</label>{draft.opensAt !== undefined && <Field id="assignment-opens" label="วันและเวลาเปิดรับ" help="ต้องอยู่ก่อนกำหนดส่ง ระบบจะเปิดรับเมื่อถึงเวลานี้"><DeadlinePicker id="assignment-opens" value={draft.opensAt} timezone={timezone} describedBy="assignment-opens-help" onChange={(value) => set('opensAt', value)} /></Field>}</fieldset>
            {groupNames.length > 0 && <fieldset className="mt-6 rounded-2xl border border-edge p-5">
              <legend className="px-2 font-display font-semibold">ลิงก์ผลงานของแต่ละกลุ่ม</legend>
              <p className="mb-4 text-xs text-muted">นักศึกษาจะเห็นลิงก์ของกลุ่มที่ได้รับมอบหมายให้เปรียบเทียบ</p>
              <div className="space-y-3">{groupNames.map((name) => <label key={name} className="grid items-center gap-2 text-sm sm:grid-cols-[9rem_1fr]">{name}<input aria-label={`ลิงก์ผลงาน ${name}`} type="url" value={draft.groupArtifactUrls?.[name] ?? ''} onChange={(event) => set('groupArtifactUrls', { ...draft.groupArtifactUrls, [name]: event.target.value })} className={CTRL} /></label>)}</div>
            </fieldset>}
            <div className="mt-4 flex flex-col gap-2">
              {checks.map((c) => <WeightMeter key={c.side} {...c} />)}
            </div>
          </form>

          {dirty && <Banner tone="warn" className="mt-4">มีการแก้ไขที่ยังไม่ได้บันทึก กรุณาบันทึกฉบับร่างก่อนตรวจหรือเผยแพร่</Banner>}
          {assignment && (
            <div
              data-testid="assignment-created"
              className="mt-6 rounded-xl border border-edge p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <b className="font-display">{assignment.name}</b>
                {/* โชว์รหัสสถานะดิบคู่กับคำไทยด้วย เพราะข้อความ error ของ API อ้างรหัสนี้ตรง ๆ
                    เช่น "แก้ criteria ได้เฉพาะตอน DRAFT" — ถ้าเห็นแต่คำไทยจะโยงกันไม่ถูก */}
                <Pill
                  data-testid="assignment-status"
                  tone={assignment.status === 'DRAFT' ? 'warn' : 'ok'}
                >
                  <span>{STATUS_LABEL[assignment.status] ?? assignment.status}</span>
                  <span aria-hidden="true" className="opacity-40">·</span>
                  <span className="font-mono text-[11.5px] opacity-70">{assignment.status}</span>
                </Pill>
              </div>

              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy !== null || dirty || assignment.status !== "DRAFT"}
                  onClick={() =>
                    void run('feasibility', () => getFeasibility(assignment.id), (r) =>
                      setFeasibility(r.items),
                    )
                  }
                  className={btn('ghost', 'sm')}
                >
                  {busy === 'feasibility' && <Spinner className="size-3.5" />}
                  ตรวจความเป็นไปได้
                </button>

                <button
                  type="button"
                  disabled={busy !== null || dirty || assignment.status !== "DRAFT"}
                  onClick={() =>
                    void run('publish', () => publishAssignment(assignment.id), (r) => {
                      setPublished(r)
                      onChanged?.()
                      setAssignment({ ...assignment, status: 'PUBLISHED' })
                    })
                  }
                  className={btn('ok', 'sm')}
                >
                  {busy === 'publish' && <Spinner className="size-3.5" />}
                  เผยแพร่และจัดคู่
                </button>
              </div>

              {feasibility && (
                <div data-testid="feasibility" className="mt-4 flex flex-col gap-3">
                  {feasibility.map((f) => (
                    <div
                      key={f.side}
                      data-testid={`feasibility-${f.side}`}
                      className={
                        'rounded-xl border p-4 text-sm ' +
                        (f.feasible
                          ? 'border-ok-line bg-ok-50'
                          : 'border-warn-line bg-warn-soft')
                      }
                    >
                      <p
                        className={`flex items-center gap-2 font-display font-semibold ${
                          f.feasible ? 'text-ok-700' : 'text-warn'
                        }`}
                      >
                        {f.feasible ? (
                          <IconCheckCircle className="size-4.5 shrink-0" />
                        ) : (
                          <IconAlert className="size-4.5 shrink-0" />
                        )}
                        ฝั่ง{f.side === 'GROUP' ? 'กลุ่ม' : 'บุคคล'} —{' '}
                        {f.feasible ? 'ทำได้ด้วยค่าปัจจุบัน' : 'ทำไม่ได้ด้วยค่าปัจจุบัน'}
                      </p>
                      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-ink-2">
                        <li>
                          coverage ที่ขอ{' '}
                          <span className="font-mono tabular">{f.requestedCoverage}</span> ·
                          ทำได้จริง{' '}
                          <b className="font-mono tabular text-ink">{f.achievableCoverage}</b>
                        </li>
                        <li>
                          งานต่อคนต่อเกณฑ์{' '}
                          <span className="font-mono tabular">{f.workloadPerEvaluator}</span> คู่
                        </li>
                        <li>
                          จำนวน comparison รวม{' '}
                          <span className="font-mono tabular">{f.totalComparisons}</span>
                        </li>
                      </ul>
                      {f.reason && (
                        <p className="mt-2.5 rounded-lg border border-edge bg-white px-3 py-2 text-ink">
                          {f.reason}
                        </p>
                      )}
                      {f.lowAnonymityNote && (
                        <p
                          data-testid={`low-anonymity-note-${f.side}`}
                          className="mt-2.5 flex items-start gap-2 rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-warn"
                        >
                          <IconAlert className="mt-0.5 size-4 shrink-0" />
                          <span>{f.lowAnonymityNote}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {published && (
                <Banner tone="ok" data-testid="publish-result" role="status" className="mt-4">
                  เผยแพร่แล้ว · สร้างคู่ประเมิน{' '}
                  <b className="font-mono tabular">{published.pairsCreated}</b> คู่ · seed{' '}
                  <span className="font-mono tabular">{published.pairingSeed}</span>
                </Banner>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* แถบล่างค้างจอ: ปุ่มสร้างงานอยู่ที่นี่ที่เดียว ไม่ซ้ำกับในการ์ด
          เพราะฟอร์มยาวกว่าหนึ่งจอเสมอ ปุ่มที่อยู่ท้ายฟอร์มจะมองไม่เห็นตอนแก้ค่าด้านบน */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-300 flex-wrap items-center gap-3 px-6 py-3 max-sm:flex-col max-sm:items-stretch max-sm:px-4">
          <span className="mr-auto flex flex-wrap items-center gap-2.5 text-[13.5px] text-ink-2">
            {checks.map((c) => (
              <Pill key={c.side} tone={c.ok ? 'ok' : 'err'}>
                {c.label} <span className="font-mono tabular">{c.total}</span>%
              </Pill>
            ))}
            <span>{blocker ?? 'พร้อมสร้างงานประเมิน'}</span>
          </span>

          <button
            type="submit"
            form="assignment-form"
            disabled={loadingDraft || busy !== null || blocker !== null || Boolean(assignment && assignment.status !== 'DRAFT') || Boolean(editingId && assignment?.id !== editingId)}
            className={btn('primary', 'md', 'max-sm:w-full')}
          >
            {busy === 'create' && <Spinner />}
            {draftId ? 'บันทึกฉบับร่าง' : assignment ? 'เผยแพร่งานแล้ว' : 'สร้างงานประเมิน'}
          </button>
        </div>
      </div>
    </>
  )
}
