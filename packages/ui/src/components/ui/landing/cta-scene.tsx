// packages/ui/src/components/ui/landing/cta-scene.tsx
"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CTAScene v5 — CLS Fixed · GPU-safe
   ✅ Reserved space · will-change · i18n-ready
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

  const animated = state === "animated";

  return (
    <section
      id="cta"
      ref={ref}
      data-narrative="action"
      className="relative section-padding overflow-hidden"
    >
      {/* ── Animated gradient background ── */}
      <div className="pointer-events-none absolute inset-0 contain-layout contain-paint" aria-hidden="true">
        <div
          className="absolute w-[700px] h-[700px] rounded-full blur-[150px] animate-[aurora_10s_ease-in-out_infinite] will-change-transform"
          style={{
            background: `radial-gradient(circle, hsl(var(--color-primary)/0.15), transparent 70%)`,
            top: "-30%",
            insetInlineStart: "50%",
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px] animate-[aurora_10s_ease-in-out_infinite_5s] will-change-transform"
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
            "relative overflow-hidden text-center min-h-[380px]",
            "rounded-[var(--radius-card)]",
            "border border-[hsl(var(--color-primary)/0.15)]",
            "bg-[var(--glass-bg)]",
            "backdrop-blur-[var(--glass-blur)]",
            "shadow-[var(--shadow-premium)]",
            "p-[clamp(2.5rem,6vw,4rem)]",
            "will-change-transform opacity-0",
            "transition-all duration-700 motion-reduce:transition-none",
            animated && "opacity-100 scale-100 translate-y-0",
          )}
        >
          <div
            className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--color-primary)/0.4)] to-transparent"
            aria-hidden="true"
          />

          <div
            className="pointer-events-none absolute -end-20 -top-20 w-48 h-48 rounded-full blur-3xl bg-[hsl(var(--color-primary)/0.08)]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -start-20 -bottom-20 w-40 h-40 rounded-full blur-3xl bg-[hsl(var(--color-success)/0.06)]"
            aria-hidden="true"
          />

          <div className="relative space-y-6">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[hsl(var(--fg-primary))] tracking-tight min-h-[3rem]">
              {t("landing.finalCTATitle", "همین امروز شروع کنید")}
            </h2>

            <p className="text-base sm:text-lg text-[hsl(var(--fg-secondary))] leading-relaxed max-w-md mx-auto min-h-[2rem]">
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
                <span
                  className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 motion-reduce:transition-none"
                  style={{
                    background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)",
                  }}
                  aria-hidden="true"
                />
              </button>
            </div>

            <p className="text-xs text-[hsl(var(--fg-tertiary))] min-h-[1rem]">
              {t("landing.trustText", "بدون نیاز به کارت بانکی · لغو آسان")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}