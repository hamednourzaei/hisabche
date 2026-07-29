// packages/ui/src/components/ui/audit/containers/audit-container.tsx
"use client";

import { useState, useCallback, memo, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAuditLogs, type AuditLog, type AuditResponse } from "@hisabche/api";
import { AuditView } from "../audit-view";

/* ═══════════════════════════════════════════════════════════════════════════
   AuditContainer v2 — Memoized · Performance Optimized
   ✅ memo · useCallback · safeT wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

export const AuditContainer = memo(function AuditContainer() {
  const t = useTranslations();

  // ✅ safeT wrapper


  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }>({});

  const { data, isLoading, error, refetch } = useAuditLogs({
    page,
    limit: 30,
    ...filters,
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleExport = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.action) params.append("action", filters.action);
    if (filters.entityType) params.append("entityType", filters.entityType);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    if (filters.search) params.append("search", filters.search);
    window.open(`/api/audit/export?${params.toString()}`, "_blank");
  }, [filters]);

  const handleFiltersChange = useCallback(
    (newFilters: any) => {
      setFilters(newFilters);
      setPage(1);
    },
    []
  );

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <AuditView
      t={t}
      logs={logs}
      total={total}
      page={page}
      isLoading={isLoading}
      error={error?.message || null}
      filters={filters}
      onFiltersChange={handleFiltersChange}
      onPageChange={setPage}
      onRefresh={handleRefresh}
      onExport={handleExport}
    />
  );
});

AuditContainer.displayName = "AuditContainer";