"use client";

import { memo, useState, useRef, useEffect, useCallback, useId } from "react";
import { cn } from "@/lib/utils";
import type { ElementType, ReactElement } from "react";
import { useAuthStore } from "@hisabche/store";
import { useTranslation } from "react-i18next";

/* ═══════════════════════════════════════════════════════════════════════════
   DashboardSidebar v7.3 — Memoized · Performance Optimized
   ✅ memo برای همه کامپوننت‌ها
   ═══════════════════════════════════════════════════════════════════════════ */

export interface NavItem {
  id: string;
  icon: ElementType;
  label: string;
  path: string;
  badge?: number;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: ElementType;
  items: NavItem[];
}

function isPathActive(currentPath: string, itemPath: string): boolean {
  const normalized = currentPath.replace(/^\/(fa-IR|fa-AF|en)/, "") || "/";
  if (normalized === itemPath) return true;
  if (normalized.startsWith(itemPath + "/")) return true;
  if (normalized.startsWith(itemPath + "?")) return true;
  return false;
}

const ICON_PATHS: Record<string, ReactElement> = {
  dashboard: (<g><path d="M3 10.5 10 4l7 6.5" /><path d="M5 9.5V16h10V9.5" /></g>),
  warehouse: (<g><path d="M3 7 10 4l7 3v6l-7 3-7-3z" /><path d="M3 7l7 3 7-3M10 10v6" /></g>),
  invoices: (<g><path d="M5 3h7l3 3v11H5z" /><path d="M12 3v3h3" /><path d="M7.5 9h5M7.5 12h5M7.5 15h3" /></g>),
  customers: (<g><circle cx="8" cy="8" r="2.8" /><path d="M3.5 16c.6-2.4 2.4-3.6 4.5-3.6s3.9 1.2 4.5 3.6" /><circle cx="14.5" cy="7.5" r="2.2" /><path d="M13 12.4c2 0 3.4 1.1 4 3.1" /></g>),
  settings: (<g><circle cx="10" cy="10" r="2.4" /><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.2 5.2l1.4 1.4M13.4 13.4l1.4 1.4M5.2 14.8l1.4-1.4M13.4 6.6l1.4-1.4" /></g>),
};

// ✅ SidebarIcon با memo
const SidebarIcon = memo(function SidebarIcon({
  id,
  active,
  size = 18,
}: {
  id: string;
  active: boolean;
  size?: number;
}) {
  const path = ICON_PATHS[id];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(
        "shrink-0 transition-colors duration-200 motion-reduce:transition-none",
        active ? "text-[hsl(var(--color-primary))]" : "text-[hsl(var(--fg-tertiary))] group-hover:text-[hsl(var(--fg-secondary))]"
      )}
    >
      {path}
    </svg>
  );
});
SidebarIcon.displayName = "SidebarIcon";

// ✅ ItemIcon با memo
const ItemIcon = memo(function ItemIcon({
  item,
  active,
  size = 18,
}: {
  item: NavItem;
  active: boolean;
  size?: number;
}) {
  if (ICON_PATHS[item.id]) return <SidebarIcon id={item.id} active={active} size={size} />;
  return (
    <item.icon
      className={cn(
        "shrink-0 transition-colors duration-200 motion-reduce:transition-none",
        active ? "text-[hsl(var(--color-primary))]" : "text-[hsl(var(--fg-tertiary))] group-hover:text-[hsl(var(--fg-secondary))]"
      )}
      style={{ width: size, height: size }}
    />
  );
});
ItemIcon.displayName = "ItemIcon";

