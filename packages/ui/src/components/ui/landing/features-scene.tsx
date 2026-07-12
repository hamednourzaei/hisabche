// packages/ui/src/components/ui/landing/features-scene.tsx
"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";
import { Receipt, Package, BookOpen, Smartphone, Wifi, Banknote } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   FeaturesScene v5 — CLS Fixed · GPU-safe
   ✅ Reserved space · will-change · i18n-ready
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FeaturesSceneProps {
  t: (key: string, fallback?: string) => string;
}

const FEATURE_ICONS = [Receipt, Package, BookOpen, Smartphone, Wifi, Banknote];

export default function FeaturesScene({ t }: FeaturesSceneProps) {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.2,
    narrativeState: "confidence",
  });

  const animated = state === "animated";

  return (
    <section
      id="features"
      ref={ref}
      data-narrative="confidence"
      className="section-padding"
    >
      <div className="container-narrow">
        {/* ── Header ── */}
        <div
          className={cn(
            "text-center mb-16 min-h-[120px]",
            "transition-all duration-700 motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          <p className="text-sm uppercase tracking-[0.2em] mb-3 text-[hsl(var(--fg-tertiary))] font-semibold">
            {t("landing.featuresLabel", "ابزارها")}
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[hsl(var(--fg-primary))] tracking-tight">
            {t("landing.featuresTitle", "همه ابزارها در یک جا")}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[hsl(var(--fg-secondary))] leading-relaxed max-w-lg mx-auto">
            {t("landing.featuresDesc", "بدون نیاز به چند برنامه مختلف")}
          </p>
        </div>

        {/* ── Feature cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {FEATURE_ICONS.map((Icon, i) => {
            const key = `feature${i + 1}`;
            return (
              <div
                key={key}
                className={cn(
                  "group relative p-6 sm:p-8 text-center min-h-[220px]",
                  "rounded-[var(--radius-card)]",
                  "border border-[hsl(var(--border-default))]",
                  "bg-[hsl(var(--surface-elevated)/0.6)]",
                  "backdrop-blur-sm",
                  "will-change-transform opacity-0",
                  "transition-all duration-500 motion-reduce:transition-none",
                  "hover:border-[hsl(var(--color-primary)/0.3)] hover:-translate-y-1 hover:shadow-[var(--shadow-premium)]",
                  animated && "opacity-100 translate-y-0 scale-100",
                )}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div
                  className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--color-primary)/0.3)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  aria-hidden="true"
                />

                <div className={cn(
                  "mx-auto mb-5 flex items-center justify-center w-14 h-14 rounded-2xl",
                  "bg-[hsl(var(--color-primary)/0.1)]",
                  "text-[hsl(var(--color-primary))]",
                  "transition-transform duration-300 group-hover:scale-110 motion-reduce:group-hover:scale-100",
                )}>
                  <Icon className="size-7" aria-hidden="true" />
                </div>

                <h3 className="font-bold text-base text-[hsl(var(--fg-primary))] mb-2 min-h-[1.5rem]">
                  {t(`landing.${key}Title`, key)}
                </h3>

                <p className="text-sm text-[hsl(var(--fg-secondary))] leading-relaxed min-h-[2.5rem]">
                  {t(`landing.${key}Desc`, "")}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}