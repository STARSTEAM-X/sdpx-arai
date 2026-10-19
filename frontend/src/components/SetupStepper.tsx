import { IconCheck } from './icons'

export type StepState = 'done' | 'current' | 'todo'

const STATE_LABEL: Record<StepState, string> = {
  done: 'เสร็จแล้ว',
  current: 'กำลังทำอยู่',
  todo: 'ยังไม่เริ่ม',
}

/** แถบสามขั้นของการตั้งค่าห้องเรียน — US-03 → US-12 → US-04
 *
 *  สถานะไม่ได้เก็บไว้ที่ไหน แต่คำนวณจากข้อมูลจริงทุกครั้ง (มีนักศึกษาหรือยัง
 *  มีผู้ร่วมสอนหรือยัง สร้างงานหรือยัง) ถ้าเก็บเป็น flag ต่างหาก มันจะไม่ตรงกับ
 *  ความจริงทันทีที่อาจารย์ import ไฟล์ใหม่หรือถอดคนออก
 *
 *  แต่ละขั้นบอกสถานะด้วย "ข้อความ + ไอคอน" ไม่ใช่แค่สี — คนตาบอดสีต้องอ่านออกเหมือนกัน
 */
export function SetupStepper({ steps }: { steps: { title: string; state: StepState }[] }) {
  return (
    <ol
      aria-label="ขั้นตอนการตั้งค่าห้องเรียน"
      className="mb-8 grid list-none gap-2 rounded-2xl border border-edge bg-white p-2 shadow-[0_1px_2px_rgba(23,32,51,0.04)] sm:grid-cols-3"
    >
      {steps.map((step, i) => {
        const done = step.state === 'done'
        const current = step.state === 'current'

        return (
          <li
            key={step.title}
            className={
              'flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 ' +
              (current ? 'bg-accent-soft ring-1 ring-accent-line' : done ? '' : 'opacity-70')
            }
          >
            <span
              aria-hidden="true"
              className={
                'grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[13px] ' +
                (current
                  ? 'border-cta bg-cta text-white'
                  : done
                    ? 'border-ok-line bg-ok-50 text-ok-700'
                    : 'border-edge-strong bg-ground text-muted')
              }
            >
              {done ? <IconCheck className="size-3.5" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[14.5px] leading-tight font-semibold">
                {step.title}
              </span>
              <span
                className={
                  'block text-[12.5px] leading-tight ' +
                  (current ? 'text-accent-ink' : done ? 'text-ok-700' : 'text-muted')
                }
              >
                {STATE_LABEL[step.state]}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
