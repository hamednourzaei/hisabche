'use client'

import { useState, useCallback, memo } from 'react'
import { formatDate as formatIntlDate } from '@hisabche/formatting'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import { X, User, Phone, Clock, CheckCircle2, Loader2, Share2, Check } from 'lucide-react'
import type { Interaction, TaskStatus } from '@hisabche/api'
import { TaskCustomerOutcomes } from './task-customer-outcomes'
import { SelectField } from '../select-field'

interface TaskDetailModalProps {
  t: (key: string, fallback?: string) => string
  task: Interaction
  publicTaskUrl: string | null
  isUpdating: boolean
  onClose: () => void
  onUpdateStatus: (status: TaskStatus, assignee?: { id: string; name: string }) => Promise<void>
  /**
   * Staff this task can be handed to. Empty renders no picker — an owner with
   * no employees on file is not shown an empty dropdown to wonder about.
   */
  employees?: ReadonlyArray<{ id: string; name: string }>
  /** Omit to render the customer table read-only. */
  onRecordOutcome?:
    ((input: { customerId: string; outcome: 'done' | 'failed'; note?: string }) => void) | undefined
  pendingCustomerId?: string | null | undefined
}

const STATUS_LABEL_KEY: Record<TaskStatus, [string, string]> = {
  pending: ['crm.status.pending', 'در حال انتظار'],
  in_progress: ['crm.status.inProgress', 'در حال انجام'],
  completed: ['crm.status.completed', 'کامل شد'],
}

const STATUS_BADGE_MAP: Record<TaskStatus, string> = {
  pending: 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
  in_progress: 'bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]',
  completed: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
}

