import { CTRL, btn } from './Ui'
import type { CriterionSide } from '../lib/api'
import { type AssignmentDraft, type CriterionDraft, draftCriteria } from '../lib/assignment'

export function CriteriaEditor({ side, draft, onChange }: { side: CriterionSide; draft: AssignmentDraft; onChange: (draft: AssignmentDraft) => void }) {
  const rows = draftCriteria(draft, side)
  const label = side === 'GROUP' ? 'กลุ่ม' : 'บุคคล'
  function setRows(next: CriterionDraft[]) {
    onChange({ ...draft, [side === 'GROUP' ? 'groupCriteria' : 'individualCriteria']: next })
  }
  function edit(index: number, patch: Partial<CriterionDraft>) {
    setRows(rows.map((row, i) => i === index ? { ...row, ...patch } : row))
  }
  return (
    <fieldset className="m-0 mt-6 min-w-0 rounded-2xl border border-edge p-5 max-sm:p-4">
      <legend className="px-2 font-display text-base font-semibold">เกณฑ์และน้ำหนัก — ฝั่ง{label}</legend>
      <div className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <div key={index} className="grid min-w-0 gap-2 sm:grid-cols-[1fr_8rem_auto]">
            <label className="text-xs text-ink-2">ชื่อเกณฑ์ {index + 1}
              <input aria-label={`ชื่อเกณฑ์ฝั่ง${label} ${index + 1}`} value={row.name} onChange={(event) => edit(index, { name: event.target.value })} className={`${CTRL} mt-1 text-sm`} />
            </label>
            <label className="text-xs text-ink-2">น้ำหนัก (%)
              <input id={index === 0 ? `weight-${side === 'GROUP' ? 'group' : 'individual'}` : undefined} aria-label={index === 0 ? `น้ำหนักเกณฑ์ฝั่ง${label} (%)` : `น้ำหนักฝั่ง${label} เกณฑ์ ${index + 1}`} type="number" min={0} max={100} step="0.01" value={row.weightPct} onChange={(event) => edit(index, { weightPct: Number(event.target.value) })} className={`${CTRL} mt-1 text-sm`} />
            </label>
            <button type="button" aria-label={`ลบเกณฑ์ฝั่ง${label} ${index + 1}`} disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, i) => i !== index))} className={btn('ghost', 'sm', 'self-end')}>ลบ</button>
            <label className="text-xs text-ink-2 sm:col-span-3">คำถามประกอบเกณฑ์
              <input aria-label={`คำถามฝั่ง${label} เกณฑ์ ${index + 1}`} value={row.question ?? ''} onChange={(event) => edit(index, { question: event.target.value })} className={`${CTRL} mt-1 text-sm`} />
            </label>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setRows([...rows, { name: '', weightPct: 0 }])} className={btn('ghost', 'sm', 'mt-4')}>+ เพิ่มเกณฑ์ฝั่ง{label}</button>
    </fieldset>
  )
}
