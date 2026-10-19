import { useEffect, useRef, useState } from 'react'

import privacyIllustration from '../assets/figma/privacy.png'
import { ApiError, acknowledgePrivacy } from '../lib/api'
import { Spinner, btn } from './Ui'

/** ข้อมูลที่ระบบเก็บ — ข้อความเดียวกับ Figma ST03 และแท็บ "ความเป็นส่วนตัว" ของหน้าคู่มือ */
export const COLLECTED_DATA: { item: string; reason: string; retention: string }[] = [
  { item: 'อีเมลมหาวิทยาลัย', reason: 'ยืนยันตัวตนและจับคู่กับรายชื่อในห้องเรียน', retention: '2 ปีการศึกษา' },
  { item: 'ชื่อ-สกุล', reason: 'แสดงในรายงานของอาจารย์', retention: '2 ปีการศึกษา' },
  { item: 'รหัสนักศึกษา (ถ้าให้)', reason: 'เชื่อมกับระบบทะเบียน', retention: '2 ปีการศึกษา' },
  { item: 'ผลการประเมินและตัวตนผู้ประเมิน', reason: 'ตรวจสอบความสุจริตทางวิชาการ', retention: '2 ปีการศึกษา' },
  { item: 'เวลาที่ใช้ตอบแต่ละคู่', reason: 'สัญญาณคุณภาพของการประเมิน', retention: '1 ปีการศึกษา' },
]

export function CollectedDataTable({
  rows = COLLECTED_DATA,
  className = '',
}: {
  rows?: typeof COLLECTED_DATA
  className?: string
}) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-edge bg-white ${className}`}>
      <table className="w-full min-w-140 border-collapse text-left text-[15px]">
        <thead className="bg-[#fde5d8]">
          <tr>
            <th scope="col" className="w-[53%] px-4 py-3 font-display font-semibold">
              ข้อมูลที่เก็บ
            </th>
            <th scope="col" className="px-4 py-3 font-display font-semibold">
              เหตุผล
            </th>
            <th scope="col" className="w-37.5 px-4 py-3 font-display font-semibold">
              ระยะเวลา
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.item} className="border-t border-edge">
              <th scope="row" className="px-4 py-3 font-display font-semibold">
                {row.item}
              </th>
              <td className="px-4 py-3 text-ink-2">{row.reason}</td>
              <td className="px-4 py-3 text-ink-2">{row.retention}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** ประกาศความเป็นส่วนตัวตอนเข้าสู่ระบบครั้งแรก (Figma ST03 · J01b · C02 · T02)
 *
 *  ปิดด้วย Escape ไม่ได้ — ผู้ใช้ต้องกดรับทราบก่อนใช้งาน ตามที่แบบระบุว่า
 *  "การใช้งานต่อถือว่าได้อ่านประกาศนี้แล้ว"
 */
export function PrivacyNotice({ onAcknowledged }: { onAcknowledged: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const node = dialog.current
    if (node && !node.open) node.showModal()
  }, [])

  async function acknowledge() {
    setSaving(true)
    setError(null)
    try {
      await acknowledgePrivacy()
      dialog.current?.close()
      onAcknowledged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="privacy-title"
      data-testid="privacy-notice"
      onCancel={(event) => event.preventDefault()}
      className="fixed inset-0 m-auto max-h-[94dvh] w-[calc(100vw-2rem)] max-w-289 overflow-y-auto rounded-3xl bg-[#fffaf4] p-5 text-ink shadow-[0_24px_60px_rgba(50,16,7,0.18)] backdrop:bg-ink/40 sm:p-5"
    >
      <div className="relative flex min-h-42.5 items-center">
        <div className="relative z-10 max-w-[60%] max-sm:max-w-full">
          <h2
            id="privacy-title"
            className="font-display text-[30px] leading-[50px] font-bold max-sm:text-2xl max-sm:leading-tight"
          >
            ข้อมูลที่ระบบเก็บเกี่ยวกับคุณ
          </h2>
          <p className="mt-1.5 text-[15px] text-ink-2">
            ระบบนี้อยู่ภายใต้พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
          </p>
        </div>
        <img
          src={privacyIllustration}
          alt=""
          aria-hidden="true"
          width={326}
          height={227}
          className="pointer-events-none absolute -top-4 right-0 h-57 w-81.5 object-contain max-sm:hidden"
        />
      </div>

      <CollectedDataTable className="mt-5" />

      <div className="mt-5 rounded-2xl bg-white px-5 py-5">
        <h3 className="font-display text-[16px] font-semibold">ใครเห็นอะไรบ้าง</h3>
        <ul className="mt-2 space-y-1.5 text-[15px] leading-6 text-ink-2">
          <li>•&nbsp; เพื่อนนักศึกษา ไม่เห็นคะแนนของคุณ และไม่มีทางรู้ว่าใครประเมินใคร</li>
          <li>
            •&nbsp; อาจารย์ผู้สอน เห็นคะแนนของทุกคน และเห็นได้ว่าใครเป็นผู้ประเมิน โดยทุกครั้งที่เปิดดูจะถูกบันทึกไว้
          </li>
          <li>•&nbsp; ผู้ช่วยสอน เห็นเฉพาะรายชื่อ ไม่เห็นคะแนนและไม่เห็นตัวตนผู้ประเมิน</li>
        </ul>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-err">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-5">
        <p className="text-[14px] text-accent-ink">การใช้งานต่อถือว่าได้อ่านประกาศนี้แล้ว</p>
        <button
          type="button"
          onClick={() => void acknowledge()}
          disabled={saving}
          className={btn('primary', 'md', 'min-h-12 px-5')}
        >
          {saving && <Spinner />}
          รับทราบและเริ่มใช้งาน
        </button>
      </div>
    </dialog>
  )
}
