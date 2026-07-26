// packages/ui/src/components/ui/manufacturing/containers/manufacturing-container.tsx
"use client";

import { useState, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import { useBOMs, useWorkOrders, useCompleteWorkOrder } from "@hisabche/api";
import { ManufacturingView, type ManufacturingTabId } from "../manufacturing-view";

/* ═══════════════════════════════════════════════════════════════════════════
   ManufacturingContainer — Memoized · Performance Optimized
   ✅ memo · useCallback · safeT wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

export const ManufacturingContainer = memo(function ManufacturingContainer() {
  const { t: tOriginal } = useTranslation();

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const result = tOriginal(key);
      return result && result !== key ? result : (fallback ?? key);
    },
    [tOriginal]
  );

  const [activeTab, setActiveTab] = useState<ManufacturingTabId>("boms");

  const { data: boms, isLoading: isBomsLoading, error: bomsError } = useBOMs();
  const {
    data: workOrders,
    isLoading: isWorkOrdersLoading,
    error: workOrdersError,
  } = useWorkOrders();

  const { mutate: completeWorkOrder, isPending, variables: completingId } = useCompleteWorkOrder();

  const isLoading = activeTab === "boms" ? isBomsLoading : isWorkOrdersLoading;
  const error = activeTab === "boms" ? bomsError : workOrdersError;

  const handleTabChange = useCallback((tab: ManufacturingTabId) => setActiveTab(tab), []);

  const handleCompleteWorkOrder = useCallback(
    (id: string) => completeWorkOrder(id),
    [completeWorkOrder]
  );

  return (
    <ManufacturingView
      t={t}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      boms={boms ?? []}
      workOrders={workOrders ?? []}
      isLoading={isLoading}
      error={error?.message || null}
      completingId={isPending ? completingId ?? null : null}
      onCompleteWorkOrder={handleCompleteWorkOrder}
    />
  );
});

ManufacturingContainer.displayName = "ManufacturingContainer";
