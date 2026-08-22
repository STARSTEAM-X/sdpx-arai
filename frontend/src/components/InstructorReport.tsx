import type { ReactNode } from 'react'

/* แผงรายงานฝั่งอาจารย์ — ตัวเลขทั้งหมดเป็นข้อมูลตัวอย่างสำหรับแสดงหน้าตาระบบ */

/** ความสูงของแท่ง histogram เป็นสัดส่วน 0–1 กระจายแบบระฆังคว่ำรอบค่าเฉลี่ย */
const HISTOGRAM = [0.08, 0.16, 0.3, 0.52, 0.78, 1, 0.86, 0.55, 0.28, 0.12]

const INDIVIDUAL = [
  { label: 'สูงสุด', value: '94.2' },
  { label: 'ต่ำสุด', value: '41.3' },
  { label: 'ส่วนเบี่ยงเบนมาตรฐาน', value: '12.7' },
]

const FLAGS = [
  { dot: 'bg-ok-500', label: 'ดี', value: '92%' },
  { dot: 'bg-brand-500', label: 'ควรปรับปรุง', value: '6%' },
  { dot: 'bg-[#d94b4b]', label: 'มีปัญหา', value: '2%' },
]

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line p-3.5">
      <p className="text-xs font-semibold">{title}</p>
      {children}
    </div>
  )
}

export function InstructorReport() {
  return (
    <div className="rounded-xl border border-line bg-white p-6">
      <h3 className="text-center text-lg font-semibold">รายงานสำหรับอาจารย์</h3>
      <p className="mt-1 text-center text-xs text-muted">ตรวจสอบคุณภาพและสรุปผลการประเมิน</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Panel title="Group Summary">
          <p className="mt-2 text-3xl font-bold">78.6</p>
          <p className="text-[10px] text-muted">คะแนนเฉลี่ย (จาก 100)</p>
          <div className="mt-3 flex h-16 items-end gap-1" role="img" aria-label="การกระจายคะแนนกลุ่ม">
            {HISTOGRAM.map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-sm bg-ok-500"
                style={{ height: `${h * 100}%` }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-muted">
            {['0', '20', '40', '60', '80', '100'].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </Panel>

        <Panel title="Individual Summary">
          <p className="mt-1 text-[10px] text-muted">คะแนนเฉลี่ยรายบุคคล</p>
          <dl className="mt-3 space-y-2.5">
            {INDIVIDUAL.map(({ label, value }) => (
              <div key={label} className="flex items-baseline justify-between border-b border-line pb-1.5">
                <dt className="text-[11px] text-muted">{label}</dt>
                <dd className="text-sm font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title="Pair Coverage">
          <p className="mt-1 text-[10px] text-muted">การกระจายคู่ประเมิน</p>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-muted">ครบถ้วน</span>
            <span className="font-semibold text-ok-600">98%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full w-[98%] rounded-full bg-ok-500" />
          </div>
          <div className="mt-3 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted">จำนวนคู่ทั้งหมด</span>
              <span className="font-medium">1,842</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">คู่ที่สมบูรณ์</span>
              <span className="font-medium">1,805</span>
            </div>
          </div>
        </Panel>

        <Panel title="Quality Flags">
          <p className="mt-1 text-[10px] text-muted">ความสอดคล้องของคำตอบ</p>
          <ul className="mt-3 space-y-2 text-[11px]">
            {FLAGS.map(({ dot, label, value }) => (
              <li key={label} className="flex items-center gap-2">
                <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
                <span className="flex-1 text-muted">{label}</span>
                <span className="font-medium">{value}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-md border border-line py-1.5 text-center text-[11px] text-muted">
            ดูคู่ที่มีปัญหา
          </p>
        </Panel>
      </div>
    </div>
  )
}
