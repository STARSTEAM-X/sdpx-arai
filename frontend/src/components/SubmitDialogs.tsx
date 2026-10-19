import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

import successArt from '../assets/figma/privacy.png'
import { btn } from './Ui'

/** Figma ST21 · ยืนยันส่งคำตอบที่ยังไม่ครบ */
export function SubmitConfirmDialog({ answered, unanswered, deadline, onCancel, onConfirm }: {
  answered: number
  unanswered: number
  deadline: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-submit-title"
      data-testid="submit-confirm"
      onClose={onCancel}
      className="fixed inset-0 m-auto w-[calc(100vw-2rem)] max-w-140 rounded-3xl bg-white p-6 text-ink shadow-[0_24px_60px_rgba(50,16,7,0.2)] backdrop:bg-ink/40 max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:px-5 max-sm:pt-3"
    >
      {/* Figma M05 — บนมือถือเป็น bottom sheet มีแถบจับด้านบน */}
      <span aria-hidden="true" className="mx-auto mb-4 block h-1 w-10 rounded-full bg-[#ecd9cc] sm:hidden" />
      <h2 id="confirm-submit-title" className="font-display text-[20px] font-bold">ส่งคำตอบทั้งที่ยังตอบไม่ครบ?</h2>
      <p className="mt-2 text-[15px] leading-6 text-ink-2">
        คุณยังตอบไม่ครบทุกคู่ ส่งตอนนี้ได้ และกลับมาแก้ไขได้จนถึงกำหนดส่ง<br />ระบบจะใช้คำตอบครั้งล่าสุดในการคำนวณ
      </p>
      <dl className="mt-4 space-y-1.5 rounded-2xl bg-[#f6f3f0] px-4 py-3 text-[15px]">
        <div className="flex justify-between"><dt className="text-ink-2">ตอบแล้ว</dt><dd>{answered} คู่</dd></div>
        <div className="flex justify-between"><dt className="text-ink-2">ยังไม่ตอบ</dt><dd data-testid="unanswered-count">{unanswered} คู่</dd></div>
        {deadline && <div className="flex justify-between"><dt className="text-ink-2">กำหนดส่ง</dt><dd>{deadline}</dd></div>}
      </dl>
      <p className="mt-3 text-[11px] text-err">คู่ที่ไม่ได้ตอบจะนับเป็นยังไม่ส่ง และมีผลกับตัวคูณการมีส่วนร่วมของคุณ</p>
      <div className="mt-6 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <button type="button" onClick={() => ref.current?.close()} className={btn('ghost', 'md', 'border-brand-600 text-accent-ink max-sm:order-2 max-sm:min-h-12 max-sm:border-[#cfc9c4] max-sm:text-ink')}>กลับไปตอบต่อ</button>
        <button type="button" onClick={onConfirm} className={btn('primary', 'md', 'max-sm:min-h-12')}>บันทึกคำตอบไว้</button>
      </div>
    </dialog>
  )
}

/** Figma ST23 · ส่งคำตอบสำเร็จ */
export function SubmitSuccessDialog({ classroomId, onClose }: { classroomId: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby="submit-success-title"
      data-testid="submit-success"
      onClose={onClose}
      className="fixed inset-0 m-auto w-[calc(100vw-2rem)] max-w-246 overflow-hidden rounded-3xl bg-white p-0 text-center text-ink shadow-[0_24px_60px_rgba(50,16,7,0.2)] backdrop:bg-ink/40 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:bg-ground"
    >
      <div className="relative px-6 pt-7 pb-28 max-sm:pt-34 max-sm:pb-8">
        <img src={successArt} alt="" width={326} height={227} className="mx-auto h-auto w-64" />
        <h2 id="submit-success-title" className="relative -mt-6 font-display text-[40px] leading-tight font-bold text-[#237a5c] max-sm:text-[28px]">
          ส่งคำตอบสำเร็จแล้ว
        </h2>
        <p className="mt-1 text-[16px] text-ink-2">รอการประกาศผลคะแนน</p>
        <Link to={`/classrooms/${classroomId}`} className={btn('primary', 'md', 'relative z-10 mt-8 px-6 max-sm:mt-5 max-sm:min-h-12 max-sm:w-full')}>ไปหน้าห้องเรียน</Link>
        <svg aria-hidden="true" viewBox="0 0 986 92" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-23 w-full max-sm:hidden">
          <defs>
            <linearGradient id="success-wave" x1="0" x2="1">
              <stop offset="0" stopColor="#ff7d3d" />
              <stop offset="0.5" stopColor="#ffd67d" />
              <stop offset="1" stopColor="#ff7a38" />
            </linearGradient>
          </defs>
          <path d="M0 0c180 18 330 28 520 18S860 4 986 46v46H0z" fill="url(#success-wave)" />
        </svg>
      </div>
    </dialog>
  )
}
