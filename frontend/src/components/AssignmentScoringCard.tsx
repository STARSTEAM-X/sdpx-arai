import { useEffect, useState } from 'react'

import { Banner, Card, CardHead, Pill, Spinner, btn } from './Ui'
import { IconLock, IconTransparentScore } from './icons'
import {
  ApiError,
  type AssignmentSummary,
  type Scores,
  finalizeAssignment,
  getScores,
  listClassroomAssignments,
  recomputeScores,
  reopenAssignment,
} from '../lib/api'

const STATUS_LABEL: Record<AssignmentSummary['status'], string> = {
  DRAFT: 'ฉบับร่าง',
  PUBLISHED: 'เผยแพร่แล้ว',
  OPEN: 'เปิดให้ประเมิน',
  CLOSED: 'ปิดรับแล้ว',
  FINALIZED: 'ประกาศผลแล้ว',
  ARCHIVED: 'เก็บเข้าคลัง',
}

type Busy = { id: string; kind: 'recompute' | 'finalize' | 'reopen' } | null

/** ตารางคะแนนที่คำนวณล่าสุดของ item หนึ่งงาน — ติด label "ชั่วคราว" ตาม isFinal ที่ backend ตอบมา
 *  ตาม AC ของ US-13 ("คะแนนที่ยังไม่ finalize ต้องมี label กำกับเสมอไม่ว่าจะแสดงที่ไหน") */
