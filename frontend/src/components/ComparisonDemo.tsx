import { COMPARISON_SCALE } from '../lib/scale'
import { IconImagePlaceholder } from './icons'

function WorkCard({ label, tone }: { label: string; tone: 'brand' | 'ok' }) {
  const styles =
    tone === 'brand' ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-ok-50 bg-ok-50 text-ok-600'

  return (
    <div className={`flex-1 rounded-lg border p-4 text-center ${styles}`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-[11px] opacity-80">ดูผลงาน (ลิงก์)</p>
      <IconImagePlaceholder className="mx-auto mt-3 size-7 opacity-70" />
    </div>
  )
}

export function ComparisonDemo() {
  return (
    <div
      data-testid="feature-placeholder"
      className="rounded-xl border border-line bg-white p-6"
    >
      <h3 className="text-center text-lg font-semibold">ประเมินผลงานแบบเปรียบเทียบ 6 ระดับ</h3>
      <p className="mt-1 text-center text-xs text-muted">เลือกผลงานที่ดีกว่าเพียงชิ้นเดียว</p>

      <div className="mt-5 flex items-center gap-3">
        <WorkCard label="ผลงาน A" tone="brand" />
        <span className="text-xs font-semibold text-muted">VS</span>
        <WorkCard label="ผลงาน B" tone="ok" />
      </div>

      <ul className="mt-5 space-y-2.5">
        {COMPARISON_SCALE.map((choice) => (
          <li key={choice.id} className="flex items-center gap-2.5 text-sm text-ink">
            <span className="size-4 shrink-0 rounded-full border-2 border-line" aria-hidden="true" />
            {choice.label}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex gap-2.5">
        <span className="flex-1 rounded-lg border border-line px-4 py-2.5 text-center text-sm text-muted">
          ข้ามคู่นี้
        </span>
        <span className="flex-[1.6] rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white">
          บันทึกคำตอบและไปต่อ
        </span>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted">
        ตัวอย่างหน้าจอ — ยังไม่เปิดใช้งาน จะพัฒนาจริงตั้งแต่ WS-03
      </p>
    </div>
  )
}
