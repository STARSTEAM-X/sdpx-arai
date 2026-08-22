import { IconBadgeCheck, IconHistory, IconShield } from './icons'

const ITEMS = [
  {
    Icon: IconShield,
    title: 'ข้อมูลผู้ประเมินเป็นความลับ',
    body: 'ไม่แสดงชื่อผู้ประเมินต่อเจ้าของผลงาน และเปิดเผยเฉพาะเมื่อถึงเกณฑ์ขั้นต่ำ',
  },
  {
    Icon: IconBadgeCheck,
    title: 'อาจารย์ยืนยันคะแนนสุดท้าย',
    body: 'อาจารย์ตรวจสอบ แก้ไข และยืนยันคะแนนก่อนประกาศผล',
  },
  {
    Icon: IconHistory,
    title: 'มีประวัติการเปลี่ยนแปลง',
    body: 'บันทึกทุกการแก้ไขอย่างละเอียด ตรวจสอบย้อนหลังได้',
  },
]

export function TrustRow() {
  return (
    <section id="security" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16">
      <ul className="grid gap-3 rounded-xl border border-line bg-cream p-6 sm:grid-cols-3">
        {ITEMS.map(({ Icon, title, body }) => (
          <li key={title} className="flex gap-3">
            <Icon className="size-6 shrink-0 text-ok-500" />
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
