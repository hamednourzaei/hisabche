"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"
import { useScrollDepth } from "./use-scroll-depth"

import CinematicHero from "./cinematic-hero"
import PainScene from "./pain-scene"
import TransformScene from "./transform-scene"
import FeaturesScene from "./features-scene"
import SocialScene from "./social-scene"
import FaqScene from "./faq-scene"
import CTAScene from "./cta-scene"
import StatsSection from "./stats-section"

export function LandingPage() {
  const router = useRouter()
  const navigateLogin = useCallback(() => router.push("/login"), [router])

  useScrollDepth()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="relative overflow-x-hidden">
        <CinematicHero onNavigateLogin={navigateLogin} />
        <StatsSection />
        <PainScene />
        <TransformScene />
        <FeaturesScene />
        <SocialScene />
        <FaqScene />

        <CTAScene onNavigateLogin={navigateLogin} />

        <footer className="border-t border-border px-4 py-8 text-center">
          <div className="mb-2 text-lg font-bold">
            حسابچه<span className="text-primary">.</span>
          </div>
          <p className="text-xs text-muted-foreground">
            حافظه‌ی زنده‌ی کسب‌وکار تو · © ۱۴۰۵
          </p>
        </footer>
      </main>
    </div>
  )
}