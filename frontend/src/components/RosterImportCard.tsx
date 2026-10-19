import { useRef, useState } from 'react'

import { Banner, Card, CardHead, FOCUS, Pill, Spinner, btn } from './Ui'
import { IconClose, IconDownload, IconFile, IconUploadCloud } from './icons'
import {
  ApiError,
  type ApiRowError,
  type RosterImportResult,
  importRoster,
  previewRoster,
  type RosterPreview,
} from '../lib/api'

/** ใช้ไฟล์จริงจาก public เพื่อให้ผู้ใช้ดาวน์โหลดข้อมูลชุดเดียวกับตัวอย่างที่ตรวจแล้ว */
const SAMPLE_HREF = '/roster-example.csv'

function humanSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

/** นำเข้ารายชื่อจาก CSV — US-03
 *
 *  ทั้งไฟล์ผ่านหรือไม่บันทึกเลย ดังนั้นเวลาไฟล์ผิด หน้าจอต้องแสดง **ทุกแถว**
 *  ที่ผิด ไม่ใช่แถวแรก คนแก้ไฟล์จะได้แก้รอบเดียวจบ (R2)
 */
export function RosterImportCard({
  classroomId,
  onImported,
  onError,
}: {
  classroomId: string
  onImported: () => Promise<void> | void
  /** ส่ง error ขึ้นไปให้หน้าแม่แสดงในกล่อง alert เดียวของหน้า แทนที่จะมีสองที่ */
  onError: (message: string | null) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<RosterImportResult | null>(null)
  const [rowErrors, setRowErrors] = useState<ApiRowError[]>([])
  const [preview, setPreview] = useState<RosterPreview | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)

  /** เลือกไฟล์ใหม่ = เริ่มรอบใหม่ ผลของรอบก่อนต้องหายไปพร้อมกัน
   *  ไม่งั้นจะเห็น "นำเข้าสำเร็จ 4 คน" ค้างอยู่ข้าง ๆ ไฟล์ที่ยังไม่ได้กดนำเข้า */
  function pick(next: File | null) {
    if (uploading) return
    setFile(next)
    setResult(null)
    setRowErrors([])
    setPreview(null)
    onError(null)
  }

  /** เอาไฟล์ออกอย่างเดียว ไม่แตะผลลัพธ์ — ใช้หลัง import สำเร็จ ซึ่งต้องคงแบนเนอร์สรุปไว้ */
  function clearFile() {
    setFile(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    const chosen = file ?? fileInput.current?.files?.[0] ?? null
    if (!chosen) {
      onError('เลือกไฟล์ CSV ก่อน')
      return
    }

    setUploading(true)
    onError(null)
    setRowErrors([])
    setResult(null)

    try {
      if (!preview) {
        setPreview(await previewRoster(classroomId, chosen))
      } else {
        setResult(await importRoster(classroomId, chosen))
        setPreview(null)
        await onImported()
        clearFile()
      }
    } catch (err) {
      if (err instanceof ApiError) {
        onError(err.message)
        setRowErrors(err.details)
      } else {
        onError('นำเข้ารายชื่อไม่สำเร็จ')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card aria-labelledby="h-csv">
      <CardHead
        id="h-csv"
        icon={<IconUploadCloud className="size-5" />}
        title="เพิ่มสมาชิกจาก CSV"
        hint="ไฟล์ใหม่จะแทนที่รายชื่อนักศึกษาทั้งชุด ผู้สอนและผู้ช่วยสอนไม่ถูกแตะ"
      />

      <form onSubmit={handleUpload} data-testid="roster-import" className="p-6 max-sm:p-4">
        {/* กล่องลากวาง: เป็น label ครอบ input จริง จึงคลิกและกด Enter ได้เองโดยไม่ต้องเขียน handler */}
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const dropped = e.dataTransfer.files[0]
            if (dropped) pick(dropped)
          }}
          className={
            'flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed ' +
            'px-6 py-8 text-center transition-colors ' +
            'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600 ' +
            (dragOver
              ? 'border-solid border-brand-600 bg-accent-soft'
              : 'border-edge-strong bg-ground hover:border-brand-600 hover:bg-accent-soft')
          }
        >
          <span
            aria-hidden="true"
            className="grid size-12 place-items-center rounded-2xl border border-edge bg-white text-accent-ink shadow-[0_1px_2px_rgba(23,32,51,0.05)]"
          >
            <IconUploadCloud className="size-6" />
          </span>
          <span className="font-display text-[15.5px] font-semibold">
            ลากไฟล์ CSV มาวาง หรือเลือกไฟล์จากเครื่อง
          </span>
          <span className="text-[12.5px] text-muted">รองรับไฟล์ .csv ที่เข้ารหัส UTF-8</span>

          {/* aria-label เป็นชื่อจริงของช่องนี้ ไม่ใช่ข้อความในกล่องลากวางข้างบน
              ถ้าปล่อยให้ชื่อมาจากเนื้อความใน label ทั้งก้อน screen reader จะอ่านสามประโยครวด */}
          <input
            ref={fileInput}
            type="file"
            disabled={uploading}
            accept=".csv,text/csv"
            aria-label="ไฟล์รายชื่อ CSV"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
          <span>
            ต้องมีคอลัมน์ <code className="rounded border border-edge bg-sand px-1.5 py-0.5 font-mono text-ink">email</code>{' '}
            และ{' '}
            <code className="rounded border border-edge bg-sand px-1.5 py-0.5 font-mono text-ink">group_name</code>{' '}
            (ไม่สนตัวพิมพ์เล็กใหญ่)
          </span>
          <a
            href={SAMPLE_HREF}
            download="roster-ตัวอย่าง.csv"
            className={`inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent-ink underline decoration-1 underline-offset-4 hover:text-cta-hover ${FOCUS}`}
          >
            <IconDownload className="size-4" />
            ดาวน์โหลดไฟล์ตัวอย่าง
          </a>
        </div>

        {file && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-edge bg-white px-4 py-3">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-edge bg-sand text-ink-2"
            >
              <IconFile className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-sm font-semibold">{file.name}</span>
              <span className="block text-[12.5px] text-muted">
                <span className="font-mono tabular">{humanSize(file.size)}</span> ·{' '}
                {uploading ? 'กำลังส่งไปยังเซิร์ฟเวอร์' : 'พร้อมนำเข้า'}
              </span>
              {/* แถบนี้เป็นแบบไม่บอกเปอร์เซ็นต์โดยตั้งใจ — fetch() อ่านความคืบหน้าของ upload ไม่ได้
                  ตัวเลข % ที่ขยับเองจึงเป็นตัวเลขปลอม ซึ่งแย่กว่าไม่มีเลย */}
              {uploading && (
                <span
                  role="progressbar"
                  aria-label="กำลังนำเข้ารายชื่อ"
                  className="mt-2 block h-1.5 overflow-hidden rounded-full border border-edge bg-sand"
                >
                  <span className="block h-full w-2/5 animate-pulse rounded-full bg-brand-600" />
                </span>
              )}
            </span>
            {uploading ? (
              <Pill tone="brand">กำลังนำเข้า</Pill>
            ) : (
              <button
                type="button"
                onClick={() => {
                  pick(null)
                  if (fileInput.current) fileInput.current.value = ''
                }}
                aria-label="เอาไฟล์ออก"
                className={`grid size-11 shrink-0 place-items-center rounded-lg border border-transparent text-muted transition-colors hover:border-edge hover:bg-sand hover:text-ink ${FOCUS}`}
              >
                <IconClose className="size-5" />
              </button>
            )}
          </div>
        )}

        {rowErrors.length > 0 && (
          <Banner tone="err" data-testid="row-errors" className="mt-4">
            <b className="font-display">
              ไม่มีแถวใดถูกบันทึก — แก้ {rowErrors.length} แถวนี้แล้วอัปโหลดใหม่
            </b>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              {rowErrors.map((e) => (
                <li key={`${e.row}-${e.reason}`}>
                  <span className="font-mono tabular">แถว {e.row}</span> — {e.reason}
                </li>
              ))}
            </ul>
          </Banner>
        )}

        {result && (
          <Banner tone="ok" data-testid="import-result" role="status" className="mt-4">
            <b className="font-display">
              นำเข้าสำเร็จ <span className="font-mono tabular">{result.imported}</span> คน ·{' '}
              <span className="font-mono tabular">{result.groupsCreated}</span> กลุ่ม
            </b>
            {result.warnings.length > 0 && (
              <ul
                data-testid="import-warnings"
                className="mt-2 flex list-disc flex-col gap-1 pl-5 text-ink"
              >
                {result.warnings.map((w) => (
                  <li key={w.message}>
                    <span className="font-mono text-[12.5px] text-muted">{w.type}</span> {w.message}
                  </li>
                ))}
              </ul>
            )}
          </Banner>
        )}

        {preview && <div className="mt-5 rounded-2xl border border-edge p-4" data-testid="roster-preview">
          <h3 className="font-display font-bold">ตรวจสอบรายชื่อก่อนนำเข้า</h3>
          <p className="mt-2 text-sm text-muted">{preview.imported} คน · {preview.groupsCreated} กลุ่ม · ยังไม่มีการบันทึกข้อมูล</p>
          <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-edge"><table className="w-full text-left text-sm"><caption className="sr-only">ตัวอย่างรายชื่อทั้งหมดจากไฟล์ CSV</caption><thead className="sticky top-0 bg-sand"><tr><th className="p-3">อีเมล</th><th className="p-3">ชื่อ</th><th className="p-3">กลุ่ม</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.email} className="border-t border-edge"><td className="break-all p-3">{row.email}</td><td className="p-3">{row.displayName ?? '—'}</td><td className="p-3">{row.groupName}</td></tr>)}</tbody></table></div>
          {preview.warnings.map((warning) => <p key={warning.message} className="mt-3 text-sm text-warn">{warning.message}</p>)}
          <Banner tone="warn" className="mt-3">เมื่อยืนยัน รายชื่อนักศึกษาปัจจุบันจะถูกแทนที่ทั้งชุด กรุณาตรวจสอบก่อนดำเนินการ</Banner>
        </div>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" disabled={uploading} className={btn('primary', 'md', 'max-sm:w-full')}>
            {uploading && <Spinner />}
            {uploading ? 'กำลังตรวจสอบ…' : preview ? 'ยืนยันนำเข้ารายชื่อ' : 'นำเข้ารายชื่อ'}
          </button>
          {preview && <button type="button" disabled={uploading} onClick={() => setPreview(null)} className={btn('ghost')}>กลับไปเลือกไฟล์</button>}
        </div>
      </form>
    </Card>
  )
}
