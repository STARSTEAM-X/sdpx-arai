import { IconGoogle } from './icons'

/** ภาพประกอบหน้าต่างเล็ก ๆ ด้านซ้ายของแถบ CTA — ตกแต่งล้วน ไม่มีความหมายต่อ screen reader */
function WindowIllustration() {
  return (
    <div className="w-56 shrink-0 rounded-lg bg-white/95 p-3" aria-hidden="true">
      <div className="flex gap-1">
        {['bg-brand-200', 'bg-brand-200', 'bg-brand-200'].map((c, i) => (
          <span key={i} className={`size-1.5 rounded-full ${c}`} />
        ))}
      </div>
      <div className="mt-3 flex items-end gap-1.5">
        <span className="h-6 w-3 rounded-sm bg-brand-200" />
        <span className="h-10 w-3 rounded-sm bg-brand-500" />
        <span className="h-8 w-3 rounded-sm bg-brand-200" />
        <span className="h-12 w-3 rounded-sm bg-brand-500" />
        <span className="ml-auto grid size-8 place-items-center rounded-full bg-ok-50">
          <svg viewBox="0 0 24 24" className="size-4 text-ok-500" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        <span className="block h-1.5 w-full rounded-full bg-brand-100" />
        <span className="block h-1.5 w-2/3 rounded-full bg-brand-100" />
      </div>
    </div>
  )
}

export function CtaBand() {
  return (
    <section id="login" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16">
      <div className="flex flex-col items-center gap-8 rounded-xl bg-brand-600 px-6 py-10 text-center sm:px-10 lg:flex-row lg:text-left">
        <WindowIllustration />

        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            เริ่มต้นสร้างการประเมินที่โปร่งใสกว่าเดิม
          </h2>
          <p className="mt-2 text-sm text-brand-100">
            จัดการห้องเรียน ประเมินผลงาน และสรุปผลได้ในระบบเดียว
          </p>

          <a
            href="#login"
            className="mt-6 inline-flex items-center gap-2.5 rounded-lg bg-white px-5 py-3 font-medium text-ink transition-colors hover:bg-cream"
          >
            <IconGoogle className="size-5" />
            เข้าสู่ระบบด้วย Google
          </a>
        </div>
      </div>
    </section>
  )
}
