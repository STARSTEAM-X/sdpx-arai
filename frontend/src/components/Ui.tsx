import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { IconAlert, IconCheck, IconCheckCircle, IconClock } from './icons'
import type { RosterEntry } from '../lib/api'

/** ชิ้นส่วนหน้าตาที่ใช้ร่วมกันทั้งหน้าจัดการห้องเรียน
 *
 *  รวมไว้ไฟล์เดียวเพราะทุกตัวเป็น presentational ล้วน ไม่มี state ไม่ยิง API
 *  และถูกใช้จากทั้ง 4 กล่องบนหน้าเดียวกัน การแยกเป็นไฟล์ละ 10 บรรทัดจะทำให้
 *  ต้องเปิด 6 ไฟล์เพื่อตอบคำถามว่า "ป้ายสถานะหน้าตายังไง"
 */

/** วงแหวน focus ที่มองเห็นชัด — ต้องเหมือนกันทุกปุ่มทุกช่อง ไม่งั้นคนใช้คีย์บอร์ดจะหลงว่าอยู่ตรงไหน */
export const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

/** ปุ่มสูง 44px ทุกตัวตามเกณฑ์ touch target ของ WCAG (2.5.8) ไม่ใช่เพื่อความสวย
 *
 *  ประกอบเป็นฟังก์ชันแทนที่จะเป็นสตริงให้ต่อกันเอง เพราะ Tailwind ตัดสินว่า class ไหนชนะ
 *  จากลำดับใน stylesheet ไม่ใช่ลำดับที่เขียน — `${BTN.ghost} ${BTN.sm}` จึงได้ padding
 *  ตัวไหนก็ได้แล้วแต่ดวง ฟังก์ชันนี้เลือกให้ตั้งแต่ต้นว่าจะใส่ตัวไหนลงไป */
const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-display font-semibold ' +
  `transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS}`

const BTN_SIZE = {
  md: 'min-h-11 px-5 text-[14.5px]',
  /** เตี้ยลงไม่ได้ ต้องแตะได้เท่ากัน — เล็กลงด้วยตัวอักษรและ padding แทน */
  sm: 'min-h-11 px-3.5 text-[13.5px]',
}

const BTN_VARIANT = {
  primary: 'bg-cta text-white enabled:hover:bg-cta-hover',
  ghost: 'border border-edge-strong bg-white enabled:hover:border-muted enabled:hover:bg-sand',
  ok: 'bg-ok-700 text-white enabled:hover:bg-ok-600',
}

export function btn(
  variant: keyof typeof BTN_VARIANT,
  size: keyof typeof BTN_SIZE = 'md',
  extra = '',
): string {
  return `${BTN_BASE} ${BTN_SIZE[size]} ${BTN_VARIANT[variant]} ${extra}`
}

