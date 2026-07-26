// packages/ui/src/components/ui/accounting/tabs/AccountsTab.tsx
"use client";

import { memo, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccounts, useCreateAccount } from "@hisabche/api";
import { AccountRow } from "../components/AccountRow";
import { CreateAccountDialog, type CreateAccountInput } from "../components/CreateAccountDialog";
import { ExportButton, type ExportColumn } from "../components/ExportButton";
import { AccountingSkeleton } from "../AccountingSkeleton";
import { AccountingEmptyState } from "../AccountingEmptyState";
import type { Account } from "@hisabche/api";

const exportColumns: ExportColumn<Account>[] = [
  { key: "code", header: "کد", accessor: (a) => a.code },
  { key: "name", header: "نام", accessor: (a) => a.name },
  { key: "type", header: "نوع", accessor: (a) => a.type },
  { key: "isActive", header: "وضعیت", accessor: (a) => (a.isActive ? "فعال" : "غیرفعال") },
];

export const AccountsTab = memo(function AccountsTab() {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: accounts, isLoading } = useAccounts();
  const { mutate: createAccount, isPending } = useCreateAccount();

  const parentOptions = useMemo(
    () => (accounts || []).map((a) => ({ id: a.id, label: `${a.code} - ${a.name}` })),
    [accounts]
  );

  const handleOpenDialog = useCallback(() => setIsDialogOpen(true), []);
  const handleCloseDialog = useCallback(() => setIsDialogOpen(false), []);

  const handleSubmit = useCallback(
    (input: CreateAccountInput) => {
      createAccount(input, {
        onSuccess: () => setIsDialogOpen(false),
      });
    },
    [createAccount]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-3 md:px-4 lg:px-5 py-2.5 md:py-3 lg:py-4 border-b border-[hsl(var(--border-default))]">
        <h2 className="text-xs md:text-sm lg:text-base font-semibold text-[hsl(var(--fg-primary))]">
          {t("accounting.accounts.title", "فهرست حساب‌ها")}
        </h2>
        <div className="flex items-center gap-1.5 md:gap-2">
          <ExportButton
            data={accounts || []}
            columns={exportColumns}
            filename="accounts"
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
            {t("accounting.accounts.create", "حساب جدید")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <AccountingSkeleton />
        ) : !accounts || accounts.length === 0 ? (
          <AccountingEmptyState
            title={t("accounting.accounts.empty.title", "هیچ حسابی ثبت نشده")}
            subtitle={t("accounting.accounts.empty.subtitle", "برای شروع، اولین حساب خود را ایجاد کنید")}
          />
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-[hsl(var(--surface-elevated))] z-10">
              <tr className="border-b border-[hsl(var(--border-default))] text-[9px] md:text-[10px] lg:text-xs text-[hsl(var(--fg-tertiary))]">
                <th className="px-2 md:px-3 lg:px-4 py-2 text-start font-medium">{t("accounting.accounts.code", "کد")}</th>
                <th className="px-2 md:px-3 lg:px-4 py-2 text-start font-medium">{t("accounting.accounts.name", "نام")}</th>
                <th className="px-2 md:px-3 lg:px-4 py-2 text-start font-medium">{t("accounting.accounts.type", "نوع")}</th>
                <th className="px-2 md:px-3 lg:px-4 py-2 text-center font-medium">{t("accounting.accounts.status", "وضعیت")}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateAccountDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
        isSubmitting={isPending}
        parentOptions={parentOptions}
      />
    </div>
  );
});
