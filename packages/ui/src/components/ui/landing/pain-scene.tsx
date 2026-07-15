// packages/ui/src/components/ui/landing/pain-scene.tsx
"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";
import { FileText, Brain, TrendingDown } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   PainScene v6 — CLS Fixed · GPU-safe · Responsive
   ✅ Reserved space · will-change · i18n-ready · Mobile-first
   ═══════════════════════════════════════════════════════════════════════════ */

export interface PainSceneProps {
  t: (key: string, fallback?: string) => string;
}

const ICONS = [FileText, Brain, TrendingDown];

export default function PainScene({ t }: PainSceneProps) {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.3,
    narrativeState: "confusion",
  });

  const animated = state === "animated";

  return (
    <section
      id="pain"
      ref={ref}
      data-narrative="confusion"
      className="section-padding"
    >
      <div className="container-narrow">
        {/* ── Header ── */}
        <div
          className={cn(
            "text-center mb-10 sm:mb-16 min-h-[100px] sm:min-h-[130px]",
            "transition-all duration-700 motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] mb-2 sm:mb-3 text-[hsl(var(--fg-tertiary))] font-semibold">
            {t("landing.painLabel", "قبل از حسابچه")}
          </p>
          <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-[hsl(var(--fg-primary))] tracking-tight">
            {t("landing.painTitle", "دنیای قدیم حسابداری")}
          </h2>
          <p className="mt-3 sm:mt-4 mx-auto max-w-md text-sm sm:text-lg text-[hsl(var(--fg-secondary))] leading-relaxed">
            {t("landing.painDesc", "شاید این مشکلات رو هر روز تجربه می‌کنی")}
          </p>
        </div>

        {/* ── Pain cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {ICONS.map((Icon, i) => {
            const key = `pain${i + 1}`;
            return (
              <div
                key={key}
                className={cn(
                  "group relative text-center p-4 sm:p-8 min-h-[180px] sm:min-h-[240px]",
                  "rounded-[var(--radius-card)]",
                  "border border-[hsl(var(--color-destructive)/0.15)]",
                  "bg-[hsl(var(--surface-elevated)/0.4)]",
                  "max-sm:backdrop-blur-none sm:backdrop-blur-sm",
                  "will-change-transform opacity-0",
                  "transition-all duration-500 motion-reduce:transition-none",
                  "hover:border-[hsl(var(--color-destructive)/0.3)] hover:-translate-y-1",
                  animated && "opacity-100 translate-y-0",
                )}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className={cn(
                  "mx-auto mb-3 sm:mb-5 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl",
                  "bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]",
                  "transition-transform duration-300 group-hover:scale-110 motion-reduce:group-hover:scale-100",
                )}>
                  <Icon className="size-5 sm:size-7" aria-hidden="true" />
                </div>

                <p className="text-base sm:text-lg font-bold mb-1 sm:mb-2 text-[hsl(var(--fg-primary))] min-h-[1.5rem] sm:min-h-[1.75rem]">
                  {t(`landing.${key}Title`, "")}
                </p>

                <p className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))] leading-relaxed min-h-[2rem] sm:min-h-[2.5rem]">
                  {t(`landing.${key}Desc`, "")}
                </p>

                <div className="mt-4 sm:mt-5 mx-auto h-0.5 w-10 rounded-full bg-[hsl(var(--color-destructive)/0.3)]" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}