// ✅ PrimaryNavButton با memo
const PrimaryNavButton = memo(function PrimaryNavButton({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2.5 h-10 px-3 rounded-xl",
        "text-sm font-medium text-start w-full",
        "transition-all duration-200 motion-reduce:transition-none",
        isActive
          ? "bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))] font-semibold shadow-[0_0_20px_hsl(var(--color-primary)/0.06)]"
          : "text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {isActive && (
        <span className="absolute end-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[var(--gradient-brand)] shadow-[0_0_8px_hsl(var(--color-primary)/0.3)]" />
      )}
      <span
        className={cn(
          "transition-transform duration-200 motion-reduce:transition-none",
          isActive && "scale-110"
        )}
      >
        <ItemIcon item={item} active={isActive} />
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge != null && (
        <span
          className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
            "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]",
            "border border-[hsl(var(--border-default))]"
          )}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
});
PrimaryNavButton.displayName = "PrimaryNavButton";

// ✅ MorePanelItem با memo
const MorePanelItem = memo(function MorePanelItem({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2.5 h-9 px-3 rounded-lg w-full text-start",
        "text-sm transition-colors duration-150 motion-reduce:transition-none",
        isActive
          ? "bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))] font-semibold"
          : "text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <ItemIcon item={item} active={isActive} size={16} />
      <span className="flex-1 truncate">{item.label}</span>
      {isActive && (
        <svg
          width={14}
          height={14}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[hsl(var(--color-primary))] shrink-0"
        >
          <path d="M5 10l3.5 3.5L15 7" />
        </svg>
      )}
    </button>
  );
});
MorePanelItem.displayName = "MorePanelItem";

// ─── Desktop Sidebar ─────────────────────────────────────────────────────────

