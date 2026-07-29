// packages/ui/src/components/ui/crm/containers/crm-container.tsx
"use client";

import { useState, useCallback, memo } from "react";
import { useTranslations } from "next-intl";
import { useInteractions, useOpportunities, useCreateInteraction } from "@hisabche/api";
import { CrmView, type CrmTabId } from "../crm-view";

/* ═══════════════════════════════════════════════════════════════════════════
   CrmContainer — Memoized · Performance Optimized
   ✅ memo · useCallback · safeT wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

export const CrmContainer = memo(function CrmContainer() {
  const t = useTranslations();


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

  const { mutateAsync: createInteraction, isPending: isCreatingInteraction } = useCreateInteraction();

  const handleCreateInteraction = useCallback(
    async (input: { customerId: string; type: string; subject: string; content: string }) => {
      await createInteraction(input);
    },
    [createInteraction]
  );

  return (
    <CrmView
      t={t}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      interactions={interactions ?? []}
      opportunities={opportunities ?? []}
      isLoading={isLoading}
      error={error?.message || null}
      isCreatingInteraction={isCreatingInteraction}
      onCreateInteraction={handleCreateInteraction}
    />
  );
});

CrmContainer.displayName = "CrmContainer";
