"use client"

export interface CTASceneProps {
  onNavigateLogin: () => void
}

export default function CTAScene({ onNavigateLogin }: CTASceneProps) {
  return (
    <section className="py-24 px-6">
      <div className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl border border-[var(--hisab-border)] bg-gradient-to-br from-[var(--hisab-card)] via-[var(--hisab-card)] to-purple-500/5 p-12 text-center sm:p-16">
        <div className="absolute right-0 top-0 h-48 w-48 animate-pulse rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-36 w-36 animate-pulse rounded-full bg-cyan-500/10 blur-3xl" style={{ animationDelay: "1s" }} />
        <div className="relative">
          <h2 className="mb-4 text-4xl font-bold text-[var(--hisab-foreground)]">آماده‌ای؟</h2>
          <p className="mb-10 text-[var(--hisab-muted-fg)]">۳۰ ثانیه تا اولین فاکتور واقعی</p>
          <button
            onClick={onNavigateLogin}
            className="rounded-2xl px-10 py-4 text-base font-bold text-white shadow-2xl shadow-purple-500/20 transition-transform hover:scale-105 active:scale-100"
            style={{
              background: "linear-gradient(90deg, #a855f7, #06b6d4, #10b981, #06b6d4, #a855f7)",
              backgroundSize: "200% auto",
              animation: "shimmer 3s linear infinite",
            }}
          >
            شروع کن — رایگان ←
          </button>
        </div>
      </div>
    </section>
  )
}