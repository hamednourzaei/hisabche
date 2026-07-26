// packages/ui/src/components/ui/purchasing/containers/purchasing-container.tsx
"use client";

import { useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import { usePurchaseOrders, useReceiveGoods } from "@hisabche/api";
import { PurchasingView } from "../purchasing-view";

/* ═══════════════════════════════════════════════════════════════════════════
   PurchasingContainer — Memoized · Performance Optimized
   ✅ memo · useCallback · safeT wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

export const PurchasingContainer = memo(function PurchasingContainer() {
  const { t: tOriginal } = useTranslation();

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const result = tOriginal(key);
      return result && result !== key ? result : (fallback ?? key);
    },
    [tOriginal]
  );

  const { data: orders, isLoading, error } = usePurchaseOrders();
  const { mutate: receiveGoods, isPending, variables: receivingId } = useReceiveGoods();

  const handleReceiveGoods = useCallback((id: string) => receiveGoods(id), [receiveGoods]);

  return (
    <PurchasingView
      t={t}
      orders={orders ?? []}
      isLoading={isLoading}
      error={error?.message || null}
      receivingId={isPending ? receivingId ?? null : null}
      onReceiveGoods={handleReceiveGoods}
    />
  );
});

PurchasingContainer.displayName = "PurchasingContainer";
