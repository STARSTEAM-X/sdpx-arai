import { LogoMark } from './icons'

const COLUMNS = [
  {
    title: 'ผลิตภัณฑ์',
    links: ['ภาพรวม', 'สำหรับอาจารย์', 'สำหรับนักศึกษา', 'ฟีเจอร์ทั้งหมด'],
  },
  {
    title: 'ช่วยเหลือ',
    links: ['ศูนย์ช่วยเหลือ', 'คู่มือการใช้งาน', 'คำถามที่พบบ่อย', 'ติดต่อเรา'],
  },
  {
    title: 'ความเป็นส่วนตัว',
    links: ['นโยบายความเป็นส่วนตัว', 'เงื่อนไขการให้บริการ', 'ความปลอดภัย'],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <LogoMark className="size-6" />
              PairEval
            </div>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-muted">
              ระบบประเมินผลงานนักศึกษาแบบเปรียบเทียบทีละคู่
              ช่วยให้อาจารย์ตัดสินคะแนนได้อย่างยุติธรรม
            </p>
          </div>

          {COLUMNS.map(({ title, links }) => (
            <div key={title}>
              <p className="text-sm font-semibold">{title}</p>
              <ul className="mt-3 space-y-2 text-xs text-muted">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#overview" className="transition-colors hover:text-ink">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 border-t border-line pt-6 text-center text-xs text-muted">
          © {new Date().getFullYear()} PairEval · SDPX-AI · WS-01 First Deploy
        </p>
      </div>
    </footer>
  )
}
