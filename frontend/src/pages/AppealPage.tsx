import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import appealIllustration from '../assets/figma/appeal.png'
import { AppNav } from '../components/AppNav'
import { IconBack } from '../components/icons'
import { Banner, Card, CTRL, FOCUS, btn } from '../components/Ui'
import { ApiError, type Appeal, type MyScore, createAppeal, getMyScore, listAppeals } from '../lib/api'

const statusText = { OPEN: 'รอผู้สอนพิจารณา', RESOLVED: 'พิจารณาแล้ว', REJECTED: 'ไม่อนุมัติคำร้อง' }

export default function AppealPage() {
  const { classroomId = '', assignmentId = '' } = useParams()
  const [score, setScore] = useState<MyScore | null>(null)
  const [appeal, setAppeal] = useState<Appeal | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    let active = true
    void Promise.all([getMyScore(assignmentId), listAppeals(classroomId)]).then(([result, requests]) => {
      if (active) { setScore(result); setAppeal(requests.items.find((item) => item.assignmentId === assignmentId) ?? null) }
    }).catch((err) => { if (active) setError(err instanceof ApiError ? err.message : 'โหลดคำร้องไม่สำเร็จ') })
      .finally(() => { if (active) setLoaded(true) })
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { active = false; window.clearInterval(timer) }
  }, [classroomId, assignmentId])
  const end = score?.finalizedAt ? new Date(score.finalizedAt).getTime() + 7 * 86400000 : 0
  const remaining = Math.max(0, end - now)
  const eligible = Boolean(score?.finalized && remaining > 0)
  const invalid = message.length > 0 && message.trim().length < 30
  const back = `/classrooms/${classroomId}/assignments/${assignmentId}/score`
  return <div className="min-h-screen bg-ground text-ink">
    <AppNav context="ยื่นอุทธรณ์คะแนน" contextTo={back} classroomId={classroomId} />
    <main className="mx-auto max-w-2xl px-4 pt-6 pb-32 sm:pt-10">
      <div className="mb-4 flex items-start gap-3"><Link to={back} aria-label="กลับหน้าคะแนน" className={`grid size-11 shrink-0 place-items-center rounded ${FOCUS}`}><IconBack className="size-10" /></Link><div><h1 className="font-display text-2xl font-bold">ยื่นอุทธรณ์คะแนน</h1><p className="mt-2 text-sm text-accent-ink">ยื่นได้ภายใน 7 วันหลังประกาศผล{eligible && ` — เหลืออีก ${Math.floor(remaining / 86400000)} วัน ${Math.floor(remaining / 3600000) % 24} ชั่วโมง`}</p></div></div>
      {error && <Banner tone="err" role="alert" className="mb-4">{error}</Banner>}
      {!loaded && <p role="status">กำลังโหลดคำร้อง…</p>}
      {score?.finalized && !appeal && <Card radius="md" shadow={false} className="mb-3 p-4"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">คะแนนรวม</h2><span className="font-mono text-accent-ink">{score.finalScore === null ? 'ซ่อนไว้ตามเกณฑ์ความเป็นส่วนตัว' : Number(score.finalScore).toFixed(2)}</span></div><dl className="mt-3 space-y-2 text-xs text-ink-2">{[['คะแนนกลุ่ม', score.groupComponent], ['คะแนนรายบุคคล', score.individualHidden ? null : score.individualComponent], ['ตัวคูณการมีส่วนร่วม', score.participationMultiplier]].map(([label, value]) => <div key={String(label)} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-mono">{value === null ? 'ซ่อนไว้' : Number(value).toFixed(3)}</dd></div>)}</dl><Link to={back} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent-ink">ดูรายละเอียดเกณฑ์ ›</Link></Card>}
      {appeal ? <Card radius="md" shadow={false} className="p-5">{appeal.status === 'OPEN' && <div className="mb-5 text-center"><img src={appealIllustration} alt="" width={240} height={180} className="mx-auto" /><p className="mt-4 font-display text-xl font-bold text-ok-700">ส่งคำร้องอุทธรณ์แล้ว</p><p className="mt-3 text-sm leading-6 text-muted">ผู้สอนจะตรวจสอบและตอบกลับในระบบ</p><div className="mt-5 flex flex-wrap justify-center gap-3"><Link to={back} className={btn('primary')}>ไปหน้าคะแนน</Link><Link to={`/classrooms/${classroomId}`} className={btn('ghost')}>ไปหน้าห้องเรียน</Link></div></div>}<h2 className="font-display text-lg font-bold">{statusText[appeal.status]}</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{appeal.message}</p><p className="mt-3 text-xs text-muted">ยื่นเมื่อ {new Date(appeal.createdAt).toLocaleString('th-TH')}</p>{appeal.resolution && <div className="mt-5 rounded-xl bg-sand p-4"><h3 className="font-semibold">คำตอบจากผู้สอน</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{appeal.resolution}</p></div>}</Card> : loaded && eligible ? <form onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(null); void createAppeal(assignmentId, message.trim()).then(setAppeal).catch((err) => setError(err instanceof ApiError ? err.message : 'ส่งคำร้องไม่สำเร็จ')).finally(() => setBusy(false)) }}>
        <Card radius="md" shadow={false} className="p-4"><label htmlFor="appeal-reason" className="font-display text-lg font-bold">เหตุผลในการอุทธรณ์</label><p id="appeal-hint" className="mt-2 text-sm leading-6 text-muted">อธิบายให้ชัดเจนว่าคะแนนส่วนไหนที่คิดว่าไม่ถูกต้อง และเพราะอะไร</p><textarea id="appeal-reason" value={message} onChange={(event) => setMessage(event.target.value)} minLength={30} maxLength={5000} required disabled={busy} aria-invalid={invalid} aria-describedby="appeal-hint appeal-count" className={`${CTRL} mt-3 min-h-40 resize-y`} /><p id="appeal-count" className={`mt-2 text-xs ${invalid ? 'text-err' : 'text-muted'}`}>กรุณาระบุเหตุผลอย่างน้อย 30 ตัวอักษร (ตอนนี้ {message.trim().length} ตัวอักษร)</p></Card>
        <p className="mt-3 text-xs leading-5 text-muted">คำร้องจะถูกส่งถึงผู้สอนเท่านั้น และบันทึกลงประวัติ · ยื่นได้ 1 ครั้งต่องาน</p>
        <div className="fixed inset-x-0 bottom-0 border-t border-edge bg-white px-4 py-3"><div className="mx-auto flex max-w-2xl gap-3"><Link to={back} className={btn('ghost', 'md', 'flex-1')}>ยกเลิก</Link><button type="submit" disabled={busy || message.trim().length < 30} className={btn('primary', 'md', 'flex-1')}>{busy ? 'กำลังส่ง…' : 'ยืนยันคำร้อง'}</button></div></div>
      </form> : loaded && !error && <Banner tone="info">{score?.finalized ? 'พ้นระยะเวลายื่นอุทธรณ์ 7 วันแล้ว' : 'ยังไม่เปิดรับอุทธรณ์ รอประกาศผลคะแนนก่อน'}</Banner>}
    </main>
  </div>
}
