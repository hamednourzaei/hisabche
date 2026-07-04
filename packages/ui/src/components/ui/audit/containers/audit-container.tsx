// packages/ui/src/components/ui/audit/containers/audit-container.tsx
"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuditLogs, type AuditLog, type AuditResponse } from "@hisabche/api";
import { AuditView } from "../audit-view";

export function AuditContainer() {
  const { t } = useTranslation();
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
    ...filters 
  });

  const safeT = (key: string, fallback?: string) => {
    const result = t(key);
    return result !== key ? result : (fallback ?? key);
  };

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

  // ✅ data is already AuditResponse type
  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <AuditView
      t={safeT}
      logs={logs}
      total={total}
      page={page}
      isLoading={isLoading}
      error={error?.message || null}
      filters={filters}
      onFiltersChange={(newFilters) => {
        setFilters(newFilters);
        setPage(1);
      }}
      onPageChange={setPage}
      onRefresh={handleRefresh}
      onExport={handleExport}
    />
  );
}