// apps/web/app/pricing/page.tsx
"use client";

import { useTranslation } from "react-i18next";
import Link from "next/link";
import { memo, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, ArrowRight, Shield, Zap, Users, Building2 } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   PricingPage v3 — SaaS-Level · Production-Ready · Memoized
   ✅ memo · useMemo · useCallback · RTL-ready · i18n fixed
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Types ─────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted: boolean;
  icon: React.ReactNode;
}

// ✅ safeT wrapper برای رفع خطای Type
type SafeT = (key: string, fallback?: string) => string;

// ─── Plan Card Component ──────────────────────────────────────────────────

const PlanCard = memo(function PlanCard({
  plan,
  t,
  index,
}: {
  plan: Plan;
  t: SafeT;
  index: number;
}) {
  const isHighlighted = plan.highlighted;

  const cardStyle = useMemo(() => {
    const base = "transition-all duration-300 hover:shadow-[var(--shadow-premium)]";
    const highlight = isHighlighted
      ? "border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.04)] ring-2 ring-[hsl(var(--color-primary)/0.15)]"
      : "border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]";
    return cn(base, highlight);
  }, [isHighlighted]);

  return (
    <div
      className={cn(
        "relative rounded-2xl border p-8 flex flex-col",
        "hover:-translate-y-1",
        "motion-reduce:transform-none",
        cardStyle,
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {isHighlighted && (
        <div className="absolute -top-3 start-1/2 -translate-x-1/2">
          <span className="px-4 py-1 text-xs font-bold rounded-full bg-[hsl(var(--color-primary))] text-white shadow-lg shadow-[hsl(var(--color-primary)/0.3)]">
            {t("pricing.popular", "محبوب‌ترین")}
          </span>
        </div>
      )}

      <div
        className={cn(
          "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl",
          isHighlighted
            ? "bg-[hsl(var(--color-primary)/0.15)] text-[hsl(var(--color-primary))]"
            : "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-tertiary))]",
        )}
      >
        {plan.icon}
      </div>

      <h2 className="text-xl font-bold text-[hsl(var(--fg-primary))] mb-1">
        {plan.name}
      </h2>

      <p className="text-sm text-[hsl(var(--fg-secondary))] mb-4">
        {plan.description}
      </p>

      <div className="mb-6">
        <span className="text-4xl font-extrabold text-[hsl(var(--fg-primary))]">
          {plan.price}
        </span>
        <span className="text-sm text-[hsl(var(--fg-secondary))] mr-2">
          {plan.period}
        </span>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-center gap-2 text-sm text-[hsl(var(--fg-secondary))]"
          >
            <Check className="size-4 shrink-0 text-[hsl(var(--color-success))]" />
            {feature}
          </li>
        ))}
      </ul>

      <Link
        href={plan.href}
        className={cn(
          "group inline-flex items-center justify-center gap-2",
          "rounded-full px-6 py-3 text-sm font-bold",
          "transition-all duration-200",
          "hover:scale-[1.02] active:scale-[0.98]",
          "motion-reduce:transform-none",
          isHighlighted
            ? "bg-[hsl(var(--color-primary))] text-white shadow-sm shadow-[hsl(var(--color-primary)/0.2)] hover:brightness-110"
            : "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]",
        )}
      >
        {plan.cta}
        <ArrowRight
          className={cn(
            "size-4 transition-transform duration-200",
            "group-hover:translate-x-1",
            "motion-reduce:transform-none",
          )}
        />
      </Link>
    </div>
  );
});
PlanCard.displayName = "PlanCard";

// ─── FAQ Section ──────────────────────────────────────────────────────────

const FAQSection = memo(function FAQSection({
  t,
}: {
  t: SafeT;
}) {
  return (
    <section className="py-16 px-4 text-center border-t border-[hsl(var(--border-default))]">
      <div className="max-w-md mx-auto">
        <p className="text-[hsl(var(--fg-secondary))] mb-4">
          {t("pricing.faq", "سوالی دارید؟")}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="mailto:hello@hisabche.com"
            className="text-[hsl(var(--color-primary))] font-semibold hover:underline"
          >
            hello@hisabche.com
          </Link>
          <span className="hidden sm:inline text-[hsl(var(--fg-tertiary))]">·</span>
          <Link
            href="/contact"
            className="text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))] transition-colors"
          >
            {t("pricing.contact", "فرم تماس")}
          </Link>
        </div>
      </div>
    </section>
  );
});
FAQSection.displayName = "FAQSection";

// ─── Trust Badges ─────────────────────────────────────────────────────────

const TRUST_BADGES = [
  { id: "secure", labelKey: "pricing.trust.secure", fallback: "امن و رمزنگاری‌شده", icon: Shield },
  { id: "fast", labelKey: "pricing.trust.fast", fallback: "سرعت بالا", icon: Zap },
  { id: "team", labelKey: "pricing.trust.team", fallback: "همکاری تیمی", icon: Users },
] as const;

