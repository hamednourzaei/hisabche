// packages/ui/src/components/ui/landing/security-scene.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  WifiOff,
  RefreshCw,
  DatabaseBackup,
  ShieldCheck,
  UsersRound,
  History,
  CheckCircle2,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   SecurityScene v2 — Trust Center · 6 pillars · Bullet scanning
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SecuritySceneProps {
  t: (key: string, fallback?: string) => string;
}

interface TrustPillar {
  icon: LucideIcon;
  key: string;
  title: string;
  bullets: string[];
}

const PILLARS: TrustPillar[] = [
  {
    icon: WifiOff,
    key: "offline",
    title: "آفلاین واقعی",
    bullets: [
      "بدون اینترنت کار می‌کند",
      "ذخیره محلی امن",
      "ادامه کار بدون قطعی",
    ],
  },
  {
    icon: RefreshCw,
    key: "sync",
    title: "همگام‌سازی خودکار",
    bullets: [
      "همگام‌سازی پس از اتصال",
      "بدون نیاز به اقدام شما",
      "همیشه به‌روز",
    ],
  },
  {
    icon: DatabaseBackup,
    key: "backup",
    title: "بک‌آپ خودکار",
    bullets: [
      "نسخه پشتیبان خودکار",
      "بازیابی آسان اطلاعات",
      "جلوگیری از حذف داده",
    ],
  },
  {
    icon: ShieldCheck,
    key: "encryption",
    title: "امنیت و رمزنگاری",
    bullets: [
      "رمزنگاری داده‌ها",
      "ارتباط امن",
      "محافظت از اطلاعات",
    ],
  },
  {
    icon: UsersRound,
    key: "access",
    title: "کنترل دسترسی",
    bullets: ["چند کاربره", "نقش‌ها و مجوزها", "سطح دسترسی مشخص"],
  },
  {
    icon: History,
    key: "audit",
    title: "ثبت رویدادها",
    bullets: [
      "ثبت فعالیت‌ها",
      "تاریخچه تغییرات",
      "قابلیت پیگیری",
    ],
  },
];

const TRUST_BADGES = [
  "آفلاین اول",
  "رمزنگاری شده",
  "بک‌آپ خودکار",
  "کنترل دسترسی",
  "ثبت رویدادها",
  "چند کاربره",
  "۹۹.۹٪ در دسترس",
];

export default function SecurityScene({ t }: SecuritySceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);

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
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="security"
      ref={ref}
      data-narrative="trust"
      className="section-padding bg-[hsl(var(--surface-muted)/0.2)]"
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
            {t("landing.securityLabel", "امنیت داده")}
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[hsl(var(--fg-primary))] tracking-tight mb-3 sm:mb-4">
            {t("landing.securityTitle", "اطلاعات کسب‌وکارت همیشه امن است")}
          </h2>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-[hsl(var(--fg-secondary))] leading-relaxed">
            {t(
              "landing.securityDesc",
              "چه اینترنت داشته باشی چه نداشته باشی، اطلاعاتت ذخیره می‌شود، همگام‌سازی می‌شود، نسخه پشتیبان دارد و فقط افراد مجاز به آن دسترسی خواهند داشت.",
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {PILLARS.map(({ icon: Icon, key, title, bullets }, i) => (
            <div
              key={key}
              className={cn(
                "group relative p-5 sm:p-6 rounded-[var(--radius-xl)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]",
                "transition-all duration-500 motion-reduce:transition-none",
                "hover:border-[hsl(var(--color-primary)/0.3)] hover:shadow-lg hover:-translate-y-1",
                "motion-reduce:hover:translate-y-0",
                animated ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
              )}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))] mb-4 group-hover:scale-105 transition-transform">
                <Icon className="size-5" aria-hidden="true" />
              </div>

              <h3 className="font-semibold text-sm sm:text-base text-[hsl(var(--fg-primary))] mb-3">
                {t(`landing.security.${key}.title`, title)}
              </h3>

              <ul className="space-y-2">
                {bullets.map((bullet, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-2 text-xs sm:text-sm text-[hsl(var(--fg-secondary))]"
                  >
                    <CheckCircle2
                      className="size-3.5 mt-0.5 shrink-0 text-[hsl(var(--color-success))]"
                      aria-hidden="true"
                    />
                    <span>{t(`landing.security.${key}.bullet${j + 1}`, bullet)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className={cn(
            "mt-10 sm:mt-12 flex flex-wrap items-center justify-center gap-3 sm:gap-4",
            "transition-all duration-700 delay-200 motion-reduce:transition-none",
            animated ? "opacity-100" : "opacity-0",
          )}
        >
          {TRUST_BADGES.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-secondary))]"
            >
              {t(`landing.security.badge.${badge}`, badge)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}