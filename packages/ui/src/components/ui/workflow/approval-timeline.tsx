// ============================================
// packages/ui/src/components/ui/workflow/approval-card.tsx
// Hisabche v1.2 — Unified Approval Card (Timeline + Actions)
// ✅ Memoized · Performance Optimized
// Responsive: side-by-side on desktop, stacked on mobile
// ============================================

'use client'

import { useState, useCallback, useMemo, memo } from 'react'
import { cn } from '../../../lib/utils'
import { Check, X, Forward, Clock, User, Loader2 } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface TimelineAction {
  id: string
  action: 'approved' | 'rejected' | 'forwarded' | 'cancelled'
  step_order: number
  actor_user_id: string
  actor_role?: string | null
  comment?: string | null
  created_at: string
}

interface TimelineStep {
  step_order: number
  approver_role: string
  is_final: boolean
}

type WorkflowAction = 'approved' | 'rejected' | 'cancelled'

interface ApprovalCardProps {
  actions: TimelineAction[]
  steps: TimelineStep[]
  currentStep: number
  status: string
  instanceId: string
  isPending: boolean
  onAction: (action: WorkflowAction, comment?: string) => Promise<void>
  t: (key: string, fallback?: string) => string
  disabled?: boolean
  // ✅ اطلاعات موجودیتی که باید تأیید شود — بدون این‌ها کارت فقط «فرآیند
  // تأیید / تأیید / رد» نشان می‌داد و معلوم نبود اصلاً چه چیزی در انتظار
  // تأیید است. این داده‌ها از قبل در instance موجود بودند، فقط رندر نمی‌شدند.
  entityType?: string | undefined
  entityId?: string | undefined
  totalSteps?: number | undefined
  startedAt?: string | undefined
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS (ثابت‌ها)
   ═══════════════════════════════════════════════════════════════ */

const actionIcons: Record<string, typeof Check> = {
  approved: Check,
  rejected: X,
  forwarded: Forward,
  cancelled: X,
}

const actionBadgeColors: Record<string, string> = {
  approved:
    'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]',
  rejected:
    'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]',
  forwarded:
    'bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))] border-[hsl(var(--color-info)/0.2)]',
  cancelled:
    'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-tertiary))] border-[hsl(var(--border-default))]',
}

const actionLabels: Record<string, string> = {
  approved: 'workflow.approved',
  rejected: 'workflow.rejected',
  forwarded: 'workflow.forwarded',
  cancelled: 'workflow.cancelled',
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENT — Reject Modal (با memo)
   ═══════════════════════════════════════════════════════════════ */

const RejectModal = memo(function RejectModal({
  open,
  onClose,
  onConfirm,
  loading,
  t,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (comment: string) => void
  loading: boolean
  t: (key: string, fallback?: string) => string
}) {
  const [comment, setComment] = useState('')

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-[hsl(var(--surface-base)/0.8)] backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
          {t('workflow.rejectReason', 'دلیل رد درخواست')}
        </h3>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t('workflow.rejectDescription', 'لطفاً دلیل رد را توضیح دهید.')}
        </p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t(
            'workflow.rejectPlaceholder',
            'مثلاً: مبلغ فاکتور با قرارداد مطابقت ندارد...',
          )}
          rows={3}
          autoFocus
          className="w-full rounded-xl p-3 text-sm resize-none border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:outline-none focus:border-[hsl(var(--color-destructive)/0.5)]"
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 h-10 text-sm font-medium text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]"
          >
            {t('action.cancel', 'انصراف')}
          </button>
          <button
            disabled={!comment.trim() || loading}
            onClick={() => onConfirm(comment)}
            className="inline-flex items-center gap-2 px-5 h-10 text-sm font-bold text-white bg-[hsl(var(--color-destructive))] rounded-lg hover:brightness-110 disabled:opacity-40"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            {t('workflow.confirmReject', 'تأیید رد')}
          </button>
        </div>
      </div>
    </div>
  )
})

RejectModal.displayName = 'RejectModal'

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT (با memo)
   ═══════════════════════════════════════════════════════════════ */

