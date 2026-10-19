import { CTRL } from './Ui'
import type { CriterionSide } from '../lib/api'
import { type AssignmentDraft, type CriterionDraft, draftCriteria } from '../lib/assignment'

/** การ์ด "เกณฑ์และน้ำหนัก" ตาม Figma J13a / J13b */
export function CriteriaEditor({ side, draft, onChange }: { side: CriterionSide; draft: AssignmentDraft; onChange: (draft: AssignmentDraft) => void }) {
  const rows = draftCriteria(draft, side)
  const label = side === 'GROUP' ? 'กลุ่ม' : 'บุคคล'
  const total = rows.reduce((sum, row) => sum + (Number.isFinite(row.weightPct) ? row.weightPct : 0), 0)
  const ok = total === 100
  function setRows(next: CriterionDraft[]) {
    onChange({ ...draft, [side === 'GROUP' ? 'groupCriteria' : 'individualCriteria']: next })
  }
  function edit(index: number, patch: Partial<CriterionDraft>) {
    setRows(rows.map((row, i) => i === index ? { ...row, ...patch } : row))
  }
  return (
    <fieldset className="m-0 min-w-0 overflow-hidden rounded-3xl border border-edge bg-white p-0">
      <legend className="sr-only">เกณฑ์และน้ำหนัก — ฝั่ง{label}</legend>
      <div className="border-b border-edge bg-surface-cream px-5 py-4">
        <p aria-hidden="true" className="font-display text-[16px] font-semibold">เกณฑ์และน้ำหนัก — {side === 'GROUP' ? 'ฝั่งกลุ่ม' : 'รายบุคคล'}</p>
        <p className={`mt-1 text-[13px] ${ok ? 'text-ink-2' : 'text-err'}`}>
          {ok
            ? side === 'GROUP' ? 'น้ำหนักรวมต้องเป็น 100% พอดีจึงจะเผยแพร่ได้' : 'ใช้เมื่อคะแนนเต็มรายบุคคล > 0 · น้ำหนักรวมต้องเป็น 100%'
            : `น้ำหนักรวม ${total}% — ต้องเป็น 100% พอดีจึงจะเผยแพร่ได้`}
        </p>
      </div>
      <div className="flex flex-col gap-3 px-5 py-5">
        {rows.map((row, index) => (
          <div key={index} className="grid min-w-0 items-start gap-2 sm:grid-cols-[minmax(0,26rem)_6.5rem_1fr_auto]">
            <div className="min-w-0">
              <input aria-label={`ชื่อเกณฑ์ฝั่ง${label} ${index + 1}`} placeholder="ชื่อเกณฑ์" value={row.name} onChange={(event) => edit(index, { name: event.target.value })} className={`${CTRL} min-h-10 text-[14px]`} />
              <input aria-label={`คำถามฝั่ง${label} เกณฑ์ ${index + 1}`} placeholder="คำถามที่นักศึกษาจะเห็น (ไม่บังคับ)" value={row.question ?? ''} onChange={(event) => edit(index, { question: event.target.value })} className={`${CTRL} mt-1.5 min-h-9 text-[13px]`} />
            </div>
            <div className="relative">
              <input id={index === 0 ? `weight-${side === 'GROUP' ? 'group' : 'individual'}` : undefined} aria-label={index === 0 ? `น้ำหนักเกณฑ์ฝั่ง${label} (%)` : `น้ำหนักฝั่ง${label} เกณฑ์ ${index + 1}`} type="number" min={0} max={100} step="0.01" value={row.weightPct} onChange={(event) => edit(index, { weightPct: Number(event.target.value) })} className={`${CTRL} min-h-10 pr-7 font-display text-[14px] font-semibold`} />
              <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[14px] font-semibold">%</span>
            </div>
            <span />
            <button type="button" aria-label={`ลบเกณฑ์ฝั่ง${label} ${index + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, i) => i !== index))} className="grid size-10 place-items-center rounded-full border border-brand-600 text-[13px] text-accent-ink hover:bg-accent-soft disabled:opacity-40">ลบ</button>
          </div>
        ))}
        <button type="button" onClick={() => setRows([...rows, { name: '', weightPct: 0 }])} className="w-fit rounded-full border border-brand-600 bg-accent-soft px-4 py-1.5 font-display text-[13px] font-semibold text-accent-ink">+ เพิ่มเกณฑ์ฝั่ง{label}</button>
        <div className="flex justify-between text-[14px] font-semibold">
          <span>รวมน้ำหนัก</span>
          <span className={ok ? 'text-ink' : 'text-err'}>{total}%</span>
        </div>
      </div>
    </fieldset>
  )
}
