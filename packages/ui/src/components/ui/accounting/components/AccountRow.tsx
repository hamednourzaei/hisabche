// packages/ui/src/components/ui/accounting/components/AccountRow.tsx
"use client";

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Account } from "@hisabche/api";

interface AccountRowProps {
  account: Account;
}

const TYPE_COLORS: Record<string, string> = {
  asset: "text-blue-500 bg-blue-500/10",
  liability: "text-rose-500 bg-rose-500/10",
  equity: "text-purple-500 bg-purple-500/10",
  revenue: "text-emerald-500 bg-emerald-500/10",
  expense: "text-amber-500 bg-amber-500/10",
};

export const AccountRow = memo(function AccountRow({ account }: AccountRowProps) {
  const { t } = useTranslation();
  const typeColor = TYPE_COLORS[account.type] || "text-gray-500 bg-gray-500/10";

  return (
    <tr className="border-b border-[hsl(var(--border-default)/0.5)] last:border-0 hover:bg-[hsl(var(--surface-muted))] transition-colors">
      <td className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3 text-[11px] md:text-sm text-[hsl(var(--fg-tertiary))] font-mono whitespace-nowrap">
        {account.code}
      </td>
      <td className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3 text-[11px] md:text-sm font-medium text-[hsl(var(--fg-primary))]">
        {account.name}
      </td>
      <td className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3">
        <span className={cn("text-[9px] md:text-[10px] lg:text-xs font-medium px-1.5 md:px-2 py-0.5 rounded whitespace-nowrap", typeColor)}>
          {t(`accounting.accountType.${account.type}`, account.type)}
        </span>
      </td>
      <td className="px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3 text-[11px] md:text-sm text-center">
        <span
          className={cn(
            "inline-block w-2 h-2 rounded-full",
            account.isActive ? "bg-[hsl(var(--color-success))]" : "bg-[hsl(var(--fg-tertiary))]"
          )}
          aria-label={account.isActive ? t("accounting.accounts.active", "فعال") : t("accounting.accounts.inactive", "غیرفعال")}
        />
      </td>
    </tr>
  );
});
