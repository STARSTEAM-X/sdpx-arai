import { LogoMark } from './icons'
import { ApiStatusBadge } from './ApiStatusBadge'
import { FOCUS } from './Ui'

const LINKS = [
  { label: 'วิธีใช้งาน', href: '#how-it-works' },
  { label: 'เกี่ยวกับเรา', href: '#overview' },
  { label: 'ความเป็นส่วนตัว', href: '#security' },
]

export function SiteFooter() {
  return (
    <footer className="bg-cream">
      <div className="mx-auto w-[calc(100%-2.5rem)] max-w-300 py-6 sm:py-8">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <a href="/" aria-label="PairEval หน้าแรก" className={`inline-flex min-h-11 items-center gap-2.5 rounded-lg font-display text-2xl font-bold ${FOCUS}`}>
            <LogoMark className="size-10" />
            PairEval
          </a>
          <ul className="flex flex-wrap gap-x-5 text-sm text-muted">
            {LINKS.map(({ label, href }) => (
              <li key={label}><a href={href} className={`inline-flex min-h-11 items-center rounded-md hover:text-accent-ink ${FOCUS}`}>{label}</a></li>
            ))}
          </ul>
          <p className="text-xs text-muted sm:ml-auto">PairEval · ประเมินเพื่อให้ทีมเติบโต</p>
          <ApiStatusBadge />
        </div>
      </div>
    </footer>
  )
}
