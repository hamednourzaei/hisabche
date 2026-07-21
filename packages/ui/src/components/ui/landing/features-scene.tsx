// packages/ui/src/components/ui/landing/features-scene.tsx
"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Users,
  FileText,
  Package,
  Calculator,
  Users2,
  BarChart3,
  Wifi,
  Sparkles,
  Building2,
  Link,
  Shield,
  Smartphone,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   FeaturesScene v12 — Clean grid of Hisabche features (from master roadmap)
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FeaturesSceneProps {
  t: (key: string, fallback?: string) => string;
}

interface FeatureItem {
  icon: LucideIcon;
  key: string;
  title: string;
  description: string;
  status?: "active" | "soon" | undefined;
}

const FEATURES: FeatureItem[] = [
  {
    icon: Users,
    key: "customers",
    title: "مدیریت مشتریان",
    description: "اطلاعات مشتری، سوابق خرید و بدهی‌ها",
    status: "active",
  },
  {
    icon: FileText,
    key: "invoices",
    title: "صدور فاکتور",
    description: "فاکتور فروش سریع و چاپ PDF",
    status: "active",
  },
  {
    icon: Package,
    key: "inventory",
    title: "مدیریت انبار",
    description: "موجودی، هشدار کمبود، انتقال کالا",
    status: "active",
  },
  {
    icon: Calculator,
    key: "accounting",
    title: "حسابداری و مالی",
    description: "دفتر کل، سود و زیان، ترازنامه",
    status: "soon",
  },
  {
    icon: Users2,
    key: "hr",
    title: "منابع انسانی",
    description: "کارمندان، حقوق، حضور و غیاب",
    status: "soon",
  },
  {
    icon: BarChart3,
    key: "reports",
    title: "گزارشات و تحلیل",
    description: "داشبورد فروش، سود، نمودارها",
    status: "active",
  },
  {
    icon: Wifi,
    key: "offline",
    title: "آفلاین واقعی",
    description: "کار بدون اینترنت، همگام‌سازی خودکار",
    status: "active",
  },
  {
    icon: Sparkles,
    key: "ai",
    title: "هوش مصنوعی",
    description: "یادآوری هوشمند، پیشنهاد فروش، تحلیل داده",
    status: "active",
  },
  {
    icon: Building2,
    key: "workspace",
    title: "چند کسب‌وکاری",
    description: "مدیریت همزمان چند فروشگاه یا شرکت",
    status: "active",
  },
  {
    icon: Link,
    key: "integrations",
    title: "اتصالات و API",
    description: "اتصال به درگاه‌ها، وب‌هوک، اتصال‌دهنده‌ها",
    status: "soon",
  },
  {
    icon: Shield,
    key: "security",
    title: "امنیت و بک‌آپ",
    description: "رمزنگاری، بک‌آپ خودکار، ورود دو مرحله‌ای",
    status: "active",
  },
  {
    icon: Smartphone,
    key: "mobile",
    title: "موبایل و وب",
    description: "اپلیکیشن موبایل و نسخه تحت وب",
    status: "active",
  },
];

export default function FeaturesScene({ t }: FeaturesSceneProps) {
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
      <div className="container-narrow max-w-6xl">
        <div
          className={cn(
            "text-center mb-12 sm:mb-16",
            "transition-all duration-700 motion-reduce:transition-none",
            animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5",
          )}
        >
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] mb-2 sm:mb-3 text-[hsl(var(--fg-tertiary))] font-semibold">
            {t("landing.featuresLabel", "امکانات")}
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[hsl(var(--fg-primary))] tracking-tight">
            {t("landing.featuresTitle", "همه ابزارهای کسب‌وکار، یکجا")}
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-[hsl(var(--fg-secondary))] leading-relaxed max-w-lg mx-auto">
            {t("landing.featuresDesc", "از فروش و انبار تا حسابداری و هوش مصنوعی.")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.key}
                className={cn(
                  "group relative overflow-hidden rounded-[var(--radius-xl)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5 sm:p-6 transition-all duration-500",
                  "hover:border-[hsl(var(--color-primary)/0.3)] hover:shadow-lg hover:-translate-y-1",
                  "motion-reduce:hover:translate-y-0",
                  animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
                )}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(var(--color-primary)/0.1)] flex items-center justify-center text-[hsl(var(--color-primary))]">
                    <Icon className="size-5" />
                  </div>
                  {feature.status !== undefined && (
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        feature.status === "active"
                          ? "bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]"
                          : "bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]",
                      )}
                    >
                      {feature.status === "active" ? "فعال" : "به‌زودی"}
                    </span>
                  )}
                </div>

                <h3 className="font-semibold text-sm mb-1 text-[hsl(var(--fg-primary))]">
                  {t(`landing.feature.${feature.key}Title`, feature.title)}
                </h3>
                <p className="text-xs text-[hsl(var(--fg-secondary))] leading-relaxed">
                  {t(`landing.feature.${feature.key}Desc`, feature.description)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}