export const DashboardSidebar = memo(function DashboardSidebar({
  primaryItems,
  moreGroups,
  moreIcon: MoreIcon,
  activeNav,
  onNavigate,
}: {
  primaryItems: NavItem[];
  moreGroups: NavGroup[];
  moreIcon: ElementType;
  activeNav: string;
  onNavigate: (id: string, path: string) => void;
}) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [isMoreOpen, setIsMoreOpen] = useState(true);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  const hasMoreActive = moreGroups.some((g) =>
    g.items.some((i) => isPathActive(activeNav, i.path))
  );

  useEffect(() => {
    if (!isMoreOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        morePanelRef.current &&
        !morePanelRef.current.contains(target) &&
        moreBtnRef.current &&
        !moreBtnRef.current.contains(target)
      ) {
        setIsMoreOpen(false);
      }
    }
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClickOutside), 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMoreOpen]);

  useEffect(() => {
    if (!isMoreOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsMoreOpen(false);
        moreBtnRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMoreOpen]);

  return (
    <aside
      aria-label={t("nav.mainNav", "ناوبری اصلی")}
      className={cn(
        "hidden lg:flex lg:flex-col shrink-0",
        "w-56 h-screen sticky top-0 overflow-y-auto",
        "border-e border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-base))]"
      )}
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-1 pt-6 pb-4">
        <div className="transition-all duration-300 motion-reduce:transition-none hover:scale-105 hover:filter hover:drop-shadow-[0_0_18px_hsl(var(--color-primary)/0.25)]">
          <img src="/logo-icon.png" alt={t("app.name", "حسابچه")} className="h-16 w-16 object-contain" />
        </div>
        <span className="text-xs font-semibold text-[hsl(var(--fg-primary))] truncate max-w-[140px] text-center">
          {user?.businessName || user?.fullName || t("app.name", "حسابچه")}
        </span>
      </div>

      <div className="mx-4 h-px bg-[hsl(var(--border-default))] opacity-60" />

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-3 pt-3">
        {primaryItems.map((item) => (
          <PrimaryNavButton
            key={item.id}
            item={item}
            isActive={isPathActive(activeNav, item.path)}
            onClick={() => onNavigate(item.id, item.path)}
          />
        ))}
      </nav>

      <div className="mx-4 my-3 h-px bg-[hsl(var(--border-default))] opacity-40" />

      {/* More section */}
      <div className="px-3 relative">
        <button
          ref={moreBtnRef}
          type="button"
          onClick={() => setIsMoreOpen((p) => !p)}
          className={cn(
            "group relative flex items-center gap-2.5 h-10 px-3 rounded-xl w-full text-start",
            "text-sm font-medium transition-all duration-200 motion-reduce:transition-none",
            isMoreOpen
              ? "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-primary))]"
              : hasMoreActive
              ? "text-[hsl(var(--color-primary))]"
              : "text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
          )}
          aria-expanded={isMoreOpen}
          aria-haspopup="true"
        >
          <MoreIcon
            className={cn(
              "size-[18px] shrink-0 transition-transform duration-200 motion-reduce:transition-none",
              isMoreOpen && "rotate-90"
            )}
          />
          <span className="flex-1 truncate">{t("nav.more", "بیشتر")}</span>
          {hasMoreActive && !isMoreOpen && (
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--color-primary))] shrink-0" />
          )}
          <svg
            width={14}
            height={14}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className={cn(
              "shrink-0 transition-transform duration-200 motion-reduce:transition-none",
              isMoreOpen ? "rotate-90" : "-rotate-90"
            )}
          >
            <path d="M12 5l-5 5 5 5" />
          </svg>
        </button>

        {isMoreOpen && (
          <div
            ref={morePanelRef}
            className={cn(
              "absolute start-3 end-3 top-full mt-1 z-10",
              "w-[calc(100%-24px)]",
              "rounded-xl overflow-hidden",
              "border border-[hsl(var(--border-default))]",
              "bg-[hsl(var(--surface-elevated)/0.99)] backdrop-blur-xl",
              "shadow-xl shadow-black/10",
              "animate-in slide-in-from-top-1 fade-in-0 duration-150 motion-reduce:animate-none"
            )}
          >
            <div className="py-2 px-1">
              {moreGroups.map((group, idx) => (
                <div key={group.id}>
                  <div className="flex items-center gap-2 px-2 pt-2 pb-1">
                    <span className="text-[10px] font-semibold text-[hsl(var(--fg-tertiary))] tracking-wide">
                      {group.label}
                    </span>
                    <span className="flex-1 h-px bg-[hsl(var(--border-default))] opacity-30" />
                  </div>
                  <div className="flex flex-col gap-0.5 px-1">
                    {group.items.map((item) => (
                      <MorePanelItem
                        key={item.id}
                        item={item}
                        isActive={isPathActive(activeNav, item.path)}
                        onClick={() => {
                          setIsMoreOpen(false);
                          onNavigate(item.id, item.path);
                        }}
                      />
                    ))}
                  </div>
                  {idx < moreGroups.length - 1 && (
                    <div className="my-1.5 mx-2 h-px bg-[hsl(var(--border-default))] opacity-30" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1" />
      <div className="px-3 py-4">
        <div className="h-px bg-[hsl(var(--border-default))] mb-3 opacity-50" />
        <p className="text-center text-[10px] text-[hsl(var(--fg-tertiary))] tracking-wider">v3.0</p>
      </div>
    </aside>
  );
});

DashboardSidebar.displayName = "DashboardSidebar";

// ─── Mobile BottomNav ───────────────────────────────────────────────────────

const NAV_HEIGHT_PX = 56;
const NAV_OFFSET_PX = 16;
const NAV_GAP_PX = 8;
const POPOVER_BOTTOM = `calc(${NAV_HEIGHT_PX + NAV_OFFSET_PX + NAV_GAP_PX}px + env(safe-area-inset-bottom, 0px))`;
const BACKDROP_BOTTOM = `calc(${NAV_HEIGHT_PX + NAV_OFFSET_PX}px + env(safe-area-inset-bottom, 0px))`;

export const BottomNav = memo(function BottomNav({
  primaryItems,
  moreGroups,
  moreIcon: MoreIcon,
  activeNav,
  onNavigate,
}: {
  primaryItems: NavItem[];
  moreGroups: NavGroup[];
  moreIcon: ElementType;
  activeNav: string;
  onNavigate: (id: string, path: string) => void;
}) {
  const { t } = useTranslation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const hasMoreActive = moreGroups.some((g) =>
    g.items.some((i) => isPathActive(activeNav, i.path))
  );

  const closeAndRestoreFocus = useCallback(() => {
    setIsMoreOpen(false);
    moreBtnRef.current?.focus();
  }, []);

  const handleItemSelect = useCallback(
    (id: string, path: string) => {
      setIsMoreOpen(false);
      onNavigate(id, path);
    },
    [onNavigate]
  );

  useEffect(() => {
    if (!isMoreOpen) return;
    function handleClickOutside(e: TouchEvent | MouseEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        moreBtnRef.current &&
        !moreBtnRef.current.contains(target)
      ) {
        setIsMoreOpen(false);
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isMoreOpen]);

  useEffect(() => {
    if (!isMoreOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeAndRestoreFocus();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMoreOpen, closeAndRestoreFocus]);

  useEffect(() => {
    if (isMoreOpen && popoverRef.current) {
      const firstItem = popoverRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]');
      firstItem?.focus();
    }
  }, [isMoreOpen]);

  return (
    <>
      <nav
        aria-label={t("nav.mobileNav", "ناوبری موبایل")}
        className="fixed bottom-4 inset-x-4 z-modal max-w-[480px] mx-auto lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div
          className={cn(
            "relative h-14 rounded-2xl",
            "border border-[hsl(var(--color-primary)/0.18)]",
            "bg-[hsl(var(--surface-elevated)/0.98)] backdrop-blur-md",
            "shadow-lg"
          )}
        >
          <ul
            className="flex flex-row items-stretch h-full m-0 p-0 list-none"
            style={{ gap: "2px", paddingInline: "8px", direction: "rtl" } as React.CSSProperties}
          >
            {primaryItems.map((item) => {
              const isActive = isPathActive(activeNav, item.path);
              return (
                <li key={item.id} className="flex-1 flex-shrink-0 min-w-0 h-full">
                  <button
                    type="button"
                    onClick={() => handleItemSelect(item.id, item.path)}
                    className={cn(
                      "relative flex flex-col items-center justify-center w-full h-full",
                      "transition-all duration-150 motion-reduce:transition-none",
                      isActive
                        ? "text-[hsl(var(--color-primary))]"
                        : "text-[hsl(var(--fg-tertiary))] active:text-[hsl(var(--fg-secondary))]"
                    )}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={item.label}
                  >
                    <div
                      className={cn(
                        "absolute start-1/2 -translate-x-1/2 h-[3px] rounded-full bg-[var(--gradient-brand)]",
                        "transition-all duration-150 ease-out",
                        isActive ? "w-8 opacity-100" : "w-0 opacity-0"
                      )}
                      style={{ top: -1 }}
                    />
                    <div
                      className={cn(
                        "transition-transform duration-150 motion-reduce:transition-none",
                        isActive && "-translate-y-0.5 scale-110"
                      )}
                    >
                      <ItemIcon item={item} active={isActive} size={20} />
                    </div>
                    <span
                      className={cn(
                        "mt-0.5 truncate max-w-[64px] transition-all duration-150",
                        isActive ? "font-semibold" : "font-normal"
                      )}
                      style={{ fontSize: 10 }}
                    >
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
            <li className="w-px self-stretch my-2 bg-[hsl(var(--border-default))] opacity-30 flex-shrink-0" />
            <li className="flex-1 flex-shrink-0 min-w-0 h-full">
              <button
                ref={moreBtnRef}
                type="button"
                onClick={() => setIsMoreOpen((p) => !p)}
                className={cn(
                  "relative flex flex-col items-center justify-center w-full h-full rounded-xl",
                  "transition-all duration-150 motion-reduce:transition-none",
                  isMoreOpen
                    ? "bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))]"
                    : hasMoreActive
                    ? "text-[hsl(var(--color-primary))]"
                    : "text-[hsl(var(--fg-tertiary))] active:text-[hsl(var(--fg-secondary))]"
                )}
                aria-expanded={isMoreOpen}
                aria-haspopup="true"
                aria-controls={isMoreOpen ? menuId : undefined}
                aria-label={t("nav.more", "بیشتر")}
              >
                {hasMoreActive && !isMoreOpen && (
                  <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-[hsl(var(--color-primary))]" />
                )}
                <div
                  className={cn(
                    "transition-transform duration-150 motion-reduce:transition-none",
                    isMoreOpen && "scale-110"
                  )}
                >
                  <MoreIcon className="size-[20px]" />
                </div>
                <span
                  className={cn(
                    "mt-0.5 transition-all duration-150",
                    isMoreOpen ? "font-semibold" : "font-normal"
                  )}
                  style={{ fontSize: 10 }}
                >
                  {t("nav.more", "بیشتر")}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {isMoreOpen && (
        <>
          <div
            ref={popoverRef}
            id={menuId}
            role="menu"
            aria-label={t("nav.more", "بیشتر")}
            className={cn(
              "fixed inset-x-4 z-popover max-w-[480px] mx-auto lg:hidden",
              "animate-in slide-in-from-bottom-2 fade-in-0 duration-200 motion-reduce:animate-none"
            )}
            style={{ bottom: POPOVER_BOTTOM }}
          >
            <div
              className={cn(
                "rounded-2xl overflow-hidden",
                "border border-[hsl(var(--border-default))]",
                "bg-[hsl(var(--surface-elevated)/0.99)] backdrop-blur-xl",
                "shadow-xl shadow-black/10"
              )}
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border-default))] opacity-70">
                <span className="text-xs font-semibold text-[hsl(var(--fg-secondary))]">
                  {t("nav.more", "بیشتر")}
                </span>
                <button
                  type="button"
                  onClick={closeAndRestoreFocus}
                  className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] active:text-[hsl(var(--fg-primary))] active:bg-[hsl(var(--surface-muted))]"
                  aria-label={t("action.close", "بستن")}
                >
                  <svg width={16} height={16} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M5 5l10 10M15 5L5 15" />
                  </svg>
                </button>
              </div>
              <div className="py-1.5">
                {moreGroups.map((group, idx) => (
                  <div key={group.id}>
                    <div className="flex items-center gap-2 px-4 pt-2 pb-1">
                      <span className="text-[10px] font-semibold text-[hsl(var(--fg-tertiary))] tracking-wide">
                        {group.label}
                      </span>
                      <span className="flex-1 h-px bg-[hsl(var(--border-default))] opacity-30" />
                    </div>
                    <div className="py-0.5">
                      {group.items.map((item) => {
                        const isActive = isPathActive(activeNav, item.path);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            onClick={() => handleItemSelect(item.id, item.path)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 min-h-11",
                              "transition-colors duration-150",
                              isActive
                                ? "bg-[hsl(var(--color-primary)/0.08)] text-[hsl(var(--color-primary))] font-semibold"
                                : "text-[hsl(var(--fg-primary))] active:bg-[hsl(var(--surface-muted))]"
                            )}
                            aria-current={isActive ? "page" : undefined}
                          >
                            <span
                              className={cn(
                                "transition-transform duration-150 motion-reduce:transition-none",
                                isActive && "scale-110"
                              )}
                            >
                              <ItemIcon item={item} active={isActive} size={18} />
                            </span>
                            <span className="flex-1 text-sm text-start truncate">{item.label}</span>
                            {isActive && (
                              <svg
                                width={16}
                                height={16}
                                viewBox="0 0 20 20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-[hsl(var(--color-primary))] shrink-0"
                              >
                                <path d="M5 10l3.5 3.5L15 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {idx < moreGroups.length - 1 && (
                      <div className="mx-4 my-1 h-px bg-[hsl(var(--border-default))] opacity-30" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className="fixed inset-0 z-modal-backdrop lg:hidden"
            style={{ bottom: BACKDROP_BOTTOM }}
            onTouchStart={closeAndRestoreFocus}
            onMouseDown={closeAndRestoreFocus}
            aria-hidden="true"
          />
        </>
      )}
    </>
  );
});

BottomNav.displayName = "BottomNav";