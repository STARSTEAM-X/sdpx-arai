import type { ReactNode } from 'react'
import forbiddenArt from '../assets/figma/forbidden.png'
import { Link } from 'react-router-dom'

import { FOCUS } from './Ui'

/** หัวหน้าแบบ "Orange illustrated hero" ที่ Figma ใช้ซ้ำทุกหน้าหลังเข้าสู่ระบบ
 *  กล่อง 1160×148 มุมโค้ง 24 พื้นไล่ส้ม ภาพประกอบล้นขอบบนทางขวา */
export function OrangeHero({
  title,
  subtitle,
  image,
  imageClassName = 'h-52 w-72 -top-9 right-2',
  className = '',
  headingLevel = 1,
  textWidth = 'max-w-[64%]',
  titleSize = 'text-[40px]',
}: {
  title: ReactNode
  subtitle?: ReactNode
  image?: string
  imageClassName?: string
  className?: string
  headingLevel?: 1 | 2
  /** หน้าคู่มือมีหัวยาวจึงต้องกว้างกว่าหน้าอื่น */
  textWidth?: string
  titleSize?: string
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <div
      className={`relative isolate flex min-h-37 items-center rounded-3xl bg-[linear-gradient(110deg,#ff7d3d_0%,#ffb558_100%)] px-12.5 py-6 max-sm:min-h-28 max-sm:px-5 ${className}`}
    >
      <div className={`relative z-10 ${textWidth}`}>
        <Heading className={`font-display leading-tight font-bold text-white max-sm:text-[22px] ${titleSize}`}>
          {title}
        </Heading>
        {subtitle && <div className="mt-1.5 text-[15px] leading-6 text-white max-sm:text-[13px]">{subtitle}</div>}
      </div>
      {image && (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className={`pointer-events-none absolute -z-10 object-contain max-sm:top-auto max-sm:right-1 max-sm:bottom-0 max-sm:h-24 max-sm:w-28 ${imageClassName}`}
        />
      )}
    </div>
  )
}

/** ลูกศรย้อนกลับสีส้มขนาดใหญ่ที่อยู่นอกกรอบเนื้อหาทางซ้าย (Figma Icon/ChevronLeft 70×84) */
export function BackChevron({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={`grid size-14 shrink-0 place-items-center rounded-2xl text-brand-600 hover:bg-accent-soft xl:absolute xl:top-1/2 xl:-left-25 xl:h-21 xl:w-17.5 xl:-translate-y-1/2 ${FOCUS}`}
    >
      <svg viewBox="0 0 24 28" className="h-9 w-8 xl:h-15 xl:w-12" aria-hidden="true">
        <path
          d="M17 3 6 14l11 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  )
}

/** การ์ดหัว+เนื้อหาตาม Figma: หัว 24px padding เส้นคั่นบาง เนื้อหาแยกด้านล่าง */
export function SectionCard({
  title,
  hint,
  children,
  id,
  className = '',
  bodyClassName = 'px-6 py-4.5',
  action,
}: {
  title: ReactNode
  hint?: ReactNode
  children?: ReactNode
  id?: string
  className?: string
  bodyClassName?: string
  action?: ReactNode
}) {
  return (
    <section id={id} className={`scroll-mt-24 overflow-hidden rounded-3xl border border-edge bg-white ${className}`}>
      <div className={`flex items-center gap-4 px-6 py-4.5 ${children ? 'border-b border-edge' : ''}`}>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[20px] leading-[30px] font-semibold">{title}</h2>
          {hint && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children && <div className={bodyClassName}>{children}</div>}
    </section>
  )
}

/** รายการจุดสีส้มที่ Figma ใช้ในการ์ดคำอธิบาย */
export function BulletList({ items, className = '' }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={`space-y-2.5 text-[15px] leading-6 text-ink ${className}`}>
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5">
          <span aria-hidden="true" className="text-brand-600">
            •
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** Figma C14 / T09 — หน้าที่บทบาทนี้เข้าไม่ได้ (server ตอบ 403) แสดงเป็นหน้าเต็มแทนแถบ error */
export function ForbiddenState({ body, action, to }: { body: ReactNode; action: string; to: string }) {
  return (
    <section role="alert" className="mx-auto flex max-w-190 flex-col items-center py-16 text-center">
      <img src={forbiddenArt} alt="" width={256} height={192} className="h-48 w-64 object-contain" />
      <span className="mt-5 rounded-full bg-caution-soft px-3.5 py-1.5 font-display text-[13px] font-semibold text-warn">
        สิทธิ์การใช้งาน
      </span>
      <h1 className="mt-4 font-display text-[30px] font-bold max-sm:text-2xl">บทบาทของคุณเข้าถึงส่วนนี้ไม่ได้</h1>
      <p className="mt-4 max-w-160 text-[15px] leading-7 text-ink-2">{body}</p>
      <Link
        to={to}
        className={`mt-5 inline-flex min-h-12 items-center rounded-full bg-cta px-7 font-display text-[15px] font-semibold text-white hover:bg-cta-hover ${FOCUS}`}
      >
        {action}
      </Link>
    </section>
  )
}

/** Figma C14 / T09 — ข้อความตามบทบาทเมื่อ server ตอบ 403 */
export function forbiddenCopy(role: string | null, classroomId: string): { body: string; action: string; to: string } {
  if (role === 'TA')
    return {
      body: 'คุณเป็นผู้ช่วยสอนในห้องเรียนนี้ ซึ่งเข้าถึงได้เฉพาะรายชื่อนักศึกษา · ถ้าคิดว่าควรเข้าได้ ติดต่อเจ้าของห้องเรียนเพื่อเปลี่ยนบทบาท',
      action: 'ไปหน้ารายชื่อ',
      to: `/classrooms/${classroomId}#members`,
    }
  if (role === 'CO_TEACHER')
    return {
      body: 'คุณเป็นผู้สอนร่วม ดูรายงานและส่งออกด้วยรหัสแฝงได้ แต่ส่วนนี้เป็นสิทธิ์ของเจ้าของห้องเท่านั้น',
      action: 'กลับหน้าห้องเรียน',
      to: `/classrooms/${classroomId}`,
    }
  return {
    body: 'บทบาทของคุณในห้องนี้ไม่มีสิทธิ์เปิดส่วนนี้ · ถ้าคิดว่าควรเข้าได้ ติดต่อเจ้าของห้องเรียน',
    action: 'กลับหน้าห้องเรียน',
    to: `/classrooms/${classroomId}`,
  }
}
