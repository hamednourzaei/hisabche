// packages/ui/src/components/ui/workflow/containers/approvals-container.tsx
'use client'

import { memo, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  asList,
  useWorkflowInstances,
  useWorkflowInstanceDetail,
  useWorkflow,
  useWorkflows,
  usePerformWorkflowAction,
  type WorkflowInstance,
} from '@hisabche/api'
import { ApprovalCard } from '../approval-timeline'
import { ApprovalsView } from '../approvals-view'
import { useToast } from '../../toast-provider'
// ⚠️ Every internal link carries the locale prefix on web (راهنمای سشن، §وب):
// `router.push('/invoices/…')` from `/fa/approvals` went to a 404. And none on
// desktop, which has no `/fa/…` routes — see `localizePath`.
import { useLocalePush } from '../../../../hooks/use-locale-push'

interface ApiErrorLike {
  status?: number
  message?: string
}

/* ═══════════════════════════════════════════════════════════════════════════
   ApprovalsContainer — همه‌ی hookهای داده اینجا زندگی می‌کنند.
   ═══════════════════════════════════════════════════════════════════════════ */

const NEEDS_ACTION_STATUSES = new Set(['pending', 'in_progress'])

// یک instance را با جزئیات کامل (اکشن‌ها + مراحل تعریف‌شده در قالب workflow) رندر می‌کند.
const ApprovalInstanceCard = memo(function ApprovalInstanceCard({
  instance,
  t,
}: {
  instance: WorkflowInstance
  t: (key: string, fallback?: string) => string
}) {
  // ✅ FIX (N+1): قبلاً هر کارت جداگانه جزئیات نمونه را می‌گرفت — برای ۱۰
  // کارت یعنی ۱۰ درخواست موازی (در لاگ پروداکشن هرکدام ۸۰۰-۹۱۳ms). حالا
  // اکشن‌ها همراه خودِ لیست می‌آیند، پس فقط وقتی درخواست جداگانه می‌زنیم که
  // بک‌اند هنوز آن‌ها را ضمیمه نکرده باشد (سازگاری با نسخه‌ی قدیمی بک‌اند).
  const embeddedActions = (instance as unknown as { actions?: unknown[] }).actions
  const hasEmbedded = Array.isArray(embeddedActions)
  const {
    data: detail,
    isLoading: detailFetching,
    isError: detailError,
  } = useWorkflowInstanceDetail(hasEmbedded ? '' : instance.id)
  const detailLoading = hasEmbedded ? false : detailFetching
  // منبع نهایی اکشن‌ها: ضمیمه‌ی لیست، وگرنه پاسخ درخواست جداگانه.
  const actions = (hasEmbedded ? embeddedActions : detail?.actions) as
    Parameters<typeof ApprovalCard>[0]['actions'] | undefined
  const {
    data: workflow,
    isLoading: workflowLoading,
    isError: workflowError,
  } = useWorkflow(instance.workflow_id)
  const { mutateAsync: performAction } = usePerformWorkflowAction()
  const toast = useToast()
  const push = useLocalePush()

  const handleAction = useCallback(
    async (action: 'approved' | 'rejected' | 'cancelled', comment?: string) => {
      try {
        await performAction({
          instanceId: instance.id,
          action,
          ...(comment !== undefined && { comment }),
        })
      } catch (err) {
        const apiError = err as ApiErrorLike
        const message =
          apiError.status === 403
            ? t('workflow.forbiddenError', 'شما اجازه‌ی انجام این اقدام را در این مرحله ندارید.')
            : (apiError.message ?? t('workflow.actionError', 'انجام اقدام با خطا مواجه شد.'))
        toast.error(t('workflow.actionErrorTitle', 'خطا در انجام اقدام'), message)
      }
    },
    [performAction, instance.id, toast, t],
  )

  // Only the instance's own actions are load-bearing. Without them there is
  // genuinely nothing to render.
  if (detailError) {
    return (
      <div className="h-16 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] flex items-center justify-center text-xs text-[hsl(var(--fg-tertiary))]">
        {t('workflow.loadError', 'بارگذاری این درخواست تأیید با خطا مواجه شد.')}
      </div>
    )
  }

  // ⚠️ FIX: a missing workflow TEMPLATE used to blank the whole card. An
  // instance whose template was deleted still has its status, current step,
  // total steps, entity and actions — everything the approver needs to act on.
  // Only the step *names* are lost. Failing the entire row turned every
  // orphaned instance into "بارگذاری این درخواست تأیید با خطا مواجه شد" and
  // made the approvals page unusable.
  const steps = workflowError ? [] : workflow?.steps

  if (detailLoading || !actions || (!workflowError && (workflowLoading || !workflow))) {
    return <div className="h-32 rounded-2xl bg-[hsl(var(--surface-muted))] animate-pulse" />
  }

  return (
    <ApprovalCard
      actions={actions}
      steps={steps ?? []}
      currentStep={instance.current_step}
      status={instance.status}
      instanceId={instance.id}
      entityType={instance.entity_type}
      entityId={instance.entity_id}
      onOpenDocument={push}
      totalSteps={instance.total_steps}
      startedAt={instance.started_at}
      isPending={NEEDS_ACTION_STATUSES.has(instance.status)}
      onAction={handleAction}
      t={t}
    />
  )
})
ApprovalInstanceCard.displayName = 'ApprovalInstanceCard'

export const ApprovalsContainer = memo(function ApprovalsContainer() {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    const v = tOriginal(key as Parameters<typeof tOriginal>[0])
    return v && v !== key ? v : (fallback ?? key)
  }

  const { data, isLoading, error, refetch } = useWorkflowInstances()
  const push = useLocalePush()

  // An empty page must be able to say WHY it is empty. Without an active
  // workflow nothing is ever routed here, and «چیزی در انتظار تأیید شما نیست»
  // would be a permanent, misleading answer.
  const { data: workflowData, isLoading: workflowsLoading } = useWorkflows({ is_active: true })
  const hasActiveWorkflow = workflowsLoading
    ? null
    : asList<{ id: string }>(workflowData?.data).length > 0

  const pendingInstances = useMemo(
    () => asList<WorkflowInstance>(data?.data).filter((i) => NEEDS_ACTION_STATUSES.has(i.status)),
    [data],
  )

  const items = useMemo(
    () =>
      pendingInstances.map((instance) => ({
        id: instance.id,
        status: instance.status,
        card: <ApprovalInstanceCard instance={instance} t={t} />,
      })),
    [pendingInstances, t],
  )

  return (
    <ApprovalsView
      t={t}
      isLoading={isLoading}
      error={error ? (error as Error).message : null}
      items={items}
      onRetry={() => void refetch()}
      hasActiveWorkflow={hasActiveWorkflow}
      onDefineWorkflow={() => push('/workflow-templates')}
    />
  )
})
ApprovalsContainer.displayName = 'ApprovalsContainer'
