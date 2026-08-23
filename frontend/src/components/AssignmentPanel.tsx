import { useState } from 'react'

import {
  ApiError,
  type Assignment,
  type Feasibility,
  type PublishResult,
  createAssignment,
  getFeasibility,
  publishAssignment,
} from '../lib/api'

/** สร้างงานประเมิน ตรวจความเป็นไปได้ แล้วเผยแพร่ — US-04, US-05, US-06
 *
 *  สามขั้นนี้อยู่ในกล่องเดียวกันเพราะอาจารย์ทำติดกันเสมอ และขั้นกลาง (feasibility)
 *  มีไว้เพื่อไม่ให้กด publish ด้วยค่าที่เป็นไปไม่ได้ การแยกไปคนละหน้าจะทำให้คนข้ามขั้นนั้น
 */
export function AssignmentPanel({ classroomId }: { classroomId: string }) {
  const [name, setName] = useState('งานกลุ่มครั้งที่ 1')
  const [deadline, setDeadline] = useState('')
  const [targetCoverage, setTargetCoverage] = useState(5)
  const [groupWeight, setGroupWeight] = useState(100)
  const [individualWeight, setIndividualWeight] = useState(100)
  const [individualMaxScore, setIndividualMaxScore] = useState(5)

  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [feasibility, setFeasibility] = useState<Feasibility[] | null>(null)
  const [published, setPublished] = useState<PublishResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const individualEnabled = individualMaxScore > 0

  async function run<T>(action: () => Promise<T>, onDone: (value: T) => void) {
    setBusy(true)
    setError(null)
    try {
      onDone(await action())
    } catch (err) {
      // แสดงข้อความจาก API ตรง ๆ — backend เป็นเจ้าของกฎ และข้อความของมัน
      // บอกเป็นตัวเลขอยู่แล้วว่าขาดอะไร (เช่น "ขาดอีก 10%")
      setError(err instanceof ApiError ? err.message : 'ทำรายการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setFeasibility(null)
    setPublished(null)

    void run(
      () =>
        createAssignment({
          classroomId,
          name,
          groupMaxScore: 15,
          individualMaxScore,
          // input type="datetime-local" ให้เวลาท้องถิ่นไม่มี timezone — แปลงเป็น UTC ก่อนส่ง
          // ถ้าส่งดิบ ๆ backend จะตีความเป็น UTC แล้ว deadline จะเพี้ยนไปตามเขตเวลาของผู้ใช้
          groupDeadlineUtc: new Date(deadline).toISOString(),
          targetCoverage,
          criteria: [
            { side: 'GROUP', name: 'คุณภาพงาน', weightPct: groupWeight },
            ...(individualEnabled
              ? [
                  {
                    side: 'INDIVIDUAL' as const,
                    name: 'การมีส่วนร่วม',
                    weightPct: individualWeight,
                  },
                ]
              : []),
          ],
        }),
      setAssignment,
    )
  }

  return (
    <section
      data-testid="assignment-panel"
      className="mt-8 rounded-xl border border-line bg-white p-6"
    >
      <h2 className="text-lg font-semibold">งานประเมิน</h2>
      <p className="mt-1 text-sm text-muted">
        สร้างงาน → ตรวจความเป็นไปได้ → เผยแพร่ให้ระบบจัดคู่อัตโนมัติ
      </p>

      {error && (
        <p
          data-testid="assignment-error"
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="assignment-name" className="block text-sm font-medium">
            ชื่องานประเมิน
          </label>
          <input
            id="assignment-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <label htmlFor="assignment-deadline" className="block text-sm font-medium">
            กำหนดส่ง
          </label>
          <input
            id="assignment-deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <label htmlFor="assignment-coverage" className="block text-sm font-medium">
            coverage ที่ต้องการ (ครั้งต่อคู่)
          </label>
          <input
            id="assignment-coverage"
            type="number"
            min={1}
            max={20}
            value={targetCoverage}
            onChange={(e) => setTargetCoverage(Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <label htmlFor="assignment-individual-max" className="block text-sm font-medium">
            คะแนนเต็มรายบุคคล (0 = ปิดการประเมินรายบุคคล)
          </label>
          <input
            id="assignment-individual-max"
            type="number"
            min={0}
            value={individualMaxScore}
            onChange={(e) => setIndividualMaxScore(Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <label htmlFor="weight-group" className="block text-sm font-medium">
            น้ำหนักเกณฑ์ฝั่งกลุ่ม (%)
          </label>
          <input
            id="weight-group"
            type="number"
            min={0}
            max={100}
            value={groupWeight}
            onChange={(e) => setGroupWeight(Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-500"
          />
        </div>

        {individualEnabled && (
          <div>
            <label htmlFor="weight-individual" className="block text-sm font-medium">
              น้ำหนักเกณฑ์ฝั่งบุคคล (%)
            </label>
            <input
              id="weight-individual"
              type="number"
              min={0}
              max={100}
              value={individualWeight}
              onChange={(e) => setIndividualWeight(Number(e.target.value))}
              className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand-500"
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy || !deadline}
            className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'กำลังทำงาน…' : 'สร้างงานประเมิน'}
          </button>
        </div>
      </form>

      {assignment && (
        <div data-testid="assignment-created" className="mt-6 rounded-lg border border-line p-4">
          <p className="text-sm">
            <span className="font-medium">{assignment.name}</span> ·{' '}
            <span data-testid="assignment-status" className="text-muted">
              สถานะ {assignment.status}
            </span>
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => getFeasibility(assignment.id), (r) => setFeasibility(r.items))}
              className="rounded-lg border border-line px-4 py-2 text-sm transition-colors hover:bg-cream disabled:opacity-50"
            >
              ตรวจความเป็นไปได้
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () => publishAssignment(assignment.id),
                  (r) => {
                    setPublished(r)
                    setAssignment({ ...assignment, status: 'PUBLISHED' })
                  },
                )
              }
              className="rounded-lg bg-ok-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ok-500 disabled:opacity-50"
            >
              เผยแพร่และจัดคู่
            </button>
          </div>
        </div>
      )}

      {feasibility && (
        <div data-testid="feasibility" className="mt-4 space-y-3">
          {feasibility.map((f) => (
            <div
              key={f.side}
              data-testid={`feasibility-${f.side}`}
              className="rounded-lg border border-line p-4 text-sm"
            >
              <p className="font-medium">
                ฝั่ง{f.side === 'GROUP' ? 'กลุ่ม' : 'บุคคล'} —{' '}
                {f.feasible ? 'ทำได้' : 'ทำไม่ได้ด้วยค่าปัจจุบัน'}
              </p>
              <ul className="mt-2 space-y-1 text-muted">
                <li>
                  coverage ที่ขอ {f.requestedCoverage} · ทำได้จริง{' '}
                  <span className="font-medium text-ink">{f.achievableCoverage}</span>
                </li>
                <li>งานต่อคนต่อเกณฑ์ {f.workloadPerEvaluator} คู่</li>
                <li>จำนวน comparison รวม {f.totalComparisons}</li>
              </ul>
              {f.reason && (
                <p className="mt-2 rounded bg-cream px-3 py-2 text-ink">{f.reason}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {published && (
        <p
          data-testid="publish-result"
          role="status"
          className="mt-4 rounded-lg border border-ok-500 bg-ok-50 px-4 py-2.5 text-sm text-ok-600"
        >
          เผยแพร่แล้ว · สร้างคู่ประเมิน {published.pairsCreated} คู่ · seed{' '}
          {published.pairingSeed}
        </p>
      )}
    </section>
  )
}
