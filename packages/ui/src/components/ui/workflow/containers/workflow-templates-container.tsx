// packages/ui/src/components/ui/workflow/containers/workflow-templates-container.tsx
'use client'

import { memo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useBusinessRules,
  useCreateBusinessRule,
  useWorkflows,
  useCreateWorkflow,
  type Workflow,
  type WorkflowEntityType,
  type WorkflowStep,
} from '@hisabche/api'
import { useToast } from '../../toast-provider'
import { WorkflowTemplatesView } from '../workflow-templates-view'
import { EscalationPolicyEditor } from '../escalation-policy-editor'
import {
  approvalConditionOf,
  invoiceApprovalRule,
  type ApprovalInvoiceType,
} from '../../../../lib/workflow/approval-rule'

export const WorkflowTemplatesContainer = memo(function WorkflowTemplatesContainer() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }

  const { data, isLoading } = useWorkflows()
  const { mutateAsync: createWorkflow, isPending } = useCreateWorkflow()
  // ⚠️ A template alone holds nothing: an invoice waits only when a RULE names
  // the template (decideApprovalRoute). This screen is where that rule is
  // written — on creation, or later for a template that has none.
  const rules = useBusinessRules('invoice')
  const { mutateAsync: createRule, isPending: isSavingCondition } = useCreateBusinessRule()

  // ⚠️ A REFUSAL IS SAID (AUDIT-80 #146). Both writes used to reject into the
  // view's click handler with nothing catching them: the form stayed open, no
  // message appeared, and the only trace was an unhandled rejection in the
  // console — the «silent error» the audit described. The server's reason is
  // read with the shared `apiErrorMessage`.
  const toast = useToast()
  const sayFailed = useCallback(
    (error: unknown) =>
      toast.error(
        tOriginal('workflow.actionErrorTitle'),
        apiErrorMessage(error, tOriginal('workflow.actionError')),
      ),
    [toast, tOriginal],
  )

  const handleCreate = useCallback(
    async (input: {
      name: string
      entity_type: WorkflowEntityType
      steps: WorkflowStep[]
      minTotal: number | null
      invoiceType: ApprovalInvoiceType
    }) => {
      const { minTotal, invoiceType, ...template } = input
      try {
        const created = (await createWorkflow(template)) as { id?: string } | null
        if (template.entity_type === 'invoice' && created?.id) {
          await createRule(invoiceApprovalRule(template.name, created.id, minTotal, invoiceType))
        }
      } catch (error) {
        sayFailed(error)
        // Still a failure to the form: it must stay open with what was typed.
        throw error
      }
    },
    [createWorkflow, createRule, sayFailed],
  )

  const handleSetCondition = useCallback(
    async (workflow: Workflow, minTotal: number | null, invoiceType: ApprovalInvoiceType) => {
      try {
        await createRule(invoiceApprovalRule(workflow.name, workflow.id, minTotal, invoiceType))
      } catch (error) {
        sayFailed(error)
      }
    },
    [createRule, sayFailed],
  )

  return (
    <WorkflowTemplatesView
      t={t}
      workflows={data?.data ?? []}
      isLoading={isLoading}
      isCreating={isPending || isSavingCondition}
      onCreate={handleCreate}
      // A failed read of the rules is said as such — never «no condition».
      conditionOf={(workflow) =>
        rules.error ? 'error' : rules.data ? approvalConditionOf(rules.data, workflow.id) : null
      }
      onSetCondition={handleSetCondition}
      isSavingCondition={isSavingCondition}
      renderEscalation={(workflow) => <EscalationPolicyEditor t={t} workflowId={workflow.id} />}
    />
  )
})

WorkflowTemplatesContainer.displayName = 'WorkflowTemplatesContainer'