// ⚠️ THE CALENDAR IS NOT A CONSTANT. This was pinned to `'fa-AF'`, so an
// English reader got the Afghan solar calendar in Persian digits and an
// Iranian Persian reader got «سنبله» where their own calendar says «شهریور» —
// the right calendar with the wrong month names, which reads as a typo rather
// than a bug and so was never reported as one. It follows the UI language now.
function formatDateTime(lang: string, iso?: string): string {
  if (!iso) return '-'
  try {
    return formatIntlDate(iso, lang, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export const TaskDetailModal = memo(function TaskDetailModal({
  t,
  task,
  publicTaskUrl,
  isUpdating,
  onClose,
  onUpdateStatus,
  employees = [],
  onRecordOutcome,
  pendingCustomerId = null,
}: TaskDetailModalProps) {
  // The reader's calendar — see the helper above.
  const { lang } = useDateFormat()

  // '' = leave the task where it is.
  const [assigneeId, setAssigneeId] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCopyLink = useCallback(async () => {
    if (!publicTaskUrl) return
    try {
      await navigator.clipboard.writeText(publicTaskUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unsupported — silently ignore */
    }
  }, [publicTaskUrl])

  const history = task.statusHistory ?? []
  const customers = task.customers ?? []

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
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[hsl(var(--fg-primary))]">{task.subject}</h3>
            <span
              className={cn(
                'mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                STATUS_BADGE_MAP[task.status],
              )}
            >
              {t(...STATUS_LABEL_KEY[task.status])}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-[hsl(var(--fg-tertiary))] mb-1">
              {t('crm.employee', 'نام پرسنل')}
            </p>
            <p className="flex items-center gap-1.5 text-[hsl(var(--fg-primary))]">
              <User className="size-3.5 text-[hsl(var(--fg-tertiary))]" />
              {task.employeeName || '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--fg-tertiary))] mb-1">
              {t('crm.interactions.type', 'نوع')}
            </p>
            <p className="text-[hsl(var(--fg-primary))]">
              {t(`crm.interactions.type.${task.type}`, task.type)}
            </p>
          </div>
        </div>

        {task.content && (
          <div>
            <p className="text-xs text-[hsl(var(--fg-tertiary))] mb-1">
              {t('crm.interactions.contentPlaceholder', 'توضیحات')}
            </p>
            <p className="text-sm text-[hsl(var(--fg-primary))]">{task.content}</p>
          </div>
        )}

        {/* Customers — searchable, paginated, with each one's recorded result.
            The owner can also record on their behalf (a customer who called
            back directly), which is why `onRecordOutcome` is passed through. */}
        <TaskCustomerOutcomes
          t={t}
          customers={customers}
          outcomes={task.customerOutcomes ?? []}
          onRecord={onRecordOutcome}
          pendingCustomerId={pendingCustomerId}
          // A finished task is a record. Nothing in it may be rewritten.
          isLocked={task.status === 'completed'}
        />

        {/* Timeline */}
        <div>
          <p className="text-xs font-semibold text-[hsl(var(--fg-tertiary))] mb-2">
            {t('crm.statusTimeline', 'تاریخچه وضعیت')}
          </p>
          <div className="space-y-0.5">
            {history.length === 0 ? (
              <p className="text-sm text-[hsl(var(--fg-tertiary))]">-</p>
            ) : (
              history.map((event, index) => {
                const isLast = index === history.length - 1
                return (
                  <div key={index} className="relative flex gap-3">
                    {!isLast && (
                      <div
                        className="absolute top-7 bottom-0 w-0.5 bg-[hsl(var(--border-default))]"
                        style={{ insetInlineStart: 11 }}
                      />
                    )}
                    <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[hsl(var(--color-primary)/0.4)] bg-[hsl(var(--color-primary)/0.1)]">
                      {event.status === 'completed' ? (
                        <CheckCircle2 className="size-3.5 text-[hsl(var(--color-success))]" />
                      ) : (
                        <Clock className="size-3.5 text-[hsl(var(--color-primary))]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-3">
                      <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                        {t(...STATUS_LABEL_KEY[event.status])}
                      </p>
                      <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                        {formatDateTime(lang, event.changedAt)}
                        {event.changedBy &&
                          ` · ${event.changedBy === 'employee' ? t('crm.byEmployee', 'توسط پرسنل') : t('crm.byOwner', 'توسط شما')}`}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Owner manual status edit — goes through the authenticated update
            path, never the public-token path an employee uses. */}
        <div className="border-t border-[hsl(var(--border-default))] pt-4 space-y-2">
          <p className="text-xs font-semibold text-[hsl(var(--fg-tertiary))]">
            {t('crm.changeStatus', 'تغییر دستی وضعیت')}
          </p>
          {/*
            «هر کاربر هم با سلکت مشخص بشه» — who the task belongs to, changed
            in the same write as the status so the two cannot disagree. The
            same `SelectField` the rest of the app uses.
          */}
          {employees.length > 0 && (
            <SelectField
              value={assigneeId}
              onChange={setAssigneeId}
              options={[
                { value: '', label: t('crm.keepEmployee', 'همان پرسنل فعلی') },
                ...employees.map((employee) => ({ value: employee.id, label: employee.name })),
              ]}
              className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2 text-sm"
              disabled={isUpdating}
            />
          )}
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(STATUS_LABEL_KEY) as TaskStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                disabled={isUpdating || (task.status === s && !assigneeId)}
                onClick={() => {
                  const picked = employees.find((employee) => employee.id === assigneeId)
                  void onUpdateStatus(s, picked ? { id: picked.id, name: picked.name } : undefined)
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                  task.status === s
                    ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]'
                    : 'border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
                  'disabled:cursor-not-allowed',
                )}
              >
                {isUpdating ? <Loader2 className="size-3 animate-spin" /> : null}
                {t(...STATUS_LABEL_KEY[s])}
              </button>
            ))}
          </div>
        </div>

        {/* Share link — sends the task to the employee without a site account */}
        {publicTaskUrl && (
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white bg-[hsl(var(--color-primary))] hover:brightness-110 transition-all"
          >
            {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
            {copied
              ? t('crm.linkCopied', 'لینک کپی شد')
              : t('crm.sendToEmployee', 'ارسال لینک به پرسنل')}
          </button>
        )}
      </div>
    </div>
  )
})

TaskDetailModal.displayName = 'TaskDetailModal'
