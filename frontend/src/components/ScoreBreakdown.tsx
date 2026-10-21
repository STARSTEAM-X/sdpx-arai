import { useState, type ReactNode } from 'react'

import noAssignments from '../assets/figma/no-assignments.png'
import { Card, Pill, btn } from './Ui'
import type { MyScore } from '../lib/api'
import { thaiDate } from '../lib/datetime'

export const number = (value: string | number | null | undefined, digits = 3) =>
  value === null || value === undefined ? '—' : Number(value).toLocaleString('th-TH', { maximumFractionDigits: digits })
export const scoreNumber = (value: string | number | null | undefined, digits = 3) =>
  value === null || value === undefined
    ? '—'
    : Number(value).toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits })

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
      {rows.length > 0 && (
        <ul className="space-y-2.5 px-6 pt-4.5 max-sm:space-y-2 max-sm:px-4 max-sm:pt-4">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start gap-3 text-[16px] max-sm:text-sm">
              <span className="min-w-0 flex-1 text-ink-2">{row.name}</span>
              <span className="text-xs text-muted">{number(row.weightPct)}%</span>
              <span className="font-mono tabular" title={`คะแนนเต็ม ${number(row.maxScore)}`}>
                {scoreNumber(row.score)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-6 pt-2.5 pb-5 max-sm:px-4 max-sm:py-4 ${muted ? 'bg-sand/40' : ''}`}
      >
        <p className="text-[15px] font-semibold max-sm:text-sm">รวม{label}</p>
        <div className="font-mono text-base tabular text-accent-ink">{value}</div>
      </div>
    </Card>
  )
}


/** "22 ต.ค. 2569" ตามรูปแบบใน Figma ST30 */

/** Figma ST32 · คะแนนรายบุคคลยังแสดงไม่ได้ (ข้อมูลไม่พอ) */
function IndividualHidden({
  score,
  groupName,
  onShowGroup,
}: {
  score: MyScore
  groupName: string | null
  onShowGroup?: () => void
}) {
  return (
    <div
      data-testid="individual-hidden"
      className="rounded-3xl border-2 border-dashed border-[#e88a4f] px-6 py-9 text-center"
    >
      <img src={noAssignments} alt="" width={220} height={150} className="mx-auto" />
      <p className="mt-4 font-display text-[19px] font-semibold">คะแนนรายบุคคลยังแสดงไม่ได้</p>
      <p className="mt-3 text-[15px] text-ink-2">
        {groupName ? `กลุ่ม ${groupName} ` : ''}มีผู้ประเมินรายบุคคล {score.individualEvaluatorCount ?? 0} คน ·
        ระบบแสดงคะแนนรายบุคคลเมื่อมีผู้ประเมินอย่างน้อย {score.minComparisons ?? 3} คน
        เพื่อไม่ให้เดาได้ว่าใครให้คะแนน · คะแนนกลุ่มดูได้ตามปกติ
      </p>
      {onShowGroup && (
        <button
          type="button"
          onClick={() => {
            onShowGroup()
            requestAnimationFrame(() => document.getElementById('group-score')?.scrollIntoView({ block: 'start' }))
          }}
          className={btn('ghost', 'md', 'mt-4 border-brand-600 px-6 text-accent-ink')}
        >
          ดูคะแนนกลุ่ม
        </button>
      )}
    </div>
  )
}

/** การ์ดคะแนนรวม + คะแนนกลุ่ม + รายบุคคล + การมีส่วนร่วม — ใช้ร่วมกันใน ST30 และ ST33 */
export function ScoreBreakdown({
  score,
  groupName,
  expanded,
  onExpand,
}: {
  score: MyScore
  groupName: string | null
  /** ควบคุมจากหน้าแม่ได้ (ST32 ซ่อนภาพหัวและปุ่มอุทธรณ์จนกว่าจะกดดูคะแนนกลุ่ม) */
  expanded?: boolean
  onExpand?: () => void
}) {
  const participationPercent = score.participationRatio
    ? Math.min(100, Math.max(0, Number(score.participationRatio) * 100))
    : 0
  // Figma ST32 — ข้อมูลรายบุคคลไม่พอ: แสดงเฉพาะคำอธิบายก่อน กด "ดูคะแนนกลุ่ม" จึงเห็นรายละเอียดทั้งหมด
  const [ownExpanded, setOwnExpanded] = useState(false)
  const showGroup = expanded ?? ownExpanded
  if (score.individualHidden && !showGroup)
    return <IndividualHidden score={score} groupName={groupName} onShowGroup={onExpand ?? (() => setOwnExpanded(true))} />
  return (
    <>
      <Card radius="md" className="px-6 py-[31px] text-center max-sm:px-4 max-sm:pt-4 max-sm:pb-2">
        <p className="font-display text-[22px] font-semibold max-sm:text-[16px] max-sm:leading-6">คะแนนรวม</p>
        <div className="mt-5 flex flex-wrap items-baseline justify-center gap-5 font-mono text-5xl leading-[62px] tabular max-sm:mt-3 max-sm:gap-2 max-sm:leading-11 text-brand-600 max-sm:text-[44px]">
          {score.finalScore !== null ? (
            <span data-testid="final-score">{scoreNumber(score.finalScore, 2)}</span>
          ) : (
            <Pill data-testid="final-score-hidden" tone="neutral" className="font-body">
              ยังแสดงไม่ได้
            </Pill>
          )}
          {score.groupMaxScore != null && score.individualMaxScore != null && (
            <span className="font-mono text-2xl text-ink-2">
              /{number(Number(score.groupMaxScore) + Number(score.individualMaxScore))}
            </span>
          )}
        </div>
        <p className="mt-5 text-[19px] leading-[30px] text-ink max-sm:mt-3 max-sm:text-[14px] max-sm:leading-[18px]">
          {/* FR-SCORE-07 — คะแนนที่ยังไม่ finalize ต้องมี label นี้ทุกที่ แม้คะแนนรวมยังถูกซ่อนอยู่ */}
          {score.provisional
            ? <span data-testid="score-provisional-flag">ชั่วคราว — อาจเปลี่ยนแปลงได้</span>
            : 'คะแนนสุดท้าย ประกาศผลแล้ว'}
          {score.finalizedAt && ` ${thaiDate(score.finalizedAt)}`}
          {score.finalScore === null && ' · คะแนนรวมจะแสดงเมื่อองค์ประกอบคะแนนครบเกณฑ์ความเป็นส่วนตัว'}
        </p>
      </Card>

      <div className="space-y-5 max-sm:space-y-3">
        <div className="space-y-5 max-sm:space-y-3">
          <div id="group-score" className="scroll-mt-24">
            <ScoreStep
              label="คะแนนกลุ่ม"
              value={
                <span>
                  <span data-testid="group-component">{scoreNumber(score.groupComponent)}</span>
                  {score.groupMaxScore != null && ` / ${number(score.groupMaxScore)}`}
                </span>
              }
              rows={score.criterionScores?.filter((row) => row.side === 'GROUP')}
              hint={
                score.groupOverridden
                  ? 'ผู้สอนปรับคะแนนรวมฝั่งกลุ่มแล้ว ผลรวมจึงอาจต่างจากคะแนนรายเกณฑ์ด้านบน'
                  : `${groupName ? `กลุ่ม ${groupName} · ` : ''}เต็ม ${number(score.groupMaxScore)} คะแนน · เท่ากันทุกคนในกลุ่ม`
              }
            />
          </div>

          {score.individualHidden ? (
            <IndividualHidden score={score} groupName={groupName} />
          ) : (
            <ScoreStep
              label="คะแนนรายบุคคล"
              value={
                <span>
                  <span data-testid="individual-component">{scoreNumber(score.individualComponent)}</span>
                  {score.individualMaxScore != null && ` / ${number(score.individualMaxScore)}`}
                </span>
              }
              rows={score.criterionScores?.filter((row) => row.side === 'INDIVIDUAL')}
              hint={
                score.individualOverridden
                  ? 'ผู้สอนปรับคะแนนรวมรายบุคคลแล้ว ผลรวมจึงอาจต่างจากคะแนนรายเกณฑ์ด้านบน'
                  : `เพื่อนร่วมกลุ่มประเมิน · เต็ม ${number(score.individualMaxScore)} คะแนน · ไม่เปิดเผยว่าใครเป็นผู้ประเมิน`
              }
            />
          )}
        </div>

        <Card radius="md">
          <div className="border-b border-edge px-5 py-5 max-sm:border-0 max-sm:px-4 max-sm:pt-4 max-sm:pb-0">
            <h2 className="font-display text-xl font-bold max-sm:text-base">การมีส่วนร่วมของฉัน</h2>
            <p className="mt-0.5 text-[14px] text-muted max-sm:hidden">นับจากจำนวนคู่ที่ส่งจริง เทียบกับที่ได้รับมอบหมาย</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-5 max-sm:px-4 max-sm:py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[16px] text-ink-2 max-sm:text-sm">ส่งแล้ว</p>
                <p className="font-mono text-sm tabular">
                  {score.submittedCount != null && `${score.submittedCount} / ${score.assignedCount} คู่ `}
                  <span data-testid="participation-ratio">(p = {scoreNumber(score.participationRatio, 2)})</span>
                </p>
              </div>
              <div
                role="progressbar"
                aria-label="สัดส่วนคู่ที่ตอบเทียบกับที่ได้รับมอบหมาย"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={participationPercent}
                className="mt-2.5 h-2 overflow-hidden rounded-full bg-edge"
              >
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${participationPercent}%` }} />
              </div>
              <p className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[16px] max-sm:text-sm">
                ตัวคูณการมีส่วนร่วม{' '}
                <span data-testid="participation-multiplier" className="font-mono text-accent-ink">
                  M = {scoreNumber(score.participationMultiplier, 2)}
                </span>
              </p>
              <p className="mt-2.5 text-[14px] leading-5 text-ink-2 max-sm:text-[13px]">
                {Number(score.participationRatio) >= 0.9 ? 'ถึงเกณฑ์ 90% แล้ว จึงได้คะแนนเต็มตามที่ประเมินได้ · ' : ''}
                ตัวคูณนี้มีผลเฉพาะคะแนนของตัวเอง ไม่ลดคะแนนของกลุ่ม
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
