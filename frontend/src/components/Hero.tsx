import { Link } from 'react-router-dom'

import heroComparison from '../assets/enhanced/hero-comparison.webp'
import heroComparisonLarge from '../assets/enhanced/hero-comparison-large.webp'
import heroRings from '../assets/figma/hero-rings.svg'
import heroWave from '../assets/figma/hero-wave.svg'
import { isSignedIn } from '../lib/session'
import { IconArrowRight } from './icons'
import { FOCUS } from './Ui'

export function Hero() {
  const signedIn = isSignedIn()

  return (
    <section id="overview" className="illustrated-hero relative isolate overflow-hidden pt-35">
      <img src={heroRings} alt="" width={1440} height={580} className="pointer-events-none absolute inset-x-0 top-0 -z-10 w-full" />
      <div className="relative z-10 mx-auto max-w-300 px-5 text-center">
        <h1 className="font-display text-[36px] leading-[1.2] font-bold text-balance sm:text-[52px] lg:text-[64px]">
          ทุกความคิดเห็น<br />ช่วยให้ทีมเติบโต
        </h1>
        <p className="mx-auto mt-4 max-w-5xl font-display text-base leading-[1.45] text-ink-2 sm:text-xl lg:text-[23px]">
          ประเมินผลงานและสมาชิกในทีม ด้วยการเปรียบเทียบทีละคู่
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3 sm:gap-5">
          <Link data-testid="main-cta" to="/classrooms" className={`inline-flex min-h-12.5 min-w-44 items-center justify-center gap-3 rounded-full bg-white px-7 font-semibold text-accent-ink transition-colors hover:bg-cream sm:min-w-52 ${FOCUS}`}>
            {signedIn ? 'ห้องเรียนของฉัน' : 'เริ่มประเมิน'}
            <IconArrowRight className="size-4" />
          </Link>
          <a href="#how-it-works" className={`inline-flex min-h-12.5 min-w-44 items-center justify-center rounded-full bg-cta px-7 font-semibold text-white transition-colors hover:bg-cta-hover sm:min-w-52 ${FOCUS}`}>
            ดูวิธีใช้งาน
          </a>
        </div>
      </div>
      <div data-testid="feature-placeholder" className="hero-art relative mx-auto mt-6 w-full max-w-315" aria-label="ภาพตัวอย่างการเปรียบเทียบผลงานสองชิ้น">
        <img src={heroComparison} srcSet={`${heroComparison} 1260w, ${heroComparisonLarge} 1720w`} sizes="(min-width: 1260px) 1260px, 100vw" alt="นักศึกษาสองคนแลกเปลี่ยนความคิดเห็นและเปรียบเทียบผลงาน A กับ B" width={1260} height={669} fetchPriority="high" className="absolute inset-x-0 bottom-0 w-full" />
      </div>
      <img src={heroWave} alt="" width={1440} height={64} className="pointer-events-none absolute inset-x-0 bottom-0 z-20 w-full" />
    </section>
  )
}
