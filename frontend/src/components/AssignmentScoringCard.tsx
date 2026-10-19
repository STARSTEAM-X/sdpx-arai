import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Banner, Pill, Spinner, btn } from './Ui'
import { FinalizeDialog, IdentifiedExportDialog, ReopenDialog } from './ScoringDialogs'
import { useMenu } from './useMenu'
import {
  ApiError,
  type AssignmentSummary,
  exportComparisons,
  exportComparisonsIdentified,
  finalizeAssignment,
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

/** แถวควบคุมของงานประเมินหนึ่งชิ้น — คำนวณระหว่างทาง / ประกาศผล / เปิดกลับมาแก้ (US-13) */
function AssignmentRow({
  item,
  classroomId,
  busy,
  onRecompute,
  onFinalize,
  onReopen,
  readOnly = false,
}: {
  item: AssignmentSummary
  classroomId: string
  busy: Busy
  onRecompute: (id: string) => void
  onFinalize: (id: string) => void
  onReopen: (id: string) => void
  readOnly?: boolean
}) {
  const isBusy = busy?.id === item.id
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const deadlinePassed =
    Math.max(
      new Date(item.groupDeadlineUtc).getTime(),
      new Date(item.individualDeadlineUtc ?? item.groupDeadlineUtc).getTime(),
    ) <= now
  const canFinalize = ['PUBLISHED', 'OPEN', 'CLOSED'].includes(item.status)
  const [exporting, setExporting] = useState<'plain' | 'identified' | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const [confirmIdentified, setConfirmIdentified] = useState(false)
  const { open: exportMenuOpen, setOpen: setExportMenuOpen, rootRef, triggerRef, onKeyDown } = useMenu()

  const workflowHint =
    item.status === 'FINALIZED'
      ? 'นักศึกษาเห็นคะแนนแล้ว'
      : deadlinePassed
        ? 'เลยกำหนดส่งแล้ว พร้อมตรวจและประกาศผล'
        : 'ยังไม่ถึงกำหนดส่ง คำนวณคะแนนชั่วคราวได้'

  async function handleExport() {
    setExportMenuOpen(false)
    setExporting('plain')
    setExportError(null)
    setExportNotice(null)
    try {
      await exportComparisons(item.id)
      setExportNotice('เริ่มดาวน์โหลดไฟล์แล้ว · ผู้ประเมินเป็นรหัสแทนชื่อ')
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'ส่งออกไม่สำเร็จ')
    } finally {
      setExporting(null)
    }
  }

  function handleExportIdentified() {
    setExportMenuOpen(false)
    // เปิดเผยตัวตนผู้ประเมิน — ต้องระบุเหตุผลเสมอ (ยืนยันเจตนาตาม FR-EXPORT-04) · Figma J37
    setConfirmIdentified(true)
  }

  async function exportIdentified(reason: string) {
    setExporting('identified')
    setExportError(null)
    setExportNotice(null)
    try {
      await exportComparisonsIdentified(item.id, reason)
      setExportNotice('เริ่มดาวน์โหลดไฟล์แล้ว · ไฟล์นี้มีอีเมลจริงของผู้ประเมิน · บันทึก audit แล้ว')
    } finally {
      setExporting(null)
    }
  }

  return (
    <li className="rounded-3xl border border-edge bg-white p-5 shadow-[0_8px_30px_-24px_rgba(101,73,63,0.24)]">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[18px] font-semibold leading-7">{item.name}</h3>
          <p className="mt-1 flex items-center gap-2 text-xs leading-5 text-muted">
            <span
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full ${item.status === 'FINALIZED' ? 'bg-ok-700' : deadlinePassed ? 'bg-brand-600' : 'bg-muted'}`}
            />
            {workflowHint}
          </p>
        </div>
        <Pill
          tone={item.status === 'FINALIZED' ? 'ok' : deadlinePassed ? 'brand' : 'neutral'}
          className="ml-auto shrink-0"
        >
          {STATUS_LABEL[item.status]}
        </Pill>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-edge pt-4">
        {!readOnly && canFinalize ? (
          <>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => onRecompute(item.id)}
              className={btn('ghost', 'md', 'border-brand-600 px-4 text-accent-ink')}
            >
              {isBusy && busy?.kind === 'recompute' && <Spinner className="size-3.5" />}
              คำนวณคะแนนชั่วคราว
            </button>
            <button
              type="button"
              disabled={busy !== null || !deadlinePassed}
              title={deadlinePassed ? undefined : 'ยังไม่ถึงกำหนดส่ง — ประกาศผลได้หลัง deadline ผ่านแล้ว'}
              onClick={() => onFinalize(item.id)}
              className={btn('primary', 'md', 'px-4')}
            >
              {isBusy && busy?.kind === 'finalize' && <Spinner className="size-3.5" />}
              ประกาศผลคะแนน
            </button>
          </>
        ) : !readOnly && item.status === 'FINALIZED' ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => onReopen(item.id)}
            className={btn('ghost', 'md', 'border-brand-600 px-4 text-err')}
          >
            {isBusy && busy?.kind === 'reopen' && <Spinner className="size-3.5" />}
            เปิดผลใหม่
          </button>
        ) : null}

        {/* Figma J25 — รายงานคะแนนเป็นหน้าแยก */}
        <Link
          to={`/classrooms/${classroomId}/assignments/${item.id}/report`}
          className={btn('ghost', 'md', 'border-brand-600 px-4 text-accent-ink')}
        >
          ดูรายงานคะแนน
        </Link>

        <div ref={rootRef} onKeyDown={onKeyDown} className="relative ml-auto">
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={exportMenuOpen}
            aria-haspopup="menu"
            disabled={exporting !== null}
            onClick={() => setExportMenuOpen((open) => !open)}
            className={btn('ghost', 'md', 'border-brand-600 px-4 text-accent-ink')}
          >
            {exporting && <Spinner className="size-3.5" />}
            ส่งออก
          </button>

          {exportMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-edge bg-white p-2 shadow-[0_14px_36px_-12px_rgba(23,32,51,0.3)]"
            >
              <Link
                role="menuitem"
                to={`/classrooms/${classroomId}/assignments/${item.id}/export`}
                className="block w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-sand"
              >
                <span className="block font-display font-semibold">ส่งออกรายงาน (XLSX / CSV)</span>
                <span className="mt-0.5 block text-xs text-muted">เลือกรายงาน รูปแบบไฟล์ และดูประวัติการส่งออก</span>
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleExport()}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-sand"
              >
                <span className="block font-display font-semibold">ส่งออก CSV</span>
                <span className="mt-0.5 block text-xs text-muted">ไม่เปิดเผยตัวตนผู้ประเมิน</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleExportIdentified}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-sand"
              >
                <span className="block font-display font-semibold">ส่งออกพร้อมตัวตนจริง</span>
                <span className="mt-0.5 block text-xs text-muted">ต้องระบุเหตุผลและบันทึกใน audit log</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {exportError && (
        <Banner tone="err" data-testid="export-error" className="mt-3 w-full">
          {exportError}
        </Banner>
      )}
      {exportNotice && (
        <Banner tone="ok" data-testid="export-notice" role="status" className="mt-3 w-full">
          {exportNotice}
        </Banner>
      )}
      {confirmIdentified && (
        <IdentifiedExportDialog onClose={() => setConfirmIdentified(false)} onConfirm={exportIdentified} />
      )}
    </li>
  )
}

/** ควบคุมการคำนวณ/ประกาศ/เปิดกลับคะแนน — เฉพาะ OWNER (FINALIZE_SCORES) ตาม role matrix
 *
 *  แยกจาก AssignmentPanel เพราะคนละช่วงเวลาของ workflow: อันนั้นสร้างและ publish งาน
 *  ส่วนนี้ทำงานหลัง publish ไปแล้วและอาศัยรายการ assignment ทั้งหมดของห้อง ไม่ใช่แค่ตัวที่เพิ่งสร้าง
 */
export function AssignmentScoringCard({
  classroomId,
  version = 0,
  readOnly = false,
}: {
  classroomId: string
  version?: number
  readOnly?: boolean
}) {
  const [items, setItems] = useState<AssignmentSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  // เปลี่ยนทุกครั้งที่คะแนนอาจขยับ (recompute/finalize/reopen สำเร็จ) — ใช้บังคับให้แถวที่กาง
  // ตารางคะแนนไว้ mount ใหม่ (เห็นได้จาก key ด้านล่าง) ไม่งั้นจะค้างแสดงตัวเลขเก่าที่ไม่ตรงแล้ว
  const [scoreVersion, setScoreVersion] = useState(0)
  const [finalizing, setFinalizing] = useState<AssignmentSummary | null>(null)
  const [reopening, setReopening] = useState<AssignmentSummary | null>(null)

  const refresh = () => {
    listClassroomAssignments(classroomId)
      .then((res) => setItems(res.items.filter((a) => a.status !== 'DRAFT')))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'โหลดรายการงานประเมินไม่สำเร็จ')
      })
      .finally(() => setLoaded(true))
  }

  useEffect(refresh, [classroomId, version])

  async function handleRecompute(id: string) {
    setBusy({ id, kind: 'recompute' })
    setError(null)
    setNotice(null)
    try {
      const r = await recomputeScores(id)
      // Figma S02 — บอกเวลาอัปเดตและย้ำว่าคะแนนที่แก้ด้วยมือยังอยู่
      const at = new Date(r.computedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      setNotice(
        `คำนวณคะแนนชั่วคราวใหม่แล้ว · อัปเดตล่าสุด ${at} น. · ` +
          (r.hasLowConfidenceItems
            ? 'มีบาง item ที่ผู้ประเมินยังไม่ถึงเกณฑ์ขั้นต่ำ'
            : 'ทุก item มีผู้ประเมินครบเกณฑ์') +
          ' · คะแนนที่อาจารย์แก้ด้วยมือยังคงอยู่',
      )
      setScoreVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'คำนวณคะแนนไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  /** Figma J31 — ยืนยันในกล่องก่อนประกาศ · คืนข้อความเตือนถ้า server ขอให้ยืนยันเรื่องข้อมูลน้อย */
  async function finalize(id: string, confirmLowConfidence: boolean): Promise<string | null> {
    setBusy({ id, kind: 'finalize' })
    setError(null)
    setNotice(null)
    try {
      await finalizeAssignment(id, confirmLowConfidence)
      setNotice(confirmLowConfidence ? 'ประกาศผลคะแนนแล้ว (ยืนยันแม้มี item ความเชื่อมั่นต่ำ)' : 'ประกาศผลคะแนนแล้ว')
      setScoreVersion((v) => v + 1)
      refresh()
      return null
    } catch (err) {
      // AC: มี item ติด LOW_CONFIDENCE ต้องยืนยันก่อน — ถามในกล่องเดิม ไม่ใช่ปฏิเสธเงียบ ๆ
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED' && err.field === 'confirmLowConfidence')
        return err.message
      throw err
    } finally {
      setBusy(null)
    }
  }

  /** Figma J31e — เปิดผลใหม่ต้องมีเหตุผล (บันทึก audit) */
  async function reopen(id: string, reason: string) {
    setBusy({ id, kind: 'reopen' })
    setError(null)
    setNotice(null)
    try {
      await reopenAssignment(id, reason)
      setNotice('เปิดผลคะแนนใหม่แล้ว — คะแนนกลับเป็นชั่วคราว นักศึกษาจะไม่เห็นจนกว่าจะประกาศอีกครั้ง')
      setScoreVersion((v) => v + 1)
      refresh()
    } finally {
      setBusy(null)
    }
  }

  if (loaded && items.length === 0 && !error) return null

  return (
    <section data-testid="assignment-scoring-card" aria-label="คำนวณและประกาศคะแนน">
      <div className="flex flex-col gap-3">
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

        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <AssignmentRow
              key={`${item.id}-${scoreVersion}`}
              item={item}
              classroomId={classroomId}
              busy={busy}
              onRecompute={(id) => void handleRecompute(id)}
              onFinalize={() => setFinalizing(item)}
              onReopen={() => setReopening(item)}
              readOnly={readOnly}
            />
          ))}
        </ul>
      </div>
      {finalizing && (
        <FinalizeDialog
          name={finalizing.name}
          assignmentId={finalizing.id}
          studentCount={finalizing.studentCount ?? null}
          onClose={() => setFinalizing(null)}
          onConfirm={(confirmLowConfidence) => finalize(finalizing.id, confirmLowConfidence)}
        />
      )}
      {reopening && (
        <ReopenDialog
          name={reopening.name}
          finalizedLabel={null}
          onClose={() => setReopening(null)}
          onConfirm={(reason) => reopen(reopening.id, reason)}
        />
      )}
    </section>
  )
}
