// Fix: landing-page.tsx — پاس دادن t به CinematicHero

"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
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

const NAVIGATION_SECTIONS = [
  { id: "hero",         label: "خانه",    narrative: "frustration" as const },
  { id: "pain",         label: "مشکل",    narrative: "confusion"   as const },
  { id: "transform",    label: "راه‌حل",  narrative: "clarity"     as const },
  { id: "features",     label: "امکانات", narrative: "confidence"  as const },
  { id: "testimonials", label: "اعتماد",  narrative: "trust"       as const },
  { id: "cta",          label: "شروع",    narrative: "action"      as const },
];

export function LandingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const navigateLogin = useCallback(() => router.push("/login"), [router]);
// توی landing-page.tsx، یه safeT بساز:

const safeT = (key: string, fallback?: string) => {
  const result = t(key);
  return result !== key ? result : (fallback ?? key);
};
  return (
    <NavigationProvider sections={NAVIGATION_SECTIONS}>
      <div className="min-h-screen bg-[hsl(var(--surface-base))]">
        <TopNav variant="landing" onNavigateLogin={navigateLogin} />

        <main>
          <NavigationRegistry id="hero">
           <CinematicHero t={safeT} onNavigateLogin={navigateLogin} />
          </NavigationRegistry>

          <NavigationRegistry id="pain">
            <StatsSection t={safeT}/>
            <PainScene t={safeT}/>
          </NavigationRegistry>

          <NavigationRegistry id="transform">
            <TransformScene t={safeT}/>
          </NavigationRegistry>

          <NavigationRegistry id="features">
            <FeaturesScene t={safeT} />
          </NavigationRegistry>

          <NavigationRegistry id="testimonials">
            <SocialScene t={safeT}/>
          </NavigationRegistry>

          <FaqScene t={safeT}/>

          <NavigationRegistry id="cta">
            <CTAScene t={safeT} onNavigateLogin={navigateLogin} />
          </NavigationRegistry>

          <footer
            className={cn(
              "px-4 py-12 text-center",
              "border-t border-[hsl(var(--border-default))]",
            )}
          >
            <div className="mb-2 text-lg font-bold text-[hsl(var(--fg-primary))]">
              حسابچه
              <span className="text-[hsl(var(--color-primary))]">.</span>
            </div>
            <p className="text-[length:var(--text-caption)] text-[hsl(var(--fg-tertiary))]">
              حافظه‌ی زنده‌ی کسب‌وکار تو · © ۱۴۰۵
            </p>
          </footer>
        </main>
      </div>
    </NavigationProvider>
  );
}