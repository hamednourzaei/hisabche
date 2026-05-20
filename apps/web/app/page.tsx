// ═══════════════════════════════════════════════════════════
// apps/web/app/page.tsx
// ═══════════════════════════════════════════════════════════
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@hisabche/store"
import DashboardLayout from "./(dashboard)/layout"
import DashboardHome from "./(dashboard)/page"
import { LandingPreview, AnimatedCounter, GradientMesh, DashboardHeader, ShimmerCTA, Section, FeatureCard, SectionHeading } from "@hisabche/ui"

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--hisab-background)]">
      <span className="text-sm text-[var(--hisab-muted-fg)]">{useTranslation().t("app.loading")}</span>
    </div>
  )
}

const features = [
  { emoji: "🧾", title: "فاکتور هوشمند", desc: "صدور فاکتور زیر ۳۰ ثانیه با محصول و مشتری واقعی" },
  { emoji: "📦", title: "گدام", desc: "موجودی، قیمت خرید و فروش، هشدار کمبود" },
  { emoji: "📒", title: "باقی‌داری", desc: "دفتر حساب مشتریان، بدهی‌ها و پرداخت‌ها" },
  { emoji: "📱", title: "موبایل", desc: "روی گوشی، تبلت و کامپیوتر" },
  { emoji: "🔌", title: "آفلاین", desc: "بدون اینترنت هم کار می‌کند" },
  { emoji: "💱", title: "چند ارزی", desc: "افغانی، دلار، کلدار و تومان" },
]

const faqs = [
  { q: "آیا بدون اینترنت کار می‌کند؟", a: "بله، کاملاً آفلاین. با برگشت اینترنت خودکار همگام‌سازی می‌شود." },
  { q: "آیا رایگان است؟", a: "بله، نسخه پایه برای همیشه رایگان است." },
  { q: "روی موبایل اجرا می‌شود؟", a: "بله، روی اندروید، iOS و مرورگر." },
]

function LandingPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[var(--hisab-background)]">
<DashboardHeader variant="landing" />

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <GradientMesh />
        <div className="mx-auto max-w-6xl px-4 pt-12 pb-8 sm:pt-16 lg:pt-24 lg:pb-16">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="animate-fade-in">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[var(--hisab-foreground)] leading-[1.1] mb-3">
                {t("landing.heroTitle")}
              </h1>
              <p className="text-sm sm:text-base text-[var(--hisab-muted-fg)] mb-3">{t("landing.heroSub")}</p>
              <div className="flex items-center gap-4 mb-8 text-xs text-[var(--hisab-muted-fg)]">
                <span className="flex items-center gap-1"><span className="text-[var(--hisab-success)]">●</span> {t("landing.offline")}</span>
                <span className="flex items-center gap-1"><span className="text-[var(--hisab-success)]">●</span> {t("landing.multiCurrency")}</span>
                <span className="flex items-center gap-1"><span className="text-[var(--hisab-success)]">●</span> {t("landing.fastMobile")}</span>
              </div>
              <ShimmerCTA onClick={() => router.push("/login")}>
                {t("landing.cta")}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
              </ShimmerCTA>
            </div>
            <div className="hidden lg:block"><LandingPreview /></div>
          </div>
        </div>
      </section>

      {/* ── Social Proof ──────────────────────────────── */}
      <Section bordered>
        <div className="grid grid-cols-3 gap-6">
          <AnimatedCounter end={1250} label={t("landing.invoicesIssued")} />
          <AnimatedCounter end={340} label={t("landing.activeBusinesses")} />
          <AnimatedCounter end={8} label={t("landing.cities")} />
        </div>
      </Section>

      {/* ── Features ──────────────────────────────────── */}
      <Section>
        <SectionHeading title={t("landing.featuresTitle")} desc={t("landing.featuresDesc")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => <FeatureCard key={i} {...f} index={i} />)}
        </div>
      </Section>

      {/* ── Mobile Showcase ────────────────────────────── */}
      <Section bordered>
        <SectionHeading badge="📱" title={t("landing.mobileTitle")} />
        <div className="grid sm:grid-cols-2 gap-8 items-center">
          <ul className="space-y-3 text-sm text-[var(--hisab-muted-fg)]">
            {[t("landing.mobile1"), t("landing.mobile2"), t("landing.mobile3"), t("landing.mobile4")].map((text, i) => (
              <li key={i} className="flex items-start gap-2"><span className="text-[var(--hisab-success)] mt-0.5">●</span>{text}</li>
            ))}
          </ul>
          <div className="flex justify-center">
            <div className="w-44 rounded-[2.5rem] border-[3px] border-[var(--hisab-border)] bg-[var(--hisab-card)] p-3 shadow-2xl">
              <div className="h-3 w-14 rounded-full bg-[var(--hisab-muted)] mx-auto mb-3" />
              <div className="space-y-2">
                <div className="h-6 rounded-lg bg-[var(--hisab-primary)]/10 flex items-center px-2 text-[9px] text-[var(--hisab-primary)]">📦 {t("godam.productName")}</div>
                <div className="h-6 rounded-lg bg-[var(--hisab-muted)]/30 flex items-center px-2 text-[9px]">👤 {t("faktoor.customer")}</div>
                <div className="h-7 rounded-lg bg-[var(--hisab-primary)] flex items-center justify-center text-[9px] text-white font-semibold">{t("faktoor.printFaktoor")}</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── FAQ ───────────────────────────────────────── */}
      <Section>
        <SectionHeading title={t("landing.faqTitle")} />
        <div className="max-w-2xl mx-auto space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)] p-5">
              <h3 className="font-semibold text-sm text-[var(--hisab-foreground)] mb-2">{faq.q}</h3>
              <p className="text-sm text-[var(--hisab-muted-fg)]">{faq.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── CTA ────────────────────────────────────────── */}
      <Section>
        <div className="mx-auto max-w-2xl text-center rounded-3xl border border-[var(--hisab-border)] bg-[var(--hisab-card)] p-10 sm:p-14 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[var(--hisab-primary)]/5 -translate-y-1/2 translate-x-1/2" />
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--hisab-foreground)] mb-3">{t("landing.finalCTATitle")}</h2>
          <p className="text-sm text-[var(--hisab-muted-fg)] mb-8">{t("landing.finalCTADesc")}</p>
          <ShimmerCTA onClick={() => router.push("/login")}>{t("landing.finalCTAButton")}</ShimmerCTA>
        </div>
      </Section>

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="border-t border-[var(--hisab-border)] px-4 py-8 text-center">
        <p className="text-xs text-[var(--hisab-muted-fg)]">{t("landing.footer")}</p>
      </footer>
    </div>
  )
}

export default function RootPage() {
  const { isAuthenticated, hasHydrated, isLoading } = useAuthStore()
  if (!hasHydrated || isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <LandingPage />
  return <DashboardLayout><DashboardHome /></DashboardLayout>
}