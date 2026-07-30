// packages/ui/src/components/ui/purchasing/containers/purchasing-container.tsx
"use client";

import { useCallback, memo } from "react";
import { useTranslations } from "next-intl";
import { usePurchaseOrders, useReceiveGoods } from "@hisabche/api";
import { PurchasingView } from "../purchasing-view";

/* ═══════════════════════════════════════════════════════════════════════════
   PurchasingContainer — Memoized · Performance Optimized
   ✅ memo · useCallback · safeT wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

export const PurchasingContainer = memo(function PurchasingContainer() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };


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
