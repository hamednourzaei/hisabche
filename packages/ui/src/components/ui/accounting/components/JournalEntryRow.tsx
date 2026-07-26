// packages/ui/src/components/ui/accounting/components/JournalEntryRow.tsx
"use client";

import { memo, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JournalEntry, Account } from "@hisabche/api";

interface JournalEntryRowProps {
  entry: JournalEntry;
  accounts: Account[];
}

function formatDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString("fa-AF", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return date;
  }
}

export const JournalEntryRow = memo(function JournalEntryRow({ entry, accounts }: JournalEntryRowProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    for (const acc of accounts) map.set(acc.id, acc);
    return map;
  }, [accounts]);

  const totals = useMemo(() => {
    const debit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
    const credit = entry.lines.reduce((sum, l) => sum + l.credit, 0);
    return { debit, credit };
  }, [entry.lines]);

  return (
    <div className="border-b border-[hsl(var(--border-default)/0.5)] last:border-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-2 px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3 hover:bg-[hsl(var(--surface-muted))] transition-colors text-start"
      >
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <span className="text-[10px] md:text-xs lg:text-sm text-[hsl(var(--fg-tertiary))] shrink-0 whitespace-nowrap">
            {formatDate(entry.date)}
          </span>
          <span className="text-[11px] md:text-sm text-[hsl(var(--fg-primary))] font-medium truncate">
            {entry.description}
          </span>
          {entry.reference && (
            <span className="hidden md:inline text-[10px] md:text-xs text-[hsl(var(--fg-tertiary))] shrink-0">
              #{entry.reference}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] md:text-sm font-semibold text-[hsl(var(--fg-primary))] whitespace-nowrap">
            {totals.debit.toLocaleString()}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 md:size-4 text-[hsl(var(--fg-tertiary))] transition-transform duration-200",
              isOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </div>
      </button>

      {isOpen && (
        <div className="px-2 md:px-3 lg:px-4 pb-2 md:pb-3">
          <table className="w-full">
            <thead>
              <tr className="text-[9px] md:text-[10px] lg:text-xs text-[hsl(var(--fg-tertiary))]">
                <th className="text-start font-medium py-1">{t("accounting.journal.account", "حساب")}</th>
                <th className="text-end font-medium py-1">{t("accounting.journal.debit", "بدهکار")}</th>
                <th className="text-end font-medium py-1">{t("accounting.journal.credit", "بستانکار")}</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((line) => {
                const account = accountMap.get(line.accountId);
                return (
                  <tr key={line.id} className="text-[10px] md:text-xs lg:text-sm">
                    <td className="py-1 text-[hsl(var(--fg-secondary))]">
                      {account ? `${account.code} - ${account.name}` : line.accountId}
                    </td>
                    <td className="py-1 text-end text-[hsl(var(--fg-primary))]">
                      {line.debit > 0 ? line.debit.toLocaleString() : "—"}
                    </td>
                    <td className="py-1 text-end text-[hsl(var(--fg-primary))]">
                      {line.credit > 0 ? line.credit.toLocaleString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
