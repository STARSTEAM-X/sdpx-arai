import { CtaBand } from '../components/CtaBand'
import { Hero } from '../components/Hero'
import { ProcessFlow } from '../components/ProcessFlow'
import { SiteFooter } from '../components/SiteFooter'
import { SiteNav } from '../components/SiteNav'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-cream">
      <SiteNav />
      <main>
        <Hero />
        <ProcessFlow />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  )
}
