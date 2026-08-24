/** ชุดไอคอนแบบ inline SVG — ตั้งใจไม่ใช้ library ไอคอนเพื่อไม่เพิ่ม dependency
 *  ทุกตัวเป็น stroke-based ใช้ currentColor จึงเปลี่ยนสีด้วย text-* ของ Tailwind ได้
 *  ตัวไหนเป็นแค่ของประดับ ให้ผู้เรียกใส่ aria-hidden ที่ตัวห่อ */

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
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="6" width="12" height="20" rx="2.5" fill="#f4703c" />
      <rect x="17" y="6" width="12" height="20" rx="2.5" fill="#1d2430" opacity="0.85" />
      <path d="M9 12h0M9 16h0M9 20h0" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function IconClassroom({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
      <path d="M6.5 11v5.2c0 1.6 2.5 2.8 5.5 2.8s5.5-1.2 5.5-2.8V11" />
      <path d="M21 9v5" />
    </svg>
  )
}

export function IconImport({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M12 11v6M9.5 14.5 12 17l2.5-2.5" />
    </svg>
  )
}

export function IconRubric({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 13.5 10 15l3-3.5" />
      <path d="M8.5 18h7" />
    </svg>
  )
}

export function IconCompare({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M4 8h11l-2.5-2.5M20 16H9l2.5 2.5" />
      <rect x="3" y="12.5" width="5" height="7" rx="1" />
      <rect x="16" y="4.5" width="5" height="7" rx="1" />
    </svg>
  )
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

export function IconRoster({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="8.5" cy="9" r="2.8" />
      <path d="M3 19c0-2.8 2.5-4.6 5.5-4.6S14 16.2 14 19" />
      <path d="M16 8h5M16 12h5M16 16h3" />
    </svg>
  )
}

export function IconWeights({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M7.5 9h3M7.5 13h3M7.5 17h3" />
      <path d="M14 9h3M14 13h3M14 17h3" />
    </svg>
  )
}

export function IconShuffle({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M4 7h3.5c1.4 0 2.2.8 3 2l3 4.5c.8 1.2 1.6 2 3 2H20" />
      <path d="M4 15.5h3.5c1.4 0 2.2-.8 3-2M16.5 8.5c.8-1.2 1.6-1.5 3-1.5H20" />
      <path d="M17.8 4.7 20.5 7l-2.7 2.3M17.8 13.2l2.7 2.3-2.7 2.3" />
    </svg>
  )
}

export function IconScale6({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M4 18V9M8.7 18v-6M13.3 18v-9M18 18v-4" />
      <path d="M3 20.5h18" />
    </svg>
  )
}

export function IconAutosave({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M7 18a4 4 0 0 1-.6-7.95 5.5 5.5 0 0 1 10.7-1.3A3.75 3.75 0 0 1 18 18Z" />
    </svg>
  )
}

export function IconTransparentScore({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M12 3a9 9 0 1 0 9 9h-9V3Z" />
      <path d="M14.5 2.6A9 9 0 0 1 21.4 9.5H14.5V2.6Z" />
    </svg>
  )
}

export function IconExport({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M3.5 9h17M9 9v11M15 9v11" />
    </svg>
  )
}

export function IconLock({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
      <path d="M12 14v2.5" />
    </svg>
  )
}

export function IconShield({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M12 3 5 5.8v5.4c0 4.2 2.9 7.8 7 9.8 4.1-2 7-5.6 7-9.8V5.8L12 3Z" />
      <path d="m9 12 2 2 4-4.2" />
    </svg>
  )
}

export function IconBadgeCheck({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="m12 3 2.2 1.7 2.8-.3 1 2.6 2.4 1.4-.9 2.6.9 2.6-2.4 1.4-1 2.6-2.8-.3L12 21l-2.2-1.7-2.8.3-1-2.6L3.6 15l.9-2.6-.9-2.6L6 8.4l1-2.6 2.8.3L12 3Z" />
      <path d="m9.3 12.2 1.9 1.9 3.6-3.9" />
    </svg>
  )
}

export function IconHistory({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5V9H8" />
      <path d="M12 7.8V12l2.8 1.7" />
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

export function IconImagePlaceholder({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8.75" cy="10" r="1.4" />
      <path d="m4.5 17 4.6-4.3 3.2 2.8 2.7-2.2 4.5 3.7" />
    </svg>
  )
}

export function IconUploadCloud({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M12 13v8" />
      <path d="m8 17 4-4 4 4" />
      <path d="M20.9 18.4A5 5 0 0 0 18 9.5h-1.3A8 8 0 1 0 4 16.7" />
    </svg>
  )
}

export function IconDownload({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
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

/** เมนูสามจุดแนวตั้ง — ตัวเดียวในชุดที่เป็น fill เพราะจุดทึบอ่านง่ายกว่าวงกลมเส้น */
export function IconDots({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
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

export function IconCircleDashed({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeDasharray="3 3">
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export function IconUserMinus({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 11h-6" />
    </svg>
  )
}

export function IconUserPlus({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  )
}

export function IconTeach({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M20 7h-9M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </svg>
  )
}

export function IconClipboardCheck({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  )
}

export function IconUsers({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="8.5" cy="8" r="3.2" />
      <path d="M2.8 19c0-3 2.5-5 5.7-5s5.7 2 5.7 5" />
      <circle cx="16.5" cy="8.5" r="2.6" />
      <path d="M15 11.3c2.6.3 4.2 2.1 4.2 4.4" />
    </svg>
  )
}

export function IconGlobe({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9s1.3-6.5 3.8-9Z" />
    </svg>
  )
}

export function IconBulb({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.45.95 1.15.95 1.9V17h5.1v-1.2c0-.75.35-1.45.95-1.9A6 6 0 0 0 12 3Z" />
    </svg>
  )
}

export function IconLogOut({ className }: IconProps) {
  return (
    <svg className={className} {...base}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
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

/** โลโก้ Google หลายสีสำหรับปุ่ม login — ตัวเดียวในชุดที่ไม่ใช้ currentColor */
export function IconGoogle({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.7-.06-1.37-.18-2.02H12v3.82h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.32Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.9a6 6 0 0 1 0-3.8V7.51H3.06a10 10 0 0 0 0 8.98l3.35-2.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2a10 10 0 0 0-8.94 5.51l3.35 2.6C7.2 7.74 9.4 5.98 12 5.98Z"
      />
    </svg>
  )
}
