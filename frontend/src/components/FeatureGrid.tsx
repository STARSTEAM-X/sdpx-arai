import {
  IconAutosave,
  IconExport,
  IconLock,
  IconRoster,
  IconScale6,
  IconShuffle,
  IconTransparentScore,
  IconWeights,
} from './icons'

const FEATURES = [
  { Icon: IconRoster, title: 'ห้องเรียนและรายชื่อ', body: 'CSV และการจัดกลุ่ม' },
  { Icon: IconWeights, title: 'งานและเกณฑ์ประเมิน', body: 'น้ำหนักและ deadline' },
  { Icon: IconShuffle, title: 'ระบบจัดคู่อัตโนมัติ', body: 'สมดุลและไม่เจอตัวเอง' },
  { Icon: IconScale6, title: 'ประเมินกลุ่มและรายบุคคล', body: '6 ระดับ ไม่มีตัวเลือกกลาง' },
  { Icon: IconAutosave, title: 'Autosave และความคืบหน้า', body: 'ทำต่อได้ทุกอุปกรณ์' },
  { Icon: IconTransparentScore, title: 'คำนวณคะแนนโปร่งใส', body: 'ตรวจสอบและแก้ไขได้' },
  { Icon: IconExport, title: 'รายงานและ Export', body: 'CSV และ Excel' },
  { Icon: IconLock, title: 'ความเป็นส่วนตัวและ Audit', body: 'ไม่เปิดเผยผู้ประเมิน' },
]

export function FeatureGrid() {
  return (
    <section className="border-y border-line bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          ฟีเจอร์ที่ออกแบบมาเพื่อการประเมินที่ดีกว่า
        </h2>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ Icon, title, body }) => (
            <li key={title} className="rounded-xl border border-line bg-white p-5">
              <Icon className="size-7 text-brand-600" />
              <p className="mt-3 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
