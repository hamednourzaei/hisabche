"use client"

import { Section, ShimmerCTA } from "@hisabche/ui"

export interface CTASceneProps {
  onNavigateLogin: () => void
}

export default function CTAScene({
  onNavigateLogin,
}: CTASceneProps) {
  return (
    <Section>
      <div className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl border border-[var(--hisab-border)] bg-gradient-to-br from-[var(--hisab-card)] via-[var(--hisab-card)] to-purple-500/5 p-10 text-center sm:p-14">
        {/* Glow effects */}
        <div className="absolute right-0 top-0 h-40 w-40 animate-pulse rounded-full bg-purple-500/10 blur-3xl" />
        <div
          className="absolute bottom-0 left-0 h-32 w-32 animate-pulse rounded-full bg-cyan-500/10 blur-3xl"
          style={{ animationDelay: "1s" }}
        />

        <div className="relative">
          <h2 className="mb-4 text-4xl font-bold text-[var(--hisab-foreground)]">
            آماده‌ای؟
          </h2>
          <p className="mb-10 text-[var(--hisab-muted-fg)]">
            ۳۰ ثانیه تا اولین فاکتور واقعی
          </p>
          <ShimmerCTA onClick={onNavigateLogin}>
            شروع کن — رایگان
          </ShimmerCTA>
        </div>
      </div>
    </Section>
  )
}