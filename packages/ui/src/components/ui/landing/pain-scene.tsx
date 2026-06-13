"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   PainScene v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   Zero inline styles — all Tailwind classes
   ═══════════════════════════════════════════════════════════════════════════ */

const pains = [
  { emoji: "📋", text: "دفترها گم میشن", impact: "ساعت‌ها وقت تلف میشه" },
  { emoji: "😰", text: "حساب‌ها فراموش میشن", impact: "بدهی‌ها از یاد میرن" },
  { emoji: "📉", text: "سود واقعی معلوم نیست", impact: "تصمیمات اشتباه میگیری" },
];

export default function PainScene() {
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
        {/* Header */}
        <div
          className={cn(
            "text-center mb-16 transition-all duration-500",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          <p className="text-sm uppercase tracking-[0.2em] mb-3 text-[hsl(var(--fg-tertiary))]">
            قبل از حسابچه
          </p>
          <h2 className="h2 text-[hsl(var(--fg-primary))]">
            دنیای قدیم حسابداری
          </h2>
          <p className="mt-4 mx-auto max-w-md text-lg text-[hsl(var(--fg-secondary))] leading-relaxed">
            شاید این مشکلات رو هر روز تجربه میکنی
          </p>
        </div>

        {/* Pain cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {pains.map((pain, i) => (
            <div
              key={i}
              className={cn(
                "text-center p-8",
                "rounded-[var(--radius-card)]",
                "border border-[hsl(var(--color-destructive)/0.2)]",
                "bg-[hsl(var(--color-destructive)/0.05)]",
                "transition-all duration-500",
                animated
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-6",
              )}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              {/* Emoji */}
              <div className="mx-auto mb-5 flex items-center justify-center w-14 h-14 rounded-full bg-[hsl(var(--color-destructive)/0.1)] text-[1.75rem]">
                {pain.emoji}
              </div>

              {/* Text */}
              <p className="text-lg font-semibold mb-2 text-[hsl(var(--fg-primary))]">
                {pain.text}
              </p>
              <p className="text-sm text-[hsl(var(--fg-secondary))] leading-relaxed">
                {pain.impact}
              </p>

              {/* Divider */}
              <div className="mt-6 mx-auto h-0.5 w-10 rounded-full bg-[hsl(var(--color-destructive)/0.4)]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}