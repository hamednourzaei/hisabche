// packages/ui/src/components/ui/landing/stats-section.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   StatsSection v4 — Premium Animated Counters
   ✅ Glass morphism
   ✅ i18n-ready
   ═══════════════════════════════════════════════════════════════════════════ */

export interface StatsSectionProps {
  t: (key: string, fallback?: string) => string;
}

interface StatItem {
  end: number;
  labelKey: string;
  fallback: string;
}

const STATS: StatItem[] = [
  { end: 1250, labelKey: "landing.stat1", fallback: "فاکتور صادر شده" },
  { end: 340, labelKey: "landing.stat2", fallback: "کسب‌وکار فعال" },
  { end: 8, labelKey: "landing.stat3", fallback: "شهر افغانستان" },
];

function AnimatedCounter({ end, label }: { end: number; label: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !started.current) {
          started.current = true;

          const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (prefersReduced) {
            setCount(end);
            return;
          }

          const duration = 1400;
          const startTime = performance.now();

          const tick = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * end));
            if (progress < 1) requestAnimationFrame(tick);
          };

          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [end]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tabular-nums text-[hsl(var(--fg-primary))] mb-2 tracking-tight">
        {count.toLocaleString("fa-AF")}
        <span className="text-[hsl(var(--color-primary))]">+</span>
      </div>
      <div className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))] font-medium">
        {label}
      </div>
    </div>
  );
}

export default function StatsSection({ t }: StatsSectionProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden",
        "border-y border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-elevated)/0.4)]",
        "backdrop-blur-sm",
        "py-14 sm:py-16 px-6",
      )}
    >
      {/* Subtle glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, hsl(var(--color-primary)/0.06), transparent)",
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-3xl mx-auto grid grid-cols-3 gap-6 sm:gap-10">
        {STATS.map((s) => (
          <AnimatedCounter key={s.labelKey} end={s.end} label={t(s.labelKey, s.fallback)} />
        ))}
      </div>
    </section>
  );
}