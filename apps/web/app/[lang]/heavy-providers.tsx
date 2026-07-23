// apps/web/app/[lang]/heavy-providers.tsx
"use client";

import React, { useEffect, useRef, memo } from "react";
import { useThemeStore, useAuthStore, useDeviceStore } from "@hisabche/store";
import { syncLanguageFromStorage } from "@hisabche/i18n";

/* ═══════════════════════════════════════════════════════════════════════════
   HeavyProviders v2 — Memoized · Optimized · Non-blocking
   ✅ memo · useCallback · useRef · وابستگی‌های اصلاح‌شده
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Analytics Loader ──────────────────────────────────────────────────────

let analyticsLoaded = false;

function loadAnalytics() {
  if (analyticsLoaded) return;
  analyticsLoaded = true;

  const load = () => {
    import("@hisabche/analytics")
      .then((module) => {
        module.initPostHog?.();
        module.initSentry?.();
      })
      .catch(() => {});
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(load, { timeout: 3000 });
  } else {
    setTimeout(load, 2000);
  }
}

// ─── Adaptive UI Initializer ──────────────────────────────────────────────

const AdaptiveUIInitializer = memo(function AdaptiveUIInitializer() {
  useEffect(() => {
    const root = document.documentElement;
    const cores = navigator.hardwareConcurrency ?? 4;
    const isLowPerf = cores <= 4;

    root.dataset.perf = isLowPerf ? "low" : "high";
    root.style.setProperty("--motion-scale", isLowPerf ? "0.5" : "1");
    root.style.setProperty("--shadow-intensity", isLowPerf ? "0.6" : "1");
    root.style.setProperty("--glass-blur-scale", isLowPerf ? "0.5" : "1");
  }, []);

  return null;
});
AdaptiveUIInitializer.displayName = "AdaptiveUIInitializer";

// ─── Theme Initializer ─────────────────────────────────────────────────────

const ThemeInitializer = memo(function ThemeInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { mode, setMode } = useThemeStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    setMode(mode);

    const html = document.documentElement;
    html.classList.toggle("dark", mode === "dark");
    html.classList.toggle("light", mode === "light");

    // ✅ Device detection
    const { detectDevice, performanceMode, reducedMotion, dataSaver } =
      useDeviceStore.getState();
    detectDevice();

    if (performanceMode === "lite" || reducedMotion) {
      html.classList.add("lite-mode");
      html.dataset.perf = "low";
    }
    if (dataSaver) {
      html.classList.add("data-saver");
    }
  }, [mode, setMode]);

  return <>{children}</>;
});
ThemeInitializer.displayName = "ThemeInitializer";

// ─── Auth Initializer ──────────────────────────────────────────────────────

const AuthInitializer = memo(function AuthInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  const identified = useRef(false);

  useEffect(() => {
    if (!user || identified.current) return;
    identified.current = true;

    const timer = setTimeout(async () => {
      try {
        const analytics = await import("@hisabche/analytics");
        analytics.identifyUser?.(user.id, {
          email: user.email,
          businessName: user.businessName,
        });
        analytics.setUser?.(user.id, user.email);
      } catch {
        // ✅ Silently fail - analytics not critical
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [user]);

  return <>{children}</>;
});
AuthInitializer.displayName = "AuthInitializer";

// ─── Language Initializer ──────────────────────────────────────────────────

const LanguageInitializer = memo(function LanguageInitializer({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const timer = setTimeout(() => syncLanguageFromStorage(), 100);
    return () => clearTimeout(timer);
  }, []);

  return <>{children}</>;
});
LanguageInitializer.displayName = "LanguageInitializer";

// ─── Analytics Bootstrap ───────────────────────────────────────────────────

const AnalyticsBootstrap = memo(function AnalyticsBootstrap() {
  useEffect(() => {
    loadAnalytics();
  }, []);

  return null;
});
AnalyticsBootstrap.displayName = "AnalyticsBootstrap";

// ─── Main Component ────────────────────────────────────────────────────────

export const HeavyProviders = memo(function HeavyProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdaptiveUIInitializer />
      <AnalyticsBootstrap />
      <ThemeInitializer>
        <AuthInitializer>
          <LanguageInitializer>{children}</LanguageInitializer>
        </AuthInitializer>
      </ThemeInitializer>
    </>
  );
});

HeavyProviders.displayName = "HeavyProviders";