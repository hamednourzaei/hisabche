// packages/ui/src/components/ui/navigation/side-nav.tsx
"use client";

import { useNavigation } from "../../../hooks/menu/use-navigation-state";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   SideNav v3 — i18n-ready
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SideNavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
}

export interface SideNavProps {
  items: SideNavItem[];
}

export function SideNav({ items }: SideNavProps) {
  const { activeSection, setSection } = useNavigation();
  const { t } = useTranslation();

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col shrink-0",
        "w-60 h-screen sticky top-0 overflow-y-auto",
        "border-e border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-base))]"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-[11px] border-b border-[hsl(var(--border-default))]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gradient-brand)] text-white text-sm font-bold shrink-0">
          {t("app.name", "حسابچه").charAt(0)}
        </div>
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold truncate text-[hsl(var(--fg-primary))]">
            {t("app.name", "حسابچه")}
          </p>
          <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">
            {t("app.tagline", "مدیریت کسب‌وکار")}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {items.map(({ id, icon, label }) => {
          const isActive = activeSection === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={cn(
                "relative flex items-center gap-2.5 h-9 px-2.5 rounded-lg",
                "text-sm font-medium text-start w-full",
                "transition-colors duration-150",
                "motion-reduce:transition-none",
                isActive
                  ? "bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] font-semibold"
                  : "text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute start-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-[hsl(var(--color-primary))]" />
              )}

              {/* Icon */}
              <span
                className={cn(
                  "inline-flex shrink-0",
                  isActive
                    ? "text-[hsl(var(--color-primary))]"
                    : "text-[hsl(var(--fg-tertiary))]"
                )}
              >
                {icon}
              </span>

              {/* Label */}
              <span className="flex-1 truncate">{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}