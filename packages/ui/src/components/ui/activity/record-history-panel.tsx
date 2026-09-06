'use client'

// ============================================
// packages/ui/src/components/ui/activity/record-history-panel.tsx
//
// H6 (second half) — «تاریخچه‌ی تغییرات این رکورد», on the record's own screen.
//
// ---------------------------------------------------------------------------
// THE HOOK THAT NOBODY CALLED
//
// `useRecordHistory(entityType, entityId)` was written in G4 and had ZERO
// consumers. The endpoint behind it is workspace-scoped and filtered to one
// record; the only thing missing was a place to render it.
//
// ---------------------------------------------------------------------------
// ⚠️ AN EMPTY HISTORY IS NOT PROOF NOTHING HAPPENED
//
// `audit_logs` is currently written by the platform-admin paths and the
// expiry worker. Invoices, payments and stock do NOT write to it (gap 10 in
// the handoff), so this panel is legitimately empty on most records today.
//
// The empty state therefore says «nothing recorded» — not «nothing changed».
// The difference matters: a panel that implied a record had never been touched
// would be actively misleading, and would go on being misleading for exactly
// as long as the writers stay unwired.
// ============================================

import { History } from 'lucide-react'

import { cn } from '../../../lib/utils'

export interface RecordHistoryEntry {
  id: string
  action: string
  createdAt: string
  userId?: string | null
  userName?: string | null
  branchName?: string | null
}

export interface RecordHistoryPanelProps {
  t: (key: string, fallback: string) => string
  isLoading: boolean
  entries: RecordHistoryEntry[]
  className?: string | undefined
}

const ACTION_LABEL: Record<string, string> = {
  create: 'ایجاد',
  update: 'ویرایش',
  delete: 'حذف',
  view: 'مشاهده',
  export: 'خروجی',
  login: 'ورود',
  logout: 'خروج',
}

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString('fa-AF', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

export function RecordHistoryPanel({ t, isLoading, entries, className }: RecordHistoryPanelProps) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4',
        className,
      )}
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--fg-primary))]">
        <History className="size-4 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        {t('audit.recordHistory', 'تاریخچه‌ی تغییرات این رکورد')}
      </h2>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-[hsl(var(--surface-muted))]" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        // «ثبت نشده», deliberately — NOT «تغییری نکرده». See the header note.
        <p className="text-sm text-[hsl(var(--fg-tertiary))]">
          {t('audit.noRecordHistory', 'تغییری برای این رکورد ثبت نشده است.')}
        </p>
      ) : (
        <ol className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-[hsl(var(--border-default))] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-[hsl(var(--fg-primary))]">
                  {ACTION_LABEL[entry.action] ?? entry.action}
                  {entry.userName ? (
                    <span className="text-[hsl(var(--fg-secondary))]"> — {entry.userName}</span>
                  ) : null}
                </p>
                {entry.branchName ? (
                  <p className="truncate text-xs text-[hsl(var(--fg-tertiary))]">
                    {entry.branchName}
                  </p>
                ) : null}
              </div>
              <time className="shrink-0 text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
                {formatDateTime(entry.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
