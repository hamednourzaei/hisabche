// packages/ui/src/components/ui/landing/cinematic-hero.tsx
"use client";

import { useSceneObserver } from "./use-scene-observer";
import { cn } from "@/lib/utils";
import Image from "next/image";

/* ═══════════════════════════════════════════════════════════════════════════
   CinematicHero v10 — Mobile-centred · Logo first on mobile
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CinematicHeroProps {
  t: (key: string, fallback?: string) => string;
  onNavigateLogin: () => void;
}

export default function CinematicHero({ t, onNavigateLogin }: CinematicHeroProps) {
  const { ref } = useSceneObserver<HTMLDivElement>({
    threshold: 0.1,
    narrativeState: "frustration",
  });

  const scrollToDemo = () => {
    document.getElementById("dashboard-showcase")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      ref={ref}
      data-narrative="frustration"
      className="relative flex min-h-[100svh] lg:min-h-screen items-center overflow-hidden py-20 lg:py-0"
    >
      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center justify-items-center lg:justify-items-stretch gap-12 lg:gap-16">
          {/* ── Text content: order-2 on mobile, order-1 on desktop ── */}
          <div className="order-2 lg:order-1 flex flex-col items-center text-center lg:items-start lg:text-start w-full">
            {/* Value Pill: Offline */}
            <div
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 mb-6 sm:mb-8",
                "rounded-full mx-auto lg:mx-0",
                "bg-[hsl(var(--color-primary)/0.08)] border border-[hsl(var(--color-primary)/0.15)]",
                "text-xs sm:text-sm font-medium text-[hsl(var(--color-primary))]",
                "opacity-0 animate-[fade-in-up_0.6s_ease-out_both]",
              )}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--color-primary))] opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--color-primary))]" />
              </span>
              {t("landing.valuePill", "بدون اینترنت هم کار می‌کند — همیشه، همه‌جا")}
            </div>

            {/* H1 */}
            <h1
              className={cn(
                "mb-5 sm:mb-6 max-w-lg mx-auto lg:mx-0",
                "text-[2rem] leading-[1.15] sm:text-4xl lg:text-5xl xl:text-6xl",
                "font-bold tracking-tight text-center lg:text-start",
                "text-[hsl(var(--fg-primary))]",
                "opacity-0 animate-[fade-in-up_0.6s_ease-out_0.1s_both]",
              )}
            >
              {t("landing.headline", "هر روز با خیال راحت")}{" "}
              <span className="text-[hsl(var(--color-primary))]">
                {t("landing.headlineHighlight", "دکانت را ببند")}
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className={cn(
                "mb-8 sm:mb-10 max-w-xl mx-auto lg:mx-0",
                "text-base sm:text-lg lg:text-xl text-center lg:text-start",
                "text-[hsl(var(--fg-secondary))] leading-relaxed",
                "opacity-0 animate-[fade-in-up_0.6s_ease-out_0.2s_both]",
              )}
            >
              {t(
                "landing.subtitle",
                "فروش، نسیه، موجودی و سود — خودکار حساب می‌شود. مثل یک دستیار نامرئی که هیچ‌وقت اشتباه نمی‌کند.",
              )}
            </p>

            {/* CTAs + Micro Proof */}
            <div
              className={cn(
                "w-full space-y-4",
                "opacity-0 animate-[fade-in-up_0.6s_ease-out_0.3s_both]",
              )}
            >
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start items-center w-full">
                <button
                  type="button"
                  onClick={onNavigateLogin}
                  className={cn(
                    "btn-primary",
                    "rounded-xl px-7 sm:px-8 py-3.5 sm:py-4",
                    "min-h-[48px] sm:min-h-[52px]",
                    "w-full sm:w-auto",
                  )}
                >
                  {t("landing.cta", "شروع رایگان")}
                  <span className="text-lg" aria-hidden="true">
                    ←
                  </span>
                </button>

                <button
                  type="button"
                  onClick={scrollToDemo}
                  className={cn(
                    "btn-secondary",
                    "rounded-xl px-7 sm:px-8 py-3.5 sm:py-4",
                    "min-h-[48px] sm:min-h-[52px]",
                    "w-full sm:w-auto",
                  )}
                >
                  {t("landing.ctaSecondary", "مشاهده دموی محصول")}
                </button>
              </div>

              <p className="text-center lg:text-start text-xs sm:text-sm text-[hsl(var(--fg-tertiary))]">
                {t("landing.microProof", "بدون نیاز به آموزش · فعال‌سازی در ۳۰ ثانیه · پشتیبانی فارسی")}
              </p>
            </div>

            {/* Trust bar */}
            <div
              className={cn(
                "w-full mt-10 sm:mt-12 pt-8 sm:pt-10",
                "border-t border-[hsl(var(--border-default))]",
                "opacity-0 animate-[fade-in-up_0.6s_ease-out_0.4s_both]",
              )}
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="text-center lg:text-start">
                  <span className="block text-xl sm:text-2xl font-bold text-[hsl(var(--color-primary))]">
                    {t("landing.statStores", "۳۴۰+")}
                  </span>
                  <span className="text-xs sm:text-sm text-[hsl(var(--fg-tertiary))]">
                    {t("landing.statStoresLabel", "کسب‌وکار فعال")}
                  </span>
                </div>
                <div className="text-center lg:text-start">
                  <span className="block text-xl sm:text-2xl font-bold text-[hsl(var(--color-primary))]">
                    {t("landing.statTransactions", "۱۲,۰۰۰+")}
                  </span>
                  <span className="text-xs sm:text-sm text-[hsl(var(--fg-tertiary))]">
                    {t("landing.statTransactionsLabel", "تراکنش روزانه")}
                  </span>
                </div>
                <div className="text-center lg:text-start">
                  <span className="block text-xl sm:text-2xl font-bold text-[hsl(var(--color-primary))]">
                    {t("landing.statUptime", "۱۰۰٪")}
                  </span>
                  <span className="text-xs sm:text-sm text-[hsl(var(--fg-tertiary))]">
                    {t("landing.statUptimeLabel", "آفلاین کار می‌کند")}
                  </span>
                </div>
                <div className="text-center lg:text-start">
                  <span className="block text-xl sm:text-2xl font-bold text-[hsl(var(--color-primary))]">
                    {t("landing.statRating", "۴.۹")}
                  </span>
                  <span className="text-xs sm:text-sm text-[hsl(var(--fg-tertiary))]">
                    {t("landing.statRatingLabel", "رضایت کاربران")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Visual: Desktop full rings ── */}
          <div
            className={cn(
              "hidden lg:flex items-center justify-center order-2",
              "opacity-0 animate-[fade-in-up_0.6s_ease-out_0.25s_both]",
            )}
          >
            <div className="relative w-80 h-80 xl:w-96 xl:h-96" aria-hidden="true">
              <div className="absolute inset-0 rounded-full border border-[hsl(var(--color-primary)/0.12)]" />
              <div className="absolute inset-8 rounded-full border border-[hsl(var(--color-primary)/0.18)]" />
              <div className="absolute inset-16 rounded-full border border-[hsl(var(--color-primary)/0.22)]" />

              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[hsl(var(--color-primary))] shadow-[0_0_12px_hsl(var(--color-primary))]" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[hsl(var(--color-accent))] shadow-[0_0_10px_hsl(var(--color-accent))]" />
              <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[hsl(var(--color-primary-light))] shadow-[0_0_8px_hsl(var(--color-primary-light))]" />
              <div className="absolute right-0 top-1/3 translate-x-1/2 w-2 h-2 rounded-full bg-[hsl(var(--color-primary))] shadow-[0_0_8px_hsl(var(--color-primary))]" />

              <div className="absolute inset-0 rounded-full border border-[hsl(var(--color-primary)/0.06)] animate-ping [animation-duration:3.5s]" />

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 blur-3xl bg-[hsl(var(--color-primary)/0.2)] rounded-full scale-150" />
                  <div className="relative animate-[logo-breathe_3s_ease-in-out_infinite]">
                    <Image
                      src="/logo-icon.png"
                      alt={t("landing.logoAlt", "حسابچه")}
                      width={180}
                      height={120}
                      className="w-44 h-auto xl:w-52 drop-shadow-[0_0_40px_hsl(var(--color-primary)/0.5)]"
                      priority
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className="absolute inset-0 -z-10 blur-[100px]"
              style={{
                background:
                  "radial-gradient(ellipse 50% 50% at 50% 50%, hsl(var(--color-primary)/0.12), transparent)",
              }}
              aria-hidden="true"
            />
          </div>

          {/* ── Mobile: small centred logo (order-1, first) ── */}
          <div
            className={cn(
              "lg:hidden flex items-center justify-center order-1",
              "opacity-0 animate-[fade-in-up_0.6s_ease-out_0.25s_both]",
            )}
          >
            <div className="relative animate-[logo-breathe_3s_ease-in-out_infinite]">
              <Image
                src="/logo-icon.png"
                alt={t("landing.logoAlt", "حسابچه")}
                width={120}
                height={80}
                className="w-32 h-auto drop-shadow-[0_0_30px_hsl(var(--color-primary)/0.4)]"
                priority
              />
            </div>
          </div>
        </div>
      </div>



    </section>
  );
}