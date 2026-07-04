// packages/ui/src/components/ui/landing/cta-scene.tsx
"use client";

import { useSceneObserver } from "./use-scene-observer";
import { useScrollNarrative } from "./use-scroll-narrative-store";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CTAScene v4 — Premium Glass CTA
   ✅ Glass morphism
   ✅ Animated gradient background
   ✅ Magnetic button
   ✅ i18n-ready
   ✅ Design tokens only
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CTASceneProps {
  t: (key: string, fallback?: string) => string;
  onNavigateLogin: () => void;
}

export default function CTAScene({ t, onNavigateLogin }: CTASceneProps) {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.3,
    narrativeState: "action",
  });

  const { narrativeState } = useScrollNarrative();
  const animated = state === "animated";

  return (
    <section
      id="cta"
      ref={ref}
      data-narrative="action"
      className="relative section-padding overflow-hidden"
    >
      {/* ── Animated gradient background ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute w-[700px] h-[700px] rounded-full blur-[150px] animate-[aurora_10s_ease-in-out_infinite]"
          style={{
            background: `radial-gradient(circle, hsl(var(--color-primary)/0.15), transparent 70%)`,
            top: "-30%",
            insetInlineStart: "50%",
            transform: "translateX(-50%)",
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px] animate-[aurora_10s_ease-in-out_infinite_5s]"
          style={{
            background: `radial-gradient(circle, hsl(var(--color-success)/0.1), transparent 70%)`,
            bottom: "-20%",
            insetInlineEnd: "-10%",
          }}
        />
      </div>

      <div className="container-narrow max-w-2xl relative z-10">
        <div
          className={cn(
            "relative overflow-hidden text-center",
            "rounded-[var(--radius-card)]",
            "border border-[hsl(var(--color-primary)/0.15)]",
            "bg-[var(--glass-bg)]",
            "backdrop-blur-[var(--glass-blur)]",
            "shadow-[var(--shadow-premium)]",
            "p-[clamp(2.5rem,6vw,4rem)]",
            "transition-all duration-700",
            "motion-reduce:transition-none",
            animated
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-[0.97] translate-y-4",
          )}
        >
          {/* ── Top glow line ── */}
          <div
            className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--color-primary)/0.4)] to-transparent"
            aria-hidden="true"
          />

          {/* ── Corner glows ── */}
          <div
            className="pointer-events-none absolute -end-20 -top-20 w-48 h-48 rounded-full blur-3xl bg-[hsl(var(--color-primary)/0.08)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -start-20 -bottom-20 w-40 h-40 rounded-full blur-3xl bg-[hsl(var(--color-success)/0.06)]"
            aria-hidden="true"
          />

          {/* ── Content ── */}
          <div className="relative space-y-6">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[hsl(var(--fg-primary))] tracking-tight">
              {t("landing.finalCTATitle", "همین امروز شروع کنید")}
            </h2>

            <p className="text-base sm:text-lg text-[hsl(var(--fg-secondary))] leading-relaxed max-w-md mx-auto">
              {t("landing.finalCTADesc", "رایگان. بدون کارت بانکی. کمتر از ۱ دقیقه.")}
            </p>

            <div className="pt-4">
              <button
                type="button"
                onClick={onNavigateLogin}
                className={cn(
                  "group relative overflow-hidden",
                  "inline-flex items-center justify-center",
                  "rounded-full px-10 py-4",
                  "text-lg font-bold text-white",
                  "bg-[var(--gradient-brand)]",
                  "shadow-[var(--shadow-premium)]",
                  "transition-all duration-300",
                  "hover:scale-[1.04] hover:shadow-xl",
                  "active:scale-[0.98]",
                  "motion-reduce:transform-none",
                )}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {t("landing.finalCTAButton", "شروع رایگان")}
                  <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1 motion-reduce:transform-none">
                    ←
                  </span>
                </span>
                {/* Shimmer */}
                <span
                  className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 motion-reduce:transition-none"
                  style={{
                    background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)",
                  }}
                  aria-hidden="true"
                />
              </button>
            </div>

            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t("landing.trustText", "بدون نیاز به کارت بانکی · لغو آسان")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}