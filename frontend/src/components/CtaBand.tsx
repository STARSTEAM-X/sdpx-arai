import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { GoogleSignInButton } from './GoogleSignInButton'
import welcomeIllustration from '../assets/figma/welcome.png'
import { isSignedIn } from '../lib/session'
import { FOCUS } from './Ui'

function WelcomeIllustration() {
  return (
    <img src={welcomeIllustration} alt="" width={640} height={480} loading="lazy" className="mx-auto h-56 w-80 max-w-full object-contain sm:h-64 lg:h-75 lg:w-120" />
  )
}

export function CtaBand() {
  const navigate = useNavigate()
  const [signedIn, setSignedIn] = useState(isSignedIn)
  const [expanded, setExpanded] = useState(false)

  // login เสร็จแล้วพาไปหน้าที่ใช้งานจริงเลย ไม่ทิ้งให้ผู้ใช้เดาว่าต้องกดอะไรต่อ
  const handleSignedIn = useCallback(() => {
    setSignedIn(true)
    navigate('/classrooms')
  }, [navigate])

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
          <button type="button" aria-expanded={expanded} aria-controls="login" onClick={() => setExpanded(!expanded)} className={`mt-4 inline-flex min-h-12.5 min-w-52 items-center justify-center rounded-full bg-cta px-7 font-semibold text-white transition-colors hover:bg-cta-hover ${FOCUS}`}>
            รู้จัก PairEval
          </button>
          <div id="login" hidden={!expanded} className="mt-5">
            <p className="mb-4 max-w-lg text-sm leading-relaxed text-ink-2">PairEval ช่วยประเมินผลงานทีละคู่ตามเกณฑ์เดียวกัน ผู้สอนตรวจสอบผลและประกาศคะแนนเมื่อพร้อม เริ่มใช้งานด้วยบัญชี Google ของคุณ</p>
            {signedIn ? (
              <Link
                to="/classrooms"
                className={`inline-flex min-h-11 items-center gap-2.5 rounded-full border border-accent-line bg-white px-5 font-semibold text-accent-ink hover:bg-cream ${FOCUS}`}
              >
                ไปที่ห้องเรียนของฉัน
              </Link>
            ) : (
              expanded && <GoogleSignInButton onSignedIn={handleSignedIn} width={280} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
