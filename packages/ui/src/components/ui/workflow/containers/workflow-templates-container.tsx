// packages/ui/src/components/ui/workflow/containers/workflow-templates-container.tsx
"use client";

import { memo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useWorkflows, useCreateWorkflow, type WorkflowEntityType, type WorkflowStep } from "@hisabche/api";
import { WorkflowTemplatesView } from "../workflow-templates-view";

export const WorkflowTemplatesContainer = memo(function WorkflowTemplatesContainer() {
  const tOriginal = useTranslations();
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0]);
    return v && v !== key ? v : (fallback ?? key);
  };

  const { data, isLoading } = useWorkflows();
  const { mutateAsync: createWorkflow, isPending } = useCreateWorkflow();

  const handleCreate = useCallback(
    async (input: { name: string; entity_type: WorkflowEntityType; steps: WorkflowStep[] }) => {
      await createWorkflow(input);
    },
    [createWorkflow]
  );

  return (
    <WorkflowTemplatesView
      t={t}
      workflows={data?.data ?? []}
      isLoading={isLoading}
      isCreating={isPending}
      onCreate={handleCreate}
    />
  );
});

WorkflowTemplatesContainer.displayName = "WorkflowTemplatesContainer";
