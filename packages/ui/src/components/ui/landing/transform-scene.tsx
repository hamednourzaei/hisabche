// packages/ui/src/components/ui/landing/transform-scene.tsx
"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";
import { ArrowRight, TrendingUp, Package, Clock, Shield, Wallet, Zap } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   TransformScene v7 — Bento outcome grid · Before/After · Emotional
   ═══════════════════════════════════════════════════════════════════════════ */

export interface TransformSceneProps {
  t: (key: string, fallback?: string) => string;
}

/* ── Outcome cards data ────────────────────────────────────────────────── */

const OUTCOMES = [
  {
    key: "speed",
    icon: Zap,
    beforeText: "ثبت دستی، ۲ دقیقه",
    afterText: "ثبت خودکار در ۵ ثانیه",
    metric: "۵×",
    metricLabel: "سریع‌تر",
    emotion: "تمرکز روی فروش، نه نوشتن",
  },
  {
    key: "inventory",
    icon: Package,
    beforeText: "تمام شدن ناگهانی",
    afterText: "هشدار قبل از اتمام",
    metric: "۰",
    metricLabel: "مشتری از دست رفته",
    emotion: "همیشه موجودی آماده",
  },
  {
    key: "profit",
    icon: Wallet,
    beforeText: "سود نامشخص",
    afterText: "سود لحظه‌ای دقیق",
    metric: "۱۰۰٪",
    metricLabel: "شفافیت مالی",
    emotion: "تصمیم‌گیری با اطمینان",
  },
];

/* ── Helper: Number counter animation (visual only) ────────────────────── */

function AnimatedMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-3xl sm:text-4xl font-bold tabular-nums text-[hsl(var(--color-primary))] group-hover:scale-110 transition-transform duration-300 motion-reduce:transform-none">
        {value}
      </span>
      <span className="text-sm text-[hsl(var(--fg-secondary))]">{label}</span>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────────── */

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
      className="section-padding bg-[hsl(var(--surface-muted)/0.2)]"
    >
      <div className="container-narrow max-w-6xl">
        {/* ── Header with transition bridge ── */}
        <div
          className={cn(
            "text-center mb-12 sm:mb-16",
            "transition-all duration-700 motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] mb-3 text-[hsl(var(--fg-tertiary))] font-semibold">
            {t("landing.transformLabel", "بعد از حسابچه")}
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[hsl(var(--fg-primary))] tracking-tight mb-4">
            {t("landing.transformTitle", "کسب‌وکارت بالاخره تحت کنترل توست")}
          </h2>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-[hsl(var(--fg-secondary))] leading-relaxed">
            {t(
              "landing.transformBridge",
              "همین مشکلات دلیلی بود که حسابچه ساخته شد. حالا کنترل کسب‌وکارت را پس بگیر."
            )}
          </p>
        </div>

        {/* ── Hero card ── */}
        <div
          className={cn(
            "relative mb-8 sm:mb-10 overflow-hidden rounded-[var(--radius-2xl)] border border-[hsl(var(--color-primary)/0.2)] bg-[hsl(var(--surface-elevated))] shadow-lg",
            "transition-all duration-700 delay-100 motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-[0.98]",
          )}
        >
          {/* Subtle gradient accent */}
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--color-primary)/0.05)] to-transparent pointer-events-none" />

          <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row items-start lg:items-center gap-6 lg:gap-10">
            {/* Visual stat anchor */}
            <div className="shrink-0 flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))] shadow-inner">
              <TrendingUp className="size-10 sm:size-12" strokeWidth={1.5} />
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-[hsl(var(--fg-primary))]">
                  {t("landing.transformHeroTitle", "صاحب‌اختیار کسب‌وکارت باش")}
                </h3>
                <p className="mt-2 text-sm sm:text-base text-[hsl(var(--fg-secondary))] max-w-xl">
                  {t(
                    "landing.transformHeroDesc",
                    "دیگر لازم نیست نگران دفتر، نسیه‌های فراموش‌شده یا محاسبه‌های اشتباه باشی. حسابچه همه چیز را برایت مدیریت می‌کند."
                  )}
                </p>
              </div>

              {/* Mini live stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                <div className="text-center sm:text-start">
                  <span className="block text-lg sm:text-xl font-bold text-[hsl(var(--color-success))]">
                    +۲ ساعت
                  </span>
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t("landing.transformHeroStat1", "زمان ذخیره‌شده روزانه")}
                  </span>
                </div>
                <div className="text-center sm:text-start">
                  <span className="block text-lg sm:text-xl font-bold text-[hsl(var(--color-success))]">
                    ۰
                  </span>
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t("landing.transformHeroStat2", "نسیه فراموش‌شده")}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1 text-center sm:text-start">
                  <span className="block text-lg sm:text-xl font-bold text-[hsl(var(--color-success))]">
                    ۱۰۰٪
                  </span>
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                    {t("landing.transformHeroStat3", "آفلاین و همیشه در دسترس")}
                  </span>
                </div>
              </div>
            </div>

            {/* Subtle CTA */}
            <a
              href="#interactive-demo"
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))] text-sm font-semibold hover:bg-[hsl(var(--color-primary-hover))] transition-colors self-end lg:self-center"
            >
              {t("landing.transformSeeDemo", "مشاهده دمو")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </a>
          </div>
        </div>

        {/* ── Outcome cards (Bento grid) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {OUTCOMES.map((outcome, i) => {
            const Icon = outcome.icon;
            return (
              <div
                key={outcome.key}
                className={cn(
                  "group relative overflow-hidden rounded-[var(--radius-xl)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5 sm:p-6 transition-all duration-500",
                  "hover:border-[hsl(var(--color-primary)/0.3)] hover:shadow-lg hover:-translate-y-1",
                  "motion-reduce:hover:translate-y-0 motion-reduce:transition-none",
                  animated
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4",
                )}
                style={{ transitionDelay: `${200 + i * 120}ms` }}
              >
                {/* Icon with glow */}
                <div className="relative mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))] group-hover:bg-[hsl(var(--color-primary)/0.15)] transition-colors">
                  <Icon className="size-6" />
                  <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-[hsl(var(--color-primary)/0.2)]" />
                </div>

                {/* Before/After contrast */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-1">
                    <span className="block text-xs text-[hsl(var(--fg-tertiary))] line-through">
                      {outcome.beforeText}
                    </span>
                    <span className="block text-sm font-semibold text-[hsl(var(--color-primary))]">
                      {outcome.afterText}
                    </span>
                  </div>
                  <ArrowRight className="size-4 text-[hsl(var(--fg-tertiary))] shrink-0 mt-0.5 rtl:rotate-180" />
                </div>

                {/* Metric + emotional benefit */}
                <div className="flex items-end justify-between">
                  <AnimatedMetric value={outcome.metric} label={outcome.metricLabel} />
                  <span className="text-xs text-[hsl(var(--fg-secondary))] italic">
                    {outcome.emotion}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}