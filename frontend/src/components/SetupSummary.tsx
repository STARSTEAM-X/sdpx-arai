import { Card, CardHead } from './Ui'
import { IconCheck, IconCircleDashed, IconInfo, IconWeights } from './icons'
import {
  type AssignmentDraft,
  individualEnabled,
  weightChecks,
} from '../lib/assignment'

function Line({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-dashed border-edge py-3 text-sm last:border-b-0">
      <span className="w-28 shrink-0 text-muted">{k}</span>
      <span className="ml-auto text-right font-display font-semibold">{children}</span>
    </div>
  )
}

function Check({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2.5 text-[13.5px] ${on ? 'text-ok-700' : 'text-muted'}`}>
      {on ? (
        <IconCheck className="mt-0.5 size-4 shrink-0" />
      ) : (
        <IconCircleDashed className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  )
}

/** สรุปค่าที่กำลังจะสร้าง — อ่านจาก draft ตัวเดียวกับที่ฟอร์มใช้ จึงเปลี่ยนตามทันทีที่พิมพ์
 *
 *  มีไว้เพราะการเผยแพร่ย้อนกลับไม่ได้ คนกดควรเห็นสิ่งที่กำลังจะเกิดขึ้นก่อน
 *  โดยไม่ต้องเลื่อนขึ้นไปไล่อ่านฟอร์มทีละช่อง
 */
export function SetupSummary({
  draft,
  memberCount,
  studentCount,
  groupCount,
}: {
  draft: AssignmentDraft
  memberCount: number
  studentCount: number
  groupCount: number
}) {
  const checks = weightChecks(draft)
  const weightsOk = checks.every((c) => c.ok)

  const deadline = draft.deadline
    ? new Date(draft.deadline).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    : 'ยังไม่กำหนด'

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHead
          id="h-summary"
          icon={<IconWeights className="size-5" />}
          title="สรุปก่อนสร้างงาน"
          hint="ตรวจให้ตรงก่อนกดเผยแพร่ เพราะการจัดคู่ย้อนกลับไม่ได้"
        />

        <div className="px-6 py-2 max-sm:px-4">
          <Line k="สมาชิก">
            <span className="font-mono tabular">{memberCount}</span> คน
          </Line>
          <Line k="นักศึกษา / กลุ่ม">
            <span className="font-mono tabular">{studentCount}</span> คน ·{' '}
            <span className="font-mono tabular">{groupCount}</span> กลุ่ม
          </Line>
          <Line k="รูปแบบ">
            {individualEnabled(draft) ? 'กลุ่ม + รายบุคคล' : 'เฉพาะระดับกลุ่ม'}
          </Line>
          <Line k="การจับคู่">
            <span className="font-mono tabular">{draft.targetCoverage}</span> คู่ / คน
          </Line>
          <Line k="กำหนดส่ง">{deadline}</Line>
          <Line k="น้ำหนัก">
            {checks.map((c) => `${c.label} ${c.total}%`).join(' · ')}
          </Line>
        </div>

        <div className="flex flex-col gap-2 border-t border-edge px-6 py-5 max-sm:px-4">
          <Check on={studentCount > 0}>มีนักศึกษาในห้องอย่างน้อย 1 คน</Check>
          <Check on={Boolean(draft.deadline)}>ระบุกำหนดส่งแล้ว</Check>
          <Check on={weightsOk}>น้ำหนักครบ 100% ทุกฝั่ง</Check>
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3 p-6 max-sm:p-4">
          <IconInfo className="mt-0.5 size-4.5 shrink-0 text-muted" />
          <p className="text-[12.5px] leading-relaxed text-muted">
            การเผยแพร่จะจัดคู่ประเมินทันทีด้วย seed ที่บันทึกไว้ ถ้าต้องแก้รายชื่อหลังจากนั้น
            ต้องสร้างงานใหม่ เพราะคู่ที่จัดไปแล้วอ้างถึงสมาชิกชุดเดิม
          </p>
        </div>
      </Card>
    </div>
  )
}
