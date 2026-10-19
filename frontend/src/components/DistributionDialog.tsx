import type { CriterionAgreement } from '../lib/api'
import { btn } from './Ui'
import { useModal } from './useModal'

// Figma J28c — A = กลุ่มฝั่งซ้าย, B = ฝั่งขวา ตามลำดับมาตรวัด 6 ระดับ (lib/scale.ts)
const BAR_LABELS = ['A ดีกว่ามาก', 'A ดีกว่า', 'A ดีกว่าเล็กน้อย', 'B ดีกว่าเล็กน้อย', 'B ดีกว่า', 'B ดีกว่ามาก']

/** Figma J28c · การกระจายคำตอบต่อเกณฑ์ — เกณฑ์ที่ติด QS-07 มีกรอบสีส้มและคำอธิบายด้านล่าง */
export function DistributionDialog({
  assignmentName,
  criteria,
  onClose,
}: {
  assignmentName: string
  criteria: CriterionAgreement[]
  onClose: () => void
}) {
  const ref = useModal()
  const flagged = criteria.filter((criterion) => criterion.flags.includes('QS-07'))
  const answers = Math.max(0, ...criteria.map((criterion) => criterion.answerCount))
  const instructors = Math.max(0, ...criteria.map((criterion) => criterion.instructorAnswers))
  return (
    <dialog
      ref={ref}
      aria-labelledby="distribution-title"
      data-testid="distribution-dialog"
      onClose={onClose}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-132 overflow-auto rounded-3xl bg-white p-5 text-ink shadow-xl backdrop:bg-ink/40"
    >
      <h2 id="distribution-title" className="font-display text-[22px] font-bold">
        การกระจายคำตอบต่อเกณฑ์
      </h2>
      <p className="mt-1.5 text-[13px] leading-5 text-ink-2">
        {assignmentName} · ทุกคู่รวมกัน · เกณฑ์ละสูงสุด {answers} คำตอบ
        {instructors ? ` (รวมอาจารย์ ${instructors})` : ''} · A = กลุ่มฝั่งซ้าย, B = ฝั่งขวา · แสดงเฉพาะค่าปัจจุบัน
        ไม่มีกราฟย้อนหลัง
      </p>
      <div className="mt-4 space-y-3">
        {criteria.map((criterion) => {
          const low = criterion.flags.includes('QS-07')
          const peak = Math.max(1, ...criterion.distribution)
          return (
            <section
              key={criterion.criterionId}
              aria-label={criterion.name}
              className={`rounded-2xl border p-3.5 ${low ? 'border-brand-600' : 'border-edge'}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-[14.5px] font-semibold">
                  {criterion.name} ({Number(criterion.weightPct)}%)
                </h3>
                <p
                  className={`text-[12px] ${low ? 'font-semibold text-accent-ink' : 'text-muted'}`}
                  title="Kendall's u — ค่าความสอดคล้องสำหรับข้อมูลเปรียบเทียบเป็นคู่"
                >
                  {criterion.agreement === null
                    ? 'ยังมีคู่ที่ประเมินซ้ำไม่พอคำนวณความสอดคล้อง'
                    : `u = ${criterion.agreement.toFixed(2)}${low ? ' · เห็นไม่ตรงกัน (QS-07)' : criterion.agreement >= 0.5 ? ' · เห็นตรงกัน' : ''}`}
                </p>
              </div>
              <ol
                className="mt-2 grid grid-cols-6 items-end gap-2"
                aria-label={`จำนวนคำตอบแต่ละระดับของ ${criterion.name}`}
              >
                {criterion.distribution.map((count, index) => (
                  <li key={index} className="flex flex-col items-center text-center">
                    <span className="text-[11.5px] text-ink-2">{count}</span>
                    <span
                      aria-hidden="true"
                      className={`mt-1 w-full rounded-md ${index < 3 ? 'bg-brand-500' : 'bg-info-ink/80'}`}
                      style={{ height: `${Math.max(3, (count / peak) * 64)}px` }}
                    />
                    <span className="mt-1.5 text-[10.5px] leading-tight text-muted">
                      {BAR_LABELS[index]}
                      <span className="sr-only"> {count} คำตอบ</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )
        })}
      </div>
      {flagged.length > 0 && (
        <div className="mt-4 rounded-2xl bg-info-soft px-4 py-3 text-[12.5px] text-info-ink">
          <p className="font-semibold">
            {flagged.map((criterion) => criterion.name).join(', ')} กระจายเท่า ๆ กันทุกระดับ
            แปลว่าผู้ประเมินตีความเกณฑ์ต่างกัน
          </p>
          <p className="mt-0.5">แก้คำอธิบายเกณฑ์ไม่ได้หลังเผยแพร่ · คัดลอกงานนี้ไปใช้ครั้งถัดไปแล้วปรับคำอธิบายได้</p>
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={() => ref.current?.close()} className={btn('ghost', 'md', 'px-6')}>
          ปิด
        </button>
      </div>
    </dialog>
  )
}
