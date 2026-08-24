import { Link } from 'react-router-dom'

import { isSignedIn } from '../lib/session'
import { LogoMark } from './icons'

const LINKS = [
  { href: '#overview', label: 'ภาพรวม' },
  { href: '#for-instructor', label: 'สำหรับอาจารย์' },
  { href: '#for-student', label: 'สำหรับนักศึกษา' },
  { href: '#security', label: 'ความปลอดภัย' },
]

export function SiteNav() {
  // อ่านครั้งเดียวตอน render พอ — หน้านี้เป็น landing ที่ไม่ได้เปลี่ยนสถานะ login ระหว่างใช้งาน
  // ยกเว้นตอนกดปุ่มใน CtaBand ซึ่งพาไป /classrooms ทันทีอยู่แล้ว
  const signedIn = isSignedIn()

  return (
    <header className="sticky top-0 z-50 border-b border-edge bg-white/92 shadow-[0_1px_2px_rgba(23,32,51,0.05)] backdrop-blur">
      <nav
        data-testid="main-nav"
        aria-label="เมนูหลัก"
        className="mx-auto flex h-16 max-w-300 items-center gap-6 px-6 max-sm:px-4"
      >
        <a href="/" className="flex min-h-11 shrink-0 items-center gap-2.5 font-display text-[19px] font-bold tracking-tight">
          <LogoMark className="size-8" />
          <span>PairEval</span>
        </a>

        {/* ซ่อนลิงก์บนจอแคบ เพราะปุ่มสองตัวขวามือสำคัญกว่า */}
        <ul className="hidden flex-1 items-center gap-7 text-sm text-muted lg:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="transition-colors hover:text-ink">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2.5 lg:ml-0">
          {signedIn ? (
            <Link
              to="/classrooms"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              ห้องเรียนของฉัน
            </Link>
          ) : (
            <>
              {/* พาไปยังแถบ CTA ท้ายหน้า ซึ่งเป็นที่เดียวที่มีปุ่มของ Google จริง
                  ไม่ทำปุ่ม login ซ้ำสองที่ เพราะ Google render ปุ่มเองและคุมสไตล์ไม่ได้ */}
              <a
                href="#login"
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream"
              >
                เข้าสู่ระบบ
              </a>
              <Link
                to="/classrooms"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                เริ่มต้นใช้งาน
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
