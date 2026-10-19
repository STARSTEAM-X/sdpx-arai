import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import reportsIllustration from '../assets/figma/scores-released.png'
import { AppNav } from '../components/AppNav'
import { BackChevron } from '../components/PageChrome'
import { ScoreBreakdown } from '../components/ScoreBreakdown'
import { Banner, btn } from '../components/Ui'
import { ApiError, type MyScore, getMyScore, listClassrooms } from '../lib/api'

/** หน้าคะแนนของนักศึกษาเอง — US-10 ภายใต้กฎ anonymity ของ US-15
 *
 *  แสดงได้เฉพาะหลังงานถูกประกาศผล (FINALIZED) — ก่อนหน้านั้นบอกแค่ว่ายังไม่ประกาศ
 *  ไม่มีตัวเลขให้เห็นแม้แต่ตัวเดียว เพราะคะแนนระหว่างทางยังไม่ใช่คะแนนที่เชื่อถือได้
 */
export default function ScorePage() {
  const { classroomId = '', assignmentId = '' } = useParams()

  const [score, setScore] = useState<MyScore | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [groupName, setGroupName] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [result, rooms] = await Promise.all([getMyScore(assignmentId), listClassrooms()])
      setScore(result)
      setGroupName(rooms.items.find((room) => room.id === classroomId)?.groupName ?? null)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดคะแนนไม่สำเร็จ')
    } finally {
      setLoaded(true)
    }
  }, [assignmentId, classroomId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <AppNav
        context="คะแนนของฉัน"
        contextTo={`/classrooms/${classroomId}`}
        classroomId={classroomId}
      />

      <main className="mx-auto max-w-290 pb-16 max-xl:px-7 max-sm:px-4 max-sm:pt-5">
        <div className="relative flex min-h-52 items-center justify-between gap-6 max-sm:min-h-0">
          <div className="flex items-center gap-4">
            <BackChevron to={`/classrooms/${classroomId}`} label="กลับหน้าห้องเรียน" />
            <div>
              <h1 className="font-display text-[30px] font-bold max-sm:text-2xl">คะแนนของฉัน</h1>
              <p className="mt-1.5 text-[15px] text-ink-2">{[score?.assignmentName, groupName ? `กลุ่ม ${groupName}` : null].filter(Boolean).join(' · ') || 'ดูองค์ประกอบคะแนนและสถานะการประกาศผล'}</p>
            </div>
          </div>
          <img src={reportsIllustration} alt="" aria-hidden="true" className="h-52 w-68 shrink-0 object-contain max-sm:hidden" />
        </div>

        {error && (
          <Banner tone="err" data-testid="error-msg" role="alert" className="mt-6">
            {error}
          </Banner>
        )}

        {loaded && score && !score.finalized && !score.provisional && (
          <Banner tone="warn" data-testid="not-finalized" className="mt-6">
            {score.message ?? 'ยังไม่ประกาศผลคะแนน'}
          </Banner>
        )}

        {loaded && score && (score.finalized || score.provisional) && (
          <div data-testid="score-card" className="mt-5 space-y-5 max-sm:mt-2 max-sm:space-y-3">
            <ScoreBreakdown score={score} groupName={groupName} />
            {score.provisional && <p className="text-right text-[11px] text-muted">ระบบแสดงเฉพาะค่าปัจจุบัน ไม่มีประวัติย้อนหลังหรือการเปลี่ยนแปลงรายวัน เพื่อไม่ให้อนุมานได้ว่าใครเป็นผู้ประเมิน</p>}

            <div className="flex justify-end">
              <Link to={`/classrooms/${classroomId}/assignments/${assignmentId}/appeal`} title="ยื่นอุทธรณ์ได้ภายใน 7 วันหลังประกาศผล" className={btn('ghost', 'md', 'min-w-53 border-brand-600 text-accent-ink max-sm:w-full')}>ยื่นอุทธรณ์คะแนน</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
