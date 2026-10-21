/** ชุดไอคอนแบบ inline SVG — ตั้งใจไม่ใช้ library ไอคอนเพื่อไม่เพิ่ม dependency
 *  ทุกตัวเป็น stroke-based ใช้ currentColor จึงเปลี่ยนสีด้วย text-* ของ Tailwind ได้
 *  ตัวไหนเป็นแค่ของประดับ ให้ผู้เรียกใส่ aria-hidden ที่ตัวห่อ */

import logoMark from '../assets/figma/logo-mark.svg'
import notificationIcon from '../assets/figma/notification.png'

type IconProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function LogoMark({ className }: IconProps) {
  return (
    <img src={logoMark} className={className} width={44} height={44} alt="" aria-hidden="true" />
  )
}

export function IconBell({ className }: IconProps) {
  return <img src={notificationIcon} className={className} width={24} height={24} alt="" aria-hidden="true" />
}

export function IconCheckCircle({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </svg>
  )
}

export function IconInstructor({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M2.5 8.5 12 4.5l9.5 4-9.5 4-9.5-4Z" />
      <path d="M7 10.8V15c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.2" />
      <path d="M21.5 8.5v5.5" />
    </svg>
  )
}

export function IconStudent({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </svg>
  )
}

export function IconTa({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3 19.5c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6" />
      <path d="M17.5 14.8c2.1.6 3.5 2.3 3.5 4.7" />
    </svg>
  )
}

export function IconArrowRight({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M4.5 12h14M13 6.5l5.5 5.5L13 17.5" />
    </svg>
  )
}

export function IconFile({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function IconClose({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function IconChevronLeft({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

export function IconClock({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function IconAlert({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0" />
      <path d="M12 9v4M12 17v.01" />
    </svg>
  )
}

export function IconInfo({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5M12 8v.01" />
    </svg>
  )
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg className={className} {...base} strokeWidth={2.4}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}

export function IconChevronDown({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/** ปุ่มออกจากระบบใน Navbar ตาม Figma — ประตูทึบสีส้มพร้อมลูกศรออก */
export function IconDoorExit({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 3.5A1.5 1.5 0 0 1 5.5 2h8A1.5 1.5 0 0 1 15 3.5V9h-2V4H6v16h7v-5h2v5.5a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 4 20.5z" />
      <circle cx="11" cy="12" r="1.1" fill="white" />
      <path fill="currentColor" d="M17.6 8.4 21.2 12l-3.6 3.6-1.4-1.4 1.2-1.2H11v-2h6.4l-1.2-1.2z" />
    </svg>
  )
}