/** ช่องกรอกสูง 44px พร้อมสถานะ hover / focus / disabled / invalid ครบในที่เดียว */
export const CTRL =
  'min-h-11 w-full rounded-xl border border-edge-strong bg-white px-3.5 py-2.5 outline-none ' +
  'transition-colors enabled:hover:border-muted ' +
  'focus:border-brand-600 focus:ring-3 focus:ring-accent-soft ' +
  'disabled:cursor-not-allowed disabled:bg-sand disabled:text-muted ' +
  'aria-[invalid=true]:border-err aria-[invalid=true]:ring-3 aria-[invalid=true]:ring-err-soft'

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} animate-spin rounded-full border-2 border-current border-t-transparent`}
    />
  )
}

const CARD_SHADOW =
  'rounded-2xl border border-edge bg-white shadow-[0_1px_2px_rgba(23,32,51,0.04),0_10px_28px_-22px_rgba(23,32,51,0.35)]'

export function Card({ className = '', children, ...rest }: ComponentPropsWithoutRef<'section'>) {
  return (
    <section {...rest} className={`${CARD_SHADOW} ${className}`}>
      {children}
    </section>
  )
}

export function CardHead({
  icon,
  title,
  hint,
  id,
  badge,
}: {
  icon: ReactNode
  title: string
  hint: ReactNode
  id: string
  badge?: ReactNode
}) {
  return (
    <div className="flex items-start gap-3 border-b border-edge px-6 py-5 max-sm:px-4">
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-xl border border-edge bg-sand text-ink-2"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h2
          id={id}
          className="flex flex-wrap items-center gap-2 font-display text-[17px] font-semibold"
        >
          {title}
          {badge}
        </h2>
        <p className="mt-0.5 text-[13.5px] text-muted">{hint}</p>
      </div>
    </div>
  )
}

type Tone = 'neutral' | 'ok' | 'warn' | 'err' | 'brand'

const PILL_TONE: Record<Tone, string> = {
  neutral: 'border-edge bg-sand text-ink-2',
  ok: 'border-ok-line bg-ok-50 text-ok-700',
  warn: 'border-warn-line bg-warn-soft text-warn',
  err: 'border-err-line bg-err-soft text-err',
  brand: 'border-accent-line bg-accent-soft text-accent-ink',
}

export function Pill({
  tone = 'neutral',
  icon,
  className = '',
  children,
  ...rest
}: { tone?: Tone; icon?: ReactNode } & ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      {...rest}
      className={
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 ' +
        `font-display text-[12.5px] font-semibold ${PILL_TONE[tone]} ${className}`
      }
    >
      {icon}
      {children}
    </span>
  )
}

export const ROLE_LABEL: Record<RosterEntry['role'], string> = {
  OWNER: 'เจ้าของห้อง',
  CO_TEACHER: 'ผู้สอนร่วม',
  TA: 'ผู้ช่วยสอน',
  STUDENT: 'นักศึกษา',
}

export const STATUS_LABEL: Record<RosterEntry['status'], string> = {
  PENDING: 'ยังไม่เคยเข้าระบบ',
  ACTIVE: 'ใช้งานอยู่',
  DISABLED: 'ถูกระงับ',
}

export function RolePill({ role }: { role: RosterEntry['role'] }) {
  return <Pill tone={role === 'OWNER' ? 'brand' : 'neutral'}>{ROLE_LABEL[role]}</Pill>
}

/** สถานะสมาชิก — มีไอคอนกำกับเสมอ เพราะสีอย่างเดียวสื่อไม่ได้กับคนตาบอดสี (WCAG 1.4.1) */
export function StatusPill({ status }: { status: RosterEntry['status'] }) {
  if (status === 'ACTIVE') {
    return (
      <Pill tone="ok" icon={<IconCheck className="size-3" />}>
        {STATUS_LABEL.ACTIVE}
      </Pill>
    )
  }
  if (status === 'DISABLED') {
    return (
      <Pill tone="err" icon={<IconAlert className="size-3" />}>
        {STATUS_LABEL.DISABLED}
      </Pill>
    )
  }
  return (
    <Pill tone="warn" icon={<IconClock className="size-3" />}>
      {STATUS_LABEL.PENDING}
    </Pill>
  )
}

const BANNER_TONE = {
  ok: { box: 'border-ok-line bg-ok-50 text-ok-700', Icon: IconCheckCircle },
  warn: { box: 'border-warn-line bg-warn-soft text-warn', Icon: IconAlert },
  err: { box: 'border-err-line bg-err-soft text-err', Icon: IconAlert },
}

export function Banner({
  tone,
  className = '',
  children,
  ...rest
}: { tone: keyof typeof BANNER_TONE } & ComponentPropsWithoutRef<'div'>) {
  const { box, Icon } = BANNER_TONE[tone]
  return (
    <div
      {...rest}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm ${box} ${className}`}
    >
      <Icon className="mt-0.5 size-[18px] shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** ข้อความผิดพลาดใต้ช่องกรอก — มีไอคอนเพราะสีแดงอย่างเดียวไม่พอ */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-[12.5px] font-semibold text-err">
      <IconAlert className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** อักษรย่อแทนรูปโปรไฟล์ — ระบบไม่เก็บรูปผู้ใช้ การใส่ placeholder เทา ๆ จะกินที่เปล่า ๆ */
export function Avatar({ name, muted = false }: { name: string; muted?: boolean }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <span
      aria-hidden="true"
      className={
        'grid size-10 shrink-0 place-items-center rounded-full border font-display text-[13px] font-semibold ' +
        (muted ? 'border-edge bg-sand text-ink-2' : 'border-accent-line bg-accent-soft text-accent-ink')
      }
    >
      {initials}
    </span>
  )
}
