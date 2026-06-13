"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
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

/* ═══════════════════════════════════════════════════════════════════════════
   LandingPage v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   ═══════════════════════════════════════════════════════════════════════════ */

const NAVIGATION_SECTIONS = [
  { id: "hero", label: "خانه", narrative: "frustration" as const },
  { id: "pain", label: "مشکل", narrative: "confusion" as const },
  { id: "transform", label: "راه‌حل", narrative: "clarity" as const },
  { id: "features", label: "امکانات", narrative: "confidence" as const },
  { id: "testimonials", label: "اعتماد", narrative: "trust" as const },
  { id: "cta", label: "شروع", narrative: "action" as const },
];

export function LandingPage() {
  const router = useRouter();
  const navigateLogin = useCallback(() => router.push("/login"), [router]);

  return (
    <NavigationProvider sections={NAVIGATION_SECTIONS}>
      <div className="min-h-screen bg-[hsl(var(--surface-base))]">
        <TopNav
          variant="landing"
          onNavigateLogin={navigateLogin}
          appName="حسابچه"
        />

        <main>
          {/* Hero section */}
          <NavigationRegistry id="hero">
            <CinematicHero onNavigateLogin={navigateLogin} />
          </NavigationRegistry>

          {/* Stats / Pain section */}
          <NavigationRegistry id="pain">
            <StatsSection />
            <PainScene />
          </NavigationRegistry>

          {/* Transform / Features sections */}
          <NavigationRegistry id="transform">
            <TransformScene />
          </NavigationRegistry>

          <NavigationRegistry id="features">
            <FeaturesScene />
          </NavigationRegistry>

          {/* Testimonials */}
          <NavigationRegistry id="testimonials">
            <SocialScene />
          </NavigationRegistry>

          {/* FAQ and CTA */}
          <FaqScene />

          <NavigationRegistry id="cta">
            <CTAScene onNavigateLogin={navigateLogin} />
          </NavigationRegistry>

          {/* Footer */}
          <footer className="border-t border-[hsl(var(--border-default))] px-4 py-32 text-center">
            <div className="mb-2 text-lg font-bold text-[hsl(var(--fg-primary))]">
              حسابچه
              <span className="text-[hsl(var(--color-primary))]">.</span>
            </div>
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              حافظه‌ی زنده‌ی کسب‌وکار تو · © ۱۴۰۵
            </p>
          </footer>
        </main>
      </div>
    </NavigationProvider>
  );
}