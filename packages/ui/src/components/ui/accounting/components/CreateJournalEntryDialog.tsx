// packages/ui/src/components/ui/accounting/components/CreateJournalEntryDialog.tsx
"use client";

import { memo, useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account } from "@hisabche/api";

interface JournalLineInput {
  accountId: string;
  debit: string;
  credit: string;
}

export interface CreateJournalEntryInput {
  date: string;
  description: string;
  reference?: string;
  lines: { accountId: string; debit: number; credit: number }[];
}

interface CreateJournalEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateJournalEntryInput) => void;
  isSubmitting: boolean;
  accounts: Account[];
}

const emptyLine = (): JournalLineInput => ({ accountId: "", debit: "", credit: "" });

export const CreateJournalEntryDialog = memo(function CreateJournalEntryDialog({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  accounts,
}: CreateJournalEntryDialogProps) {
  const { t } = useTranslation();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<JournalLineInput[]>([emptyLine(), emptyLine()]);

  useEffect(() => {
    if (isOpen) {
      setDate(new Date().toISOString().slice(0, 10));
      setDescription("");
      setReference("");
      setLines([emptyLine(), emptyLine()]);
    }
  }, [isOpen]);

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
    const credit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
    return { debit, credit, isBalanced: debit > 0 && debit === credit };
  }, [lines]);

  const handleLineChange = useCallback(
    (index: number, field: keyof JournalLineInput, value: string) => {
      setLines((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value } as JournalLineInput;
        return next;
      });
    },
    []
  );

  const handleAddLine = useCallback(() => {
    setLines((prev) => [...prev, emptyLine()]);
  }, []);

  const handleRemoveLine = useCallback((index: number) => {
    setLines((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!description.trim() || !totals.isBalanced) return;

      const validLines = lines
        .filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
        .map((l) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        }));

      if (validLines.length < 2) return;

      onSubmit({
        date,
        description: description.trim(),
        ...(reference.trim() && { reference: reference.trim() }),
        lines: validLines,
      });
    },
    [date, description, reference, lines, totals.isBalanced, onSubmit]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-3 md:p-4 bg-black/40"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-journal-title"
        className={cn(
          "w-full max-w-lg md:max-w-2xl rounded-xl md:rounded-2xl",
          "bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border-default))]",
          "shadow-2xl shadow-black/20 max-h-[90vh] overflow-y-auto"
        )}
      >
        <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 border-b border-[hsl(var(--border-default))]">
          <h2 id="create-journal-title" className="text-sm md:text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t("accounting.journal.createTitle", "سند روزنامه جدید")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors"
            aria-label={t("action.close", "بستن")}
          >
            <X className="size-4 md:size-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-5 space-y-3 md:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1 md:space-y-1.5">
              <label htmlFor="journal-date" className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]">
                {t("accounting.journal.date", "تاریخ")}
              </label>
              <input
                id="journal-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-3 text-xs md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
              />
            </div>
            <div className="space-y-1 md:space-y-1.5">
              <label htmlFor="journal-reference" className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]">
                {t("accounting.journal.reference", "مرجع (اختیاری)")}
              </label>
              <input
                id="journal-reference"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-3 text-xs md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
              />
            </div>
          </div>

          <div className="space-y-1 md:space-y-1.5">
            <label htmlFor="journal-description" className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]">
              {t("accounting.journal.description", "شرح سند")}
            </label>
            <input
              id="journal-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-3 text-xs md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]">
                {t("accounting.journal.lines", "خطوط سند")}
              </span>
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center gap-1 text-[11px] md:text-xs font-medium text-[hsl(var(--color-primary))] hover:underline"
              >
                <Plus className="size-3 md:size-3.5" aria-hidden="true" />
                {t("accounting.journal.addLine", "افزودن خط")}
              </button>
            </div>

            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="flex items-center gap-1.5 md:gap-2">
                  <select
                    value={line.accountId}
                    onChange={(e) => handleLineChange(index, "accountId", e.target.value)}
                    className="flex-1 min-w-0 h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-2 text-[11px] md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
                  >
                    <option value="">{t("accounting.journal.selectAccount", "انتخاب حساب")}</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t("accounting.journal.debit", "بدهکار")}
                    value={line.debit}
                    onChange={(e) => handleLineChange(index, "debit", e.target.value)}
                    className="w-20 md:w-28 h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-2 text-[11px] md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t("accounting.journal.credit", "بستانکار")}
                    value={line.credit}
                    onChange={(e) => handleLineChange(index, "credit", e.target.value)}
                    className="w-20 md:w-28 h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-2 text-[11px] md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(index)}
                    disabled={lines.length <= 2}
                    className="shrink-0 p-1.5 md:p-2 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))] disabled:opacity-30 transition-colors"
                    aria-label={t("action.remove", "حذف")}
                  >
                    <Trash2 className="size-3.5 md:size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <div
              className={cn(
                "flex items-center justify-between text-[11px] md:text-xs font-medium px-2 md:px-3 py-1.5 md:py-2 rounded-lg",
                totals.isBalanced
                  ? "bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]"
                  : "bg-[hsl(var(--color-warning)/0.1)] text-[hsl(var(--color-warning))]"
              )}
            >
              <span>{t("accounting.journal.totalDebit", "جمع بدهکار")}: {totals.debit.toLocaleString()}</span>
              <span>{t("accounting.journal.totalCredit", "جمع بستانکار")}: {totals.credit.toLocaleString()}</span>
              <span>
                {totals.isBalanced
                  ? t("accounting.journal.balanced", "متوازن")
                  : t("accounting.journal.unbalanced", "نامتوازن")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 md:h-10 rounded-lg text-xs md:text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] transition-colors"
            >
              {t("action.cancel", "انصراف")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !description.trim() || !totals.isBalanced}
              className="flex-1 h-9 md:h-10 rounded-lg text-xs md:text-sm font-medium bg-[hsl(var(--color-primary))] text-white hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="size-3.5 md:size-4 animate-spin" aria-hidden="true" />}
              {t("action.create", "ایجاد")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
