// packages/ui/src/components/ui/dashboard-sidebar.tsx
"use client";

import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import type { ElementType } from "react";

export interface NavItem {
  id: string;
  icon: ElementType<any>;
  label: string;
  path: string;
  badge?: number;
}

const SvgIcon = ({ d, size = 18 }: { d: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
       strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const defaultIcons: Record<string, React.ReactNode> = {
  dashboard: <SvgIcon d={<g><path d="M3 10.5 10 4l7 6.5" /><path d="M5 9.5V16h10V9.5" /></g>} />,
  godam: <SvgIcon d={<g><path d="M3 7 10 4l7 3v6l-7 3-7-3z" /><path d="M3 7l7 3 7-3M10 10v6" /></g>} />,
  invoices: <SvgIcon d={<g><path d="M5 3h7l3 3v11H5z" /><path d="M12 3v3h3" /><path d="M7.5 9h5M7.5 12h5M7.5 15h3" /></g>} />,
  baqidari: <SvgIcon d={<g><circle cx="8" cy="8" r="2.8" /><path d="M3.5 16c.6-2.4 2.4-3.6 4.5-3.6s3.9 1.2 4.5 3.6" /><circle cx="14.5" cy="7.5" r="2.2" /><path d="M13 12.4c2 0 3.4 1.1 4 3.1" /></g>} />,
  settings: <SvgIcon d={<g><circle cx="10" cy="10" r="2.4" /><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.2 5.2l1.4 1.4M13.4 13.4l1.4 1.4M5.2 14.8l1.4-1.4M13.4 6.6l1.4-1.4" /></g>} />,
};

function isPathActive(currentPath: string, itemPath: string): boolean {
  if (currentPath === itemPath) return true;
  if (currentPath.startsWith(itemPath + "/")) return true;
  if (currentPath.startsWith(itemPath + "?")) return true;
  return false;
}

export function DashboardSidebar({ items, activeNav, onNavigate }: {
  items: NavItem[];
  activeNav: string;
  onNavigate: (id: string, path: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <aside className="sidebar-surface hidden w-60 border-e border-border/8 lg:flex lg:flex-col shrink-0 sticky top-0 h-screen overflow-y-auto">
      <div className="flex items-center gap-2.5 px-4 py-[11px] border-b border-border/8">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg text-sm font-bold shrink-0">ح</div>
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold truncate text-foreground">حسابچه</p>
          <p className="text-[11px] text-muted-foreground">مدیریت کسب‌وکار</p>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        <span className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">منو</span>
        {items.map((item) => {
          const isActive = isPathActive(activeNav, item.path);
          return (
            <button key={item.id} type="button" onClick={() => onNavigate(item.id, item.path)}
              className={cn(
                "relative flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-sm font-medium transition-colors text-start w-full",
                "text-muted-foreground hover:bg-muted hover:text-foreground",
                isActive && "bg-purple-500/20 text-purple-400 font-semibold"
              )}
              aria-current={isActive ? "page" : undefined}>
              {isActive && <span className="absolute start-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-primary" />}
              <span className={cn("inline-flex shrink-0", isActive ? "text-primary" : "text-muted-foreground")}>
                {defaultIcons[item.id] || <item.icon className="size-[13px]" />}
              </span>
              <span className="flex-1 truncate">{t(item.label)}</span>
              {item.badge != null && (
                <span className="text-[10px] font-semibold text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded-full shrink-0">{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border">
        <p className="text-center text-[10px] text-muted-foreground">حسابچه © ۲۰۲۶</p>
      </div>
    </aside>
  );
}

// ✅ BottomNav - نسخه مدرن و زیبا هماهنگ با globals.css
export function BottomNav({ items, activeNav, onNavigate }: {
  items: NavItem[];
  activeNav: string;
  onNavigate: (id: string, path: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-[480px] lg:hidden">
<div
  className="relative"
  style={{
    height: 64,
    borderRadius: 20,
    border: '1px solid rgba(168,85,247,0.18)',
    background: 'hsl(var(--hisab-card) / 0.98)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    overflow: 'hidden',
  }}
>
        <ul
          className="flex flex-row flex-nowrap overflow-x-auto overflow-y-hidden h-full m-0 p-0 list-none scroll-smooth"
          style={{
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            gap: '4px',
            padding: '0 12px',
            alignItems: 'stretch',
            direction: 'rtl',
          }}
        >
          {items.slice(0, 6).map((item) => {
            const isActive = isPathActive(activeNav, item.path);
            const IconComp = item.icon;

            return (
              <li
                key={item.id}
                className="relative flex-shrink-0 h-full cursor-pointer"
                style={{
                  width: 70,
                  scrollSnapAlign: 'center',
                }}
              >
                {/* Active indicator bar */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 transition-all duration-150 ease-out"
                  style={{
                    top: -1,
                    width: isActive ? 32 : 0,
                    height: 3,
                    borderRadius: '4px',
                    background: 'linear-gradient(90deg, #a855f7, #c084fc)',
                    opacity: isActive ? 1 : 0,
                  }}
                />

                <button
                  type="button"
                  onClick={() => onNavigate(item.id, item.path)}
                  className="flex flex-col items-center justify-center w-full h-full no-underline gap-0.5"
                  aria-current={isActive ? "page" : undefined}
                  aria-label={t(item.label)}
                >
                  <div
                    className="flex items-center justify-center transition-all duration-150 ease-out"
                    style={{
                      color: isActive ? '#a855f7' : '#6b7280',
                      transform: isActive ? 'translateY(-2px) scale(1.05)' : 'translateY(0) scale(1)',
                    }}
                  >
                    <span className="inline-flex">
                      {defaultIcons[item.id] || <IconComp className="size-[20px]" />}
                    </span>
                  </div>

                  <span
                    className="whitespace-nowrap transition-all duration-150"
                    style={{
                      fontSize: 10,
                      fontWeight: isActive ? 600 : 450,
                      color: isActive ? '#a855f7' : '#6b7280',
                      marginTop: 3,
                    }}
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