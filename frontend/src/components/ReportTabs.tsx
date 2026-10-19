import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { FOCUS } from './Ui'
import { listAppeals } from '../lib/api'

export type ReportView = 'group' | 'individual' | 'coverage' | 'signals' | 'appeals'

/** แถบเลือกรายงานของงานหนึ่งชิ้น — Figma J25 / J26 / J28 / J35 ใช้ชุดเดียวกัน
 *  แท็บคำร้องอุทธรณ์แสดงเฉพาะงานที่ประกาศผลแล้ว (นักศึกษายื่นได้หลังประกาศเท่านั้น) */
export function ReportTabs({
  classroomId,
  assignmentId,
  active,
  showAppeals,
}: {
  classroomId: string
  assignmentId: string
  active: ReportView
  /** แสดงแท็บคำร้องอุทธรณ์ (งานประกาศผลแล้ว) พร้อมจำนวนที่รอตอบ */
  showAppeals: boolean
}) {
  const [openAppeals, setOpenAppeals] = useState<number | null>(null)
  useEffect(() => {
    if (!showAppeals) return
    let live = true
    listAppeals(classroomId)
      .then((result) => {
        if (live)
          setOpenAppeals(result.items.filter((a) => a.assignmentId === assignmentId && a.status === 'OPEN').length)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [classroomId, assignmentId, showAppeals])
  const base = `/classrooms/${classroomId}/assignments/${assignmentId}`
  const tabs: { view: ReportView; to: string; label: string }[] = [
    { view: 'group', to: `${base}/report#group`, label: 'คะแนนกลุ่ม' },
    {
      view: 'individual',
      to: `${base}/report#individual`,
      label: 'คะแนนรายบุคคล',
    },
    {
      view: 'coverage',
      to: `${base}/quality#coverage`,
      label: 'coverage รายคู่',
    },
    { view: 'signals', to: `${base}/quality`, label: 'คุณภาพการประเมิน' },
  ]
  if (showAppeals)
    tabs.push({
      view: 'appeals',
      to: `${base}/report#appeals`,
      label: `คำร้องอุทธรณ์${openAppeals ? ` ${openAppeals}` : ''}`,
    })
  return (
    <nav
      aria-label="เลือกรายงาน"
      className="mb-5 inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-edge bg-white p-1.5"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.view}
          to={tab.to}
          aria-current={tab.view === active ? 'page' : undefined}
          className={`inline-flex min-h-11 items-center rounded-xl px-4 font-display text-[14.5px] font-semibold ${
            tab.view === active ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-sand'
          } ${tab.view === 'appeals' && tab.view !== active ? 'text-accent-ink' : ''} ${FOCUS}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
