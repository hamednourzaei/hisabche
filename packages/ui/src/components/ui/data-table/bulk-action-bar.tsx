// ============================================
// Bulk action bar — appears above a table once rows are selected.
//
// Destructive actions always route through a confirmation step; the bar owns
// that so no caller can forget it.
// ============================================

'use client'

import { useState, type ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'

import { cn } from '../../../lib/utils'

export interface BulkAction {
  id: string
  label: string
  icon?: ReactNode
  /** Destructive actions ask for confirmation before running. */
  destructive?: boolean
  /** Shown in the confirmation step. Should state what will happen. */
  confirmLabel?: string
  onRun: () => void | Promise<void>
}

export interface BulkActionBarProps {
  t: (key: string, fallback?: string) => string
  selectedCount: number
  actions: readonly BulkAction[]
  onClear: () => void
  /** Disables every action while a bulk run is in flight. */
  busy?: boolean
  /**
   * Outcome of the last run. Reported inline rather than through a toast:
   * desktop does not mount a toast provider, and feedback that lives next to
   * the selection is where the user is already looking.
   */
  result?: { succeeded: readonly string[]; failed: readonly string[] } | null | undefined
}

const barButton =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed'

export function BulkActionBar({
  t,
  selectedCount,
  actions,
  onClear,
  busy = false,
  result = null,
}: BulkActionBarProps) {
  const [confirming, setConfirming] = useState<string | null>(null)

  // A finished run with nothing left selected still has something to say —
  // "8 deleted, 2 failed" must outlive the selection that produced it.
  if (selectedCount === 0) {
    if (!result || result.failed.length === 0) return null

    return (
      <div
        role="status"
        className={cn(
          'mb-3 rounded-2xl px-3 py-2 text-xs font-medium',
          'border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.06)]',
          'text-[hsl(var(--color-destructive))]',
        )}
      >
        {t('common.bulkPartialFailure', '{failed} مورد انجام نشد')
          .replace('{failed}', String(result.failed.length))
          .replace('{succeeded}', String(result.succeeded.length))}
      </div>
    )
  }

  const pending = actions.find((action) => action.id === confirming)

  return (
    <div
      // `status` rather than `alert`: appearing is informational, and an alert
      // would interrupt a screen reader mid-sentence on every selection change.
      role="status"
      className={cn(
        'mb-3 flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2',
        'border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.06)]',
      )}
    >
      <span className="text-xs font-semibold text-[hsl(var(--fg-primary))]">
        {t('common.selectedCount', '{count} مورد انتخاب شد').replace(
          '{count}',
          String(selectedCount),
        )}
      </span>

      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        {pending ? (
          <>
            <span className="text-xs text-[hsl(var(--fg-secondary))]">
              {pending.confirmLabel ?? t('common.confirmAction', 'مطمئن هستید؟')}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                // Close first: the list refetches underneath and this bar can
                // unmount while the action is still resolving.
                setConfirming(null)
                void pending.onRun()
              }}
              className={cn(
                barButton,
                'bg-[hsl(var(--color-destructive))] text-white hover:brightness-110',
              )}
            >
              {busy && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />}
              {t('common.confirm', 'تایید')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className={cn(
                barButton,
                'border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
              )}
            >
              {t('common.cancel', 'انصراف')}
            </button>
          </>
        ) : (
          <>
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  if (action.destructive) setConfirming(action.id)
                  else void action.onRun()
                }}
                className={cn(
                  barButton,
                  action.destructive
                    ? 'text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--color-destructive)/0.1)]'
                    : 'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
                )}
              >
                {action.icon}
                {action.label}
              </button>
            ))}

            <button
              type="button"
              onClick={onClear}
              aria-label={t('common.clearSelection', 'پاک کردن انتخاب')}
              className="rounded-full p-1 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
