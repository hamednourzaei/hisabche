// packages/ui/src/components/ui/accounting/tabs/IncomeStatementTab.tsx
"use client";

import { memo, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIncomeStatement } from "@hisabche/api";
import { DateRangePicker } from "../components/DateRangePicker";
import { ExportButton, type ExportColumn } from "../components/ExportButton";
import { AccountingSkeleton } from "../AccountingSkeleton";
import { AccountingEmptyState } from "../AccountingEmptyState";

interface SummaryRow {
  label: string;
  value: number;
}

const exportColumns: ExportColumn<SummaryRow>[] = [
  { key: "label", header: "شرح", accessor: (r) => r.label },
  { key: "value", header: "مبلغ", accessor: (r) => r.value },
];

function getFirstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export const IncomeStatementTab = memo(function IncomeStatementTab() {
  const t = useTranslations();
  const [from, setFrom] = useState(getFirstDayOfMonth);
  const [to, setTo] = useState(getToday);
  const { data, isLoading } = useIncomeStatement(from, to);

  const exportData = useMemo<SummaryRow[]>(() => {
    if (!data) return [];
    return [
      { label: "درآمد", value: data.revenue },
      { label: "هزینه‌ها", value: data.expenses },
      { label: "سود خالص", value: data.netIncome },
    ];
  }, [data]);

  const isProfit = (data?.netIncome ?? 0) >= 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 md:gap-3 px-3 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 border-b border-[hsl(var(--border-default))]">
        <h2 className="text-xs md:text-sm lg:text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t("accounting.incomeStatement.title")}
        </h2>
        <div className="flex items-end gap-2 md:gap-3">
          <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          <ExportButton data={exportData} columns={exportColumns} filename="income-statement" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-5">
        {isLoading ? (
          <AccountingSkeleton rows={3} />
        ) : !data ? (
          <AccountingEmptyState title={t("accounting.incomeStatement.empty.title")} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-3 lg:gap-4">
            <div className="rounded-lg md:rounded-xl border border-[hsl(var(--border-default))] p-3 md:p-4 lg:p-5 bg-[hsl(var(--surface-elevated))]">
              <div className="flex items-center gap-2 text-[hsl(var(--color-success))] mb-1.5 md:mb-2">
                <TrendingUp className="size-4 md:size-5" aria-hidden="true" />
                <span className="text-[11px] md:text-xs lg:text-sm font-medium">{t("accounting.incomeStatement.revenue")}</span>
              </div>
              <p className="text-lg md:text-xl lg:text-2xl font-bold text-[hsl(var(--fg-primary))]">
                {data.revenue.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg md:rounded-xl border border-[hsl(var(--border-default))] p-3 md:p-4 lg:p-5 bg-[hsl(var(--surface-elevated))]">
              <div className="flex items-center gap-2 text-[hsl(var(--color-destructive))] mb-1.5 md:mb-2">
                <TrendingDown className="size-4 md:size-5" aria-hidden="true" />
                <span className="text-[11px] md:text-xs lg:text-sm font-medium">{t("accounting.incomeStatement.expenses")}</span>
              </div>
              <p className="text-lg md:text-xl lg:text-2xl font-bold text-[hsl(var(--fg-primary))]">
                {data.expenses.toLocaleString()}
              </p>
            </div>

            <div
              className={cn(
                "rounded-lg md:rounded-xl border p-3 md:p-4 lg:p-5",
                isProfit
                  ? "border-[hsl(var(--color-success)/0.3)] bg-[hsl(var(--color-success)/0.05)]"
                  : "border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.05)]"
              )}
            >
              <div className={cn("flex items-center gap-2 mb-1.5 md:mb-2", isProfit ? "text-[hsl(var(--color-success))]" : "text-[hsl(var(--color-destructive))]")}>
                {isProfit ? <TrendingUp className="size-4 md:size-5" aria-hidden="true" /> : <TrendingDown className="size-4 md:size-5" aria-hidden="true" />}
                <span className="text-[11px] md:text-xs lg:text-sm font-medium">{t("accounting.incomeStatement.netIncome")}</span>
              </div>
              <p className="text-lg md:text-xl lg:text-2xl font-bold text-[hsl(var(--fg-primary))]">
                {data.netIncome.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
