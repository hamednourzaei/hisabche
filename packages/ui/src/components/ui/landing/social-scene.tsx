// packages/ui/src/components/ui/landing/social-scene.tsx
"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   SocialScene v4 — Premium Testimonials
   ✅ Lucide icons
   ✅ Glass morphism
   ✅ i18n-ready
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
            "text-center mb-16 transition-all duration-700",
            "motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          {/* Rating badge */}
          <div
            className={cn(
              "inline-flex items-center gap-2 px-4 py-1.5 text-sm mb-6",
              "rounded-full",
              "border border-[hsl(var(--border-default))]",
              "bg-[hsl(var(--surface-muted))]",
              "text-[hsl(var(--fg-secondary))]",
            )}
          >
            <span className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-3.5 fill-[hsl(var(--color-warning))] text-[hsl(var(--color-warning))]" aria-hidden="true" />
              ))}
            </span>
            {t("landing.rating", "۴.۹ · ۳۴۰+ کسب‌وکار فعال")}
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[hsl(var(--fg-primary))] tracking-tight">
            {t("landing.testimonialsTitle", "اعتماد واقعی")}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[hsl(var(--fg-secondary))] leading-relaxed">
            {t("landing.testimonialsDesc", "همونایی که مثل تو بودن")}
          </p>
        </div>

        {/* ── Cards ── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: TESTIMONIAL_COUNT }).map((_, i) => {
            const key = `testimonial${i + 1}`;
            return (
              <div
                key={key}
                className={cn(
                  "group relative p-8",
                  "rounded-[var(--radius-card)]",
                  "border border-[hsl(var(--border-default))]",
                  "bg-[hsl(var(--surface-elevated)/0.6)]",
                  "backdrop-blur-sm",
                  "transition-all duration-500",
                  "hover:border-[hsl(var(--color-primary)/0.3)] hover:-translate-y-1 hover:shadow-[var(--shadow-premium)]",
                  "motion-reduce:hover:transform-none",
                  animated
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-5",
                )}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                {/* Top glow */}
                <div
                  className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--color-primary)/0.2)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  aria-hidden="true"
                />

                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="size-4 fill-[hsl(var(--color-warning))] text-[hsl(var(--color-warning))]" aria-hidden="true" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-[hsl(var(--fg-primary))] text-base leading-relaxed mb-6">
                  «{t(`landing.${key}Text`, "")}»
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t border-[hsl(var(--border-default))]">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] font-bold text-sm border border-[hsl(var(--color-primary)/0.2)] shrink-0">
                    {t(`landing.${key}Name`, "").charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[hsl(var(--fg-primary))]">
                      {t(`landing.${key}Name`, "")}
                    </div>
                    <div className="text-xs text-[hsl(var(--fg-secondary))]">
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