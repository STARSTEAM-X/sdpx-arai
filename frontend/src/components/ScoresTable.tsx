import { useState } from 'react'

import { FOCUS, Pill } from './Ui'
import type { Scores } from '../lib/api'

/** ตารางคะแนนของงานหนึ่งชิ้น ตาม Figma J25 / J25b — กดแถวเพื่อกางรายละเอียดต่อเกณฑ์
 *  ติด label "ชั่วคราว" ตาม isFinal ที่ backend ตอบมา (AC ของ US-13) */
export function ScoresTable({ scores, side }: { scores: Scores; side: 'GROUP' | 'INDIVIDUAL' }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const rows = scores.items.filter((s) => s.side === side)
  // หัวคอลัมน์รายเกณฑ์จาก item แรกที่มีข้อมูล — ทุก item ในฝั่งเดียวกันใช้เกณฑ์ชุดเดียวกัน
  const columns = rows.find((s) => s.criteria?.length)?.criteria ?? []
  const maxTotal = columns.length ? Number(columns.reduce((sum, c) => sum + Number(c.maxScore), 0).toFixed(2)) : null
  return (
    <div className="overflow-hidden rounded-3xl border border-edge bg-white">
      <div className="border-b border-edge bg-surface-cream px-5 py-4">
        <p className="flex flex-wrap items-center gap-2 font-display text-[16px] font-semibold">
          {side === 'GROUP' ? 'คะแนนรายกลุ่ม' : 'คะแนนรายบุคคล'}
          <Pill tone={scores.isFinal ? 'ok' : 'warn'} data-testid="scores-final-flag">
            {scores.isFinal ? 'คะแนนสุดท้าย' : 'ชั่วคราว — อาจเปลี่ยนแปลงได้'}
          </Pill>
        </p>
        <p className="mt-1 text-[13.5px] text-ink-2">
          q = ค่าเฉลี่ยถ่วงน้ำหนัก · คะแนน = (floor + (ceiling − floor) × q) × น้ำหนัก × คะแนนเต็ม ·
          กดแถวเพื่อดูรายละเอียดต่อเกณฑ์
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">ยังไม่มีคะแนนที่คำนวณไว้ — กด "คำนวณคะแนนชั่วคราว" ก่อน</p>
      ) : (
        <div className="relative overflow-x-auto" role="region" aria-label="ตารางคะแนน" tabIndex={0}>
          <table className="w-full min-w-180 text-[14.5px]">
            <thead className="bg-table-head text-left">
              <tr>
                <th scope="col" className="px-5 py-3 font-normal">
                  {side === 'GROUP' ? 'กลุ่ม' : 'นักศึกษา'}
                </th>
                {columns.map((c) => (
                  <th key={c.criterionId} scope="col" className="px-4 py-3 text-right font-normal">
                    {c.name} ({Number(c.weightPct)}%)
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right font-normal">
                  ผลประเมิน
                </th>
                <th scope="col" className="px-4 py-3 text-right font-normal">
                  รวม{maxTotal ? ` / ${maxTotal}` : ''}
                  <span className="block">({scores.isFinal ? 'สุดท้าย' : 'ชั่วคราว'})</span>
                </th>
                <th scope="col" className="px-5 py-3 text-right font-normal">
                  สถานะ
                </th>
              </tr>
            </thead>
            {rows.map((s) => {
              const key = `${s.side}-${s.itemId}`
              const open = expanded === key
              const criteria = s.criteria ?? []
              const evaluations = criteria.reduce((sum, c) => sum + c.comparisonCount, 0)
              return (
                <tbody key={key} className="border-t border-edge">
                  <tr className="cursor-pointer hover:bg-sand/60" onClick={() => setExpanded(open ? null : key)}>
                    <th scope="row" className="px-5 py-3.5 text-left font-normal">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={`${open ? 'ซ่อน' : 'ดู'}รายละเอียดต่อเกณฑ์ของ ${s.itemLabel}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          setExpanded(open ? null : key)
                        }}
                        className={`mr-1.5 inline-grid size-6 place-items-center rounded text-ink-2 ${FOCUS}`}
                      >
                        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                      </button>
                      {s.itemLabel}
                    </th>
                    {columns.map((c) => {
                      const q = criteria.find((x) => x.criterionId === c.criterionId)?.q
                      return (
                        <td key={c.criterionId} className="px-4 py-3.5 text-right font-mono tabular">
                          {q === null || q === undefined ? '—' : Number(q).toFixed(2)}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3.5 text-right font-mono tabular">{evaluations}</td>
                    <td className="px-4 py-3.5 text-right font-mono tabular">{Number(s.component).toFixed(3)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {s.overridden ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ok-50 px-3 py-1.5 font-display text-[13.5px] font-semibold text-ok-700">
                          ✓ แก้โดยอาจารย์
                        </span>
                      ) : s.flags.includes('LOW_CONFIDENCE') ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-caution-soft px-3 py-1.5 font-display text-[13.5px] font-semibold text-warn">
                          ◷ มีคู่ข้อมูลน้อย
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ok-50 px-3 py-1.5 font-display text-[13.5px] font-semibold text-ok-700">
                          ✓ ข้อมูลพอ
                        </span>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-ground">
                      <td colSpan={columns.length + 4} className="px-5 pt-3 pb-4">
                        <table className="w-full text-[13px]">
                          <caption className="pb-2 text-left text-ink-2">
                            {s.itemLabel} · รายละเอียดต่อเกณฑ์
                            {maxTotal ? ` (คะแนนเต็ม ${maxTotal})` : ''}
                          </caption>
                          <thead className="text-left text-muted">
                            <tr>
                              <th scope="col" className="py-1.5 pl-6 font-normal">
                                เกณฑ์
                              </th>
                              <th scope="col" className="py-1.5 text-right font-normal">
                                น้ำหนัก
                              </th>
                              <th scope="col" className="py-1.5 text-right font-normal">
                                q
                              </th>
                              <th scope="col" className="py-1.5 text-right font-normal">
                                จำนวนผลประเมิน
                              </th>
                              <th scope="col" className="py-1.5 text-right font-normal">
                                คะแนนส่วนน้ำหนัก
                              </th>
                              <th scope="col" className="py-1.5 text-right font-normal">
                                สถานะ
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {criteria.map((c) => (
                              <tr key={c.criterionId}>
                                <th scope="row" className="py-1.5 pl-6 text-left font-semibold">
                                  {c.name}
                                </th>
                                <td className="py-1.5 text-right font-mono tabular">{Number(c.weightPct)}%</td>
                                <td className="py-1.5 text-right font-mono tabular">
                                  {c.q === null ? '—' : Number(c.q).toFixed(2)}
                                </td>
                                <td className="py-1.5 text-right font-mono tabular">{c.comparisonCount}</td>
                                <td className="py-1.5 text-right font-mono tabular">
                                  {Number(c.score).toFixed(3)} / {Number(c.maxScore).toFixed(2)}
                                </td>
                                <td className="py-1.5 text-right">
                                  {c.flags.includes('LOW_CONFIDENCE') ? 'ข้อมูลน้อย' : 'ข้อมูลพอ'}
                                </td>
                              </tr>
                            ))}
                            <tr className="border-t border-edge font-semibold">
                              <th scope="row" className="py-1.5 pl-6 text-left">
                                รวม
                              </th>
                              <td className="py-1.5 text-right font-mono tabular">
                                {criteria.reduce((sum, c) => sum + Number(c.weightPct), 0)}%
                              </td>
                              <td />
                              <td className="py-1.5 text-right font-mono tabular">{evaluations}</td>
                              <td className="py-1.5 text-right font-mono tabular">
                                {Number(s.component).toFixed(3)}
                                {maxTotal ? ` / ${maxTotal}` : ''}
                              </td>
                              <td />
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </tbody>
              )
            })}
          </table>
        </div>
      )}
    </div>
  )
}
