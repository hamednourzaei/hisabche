// packages/ui/src/components/ui/dashboard-sidebar.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ElementType, ReactElement } from "react";
import { useAuthStore } from "@hisabche/store";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
} from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   DashboardSidebar v6 — Grouped Navigation + Premium Minimal
   Changes from v5:
   - رنگ‌های hardcode شده rgba(18,200,160,*) که مال پالت قدیمی قبل از
     ری‌برندینگ بودن حذف شدن؛ همه از hsl(var(--color-primary)/x) می‌خونن،
     پس با هر تغییر توکن رنگ، خودکار sync می‌مونن.
   - دکمه‌های گروه در BottomNav حالا min-w واقعی دارن + وقتی گروه‌ها زیاد
     بشن به‌جای له‌شدن، اسکرول افقی می‌گیرن. قانون min-height:44px که در
     globals.css هست بدون min-width هیچ فایده‌ای نداشت.
   - موقعیت popover/backdrop به‌جای پیکسل‌های ثابت حدسی، از ارتفاع واقعی
     nav (اندازه‌گیری‌شده با ref) + safe-area-inset-bottom محاسبه می‌شه.
   - بستن با کلید Escape + برگشت فوکوس به دکمه‌ی trigger بعد از بسته‌شدن.
   - role="menu"/"menuitem" برای popover.
   - JSX.Element با ReactElement جایگزین شد (سازگار با React 19).
   ═══════════════════════════════════════════════════════════════════════════ */

