// packages/ui/src/components/ui/accounting/AccountingPage.tsx
"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AccountingTabs, type AccountingTabId } from "./AccountingTabs";
import { AccountsTab } from "./tabs/AccountsTab";
import { JournalTab } from "./tabs/JournalTab";
import { TrialBalanceTab } from "./tabs/TrialBalanceTab";
import { BalanceSheetTab } from "./tabs/BalanceSheetTab";
import { IncomeStatementTab } from "./tabs/IncomeStatementTab";

const VALID_TABS: AccountingTabId[] = ["accounts", "journal", "trialBalance", "balanceSheet", "incomeStatement"];
const DEFAULT_TAB: AccountingTabId = "accounts";

function isValidTab(value: string | null): value is AccountingTabId {
  return value !== null && (VALID_TABS as string[]).includes(value);
}

export function AccountingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = useMemo<AccountingTabId>(() => {
    const tabParam = searchParams.get("tab");
    return isValidTab(tabParam) ? tabParam : DEFAULT_TAB;
  }, [searchParams]);

  const handleTabChange = useCallback(
    (tab: AccountingTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-col h-full w-full max-w-3xl md:max-w-4xl lg:max-w-6xl mx-auto px-3 md:px-4 lg:px-6">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="pb-3 md:pb-4 lg:pb-5">
        <h1 className="font-bold text-[hsl(var(--fg-primary))] text-lg md:text-xl lg:text-2xl">
          {t("nav.money", "پول و سود")}
        </h1>
        <p className="text-[11px] md:text-xs lg:text-sm text-[hsl(var(--fg-tertiary))] mt-0.5 md:mt-1">
          {t("nav.money.description", "درآمد، خرج و سود شما")}
        </p>
      </div>

      {/* ─── Tabs ───────────────────────────────────────────── */}
      <div className="pb-3 md:pb-4">
        <AccountingTabs activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* ─── Body ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-[400px] md:min-h-[500px] lg:min-h-[600px] rounded-xl md:rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden mb-4 md:mb-6">
        {activeTab === "accounts" && <AccountsTab />}
        {activeTab === "journal" && <JournalTab />}
        {activeTab === "trialBalance" && <TrialBalanceTab />}
        {activeTab === "balanceSheet" && <BalanceSheetTab />}
        {activeTab === "incomeStatement" && <IncomeStatementTab />}
      </div>
    </div>
  );
}

AccountingPage.displayName = "AccountingPage";
