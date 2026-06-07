"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"
import dynamic from "next/dynamic"

const CinematicHero = dynamic(() => import("./cinematic-hero"), { ssr: true, loading: () => <SectionSkeleton tall /> })
const PainScene = dynamic(() => import("./pain-scene"), { ssr: true, loading: () => <SectionSkeleton /> })
const TransformScene = dynamic(() => import("./transform-scene"), { ssr: true, loading: () => <SectionSkeleton /> })
const FeaturesScene = dynamic(() => import("./features-scene"), { ssr: true, loading: () => <SectionSkeleton /> })
const SocialScene = dynamic(() => import("./social-scene"), { ssr: true, loading: () => <SectionSkeleton /> })
const FaqScene = dynamic(() => import("./faq-scene"), { ssr: true, loading: () => <SectionSkeleton /> })
const CTAScene = dynamic(() => import("./cta-scene"), { ssr: true, loading: () => <SectionSkeleton /> })
const StatsSection = dynamic(() => import("./stats-section"), { ssr: true, loading: () => <SectionSkeleton /> })

function SectionSkeleton({ tall }: { tall?: boolean }) {
  return (
    <div className={`mx-4 my-6 animate-pulse rounded-xl bg-[var(--hisab-card)]/20 ${tall ? "min-h-screen" : "h-[280px]"}`} />
  )
}

export function LandingPage() {
  const router = useRouter()
  const navigateLogin = useCallback(() => router.push("/login"), [router])

  return (
    <div className="min-h-screen bg-[var(--hisab-background)] text-[var(--hisab-foreground)]">
      <main className="relative overflow-x-hidden">
        <CinematicHero onNavigateLogin={navigateLogin} />
        <StatsSection />
        <PainScene />
        <TransformScene />
        <FeaturesScene />
        <SocialScene />
        <FaqScene />
        <CTAScene onNavigateLogin={navigateLogin} />
        <footer className="border-t border-[var(--hisab-border)] px-4 py-8 text-center">
          <div className="mb-2 text-lg font-bold text-[var(--hisab-foreground)]">
            حسابچه<span className="text-[var(--hisab-primary)]">.</span>
          </div>
          <p className="text-xs text-[var(--hisab-muted-fg)]">حافظه‌ی زنده‌ی کسب‌وکار تو · © ۱۴۰۵</p>
        </footer>
      </main>
    </div>
  )
}