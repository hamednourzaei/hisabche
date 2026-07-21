// packages/ui/src/components/ui/landing/pricing-scene.tsx
"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Check, Minus, ChevronDown } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   PricingScene v7 — Fully self-contained · Zero external dependencies
   ═══════════════════════════════════════════════════════════════════════════ */

// پراپز کاملاً آپشنال — کامپوننت خودش همه چی رو handle میکنه
export interface PricingSceneProps {
  t?: (key: string, fallback?: string) => string;
  onNavigateLogin?: () => void;
}

const POPULAR_BG = "bg-[hsl(var(--color-primary)/0.04)]";
const POPULAR_BORDER = "border-[hsl(var(--color-primary)/0.25)]";
const STRIPE_ROW = "bg-[hsl(var(--surface-muted)/0.2)]";

interface Plan {
  key: string;
  fallbackName: string;
  fallbackWho: string;
  fallbackBestIf: string;
  price: number | null;
  ctaFallback: string;
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    key: "free",
    fallbackName: "رایگان",
    fallbackWho: "برای شروع",
    fallbackBestIf: "تازه‌کار",
    price: 0,
    ctaFallback: "شروع رایگان",
  },
  {
    key: "pro",
    fallbackName: "حرفه‌ای",
    fallbackWho: "برای اکثر کسب‌وکارها",
    fallbackBestIf: "فروش روزانه",
    price: 499,
    ctaFallback: "ارتقا به حرفه‌ای",
    popular: true,
  },
  {
    key: "business",
    fallbackName: "تجاری",
    fallbackWho: "برای شرکت‌ها",
    fallbackBestIf: "چند شعبه",
    price: null,
    ctaFallback: "تماس با فروش",
  },
];

interface FeatureRow {
  labelKey: string;
  fallback: string;
  values: ("check" | "dash" | string)[];
}

interface FeatureGroup {
  groupKey: string;
  fallbackGroup: string;
  rows: FeatureRow[];
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    groupKey: "sales",
    fallbackGroup: "فروش",
    rows: [
      { labelKey: "invoices", fallback: "فاکتور فروش", values: ["۵۰ در ماه", "نامحدود", "نامحدود"] },
      { labelKey: "pos", fallback: "ثبت سریع فروش", values: ["check", "check", "check"] },
      { labelKey: "debt", fallback: "مدیریت بدهی", values: ["check", "check", "check"] },
    ],
  },
  {
    groupKey: "inventory",
    fallbackGroup: "انبار",
    rows: [
      { labelKey: "stock", fallback: "موجودی کالا", values: ["check", "check", "check"] },
      { labelKey: "lowStockAlert", fallback: "هشدار کمبود", values: ["check", "check", "check"] },
      { labelKey: "multiWarehouse", fallback: "چند انبار", values: ["dash", "dash", "check"] },
    ],
  },
  {
    groupKey: "reports",
    fallbackGroup: "گزارش‌ها",
    rows: [
      { labelKey: "basicReports", fallback: "گزارش فروش و سود", values: ["check", "check", "check"] },
      { labelKey: "advancedReports", fallback: "گزارش‌های پیشرفته", values: ["dash", "check", "check"] },
      { labelKey: "export", fallback: "خروجی Excel و PDF", values: ["check", "check", "check"] },
    ],
  },
  {
    groupKey: "platform",
    fallbackGroup: "پلتفرم",
    rows: [
      { labelKey: "offline", fallback: "آفلاین کامل", values: ["check", "check", "check"] },
      { labelKey: "backup", fallback: "بک‌آپ خودکار", values: ["dash", "check", "check"] },
      { labelKey: "users", fallback: "تعداد کاربران", values: ["۱", "۵", "نامحدود"] },
      { labelKey: "branches", fallback: "چند شعبه", values: ["dash", "dash", "check"] },
      { labelKey: "api", fallback: "دسترسی API", values: ["dash", "check", "check"] },
    ],
  },
  {
    groupKey: "support",
    fallbackGroup: "پشتیبانی",
    rows: [
      { labelKey: "emailSupport", fallback: "پشتیبانی ایمیل", values: ["check", "check", "check"] },
      { labelKey: "prioritySupport", fallback: "پشتیبانی اولویت‌دار", values: ["dash", "check", "check"] },
      { labelKey: "dedicatedManager", fallback: "مدیر حساب اختصاصی", values: ["dash", "dash", "check"] },
    ],
  },
];

function Cell({ value }: { value: "check" | "dash" | string }) {
  if (value === "check") return <Check className="size-4 text-[hsl(var(--color-success))] mx-auto" aria-hidden="true" />;
  if (value === "dash") return <Minus className="size-4 text-[hsl(var(--fg-tertiary))] mx-auto" aria-hidden="true" />;
  return <span className="text-xs sm:text-sm tabular-nums text-[hsl(var(--fg-secondary))]">{value}</span>;
}

