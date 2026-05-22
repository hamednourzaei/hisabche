"use client"

import { useRouter } from "next/navigation"
import { Section, ShimmerCTA } from "@hisabche/ui"

export default function CTAScene() {
  const router = useRouter()

  return (
    <Section>
      <div className="mx-auto max-w-2xl text-center rounded-3xl border border-[var(--hisab-border)] bg-gradient-to-br from-[var(--hisab-card)] via-[var(--hisab-card)] to-purple-500/5 p-10 sm:p-14 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-purple-500/10 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-cyan-500/10 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="relative">
          <h2 className="text-4xl font-bold text-[var(--hisab-foreground)] mb-4">آماده‌ای؟</h2>
          <p className="text-[var(--hisab-muted-fg)] mb-10">۳۰ ثانیه تا اولین فاکتور واقعی</p>
          <ShimmerCTA onClick={() => router.push("/login")}>شروع کن — رایگان</ShimmerCTA>
        </div>
      </div>
    </Section>
  )
}