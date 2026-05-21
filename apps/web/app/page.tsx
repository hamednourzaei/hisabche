// ═══════════════════════════════════════════════════════════
// apps/web/app/page.tsx (v16 — LIVING BACKGROUND + CINEMATIC)
// ═══════════════════════════════════════════════════════════
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { motion, useScroll, useSpring, useTransform } from "framer-motion"
import { useAuthStore } from "@hisabche/store"
import DashboardLayout from "./(dashboard)/layout"
import DashboardHome from "./(dashboard)/page"
import {
  LandingPreview, AnimatedCounter, GradientMesh, DashboardHeader,
  ShimmerCTA, Section, FeatureCard, SectionHeading, LivingBackground,
} from "@hisabche/ui"

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--hisab-background)]">
      <span className="text-sm text-[var(--hisab-muted-fg)]">{useTranslation().t("app.loading")}</span>
    </div>
  )
}

function useCinematicCamera() {
  const { scrollYProgress } = useScroll()
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 25, mass: 0.2 })
  const zoom = useTransform(smooth, [0, 0.5, 1], [1, 1.05, 1.1])
  const fade = useTransform(smooth, [0, 0.2, 0.8, 1], [1, 1, 0.9, 0.8])
  return { zoom, fade }
}

const features = [
  { emoji: "🧾", title: "فاکتور در ۳۰ ثانیه", desc: "محصول از گدام، مشتری از دفتر تلفن." },
  { emoji: "📦", title: "گدام خودکار", desc: "ورود و خروج با هر فاکتور." },
  { emoji: "📒", title: "بدهی یادت بمونه", desc: "پرداخت در ۲ کلیک." },
  { emoji: "📱", title: "تو جیب شماست", desc: "موبایل، تبلت، کامپیوتر." },
  { emoji: "🔌", title: "آفلاین واقعی", desc: "اینترنت نیست؟ مشکلی نیست." },
  { emoji: "💱", title: "افغانی · دلار · تومان", desc: "تبدیل خودکار." },
]

const testimonials = [
  { name: "احمد — سوپرمارکت کابل", text: "از وقتی حسابچه دارم، دیگه دفتر کاغذی ندارم. فاکتورو تو ۳۰ ثانیه می‌دم دست مشتری." },
  { name: "فاطمه — بوتیک مزار", text: "بدهی مشتریام همیشه جلومه. دیگه پولم گم نمیشه." },
  { name: "محمد — عمده‌فروش هرات", text: "۳ تا گدام دارم. با حسابچه همه رو یه‌جا می‌بینم." },
]

const faqs = [
  { q: "واقعاً آفلاین کار می‌کنه؟", a: "آره. بدون اینترنت فاکتور ثبت می‌کنی. وقتی آنلاین شدی، خودش همگام‌سازی می‌کنه." },
  { q: "چقدر هزینه داره؟", a: "نسخه پایه برای همیشه رایگان. بدون کارت بانکی." },
  { q: "روی گوشی قدیمی هم کار می‌کنه؟", a: "آره. رو گوشی ۱ گیگ رم هم روانه." },
]

function FloatingLines() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="absolute h-px w-full bg-gradient-to-r from-transparent via-purple-400/15 to-transparent"
          style={{ top: `${10 + i * 22}%`, animation: `floatLine ${8 + i * 3}s ease-in-out infinite`, animationDelay: `${i * 1.5}s` }} />
      ))}
      <style>{`@keyframes floatLine{0%,100%{transform:translateX(-5%) scaleY(1);opacity:.2}50%{transform:translateX(5%) scaleY(2.5);opacity:.6}}`}</style>
    </div>
  )
}

function CinematicHero() {
  const router = useRouter()
  const { zoom, fade } = useCinematicCamera()

  return (
    <motion.section style={{ scale: zoom, opacity: fade }} className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <GradientMesh />
      <FloatingLines />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.18),transparent_40%),radial-gradient(circle_at_70%_80%,rgba(34,211,238,0.12),transparent_45%)]" />
      <div className="relative z-10 text-center max-w-4xl px-6">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="mb-6 text-xs tracking-[0.3em] text-[var(--hisab-muted-fg)]">
          CINEMATIC PRODUCT EXPERIENCE
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }} className="text-5xl md:text-7xl font-bold text-[var(--hisab-foreground)] leading-tight">
          حسابداری‌ای که<br />
          <span className="bg-gradient-to-r from-purple-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">هیچ‌وقت فراموش نمی‌کنه</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-6 text-[var(--hisab-muted-fg)] text-lg">
          این فقط یک اپ نیست — حافظه‌ی زنده‌ی کسب‌وکار توئه.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-10 flex gap-4 justify-center">
          <ShimmerCTA onClick={() => router.push("/login")}>شروع تجربه</ShimmerCTA>
        </motion.div>
      </div>
    </motion.section>
  )
}

