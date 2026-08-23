import { Link } from 'react-router-dom'

import { ApiStatusBadge } from './ApiStatusBadge'
import { DashboardPreview } from './DashboardPreview'
import { IconArrowRight } from './icons'

export function Hero() {
  return (
    <section id="overview" className="border-b border-line bg-cream">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-20">
        <div>
          <ApiStatusBadge />

          {/* ขนาดตัวอักษรไล่ตามความกว้าง เพื่อให้หัวเรื่องลงได้ 2 บรรทัดตามที่ออกแบบไว้
              ไม่ใช่ 4 บรรทัดตอนจอกลาง */}
          <h1 className="mt-5 text-3xl leading-[1.3] font-bold tracking-tight text-balance sm:text-4xl lg:text-[2.1rem] xl:text-[2.6rem]">
            ประเมินผลงานอย่างยุติธรรม
            <br />
            ด้วยการเปรียบเทียบที่ง่ายกว่า
          </h1>

          <p className="mt-4 max-w-md leading-relaxed text-muted">
            จัดการห้องเรียน สร้างเกณฑ์ จัดคู่ประเมิน คำนวณคะแนน และตรวจสอบผลได้ในระบบเดียว
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              data-testid="main-cta"
              to="/classrooms"
              className="rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-700"
            >
              สร้างห้องเรียน
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-5 py-3 font-medium text-brand-700 transition-colors hover:bg-brand-50"
            >
              ดูวิธีการทำงาน
              <IconArrowRight className="size-4" />
            </a>
          </div>
        </div>

        <DashboardPreview />
      </div>
    </section>
  )
}
