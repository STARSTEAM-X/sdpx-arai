import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Card, CardHead, Pill } from './Ui'
import { IconArrowRight, IconClipboardCheck, IconTransparentScore } from './icons'
import { ApiError, type AssignmentSummary, listClassroomAssignments } from '../lib/api'

const STATUS_LABEL: Record<AssignmentSummary['status'], string> = {
  DRAFT: 'ร่าง',
  PUBLISHED: 'เปิดให้ประเมิน',
  OPEN: 'เปิดให้ประเมิน',
  CLOSED: 'ปิดรับแล้ว',
  FINALIZED: 'ประกาศผลแล้ว',
  ARCHIVED: 'เก็บถาวร',
}

/** รายการงานประเมินของห้องเรียน — จุดเข้าเดียวที่นักศึกษามีไปหน้าประเมิน (US-07)
 *
 *  ก่อนหน้านี้นักศึกษาเปิดห้องเรียนแล้วเห็นแค่รายชื่อ ไม่มีทางไปต่อได้เลยแม้จะมีงาน
 *  ประกาศแล้วก็ตาม — การ์ดนี้คือช่องว่างที่ปิดให้ครบ ไม่ใช่แค่ backend มี endpoint
 */
export function AssignmentsToEvaluateCard({ classroomId }: { classroomId: string }) {
  const [items, setItems] = useState<AssignmentSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    listClassroomAssignments(classroomId)
      .then((res) => {
        if (!cancelled) setItems(res.items)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'โหลดรายการงานประเมินไม่สำเร็จ')
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [classroomId])

  if (loaded && items.length === 0 && !error) return null

  return (
    <Card>
      <CardHead
        id="h-evaluations"
        icon={<IconClipboardCheck className="size-5" />}
        title="งานที่ต้องประเมิน"
        hint="เปรียบเทียบผลงานทีละคู่ตามที่ได้รับมอบหมาย"
      />

      <div className="flex flex-col gap-2 p-6 max-sm:p-4">
        {error && (
          <p role="alert" className="text-sm text-err">
            {error}
          </p>
        )}

        {items.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-xl border border-edge px-4 py-3"
          >
            <span className="font-display font-medium">{a.name}</span>
            <Pill tone={a.status === 'DRAFT' ? 'neutral' : 'ok'} className="ml-auto">
              {STATUS_LABEL[a.status]}
            </Pill>

            {/* ประกาศผลแล้วให้ไปดูคะแนนแทน — คำตอบปิดแก้ไขอยู่แล้ว ไปหน้าประเมินซ้ำไม่มีประโยชน์ (US-10) */}
            {a.status === 'FINALIZED' ? (
              <Link
                to={`/classrooms/${classroomId}/assignments/${a.id}/score`}
                data-testid={`score-link-${a.id}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-accent-ink transition-colors hover:underline"
              >
                ดูคะแนน
                <IconTransparentScore className="size-4" />
              </Link>
            ) : (
              <Link
                to={`/classrooms/${classroomId}/assignments/${a.id}/evaluate`}
                data-testid={`evaluate-link-${a.id}`}
                className="flex items-center gap-1.5 text-sm font-semibold text-accent-ink transition-colors hover:underline"
              >
                ประเมิน
                <IconArrowRight className="size-4" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
