// packages/ui/src/hooks/use-invoices-page.ts
"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useInvoices, useDeleteInvoice } from "@hisabche/api";
import { mapInvoices } from "../../lib/invoices/invoices-mappers";
import { STATUS_MAP } from "../../lib/invoices/invoices-format";
import type { InvoicesQueryParams } from "../../lib/invoices/invoices-types";

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: InvoicesQueryParams = {
  page: 1,
  limit: 10,
  sortDirection: "desc",
};

/**
 * ✅ FIX: کارت‌های آمار قبلاً فقط روی همان صفحه‌ی جاری (۱۰ فاکتور) حساب
 * می‌شدند — یعنی کاربری با ۳۰ فاکتور، عدد ۱۰ می‌دید. حالا یک کوئری جدا با
 * سقف بالا فقط برای آمار زده می‌شود تا شمارش و مجموع‌ها کل فاکتورها را
 * پوشش دهند، بدون آن‌که اندازه‌ی صفحه‌ی جدول تغییر کند.
 */
const STATS_LIMIT = 500;

// ─── Main Hook ─────────────────────────────────────────────────────────────

export function useInvoicesPage() {
  const t = useTranslations();

  const [filters, setFilters] = useState<InvoicesQueryParams>(DEFAULT_FILTERS);

  // ─── Data Fetching ──────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useInvoices(filters);
  const { data: statsData } = useInvoices({
    page: 1,
    limit: STATS_LIMIT,
    sortDirection: "desc",
    ...(filters.search ? { search: filters.search } : {}),
  });
  const deleteInvoice = useDeleteInvoice();

  // ─── Transformations ────────────────────────────────────────────────────
  const invoices = useMemo(
    () => mapInvoices(data?.invoices as any[] | undefined),
    [data]
  );

  /** همه‌ی فاکتورهای منطبق با فیلتر — فقط برای کارت‌های آمار. */
  const statsInvoices = useMemo(
    () => mapInvoices(statsData?.invoices as any[] | undefined),
    [statsData]
  );

  const total = data?.total ?? 0;

  // ─── Handlers ───────────────────────────────────────────────────────────
  const statusVariant = useCallback(
    (status: string) => STATUS_MAP[status] || "secondary",
    []
  );

  const handleSearchChange = useCallback(
    (value: string) => setFilters((prev) => ({ ...prev, search: value, page: 1 })),
    []
  );

  const handleClearFilters = useCallback(
    () => setFilters(DEFAULT_FILTERS),
    []
  );

  const handlePageChange = useCallback(
    (page: number) => setFilters((prev) => ({ ...prev, page })),
    []
  );

  const handleDeleteInvoice = useCallback(
    async (id: string) => {
      if (id) {
        await deleteInvoice.mutateAsync(id);
        refetch();
      }
    },
    [deleteInvoice, refetch]
  );

  // ─── Safe Translation ──────────────────────────────────────────────────
  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key);
      return v !== key ? v : (fallback ?? key);
    },
    [t]
  );

  // ─── Return ────────────────────────────────────────────────────────────
  return {
    invoices,
    statsInvoices,
    isLoading,
    total,
    searchValue: filters.search ?? "",
    filters: {
      page: filters.page,
      limit: filters.limit,
    },
    statusVariant,
    handleSearchChange,
    handleClearFilters,
    handlePageChange,
    handleDeleteInvoice,
    safeT,
  };
}
