"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   FeaturesScene v3 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Redmi 9 optimized
   ═══════════════════════════════════════════════════════════════════════════ */

const features = [
  { emoji: "🧾", title: "فاکتور در ۳۰ ثانیه", desc: "محصول از گدام، مشتری از دفتر تلفن." },
  { emoji: "📦", title: "گدام خودکار", desc: "ورود و خروج با هر فاکتور." },
  { emoji: "📒", title: "بدهی یادت بمونه", desc: "پرداخت در ۲ کلیک." },
  { emoji: "📱", title: "تو جیب شماست", desc: "موبایل، تبلت، کامپیوتر." },
  { emoji: "🔌", title: "آفلاین واقعی", desc: "اینترنت نیست؟ مشکلی نیست." },
  { emoji: "💱", title: "افغانی · دلار · تومان", desc: "تبدیل خودکار." },
];

export default function FeaturesScene() {
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
        {/* Header */}
        <div
          className={cn(
            "text-center mb-16 transition-all duration-500",
            "motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          <p className="text-sm uppercase tracking-[0.2em] mb-3 text-[hsl(var(--fg-tertiary))]">
            ابزارها
          </p>
          <h2 className="h2 text-[hsl(var(--fg-primary))]">
            همه چیزی که نیاز داری
          </h2>
          <p className="mt-4 text-lg text-[hsl(var(--fg-secondary))] leading-relaxed">
            هیچ چیز اضافه، هیچ چیز کم
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div
              key={i}
              className={cn(
                "p-6 text-center",
                "rounded-[var(--radius-card-sm)]",
                "border border-[hsl(var(--border-default))]",
                "bg-[hsl(var(--surface-muted)/0.4)]",
                "transition-all duration-500",
                "motion-reduce:transition-none",
                animated
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 translate-y-4 scale-[0.97]",
              )}
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              {/* Icon */}
              <div className="mx-auto mb-4 flex items-center justify-center w-12 h-12 rounded-2xl bg-[hsl(190_90%_50%/0.08)] text-2xl">
                {f.emoji}
              </div>

              {/* Title */}
              <h3 className="font-semibold mb-2 text-sm text-[hsl(var(--fg-primary))]">
                {f.title}
              </h3>

              {/* Description */}
              <p className="text-xs text-[hsl(var(--fg-secondary))] leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}