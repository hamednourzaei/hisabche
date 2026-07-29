// packages/ui/src/components/ui/dashboard/dashboard-layout.tsx
"use client";

import type { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  useAuthStore,
  useThemeStore,
  useOnboardingStore,
} from "@hisabche/store";
import { useTranslation } from "react-i18next";
import {
  DashboardHeader,
  DashboardSidebar,
  BottomNav,
  CommandPalette,
  Breadcrumb,
} from "@hisabche/ui";
import {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
  memo,
} from "react";
import { NAV_ITEMS, PRIMARY_ITEMS, MORE_GROUPS, MORE_ICON, COMMAND_ITEMS } from "./constants/nav-items";
import { cn } from "@/lib/utils";
import "@hisabche/ui/globals.css";

/* ═══════════════════════════════════════════════════════════════════════════
   DashboardLayout v2 — Memoized · Performance Optimized · SaaS-Level
   ✅ memo · useCallback · useMemo · prefetch بهینه
   ═══════════════════════════════════════════════════════════════════════════ */

function getLocaleFromPathname(pathname: string): string {
  const match = pathname.match(/^\/(fa-IR|fa-AF|en)/);
  return match?.[1] ?? "fa-IR";
}

// ─── Hook: Prefetch Routes ─────────────────────────────────────────────────

function usePrefetchRoutes(pathname: string) {
  const router = useRouter();

  useEffect(() => {
    const currentPath = pathname.replace(/^\/(fa-IR|fa-AF|en)/, "") || "/";

    const relevantItems = NAV_ITEMS.filter((item) => {
      return (
        currentPath.startsWith(item.path) ||
        item.path.startsWith(currentPath) ||
        currentPath.split("/").length === item.path.split("/").length
      );
    });

    for (const item of relevantItems.slice(0, 3)) {
      router.prefetch(item.path);
    }
  }, [router, pathname]);
}

// ─── Hook: Redirect Guard ──────────────────────────────────────────────────

function useRedirectGuard() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isOnboardingComplete = useOnboardingStore((s) => s.isCompleted);
  const redirected = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!isAuthenticated && !redirected.current) {
      redirected.current = true;
      router.replace("/login");
      return;
    }

    if (isAuthenticated && !isOnboardingComplete && !redirected.current) {
      redirected.current = true;
      router.replace("/onboarding");
      return;
    }

    if (isAuthenticated && isOnboardingComplete) {
      redirected.current = false;
    }
  }, [hasHydrated, isAuthenticated, isOnboardingComplete, router]);
}

// ─── Main Component ─────────────────────────────────────────────────────────

const DashboardLayout = memo(function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const isDark = useThemeStore((s) => s.isDark);
  const toggle = useThemeStore((s) => s.toggle);
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const lastSyncedAt = useRef(Date.now());

  usePrefetchRoutes(pathname);
  useRedirectGuard();

  const activeNav = optimisticPath ?? pathname;

  useEffect(() => {
    if (optimisticPath) {
      setOptimisticPath(null);
    }
  }, [pathname]);

  const currentLang = getLocaleFromPathname(pathname);

  useEffect(() => {
    if (i18n.language !== currentLang) {
      i18n.changeLanguage(currentLang);
      localStorage.setItem("hisabche-lang", currentLang);
    }
  }, [currentLang, i18n]);

  const toggleLang = useCallback(
    (lang: string) => {
      if (lang === currentLang) return;

      // ✅ FIX: مسیرهای واقعی af/fa/en هستن، نه fa-IR/fa-AF (که فرمت
      // قدیمی locale JSON هاست) — قبلاً این regex هیچ‌وقت match
      // نمی‌شد و مسیر جدید دوباره‌پیشونددار می‌شد (مثلاً /fa/af/...)
      const pathWithoutLocale = pathname.replace(/^\/(fa|af|en)(?=\/|$)/, "") || "/";
      const newPath = `/${lang}${pathWithoutLocale}`;

      router.push(newPath);
    },
    [pathname, currentLang, router]
  );

  const handleNavigate = useCallback(
    (_id: string, path: string) => {
      setOptimisticPath(path);
      router.push(path);
    },
    [router]
  );

  const handleLogout = useCallback(() => {
    useAuthStore.getState().logout();
    router.replace("/login");
  }, [router]);

  const handleNavigateLogin = useCallback(() => router.push("/login"), [router]);

  const primaryItems = useMemo(
    () =>
      PRIMARY_ITEMS.map((item) => ({
        id: item.id,
        icon: item.icon,
        label: t(item.labelKey, item.id),
        path: item.path,
      })),
    [t]
  );

  const moreGroups = useMemo(
    () =>
      MORE_GROUPS.map((g) => ({
        id: g.id,
        label: t(g.labelKey, g.id),
        icon: g.icon,
        items: g.items.map((item) => ({
          id: item.id,
          icon: item.icon,
          label: t(item.labelKey, item.id),
          path: item.path,
        })),
      })),
    [t]
  );

  const commands = useMemo(
    () =>
      COMMAND_ITEMS.map((cmd) => ({
        id: cmd.id,
        label: t(cmd.labelKey),
        description: t(cmd.descriptionKey),
        icon: cmd.icon,
        ...(cmd.shortcut ? { shortcut: cmd.shortcut } : {}),
        onSelect: () => {
          setOptimisticPath(cmd.path);
          router.push(cmd.path);
        },
      })),
    [router, t]
  );

  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (hasHydrated && !isAuthenticated) return null;

  const isRtl = currentLang === "fa-AF" || currentLang === "fa-IR";

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(
        "flex min-h-screen",
        "bg-[hsl(var(--surface-base))]",
        "text-[hsl(var(--fg-primary))]"
      )}
    >
      <CommandPalette commands={commands} />

      <DashboardSidebar
        primaryItems={primaryItems}
        moreGroups={moreGroups}
        moreIcon={MORE_ICON}
        activeNav={activeNav}
        onNavigate={handleNavigate}
      />

      <div className="flex min-h-screen flex-1 flex-col">
        <DashboardHeader
          variant="dashboard"
          appName={t("app.name")}
          businessName={t("app.businessName")}
          lastSyncedAt={lastSyncedAt.current}
          isOnline={true}
          isSyncing={false}
          pendingCount={0}
          currentLang={currentLang}
          isDark={isDark}
          signInLabel={t("auth.signIn")}
          signOutLabel={t("auth.signOut")}
          onToggleTheme={toggle}
          onToggleLang={toggleLang}
          onLogout={handleLogout}
          onNavigateLogin={handleNavigateLogin}
        />

        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:pb-4">
          <Breadcrumb className="mb-4" />
          {children}
        </main>

        <BottomNav
          primaryItems={primaryItems}
          moreGroups={moreGroups}
          moreIcon={MORE_ICON}
          activeNav={activeNav}
          onNavigate={handleNavigate}
        />
      </div>
    </div>
  );
});

DashboardLayout.displayName = "DashboardLayout";

export default DashboardLayout;