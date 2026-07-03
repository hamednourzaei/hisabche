// packages/ui/src/components/ui/dashboard-sidebar.tsx
"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ElementType } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   DashboardSidebar v4 — Bold Logo + Premium Minimal
   ═══════════════════════════════════════════════════════════════════════════ */

export interface NavItem {
  id: string;
  icon: ElementType<any>;
  label: string;
  path: string;
  badge?: number;
}

function isPathActive(currentPath: string, itemPath: string): boolean {
  if (currentPath === itemPath) return true;
  if (currentPath.startsWith(itemPath + "/")) return true;
  if (currentPath.startsWith(itemPath + "?")) return true;
  return false;
}

const ICON_PATHS: Record<string, JSX.Element> = {
  dashboard: (
    <g>
      <path d="M3 10.5 10 4l7 6.5" />
      <path d="M5 9.5V16h10V9.5" />
    </g>
  ),
  godam: (
    <g>
      <path d="M3 7 10 4l7 3v6l-7 3-7-3z" />
      <path d="M3 7l7 3 7-3M10 10v6" />
    </g>
  ),
  invoices: (
    <g>
      <path d="M5 3h7l3 3v11H5z" />
      <path d="M12 3v3h3" />
      <path d="M7.5 9h5M7.5 12h5M7.5 15h3" />
    </g>
  ),
  baqidari: (
    <g>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M3.5 16c.6-2.4 2.4-3.6 4.5-3.6s3.9 1.2 4.5 3.6" />
      <circle cx="14.5" cy="7.5" r="2.2" />
      <path d="M13 12.4c2 0 3.4 1.1 4 3.1" />
    </g>
  ),
  settings: (
    <g>
      <circle cx="10" cy="10" r="2.4" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.2 5.2l1.4 1.4M13.4 13.4l1.4 1.4M5.2 14.8l1.4-1.4M13.4 6.6l1.4-1.4" />
    </g>
  ),
};

function SidebarIcon({ id, active }: { id: string; active: boolean }) {
  const path = ICON_PATHS[id];
  if (!path) return null;

  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(
        "shrink-0 transition-colors duration-200",
        active
          ? "text-[hsl(var(--color-primary))]"
          : "text-[hsl(var(--fg-tertiary))] group-hover:text-[hsl(var(--fg-secondary))]",
      )}
    >
      {path}
    </svg>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────

