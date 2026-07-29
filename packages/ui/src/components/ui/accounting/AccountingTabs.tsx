// packages/ui/src/components/ui/accounting/AccountingTabs.tsx
"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { Wallet, BookOpen, Scale, FileBarChart, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type AccountingTabId = "accounts" | "journal" | "trialBalance" | "balanceSheet" | "incomeStatement";

interface TabConfig {
  id: AccountingTabId;
  icon: typeof Wallet;
  labelKey: string;
  labelFallback: string;
}

const TABS: TabConfig[] = [
  { id: "accounts", icon: Wallet, labelKey: "accounting.tabs.accounts", labelFallback: "حساب‌ها" },
  { id: "journal", icon: BookOpen, labelKey: "accounting.tabs.journal", labelFallback: "دفتر روزنامه" },
  { id: "trialBalance", icon: Scale, labelKey: "accounting.tabs.trialBalance", labelFallback: "تراز آزمایشی" },
  { id: "balanceSheet", icon: FileBarChart, labelKey: "accounting.tabs.balanceSheet", labelFallback: "ترازنامه" },
  { id: "incomeStatement", icon: TrendingUp, labelKey: "accounting.tabs.incomeStatement", labelFallback: "سود و زیان" },
];

interface AccountingTabsProps {
  activeTab: AccountingTabId;
  onTabChange: (tab: AccountingTabId) => void;
}

export const AccountingTabs = memo(function AccountingTabs({ activeTab, onTabChange }: AccountingTabsProps) {
  const t = useTranslations();

  return (
    <div
      className="flex items-center gap-1 md:gap-1.5 lg:gap-2 overflow-x-auto pb-0.5 scrollbar-hide"
      role="tablist"
      aria-label={t("accounting.tabs.label")}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "shrink-0 flex items-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl font-medium transition-all duration-200",
              "px-2.5 md:px-3.5 lg:px-4 py-1.5 md:py-2 lg:py-2.5",
              "text-[11px] md:text-xs lg:text-sm",
              "min-h-[36px] md:min-h-[40px] lg:min-h-[44px]",
              isActive
                ? "bg-[hsl(var(--color-primary))] text-white shadow-sm shadow-[hsl(var(--color-primary)/0.3)]"
                : "bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted)/0.8)] hover:text-[hsl(var(--fg-primary))]",
              "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-2"
            )}
          >
            <Icon className="size-3.5 md:size-4 lg:size-[18px]" aria-hidden="true" />
            <span>{t(tab.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
});