export const ApprovalCard = memo(function ApprovalCard({
  actions,
  steps,
  currentStep,
  status,
  instanceId,
  isPending,
  onAction,
  t,
  disabled = false,
  entityType,
  entityId,
  totalSteps,
  startedAt,
}: ApprovalCardProps) {
  const [showReject, setShowReject] = useState(false)
  const [loading, setLoading] = useState<WorkflowAction | null>(null)

  // ✅ useMemo برای stepsWithActions (فقط زمانی که actions یا steps تغییر کنند)
  const stepsWithActions = useMemo(
    () =>
      steps.map((step) => {
        const action = actions.find((a) => a.step_order === step.step_order)
        return { ...step, action }
      }),
    [steps, actions],
  )

  const handleAction = useCallback(
    async (action: WorkflowAction, comment?: string) => {
      setLoading(action)
      try {
        await onAction(action, comment)
      } finally {
        setLoading(null)
        setShowReject(false)
      }
    },
    [onAction],
  )

  const isDisabled = disabled || !isPending || loading !== null

  return (
    <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 sm:p-5 space-y-4">
      {/* Header — چه چیزی در انتظار تأیید است */}
      <div className="space-y-1 border-b border-[hsl(var(--border-default)/0.6)] pb-3">
        <h4 className="text-sm font-bold text-[hsl(var(--fg-primary))]">
          {entityType
            ? t(`workflow.entity.${entityType}`, entityType)
            : t('workflow.title', 'فرآیند تأیید')}
          {entityId ? (
            <span
              className="ms-1.5 font-mono text-[11px] font-normal text-[hsl(var(--fg-tertiary))]"
              dir="ltr"
            >
              #{entityId.slice(0, 8)}
            </span>
          ) : null}
        </h4>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[hsl(var(--fg-secondary))]">
          {typeof totalSteps === 'number' && totalSteps > 0 ? (
            <span>
              {t('workflow.stepProgress', 'مرحله')} {currentStep} / {totalSteps}
            </span>
          ) : null}
          {startedAt ? (
            <span>
              {t('workflow.startedAt', 'شروع')}: {new Date(startedAt).toLocaleDateString('fa-AF')}
            </span>
          ) : null}
          <span className="text-[hsl(var(--fg-tertiary))]">
            {t(`workflow.status.${status}`, status)}
          </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left: Timeline */}
        <div className="flex-1 min-w-0">
          <div className="space-y-0.5">
            {stepsWithActions.map((step, index) => {
              const isActive = step.step_order === currentStep && status === 'in_progress'
              const isCompleted = !!step.action?.action && step.action.action !== 'rejected'
              const isRejected = step.action?.action === 'rejected'
              const isPendingSt = !step.action && !isActive
              const isLast = index === stepsWithActions.length - 1
              const Icon = step.action
                ? (actionIcons[step.action.action] ?? Clock)
                : isActive
                  ? Clock
                  : User

              return (
                <div key={step.step_order} className="relative flex gap-3">
                  {!isLast && (
                    <div
                      className={cn(
                        'absolute top-9 bottom-0 w-0.5',
                        isCompleted
                          ? 'bg-[hsl(var(--color-primary)/0.5)]'
                          : 'bg-[hsl(var(--border-default))]',
                      )}
                      style={{ insetInlineStart: 19 }}
                    />
                  )}
                  <div
                    className={cn(
                      'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2',
                      isCompleted &&
                        'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.12)]',
                      isActive &&
                        'border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning)/0.12)] animate-pulse',
                      isRejected &&
                        'border-[hsl(var(--color-destructive))] bg-[hsl(var(--color-destructive)/0.12)]',
                      isPendingSt &&
                        'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-4',
                        isCompleted && 'text-[hsl(var(--color-success))]',
                        isActive && 'text-[hsl(var(--color-warning))]',
                        isRejected && 'text-[hsl(var(--color-destructive))]',
                        isPendingSt && 'text-[hsl(var(--fg-tertiary))]',
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          isCompleted && 'text-[hsl(var(--color-success))]',
                          isActive && 'text-[hsl(var(--color-warning))]',
                          isRejected && 'text-[hsl(var(--color-destructive))]',
                          isPendingSt && 'text-[hsl(var(--fg-tertiary))]',
                        )}
                      >
                        {t(`roles.${step.approver_role}`, step.approver_role)}
                      </span>
                      {step.is_final && (
                        <span className="inline-flex items-center rounded-full bg-[hsl(var(--color-primary)/0.1)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--color-primary))]">
                          {t('workflow.final', 'نهایی')}
                        </span>
                      )}
                    </div>
                    {step.action && (
                      <div className="mt-1.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border',
                            actionBadgeColors[step.action.action] ?? actionBadgeColors.cancelled,
                          )}
                        >
                          {t(
                            actionLabels[step.action.action] ?? 'workflow.unknown',
                            step.action.action,
                          )}
                        </span>
                        <span className="ms-2 text-[11px] text-[hsl(var(--fg-tertiary))]">
                          {formatDateTime(step.action.created_at)}
                        </span>
                      </div>
                    )}
                    {step.action?.comment && (
                      <p className="mt-1 text-xs text-[hsl(var(--fg-secondary))] italic">
                        «{step.action.comment}»
                      </p>
                    )}
                    {isPendingSt && !isActive && (
                      <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
                        {t('workflow.pending', 'در انتظار')}
                      </p>
                    )}
                    {isActive && (
                      <p className="mt-1 text-xs text-[hsl(var(--color-warning))] font-medium">
                        {t('workflow.inProgress', 'در حال بررسی')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="lg:w-44 shrink-0 lg:border-s lg:border-[hsl(var(--border-default))] lg:ps-5 flex flex-col gap-2">
          <span className="text-xs font-semibold text-[hsl(var(--fg-tertiary))]">
            {t('workflow.action', 'عملیات')}
          </span>

          <button
            type="button"
            disabled={isDisabled}
            onClick={() => handleAction('approved')}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 h-10 text-sm font-bold text-white',
              'bg-[hsl(var(--color-success))] shadow-sm shadow-[hsl(var(--color-success)/0.2)]',
              'hover:brightness-110 active:scale-[0.98] transition-all duration-200',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {loading === 'approved' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {t('workflow.approve', 'تأیید')}
          </button>

          <button
            type="button"
            disabled={isDisabled}
            onClick={() => setShowReject(true)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 h-10 text-sm font-bold',
              'border border-[hsl(var(--color-destructive)/0.3)] text-[hsl(var(--color-destructive))]',
              'hover:bg-[hsl(var(--color-destructive)/0.08)] active:bg-[hsl(var(--color-destructive)/0.12)] transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <X className="size-4" />
            {t('workflow.reject', 'رد')}
          </button>
        </div>
      </div>

      {/* Reject Modal */}
      <RejectModal
        open={showReject}
        onClose={() => setShowReject(false)}
        onConfirm={(comment) => handleAction('rejected', comment)}
        loading={loading === 'rejected'}
        t={t}
      />
    </div>
  )
})

ApprovalCard.displayName = 'ApprovalCard'
