// packages/ui/src/components/ui/landing/transform-scene.tsx
"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";
import { Zap, Box, Wallet } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   TransformScene v6 — CLS Fixed · GPU-safe · Responsive
   ✅ Reserved space · will-change · i18n-ready · Mobile-first
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TransformSceneProps {
  t: (key: string, fallback?: string) => string;
}

const ICONS = [Zap, Box, Wallet];

export default function TransformScene({ t }: TransformSceneProps) {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.3,
    narrativeState: "clarity",
  });

  const animated = state === "animated";

  return (
    <section
      id="transform"
      ref={ref}
      data-narrative="clarity"
      className="section-padding bg-[hsl(var(--surface-muted)/0.3)]"
    >
      <div className="container-narrow">
        {/* ── Header ── */}
        <div
          className={cn(
            "text-center mb-10 sm:mb-14 min-h-[100px] sm:min-h-[120px]",
            "transition-all duration-700 motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] mb-2 sm:mb-3 text-[hsl(var(--fg-tertiary))] font-semibold">
            {t("landing.transformLabel", "بعد از حسابچه")}
          </p>
          <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-[hsl(var(--fg-primary))] tracking-tight mb-3 sm:mb-4">
            {t("landing.transformTitle", "همه چیز در یک جا")}
          </h2>
          <p className="mx-auto max-w-xl text-sm sm:text-lg text-[hsl(var(--fg-secondary))] leading-relaxed">
            {t("landing.transformDesc", "فاکتور، گدام، بدهی… همه در لحظه. بدون کاغذ، بدون فراموشی.")}
          </p>
        </div>

        {/* ── Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {ICONS.map((Icon, i) => {
            const key = `solution${i + 1}`;
            return (
              <div
                key={key}
                className={cn(
                  "group relative text-center p-4 sm:p-8 min-h-[220px] sm:min-h-[280px]",
                  "rounded-[var(--radius-card)]",
                  "border border-[hsl(var(--color-primary)/0.15)]",
                  "bg-[hsl(var(--surface-elevated)/0.4)]",
                  "max-sm:backdrop-blur-none sm:backdrop-blur-sm",
                  "will-change-transform opacity-0",
                  "transition-all duration-500 motion-reduce:transition-none",
                  "hover:border-[hsl(var(--color-primary)/0.3)] hover:-translate-y-1 hover:shadow-[var(--shadow-premium)]",
                  animated && "opacity-100 translate-y-0",
                )}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div
                  className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--color-primary)/0.3)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  aria-hidden="true"
                />

                <div className={cn(
                  "mx-auto mb-3 sm:mb-5 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl",
                  "bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]",
                  "transition-transform duration-300 group-hover:scale-110 motion-reduce:group-hover:scale-100",
                )}>
                  <Icon className="size-5 sm:size-7" aria-hidden="true" />
                </div>

                <h3 className="text-base sm:text-lg font-bold mb-1 sm:mb-2 text-[hsl(var(--fg-primary))] min-h-[1.25rem] sm:min-h-[1.5rem]">
                  {t(`landing.${key}Title`, "")}
                </h3>

                <p className="text-xs sm:text-sm font-semibold mb-1 sm:mb-2 text-[hsl(var(--color-primary))] min-h-[1rem] sm:min-h-[1.25rem]">
                  {t(`landing.${key}Sub`, "")}
                </p>

                <p className="text-[10px] sm:text-xs text-[hsl(var(--fg-secondary))] leading-relaxed min-h-[2rem] sm:min-h-[2.5rem]">
                  {t(`landing.${key}Desc`, "")}
                </p>

                <div className="mt-4 sm:mt-5 mx-auto h-0.5 w-10 rounded-full bg-[hsl(var(--color-primary)/0.3)]" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}