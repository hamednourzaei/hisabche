"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { NavigationProvider } from "../../../hooks/menu/use-navigation-state";
import { TopNav } from "../navigation/top-nav";
import { NavigationRegistry } from "../navigation/navigation-registry";

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
  const navigateLogin = useCallback(() => router.push("/login"), [router]);

  return (
    <NavigationProvider sections={NAVIGATION_SECTIONS}>
      <div className="min-h-screen bg-[hsl(var(--surface-base))]">
        <TopNav variant="landing" onNavigateLogin={navigateLogin} appName="حسابچه" />

        <main>
          <NavigationRegistry id="hero">
            <CinematicHero onNavigateLogin={navigateLogin} />
          </NavigationRegistry>

          <NavigationRegistry id="pain">
            <StatsSection />
            <PainScene />
          </NavigationRegistry>

          <NavigationRegistry id="transform">
            <TransformScene />
          </NavigationRegistry>

          <NavigationRegistry id="features">
            <FeaturesScene />
          </NavigationRegistry>

          <NavigationRegistry id="testimonials">
            <SocialScene />
          </NavigationRegistry>

          <FaqScene />

          <NavigationRegistry id="cta">
            <CTAScene onNavigateLogin={navigateLogin} />
          </NavigationRegistry>

          <footer
            className="px-4 py-12 text-center"
            style={{ borderTop: "1px solid hsl(var(--border-default))" }}
          >
            <div
              className="mb-2 text-lg font-bold"
              style={{ color: "hsl(var(--fg-primary))" }}
            >
              حسابچه
              <span style={{ color: "hsl(var(--color-primary))" }}>.</span>
            </div>
            <p style={{ fontSize: "var(--text-caption)", color: "hsl(var(--fg-tertiary))" }}>
              حافظه‌ی زنده‌ی کسب‌وکار تو · © ۱۴۰۵
            </p>
          </footer>
        </main>
      </div>
    </NavigationProvider>
  );
}