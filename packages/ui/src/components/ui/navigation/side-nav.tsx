// packages/ui/src/components/ui/navigation/side-nav.tsx
"use client";

import { memo, useCallback } from "react";
import { useNavigation } from "../../../hooks/menu/use-navigation-state";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   SideNav v4 — Memoized · Performance Optimized
   ✅ memo · useCallback
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SideNavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
}

export interface SideNavProps {
  items: SideNavItem[];
}

// ─── NavItem Component ─────────────────────────────────────────────────────

const NavItem = memo(function NavItem({
  id,
  icon,
  label,
  isActive,
  onClick,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: (id: string) => void;
}) {
  const handleClick = useCallback(() => onClick(id), [id, onClick]);

  return (
    <button
      type="button"
      onClick={handleClick}
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
      {isActive && (
        <span className="absolute start-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-[hsl(var(--color-primary))]" />
      )}

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

      <span className="flex-1 truncate">{label}</span>
    </button>
  );
});
NavItem.displayName = "NavItem";

// ─── Main Component ─────────────────────────────────────────────────────────

export const SideNav = memo(function SideNav({ items }: SideNavProps) {
  const { activeSection, setSection } = useNavigation();
  const t = useTranslations();

  const handleSetSection = useCallback(
    (id: string) => setSection(id),
    [setSection]
  );

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
          {t("app.name").charAt(0)}
        </div>
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold truncate text-[hsl(var(--fg-primary))]">
            {t("app.name")}
          </p>
          <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">
            {t("app.tagline")}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 p-2 flex-1">
        {items.map((item) => (
          <NavItem
            key={item.id}
            id={item.id}
            icon={item.icon}
            label={item.label}
            isActive={activeSection === item.id}
            onClick={handleSetSection}
          />
        ))}
      </nav>
    </aside>
  );
});

SideNav.displayName = "SideNav";