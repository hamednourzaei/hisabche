// packages/ui/src/components/ui/landing/landing-page.tsx
"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { NavigationProvider } from "../../../hooks/menu/use-navigation-state";
import { TopNav } from "../navigation/top-nav";
import { NavigationRegistry } from "../navigation/navigation-registry";

import dynamic from 'next/dynamic';

// ─── Components ──────────────────────────────────────────────────────────────
// ✅ Hero is the LCP element — imported eagerly (no dynamic wrapper) so it
// ships in the main bundle with no extra network round-trip.
// Everything below the fold is dynamically imported so its JS is fetched
// in a separate chunk and hydrated only once it reaches the viewport,
// instead of blocking the initial script evaluation.
import CinematicHero from './cinematic-hero';

const sceneLoading = () => <div className="min-h-[40vh]" aria-hidden="true" />;

const PainScene = dynamic(() => import('./pain-scene'), { loading: sceneLoading });
const TransformScene = dynamic(() => import('./transform-scene'), { loading: sceneLoading });
const FeaturesScene = dynamic(() => import('./features-scene'), { loading: sceneLoading });
const SocialScene = dynamic(() => import('./social-scene'), { loading: sceneLoading });
const FaqScene = dynamic(() => import('./faq-scene'), { loading: sceneLoading });
const CTAScene = dynamic(() => import('./cta-scene'), { loading: sceneLoading });
const TrustBarScene = dynamic(() => import('./trust-bar-scene'), { loading: sceneLoading });
const SecurityScene = dynamic(() => import('./security-scene'), { loading: sceneLoading });
const PricingScene = dynamic(() => import('./pricing-scene'), { loading: sceneLoading });
const SiteFooter = dynamic(() => import('./site-footer'), { loading: sceneLoading });
const DashboardShowcaseScene = dynamic(() => import('./dashboard-showcase-scene'), { loading: sceneLoading });

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

// ─── Main LandingPage ──────────────────────────────────────────────────────

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
    let isMounted = true;
    
    if (i18n.language !== currentLocale) {
      i18n.changeLanguage(currentLocale).then(() => {
        if (isMounted) {
          localStorage.setItem("hisabche-lang", currentLocale);
          setReady(true);
        }
      });
    } else {
      setReady(true);
    }
    
    return () => {
      isMounted = false;
    };
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