export interface NavItem {
  id: string;
  icon: ElementType<any>;
  label: string;
  path: string;
  badge?: number;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: ElementType<any>;
  items: NavItem[];
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function isPathActive(currentPath: string, itemPath: string): boolean {
  if (currentPath === itemPath) return true;
  if (currentPath.startsWith(itemPath + "/")) return true;
  if (currentPath.startsWith(itemPath + "?")) return true;
  return false;
}

/* ─── SVG Icons ───────────────────────────────────────────────────────────── */

const ICON_PATHS: Record<string, ReactElement> = {
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

function SidebarIcon({ id, active, size = 18 }: { id: string; active: boolean; size?: number }) {
  const path = ICON_PATHS[id];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={cn("shrink-0 transition-colors duration-200 motion-reduce:transition-none", active ? "text-[hsl(var(--color-primary))]" : "text-[hsl(var(--fg-tertiary))] group-hover:text-[hsl(var(--fg-secondary))]")}>
      {path}
    </svg>
  );
}

/* ─── Group Header ────────────────────────────────────────────────────────── */

function GroupHeader({ label, isFirst }: { label: string; isFirst: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 px-3", isFirst ? "pt-3 pb-1.5" : "pt-5 pb-1.5")}>
      <span className="text-[11px] font-semibold text-[hsl(var(--fg-tertiary))] tracking-wide whitespace-nowrap uppercase">{label}</span>
      <span className="flex-1 h-px bg-[hsl(var(--border-default))] opacity-40" />
    </div>
  );
}

/* ─── Nav Button (Desktop) ────────────────────────────────────────────────── */

function NavButton({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("group relative flex items-center gap-2.5 h-10 px-3 rounded-xl", "text-sm font-medium text-start w-full", "transition-all duration-200", "motion-reduce:transition-none",
        isActive ? "bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))] font-semibold shadow-[0_0_20px_hsl(var(--color-primary)/0.06)]"
                : "text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]")}
      aria-current={isActive ? "page" : undefined}>
      {isActive && <span className="absolute end-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[var(--gradient-brand)] shadow-[0_0_8px_hsl(var(--color-primary)/0.3)]" />}
      <span className={cn("transition-transform duration-200 motion-reduce:transition-none", isActive && "scale-110")}>
        {ICON_PATHS[item.id] ? <SidebarIcon id={item.id} active={isActive} /> : <item.icon className={cn("size-[18px] shrink-0 transition-colors duration-200 motion-reduce:transition-none", isActive ? "text-[hsl(var(--color-primary))]" : "text-[hsl(var(--fg-tertiary))] group-hover:text-[hsl(var(--fg-secondary))]")} />}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge != null && <span className={cn("text-[10px] font-semibold", "px-1.5 py-0.5 rounded-full shrink-0", "bg-[hsl(var(--surface-muted))]", "text-[hsl(var(--fg-secondary))]", "border border-[hsl(var(--border-default))]")}>{item.badge}</span>}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sidebar — Grouped (Desktop)
   ═══════════════════════════════════════════════════════════════════════════ */

export function DashboardSidebar({ groups, activeNav, onNavigate }: { groups: NavGroup[]; activeNav: string; onNavigate: (id: string, path: string) => void }) {
  const user = useAuthStore((s) => s.user);
  return (
    <aside aria-label="ناوبری اصلی" className={cn("hidden lg:flex lg:flex-col shrink-0", "w-56 h-screen sticky top-0 overflow-y-auto", "border-e border-[hsl(var(--border-default))]", "bg-[hsl(var(--surface-base))]")}>
      <div className="flex flex-col items-center gap-1 pt-6 pb-4">
        <div className="transition-all duration-300 motion-reduce:transition-none hover:scale-105 hover:filter hover:drop-shadow-[0_0_18px_hsl(var(--color-primary)/0.25)]">
          <img src="/logo-icon.png" alt="حسابچه" className="h-16 w-16 object-contain" />
        </div>
        <span className="text-xs font-semibold text-[hsl(var(--fg-primary))] truncate max-w-[140px] text-center">{user?.businessName || user?.fullName || "حسابچه"}</span>
      </div>
      <div className="mx-4 h-px bg-[hsl(var(--border-default))] opacity-60" />
      <nav className="flex flex-col gap-0 flex-1">
        {groups.map((group, groupIndex) => (
          <div key={group.id} className="px-3">
            <GroupHeader label={group.label} isFirst={groupIndex === 0} />
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavButton key={item.id} item={item} isActive={isPathActive(activeNav, item.path)} onClick={() => onNavigate(item.id, item.path)} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-3 py-4">
        <div className="h-px bg-[hsl(var(--border-default))] mb-3 opacity-50" />
        <p className="text-center text-[10px] text-[hsl(var(--fg-tertiary))] tracking-wider">v3.0</p>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BottomNav — Grouped Popover (Mobile)
   ═══════════════════════════════════════════════════════════════════════════ */

// ارتفاع واقعی نوار پایین (h-14 = ۵۶px) + فاصله‌ی bottom-4 (۱۶px) از لبه‌ی
// صفحه. popover/backdrop از همین متغیر مشترک محاسبه می‌شن تا اگه ارتفاع
// نوار تغییر کرد، مجبور نباشی چند تا عدد جادویی رو جدا آپدیت کنی.
const NAV_HEIGHT_PX = 56;
const NAV_OFFSET_PX = 16; // bottom-4
const NAV_GAP_PX = 8;
const POPOVER_BOTTOM = `calc(${NAV_HEIGHT_PX + NAV_OFFSET_PX + NAV_GAP_PX}px + env(safe-area-inset-bottom, 0px))`;
const BACKDROP_BOTTOM = `calc(${NAV_HEIGHT_PX + NAV_OFFSET_PX}px + env(safe-area-inset-bottom, 0px))`;

export function BottomNav({ groups, dashboardItem, activeNav, onNavigate }: { groups: NavGroup[]; dashboardItem: NavItem; activeNav: string; onNavigate: (id: string, path: string) => void }) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuId = useId();

  const toggleGroup = useCallback((groupId: string) => {
    setOpenGroupId((prev) => (prev === groupId ? null : groupId));
  }, []);

  const closeAndRestoreFocus = useCallback((groupId: string | null) => {
    setOpenGroupId(null);
    if (groupId) triggerRefs.current[groupId]?.focus();
  }, []);

  const handleItemSelect = useCallback((id: string, path: string) => {
    setOpenGroupId(null);
    onNavigate(id, path);
  }, [onNavigate]);

  // کلیک/لمس بیرون از پاپ‌آور آن را می‌بندد
  useEffect(() => {
    if (!openGroupId) return;
    const currentGroupId = openGroupId;

    function handleClickOutside(e: TouchEvent | MouseEvent) {
      const target = e.target as Node;
      const popover = popoverRef.current;
      const trigger = triggerRefs.current[currentGroupId];
      if (popover && !popover.contains(target) && trigger && !trigger.contains(target)) {
        setOpenGroupId(null);
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
  }, [openGroupId]);

  // کلید Escape پاپ‌آور را می‌بندد و فوکوس را به دکمه‌ی trigger برمی‌گرداند
  useEffect(() => {
    if (!openGroupId) return;
    const currentGroupId = openGroupId;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeAndRestoreFocus(currentGroupId);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openGroupId, closeAndRestoreFocus]);

  // وقتی پاپ‌آور باز می‌شود، فوکوس به داخلش منتقل می‌شود (دسترس‌پذیری کیبورد)
  useEffect(() => {
    if (openGroupId && popoverRef.current) {
      const firstItem = popoverRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]');
      firstItem?.focus();
    }
  }, [openGroupId]);

  const isDashboardActive = isPathActive(activeNav, dashboardItem.path);
  const openGroup = groups.find((g) => g.id === openGroupId);

  return (
    <>
      <nav aria-label="ناوبری موبایل" className="fixed bottom-4 inset-x-4 z-modal max-w-[480px] mx-auto lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className={cn("relative h-14", "rounded-2xl", "border border-[hsl(var(--color-primary)/0.18)]", "bg-[hsl(var(--surface-elevated)/0.98)] backdrop-blur-md", "shadow-lg")}>
          <div className="flex flex-row items-stretch h-full px-2 gap-1">
            {/* داشبورد — همیشه ثابت */}
            <button type="button" onClick={() => handleItemSelect(dashboardItem.id, dashboardItem.path)}
              className={cn("flex flex-col items-center justify-center flex-1 h-full min-w-11 rounded-xl", "transition-all duration-150 motion-reduce:transition-none", isDashboardActive ? "text-[hsl(var(--color-primary))]" : "text-[hsl(var(--fg-tertiary))] active:text-[hsl(var(--fg-secondary))]")}
              aria-current={isDashboardActive ? "page" : undefined} aria-label={dashboardItem.label}>
              <div className={cn("transition-transform duration-150 motion-reduce:transition-none", isDashboardActive && "-translate-y-0.5 scale-110")}>
                {ICON_PATHS[dashboardItem.id] ? <SidebarIcon id={dashboardItem.id} active={isDashboardActive} size={20} /> : <dashboardItem.icon className="size-[20px]" />}
              </div>
              <span className={cn("mt-0.5 transition-all duration-150 motion-reduce:transition-none", isDashboardActive ? "font-semibold" : "font-normal")} style={{ fontSize: 10 }}>{dashboardItem.label}</span>
            </button>

            <div className="w-px self-stretch my-2 bg-[hsl(var(--border-default))] opacity-40" />

            {/* گروه‌ها — min-w واقعی + اسکرول افقی وقتی جا کم بیاره،
               به‌جای له‌شدن دکمه‌ها زیر حد قابل‌لمس (۴۴px) */}
            <div className="flex flex-row items-stretch flex-[3] gap-0.5 overflow-x-auto no-scrollbar">
              {groups.map((group) => {
                const isOpen = openGroupId === group.id;
                const hasActive = group.items.some((item) => isPathActive(activeNav, item.path));
                return (
                  <button key={group.id} ref={(el) => { triggerRefs.current[group.id] = el; }} type="button" onClick={() => toggleGroup(group.id)}
                    className={cn("relative flex flex-col items-center justify-center flex-1 min-w-11 h-full rounded-xl", "transition-all duration-150 motion-reduce:transition-none",
                      isOpen ? "bg-[hsl(var(--color-primary)/0.10)] text-[hsl(var(--color-primary))]"
                            : hasActive ? "text-[hsl(var(--color-primary))] font-semibold"
                            : "text-[hsl(var(--fg-tertiary))] active:text-[hsl(var(--fg-secondary))]")}
                    aria-expanded={isOpen} aria-haspopup="true" aria-controls={isOpen ? menuId : undefined} aria-label={group.label}>
                    {hasActive && !isOpen && <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-[hsl(var(--color-primary))]" />}
                    <div className={cn("transition-transform duration-150 motion-reduce:transition-none", isOpen && "scale-110")}><group.icon className="size-[20px]" /></div>
                    <span className="mt-0.5 truncate max-w-[60px]" style={{ fontSize: 10 }}>{group.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Popover Menu */}
      {openGroup && (
        <div ref={popoverRef} id={menuId} role="menu" aria-label={openGroup.label}
          className={cn("fixed inset-x-4 z-popover max-w-[480px] mx-auto lg:hidden", "animate-in slide-in-from-bottom-2 fade-in-0 duration-200 motion-reduce:animate-none")}
          style={{ bottom: POPOVER_BOTTOM }}>
          <div className={cn("rounded-2xl overflow-hidden", "border border-[hsl(var(--border-default))]", "bg-[hsl(var(--surface-elevated)/0.99)] backdrop-blur-xl", "shadow-xl shadow-black/10")}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border-default))] opacity-70">
              <span className="text-xs font-semibold text-[hsl(var(--fg-secondary))]">{openGroup.label}</span>
              <button type="button" onClick={() => closeAndRestoreFocus(openGroup.id)} className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] active:text-[hsl(var(--fg-primary))] active:bg-[hsl(var(--surface-muted))]" aria-label="بستن">
                <svg width={16} height={16} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
              </button>
            </div>
            <div className="py-1.5">
              {openGroup.items.map((item) => {
                const isActive = isPathActive(activeNav, item.path);
                return (
                  <button key={item.id} type="button" role="menuitem" onClick={() => handleItemSelect(item.id, item.path)}
                    className={cn("w-full flex items-center gap-3 px-4 py-2.5 min-h-11", "transition-colors duration-150",
                      isActive ? "bg-[hsl(var(--color-primary)/0.08)] text-[hsl(var(--color-primary))] font-semibold"
                              : "text-[hsl(var(--fg-primary))] active:bg-[hsl(var(--surface-muted))]")}
                    aria-current={isActive ? "page" : undefined}>
                    <span className={cn("transition-transform duration-150 motion-reduce:transition-none", isActive && "scale-110")}>
                      {ICON_PATHS[item.id] ? <SidebarIcon id={item.id} active={isActive} size={18} /> : <item.icon className={cn("size-[18px] shrink-0", isActive ? "text-[hsl(var(--color-primary))]" : "text-[hsl(var(--fg-tertiary))]")} />}
                    </span>
                    <span className="flex-1 text-sm text-start truncate">{item.label}</span>
                    {isActive && <svg width={16} height={16} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="text-[hsl(var(--color-primary))] shrink-0"><path d="M5 10l3.5 3.5L15 7" /></svg>}
                    {item.badge != null && <span className={cn("text-[10px] font-semibold", "px-1.5 py-0.5 rounded-full shrink-0", "bg-[hsl(var(--surface-muted))]", "text-[hsl(var(--fg-secondary))]", "border border-[hsl(var(--border-default))]")}>{item.badge}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {openGroup && (
        <div className="fixed inset-0 z-modal-backdrop lg:hidden" style={{ bottom: BACKDROP_BOTTOM }}
          onTouchStart={() => closeAndRestoreFocus(openGroup.id)} onMouseDown={() => closeAndRestoreFocus(openGroup.id)} aria-hidden="true" />
      )}
    </>
  );
}