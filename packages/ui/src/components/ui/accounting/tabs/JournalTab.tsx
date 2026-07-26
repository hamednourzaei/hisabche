// packages/ui/src/components/ui/accounting/tabs/JournalTab.tsx
"use client";

import { memo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useJournalEntries, useCreateJournalEntry, useAccounts } from "@hisabche/api";
import { JournalEntryRow } from "../components/JournalEntryRow";
import { CreateJournalEntryDialog, type CreateJournalEntryInput } from "../components/CreateJournalEntryDialog";
import { ExportButton, type ExportColumn } from "../components/ExportButton";
import { AccountingSkeleton } from "../AccountingSkeleton";
import { AccountingEmptyState } from "../AccountingEmptyState";
import type { JournalEntry } from "@hisabche/api";

const exportColumns: ExportColumn<JournalEntry>[] = [
  { key: "date", header: "تاریخ", accessor: (e) => e.date },
  { key: "description", header: "شرح", accessor: (e) => e.description },
  { key: "reference", header: "مرجع", accessor: (e) => e.reference || "" },
  { key: "total", header: "جمع", accessor: (e) => e.lines.reduce((s, l) => s + l.debit, 0) },
];

export const JournalTab = memo(function JournalTab() {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: entries, isLoading } = useJournalEntries();
  const { data: accounts } = useAccounts();
  const { mutate: createJournalEntry, isPending } = useCreateJournalEntry();

  const handleOpenDialog = useCallback(() => setIsDialogOpen(true), []);
  const handleCloseDialog = useCallback(() => setIsDialogOpen(false), []);

  const handleSubmit = useCallback(
    (input: CreateJournalEntryInput) => {
      createJournalEntry(input, {
        onSuccess: () => setIsDialogOpen(false),
      });
    },
    [createJournalEntry]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-3 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 border-b border-[hsl(var(--border-default))]">
        <h2 className="text-xs md:text-sm lg:text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t("accounting.journal.title", "دفتر روزنامه")}
        </h2>
        <div className="flex items-center gap-1.5 md:gap-2">
          <ExportButton
            data={entries || []}
            columns={exportColumns}
            filename="journal-entries"
          />
          <button
            type="button"
            onClick={handleOpenDialog}
            className={cn(
              "flex items-center gap-1.5 rounded-lg font-medium transition-opacity",
              "px-2.5 md:px-3 lg:px-4 py-1.5 md:py-2",
              "text-[11px] md:text-xs lg:text-sm",
              "bg-[hsl(var(--color-primary))] text-white hover:opacity-90"
            )}
          >
            <Plus className="size-3.5 md:size-4" aria-hidden="true" />
            {t("accounting.journal.create", "سند جدید")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <AccountingSkeleton />
        ) : !entries || entries.length === 0 ? (
          <AccountingEmptyState
            title={t("accounting.journal.empty.title", "هیچ سندی ثبت نشده")}
            subtitle={t("accounting.journal.empty.subtitle", "برای شروع، اولین سند روزنامه را ایجاد کنید")}
          />
        ) : (
          <div>
            {entries.map((entry) => (
              <JournalEntryRow key={entry.id} entry={entry} accounts={accounts || []} />
            ))}
          </div>
        )}
      </div>

      <CreateJournalEntryDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        isSubmitting={isPending}
        accounts={accounts || []}
      />
    </div>
  );
});
