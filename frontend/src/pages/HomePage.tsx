import { ComparisonDemo } from '../components/ComparisonDemo'
import { CtaBand } from '../components/CtaBand'
import { FeatureGrid } from '../components/FeatureGrid'
import { Hero } from '../components/Hero'
import { InstructorReport } from '../components/InstructorReport'
import { PersonaCards } from '../components/PersonaCards'
import { ProcessFlow } from '../components/ProcessFlow'
import { SiteFooter } from '../components/SiteFooter'
import { SiteNav } from '../components/SiteNav'
import { TrustRow } from '../components/TrustRow'

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <PersonaCards />
        <ProcessFlow />
        <FeatureGrid />

        {/* สองแผงคู่กัน: ฝั่งซ้ายคือสิ่งที่นักศึกษาเห็น ฝั่งขวาคือสิ่งที่อาจารย์เห็น */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-4 lg:grid-cols-2">
            <ComparisonDemo />
            <InstructorReport />
          </div>
        </section>

        <TrustRow />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  )
}