function ScoresPanel({ scores }: { scores: Scores }) {
  return (
    <div className="mt-3 w-full rounded-xl border border-edge bg-sand p-4">
      <div className="mb-3 flex items-center gap-2">
        <Pill tone={scores.isFinal ? 'ok' : 'warn'} data-testid="scores-final-flag">
          {scores.isFinal ? 'คะแนนสุดท้าย' : 'ชั่วคราว — อาจเปลี่ยนแปลงได้'}
        </Pill>
      </div>
      {scores.items.length === 0 ? (
        <p className="text-sm text-muted">ยังไม่มีคะแนนที่คำนวณไว้ — กด "คำนวณคะแนนชั่วคราว" ก่อน</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {scores.items.map((s) => (
            <li
              key={`${s.side}-${s.itemId}`}
              className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm"
            >
              <span className="font-medium">{s.itemLabel}</span>
              <span className="text-[12px] text-muted">{s.side === 'GROUP' ? 'กลุ่ม' : 'บุคคล'}</span>
              {s.flags.includes('LOW_CONFIDENCE') && (
                <Pill tone="warn" className="text-[11px]">
                  ผู้ประเมินยังน้อย
                </Pill>
              )}
              <span className="ml-auto font-mono tabular">{s.component}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** แถวควบคุมของงานประเมินหนึ่งชิ้น — คำนวณระหว่างทาง / ประกาศผล / เปิดกลับมาแก้ (US-13) */
function AssignmentRow({
  item,
  busy,
  onRecompute,
  onFinalize,
  onReopen,
}: {
  item: AssignmentSummary
  busy: Busy
  onRecompute: (id: string) => void
  onFinalize: (id: string) => void
  onReopen: (id: string) => void
}) {
  const isBusy = busy?.id === item.id
  const deadlinePassed = new Date(item.groupDeadlineUtc) <= new Date()
  const canFinalize = ['PUBLISHED', 'OPEN', 'CLOSED'].includes(item.status)
  const [scores, setScores] = useState<Scores | null>(null)
  const [scoresError, setScoresError] = useState<string | null>(null)
  const [loadingScores, setLoadingScores] = useState(false)

  async function toggleScores() {
    if (scores) {
      setScores(null)
      return
    }
    setLoadingScores(true)
    setScoresError(null)
    try {
      setScores(await getScores(item.id))
    } catch (err) {
      setScoresError(err instanceof ApiError ? err.message : 'โหลดคะแนนไม่สำเร็จ')
    } finally {
      setLoadingScores(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-edge px-4 py-3">
      <span className="font-display font-medium">{item.name}</span>
      <Pill tone={item.status === 'FINALIZED' ? 'ok' : 'neutral'}>{STATUS_LABEL[item.status]}</Pill>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={loadingScores}
          onClick={() => void toggleScores()}
          className={btn('ghost', 'sm')}
        >
          {loadingScores && <Spinner className="size-3.5" />}
          {scores ? 'ซ่อนคะแนน' : 'ดูคะแนนที่คำนวณ'}
        </button>

        {canFinalize && (
          <>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => onRecompute(item.id)}
              className={btn('ghost', 'sm')}
            >
              {isBusy && busy?.kind === 'recompute' && <Spinner className="size-3.5" />}
              คำนวณคะแนนชั่วคราว
            </button>
            <button
              type="button"
              disabled={busy !== null || !deadlinePassed}
              title={deadlinePassed ? undefined : 'ยังไม่ถึงกำหนดส่ง — ประกาศผลได้หลัง deadline ผ่านแล้ว'}
              onClick={() => onFinalize(item.id)}
              className={btn('ok', 'sm')}
            >
              {isBusy && busy?.kind === 'finalize' && <Spinner className="size-3.5" />}
              ประกาศผลคะแนน
            </button>
          </>
        )}

        {item.status === 'FINALIZED' && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => onReopen(item.id)}
            className={btn('ghost', 'sm')}
          >
            {isBusy && busy?.kind === 'reopen' && <Spinner className="size-3.5" />}
            <IconLock className="size-3.5" />
            เปิดกลับมาแก้
          </button>
        )}
      </div>

      {scoresError && (
        <Banner tone="err" className="mt-3 w-full">
          {scoresError}
        </Banner>
      )}
      {scores && <ScoresPanel scores={scores} />}
    </li>
  )
}

/** ควบคุมการคำนวณ/ประกาศ/เปิดกลับคะแนน — เฉพาะ OWNER (FINALIZE_SCORES) ตาม role matrix
 *
 *  แยกจาก AssignmentPanel เพราะคนละช่วงเวลาของ workflow: อันนั้นสร้างและ publish งาน
 *  ส่วนนี้ทำงานหลัง publish ไปแล้วและอาศัยรายการ assignment ทั้งหมดของห้อง ไม่ใช่แค่ตัวที่เพิ่งสร้าง
 */
export function AssignmentScoringCard({ classroomId }: { classroomId: string }) {
  const [items, setItems] = useState<AssignmentSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  // เปลี่ยนทุกครั้งที่คะแนนอาจขยับ (recompute/finalize/reopen สำเร็จ) — ใช้บังคับให้แถวที่กาง
  // ตารางคะแนนไว้ mount ใหม่ (เห็นได้จาก key ด้านล่าง) ไม่งั้นจะค้างแสดงตัวเลขเก่าที่ไม่ตรงแล้ว
  const [scoreVersion, setScoreVersion] = useState(0)

  const refresh = () => {
    listClassroomAssignments(classroomId)
      .then((res) => setItems(res.items.filter((a) => a.status !== 'DRAFT')))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'โหลดรายการงานประเมินไม่สำเร็จ')
      })
      .finally(() => setLoaded(true))
  }

  useEffect(refresh, [classroomId])

  async function handleRecompute(id: string) {
    setBusy({ id, kind: 'recompute' })
    setError(null)
    setNotice(null)
    try {
      const r = await recomputeScores(id)
      setNotice(
        r.hasLowConfidenceItems
          ? 'คำนวณคะแนนชั่วคราวแล้ว — มีบาง item ที่ผู้ประเมินยังไม่ถึงเกณฑ์ขั้นต่ำ'
          : 'คำนวณคะแนนชั่วคราวแล้ว — ทุก item มีผู้ประเมินครบเกณฑ์',
      )
      setScoreVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'คำนวณคะแนนไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  async function handleFinalize(id: string) {
    setBusy({ id, kind: 'finalize' })
    setError(null)
    setNotice(null)
    try {
      await finalizeAssignment(id, false)
      setNotice('ประกาศผลคะแนนแล้ว')
      setScoreVersion((v) => v + 1)
      refresh()
    } catch (err) {
      // AC: มี item ติด LOW_CONFIDENCE ต้องยืนยันก่อน — ถามด้วย confirm ไม่ใช่ปฏิเสธเงียบ ๆ
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.field === 'confirmLowConfidence') {
        const ok = window.confirm(
          `${err.message} — ต้องการยืนยันและประกาศผลต่อไปเลยไหม? คะแนนของ item ที่มีผู้ประเมินน้อยจะยังคำนวณและแสดง แต่ทำเครื่องหมายไว้ว่าความเชื่อมั่นต่ำ`,
        )
        if (ok) {
          try {
            await finalizeAssignment(id, true)
            setNotice('ประกาศผลคะแนนแล้ว (ยืนยันแม้มี item ความเชื่อมั่นต่ำ)')
            setScoreVersion((v) => v + 1)
            refresh()
          } catch (err2) {
            setError(err2 instanceof ApiError ? err2.message : 'ประกาศผลไม่สำเร็จ')
          }
        }
      } else {
        setError(err instanceof ApiError ? err.message : 'ประกาศผลไม่สำเร็จ')
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleReopen(id: string) {
    const reason = window.prompt('ระบุเหตุผลที่ต้องเปิดคะแนนกลับมาแก้ (บันทึกไว้ใน audit log):')
    if (reason === null) return
    if (!reason.trim()) {
      setError('ต้องระบุเหตุผลก่อน reopen')
      return
    }

    setBusy({ id, kind: 'reopen' })
    setError(null)
    setNotice(null)
    try {
      await reopenAssignment(id, reason)
      setNotice('เปิดคะแนนกลับมาแก้แล้ว — สถานะกลับเป็นปิดรับ')
      setScoreVersion((v) => v + 1)
      refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'เปิดกลับมาแก้ไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  if (loaded && items.length === 0 && !error) return null

  return (
    <Card data-testid="assignment-scoring-card">
      <CardHead
        id="h-scoring"
        icon={<IconTransparentScore className="size-5" />}
        title="คำนวณและประกาศคะแนน"
        hint="คำนวณระหว่างทางได้เสมอ ประกาศผลจริงได้หลังเลยกำหนดส่ง"
      />

      <div className="flex flex-col gap-3 p-6 max-sm:p-4">
        {error && (
          <Banner tone="err" data-testid="scoring-error" role="alert">
            {error}
          </Banner>
        )}
        {notice && (
          <Banner tone="ok" data-testid="scoring-notice" role="status">
            {notice}
          </Banner>
        )}

        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <AssignmentRow
              key={`${item.id}-${scoreVersion}`}
              item={item}
              busy={busy}
              onRecompute={(id) => void handleRecompute(id)}
              onFinalize={(id) => void handleFinalize(id)}
              onReopen={(id) => void handleReopen(id)}
            />
          ))}
        </ul>
      </div>
    </Card>
  )
}
