// packages/ui/src/components/ui/workflow/containers/approvals-container.tsx
"use client";

import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  useWorkflowInstances,
  useWorkflowInstanceDetail,
  useWorkflow,
  usePerformWorkflowAction,
  type WorkflowInstance,
} from "@hisabche/api";
import { ApprovalCard } from "../approval-timeline";
import { ApprovalsView } from "../approvals-view";

/* ═══════════════════════════════════════════════════════════════════════════
   ApprovalsContainer — همه‌ی hookهای داده اینجا زندگی می‌کنند.
   ═══════════════════════════════════════════════════════════════════════════ */

const NEEDS_ACTION_STATUSES = new Set(["pending", "in_progress"]);

// یک instance را با جزئیات کامل (اکشن‌ها + مراحل تعریف‌شده در قالب workflow) رندر می‌کند.
const ApprovalInstanceCard = memo(function ApprovalInstanceCard({
  instance,
  t,
}: {
  instance: WorkflowInstance;
  t: (key: string, fallback?: string) => string;
}) {
  const { data: detail, isLoading: detailLoading } = useWorkflowInstanceDetail(instance.id);
  const { data: workflow, isLoading: workflowLoading } = useWorkflow(instance.workflow_id);
  const { mutateAsync: performAction } = usePerformWorkflowAction();

  const handleAction = useCallback(
    async (action: "approved" | "rejected" | "cancelled", comment?: string) => {
      await performAction({ instanceId: instance.id, action, ...(comment !== undefined && { comment }) });
    },
    [performAction, instance.id]
  );

  if (detailLoading || workflowLoading || !detail || !workflow) {
    return <div className="h-32 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />;
  }

  return (
    <ApprovalCard
      actions={detail.actions}
      steps={workflow.steps}
      currentStep={instance.current_step}
      status={instance.status}
      instanceId={instance.id}
      isPending={NEEDS_ACTION_STATUSES.has(instance.status)}
      onAction={handleAction}
      t={t}
    />
  );
});
ApprovalInstanceCard.displayName = "ApprovalInstanceCard";

export const ApprovalsContainer = memo(function ApprovalsContainer() {
  const { t: tOriginal } = useTranslation();

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const result = tOriginal(key);
      return result && result !== key ? result : (fallback ?? key);
    },
    [tOriginal]
  );

  const { data, isLoading } = useWorkflowInstances();

  const pendingInstances = useMemo(
    () => (data?.data ?? []).filter((i) => NEEDS_ACTION_STATUSES.has(i.status)),
    [data]
  );

  const cards = useMemo(
    () => pendingInstances.map((instance) => (
      <ApprovalInstanceCard key={instance.id} instance={instance} t={t} />
    )),
    [pendingInstances, t]
  );

  return (
    <ApprovalsView
      t={t}
      isLoading={isLoading}
      isEmpty={pendingInstances.length === 0}
      cards={cards}
    />
  );
});
ApprovalsContainer.displayName = "ApprovalsContainer";
