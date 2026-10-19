import { Link } from 'react-router-dom'

import classroom from '../assets/enhanced/classroom.webp'
import comparison from '../assets/figma/hero.png'
import submission from '../assets/figma/create-assignment.png'
import { FOCUS } from './Ui'

const STEPS = [
  { image: classroom, title: 'ดูผลงาน', body: 'ดูผลงานของเพื่อนสองคน\nที่ถูกเลือกมาให้เปรียบเทียบ', action: 'ดูตัวอย่าง', hint: 'เปิดงานในห้องเรียน เลือกงานที่ต้องประเมิน แล้วดูผลงาน A และ B ตามลิงก์ที่ผู้สอนเตรียมไว้' },
  { image: comparison, title: 'เปรียบเทียบ', body: 'เลือกผลงานที่ทำได้ดีกว่า\nตามเกณฑ์ที่ผู้สอนกำหนด', action: 'รู้จักการประเมิน', hint: 'เลือกจาก 6 ระดับตามเกณฑ์ ไม่มีตัวเลือกเสมอ ระบบบันทึกคำตอบอัตโนมัติเมื่อหยุดเลือก 2 วินาที' },
  { image: submission, title: 'ส่งการประเมิน', body: 'ตรวจคำตอบให้ครบ\nแล้วส่งการประเมินของคุณ', action: 'ดูวิธีส่งคำตอบ', hint: 'ตรวจคำตอบแล้วกดส่งคำตอบก่อนกำหนดเวลา หากยังตอบไม่ครบ ระบบจะแจ้งจำนวนคู่ที่เหลือให้ยืนยันก่อนส่ง' },
]

export function ProcessFlow() {
  return (
    <section id="how-it-works" className="mx-auto max-w-304 scroll-mt-6 px-5 pt-10 pb-7 sm:px-7">
      <h2 className="text-center font-display text-[26px] leading-[1.45] font-bold sm:text-[34px]">
        ประเมินง่าย ใน 3 ขั้นตอน
      </h2>

      <ol className="mt-7 grid items-start gap-5 md:grid-cols-3 lg:gap-10">
        {STEPS.map(({ image, title, body, action, hint }) => (
          <li key={title} className="rounded-[28px] bg-white px-7 pt-6 pb-8 text-center shadow-[0_12px_36px_-22px_rgba(101,73,63,0.2)] sm:px-8">
            <img src={image} alt="" width={640} height={480} loading="lazy" className="mx-auto h-40 w-60 max-w-full object-contain" />
            <h3 className="mt-3 font-display text-2xl font-bold">{title}</h3>
            <p className="mt-3 whitespace-pre-line text-base leading-[1.45] text-muted">{body}</p>
            <details className="group mt-3 text-left">
              <summary className={`mx-auto flex min-h-12.5 max-w-53 cursor-pointer list-none items-center justify-center rounded-full border border-brand-600 px-4 text-center font-semibold text-accent-ink transition-colors hover:bg-brand-50 [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                {action}
              </summary>
              <p className="mt-4 text-sm leading-relaxed text-ink-2">{hint}</p>
              <Link to="/classrooms" className={`mt-3 inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-accent-ink underline underline-offset-4 ${FOCUS}`}>ไปที่ห้องเรียน</Link>
            </details>
          </li>
        ))}
      </ol>
    </section>
  )
}
