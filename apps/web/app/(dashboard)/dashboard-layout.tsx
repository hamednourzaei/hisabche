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
} from "react";
import { NAV_ITEMS, PRIMARY_ITEMS, MORE_GROUPS, MORE_ICON, COMMAND_ITEMS } from "./constants/nav-items";
import { cn } from "@/lib/utils";
import "@hisabche/ui/globals.css";

function usePrefetchRoutes() {
  const router = useRouter();
  useEffect(() => {
    NAV_ITEMS.forEach((item) => router.prefetch(item.path));
  }, [router]);
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isDark = useThemeStore((s) => s.isDark);
  const toggle = useThemeStore((s) => s.toggle);
  const isOnboardingComplete = useOnboardingStore((s) => s.isCompleted);
  const redirected = useRef(false);
  const lastSyncedAt = useRef(Date.now());

  usePrefetchRoutes();

  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const activeNav = optimisticPath ?? pathname;

  useEffect(() => setOptimisticPath(null), [pathname]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated && !redirected.current) {
      redirected.current = true;
      router.replace("/login");
      return;
    }
    if (isAuthenticated && !isOnboardingComplete) {
      router.replace("/onboarding");
    }
  }, [hasHydrated, isAuthenticated, isOnboardingComplete, router]);

  const currentLang = i18n.language || "fa-AF";

  const toggleLang = useCallback(() => {
    i18n.changeLanguage(i18n.language === "fa-AF" ? "fa-IR" : "fa-AF");
  }, [i18n]);

  // ✅ Sidebar & BottomNav: آیتم‌های اصلی (داشبورد، فاکتور، باقی‌داری، ګدام)
  const primaryItems = useMemo(() =>
    PRIMARY_ITEMS.map((item) => ({
      id: item.id,
      icon: item.icon,
      label: t(item.labelKey, item.id),
      path: item.path,
    })),
  [t]);

  // ✅ Sidebar & BottomNav: گروه‌های پنهان (تیم، سیستم)
  const moreGroups = useMemo(() =>
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
  [t]);

  const commands = useMemo(() =>
    COMMAND_ITEMS.map((cmd) => ({
      id: cmd.id,
      label: t(cmd.labelKey),
      description: t(cmd.descriptionKey),
      icon: cmd.icon,
      ...(cmd.shortcut ? { shortcut: cmd.shortcut } : {}),
      onSelect: () => { setOptimisticPath(cmd.path); router.push(cmd.path); },
    })),
  [router, t]);

  const handleLogout = useCallback(() => {
    useAuthStore.getState().logout();
    router.replace("/login");
  }, [router]);

  const handleNavigate = useCallback((_id: string, path: string) => {
    setOptimisticPath(path);
    router.push(path);
  }, [router]);

  const handleNavigateLogin = useCallback(() => router.push("/login"), [router]);

  if (hasHydrated && !isAuthenticated) return null;

  const isRtl = i18n.language === "fa-AF" || i18n.language === "fa-IR";

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className={cn("flex min-h-screen", "bg-[hsl(var(--surface-base))]", "text-[hsl(var(--fg-primary))]")}>
      <CommandPalette commands={commands} />

      {/* ✅ دسکتاپ: آیتم‌های اصلی + دکمه بیشتر */}
      <DashboardSidebar 
        primaryItems={primaryItems} 
        moreGroups={moreGroups} 
        moreIcon={MORE_ICON}
        activeNav={activeNav} 
        onNavigate={handleNavigate} 
      />

      <div className="flex min-h-screen flex-1 flex-col">
        <DashboardHeader
          variant="dashboard" appName={t("app.name")} lastSyncedAt={lastSyncedAt.current}
          isOnline={true} isSyncing={false} pendingCount={0} currentLang={currentLang}
          isDark={isDark} signInLabel={t("auth.signIn")} signOutLabel={t("auth.signOut")}
          onToggleTheme={toggle} onToggleLang={toggleLang} onLogout={handleLogout}
          onNavigateLogin={handleNavigateLogin}
        />

        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:pb-4">
          <Breadcrumb className="mb-4" />
          {children}
        </main>

        {/* ✅ موبایل: آیتم‌های اصلی + دکمه بیشتر */}
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
}