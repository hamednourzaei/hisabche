"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   SocialScene v3 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Redmi 9 optimized
   ═══════════════════════════════════════════════════════════════════════════ */

const testimonials = [
  { name: "احمد رحیمی", role: "سوپرمارکت کابل", text: "از وقتی حسابچه دارم، دیگه دفتر کاغذی ندارم. همه چیز دم دستمه." },
  { name: "فاطمه نوری", role: "بوتیک مزار شریف", text: "بدهی مشتریام همیشه جلومه. دیگه پولم گم نمیشه." },
  { name: "محمد عظیمی", role: "عمده‌فروش هرات", text: "۳ تا گدام دارم. با حسابچه همه رو یه‌جا می‌بینم." },
];

export default function SocialScene() {
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
        {/* Header */}
        <div
          className={cn(
            "text-center mb-16 transition-all duration-500",
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
            <span className="text-[hsl(var(--color-warning))] text-sm leading-none">★</span>
            ۴.۹ · ۳۴۰+ کسب‌وکار فعال
          </div>

          <h2 className="h2 text-[hsl(var(--fg-primary))]">
            اعتماد واقعی
          </h2>
          <p className="mt-4 text-lg text-[hsl(var(--fg-secondary))] leading-relaxed">
            همونایی که مثل تو بودن
          </p>
        </div>

        {/* Testimonial cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className={cn(
                "rounded-[var(--radius-card-sm)] p-8",
                "border border-[hsl(var(--border-default))]",
                "bg-[hsl(var(--surface-muted)/0.6)]",
                "transition-all duration-500",
                "motion-reduce:transition-none",
                "hover:border-[hsl(var(--color-primary)/0.35)] hover:-translate-y-1",
                "motion-reduce:hover:translate-y-0 motion-reduce:hover:border-[hsl(var(--border-default))]",
                animated
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-5",
              )}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, s) => (
                  <svg
                    key={s}
                    viewBox="0 0 16 16"
                    className="w-3.5 h-3.5 fill-[hsl(var(--color-warning))]"
                    aria-hidden="true"
                  >
                    <path d="M8 1l1.9 3.9L14 5.8l-3 2.9.7 4.1L8 10.8l-3.7 2 .7-4.1-3-2.9 4.1-.9z" />
                  </svg>
                ))}
              </div>

              {/* Text */}
              <p className="text-[hsl(var(--fg-primary))] text-[0.938rem] leading-relaxed mb-6">
                «{t.text}»
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-[hsl(var(--color-primary)/0.25)] to-[hsl(190_90%_50%/0.15)] text-[hsl(var(--color-primary))] font-bold text-base border border-[hsl(var(--color-primary)/0.3)] shrink-0"
                  aria-hidden="true"
                >
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-sm text-[hsl(var(--fg-primary))]">
                    {t.name}
                  </div>
                  <div className="text-xs text-[hsl(var(--fg-secondary))]">
                    {t.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}