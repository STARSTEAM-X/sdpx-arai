import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Banner, Card, CardHead, Pill } from '../components/Ui'
import { IconChevronLeft, IconLock, IconTransparentScore, LogoMark } from '../components/icons'
import { ApiError, type MyScore, getMyScore } from '../lib/api'

/** แถวตัวเลขคะแนนหนึ่งบรรทัด — ใช้ซ้ำทั้งกลุ่มและรายบุคคล ให้หน้าตาตรงกันเป๊ะ */
function ScoreRow({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-edge py-4 last:border-0">
      <div>
        <p className="font-display font-semibold">{label}</p>
        {hint && <p className="mt-0.5 text-[12.5px] text-muted">{hint}</p>}
      </div>
      <span className="font-mono text-xl tabular">{value}</span>
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

      <main className="mx-auto max-w-180 px-6 pt-8 pb-16 max-sm:px-4">
        <h1 className="font-display text-3xl font-bold tracking-tight max-sm:text-2xl">คะแนนของฉัน</h1>
        <p className="mt-1.5 max-w-[62ch] text-muted">
          คะแนนสุดท้ายหลังงานประเมินนี้ประกาศผลแล้ว
        </p>

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
              title="ผลคะแนน"
              hint="ประกาศผลแล้ว — ตัวเลขนี้เป็นคะแนนสุดท้าย"
            />

            <div className="flex flex-col gap-0 px-6 max-sm:px-4">
              <ScoreRow
                label="คะแนนกลุ่ม"
                value={<span data-testid="group-component">{score.groupComponent}</span>}
              />

              {score.individualHidden ? (
                <div className="flex items-center justify-between gap-4 border-b border-edge py-4 last:border-0">
                  <div>
                    <p className="font-display font-semibold">คะแนนรายบุคคล</p>
                    <p className="mt-0.5 max-w-[40ch] text-[12.5px] text-muted">
                      ยังมีผู้ประเมินไม่ครบเกณฑ์ขั้นต่ำที่จะแสดงผลได้โดยไม่เปิดเผยตัวผู้ประเมิน
                    </p>
                  </div>
                  <Pill data-testid="individual-hidden" tone="neutral" icon={<IconLock className="size-3" />}>
                    ซ่อนไว้
                  </Pill>
                </div>
              ) : (
                <ScoreRow
                  label="คะแนนรายบุคคล"
                  value={<span data-testid="individual-component">{score.individualComponent}</span>}
                />
              )}

              <ScoreRow
                label="สัดส่วนการมีส่วนร่วม"
                value={<span data-testid="participation-ratio">{score.participationRatio}</span>}
                hint="สัดส่วนคู่ที่ตอบเทียบกับที่ได้รับมอบหมายทั้งหมด"
              />

              <div className="flex items-center justify-between gap-4 py-4">
                <p className="font-display text-lg font-bold">คะแนนรวมสุดท้าย</p>
                {score.finalScore !== null ? (
                  <span data-testid="final-score" className="font-mono text-2xl font-bold tabular">
                    {score.finalScore}
                  </span>
                ) : (
                  <Pill data-testid="final-score-hidden" tone="neutral">
                    ยังแสดงไม่ได้
                  </Pill>
                )}
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
