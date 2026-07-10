"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { NavigationProvider } from "../../../hooks/menu/use-navigation-state";
import { TopNav } from "../navigation/top-nav";
import { NavigationRegistry } from "../navigation/navigation-registry";
import { cn } from "@/lib/utils";

import CinematicHero from "./cinematic-hero";
import PainScene from "./pain-scene";
import TransformScene from "./transform-scene";
import FeaturesScene from "./features-scene";
import SocialScene from "./social-scene";
import FaqScene from "./faq-scene";
import CTAScene from "./cta-scene";
import StatsSection from "./stats-section";

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
    { id: "hero",         label: t("landing.navHero", fallbacks?.hero ?? "Home"),               narrative: "frustration" as const },
    { id: "pain",         label: t("landing.navPain", fallbacks?.pain ?? "Problem"),             narrative: "confusion"   as const },
    { id: "transform",    label: t("landing.navTransform", fallbacks?.transform ?? "Solution"),  narrative: "clarity"     as const },
    { id: "features",     label: t("landing.navFeatures", fallbacks?.features ?? "Features"),    narrative: "confidence"  as const },
    { id: "testimonials", label: t("landing.navTestimonials", fallbacks?.testimonials ?? "Trust"), narrative: "trust"    as const },
    { id: "cta",          label: t("landing.navCTA", fallbacks?.cta ?? "Start"),                narrative: "action"      as const },
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

          <NavigationRegistry id="pain">
            <StatsSection t={safeT} />
            <PainScene t={safeT} />
          </NavigationRegistry>

          <NavigationRegistry id="transform">
            <TransformScene t={safeT} />
          </NavigationRegistry>

          <NavigationRegistry id="features">
            <FeaturesScene t={safeT} />
          </NavigationRegistry>

          <NavigationRegistry id="testimonials">
            <SocialScene t={safeT} />
          </NavigationRegistry>

          <FaqScene t={safeT} />

          <NavigationRegistry id="cta">
            <CTAScene t={safeT} onNavigateLogin={navigateLogin} />
          </NavigationRegistry>

          <footer
            className={cn(
              "px-4 py-12 text-center",
              "border-t border-[hsl(var(--border-default))]"
            )}
          >
            <div className="mb-2 text-lg font-bold text-[hsl(var(--fg-primary))]">
              {safeT("app.name", "حسابچه")}
              <span className="text-[hsl(var(--color-primary))]">.</span>
            </div>
            <p className="text-[length:var(--text-caption)] text-[hsl(var(--fg-tertiary))]">
              {safeT("landing.footer", "سیستم مدیریت کسب‌وکار")}
            </p>
          </footer>
        </main>
      </div>
    </NavigationProvider>
  );
}