// ─── Main Page ─────────────────────────────────────────────────────────────

const PricingPage = memo(function PricingPage() {
  const { t: tOriginal } = useTranslation();

  // ✅ safeT wrapper برای رفع خطای Type
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const result = tOriginal(key);
      return result && result !== key ? result : (fallback ?? key);
    },
    [tOriginal]
  );

  const planIcons = {
    free: <Zap className="size-6" />,
    pro: <Users className="size-6" />,
    enterprise: <Building2 className="size-6" />,
  };

  const plans = useMemo<Plan[]>(
    () => [
      {
        id: "free",
        name: t("pricing.free.name", "رایگان"),
        price: t("pricing.free.price", "۰"),
        period: t("pricing.free.period", "ماهانه"),
        description: t(
          "pricing.free.desc",
          "برای کسب‌وکارهای کوچک و تازه‌کار",
        ),
        features: [
          t("pricing.free.feature1", "۱ کسب‌وکار"),
          t("pricing.free.feature2", "فاکتور نامحدود"),
          t("pricing.free.feature3", "۱۰۰ محصول"),
          t("pricing.free.feature4", "حسابداری پایه"),
          t("pricing.free.feature5", "پشتیبانی انجمن"),
        ],
        cta: t("pricing.free.cta", "شروع رایگان"),
        href: "/signup",
        highlighted: false,
        icon: planIcons.free,
      },
      {
        id: "pro",
        name: t("pricing.pro.name", "حرفه‌ای"),
        price: t("pricing.pro.price", "۱,۵۰۰"),
        period: t("pricing.pro.period", "افغانی/ماه"),
        description: t(
          "pricing.pro.desc",
          "برای کسب‌وکارهای در حال رشد",
        ),
        features: [
          t("pricing.pro.feature1", "۵ کسب‌وکار"),
          t("pricing.pro.feature2", "همه امکانات"),
          t("pricing.pro.feature3", "۱۰۰۰ محصول"),
          t("pricing.pro.feature4", "گزارشات پیشرفته"),
          t("pricing.pro.feature5", "پشتیبانی ایمیلی"),
          t("pricing.pro.feature6", "حذف برند حسابچه"),
        ],
        cta: t("pricing.pro.cta", "شروع حرفه‌ای"),
        href: "/signup",
        highlighted: true,
        icon: planIcons.pro,
      },
      {
        id: "enterprise",
        name: t("pricing.enterprise.name", "سازمانی"),
        price: t("pricing.enterprise.price", "تماس"),
        period: t("pricing.enterprise.period", "سفارشی"),
        description: t(
          "pricing.enterprise.desc",
          "برای سازمان‌های بزرگ با نیازهای خاص",
        ),
        features: [
          t("pricing.enterprise.feature1", "کسب‌وکار نامحدود"),
          t("pricing.enterprise.feature2", "API اختصاصی"),
          t("pricing.enterprise.feature3", "هاست اختصاصی"),
          t("pricing.enterprise.feature4", "پشتیبانی ۲۴/۷"),
          t("pricing.enterprise.feature5", "آموزش تیم"),
          t("pricing.enterprise.feature6", "SLA تضمینی"),
        ],
        cta: t("pricing.enterprise.cta", "تماس با ما"),
        href: "mailto:sales@hisabche.com",
        highlighted: false,
        icon: planIcons.enterprise,
      },
    ],
    [t],
  );

  return (
    <main className="min-h-screen bg-[hsl(var(--surface-base))]">
      {/* Hero */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full border border-[hsl(var(--color-primary)/0.2)] bg-[hsl(var(--color-primary)/0.06)] text-[hsl(var(--color-primary))] text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--color-primary))] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--color-primary))]" />
            </span>
            {t("pricing.badge", "بدون تعهد · لغو آسان")}
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[hsl(var(--fg-primary))] mb-4">
            {t("pricing.title", "قیمت‌های ساده و شفاف")}
          </h1>

          <p className="text-lg text-[hsl(var(--fg-secondary))] max-w-lg mx-auto">
            {t(
              "pricing.subtitle",
              "با هر پلنی شروع کنید — هر وقت خواستید ارتقا بدید",
            )}
          </p>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <PlanCard key={plan.id} plan={plan} t={t} index={index} />
          ))}
        </div>
      </section>

      {/* Trust Badges */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {TRUST_BADGES.map(({ id, labelKey, fallback, icon: Icon }) => (
            <div
              key={id}
              className="flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)] p-4 text-sm text-[hsl(var(--fg-secondary))]"
            >
              <Icon className="size-5 text-[hsl(var(--color-primary))]" />
              {t(labelKey, fallback)}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ / Contact */}
      <FAQSection t={t} />
    </main>
  );
});

PricingPage.displayName = "PricingPage";

export default PricingPage;