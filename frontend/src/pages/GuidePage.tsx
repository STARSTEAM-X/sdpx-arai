import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'

import guideHero from '../assets/figma/guide-hero.png'
import submitConfirm from '../assets/figma/guide-submit-confirm.png'
import submitSuccess from '../assets/figma/guide-submit-success.png'
import { AppNav } from '../components/AppNav'
import { BackChevron, BulletList, OrangeHero, SectionCard } from '../components/PageChrome'
import { COLLECTED_DATA, CollectedDataTable } from '../components/PrivacyNotice'
import { SiteNav } from '../components/SiteNav'
import { FOCUS, Spinner, btn } from '../components/Ui'
import { ApiError, type DataCopyRequest, type Me, createDataRequest, getMe, listDataRequests } from '../lib/api'
import { isSignedIn } from '../lib/session'

/** คู่มือ "ทำความรู้จัก PairEval" — Figma ST05–ST08 (นักศึกษา) และ T10–T13, T12b (TA)
 *  เป็นหน้าเดียวกัน 4 แท็บ ใช้ path แยกเพื่อให้ลิงก์จากหน้าแรกและ footer ชี้ตรงแท็บได้ */
const TABS = [
  { slug: '', label: 'ขั้นตอนการใช้งาน' },
  { slug: 'system', label: 'การทำงานของระบบ' },
  { slug: 'privacy', label: 'ความเป็นส่วนตัว' },
  { slug: 'about', label: 'เกี่ยวกับเรา' },
] as const

type TabSlug = (typeof TABS)[number]['slug']

