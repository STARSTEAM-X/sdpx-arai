import {
  IconArrowRight,
  IconCheckCircle,
  IconClassroom,
  IconCompare,
  IconImport,
  IconRubric,
} from './icons'

const STEPS = [
  { Icon: IconClassroom, title: 'สร้างห้องเรียน', body: 'ตั้งค่าเทอมและรายวิชา' },
  { Icon: IconImport, title: 'นำเข้ารายชื่อ', body: 'จาก CSV หรือระบบเดิม' },
  { Icon: IconRubric, title: 'สร้างงานและเกณฑ์', body: 'กำหนดน้ำหนักและ deadline' },
  { Icon: IconCompare, title: 'ประเมินเป็นคู่', body: 'เปรียบเทียบ 2 ผลงาน' },
  { Icon: IconCheckCircle, title: 'ตรวจและยืนยันคะแนน', body: 'ตรวจสอบแล้วประกาศผล' },
]

export function ProcessFlow() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
      <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
        ครบทุกขั้นตอนในกระบวนการประเมิน
      </h2>

      {/* จอกว้าง: เรียงแถวเดียวมีลูกศรคั่น · จอแคบ: ห่อเป็นการ์ดหลายแถว ไม่มีลูกศร */}
      <ol className="mt-10 flex flex-col gap-3 sm:grid sm:grid-cols-2 lg:flex lg:flex-row lg:items-stretch lg:gap-0">
        {STEPS.map(({ Icon, title, body }, i) => (
          <li key={title} className="flex flex-1 items-stretch">
            <div className="flex w-full flex-col items-center rounded-xl border border-line bg-white px-3 py-6 text-center">
              <Icon className="size-8 text-brand-600" />
              <p className="mt-3 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
            </div>
            {i < STEPS.length - 1 && (
              <IconArrowRight className="hidden size-4 shrink-0 self-center text-muted lg:mx-2 lg:block" />
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
