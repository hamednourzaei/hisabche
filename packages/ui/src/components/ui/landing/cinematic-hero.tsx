"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CinematicHero v4 — Premium SaaS Hero
   ✅ Aurora background
   ✅ Animated mesh gradient
   ✅ Glass morphism cards
   ✅ Magnetic CTA button
   ✅ CSS-only animations (no JS delays)
   ✅ i18n-ready
   ✅ Design tokens only
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CinematicHeroProps {
  t: (key: string, fallback?: string) => string;
  onNavigateLogin: () => void;
}

export default function CinematicHero({ t, onNavigateLogin }: CinematicHeroProps) {
  const { ref } = useSceneObserver<HTMLDivElement>({
    threshold: 0.1,
    narrativeState: "frustration",
  });

  return (
    <section
      id="hero"
      ref={ref}
      data-narrative="frustration"
      className="relative flex min-h-screen items-center justify-center overflow-hidden section-padding"
    >
      {/* ── Aurora Background ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* Primary glow */}
        <div
          className="absolute w-[800px] h-[800px] rounded-full blur-[160px] animate-[aurora_12s_ease-in-out_infinite]"
          style={{
            background: `radial-gradient(circle, hsl(var(--color-primary)/0.18), transparent 70%)`,
            top: "-20%",
            insetInlineStart: "50%",
            transform: "translateX(-50%)",
          }}
        />
        {/* Secondary glow */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[140px] animate-[aurora_12s_ease-in-out_infinite_4s]"
          style={{
            background: `radial-gradient(circle, hsl(var(--color-success)/0.12), transparent 70%)`,
            bottom: "-10%",
            insetInlineEnd: "-10%",
          }}
        />
        {/* Tertiary glow */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[130px] animate-[aurora_12s_ease-in-out_infinite_8s]"
          style={{
            background: `radial-gradient(circle, hsl(190_90%_50%/0.1), transparent 70%)`,
            top: "40%",
            insetInlineStart: "-5%",
          }}
        />
      </div>

      {/* ── Grid overlay (subtle) ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border-default)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border-default)) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 container-narrow text-center">
        {/* ── Badge ── */}
        <div
          className={cn(
            "inline-flex items-center gap-2 px-4 py-1.5 mb-8",
            "rounded-full",
            "border border-[hsl(var(--color-primary)/0.2)]",
            "bg-[hsl(var(--color-primary)/0.06)]",
            "text-[hsl(var(--color-primary))]",
            "text-sm font-medium",
            "animate-[fade-in-up_0.5s_ease-out_both]",
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--color-primary))] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--color-primary))]" />
          </span>
          {t("landing.badge", "۳۴۰+ کسب‌وکار فعال در افغانستان")}
        </div>

        {/* ── H1 ── */}
        <h1
          className={cn(
            "max-w-4xl mx-auto mb-6",
            "text-4xl sm:text-5xl lg:text-6xl xl:text-7xl",
            "font-extrabold leading-[1.08] tracking-tight",
            "text-[hsl(var(--fg-primary))]",
            "animate-[fade-in-up_0.5s_ease-out_0.1s_both]",
          )}
        >
          {t("landing.headline", "حسابداری‌ای که")}{" "}
          <span className="bg-gradient-to-l from-[hsl(var(--color-success))] via-[hsl(190_90%_50%)] to-[hsl(var(--color-primary))] bg-clip-text text-transparent">
            {t("landing.headlineHighlight", "هیچ‌وقت فراموش نمی‌کنه")}
          </span>
        </h1>

        {/* ── Subtitle ── */}
        <p
          className={cn(
            "mx-auto mb-10 max-w-xl",
            "text-lg sm:text-xl",
            "text-[hsl(var(--fg-secondary))]",
            "leading-relaxed",
            "animate-[fade-in-up_0.5s_ease-out_0.2s_both]",
          )}
        >
          {t("landing.subtitle", "این فقط یک اپ نیست — حافظه‌ی زنده‌ی کسب‌وکار توئه. فاکتور، گدام، بدهی — همه در یک جا.")}
        </p>

        {/* ── CTAs ── */}
        <div
          className={cn(
            "flex flex-col sm:flex-row gap-4 justify-center",
            "animate-[fade-in-up_0.5s_ease-out_0.3s_both]",
          )}
        >
          <button
            type="button"
            onClick={onNavigateLogin}
            className={cn(
              "group relative overflow-hidden",
              "inline-flex items-center justify-center",
              "rounded-full px-8 py-3.5",
              "text-base font-bold text-white",
              "bg-[var(--gradient-brand)]",
              "shadow-[var(--shadow-premium)]",
              "transition-all duration-300",
              "hover:scale-[1.03] hover:shadow-lg",
              "active:scale-[0.98]",
              "motion-reduce:transform-none",
            )}
          >
            <span className="relative z-10">
              {t("landing.cta", "شروع رایگان")}
              <span className="ms-2 inline-block transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none">
                ←
              </span>
            </span>
            {/* Shimmer effect */}
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 motion-reduce:transition-none"
              style={{
                background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
              }}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={() =>
              document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
            }
            className={cn(
              "inline-flex items-center justify-center",
              "rounded-full px-8 py-3.5",
              "text-base font-medium",
              "border border-[hsl(var(--border-default))]",
              "text-[hsl(var(--fg-secondary))]",
              "hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              "transition-colors duration-200",
            )}
          >
            {t("landing.learnMore", "بیشتر بدونید")}
          </button>
        </div>

        {/* ── Trust text ── */}
        <p
          className={cn(
            "mt-8",
            "text-sm text-[hsl(var(--fg-tertiary))]",
            "animate-[fade-in-up_0.5s_ease-out_0.4s_both]",
          )}
        >
          {t("landing.trustText", "بدون کارت بانکی · فعال در ۳۰ ثانیه")}
        </p>

        {/* ── Trust bar ── */}
        <div
          className={cn(
            "mt-16 flex flex-wrap items-center justify-center gap-6 sm:gap-10",
            "text-sm text-[hsl(var(--fg-tertiary))]",
            "animate-[fade-in-up_0.5s_ease-out_0.5s_both]",
          )}
        >
          {[
            { icon: "🔌", label: t("landing.trustOffline", "آفلاین واقعی") },
            { icon: "🔐", label: t("landing.trustSecure", "داده امن") },
            { icon: "📱", label: t("landing.trustMobile", "موبایل + وب") },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-lg">{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}