export default function GuidePage() {
  const { tab = '' } = useParams()
  const navigate = useNavigate()
  const signedIn = isSignedIn()
  const current = (TABS.some((item) => item.slug === tab) ? tab : '') as TabSlug

  const { hash } = useLocation()

  useEffect(() => {
    if (!TABS.some((item) => item.slug === tab)) void navigate('/guide', { replace: true })
  }, [tab, navigate])

  // ปุ่มบนหน้าแรกชี้มาที่หัวข้อย่อย เช่น /guide#scale — router ไม่เลื่อนให้เอง
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash, current])

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      {signedIn ? <AppNav context="คู่มือการใช้งาน" /> : <div className="h-28"><SiteNav /></div>}

      <main className="mx-auto max-w-290 px-0 pt-5 pb-16 max-xl:px-7 max-sm:px-4">
        <div className="relative flex items-center gap-3 max-xl:mb-2">
          <BackChevron to={signedIn ? '/classrooms' : '/'} label={signedIn ? 'กลับห้องเรียนของฉัน' : 'กลับหน้าแรก'} />
          <OrangeHero
            title="ทำความรู้จัก PairEval ระบบเปรียบเทียบคะแนน"
            image={guideHero}
            imageClassName="-top-24 -right-7 h-85 w-113"
            className="flex-1"
            textWidth="max-w-[66%]"
            titleSize="text-[34px] max-lg:text-[26px]"
          />
        </div>

        <div className="mt-5 grid items-start gap-2.5 lg:grid-cols-[289px_1fr]">
          <nav aria-label="หัวข้อคู่มือ" className="rounded-3xl border border-edge bg-white p-5 max-lg:p-2">
            <ul className="lg:divide-y lg:divide-edge max-lg:flex max-lg:flex-wrap max-lg:gap-1">
              {TABS.map((item) => (
                <li key={item.slug}>
                  <NavLink
                    end
                    to={item.slug ? `/guide/${item.slug}` : '/guide'}
                    className={({ isActive }) => `flex min-h-11 items-center rounded-lg px-1.5 py-2.5 font-display text-[19px] lg:my-1 max-lg:px-3 max-lg:text-sm ${isActive ? 'font-bold text-ink' : 'font-semibold text-ink-2 hover:text-accent-ink'} ${FOCUS}`}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex min-w-0 flex-col gap-2.5">
            {current === '' && <StepsTab />}
            {current === 'system' && <SystemTab />}
            {current === 'privacy' && <PrivacyTab signedIn={signedIn} />}
            {current === 'about' && <AboutTab />}
          </div>
        </div>
      </main>
    </div>
  )
}

const STEPS = [
  ['เปิดงานที่ต้องประเมิน', 'เข้าห้องเรียน แล้วไปที่งานประเมิน ระบบจัดคู่ให้ล่วงหน้าแล้ว คุณไม่ต้องเลือกเองว่าจะประเมินใคร'],
  ['ดูผลงานทั้งสองฝั่งก่อน', 'แต่ละคู่มีลิงก์ผลงานของทั้งสองฝ่าย เปิดดูก่อนตัดสิน อย่าเดา'],
  ['เลือกว่าฝั่งไหนดีกว่าเล็กน้อย ดีกว่า และดีกว่ามากแค่ไหน', 'ไม่ต้องให้คะแนนเป็นตัวเลข แค่เทียบสองชิ้นว่าอันไหนดีกว่า'],
  ['กดส่ง และแก้ได้จนถึงกำหนดส่ง', 'ส่งได้แม้ตอบไม่ครบ กลับมาแก้กี่ครั้งก็ได้ ระบบใช้คำตอบครั้งล่าสุดในการคำนวณ'],
]

const SCALE_PREVIEW = [
  { label: 'ดีกว่ามาก', dot: 'size-12 bg-[#b84204]', text: 'text-accent-ink' },
  { label: 'ดีกว่า', dot: 'size-9 bg-[#e86f24]', text: 'text-accent-ink' },
  { label: 'ดีกว่าเล็กน้อย', dot: 'size-5 bg-[#f6c39f]', text: 'text-accent-ink' },
  { label: 'ดีกว่าเล็กน้อย', dot: 'size-5 bg-[#a8c1f4]', text: 'text-info-ink' },
  { label: 'ดีกว่า', dot: 'size-9 bg-[#5487d5]', text: 'text-info-ink' },
  { label: 'ดีกว่ามาก', dot: 'size-12 bg-[#2455a6]', text: 'text-info-ink' },
]

function Figure({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return (
    <div className="my-3 grid place-items-center border border-ink bg-white px-4 py-5">
      <img src={src} alt={alt} width={width} height={height} loading="lazy" className="h-auto w-full max-w-156" />
    </div>
  )
}

function StepsTab() {
  return (
    <>
      <SectionCard title="ทำ 4 ขั้นตอนนี้">
        <ol className="space-y-4">
          {STEPS.map(([title, body], index) => (
            <li key={title} className="flex gap-3.5">
              <span aria-hidden="true" className="grid size-7.5 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-[15px] font-semibold text-accent-ink">{index + 1}</span>
              <div>
                <p className="font-display text-[15px] font-semibold">{title}</p>
                <p className="mt-0.5 text-[15px] text-ink-2">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard id="scale" title="สเกล 6 ระดับ และทำไมไม่มีช่องเท่ากัน" hint="เลือกได้ 6 ระดับ ฝั่งละ 3 ระดับ ไม่มีตัวเลือกตรงกลาง">
        <div className="rounded-2xl bg-[#f6f3f0] px-5 pt-4 pb-4">
          <div className="flex justify-between text-[13px]">
            <span className="text-accent-ink">← ฝั่งซ้ายดีกว่า</span>
            <span className="text-info-ink">ฝั่งขวาดีกว่า →</span>
          </div>
          <ul aria-label="ตัวอย่างสเกล 6 ระดับ" className="mt-3 grid grid-cols-6 gap-2 max-md:grid-cols-3">
            {SCALE_PREVIEW.map((item, index) => (
              <li key={index} className="flex h-29 flex-col items-center justify-center gap-3 rounded-2xl bg-white">
                <span className="grid h-12 place-items-center"><span aria-hidden="true" className={`block rounded-full ${item.dot}`} /></span>
                <span className={`text-[13px] ${item.text}`}>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <BulletList
          className="mt-4"
          items={[
            'ถ้ารู้สึกว่าสองฝั่งพอ ๆ กัน ให้เลือกเล็กน้อย ฝั่งที่คิดว่าดีกว่านิดเดียว',
            'ไม่มีช่องกลางเพราะการมีตัวเลือกกลาง คนส่วนใหญ่จะเลือกกลางเมื่อไม่อยากคิด ทำให้ข้อมูลแยกแยะอะไรไม่ได้',
            'ตำแหน่งซ้ายขวาของแต่ละคู่ระบบสุ่มใหม่ทุกครั้ง อย่าจำฝั่งเองจากการประเมินชุดอื่น',
          ]}
        />
      </SectionCard>

      <SectionCard id="submit" title="การส่งคำตอบ" hint="สามารถทำค้างไว้ได้ โดยการประเมินเดิมไม่สูญหาย">
        <BulletList items={['ประเมินครบทุกประเภท สามารถกดส่งคำตอบ']} />
        <span aria-hidden="true" className={btn('primary', 'md', 'pointer-events-none mt-3 w-53')}>ส่งคำตอบ</span>
        <BulletList className="mt-3" items={['จากนั้นระบบจะแสดงหน้าต่าง “ส่งคำตอบสำเร็จแล้ว” ถือว่าเสร็จสิ้นการส่งคำตอบ']} />
        <Figure src={submitSuccess} alt="ตัวอย่างหน้าต่างส่งคำตอบสำเร็จแล้ว" width={600} height={275} />
        <BulletList items={['หากยังประเมินไม่ครบ สามารถพักการประเมินไว้ได้ ระบบจะแสดงผลรายการประเมิน และจะสามารถกลับมาประเมินในส่วนที่ยังไม่ครบได้ ระบบจะทำการบันทึกผลที่ทำไปแล้ว']} />
        <Figure src={submitConfirm} alt="ตัวอย่างหน้าต่างยืนยันส่งคำตอบที่ยังตอบไม่ครบ" width={624} height={434} />
      </SectionCard>

      <SectionCard id="artifacts" title="การดูผลงานกลุ่ม" hint="ดูได้จากลิงก์ภายนอกของระบบ">
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            { name: 'กลุ่ม Aurora', box: 'bg-[#fde2d4]', ink: 'text-accent-ink' },
            { name: 'กลุ่ม Borealis', box: 'bg-info-soft', ink: 'text-info-ink' },
          ].map((team) => (
            <div key={team.name} className={`flex h-26 items-center gap-4 rounded-2xl px-7.5 ${team.box}`}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-10 ${team.ink}`} fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 3h7l4 4v6" /><path d="M14 3v4h4" /><path d="M7 3v17h6" /><path d="M9.5 9h5M9.5 12h5M9.5 15h2" /><circle cx="17" cy="16.5" r="2" fill="currentColor" /><path d="M13.5 21a3.5 3.5 0 0 1 7 0z" fill="currentColor" /></svg>
              <div>
                <p className="font-display text-[20px] font-semibold">{team.name}</p>
                <span className={`mt-1 inline-block rounded-md border-[3px] border-cta px-2 font-display text-[14px] font-semibold ${team.ink}`}>ดูผลงาน ↗</span>
              </div>
            </div>
          ))}
        </div>
        <BulletList className="mt-3" items={['สามารถคลิกลิงก์ใต้ชื่อกลุ่ม เพื่อดูผลงานของกลุ่มนั้นๆ']} />
      </SectionCard>
    </>
  )
}

const PENALTY = [
  ['100%', '1.00', 'ได้เต็มตามที่ประเมินได้'],
  ['90%', '1.00', 'ถึงเกณฑ์แล้ว เต็มตามที่ประเมินได้'],
  ['45%', '0.50', 'เหลือครึ่งหนึ่งจากคะแนนที่จะได้รับ'],
  ['0%', '0.00', 'ได้ 0 คะแนน'],
]

function SystemTab() {
  return (
    <>
      <SectionCard title="ระบบจับคู่ให้คุณยังไง" hint="คุณไม่ได้เลือกเองว่าจะประเมินใคร ระบบจัดให้ตั้งแต่อาจารย์เปิดงาน">
        <BulletList items={[
          'ประเมินกลุ่มอื่น คุณจะไม่ได้รับคู่ที่มีกลุ่มตัวเองอยู่เลย',
          'ประเมินเพื่อนในกลุ่ม ประเมินได้เฉพาะคนในกลุ่มตัวเอง และจะไม่ได้รับคู่ที่มีตัวเองอยู่',
          'คู่เดิมจะไม่ถูกส่งให้คุณซ้ำภายในเกณฑ์เดียวกัน',
          'จำนวนคู่ที่แต่ละคนได้รับใกล้เคียงกัน ต่างกันไม่เกิน 1 คู่',
          'ถ้าห้องมีกลุ่มน้อยหรือกลุ่มมีสมาชิกน้อย ระบบจะลดจำนวนครั้งที่แต่ละคู่ถูกประเมินลงตามที่ทำได้จริง',
        ]} />
      </SectionCard>

      <SectionCard title="คะแนนของคุณคิดยังไง" hint="ตัวอย่างงานคะแนนเต็ม 20 แบ่งเป็นกลุ่ม 15 และรายบุคคล 5">
        <BulletList items={[
          'คะแนนกลุ่ม มาจากที่เพื่อนกลุ่มอื่นเทียบผลงานกลุ่มคุณกับกลุ่มอื่น ทุกคนในกลุ่มได้เท่ากัน',
          'คะแนนรายบุคคล มาจากที่เพื่อนร่วมกลุ่มเทียบคุณกับเพื่อนคนอื่นในกลุ่ม',
          'ระบบไม่ได้เอาคะแนนดิบมาใช้ตรง ๆ แต่แปลงเป็นช่วงคะแนนก่อน ทุกกลุ่มที่ส่งงานจึงมีคะแนนพื้นฐานอยู่แล้ว',
          'อาจารย์เป็นคนตัดสินคะแนนสุดท้ายเสมอ ระบบไม่ได้ตัดเกรดเอง และอาจารย์แก้คะแนนได้โดยต้องระบุเหตุผล',
        ]} />
      </SectionCard>

      <SectionCard title="ถ้าไม่ประเมินเพื่อน จะเกิดอะไรขึ้น" hint="อ่านข้อนี้ให้จบ เพราะมีผลกับคะแนนของคุณโดยตรง">
        <p className="text-[15px] leading-6">คะแนนของคุณจะถูกคูณด้วยตัวคูณการมีส่วนร่วม ซึ่งคิดจากสัดส่วนคู่ที่คุณส่งจริง เทียบกับที่ได้รับมอบหมาย ถ้าส่งครบ 90% ขึ้นไปถือว่าได้เต็ม</p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-edge">
          <table className="w-full min-w-120 text-left text-[15px]">
            <thead className="bg-[#f6f3f0]">
              <tr>
                <th scope="col" className="px-4 py-3.5 font-display text-[14px] font-semibold">เปอร์เซ็นต์การส่ง</th>
                <th scope="col" className="px-4 py-3.5 font-display text-[14px] font-semibold">ค่าน้ำหนัก</th>
                <th scope="col" className="px-4 py-3.5 font-display text-[14px] font-semibold">ผลกับคะแนนของคุณ</th>
              </tr>
            </thead>
            <tbody>
              {PENALTY.map(([pct, weight, effect]) => (
                <tr key={pct} className="border-t border-edge">
                  <td className="px-4 py-3 font-mono">{pct}</td>
                  <td className="px-4 py-3 font-mono">{weight}</td>
                  <td className="px-4 py-3">{effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] text-muted">ตัวคูณนี้ลดเฉพาะคะแนนของคุณเอง ไม่ลดคะแนนของเพื่อนร่วมกลุ่ม และดูค่าปัจจุบันได้ตลอดที่หน้าคะแนนของฉัน</p>
      </SectionCard>

      <div className="grid gap-2.5 md:grid-cols-2">
        <SectionCard title="ประเมินตามความเป็นจริง">
          <BulletList items={[
            'เพื่อนไม่มีทางรู้ว่าคุณให้คะแนนเขาเท่าไร ไม่ว่าจะผ่านหน้าจอไหน',
            'คุณก็ไม่เห็นว่าใครประเมินคุณเช่นกัน',
            'ถ้ามีคนประเมินคุณยังน้อยเกินไป ระบบจะยังไม่แสดงคะแนนแยกรายเกณฑ์ เพื่อไม่ให้เดาได้ว่าใครให้เท่าไร',
          ]} />
        </SectionCard>
        <SectionCard title="การยื่นขออุทธรณ์คะแนน">
          <BulletList items={[
            'ยื่นอุทธรณ์ได้ภายใน 7 วันหลังประกาศผล จากปุ่มที่หน้าคะแนนของฉัน',
            'เขียนให้ชัดว่าคะแนนส่วนไหนที่คิดว่าไม่ถูกต้อง และเพราะอะไร',
            'คำร้องถึงอาจารย์เท่านั้น และถูกบันทึกไว้ตรวจสอบย้อนหลังได้',
          ]} />
        </SectionCard>
      </div>
    </>
  )
}

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function bangkok(iso: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return { day: get('day'), month: get('month'), year: get('year') + 543, hour: get('hour'), minute: get('minute') }
}

function longThaiDate(iso: string) {
  const d = bangkok(iso)
  return `วันที่ ${d.day} ${THAI_MONTHS[d.month - 1]} ${d.year} เวลา ${d.hour}.${String(d.minute).padStart(2, '0')} น.`
}

function shortThaiDate(iso: string) {
  const d = bangkok(iso)
  return `${d.day} ${THAI_MONTHS_SHORT[d.month - 1]} ${d.year}`
}

function PrivacyTab({ signedIn }: { signedIn: boolean }) {
  const [me, setMe] = useState<Me | null>(null)
  const [requests, setRequests] = useState<DataCopyRequest[]>([])
  const [justRequested, setJustRequested] = useState<DataCopyRequest | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!signedIn) return
    let active = true
    void Promise.all([getMe(), listDataRequests()])
      .then(([profile, list]) => {
        if (!active) return
        setMe(profile)
        setRequests(list.items)
      })
      .catch((err: unknown) => { if (active) setError(err instanceof ApiError ? err.message : 'โหลดข้อมูลบัญชีไม่สำเร็จ') })
    return () => { active = false }
  }, [signedIn])

  async function requestCopy() {
    setSaving(true)
    setError(null)
    try {
      const created = await createDataRequest()
      setJustRequested(created)
      setRequests((items) => [created, ...items])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  const rows = COLLECTED_DATA.slice(0, 3)

  if (!signedIn) {
    return (
      <>
        <CollectedDataTable rows={COLLECTED_DATA} />
        <p className="px-1 text-[14px] text-muted">เข้าสู่ระบบเพื่อดูข้อมูลที่ระบบมีเกี่ยวกับคุณและขอสำเนาข้อมูลของตัวเอง</p>
      </>
    )
  }

  return (
    <>
      <SectionCard title="ข้อมูลที่ระบบมีเกี่ยวกับคุณ" hint={`ข้อมูลที่แสดงเป็นของบัญชี ${me?.email ?? '…'}`}>
        <dl className="space-y-1.5 text-[15px]">
          <Row label="อีเมล" value={<span className="font-mono">{me?.email ?? '…'}</span>} />
          <Row label="ชื่อ-สกุล" value={me?.displayName ?? '—'} />
          <Row label="จำนวนห้องเรียน" value={me ? `${new Set(me.classrooms.map((room) => room.classroomId)).size}  ห้อง` : '…'} />
        </dl>
      </SectionCard>

      <CollectedDataTable rows={rows} />

      <SectionCard
        title="ขอสำเนาข้อมูลของตัวเอง"
        hint={justRequested ? `จะส่งสำเนาข้อมูลไปที่ ${me?.email ?? 'อีเมลของคุณ'} ภายใน 30 วันนับจากรับคำขอ` : 'ระบบจะส่งไฟล์ไปที่อีเมลของคุณภายใน 30 วัน'}
        bodyClassName="min-h-41 px-6 py-4.5"
      >
        {justRequested ? (
          <div data-testid="data-request-received" className="text-[15px]">
            <p>รับคำขอสำเนาข้อมูลแล้ว</p>
            <p className="mt-2 text-ink-2">คำขอ #DSAR-{String(justRequested.id).padStart(3, '0')} · รับเมื่อ {shortThaiDate(justRequested.requestedAt)} · สถานะ: กำลังดำเนินการ</p>
          </div>
        ) : requests.length > 0 ? (
          <div className="text-[15px]">
            <p>คำขอครั้งล่าสุด</p>
            <ul className="mt-2 space-y-2 text-ink-2">
              {requests.slice(0, 3).map((item, index) => (
                <li key={item.id}>ครั้งที่ {requests.length - index} {longThaiDate(item.requestedAt)}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[15px] text-muted">ยังไม่เคยขอสำเนาข้อมูล</p>
        )}
      </SectionCard>

      {error && <p role="alert" className="text-sm text-err">{error}</p>}

      <div className="flex justify-end">
        {justRequested ? (
          <Link to="/classrooms" className={btn('primary', 'md', 'min-h-12 w-53.5')}>กลับห้องเรียน</Link>
        ) : (
          <button type="button" onClick={() => void requestCopy()} disabled={saving} className={btn('primary', 'md', 'min-h-12 w-53.5')}>
            {saving && <Spinner />}ขอสำเนาข้อมูล
          </button>
        )}
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}

function AboutTab() {
  return (
    <>
      <SectionCard title="เทียบทีละคู่ ไม่ต้องตั้งมาตรฐานในหัว">
        <p className="text-[15px] leading-6 text-ink-2">การให้คะแนนเป็นตัวเลขทำให้คนแรกกับคนสุดท้ายถูกวัดด้วยไม้บรรทัดคนละอัน PairEval<br className="max-md:hidden" /> เก็บเฉพาะการเปรียบเทียบสองสิ่งพร้อมกัน ซึ่งเป็นงานที่สมองคนทำได้ดีกว่ามาก</p>
      </SectionCard>
      <SectionCard title="แยกผลงานรายคนได้ โดยมีหลักฐานรองรับ">
        <p className="text-[15px] leading-6 text-ink-2">เพื่อนร่วมกลุ่มเทียบกันเองในกลุ่ม ระบบรวมผลเป็นคะแนนรายบุคคล คนที่ทำกับคนที่ไม่ทำจึงไม่ได้คะแนนก้อนเดียวกันอีกต่อไป</p>
      </SectionCard>
      <SectionCard title="ประเมินตามจริงได้ เพราะไม่มีใครรู้ว่าใครให้">
        <p className="text-[15px] leading-6 text-ink-2">ผู้ถูกประเมินไม่มีทางรู้ว่าใครให้คะแนนเท่าไร ไม่ว่าผ่านหน้าจอ ผ่าน API หรือไฟล์ที่ส่งออก และถ้าคนประเมินยังน้อยเกินจะเดาได้ ระบบจะยังไม่เปิดเผยรายละเอียด</p>
      </SectionCard>
      <SectionCard title="อาจารย์เป็นคนตัดสิน ไม่ใช่ระบบ">
        <p className="text-[15px] leading-6 text-ink-2">ระบบคำนวณและชี้จุดที่น่าสงสัยให้ดู แต่ไม่ตัดเกรดเอง อาจารย์ตรวจ แก้ และยืนยันคะแนนสุดท้ายได้ทุกจุด<br className="max-md:hidden" /> โดยทุกการแก้ต้องมีเหตุผลและถูกบันทึกไว้</p>
      </SectionCard>
    </>
  )
}
