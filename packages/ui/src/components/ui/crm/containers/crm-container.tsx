// packages/ui/src/components/ui/crm/containers/crm-container.tsx
"use client";

import { useState, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import { useInteractions, useOpportunities } from "@hisabche/api";
import { CrmView, type CrmTabId } from "../crm-view";

/* ═══════════════════════════════════════════════════════════════════════════
   CrmContainer — Memoized · Performance Optimized
   ✅ memo · useCallback · safeT wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

export const CrmContainer = memo(function CrmContainer() {
  const { t: tOriginal } = useTranslation();

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const result = tOriginal(key);
      return result && result !== key ? result : (fallback ?? key);
    },
    [tOriginal]
  );

  const [activeTab, setActiveTab] = useState<CrmTabId>("interactions");

  const {
    data: interactions,
    isLoading: isInteractionsLoading,
    error: interactionsError,
  } = useInteractions();

  const {
    data: opportunities,
    isLoading: isOpportunitiesLoading,
    error: opportunitiesError,
  } = useOpportunities();

  const isLoading =
    activeTab === "interactions" ? isInteractionsLoading : isOpportunitiesLoading;
  const error = activeTab === "interactions" ? interactionsError : opportunitiesError;

  const handleTabChange = useCallback((tab: CrmTabId) => setActiveTab(tab), []);

  return (
    <CrmView
      t={t}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      interactions={interactions ?? []}
      opportunities={opportunities ?? []}
      isLoading={isLoading}
      error={error?.message || null}
    />
  );
});

CrmContainer.displayName = "CrmContainer";
