import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import reportsIllustration from '../assets/figma/scores-released.png'
import { AppNav } from '../components/AppNav'
import { Banner, Card, FOCUS, Pill, btn } from '../components/Ui'
import {
  IconBack,
  IconLock,
  IconShield,
} from '../components/icons'
import { ApiError, type MyScore, getMyScore, listClassrooms } from '../lib/api'

const number = (value: string | number | null | undefined, digits = 3) => value === null || value === undefined ? '—' : Number(value).toLocaleString('th-TH', { maximumFractionDigits: digits })
const scoreNumber = (value: string | number | null | undefined, digits = 3) => value === null || value === undefined ? '—' : Number(value).toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** แยกองค์ประกอบคะแนนตาม Figma โดยแสดงเฉพาะค่ารวมที่ API คืนมาจริง */
function ScoreStep({
  label,
  value,
  hint,
  muted = false,
  rows = [],
}: {
  label: string
  value: ReactNode
  hint: string
  muted?: boolean
  rows?: NonNullable<MyScore['criterionScores']>
}) {
  return (
    <Card radius="md">
      <div className="border-b border-edge px-6 py-4 max-sm:border-0 max-sm:px-4 max-sm:pb-0">
        <h2 className="font-display text-xl font-bold max-sm:text-base">{label}</h2>
        <p className="mt-2 text-xs leading-5 text-muted">{hint}</p>
      </div>
      {rows.length > 0 && <ul className="space-y-2 px-6 pt-4 max-sm:px-4">
        {rows.map((row) => <li key={row.id} className="flex items-start gap-3 text-sm">
          <span className="min-w-0 flex-1 text-ink-2">{row.name}</span>
          <span className="text-xs text-muted">{number(row.weightPct)}%</span>
          <span className="font-mono tabular" title={`คะแนนเต็ม ${number(row.maxScore)}`}>{scoreNumber(row.score)}</span>
        </li>)}
      </ul>}
      <div className={`flex flex-wrap items-center justify-between gap-3 px-6 py-4 max-sm:px-4 ${muted ? 'bg-sand/40' : ''}`}>
        <p className="text-sm font-semibold">รวม{label}</p>
        <div className="font-mono text-base tabular text-accent-ink">{value}</div>
      </div>
    </Card>
  )
}

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

  const participationPercent = score?.participationRatio
    ? Math.min(100, Math.max(0, Number(score.participationRatio) * 100))
    : 0

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <AppNav
        context="คะแนนของฉัน"
        contextTo={`/classrooms/${classroomId}`}
        classroomId={classroomId}
      />

      <main className="mx-auto max-w-304 px-7 pt-8 pb-16 max-sm:px-4 max-sm:pt-6">
        <div className="flex min-h-44 items-center justify-between gap-6 max-sm:min-h-0">
          <div className="flex items-start gap-4">
            <Link to={`/classrooms/${classroomId}`} aria-label="กลับหน้าห้องเรียน" className={`mt-1 grid size-11 shrink-0 place-items-center rounded-full text-brand-600 hover:bg-accent-soft ${FOCUS}`}>
              <IconBack className="size-10" />
            </Link>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight max-sm:text-2xl">คะแนนของฉัน</h1>
              <p className="mt-2 text-sm text-muted">{[score?.assignmentName, groupName ? `กลุ่ม ${groupName}` : null].filter(Boolean).join(' · ') || 'ดูองค์ประกอบคะแนนและสถานะการประกาศผล'}</p>
            </div>
          </div>
          <img src={reportsIllustration} alt="" aria-hidden="true" className="h-52 w-68 shrink-0 object-contain max-sm:hidden" />
        </div>

        {error && (
          <Banner tone="err" data-testid="error-msg" role="alert" className="mt-6">
            {error}
          </Banner>
        )}

        {loaded && score && !score.finalized && (
          <Banner tone="warn" data-testid="not-finalized" className="mt-6">
            {score.message ?? 'ยังไม่ประกาศผลคะแนน'}
          </Banner>
        )}

        {loaded && score && score.finalized && (
          <div data-testid="score-card" className="mt-6 space-y-4 max-sm:mt-2 max-sm:space-y-3">
            <Card radius="md" className="px-6 py-8 text-center max-sm:px-4 max-sm:py-5">
              <p className="text-sm font-semibold">คะแนนรวม</p>
              <div className="mt-3 flex flex-wrap items-baseline justify-center gap-3 font-mono text-5xl tabular text-brand-600 max-sm:text-[44px]">
                {score.finalScore !== null ? (
                  <span data-testid="final-score">{scoreNumber(score.finalScore, 2)}</span>
                ) : (
                  <Pill data-testid="final-score-hidden" tone="neutral" className="font-body">
                    ยังแสดงไม่ได้
                  </Pill>
                )}
                {score.groupMaxScore != null && score.individualMaxScore != null && <span className="font-mono text-lg text-muted">/{number(Number(score.groupMaxScore) + Number(score.individualMaxScore))}</span>}
              </div>
              <p className="mt-4 text-xs text-muted">
                {score.finalScore === null ? 'จะแสดงเมื่อองค์ประกอบคะแนนครบเกณฑ์ความเป็นส่วนตัว' : 'คะแนนสุดท้าย · ประกาศผลแล้ว'}
                {score.finalizedAt && ` ${new Date(score.finalizedAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}`}
              </p>
            </Card>

            <div className="space-y-4 max-sm:space-y-3">
              <div className="space-y-4 max-sm:space-y-3">
                <ScoreStep
                  label="คะแนนกลุ่ม"
                  value={<span><span data-testid="group-component">{scoreNumber(score.groupComponent)}</span>{score.groupMaxScore != null && ` / ${number(score.groupMaxScore)}`}</span>}
                  rows={score.criterionScores?.filter((row) => row.side === 'GROUP')}
                  hint={score.groupOverridden ? 'ผู้สอนปรับคะแนนรวมฝั่งกลุ่มแล้ว ผลรวมจึงอาจต่างจากคะแนนรายเกณฑ์ด้านบน' : `${groupName ? `กลุ่ม ${groupName} · ` : ''}เต็ม ${number(score.groupMaxScore)} คะแนน · เท่ากันทุกคนในกลุ่ม`}
                />

                <ScoreStep
                  label="คะแนนรายบุคคล"
                  muted={score.individualHidden}
                  value={
                    score.individualHidden ? (
                      <Pill
                        data-testid="individual-hidden"
                        tone="neutral"
                        icon={<IconLock className="size-3" />}
                        className="font-body"
                      >
                        ซ่อนไว้
                      </Pill>
                    ) : (
                      <span><span data-testid="individual-component">{scoreNumber(score.individualComponent)}</span>{score.individualMaxScore != null && ` / ${number(score.individualMaxScore)}`}</span>
                    )
                  }
                  rows={score.individualHidden ? [] : score.criterionScores?.filter((row) => row.side === 'INDIVIDUAL')}
                  hint={
                    score.individualHidden
                      ? 'จำนวนผู้ประเมินยังไม่ถึงเกณฑ์ความเป็นส่วนตัว'
                      : score.individualOverridden ? 'ผู้สอนปรับคะแนนรวมรายบุคคลแล้ว ผลรวมจึงอาจต่างจากคะแนนรายเกณฑ์ด้านบน' : `เพื่อนร่วมกลุ่มประเมิน · เต็ม ${number(score.individualMaxScore)} คะแนน · ไม่เปิดเผยว่าใครเป็นผู้ประเมิน`
                  }
                />

              </div>

              <Card radius="md">
                <div className="border-b border-edge px-6 py-4 max-sm:border-0 max-sm:px-4 max-sm:pb-0">
                  <h2 className="font-display text-xl font-bold max-sm:text-base">การมีส่วนร่วมของฉัน</h2>
                  <p className="mt-1 text-xs text-muted max-sm:hidden">นับจากคำตอบที่ส่งจริง เทียบกับคู่ที่ได้รับมอบหมาย</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 px-6 py-4 max-sm:px-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm text-ink-2">ส่งแล้ว</p>
                      <p className="font-mono text-sm tabular">{score.submittedCount != null && `${score.submittedCount} / ${score.assignedCount} คู่ `}<span data-testid="participation-ratio">(p = {scoreNumber(score.participationRatio, 2)})</span></p>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="สัดส่วนคู่ที่ตอบเทียบกับที่ได้รับมอบหมาย"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={participationPercent}
                      className="mt-3 h-2 overflow-hidden rounded-full bg-edge"
                    >
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${participationPercent}%` }} />
                    </div>
                    <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                      ตัวคูณการมีส่วนร่วม{' '}
                      <span data-testid="participation-multiplier" className="font-mono text-accent-ink">
                        M = {scoreNumber(score.participationMultiplier, 2)}
                      </span>
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted">ตัวคูณนี้มีผลเฉพาะคะแนนของคุณ ไม่ลดคะแนนของเพื่อน</p>
                  </div>
                </div>
              </Card>

              {score.individualHidden && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-edge bg-white p-4 text-sm text-ink-2">
                  <IconShield aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent-ink" />
                  <p className="leading-6">
                    ระบบซ่อนเฉพาะคะแนนที่อาจเปิดเผยตัวผู้ประเมิน คะแนนที่ซ่อนไว้ไม่ใช่คะแนนศูนย์
                    และจะเปิดเผยอัตโนมัติเมื่อข้อมูลครบเกณฑ์
                  </p>
                </div>
              )}
              <div className="flex justify-end">
                <Link to={`/classrooms/${classroomId}/assignments/${assignmentId}/appeal`} title="ยื่นอุทธรณ์ได้ภายใน 7 วันหลังประกาศผล" className={btn('ghost', 'md', 'min-w-53 text-accent-ink max-sm:w-full')}>ยื่นอุทธรณ์คะแนน</Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