function PainScene() {
  const items = ["دفترها گم میشن", "حساب‌ها فراموش میشن", "سود واقعی معلوم نیست"]
  return (
    <Section>
      <SectionHeading title="قبل از حسابچه" desc="دنیای قدیم" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        {items.map((t, i) => (
          <motion.div key={i} whileHover={{ scale: 1.03 }} className="p-6 rounded-2xl border border-[var(--hisab-destructive)]/20 bg-[var(--hisab-destructive)]/5 text-center text-[var(--hisab-muted-fg)]">{t}</motion.div>
        ))}
      </div>
    </Section>
  )
}

function TransformScene() {
  return (
    <Section>
      <div className="text-center">
        <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="text-4xl font-bold text-[var(--hisab-foreground)] mb-6">بعد از حسابچه</motion.h2>
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="text-[var(--hisab-muted-fg)] max-w-xl mx-auto mb-10">همه چیز در یک سیستم زنده. فاکتور، گدام، بدهی… همه در لحظه.</motion.p>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}><LandingPreview /></motion.div>
      </div>
    </Section>
  )
}

function FeaturesScene() {
  return (
    <Section>
      <SectionHeading title="همه ابزارها" desc="هر چیزی که نیاز داری" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{features.map((f, i) => <FeatureCard key={i} {...f} index={i} />)}</div>
    </Section>
  )
}

function SocialScene() {
  return (
    <Section bordered>
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--hisab-border)] bg-[var(--hisab-card)] px-4 py-1.5 text-xs text-[var(--hisab-muted-fg)] mb-6">⭐ ۴.۹ · ۳۴۰+ کسب‌وکار فعال</div>
        <h2 className="text-3xl font-bold text-[var(--hisab-foreground)]">اعتماد واقعی</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {testimonials.map((t, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} className="p-6 rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-card)]/80 backdrop-blur-sm hover:border-purple-500/20 transition-all">
            <p className="text-sm text-[var(--hisab-muted-fg)] leading-relaxed mb-4">"{t.text}"</p>
            <p className="text-xs font-semibold text-[var(--hisab-foreground)]">{t.name}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  )
}

function FaqScene() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  return (
    <Section>
      <SectionHeading title="سوالات متداول" />
      <div className="max-w-2xl mx-auto space-y-3">
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i
          return (
            <div key={i} className="rounded-2xl border border-dashed border-[var(--hisab-border)] bg-[var(--hisab-card)]/70 backdrop-blur-sm overflow-hidden transition-all hover:border-purple-500/30">
              <button type="button" onClick={() => setOpenIndex(isOpen ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-right">
                <span className="font-semibold text-sm text-[var(--hisab-foreground)]">{faq.q}</span>
                <span className={`text-[var(--hisab-muted-fg)] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>▼</span>
              </button>
              <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden"><p className="px-5 pb-5 text-sm text-[var(--hisab-muted-fg)] leading-relaxed">{faq.a}</p></div>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function CTAScene() {
  const router = useRouter()
  return (
    <Section>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} className="mx-auto max-w-2xl text-center rounded-3xl border border-[var(--hisab-border)] bg-gradient-to-br from-[var(--hisab-card)] via-[var(--hisab-card)] to-purple-500/5 p-10 sm:p-14 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-purple-500/10 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-cyan-500/10 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="relative">
          <h2 className="text-4xl font-bold text-[var(--hisab-foreground)] mb-4">آماده‌ای؟</h2>
          <p className="text-[var(--hisab-muted-fg)] mb-10">۳۰ ثانیه تا اولین فاکتور واقعی</p>
          <ShimmerCTA onClick={() => router.push("/login")}>شروع کن — رایگان</ShimmerCTA>
        </div>
      </motion.div>
    </Section>
  )
}

function LandingPage() {
  const { scrollY } = useScroll()
  const headerBg = useTransform(scrollY, [0, 80], ["transparent", "var(--hisab-background)"])
  const headerShadow = useTransform(scrollY, [0, 80], ["none", "0 1px 3px 0 rgb(0 0 0 / 0.1)"])

  return (
    <div className="min-h-screen relative text-[var(--hisab-foreground)] overflow-x-hidden">
      <LivingBackground />
      
      {/* STICKY HEADER */}
      <motion.div
        style={{ backgroundColor: headerBg, boxShadow: headerShadow }}
        className="sticky top-0 z-50 transition-colors duration-300"
      >
        <DashboardHeader variant="landing" />
      </motion.div>

      <CinematicHero />
      <Section bordered>
        <div className="grid grid-cols-3 gap-6">
          <AnimatedCounter end={1250} label="فاکتور صادر شده" />
          <AnimatedCounter end={340} label="کسب‌وکار فعال" />
          <AnimatedCounter end={8} label="شهر افغانستان" />
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
    </div>
  )
}

export default function RootPage() {
  const { hasHydrated, isLoading, isAuthenticated } = useAuthStore()
  if (!hasHydrated || isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <LandingPage />
  return <DashboardLayout><DashboardHome /></DashboardLayout>
}