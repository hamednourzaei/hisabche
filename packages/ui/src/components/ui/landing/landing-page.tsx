"use client"

import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useThemeStore } from "@hisabche/store"
import { changeLanguage, type SupportedLanguage } from "@hisabche/i18n"
import {
  DashboardHeader,
  LivingBackground,
  Section,
  AnimatedCounter,
} from "@hisabche/ui"
import { useCallback } from "react"
import dynamic from "next/dynamic"

const CinematicHero = dynamic(
  () => import("./cinematic-hero"),
  { ssr: true, loading: () => <SectionSkeleton /> }
)

const PainScene = dynamic(() => import("./pain-scene"), {
  ssr: true,
  loading: () => <SectionSkeleton />,
})

const TransformScene = dynamic(
  () => import("./transform-scene"),
  { ssr: true, loading: () => <SectionSkeleton /> }
)

const FeaturesScene = dynamic(
  () => import("./features-scene"),
  { ssr: true, loading: () => <SectionSkeleton /> }
)

const SocialScene = dynamic(
  () => import("./social-scene"),
  { ssr: true, loading: () => <SectionSkeleton /> }
)

const FaqScene = dynamic(() => import("./faq-scene"), {
  ssr: true,
  loading: () => <SectionSkeleton />,
})

const CTAScene = dynamic(() => import("./cta-scene"), {
  ssr: true,
  loading: () => <SectionSkeleton />,
})

function SectionSkeleton() {
  return (
    <div className="mx-4 my-6 h-[280px] animate-pulse rounded-xl bg-[var(--hisab-card)]/20" />
  )
}

const stats = [
  { end: 1250, label: "فاکتور صادر شده" },
  { end: 340, label: "کسب‌وکار فعال" },
  { end: 8, label: "شهر افغانستان" },
]

export function LandingPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const { isDark, toggle } = useThemeStore()

  const toggleLang = useCallback(() => {
    const nextLang =
      typeof document !== "undefined" &&
      document.documentElement.lang === "fa-AF"
        ? "fa-IR"
        : "fa-AF"
    changeLanguage(nextLang as SupportedLanguage)
  }, [])

  const navigateLogin = useCallback(
    () => router.push("/login"),
    [router]
  )

  const currentLang =
    typeof document !== "undefined"
      ? document.documentElement.lang
      : "fa-AF"

  return (
    <div className="min-h-screen text-[var(--hisab-foreground)]">
      <LivingBackground />

      <DashboardHeader
        variant="landing"
        appName={t("app.name")}
        signInLabel={t("auth.signIn")}
        signOutLabel={t("auth.signOut")}
        isDark={isDark}
        currentLang={currentLang}
        onToggleTheme={toggle}
        onToggleLang={toggleLang}
        onNavigateLogin={navigateLogin}
      />

      <main className="relative overflow-x-hidden">
        <CinematicHero onNavigateLogin={navigateLogin} />

        <Section bordered>
          <div className="grid grid-cols-3 gap-6">
            {stats.map((s) => (
              <AnimatedCounter
                key={s.label}
                end={s.end}
                label={s.label}
              />
            ))}
          </div>
        </Section>

        <PainScene />
        <TransformScene />
        <FeaturesScene />
        <SocialScene />
        <FaqScene />
        <CTAScene onNavigateLogin={navigateLogin} />

        <footer className="border-t border-[var(--hisab-border)] px-4 py-8 text-center">
          <p className="text-xs text-[var(--hisab-muted-fg)]">
            حسابچه — حافظه‌ی زنده‌ی کسب‌وکار تو
          </p>
        </footer>
      </main>
    </div>
  )
}