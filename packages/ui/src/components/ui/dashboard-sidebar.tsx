"use client"

import { useTranslation } from "react-i18next"
import { cn } from "../../lib/utils"
import type { ElementType } from "react"

export interface NavItem {
  id: string
  icon: ElementType<any>
  label: string
  path: string
  badge?: number
}

// ─── SVG Icons (replaces lucide-react for smaller bundle) ──
const SvgIcon = ({ d, size = 18 }: { d: React.ReactNode; size?: number }) => (
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
  >
    {d}
  </svg>
)

const defaultIcons: Record<string, React.ReactNode> = {
  dashboard: (
    <SvgIcon d={<g><path d="M3 10.5 10 4l7 6.5" /><path d="M5 9.5V16h10V9.5" /></g>} />
  ),
  godam: (
    <SvgIcon d={<g><path d="M3 7 10 4l7 3v6l-7 3-7-3z" /><path d="M3 7l7 3 7-3M10 10v6" /></g>} />
  ),
  invoices: (
    <SvgIcon d={<g><path d="M5 3h7l3 3v11H5z" /><path d="M12 3v3h3" /><path d="M7.5 9h5M7.5 12h5M7.5 15h3" /></g>} />
  ),
  baqidari: (
    <SvgIcon d={<g><circle cx="8" cy="8" r="2.8" /><path d="M3.5 16c.6-2.4 2.4-3.6 4.5-3.6s3.9 1.2 4.5 3.6" /><circle cx="14.5" cy="7.5" r="2.2" /><path d="M13 12.4c2 0 3.4 1.1 4 3.1" /></g>} />
  ),
  settings: (
    <SvgIcon d={<g><circle cx="10" cy="10" r="2.4" /><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.2 5.2l1.4 1.4M13.4 13.4l1.4 1.4M5.2 14.8l1.4-1.4M13.4 6.6l1.4-1.4" /></g>} />
  ),
}

// ─── DashboardSidebar ──────────────────────────────────
export function DashboardSidebar({
  items,
  activeNav,
  onNavigate,
}: {
  items: NavItem[]
  activeNav: string
  onNavigate: (id: string, path: string) => void
}) {
  const { t } = useTranslation()

  return (
   <aside className="hidden w-60 border-e border-[var(--hisab-border)] bg-[var(--hisab-card)] lg:flex lg:flex-col shrink-0 sticky top-0 h-screen overflow-y-auto">
      {/* Workspace header */}
      <div className="flex items-center gap-2.5 px-4 py-[12px] border-b border-[var(--hisab-border)]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--hisab-primary)] text-white text-sm font-bold shrink-0">
          ح
        </div>
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold text-[var(--hisab-foreground)] truncate">
            حسابچه
          </p>
          <p className="text-[11px] text-[var(--hisab-muted-fg)]">
            مدیریت کسب‌وکار
          </p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        <span className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--hisab-muted-fg)]">
          منو
        </span>
        {items.map((item) => {
          const isActive = activeNav.startsWith(item.path)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id, item.path)}
              className={cn(
                "relative flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-sm font-medium transition-colors text-start w-full",
                "text-[var(--hisab-muted-fg)] hover:bg-[var(--hisab-muted)] hover:text-[var(--hisab-foreground)]",
                isActive &&
                  "bg-[var(--hisab-muted)] text-[var(--hisab-foreground)] font-semibold shadow-[inset_0_0_0_1px_var(--hisab-border)]"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute start-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-[var(--hisab-primary)]" />
              )}
              <span
                className={cn(
                  "inline-flex shrink-0",
                  isActive
                    ? "text-[var(--hisab-primary)]"
                    : "text-[var(--hisab-muted-fg)]"
                )}
              >
                {defaultIcons[item.id] || <item.icon className="size-[18px]" />}
              </span>
              <span className="flex-1 truncate">{t(item.label)}</span>
              {item.badge != null && (
                <span className="text-[10px] font-semibold text-[var(--hisab-muted-fg)] bg-[var(--hisab-muted)] border border-[var(--hisab-border)] px-1.5 py-0.5 rounded-full shrink-0">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-[var(--hisab-border)]">
        <p className="text-center text-[10px] text-[var(--hisab-muted-fg)]">
          حسابچه © ۲۰۲۶
        </p>
      </div>
    </aside>
  )
}

// ─── BottomNav (mobile) ────────────────────────────────
export function BottomNav({
  items,
  activeNav,
  onNavigate,
}: {
  items: NavItem[]
  activeNav: string
  onNavigate: (id: string, path: string) => void
}) {
  const { t } = useTranslation()

  return (
    <nav className="sticky bottom-0 border-t border-[var(--hisab-border)] bg-[var(--hisab-card)]/80 backdrop-blur-lg lg:hidden safe-area-bottom">
      <div className="grid grid-cols-5 items-stretch">
        {items.slice(0, 5).map((item) => {
          const isActive = activeNav.startsWith(item.path)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id, item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[10px] font-medium transition-colors",
                isActive
                  ? "text-[var(--hisab-foreground)]"
                  : "text-[var(--hisab-muted-fg)]"
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={t(item.label)}
            >
              <span
                className={cn(
                  "inline-flex relative",
                  isActive && "text-[var(--hisab-primary)]"
                )}
              >
                {isActive && (
                  <span className="absolute -inset-1.5 -inset-x-2.5 rounded-full bg-[var(--hisab-primary)]/10" />
                )}
                {defaultIcons[item.id] || <item.icon className="size-[18px]" />}
              </span>
              <span className={cn(isActive && "font-semibold")}>
                {t(item.label)}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}