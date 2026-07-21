"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { NavigationProvider } from "../../../hooks/menu/use-navigation-state";
import { TopNav } from "../navigation/top-nav";
import { NavigationRegistry } from "../navigation/navigation-registry";

import dynamic from 'next/dynamic';

// ✅ همه کامپوننت‌ها با SSR=true برای جلوگیری از flash
const CinematicHero = dynamic(() => import('./cinematic-hero'), { ssr: true });
const PainScene = dynamic(() => import('./pain-scene'), { ssr: true });
const TransformScene = dynamic(() => import('./transform-scene'), { ssr: true });
const FeaturesScene = dynamic(() => import('./features-scene'), { ssr: true });
const SocialScene = dynamic(() => import('./social-scene'), { ssr: true });
const FaqScene = dynamic(() => import('./faq-scene'), { ssr: true });
const CTAScene = dynamic(() => import('./cta-scene'), { ssr: true });
const TrustBarScene = dynamic(() => import('./trust-bar-scene'), { ssr: true });
const SecurityScene = dynamic(() => import('./security-scene'), { ssr: true });
const PricingScene = dynamic(() => import('./pricing-scene'), { ssr: true });
const SiteFooter = dynamic(() => import('./site-footer'), { ssr: true });
const DashboardShowcaseScene = dynamic(() => import('./dashboard-showcase-scene'), { ssr: true });

const sectionKeys: Record<string, string> = {
  hero: "landing.navHero",
  pain: "landing.navPain",
  transform: "landing.navTransform",
  features: "landing.navFeatures",
  testimonials: "landing.navTestimonials",
  cta: "landing.navCTA",
};

const sectionFallbacks: Record<string, Record<string, string>> = {
  en: {
    hero: "Home",
    pain: "Problem",
    transform: "Solution",
    features: "Features",
    testimonials: "Trust",
    cta: "Start",
  },
  "fa-IR": {
    hero: "خانه",
    pain: "مشکل",
    transform: "راه‌حل",
    features: "امکانات",
    testimonials: "اعتماد",
    cta: "شروع",
  },
  "fa-AF": {
    hero: "خانه",
    pain: "مشکل",
    transform: "راه حل",
    features: "امکانات",
    testimonials: "اعتماد",
    cta: "شروع",
  },
};

function getLocaleFromPathname(pathname: string): string {
  const match = pathname.match(/^\/(fa-IR|fa-AF|en)/);
  return match?.[1] ?? "fa-IR";
}

export function LandingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, i18n } = useTranslation();
  const navigateLogin = useCallback(() => router.push("/login"), [router]);
  const [ready, setReady] = useState(false);

  const currentLocale = getLocaleFromPathname(pathname);
  const fallbacks = sectionFallbacks[currentLocale] || sectionFallbacks["fa-IR"];

  const NAVIGATION_SECTIONS = useMemo(
    () => [
      { id: "hero" as const, label: t("landing.navHero", fallbacks?.hero ?? "Home"), narrative: "frustration" as const },
      { id: "pain" as const, label: t("landing.navPain", fallbacks?.pain ?? "Problem"), narrative: "confusion" as const },
      { id: "transform" as const, label: t("landing.navTransform", fallbacks?.transform ?? "Solution"), narrative: "clarity" as const },
      { id: "features" as const, label: t("landing.navFeatures", fallbacks?.features ?? "Features"), narrative: "confidence" as const },
      { id: "testimonials" as const, label: t("landing.navTestimonials", fallbacks?.testimonials ?? "Trust"), narrative: "trust" as const },
      { id: "cta" as const, label: t("landing.navCTA", fallbacks?.cta ?? "Start"), narrative: "action" as const },
    ],
    [t, fallbacks]
  );

  useEffect(() => {
    if (i18n.language !== currentLocale) {
      i18n.changeLanguage(currentLocale).then(() => {
        localStorage.setItem("hisabche-lang", currentLocale);
        setReady(true);
      });
    } else {
      setReady(true);
    }
  }, [currentLocale, i18n]);

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const result = t(key);
      return result && result !== key ? result : (fallback ?? key);
    },
    [t]
  );

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--surface-base))]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(var(--color-primary))] border-t-transparent" />
      </div>
    );
  }

  return (
    <NavigationProvider sections={NAVIGATION_SECTIONS}>
      <div className="min-h-screen bg-[hsl(var(--surface-base))]">
        <TopNav variant="landing" onNavigateLogin={navigateLogin} />

        <main>
          <NavigationRegistry id="hero">
            <CinematicHero t={safeT} onNavigateLogin={navigateLogin} />
          </NavigationRegistry>

          <TrustBarScene t={safeT} />


          <NavigationRegistry id="pain">
            <PainScene t={safeT} />
          </NavigationRegistry>

          <DashboardShowcaseScene t={safeT} />


          <NavigationRegistry id="transform">
            <TransformScene t={safeT} />
          </NavigationRegistry>

          <NavigationRegistry id="features">
            <FeaturesScene t={safeT} />
          </NavigationRegistry>

          <SecurityScene t={safeT} />


          <NavigationRegistry id="testimonials">
            <SocialScene t={safeT} />
          </NavigationRegistry>

          <PricingScene t={safeT} onNavigateLogin={navigateLogin} />

          <FaqScene t={safeT} />

          <NavigationRegistry id="cta">
            <CTAScene t={safeT} onNavigateLogin={navigateLogin} />
          </NavigationRegistry>

          <SiteFooter t={safeT} />
        </main>
      </div>
    </NavigationProvider>
  );
}