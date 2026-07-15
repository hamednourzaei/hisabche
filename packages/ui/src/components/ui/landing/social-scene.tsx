// packages/ui/src/components/ui/landing/social-scene.tsx
"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   SocialScene v6 — CLS Fixed · GPU-safe · Responsive
   ✅ Reserved space · will-change · i18n-ready · Mobile-first
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SocialSceneProps {
  t: (key: string, fallback?: string) => string;
}

const TESTIMONIAL_COUNT = 3;

export default function SocialScene({ t }: SocialSceneProps) {
  const { ref, state } = useSceneObserver<HTMLDivElement>({
    threshold: 0.3,
    narrativeState: "trust",
  });

  const animated = state === "animated";

  return (
    <section
      id="testimonials"
      ref={ref}
      data-narrative="trust"
      className="section-padding border-y border-[hsl(var(--border-default))]"
    >
      <div className="container-narrow">
        {/* ── Header ── */}
        <div
          className={cn(
            "text-center mb-10 sm:mb-16 min-h-[120px] sm:min-h-[140px]",
            "transition-all duration-700 motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          <div
            className={cn(
              "inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 text-xs sm:text-sm mb-4 sm:mb-6",
              "rounded-full",
              "border border-[hsl(var(--border-default))]",
              "bg-[hsl(var(--surface-muted))]",
              "text-[hsl(var(--fg-secondary))]",
            )}
          >
            <span className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-3 sm:size-3.5 fill-[hsl(var(--color-warning))] text-[hsl(var(--color-warning))]" aria-hidden="true" />
              ))}
            </span>
            {t("landing.rating", "۴.۹ · ۳۴۰+ کسب‌وکار فعال")}
          </div>

          <h2 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-[hsl(var(--fg-primary))] tracking-tight">
            {t("landing.testimonialsTitle", "اعتماد واقعی")}
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-[hsl(var(--fg-secondary))] leading-relaxed">
            {t("landing.testimonialsDesc", "همونایی که مثل تو بودن")}
          </p>
        </div>

        {/* ── Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {Array.from({ length: TESTIMONIAL_COUNT }).map((_, i) => {
            const key = `testimonial${i + 1}`;
            return (
              <div
                key={key}
                className={cn(
                  "group relative p-4 sm:p-8 min-h-[280px] sm:min-h-[320px]",
                  "rounded-[var(--radius-card)]",
                  "border border-[hsl(var(--border-default))]",
                  "bg-[hsl(var(--surface-elevated)/0.6)]",
                  "max-sm:backdrop-blur-none sm:backdrop-blur-sm",
                  "will-change-transform opacity-0",
                  "transition-all duration-500 motion-reduce:transition-none",
                  "hover:border-[hsl(var(--color-primary)/0.3)] hover:-translate-y-1 hover:shadow-[var(--shadow-premium)]",
                  animated && "opacity-100 translate-y-0",
                )}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div
                  className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--color-primary)/0.2)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  aria-hidden="true"
                />

                <div className="flex gap-0.5 sm:gap-1 mb-3 sm:mb-4">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="size-3 sm:size-4 fill-[hsl(var(--color-warning))] text-[hsl(var(--color-warning))]" aria-hidden="true" />
                  ))}
                </div>

                <p className="text-[hsl(var(--fg-primary))] text-sm sm:text-base leading-relaxed mb-4 sm:mb-6 min-h-[3rem] sm:min-h-[4rem]">
                  «{t(`landing.${key}Text`, "")}»
                </p>

                <div className="flex items-center gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-[hsl(var(--border-default))]">
                  <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] font-bold text-xs sm:text-sm border border-[hsl(var(--color-primary)/0.2)] shrink-0">
                    {t(`landing.${key}Name`, "").charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs sm:text-sm text-[hsl(var(--fg-primary))] truncate">
                      {t(`landing.${key}Name`, "")}
                    </div>
                    <div className="text-[10px] sm:text-xs text-[hsl(var(--fg-secondary))] truncate">
                      {t(`landing.${key}Role`, "")}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}