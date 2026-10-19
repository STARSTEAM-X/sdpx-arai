import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppNav } from '../components/AppNav'
import { IconBack } from '../components/icons'
import { CoverageActions } from '../components/CoverageActions'
import { Banner, Card, CTRL, FOCUS, Pill, btn } from '../components/Ui'
import { ApiError, type Assignment, type QualityReport, type Reviewer, getAssignment, getMe, getQuality, listClassrooms, revealReviewer, setReviewerExclusion } from '../lib/api'
import { COMPARISON_SCALE } from '../lib/scale'
import reportHeading from '../assets/figma/owner-report-heading.png'

const signalLabels: Record<string, string> = { 'QS-01': 'คำตอบยังน้อย', 'QS-02': 'เลือกค่าเดิมซ้ำ', 'QS-03': 'เลือกข้างเดียวบ่อย', 'QS-04': 'คำตอบเป็นวง', 'QS-05': 'เวลาเฉลี่ยต่ำ' }

export default function QualityPage() {
  const { classroomId = '', assignmentId = '' } = useParams()
  const [data, setData] = useState<QualityReport | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [owner, setOwner] = useState(false)
  const [archived, setArchived] = useState(false)
  const [view, setView] = useState('signals')
  const [filter, setFilter] = useState('ALL')
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selected, setSelected] = useState<Reviewer | null>(null)
  const [mode, setMode] = useState<'answers' | 'identity' | 'exclusion'>('answers')
  const [identity, setIdentity] = useState<{ displayName: string | null; email: string } | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const refresh = useCallback(async () => {
    try {
      const [report, job, profile, rooms] = await Promise.all([getQuality(assignmentId), getAssignment(assignmentId), getMe(), listClassrooms()])
      if (job.classroomId !== classroomId) throw new Error('ไม่พบงานนี้ในห้องเรียน')
      setData(report); setAssignment(job); setOwner(profile.classrooms.find((room) => room.classroomId === classroomId)?.role === 'OWNER')
      setArchived(rooms.items.find((room) => room.id === classroomId)?.status === 'ARCHIVED'); setError(null)
      return true
    } catch (err) { setError(err instanceof Error ? err.message : 'โหลดรายงานไม่สำเร็จ'); return false }
  }, [assignmentId, classroomId])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { if (selected && !dialog.current?.open) dialog.current?.showModal() }, [selected])
  function close() { dialog.current?.close(); setSelected(null); setIdentity(null); trigger.current?.focus() }
  async function act() {
    if (!selected) return
    setBusy(true); setActionError(null)
    try {
      if (mode === 'identity') setIdentity(await revealReviewer(assignmentId, selected.key, reason.trim()))
      else {
        await setReviewerExclusion(assignmentId, selected.key, !selected.excluded, reason.trim())
        const loaded = await refresh()
        setNotice(`${selected.excluded ? 'คืนคำตอบ' : 'ตัดคำตอบจากการคำนวณ'}แล้ว คะแนนชั่วคราวคำนวณใหม่ โดยเก็บคำตอบและการมีส่วนร่วมไว้${loaded ? '' : ' · โหลดรายงานใหม่ไม่สำเร็จ กรุณาลองใหม่'}`)
        close()
      }
    } catch (err) { setActionError(err instanceof ApiError ? err.message : 'ทำรายการไม่สำเร็จ') }
    finally { setBusy(false) }
  }
  const writable = !archived && assignment && ['PUBLISHED', 'OPEN', 'CLOSED'].includes(assignment.status)
  const visible = data?.evaluators.filter((item) => filter === 'ALL' || (filter === 'EXCLUDED' ? item.excluded : item.flags.length > 0)) ?? []
  return <div className="min-h-screen bg-ground text-ink"><AppNav context="รายงานคุณภาพ" contextTo={`/classrooms/${classroomId}#assignments`} classroomId={classroomId} />
    <main className="mx-auto max-w-304 px-4 pt-8 pb-16 sm:px-7">
      <div className="mb-8 flex items-center gap-3"><Link to={`/classrooms/${classroomId}#assignments`} aria-label="กลับหน้าห้องเรียน" className={`grid size-11 shrink-0 place-items-center rounded ${FOCUS}`}><IconBack className="size-10" /></Link><div className="min-w-0 flex-1"><h1 className="font-display text-2xl font-bold sm:text-3xl">รายงานคุณภาพการประเมิน</h1><p className="mt-3 text-sm text-muted">{assignment?.name} · สัญญาณไว้ช่วยทบทวน ไม่มีการตัดคะแนนอัตโนมัติ</p></div><img src={reportHeading} alt="" width={220} height={165} className="hidden shrink-0 sm:block sm:w-40 lg:w-55" /></div>
      {error && <Banner tone="err" role="alert" className="mb-5">{error}<button onClick={() => void refresh()} className={btn('ghost', 'sm', 'ml-3')}>ลองใหม่</button></Banner>}
      {notice && <Banner tone="info" role="status" className="mb-5">{notice}</Banner>}
      {!data && !error && <p role="status">กำลังโหลดรายงาน…</p>}
      {data && <><div role="group" aria-label="เลือกรายงาน" className="mb-5 flex flex-wrap gap-2"><button aria-pressed={view === 'signals'} onClick={() => setView('signals')} className={btn(view === 'signals' ? 'primary' : 'ghost', 'sm')}>คุณภาพการประเมิน</button><button aria-pressed={view === 'coverage'} onClick={() => setView('coverage')} className={btn(view === 'coverage' ? 'primary' : 'ghost', 'sm')}>ความครอบคลุมรายรายการ</button><button onClick={() => void refresh()} className={btn('ghost', 'sm')}>รีเฟรช</button></div>
        {view === 'signals' ? <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 bg-sand p-5"><h2 className="font-display text-lg font-bold">สัญญาณคุณภาพ</h2><div className="flex flex-wrap gap-2">{[['ALL', 'ทั้งหมด'], ['FLAGGED', 'ต้องตรวจ'], ['EXCLUDED', 'ตัดคำตอบแล้ว']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={btn(filter === value ? 'primary' : 'ghost', 'sm')}>{label}</button>)}</div></div>
          <div className="overflow-x-auto" role="region" aria-label="ตารางสัญญาณคุณภาพ" tabIndex={0}><table className="w-full min-w-160 text-left text-sm"><caption className="sr-only">รายงานผู้ประเมินแบบไม่แสดงตัวตน</caption><thead className="border-y border-edge bg-white"><tr>{['ผู้ประเมิน', 'สัญญาณ', 'ส่งแล้ว', 'เวลาเฉลี่ย', 'สถานะ', 'รายละเอียด'].map((label) => <th key={label} className="px-5 py-4">{label}</th>)}</tr></thead><tbody>{visible.map((item) => <tr key={item.key} className="border-b border-edge"><th scope="row" className="px-5 py-4 font-mono">{item.label}</th><td className="px-5 py-4">{item.flags.length ? item.flags.map((flag) => `${signalLabels[flag]} · ${flag}`).join(' / ') : item.submittedCount ? 'ไม่พบสัญญาณที่ตรวจได้' : 'ยังไม่มีคำตอบที่ส่ง'}{item.submittedCount > 0 && item.submittedCount < 3 && <p className="mt-1 text-xs text-muted">ข้อมูลยังน้อย กรุณาพิจารณาประกอบ</p>}</td><td className="px-5 py-4 font-mono">{item.submittedCount}/{item.assignedCount}</td><td className="px-5 py-4">{item.meanTimeMs === null ? 'ยังไม่มีข้อมูล' : `${(item.meanTimeMs / 1000).toFixed(1)} วินาที`}<p className="mt-1 text-xs text-muted">วัดได้ {item.timedCount} ข้อ</p></td><td className="px-5 py-4"><Pill tone={item.excluded ? 'neutral' : item.flags.length ? 'warn' : 'ok'}>{item.excluded ? 'ตัดจากการคำนวณ' : item.flags.length ? 'ต้องตรวจ' : 'รอทบทวน'}</Pill></td><td className="px-5 py-4"><button className={btn('ghost', 'sm')} onClick={(event) => { trigger.current = event.currentTarget; setSelected(item); setMode('answers'); setReason(''); setIdentity(null); setActionError(null) }}>ดูคำตอบ<span className="sr-only"> {item.label}</span></button></td></tr>)}</tbody></table></div>{!visible.length && <p className="p-6 text-sm text-muted">ไม่พบรายการตามตัวกรอง</p>}
        </Card> : <Card className="overflow-hidden"><h2 className="bg-sand p-5 font-display text-lg font-bold">จำนวนคำตอบต่อรายการและเกณฑ์</h2><div className="overflow-x-auto" role="region" aria-label="ตารางความครอบคลุม" tabIndex={0}><table className="w-full min-w-140 text-left text-sm"><caption className="sr-only">คำตอบที่ใช้คำนวณ ไม่รวมผู้ประเมินที่ถูกตัดคำตอบ</caption><thead><tr>{['รายการ', 'เกณฑ์', 'มอบหมาย', 'ส่งแล้ว / ขั้นต่ำ', 'สถานะ'].map((label) => <th key={label} className="px-5 py-4">{label}</th>)}</tr></thead><tbody>{data.coverage.map((item) => <tr key={`${item.criterionId}-${item.itemId}`} className="border-t border-edge"><th scope="row" className="px-5 py-4">{item.itemLabel}</th><td className="px-5 py-4">{item.criterionName}</td><td className="px-5 py-4 font-mono">{item.assignedCount}</td><td className="px-5 py-4 font-mono">{item.submittedCount} / {item.minimum}</td><td className="px-5 py-4"><Pill tone={item.flags.length ? 'warn' : 'ok'}>{item.flags.length ? 'QS-01 · คำตอบยังน้อย' : 'ครบขั้นต่ำ'}</Pill></td></tr>)}</tbody></table></div></Card>}
        {view === 'coverage' && assignment && <Card className="mt-5 overflow-hidden">
          <h2 className="bg-sand p-5 font-display text-lg font-bold">ความครอบคลุมรายคู่</h2>
          <div className="overflow-x-auto" role="region" aria-label="ตารางความครอบคลุมรายคู่" tabIndex={0}>
            <table className="w-full min-w-180 text-left text-sm">
              <caption className="sr-only">ส่งแล้วเทียบกับเป้าหมาย และการเพิ่มคำตอบโดยผู้สอน</caption>
              <thead><tr>{['คู่เปรียบเทียบ', 'เกณฑ์', 'ส่งแล้ว / เป้าหมาย', 'การดำเนินการ'].map((label) => <th key={label} className="px-5 py-4">{label}</th>)}</tr></thead>
              <tbody>{data.pairCoverage.map((pair) => <tr key={`${pair.criterionId}-${pair.itemAId}-${pair.itemBId}`} className="border-t border-edge">
                <th scope="row" className="px-5 py-4">{pair.itemALabel} / {pair.itemBLabel}</th>
                <td className="px-5 py-4">{pair.criterionName}</td>
                <td className="px-5 py-4"><Pill tone={pair.submittedCount < pair.expectedCount ? 'warn' : 'ok'}>{pair.submittedCount} / {pair.expectedCount}</Pill><p className="mt-2 text-xs text-muted">มอบหมายแล้ว {pair.assignedCount}</p></td>
                <td className="px-5 py-4"><CoverageActions pair={pair} assignmentId={assignmentId} canReview={Boolean(writable)} canAssign={Boolean(writable) && now < Date.parse(pair.side === 'GROUP' ? assignment.groupDeadlineUtc : assignment.individualDeadlineUtc ?? assignment.groupDeadlineUtc)} onChanged={refresh} /></td>
              </tr>)}</tbody>
            </table>
          </div>
          {!data.pairCoverage.length && <p className="p-5 text-sm text-muted">ยังไม่มีคู่ที่เปรียบเทียบได้จากสมาชิกปัจจุบัน</p>}
        </Card>}
        <details className="mt-5 rounded-2xl border border-edge bg-white p-5"><summary className="cursor-pointer font-semibold">วิธีอ่านสัญญาณและข้อจำกัดของข้อมูล</summary><ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-muted">{data.limitations.map((text) => <li key={text}>{text}</li>)}</ul></details>
      </>}
      <dialog ref={dialog} aria-label={`คำตอบของ ${selected?.label ?? 'ผู้ประเมิน'}`} onCancel={(event) => { event.preventDefault(); if (!busy) close() }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-auto rounded-3xl border border-edge bg-white p-6 text-ink shadow-xl backdrop:bg-ink/40">
        {selected && <><div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl font-bold">คำตอบของ {selected.label}</h2><button disabled={busy} onClick={close} aria-label="ปิดคำตอบ" className={btn('ghost', 'sm')}>×</button></div>
          {mode === 'answers' ? <><p className="mt-3 text-sm text-muted">ส่งแล้ว {selected.submittedCount}/{selected.assignedCount} ข้อ · ตรวจได้ {selected.checkedTriples} วงสามรายการ พบวงขัดกัน {selected.cycles} วง</p><ul className="mt-5 space-y-3">{selected.answers.map((answer, index) => <li key={index} className="rounded-xl bg-sand p-4 text-sm leading-6"><h3 className="font-semibold">{answer.criterionName}</h3><p>{answer.leftLabel} เทียบกับ {answer.rightLabel}</p><p className="mt-1 text-accent-ink">เลือก {answer.choice <= 3 ? answer.leftLabel : answer.rightLabel} · {COMPARISON_SCALE.find((choice) => choice.id === answer.choice)?.label.replace(/^(ซ้าย|ขวา)/, '')}</p></li>)}</ul>{!selected.answers.length && <p className="mt-5 text-sm text-muted">ยังไม่มีคำตอบที่ส่งแล้ว</p>}
            {owner && <div className="mt-5 flex flex-wrap justify-end gap-3"><button onClick={() => { setMode('identity'); setReason('') }} className={btn('ghost')}>ดูตัวตน</button>{writable && <button onClick={() => { setMode('exclusion'); setReason('') }} className={btn('primary')}>{selected.excluded ? 'คืนคำตอบเข้าคำนวณ' : 'ตัดคำตอบจากการคำนวณ'}</button>}</div>}
          </> : <><Banner tone="warn" className="mt-5">{mode === 'identity' ? 'เฉพาะเจ้าของห้อง การเปิดตัวตนต้องมีเหตุผลและบันทึกประวัติ' : 'การตัดหรือคืนคำตอบจะคำนวณคะแนนชั่วคราวใหม่ คำตอบต้นฉบับและการมีส่วนร่วมยังอยู่ครบ'}</Banner><label className="mt-4 block text-sm font-semibold">เหตุผลในการดำเนินการ<textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} disabled={busy} className={`${CTRL} mt-2 min-h-24`} /></label>{identity && <Banner tone="info" className="mt-4"><p className="break-all font-semibold">{identity.displayName ?? identity.email}</p><p className="break-all">{identity.email}</p><p className="mt-2 text-xs">บันทึกการเปิดตัวตนแล้ว</p></Banner>}{actionError && <Banner tone="err" role="alert" className="mt-4">{actionError}</Banner>}<div className="mt-5 flex justify-end gap-3"><button disabled={busy} onClick={() => { setMode('answers'); setIdentity(null); setActionError(null) }} className={btn('ghost')}>กลับ</button><button disabled={busy || !reason.trim() || Boolean(identity)} onClick={() => void act()} className={btn('primary')}>{busy ? 'กำลังบันทึก…' : mode === 'identity' ? 'ยืนยันดูตัวตน' : selected.excluded ? 'ยืนยันคืนคำตอบ' : 'ยืนยันตัดคำตอบ'}</button></div></>}
        </>}
      </dialog>
    </main></div>
}