export function DashboardSidebar({
  items,
  activeNav,
  onNavigate,
}: {
  items: NavItem[];
  activeNav: string;
  onNavigate: (id: string, path: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col shrink-0",
        "w-56 h-screen sticky top-0 overflow-y-auto",
        "border-e border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-base))]",
      )}
    >
      {/* Logo — Bold, centered, prominent */}
      <div className="flex flex-col items-center gap-1 pt-6 pb-4">
        <div className="transition-all duration-300 hover:scale-105 hover:filter hover:drop-shadow-[0_0_18px_rgba(18,200,160,0.25)]">
          <img
            src="/logo-icon.png"
            alt="حسابچه"
            className="h-16 w-16 object-contain"
          />
        </div>
        <span className="text-[11px] font-medium tracking-widest text-[hsl(var(--fg-tertiary))] uppercase">
          hisabche
        </span>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-[hsl(var(--border-default))] opacity-60" />

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-3 pt-3 flex-1">
        {items.map((item) => {
          const isActive = isPathActive(activeNav, item.path);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id, item.path)}
              className={cn(
                "group relative flex items-center gap-2.5 h-10 px-3 rounded-xl",
                "text-sm font-medium text-start w-full",
                "transition-all duration-200",
                "motion-reduce:transition-none",
                isActive
                  ? "bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))] font-semibold shadow-[0_0_20px_rgba(18,200,160,0.06)]"
                  : "text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Active indicator — end side (left in RTL) */}
              {isActive && (
                <span className="absolute end-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[var(--gradient-brand)] shadow-[0_0_8px_rgba(18,200,160,0.3)]" />
              )}

              {/* Icon */}
              <span className={cn("transition-transform duration-200", isActive && "scale-110")}>
                {ICON_PATHS[item.id] ? (
                  <SidebarIcon id={item.id} active={isActive} />
                ) : (
                  <item.icon
                    className={cn(
                      "size-[18px] shrink-0 transition-colors duration-200",
                      isActive
                        ? "text-[hsl(var(--color-primary))]"
                        : "text-[hsl(var(--fg-tertiary))] group-hover:text-[hsl(var(--fg-secondary))]",
                    )}
                  />
                )}
              </span>

              {/* Label */}
              <span className="flex-1 truncate">{t(item.label)}</span>

              {/* Badge */}
              {item.badge != null && (
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    "px-1.5 py-0.5 rounded-full shrink-0",
                    "bg-[hsl(var(--surface-muted))]",
                    "text-[hsl(var(--fg-secondary))]",
                    "border border-[hsl(var(--border-default))]",
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4">
        <div className="h-px bg-[hsl(var(--border-default))] mb-3 opacity-50" />
        <p className="text-center text-[10px] text-[hsl(var(--fg-tertiary))] tracking-wider">
          v2.0
        </p>
      </div>
    </aside>
  );
}

// ─── BottomNav (unchanged) ─────────────────────────────────────────────────

export function BottomNav({
  items,
  activeNav,
  onNavigate,
}: {
  items: NavItem[];
  activeNav: string;
  onNavigate: (id: string, path: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50 max-w-[480px] mx-auto lg:hidden">
      <div
        className={cn(
          "relative h-14",
          "rounded-2xl",
          "border border-[hsl(var(--color-primary)/0.18)]",
          "bg-[hsl(var(--surface-elevated)/0.98)] backdrop-blur-md",
          "shadow-lg",
          "overflow-hidden",
        )}
      >
        <ul
          className="flex flex-row h-full m-0 p-0 list-none overflow-x-auto scroll-smooth"
          style={{
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
            gap: "4px",
            paddingInline: "12px",
            alignItems: "stretch",
            direction: "rtl",
          } as React.CSSProperties}
        >
          {items.slice(0, 6).map((item) => {
            const isActive = isPathActive(activeNav, item.path);

            return (
              <li
                key={item.id}
                className="relative flex-shrink-0 h-full cursor-pointer"
                style={{ width: 70, scrollSnapAlign: "center" }}
              >
                <div
                  className={cn(
                    "absolute start-1/2 -translate-x-1/2",
                    "transition-all duration-150 ease-out",
                    "h-[3px] rounded-full",
                    "bg-[var(--gradient-brand)]",
                    isActive ? "w-8 opacity-100" : "w-0 opacity-0",
                  )}
                  style={{ top: -1 }}
                />

                <button
                  type="button"
                  onClick={() => onNavigate(item.id, item.path)}
                  className="flex flex-col items-center justify-center w-full h-full"
                  aria-current={isActive ? "page" : undefined}
                  aria-label={t(item.label)}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center",
                      "transition-all duration-150 ease-out",
                      isActive
                        ? "-translate-y-0.5 scale-105 text-[hsl(var(--color-primary))]"
                        : "translate-y-0 scale-100 text-[hsl(var(--fg-tertiary))]",
                    )}
                  >
                    {ICON_PATHS[item.id] ? (
                      <SidebarIcon id={item.id} active={isActive} />
                    ) : (
                      <item.icon className="size-[20px]" />
                    )}
                  </div>

                  <span
                    className={cn(
                      "whitespace-nowrap mt-0.5 transition-all duration-150",
                      isActive
                        ? "font-semibold text-[hsl(var(--color-primary))]"
                        : "font-normal text-[hsl(var(--fg-tertiary))]",
                    )}
                    style={{ fontSize: 10 }}
                  >
                    {t(item.label)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}