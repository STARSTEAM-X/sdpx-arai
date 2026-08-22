import { IconInstructor, IconStudent, IconTa } from './icons'

const PERSONAS = [
  {
    id: 'for-instructor',
    Icon: IconInstructor,
    title: 'อาจารย์',
    body: 'จัดการและติดตามการประเมินได้อย่างมีประสิทธิภาพ',
    featured: true,
  },
  {
    id: 'for-student',
    Icon: IconStudent,
    title: 'นักศึกษา',
    body: 'ประเมินอย่างเป็นธรรม และเข้าใจกระบวนการ',
    featured: false,
  },
  {
    id: 'for-ta',
    Icon: IconTa,
    title: 'TA',
    body: 'ช่วยสนับสนุนการประเมินและคุณภาพผลลัพธ์',
    featured: false,
  },
]

export function PersonaCards() {
  return (
    <section className="mx-auto -mt-8 max-w-4xl px-4">
      <ul className="grid gap-3 sm:grid-cols-3">
        {PERSONAS.map(({ id, Icon, title, body, featured }) => (
          <li
            key={id}
            id={id}
            className={`scroll-mt-24 rounded-xl border p-5 ${
              featured ? 'border-brand-200 bg-brand-50' : 'border-line bg-white'
            }`}
          >
            <div
              className={`flex items-center gap-2 font-semibold ${
                featured ? 'text-brand-700' : 'text-ink'
              }`}
            >
              <Icon className="size-5" />
              {title}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
