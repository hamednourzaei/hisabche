// apps/web/app/pricing/page.tsx
"use client";

import { useTranslation } from "react-i18next";
import Link from "next/link";

export default function PricingPage() {
  const { t } = useTranslation();

  const plans = [
    {
      name: t("pricing.free.name", "رایگان"),
      price: t("pricing.free.price", "۰"),
      period: t("pricing.free.period", "ماهانه"),
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
    },
    {
      name: t("pricing.pro.name", "حرفه‌ای"),
      price: t("pricing.pro.price", "۱,۵۰۰"),
      period: t("pricing.pro.period", "افغانی/ماه"),
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
    },
    {
      name: t("pricing.enterprise.name", "سازمانی"),
      price: t("pricing.enterprise.price", "تماس"),
      period: t("pricing.enterprise.period", "سفارشی"),
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
    },
  ];

  return (
    <main className="min-h-screen bg-[hsl(var(--surface-base))]">
      <section className="py-20 px-4 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--fg-primary))] mb-4">
          {t("pricing.title", "قیمت‌های ساده و شفاف")}
        </h1>
        <p className="text-[hsl(var(--fg-secondary))] max-w-md mx-auto">
          {t("pricing.subtitle", "با هر پلنی شروع کنید — هر وقت خواستید ارتقا بدید")}
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                plan.highlighted
                  ? "border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.04)] ring-2 ring-[hsl(var(--color-primary)/0.15)]"
                  : "border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 start-1/2 -translate-x-1/2 px-4 py-1 text-xs font-bold rounded-full bg-[hsl(var(--color-primary))] text-white">
                  {t("pricing.popular", "محبوب‌ترین")}
                </span>
              )}

              <h2 className="text-xl font-bold text-[hsl(var(--fg-primary))] mb-2">{plan.name}</h2>

              <div className="mb-6">
                <span className="text-4xl font-extrabold text-[hsl(var(--fg-primary))]">{plan.price}</span>
                <span className="text-sm text-[hsl(var(--fg-secondary))] mr-2">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-[hsl(var(--fg-secondary))]">
                    <svg width={16} height={16} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 text-[hsl(var(--color-success))]">
                      <path d="M5 10l3.5 3.5L15 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`inline-flex items-center justify-center w-full rounded-full px-6 py-3 text-sm font-bold transition-all duration-200 ${
                  plan.highlighted
                    ? "bg-[hsl(var(--color-primary))] text-white hover:brightness-110"
                    : "border border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-4 text-center border-t border-[hsl(var(--border-default))]">
        <p className="text-[hsl(var(--fg-secondary))] mb-4">{t("pricing.faq", "سوالی دارید؟")}</p>
        <Link href="mailto:hello@hisabche.com" className="text-[hsl(var(--color-primary))] font-semibold hover:underline">
          hello@hisabche.com
        </Link>
      </section>
    </main>
  );
}