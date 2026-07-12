// packages/ui/src/components/ui/landing/stats-section.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   StatsSection v5 — Optimized Animated Counters
   ✅ RAF throttled · GPU-safe · CLS-free · i18n-ready
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
  const [hydrated, setHydrated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const rafRef = useRef<number>(0);

  // Prevent hydration mismatch — render final value after mount
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !started.current) {
          started.current = true;

          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setCount(end);
            return;
          }

          const duration = 1400;
          const startTime = performance.now();
          let lastValue = 0;

          const tick = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const newValue = Math.round(eased * end);

            // Only setState when value actually changes
            if (newValue !== lastValue) {
              lastValue = newValue;
              setCount(newValue);
            }

            if (progress < 1) {
              rafRef.current = requestAnimationFrame(tick);
            }
          };

          rafRef.current = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end]);

  // Show placeholder with reserved space before hydration
  const displayValue = hydrated ? count.toLocaleString("fa-AF") : end.toLocaleString("fa-AF");

  return (
    <div ref={ref} className="text-center min-w-[80px]">
      <div
        className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tabular-nums text-[hsl(var(--fg-primary))] mb-2 tracking-tight min-h-[3rem]"
        aria-label={`${label}: ${displayValue}+`}
      >
        {displayValue}
        <span className="text-[hsl(var(--color-primary))]">+</span>
      </div>
      <div className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))] font-medium min-h-[1.25rem]">
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
        "py-14 sm:py-16 px-6",
      )}
    >
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