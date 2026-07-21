// packages/ui/src/components/ui/landing/cta-scene.tsx
"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   CTAScene v10 — Universal persona · Positive outcome · Bounded stage
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
      className="relative"
    >
      <div className="border-t border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
        <div
          className={cn(
            "container-narrow max-w-3xl py-16 sm:py-20 lg:py-24 text-center space-y-7 sm:space-y-9",
            "transition-all duration-700 motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
          )}
        >
          {/* ── Headline: universal, outcome-driven ── */}
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-[1.35] text-[hsl(var(--fg-primary))] tracking-tight">
            {t(
              "landing.ctaTitle",
              "وقتی روز کاری‌ات تمام می‌شود، همه‌چیز باید از قبل مشخص باشد",
            )}
          </h2>

          {/* ── Subtitle: paint the positive future ── */}
          <p className="text-sm sm:text-lg text-[hsl(var(--fg-secondary))] leading-relaxed max-w-lg mx-auto">
            {t(
              "landing.ctaSubtitle",
              "با حسابچه، پایان روز یعنی مرور نتایج — نه ساعت‌ها جمع‌زدن و پیدا کردن اشتباه‌ها",
            )}
          </p>

          {/* ── Decision ── */}
          <div>
            <button
              type="button"
              onClick={onNavigateLogin}
              className={cn(
                "btn-primary",
                "rounded-xl px-8 py-3.5 sm:px-10 sm:py-4",
                "min-h-[48px] sm:min-h-[52px]",
                "text-base sm:text-lg",
              )}
            >
              {t("landing.ctaButton", "شروع رایگان")}
              <span className="ms-2 inline-block transition-transform duration-300 group-hover:-translate-x-1 motion-reduce:transform-none">
                ←
              </span>
            </button>
          </div>

          {/* ── Reassurance ── */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs sm:text-sm text-[hsl(var(--fg-tertiary))]">
            <span>{t("landing.ctaReassurance1", "۳۰ ثانیه")}</span>
            <span className="w-1 h-1 rounded-full bg-[hsl(var(--border-default))]" aria-hidden="true" />
            <span>{t("landing.ctaReassurance2", "بدون کارت بانکی")}</span>
            <span className="w-1 h-1 rounded-full bg-[hsl(var(--border-default))]" aria-hidden="true" />
            <span>{t("landing.ctaReassurance3", "لغو هر زمان")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}