export default function PricingScene(props: PricingSceneProps) {
  const router = useRouter();
  const { t } = useTranslation();

  // st: safe translate — فقط از useTranslation داخلی استفاده کن، props رو ignore کن
  // این باعث میشه حتی اگه t توی props نیاد یا undefined باشه، کار کنه
  const st = (key: string, fallback?: string): string => {
    if (typeof t === "function") {
      const result = t(key);
      if (typeof result === "string" && result !== key) return result;
    }
    return fallback ?? key;
  };

  const onNavigateLogin = () => {
    if (typeof props.onNavigateLogin === "function") {
      props.onNavigateLogin();
    } else {
      router.push("/login");
    }
  };

  const ref = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);
  const [mobilePlan, setMobilePlan] = useState(1);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const allMobileFeatures = useMemo(() => FEATURE_GROUPS.flatMap((g) => g.rows), []);

  return (
    <section id="pricing" ref={ref} className="section-padding bg-[hsl(var(--surface-muted)/0.3)]">
      <div className="container-narrow max-w-4xl">
        <div
          className={cn(
            "text-center mb-12 sm:mb-16",
            "transition-all duration-700 motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] mb-2 sm:mb-3 text-[hsl(var(--fg-tertiary))] font-semibold">
            {st("landing.pricingLabel", "تعرفه‌ها")}
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[hsl(var(--fg-primary))] tracking-tight">
            {st("landing.pricingTitle", "از رایگان شروع کنید، هر زمان خواستید ارتقا دهید")}
          </h2>
        </div>

        {/* Mobile */}
        <div className="sm:hidden">
          <div className="flex bg-[hsl(var(--surface-muted))] rounded-xl p-1 mb-6">
            {PLANS.map((plan, i) => (
              <button
                key={plan.key}
                type="button"
                onClick={() => {
                  setMobilePlan(i);
                  setMobileFeaturesOpen(false);
                }}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-semibold transition-all",
                  mobilePlan === i
                    ? "bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))] shadow-sm"
                    : "text-[hsl(var(--fg-tertiary))]",
                )}
              >
                {st(`landing.pricing.${plan.key}.name`, plan.fallbackName)}
              </button>
            ))}
          </div>

          {PLANS.map(
            (plan, i) =>
              mobilePlan === i && (
                <div
                  key={plan.key}
                  className={cn(
                    "relative rounded-[var(--radius-xl)] border p-6 space-y-4",
                    plan.popular
                      ? `${POPULAR_BORDER} ${POPULAR_BG} shadow-[var(--shadow-premium)]`
                      : "border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]",
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 rounded-full text-[11px] font-semibold text-white bg-[var(--gradient-brand)] shadow-sm">
                        {st("landing.pricingPopular", "محبوب‌ترین")}
                      </span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
                      {st(`landing.pricing.${plan.key}.name`, plan.fallbackName)}
                    </h3>
                    <p className="text-sm text-[hsl(var(--fg-tertiary))]">
                      {st(`landing.pricing.${plan.key}.bestIf`, plan.fallbackBestIf)}
                    </p>
                  </div>

                  <div className="min-h-[2.5rem] flex items-end gap-1">
                    {plan.price === null ? (
                      <span className="text-xl font-bold">تماس بگیرید</span>
                    ) : plan.price === 0 ? (
                      <span className="text-3xl font-extrabold">رایگان</span>
                    ) : (
                      <>
                        <span className="text-3xl font-extrabold tabular-nums">
                          {plan.price.toLocaleString("fa-AF")}
                        </span>
                        <span className="text-sm text-[hsl(var(--fg-tertiary))] mb-1">افغانی / ماه</span>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onNavigateLogin}
                    className={cn(
                      "w-full rounded-xl py-3 text-sm font-semibold min-h-[44px] transition-all duration-200",
                      plan.popular
                        ? "text-white bg-[var(--gradient-brand)] hover:opacity-90"
                        : "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]",
                    )}
                  >
                    {st(`landing.pricing.${plan.key}.cta`, plan.ctaFallback)}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMobileFeaturesOpen(!mobileFeaturesOpen)}
                    className="flex items-center gap-1 text-sm text-[hsl(var(--fg-secondary))]"
                  >
                    {st("landing.pricing.seeFeatures", "مشاهده امکانات")}
                    <ChevronDown className={cn("size-4 transition-transform", mobileFeaturesOpen && "rotate-180")} />
                  </button>

                  {mobileFeaturesOpen && (
                    <ul className="space-y-2">
                      {allMobileFeatures.map((row) => (
                        <li key={row.labelKey} className="flex items-center gap-2 text-sm text-[hsl(var(--fg-secondary))]">
                          <Cell value={row.values[i]!} />
                          <span>{st(`landing.pricing.row.${row.labelKey}`, row.fallback)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ),
          )}
        </div>

        {/* Desktop table */}
        <div
          className={cn(
            "hidden sm:block rounded-[var(--radius-2xl)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]",
            "transition-all duration-700 delay-100",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
          )}
        >
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full border-collapse">
              <thead>
                <tr className="border-b border-[hsl(var(--border-default))]">
                  <th className="px-6 py-5" />
                  {PLANS.map((plan) => (
                    <th
                      key={plan.key}
                      scope="col"
                      className={cn("px-6 py-5 text-center relative", plan.popular && POPULAR_BG)}
                    >
                      {plan.popular && (
                        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold text-white bg-[var(--gradient-brand)] mb-1.5">
                          {st("landing.pricingPopular", "محبوب‌ترین")}
                        </span>
                      )}
                      <p className="text-lg font-bold text-[hsl(var(--fg-primary))]">
                        {st(`landing.pricing.${plan.key}.name`, plan.fallbackName)}
                      </p>
                    </th>
                  ))}
                </tr>

                <tr className="border-b border-[hsl(var(--border-default))]">
                  <th scope="row" className="px-6 py-3 text-sm font-normal text-[hsl(var(--fg-secondary))] text-start">
                    {st("landing.pricing.bestIfLabel", "مناسب اگر")}
                  </th>
                  {PLANS.map((plan) => (
                    <td key={plan.key} className={cn("px-6 py-3 text-sm text-[hsl(var(--fg-secondary))] text-center", plan.popular && POPULAR_BG)}>
                      {st(`landing.pricing.${plan.key}.bestIf`, plan.fallbackBestIf)}
                    </td>
                  ))}
                </tr>

                <tr className="border-b border-[hsl(var(--border-default))]">
                  <th scope="row" className="px-6 py-4 text-sm font-normal text-[hsl(var(--fg-secondary))] text-start">
                    {st("landing.pricing.priceHeader", "قیمت")}
                  </th>
                  {PLANS.map((plan) => (
                    <td key={plan.key} className={cn("px-6 py-4 text-center", plan.popular && POPULAR_BG)}>
                      {plan.price === null ? (
                        <span className="text-xl font-bold text-[hsl(var(--fg-primary))]">تماس بگیرید</span>
                      ) : plan.price === 0 ? (
                        <span className="text-2xl font-extrabold text-[hsl(var(--fg-primary))]">رایگان</span>
                      ) : (
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-2xl font-extrabold text-[hsl(var(--fg-primary))] tabular-nums">
                            {plan.price.toLocaleString("fa-AF")}
                          </span>
                          <span className="text-xs text-[hsl(var(--fg-tertiary))]">افغانی / ماه</span>
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                <tr className="border-b border-[hsl(var(--border-default))]">
                  <td />
                  {PLANS.map((plan) => (
                    <td key={plan.key} className={cn("px-6 py-4 text-center", plan.popular && POPULAR_BG)}>
                      <button
                        type="button"
                        onClick={onNavigateLogin}
                        className={cn(
                          "w-full rounded-xl py-2.5 text-sm font-semibold min-h-[44px] transition-all duration-200",
                          plan.popular
                            ? "text-white bg-[var(--gradient-brand)] hover:opacity-90"
                            : "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]",
                        )}
                      >
                        {st(`landing.pricing.${plan.key}.cta`, plan.ctaFallback)}
                      </button>
                    </td>
                  ))}
                </tr>
              </thead>

              <tbody>
                {FEATURE_GROUPS.map((group) => (
                  <React.Fragment key={`group-${group.groupKey}`}>
                    <tr className="border-b border-[hsl(var(--border-default))]">
                      <td
                        colSpan={4}
                        className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-[hsl(var(--fg-tertiary))]"
                      >
                        {st(`landing.pricing.group.${group.groupKey}`, group.fallbackGroup)}
                      </td>
                    </tr>

                    {group.rows.map((row, ri) => (
                      <tr
                        key={row.labelKey}
                        className={cn(
                          "border-b border-[hsl(var(--border-default))] last:border-0",
                          ri % 2 === 0 ? "bg-transparent" : STRIPE_ROW,
                        )}
                      >
                        <th scope="row" className="px-6 py-3 text-xs sm:text-sm font-normal text-[hsl(var(--fg-secondary))] text-start">
                          {st(`landing.pricing.row.${row.labelKey}`, row.fallback)}
                        </th>
                        {row.values.map((val, j) => (
                          <td key={j} className={cn("px-6 py-3 text-center", PLANS[j]?.popular && POPULAR_BG)}>
                            <Cell value={val} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p
          className={cn(
            "mt-8 text-center text-xs sm:text-sm text-[hsl(var(--fg-tertiary))]",
            "transition-all duration-700 delay-300",
            animated ? "opacity-100" : "opacity-0",
          )}
        >
          {st("landing.pricingFooter", "بدون قرارداد · لغو هر زمان · بدون کارت بانکی")}
        </p>
      </div>
    </section>
  );
}