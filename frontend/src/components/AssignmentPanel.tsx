import { useState } from 'react'

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
} from '../lib/api'
import {
  type AssignmentDraft,
  draftBlocker,
  individualEnabled,
  toCreateInput,
  weightChecks,
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
}: {
  classroomId: string
  draft: AssignmentDraft
  onDraftChange: (next: AssignmentDraft) => void
  studentCount: number
}) {
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [feasibility, setFeasibility] = useState<Feasibility[] | null>(null)
  const [published, setPublished] = useState<PublishResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'create' | 'feasibility' | 'publish' | null>(null)

  const individual = individualEnabled(draft)
  const checks = weightChecks(draft)
  const blocker = draftBlocker(draft, studentCount)

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
    void run('create', () => createAssignment(toCreateInput(draft, classroomId)), setAssignment)
  }

  return (
    <>
      <Card data-testid="assignment-panel" aria-labelledby="h-asg">
        <CardHead
          id="h-asg"
          icon={<IconClipboardCheck className="size-5" />}
          title="สร้างงานประเมิน"
          hint="สร้างงาน → ตรวจความเป็นไปได้ → เผยแพร่ให้ระบบจัดคู่อัตโนมัติ"
        />

        <div className="p-6 max-sm:p-4">
          {error && (
            <Banner tone="err" data-testid="assignment-error" role="alert" className="mb-5">
              {error}
            </Banner>
          )}

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
                  help="เวลาตามเขตเวลาเครื่องคุณ ระบบแปลงเป็น UTC ให้เองก่อนบันทึก"
                >
                  <input
                    id="assignment-deadline"
                    type="datetime-local"
                    value={draft.deadline}
                    aria-describedby="assignment-deadline-help"
                    onChange={(e) => set('deadline', e.target.value)}
                    className={CTRL}
                  />
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

            <fieldset className="m-0 mt-6 border-0 border-t border-edge p-0 pt-6">
              <legend className="mb-4 font-display text-[13px] font-semibold tracking-widest text-muted uppercase">
                น้ำหนักคะแนน
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="weight-group"
                  label="น้ำหนักเกณฑ์ฝั่งกลุ่ม (%)"
                  help="เกณฑ์ “คุณภาพงาน” · คะแนนเต็มฝั่งกลุ่ม 15 คะแนน"
                >
                  <input
                    id="weight-group"
                    type="number"
                    min={0}
                    max={100}
                    value={draft.groupWeight}
                    aria-describedby="weight-group-help"
                    onChange={(e) => set('groupWeight', Number(e.target.value))}
                    className={`${CTRL} font-mono tabular`}
                  />
                </Field>

                {individual && (
                  <Field
                    id="weight-individual"
                    label="น้ำหนักเกณฑ์ฝั่งบุคคล (%)"
                    help="เกณฑ์ “การมีส่วนร่วม” · หายไปเองเมื่อคะแนนเต็มรายบุคคลเป็น 0"
                  >
                    <input
                      id="weight-individual"
                      type="number"
                      min={0}
                      max={100}
                      value={draft.individualWeight}
                      aria-describedby="weight-individual-help"
                      onChange={(e) => set('individualWeight', Number(e.target.value))}
                      className={`${CTRL} font-mono tabular`}
                    />
                  </Field>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {checks.map((c) => (
                  <WeightMeter key={c.side} {...c} />
                ))}
              </div>
            </fieldset>
          </form>

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
                  disabled={busy !== null}
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
                  disabled={busy !== null}
                  onClick={() =>
                    void run('publish', () => publishAssignment(assignment.id), (r) => {
                      setPublished(r)
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
            disabled={busy !== null || blocker !== null}
            className={btn('primary', 'md', 'max-sm:w-full')}
          >
            {busy === 'create' && <Spinner />}
            สร้างงานประเมิน
          </button>
        </div>
      </div>
    </>
  )
}
