import { LogoMark } from './icons'

/* ภาพจำลองหน้าจอระบบสำหรับโชว์ใน hero — เป็น mockup ล้วน ตัวเลขทั้งหมดเป็นข้อมูลตัวอย่าง
   ไม่ได้ต่อกับ API จริง ของจริงจะพัฒนาตั้งแต่ WS-03 เป็นต้นไป */

const SIDEBAR = ['ภาพรวม', 'ห้องเรียน', 'งานประเมิน', 'คู่งานที่ประเมิน', 'รายงาน', 'ตั้งค่า']

const STATS = [
  { label: 'การมีส่วนร่วม', value: '87%', note: 'นักศึกษาที่ประเมินแล้ว', tone: 'brand' },
  { label: 'งานที่กำลังดำเนินการ', value: '2', note: 'งานที่เปิดอยู่', tone: 'ink' },
  { label: 'สถานะคะแนน', value: '76%', note: 'ยืนยันแล้ว', tone: 'ok' },
] as const

/** เส้นความคืบหน้า: เปอร์เซ็นต์ที่ประเมินเสร็จในแต่ละสัปดาห์ */
const DONE = [8, 26, 52, 71, 88]
const FORECAST = [10, 32, 58, 80, 96]

function Sparkline() {
  // แปลงค่า 0–100 เป็นพิกัดใน viewBox 200×70 (y กลับหัวเพราะ SVG นับจากบนลงล่าง)
  const toPath = (values: number[]) =>
    values
      .map((v, i) => `${(i / (values.length - 1)) * 196 + 2},${68 - (v / 100) * 64}`)
      .join(' ')

  return (
    <svg viewBox="0 0 200 70" className="h-24 w-full" role="img" aria-label="กราฟความคืบหน้าการประเมิน">
      {[0, 16, 32, 48, 64].map((y) => (
        <line key={y} x1="0" y1={y + 2} x2="200" y2={y + 2} stroke="#f1e6dc" strokeWidth="1" />
      ))}
      <polyline points={toPath(FORECAST)} fill="none" stroke="#c9cdd4" strokeWidth="1.6" strokeDasharray="3 3" />
      <polyline points={toPath(DONE)} fill="none" stroke="#2e9e6b" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function QualityDonut() {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  // เรียงส่วนโค้งต่อกันด้วย dasharray: ความยาวส่วนของตัวเอง แล้วเว้นที่เหลือ
  const arcs = [
    { pct: 92, color: '#2e9e6b' },
    { pct: 6, color: '#f4703c' },
    { pct: 2, color: '#d94b4b' },
  ]
  let consumed = 0

  return (
    <svg viewBox="0 0 100 100" className="size-28" role="img" aria-label="สัดส่วนคุณภาพการประเมิน 92 เปอร์เซ็นต์อยู่ในเกณฑ์ดี">
      {arcs.map((arc) => {
        const dash = (arc.pct / 100) * circumference
        const offset = -(consumed / 100) * circumference
        consumed += arc.pct
        return (
          <circle
            key={arc.color}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth="11"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
          />
        )
      })}
      <text x="50" y="55" textAnchor="middle" className="fill-ink text-[18px] font-semibold">
        92%
      </text>
    </svg>
  )
}

export function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_18px_50px_-24px_rgba(29,36,48,0.35)]">
      <div className="flex">
        {/* แถบเมนูซ้าย */}
        <aside className="hidden w-40 shrink-0 border-r border-line bg-cream p-3 sm:block">
          <div className="mb-4 flex items-center gap-1.5 px-1 text-[11px] font-semibold">
            <LogoMark className="size-4" />
            PairEval
          </div>
          <ul className="space-y-0.5 text-[10px]">
            {SIDEBAR.map((item, i) => (
              <li
                key={item}
                className={`rounded-md px-2 py-1.5 ${
                  i === 0 ? 'bg-brand-100 font-medium text-brand-700' : 'text-muted'
                }`}
              >
                {item}
              </li>
            ))}
          </ul>
        </aside>

        {/* เนื้อหาหลัก */}
        <div className="min-w-0 flex-1 p-3.5">
          <p className="mb-2.5 text-[11px] font-semibold">ภาพรวม</p>

          <div className="grid grid-cols-3 gap-2">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-lg border border-line p-2">
                <p className="truncate text-[9px] text-muted">{s.label}</p>
                <p
                  className={`mt-0.5 text-base font-semibold ${
                    s.tone === 'brand' ? 'text-brand-600' : s.tone === 'ok' ? 'text-ok-500' : 'text-ink'
                  }`}
                >
                  {s.value}
                </p>
                <p className="truncate text-[8px] text-muted">{s.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-2 grid gap-2 md:grid-cols-[1.55fr_1fr]">
            <div className="rounded-lg border border-line p-2">
              <p className="text-[9px] text-muted">ความคืบหน้าการประเมิน</p>
              <Sparkline />
              <div className="flex justify-between text-[8px] text-muted">
                {['1 มี.ค.', '8', '15', '22', '29'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-line p-2">
              <p className="text-[9px] text-muted">คุณภาพการประเมิน</p>
              <div className="flex items-center justify-center">
                <QualityDonut />
              </div>
              <ul className="space-y-0.5 text-[8px] text-muted">
                {[
                  { c: 'bg-ok-500', t: 'ดี', v: '92%' },
                  { c: 'bg-brand-500', t: 'ควรตรวจสอบ', v: '6%' },
                  { c: 'bg-[#d94b4b]', t: 'มีปัญหา', v: '2%' },
                ].map((l) => (
                  <li key={l.t} className="flex items-center gap-1">
                    <span className={`size-1.5 rounded-full ${l.c}`} />
                    <span className="flex-1">{l.t}</span>
                    <span>{l.v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* งานล่าสุด */}
          <div className="mt-2 rounded-lg border border-line p-2">
            <div className="mb-1.5 flex items-center justify-between text-[9px]">
              <span className="text-muted">งานล่าสุด</span>
              <span className="text-brand-600">ดูทั้งหมด →</span>
            </div>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="min-w-0 flex-1 truncate font-medium">โครงการออกแบบ UI/UX</span>
              <span className="hidden truncate text-muted sm:block">CS301 HCI · Sec 1</span>
              <span className="hidden text-muted md:block">31 พ.ค. 2567</span>
              <span className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-line">
                <span className="block h-full w-[76%] rounded-full bg-ok-500" />
              </span>
              <span className="shrink-0 text-muted">76%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
