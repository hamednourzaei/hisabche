"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   TransformScene v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Zero inline styles — all Tailwind classes (except dynamic delays)
   ═══════════════════════════════════════════════════════════════════════════ */

const solutions = [
  { icon: "🧾", title: "فاکتور لحظه‌ای", desc: "صدور در ۳۰ ثانیه", benefit: "دیگه مشتری منتظر نمیمونه" },
  { icon: "📦", title: "گدام زنده", desc: "موجودی همیشه آپدیت", benefit: "فروش خارج از انبار نداریم" },
  { icon: "📒", title: "بدهی شفاف", desc: "هر بدهی ثبت و پیگیری", benefit: "پولت گم نمیشه" },
];

export default function TransformScene() {
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
        {/* Header */}
        <div
          className={cn(
            "text-center mb-14 transition-all duration-500",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          <p className="text-sm uppercase tracking-[0.2em] mb-3 text-[hsl(var(--fg-tertiary))]">
            بعد از حسابچه
          </p>
          <h2 className="h2 mb-6 text-[hsl(var(--fg-primary))]">
            همه چیز در یک جا
          </h2>
          <p className="mx-auto max-w-xl text-lg text-[hsl(var(--fg-secondary))] leading-relaxed">
            فاکتور، گدام، بدهی… همه در لحظه. بدون کاغذ، بدون فراموشی.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {solutions.map((item, i) => (
            <div
              key={i}
              className={cn(
                "text-center p-8",
                "rounded-[var(--radius-card)]",
                "border border-[hsl(var(--color-primary)/0.2)]",
                "bg-[hsl(var(--color-primary)/0.05)]",
                "transition-all duration-500",
                animated
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-6",
              )}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              {/* Icon */}
              <div className="mx-auto mb-5 flex items-center justify-center w-14 h-14 rounded-full bg-[hsl(var(--color-primary)/0.12)] text-[1.75rem]">
                {item.icon}
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold mb-2 text-[hsl(var(--fg-primary))]">
                {item.title}
              </h3>

              {/* Description */}
              <p className="text-sm font-medium mb-3 text-[hsl(var(--color-primary))]">
                {item.desc}
              </p>

              {/* Benefit */}
              <p className="text-xs text-[hsl(var(--fg-secondary))] leading-relaxed">
                {item.benefit}
              </p>

              {/* Bottom accent */}
              <div className="mt-6 mx-auto h-0.5 w-10 rounded-full bg-[hsl(var(--color-primary)/0.4)]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}