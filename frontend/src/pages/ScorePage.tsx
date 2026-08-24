import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Banner, Card, CardHead, Pill } from '../components/Ui'
import {
  IconArrowRight,
  IconCheckCircle,
  IconChevronLeft,
  IconLock,
  IconShield,
  IconStudent,
  IconTransparentScore,
  IconUsers,
  LogoMark,
} from '../components/icons'
import { ApiError, type MyScore, getMyScore } from '../lib/api'

/** หนึ่งขั้นใน flow คะแนน — ตัวเลขแต่ละส่วนอยู่ตำแหน่งเดียวกันเพื่อไล่อ่านจากซ้ายไปขวา */
function ScoreStep({
  icon,
  label,
  value,
  hint,
  muted = false,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  hint: string
  muted?: boolean
}) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center rounded-2xl border p-5 text-center ${muted ? 'border-edge bg-sand' : 'border-edge bg-white'}`}
    >
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-xl border border-edge bg-white text-ink-2"
      >
        {icon}
      </span>
      <h3 className="mt-3 font-display text-sm font-semibold">{label}</h3>
      <div className="mt-2 flex min-h-8 items-center font-mono text-2xl font-bold tabular">
        {value}
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">{hint}</p>
    </div>
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

  const refresh = useCallback(async () => {
    try {
      setScore(await getMyScore(assignmentId))
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'โหลดคะแนนไม่สำเร็จ')
    } finally {
      setLoaded(true)
    }
  }, [assignmentId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const participationPercent = score?.participationRatio
    ? Math.min(100, Math.max(0, Number(score.participationRatio) * 100))
    : 0

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <header className="sticky top-0 z-40 border-b border-edge bg-white/88 shadow-[0_1px_2px_rgba(23,32,51,0.05)] backdrop-blur">
        <nav
          aria-label="เมนูหลัก"
          className="mx-auto flex h-16 max-w-300 items-center gap-4 px-6 max-sm:px-4"
        >
          <Link
            to="/"
            className="flex min-h-11 items-center gap-2.5 font-display text-[19px] font-bold tracking-tight"
          >
            <LogoMark className="size-8" />
            PairEval
          </Link>

          <Link
            to={`/classrooms/${classroomId}`}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-ink-2 transition-colors hover:bg-sand hover:text-ink"
          >
            <IconChevronLeft className="size-4" />
            กลับไปห้องเรียน
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-240 px-6 pt-8 pb-16 max-sm:px-4">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight max-sm:text-2xl">คะแนนของฉัน</h1>
          <p className="mt-1.5 text-muted">ดูองค์ประกอบคะแนนและสถานะการประกาศผล</p>
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
          <Card data-testid="score-card" className="mt-6">
            <CardHead
              id="h-score"
              icon={<IconTransparentScore className="size-5" />}
              title="รายละเอียดคะแนน"
              hint="ประกาศผลแล้ว — ไล่ดูที่มาของคะแนนจากซ้ายไปขวา"
              badge={
                <Pill tone="ok" icon={<IconCheckCircle className="size-3" />}>
                  ประกาศผลแล้ว
                </Pill>
              }
            />

            <div className="p-6 max-sm:p-4">
              <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)_2rem_minmax(0,1fr)]">
                <ScoreStep
                  icon={<IconUsers className="size-5" />}
                  label="คะแนนกลุ่ม"
                  value={<span data-testid="group-component">{score.groupComponent}</span>}
                  hint="ผลจากการเปรียบเทียบผลงานระหว่างกลุ่ม"
                />

                <div aria-hidden="true" className="grid place-items-center text-xl font-bold text-muted max-md:rotate-90">
                  +
                </div>

                <ScoreStep
                  icon={<IconStudent className="size-5" />}
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
                      <span data-testid="individual-component">{score.individualComponent}</span>
                    )
                  }
                  hint={
                    score.individualHidden
                      ? 'จำนวนผู้ประเมินยังไม่ถึงเกณฑ์ความเป็นส่วนตัว'
                      : 'ผลประเมินการมีส่วนร่วมรายบุคคล'
                  }
                />

                <div aria-hidden="true" className="grid place-items-center text-muted max-md:rotate-90">
                  <IconArrowRight className="size-5" />
                </div>

                <ScoreStep
                  icon={<IconTransparentScore className="size-5" />}
                  label="คะแนนรวมสุดท้าย"
                  muted={score.finalScore === null}
                  value={
                    score.finalScore !== null ? (
                      <span data-testid="final-score">{score.finalScore}</span>
                    ) : (
                      <Pill data-testid="final-score-hidden" tone="neutral" className="font-body">
                        ยังแสดงไม่ได้
                      </Pill>
                    )
                  }
                  hint={score.finalScore === null ? 'จะแสดงเมื่อองค์ประกอบคะแนนครบ' : 'คะแนนที่ผู้สอนประกาศแล้ว'}
                />
              </div>

              <div className="mt-4 rounded-2xl bg-sand p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-white text-ok-700">
                    <IconCheckCircle className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-display text-sm font-semibold">สัดส่วนการมีส่วนร่วม</p>
                      <span data-testid="participation-ratio" className="font-mono font-bold tabular">
                        {score.participationRatio}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="สัดส่วนคู่ที่ตอบเทียบกับที่ได้รับมอบหมาย"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={participationPercent}
                      className="mt-2 h-2 overflow-hidden rounded-full bg-edge"
                    >
                      <div className="h-full rounded-full bg-ok-700" style={{ width: `${participationPercent}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">สัดส่วนคู่ที่ตอบเทียบกับที่ได้รับมอบหมายทั้งหมด</p>
                  </div>
                </div>
              </div>

              {score.individualHidden && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-edge bg-white p-4 text-sm text-ink-2">
                  <IconShield aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent-ink" />
                  <p className="leading-6">
                    ระบบซ่อนเฉพาะคะแนนที่อาจเปิดเผยตัวผู้ประเมิน คะแนนที่ซ่อนไว้ไม่ใช่คะแนนศูนย์
                    และจะเปิดเผยอัตโนมัติเมื่อข้อมูลครบเกณฑ์
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
