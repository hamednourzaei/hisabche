"use client"

import dynamic from "next/dynamic"
import { DashboardHeader, LivingBackground, Section, AnimatedCounter } from "@hisabche/ui"

const CinematicHero = dynamic(() => import("./cinematic-hero"), { ssr: true, loading: () => <SectionSkeleton /> })
const PainScene = dynamic(() => import("./pain-scene"), { ssr: true, loading: () => <SectionSkeleton /> })
const TransformScene = dynamic(() => import("./transform-scene"), { ssr: true, loading: () => <SectionSkeleton /> })
const FeaturesScene = dynamic(() => import("./features-scene"), { ssr: true, loading: () => <SectionSkeleton /> })
const SocialScene = dynamic(() => import("./social-scene"), { ssr: true, loading: () => <SectionSkeleton /> })
const FaqScene = dynamic(() => import("./faq-scene"), { ssr: true, loading: () => <SectionSkeleton /> })
const CTAScene = dynamic(() => import("./cta-scene"), { ssr: true, loading: () => <SectionSkeleton /> })

function SectionSkeleton() {
  return <div className="h-[280px] mx-4 my-6 rounded-xl bg-[var(--hisab-card)]/20 animate-pulse" />
}

const stats = [
  { end: 1250, label: "فاکتور صادر شده" },
  { end: 340, label: "کسب‌وکار فعال" },
  { end: 8, label: "شهر افغانستان" },
]

export function LandingPage() {
  // ❌ بدون AuthGate
  // ❌ بدون useEffect redirect
  // ✅ فقط landing — سریع و بدون race condition

  return (
    <div className="min-h-screen text-[var(--hisab-foreground)] overflow-x-hidden">
      <LivingBackground />
      <header className="sticky top-0 z-50 border-b border-[var(--hisab-border)] bg-[var(--hisab-background)]/70 backdrop-blur-xl">
        <DashboardHeader variant="landing" />
      </header>
      <main className="relative">
        <CinematicHero />
        <Section bordered>
          <div className="grid grid-cols-3 gap-6">
            {stats.map((s) => (
              <AnimatedCounter key={s.label} end={s.end} label={s.label} />
            ))}
          </div>
        </Section>
        <PainScene />
        <TransformScene />
        <FeaturesScene />
        <SocialScene />
        <FaqScene />
        <CTAScene />
        <footer className="border-t border-[var(--hisab-border)] px-4 py-8 text-center">
          <p className="text-xs text-[var(--hisab-muted-fg)]">حسابچه — حافظه‌ی زنده‌ی کسب‌وکار تو</p>
        </footer>
      </main>
    </div>
  )
}