// packages/ui/src/components/ui/audit/containers/audit-container.tsx
"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuditLogs } from "@hisabche/api";
import { AuditView } from "../audit-view";

export function AuditContainer() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  const { data, isLoading } = useAuditLogs({ page, limit: 30, ...filters });

  const safeT = (key: string, fallback?: string) => {
    const result = t(key);
    return result !== key ? result : (fallback ?? key);
  };

  return (
    <AuditView
      t={safeT}
      logs={data?.data ?? []}
      total={data?.total ?? 0}
      page={page}
      isLoading={isLoading}
      filters={filters}
      onFiltersChange={setFilters}
      onPageChange={setPage}
    />
  );
}