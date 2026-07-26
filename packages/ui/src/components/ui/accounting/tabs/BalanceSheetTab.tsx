// packages/ui/src/components/ui/accounting/tabs/BalanceSheetTab.tsx
"use client";

import { memo, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useBalanceSheet } from "@hisabche/api";
import { SingleDatePicker } from "../components/DateRangePicker";
import { ExportButton, type ExportColumn } from "../components/ExportButton";
import { AccountingSkeleton } from "../AccountingSkeleton";
import { AccountingEmptyState } from "../AccountingEmptyState";

interface DetailRow {
  section: string;
  label: string;
  amount: number;
}

const exportColumns: ExportColumn<DetailRow>[] = [
  { key: "section", header: "بخش", accessor: (r) => r.section },
  { key: "label", header: "شرح", accessor: (r) => r.label },
  { key: "amount", header: "مبلغ", accessor: (r) => r.amount },
];

function SectionBlock({
  title,
  total,
  details,
  accentClass,
}: {
  title: string;
  total: number;
  details: any[];
  accentClass: string;
}) {
  return (
    <div className="rounded-lg md:rounded-xl border border-[hsl(var(--border-default))] overflow-hidden">
      <div className={cn("px-3 md:px-4 py-2 md:py-2.5 flex items-center justify-between", accentClass)}>
        <span className="text-xs md:text-sm lg:text-base font-semibold">{title}</span>
        <span className="text-xs md:text-sm lg:text-base font-bold">{total.toLocaleString()}</span>
      </div>
      <div className="divide-y divide-[hsl(var(--border-default)/0.5)]">
        {details.length === 0 ? (
          <p className="px-3 md:px-4 py-2.5 md:py-3 text-[11px] md:text-xs text-[hsl(var(--fg-tertiary))]">—</p>
        ) : (
          details.map((d: any, i: number) => (
            <div key={i} className="flex items-center justify-between px-3 md:px-4 py-2 md:py-2.5">
              <span className="text-[11px] md:text-sm text-[hsl(var(--fg-secondary))]">{d.name || d.label}</span>
              <span className="text-[11px] md:text-sm font-medium text-[hsl(var(--fg-primary))]">
                {(d.amount ?? d.balance ?? 0).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export const BalanceSheetTab = memo(function BalanceSheetTab() {
  const { t } = useTranslation();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { data, isLoading } = useBalanceSheet(date);

  const exportData = useMemo<DetailRow[]>(() => {
    if (!data) return [];
    const rows: DetailRow[] = [];
    for (const d of data.assets.details) rows.push({ section: "دارایی", label: d.name || d.label, amount: d.amount ?? d.balance ?? 0 });
    for (const d of data.liabilities.details) rows.push({ section: "بدهی", label: d.name || d.label, amount: d.amount ?? d.balance ?? 0 });
    for (const d of data.equity.details) rows.push({ section: "حقوق صاحبان سهام", label: d.name || d.label, amount: d.amount ?? d.balance ?? 0 });
    return rows;
  }, [data]);

  const isBalanced = data ? data.assets.total === data.liabilities.total + data.equity.total : false;

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 md:gap-3 px-3 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 border-b border-[hsl(var(--border-default))]">
        <h2 className="text-xs md:text-sm lg:text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t("accounting.balanceSheet.title", "ترازنامه")}
        </h2>
        <div className="flex items-center gap-2 md:gap-3">
          <SingleDatePicker value={date} onChange={setDate} label={t("accounting.balanceSheet.asOf", "تا تاریخ")} />
          <ExportButton data={exportData} columns={exportColumns} filename="balance-sheet" className="mb-0" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-5">
        {isLoading ? (
          <AccountingSkeleton />
        ) : !data ? (
          <AccountingEmptyState title={t("accounting.balanceSheet.empty.title", "داده‌ای برای این تاریخ یافت نشد")} />
        ) : (
          <div className="space-y-3 md:space-y-4 lg:space-y-5">
            <SectionBlock
              title={t("accounting.balanceSheet.assets", "دارایی‌ها")}
              total={data.assets.total}
              details={data.assets.details}
              accentClass="bg-blue-500/10 text-blue-500"
            />
            <SectionBlock
              title={t("accounting.balanceSheet.liabilities", "بدهی‌ها")}
              total={data.liabilities.total}
              details={data.liabilities.details}
              accentClass="bg-rose-500/10 text-rose-500"
            />
            <SectionBlock
              title={t("accounting.balanceSheet.equity", "حقوق صاحبان سهام")}
              total={data.equity.total}
              details={data.equity.details}
              accentClass="bg-purple-500/10 text-purple-500"
            />

            <div
              className={cn(
                "flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-semibold",
                isBalanced
                  ? "bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]"
                  : "bg-[hsl(var(--color-warning)/0.1)] text-[hsl(var(--color-warning))]"
              )}
            >
              <span>
                {isBalanced
                  ? t("accounting.balanceSheet.balanced", "ترازنامه متوازن است")
                  : t("accounting.balanceSheet.unbalanced", "ترازنامه نامتوازن است")}
              </span>
              <span>
                {data.assets.total.toLocaleString()} = {(data.liabilities.total + data.equity.total).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
