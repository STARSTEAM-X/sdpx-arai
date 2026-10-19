import { Link } from 'react-router-dom'

import welcomeIllustration from '../assets/figma/welcome.png'
import { FOCUS } from './Ui'

function WelcomeIllustration() {
  return (
    <img src={welcomeIllustration} alt="" width={640} height={480} loading="lazy" className="mx-auto h-56 w-80 max-w-full object-contain sm:h-64 lg:h-75 lg:w-120" />
  )
}

export function CtaBand() {
  return (
    <section id="security" className="mx-auto max-w-304 scroll-mt-6 px-5 pb-12 sm:px-7">
      <div className="grid items-center gap-3 rounded-[36px] bg-surface-cream px-6 py-4 sm:rounded-[48px] sm:px-8 md:grid-cols-[0.85fr_1.15fr] lg:grid-cols-[480px_1fr] lg:gap-10">
        <WelcomeIllustration />

        <div className="flex-1">
          <h2 className="font-display text-2xl leading-[1.45] font-bold text-ink sm:text-[34px]">
            ความคิดเห็นที่ตรงไปตรงมา
          </h2>
          <p className="mt-4 text-lg leading-[1.45] text-muted sm:text-[21px]">
            เพื่อนเห็นเฉพาะคะแนนรวม<br />ไม่เห็นว่าใครเป็นผู้ประเมิน
          </p>
          <Link to="/guide/about" className={`mt-4 inline-flex min-h-12.5 min-w-52 items-center justify-center rounded-full bg-cta px-7 font-semibold text-white transition-colors hover:bg-cta-hover ${FOCUS}`}>
            รู้จัก PairEval
          </Link>
        </div>
      </div>
    </section>
  )
}
