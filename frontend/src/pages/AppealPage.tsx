import { useEffect, useState } from 'react'
import { useModal } from '../components/useModal'
import { Link, useParams } from 'react-router-dom'

import appealIllustration from '../assets/figma/appeal.png'
import successArt from '../assets/figma/privacy.png'
import { AppNav } from '../components/AppNav'
import { BackChevron, SectionCard } from '../components/PageChrome'
import { ScoreBreakdown, number, scoreNumber } from '../components/ScoreBreakdown'
import { Banner, CTRL, btn } from '../components/Ui'
import { ApiError, type Appeal, type MyScore, createAppeal, getMyScore, listAppeals, listClassrooms } from '../lib/api'
import { thaiDate } from '../lib/datetime'

const statusText = { OPEN: 'รอผู้สอนพิจารณา', RESOLVED: 'พิจารณาแล้ว', REJECTED: 'ไม่อนุมัติคำร้อง' }

/** Figma ST33 · ยื่นอุทธรณ์คะแนน และ ST34 · ยื่นอุทธรณ์สำเร็จ */
export default function AppealPage() {
  const { classroomId = '', assignmentId = '' } = useParams()
  const [score, setScore] = useState<MyScore | null>(null)
  const [groupName, setGroupName] = useState<string | null>(null)
  const [appeal, setAppeal] = useState<Appeal | null>(null)
  const [justSent, setJustSent] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    let active = true
    void Promise.all([getMyScore(assignmentId), listAppeals(classroomId), listClassrooms()])
      .then(([result, requests, rooms]) => {
        if (!active) return
        setScore(result)
        setAppeal(requests.items.find((item) => item.assignmentId === assignmentId) ?? null)
        setGroupName(rooms.items.find((room) => room.id === classroomId)?.groupName ?? null)
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'โหลดคำร้องไม่สำเร็จ')
      })
      .finally(() => {
        if (active) setLoaded(true)
      })
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [classroomId, assignmentId])

  const end = score?.finalizedAt ? new Date(score.finalizedAt).getTime() + 7 * 86400000 : 0
  const remaining = Math.max(0, end - now)
  const eligible = Boolean(score?.finalized && remaining > 0)
  const invalid = message.length > 0 && message.trim().length < 30
  const back = `/classrooms/${classroomId}/assignments/${assignmentId}/score`

  function submit() {
    setBusy(true)
    setError(null)
    void createAppeal(assignmentId, message.trim())
      .then((created) => {
        setAppeal(created)
        setJustSent(true)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'ส่งคำร้องไม่สำเร็จ'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <AppNav context="ยื่นอุทธรณ์คะแนน" contextTo={back} classroomId={classroomId} />
      <main className="mx-auto max-w-290 pb-16 max-xl:px-7 max-sm:px-4 max-sm:pt-5">
        <div className="relative flex min-h-52 items-center justify-between gap-6 max-sm:min-h-0 max-sm:py-4">
          <div className="flex items-center gap-4">
            <BackChevron to={back} label="กลับหน้าคะแนน" />
            <div>
              <h1 className="font-display text-[30px] font-bold max-sm:text-2xl">ยื่นอุทธรณ์คะแนน</h1>
              <p className="mt-2 text-[15px] text-ink-2 max-sm:hidden">
                {[
                  score?.assignmentName,
                  score?.finalizedAt ? `ประกาศผลเมื่อ ${thaiDate(score.finalizedAt)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {!appeal && (
                <p className="mt-1.5 text-[15px] text-err max-sm:text-[13px]">
                  ยื่นอุทธรณ์ได้ภายใน 7 วันหลังประกาศผล
                  {eligible &&
                    ` — เหลือเวลาอีก ${Math.floor(remaining / 86400000)} วัน ${Math.floor(remaining / 3600000) % 24} ชั่วโมง`}
                </p>
              )}
            </div>
          </div>
          <img
            src={appealIllustration}
            alt=""
            aria-hidden="true"
            width={240}
            height={180}
            className="h-45 w-60 shrink-0 object-contain max-sm:hidden"
          />
        </div>

        {error && (
          <Banner tone="err" role="alert" className="mb-4">
            {error}
          </Banner>
        )}
        {!loaded && <p role="status">กำลังโหลดคำร้อง…</p>}

        {score?.finalized && (
          <div className="mt-5 space-y-5 max-sm:mt-2 max-sm:space-y-4">
            <div className="max-sm:hidden">
              <ScoreBreakdown score={score} groupName={groupName} />
            </div>
            {/* Figma M08 — บนมือถือสรุปคะแนนเป็นการ์ดเดียว กางรายละเอียดต่อเกณฑ์ได้ */}
            <section aria-label="สรุปคะแนน" className="rounded-2xl border border-edge bg-white px-4 py-4 sm:hidden">
              <dl className="space-y-2.5 text-[14px]">
                <div className="flex justify-between font-display font-bold">
                  <dt>คะแนนรวม</dt>
                  <dd className="font-mono text-accent-ink">
                    {scoreNumber(score.finalScore, 2)} /{' '}
                    {number(Number(score.groupMaxScore ?? 0) + Number(score.individualMaxScore ?? 0))}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-2">คะแนนกลุ่ม</dt>
                  <dd className="font-mono">
                    {scoreNumber(score.groupComponent)} / {number(score.groupMaxScore)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-2">คะแนนรายบุคคล</dt>
                  <dd className="font-mono">
                    {score.individualHidden
                      ? 'ยังไม่แสดง'
                      : `${scoreNumber(score.individualComponent)} / ${number(score.individualMaxScore)}`}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-2">ตัวคูณการมีส่วนร่วม</dt>
                  <dd className="font-mono">M = {scoreNumber(score.participationMultiplier, 2)}</dd>
                </div>
              </dl>
              <details className="mt-3">
                <summary className="cursor-pointer font-display text-[14px] font-semibold text-accent-ink underline underline-offset-4">
                  ดูรายละเอียดต่อเกณฑ์
                </summary>
                <ul className="mt-3 space-y-2 text-[13.5px]">
                  {(score.criterionScores ?? []).map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span className="text-ink-2">{item.name}</span>
                      <span className="shrink-0 font-mono">
                        {scoreNumber(item.score)} / {number(item.maxScore)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </section>

            {appeal ? (
              <SectionCard
                title={statusText[appeal.status]}
                hint={`ยื่นเมื่อ ${new Date(appeal.createdAt).toLocaleString('th-TH')}`}
              >
                <p className="whitespace-pre-wrap break-words text-[15px] leading-6">{appeal.message}</p>
                {appeal.resolution && (
                  <div className="mt-5 rounded-xl bg-sand p-4">
                    <h3 className="font-semibold">คำตอบจากผู้สอน</h3>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{appeal.resolution}</p>
                  </div>
                )}
              </SectionCard>
            ) : eligible ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  submit()
                }}
              >
                <SectionCard
                  title={<label htmlFor="appeal-reason">เหตุผลในการอุทธรณ์</label>}
                  hint={<span id="appeal-hint">อธิบายให้ชัดเจนว่าคะแนนส่วนไหนที่คิดว่าไม่ถูกต้อง และเพราะอะไร</span>}
                >
                  <textarea
                    id="appeal-reason"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    minLength={30}
                    maxLength={5000}
                    required
                    disabled={busy}
                    placeholder="พิมพ์เหตุผล..."
                    aria-invalid={invalid}
                    aria-describedby="appeal-hint appeal-count"
                    className={`${CTRL} min-h-35 resize-y border-err-field max-sm:min-h-29`}
                  />
                  <p id="appeal-count" className={`mt-3 text-[12px] ${invalid ? 'text-err' : 'text-err/80'}`}>
                    กรุณาระบุเหตุผลอย่างน้อย 30 ตัวอักษร (ตอนนี้ {message.trim().length} ตัวอักษร)
                  </p>
                </SectionCard>
                <p className="mt-5 text-right text-[12px] leading-[18px] text-muted max-sm:mt-4 max-sm:text-left max-sm:text-[11px]">
                  คำร้องจะถูกส่งถึงอาจารย์ผู้สอนเท่านั้น และบันทึกลงประวัติ · อาจารย์จะตอบกลับภายใน 7 วันทำการ
                </p>
                <div className="mt-5 flex justify-end gap-5 max-sm:sticky max-sm:bottom-0 max-sm:-mx-4 max-sm:grid max-sm:grid-cols-2 max-sm:gap-3 max-sm:border-t max-sm:border-edge max-sm:bg-white max-sm:px-4 max-sm:py-3">
                  <Link
                    to={back}
                    className={btn(
                      'ghost',
                      'md',
                      'min-h-12.5 min-w-53 border-brand-600 text-accent-ink max-sm:min-h-12 max-sm:min-w-0 max-sm:border-line-neutral max-sm:text-ink',
                    )}
                  >
                    ยกเลิก
                  </Link>
                  <button
                    type="submit"
                    disabled={busy || message.trim().length < 30}
                    className={btn('primary', 'md', 'min-h-12 min-w-53 max-sm:min-w-0')}
                  >
                    {busy ? (
                      'กำลังส่ง…'
                    ) : (
                      <>
                        ยืนยันคำร้อง<span className="max-sm:hidden">อุทธรณ์</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              loaded && !error && <Banner tone="info">พ้นระยะเวลายื่นอุทธรณ์ 7 วันแล้ว</Banner>
            )}
          </div>
        )}
        {loaded && score && !score.finalized && !error && (
          <Banner tone="info">ยังไม่เปิดรับอุทธรณ์ รอประกาศผลคะแนนก่อน</Banner>
        )}
      </main>

      {justSent && <AppealSentDialog back={back} classroomId={classroomId} onClose={() => setJustSent(false)} />}
    </div>
  )
}

/** Figma ST34 · ยื่นอุทธรณ์สำเร็จ */
function AppealSentDialog({ back, classroomId, onClose }: { back: string; classroomId: string; onClose: () => void }) {
  const ref = useModal()
  return (
    <dialog
      ref={ref}
      aria-labelledby="appeal-sent-title"
      data-testid="appeal-sent"
      onClose={onClose}
      className="fixed inset-0 m-auto w-[calc(100vw-2rem)] max-w-246 overflow-hidden rounded-3xl bg-white p-0 text-center text-ink shadow-[0_24px_60px_rgba(50,16,7,0.2)] backdrop:bg-ink/40 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:bg-ground"
    >
      <div className="relative px-6 pt-7 pb-28 max-sm:pt-34 max-sm:pb-8">
        <img src={successArt} alt="" width={326} height={227} className="mx-auto h-auto w-64" />
        <h2
          id="appeal-sent-title"
          className="relative -mt-6 font-display text-[40px] leading-tight font-bold text-[#237a5c] max-sm:text-[28px]"
        >
          ยื่นอุทธรณ์สำเร็จแล้ว
        </h2>
        <p className="mt-1 text-[16px] leading-6 text-ink-2">
          อาจารย์จะตอบกลับภายใน 7 วัน ·<br />
          คะแนนยังเป็นค่าเดิมจนกว่าอาจารย์จะตัดสิน
        </p>
        <div className="relative z-10 mt-2 flex justify-center gap-3 max-sm:mt-5 max-sm:flex-col">
          <Link
            to={back}
            className={btn(
              'ghost',
              'md',
              'border-brand-600 px-6 text-accent-ink max-sm:order-1 max-sm:min-h-12 max-sm:border-cta max-sm:bg-cta max-sm:text-white',
            )}
          >
            ไปหน้าดูคะแนน
          </Link>
          <Link
            to={`/classrooms/${classroomId}`}
            className={btn(
              'primary',
              'md',
              'px-6 max-sm:order-2 max-sm:min-h-12 max-sm:border max-sm:border-line-neutral max-sm:bg-white max-sm:text-ink',
            )}
          >
            ไปหน้าห้องเรียน
          </Link>
        </div>
        <svg
          aria-hidden="true"
          viewBox="0 0 986 92"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-23 w-full max-sm:hidden"
        >
          <defs>
            <linearGradient id="appeal-wave" x1="0" x2="1">
              <stop offset="0" stopColor="#ff7d3d" />
              <stop offset="0.5" stopColor="#ffd67d" />
              <stop offset="1" stopColor="#ff7a38" />
            </linearGradient>
          </defs>
          <path d="M0 0c180 18 330 28 520 18S860 4 986 46v46H0z" fill="url(#appeal-wave)" />
        </svg>
      </div>
    </dialog>
  )
}
