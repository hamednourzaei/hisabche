'use client'

// ============================================
// packages/ui/src/components/ui/activity/audit-trail-tab.tsx
//
// G4 — «سابقه تغییرات»: the compliance record, as its own tab.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SECOND TAB AND NOT MORE ROWS IN THE FIRST
//
// The architecture is explicit that USER ACTIVITY and AUDIT EVENT stay two
// datasets, and this screen is where the temptation to merge them is
// strongest — both are "a list of things that happened".
//
// They answer different questions and have different rules:
//
//   activities   "what happened lately that I care about". Has read, pinned
//                and archived state that belongs to the VIEWER. Filtered for
//                relevance. Deleting one loses nothing.
//
//   audit_logs   "prove what happened to this record". Append-only, with
//                before/after values, an actor and an address. Nobody may
//                mark it read, and losing one destroys evidence.
//
// Merged, the feed gains a legal weight it cannot carry and the evidence gains
// a read flag it must not have.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT THIS TAB WILL SHOW TODAY
//
// Not much, and that is honest rather than broken. `audit_logs` is currently
// written only by platform-admin actions and the trial-expiration worker —
// invoicing, payments and stock do NOT write it yet. G4's job was to make the
// trail workspace-readable and branch-aware; making every financial service
// write to it is separate work.
//
// The empty state says so, rather than implying nothing has happened.
// ============================================

import { Fragment, memo, useMemo, useState } from 'react'
import { ChevronDown, ShieldCheck } from 'lucide-react'

import { cn } from '../../../lib/utils'

export interface AuditRow {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  created_at: string
  user_id?: string | null
  branch_id?: string | null
  old_data?: Record<string, unknown> | null
  new_data?: Record<string, unknown> | null
}

export interface AuditFilterOption {
  value: string
  label: string
}

interface AuditTrailTabProps {
  t: (key: string, fallback?: string) => string
  rows: AuditRow[]
  total: number
  isLoading?: boolean
  error?: string | null

  /** «فاکتور کی صادر شده از کدام شعبه» — the combined filter G4 names. */
  entityType: string
  branchId: string
  actorId: string
  onEntityTypeChange: (value: string) => void
  onBranchChange: (value: string) => void
  onActorChange: (value: string) => void

  entityTypes: AuditFilterOption[]
  branches: AuditFilterOption[]
  actors: AuditFilterOption[]

  /** H6 — the record id is clickable; the parent knows how to route it. */
  onOpenRecord?: (entityType: string, entityId: string) => void

  formatDate: (iso: string) => string
  labelForActor: (userId: string | null | undefined) => string
  labelForBranch: (branchId: string | null | undefined) => string
  labelForRole: (userId: string | null | undefined) => string
}

const ACTION_TONE: Record<string, string> = {
  create: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  update: 'bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]',
  delete: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
}

const FALLBACK_TONE = 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]'

/**
 * Before/after, as the fields that actually CHANGED.
 *
 * Dumping both blobs would make a reader diff two JSON objects by eye. The
 * comparison is done here, and only differing keys are shown — which is the
 * one thing the column is for.
 */
function changedFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): { key: string; from: unknown; to: unknown }[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const changes: { key: string; from: unknown; to: unknown }[] = []

  for (const key of keys) {
    const from = before?.[key]
    const to = after?.[key]
    // JSON comparison, not `!==`: these values come out of jsonb, so nested
    // objects are new references every time and would all read as changed.
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ key, from, to })
  }

  return changes
}

const show = (value: unknown): string => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const AuditDetailRow = memo(function AuditDetailRow({
  row,
  t,
}: {
  row: AuditRow
  t: (key: string, fallback?: string) => string
}) {
  const changes = useMemo(() => changedFields(row.old_data, row.new_data), [row])

  if (changes.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-[hsl(var(--fg-tertiary))]">
        {t('audit.noFieldDetail', 'جزئیات فیلدها برای این رخداد ثبت نشده است.')}
      </p>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-[hsl(var(--fg-tertiary))]">
          <th className="px-4 py-1.5 text-start font-medium">{t('audit.field', 'فیلد')}</th>
          <th className="px-4 py-1.5 text-start font-medium">{t('audit.before', 'قبل')}</th>
          <th className="px-4 py-1.5 text-start font-medium">{t('audit.after', 'بعد')}</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((change) => (
          <tr key={change.key} className="border-t border-[hsl(var(--border-default)/0.4)]">
            <td className="px-4 py-1.5 font-mono text-xs text-[hsl(var(--fg-secondary))]">
              {change.key}
            </td>
            <td className="px-4 py-1.5 text-[hsl(var(--fg-tertiary))] line-through">
              {show(change.from)}
            </td>
            <td className="px-4 py-1.5 font-medium text-[hsl(var(--fg-primary))]">
              {show(change.to)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
})

export const AuditTrailTab = memo(function AuditTrailTab({
  t,
  rows,
  total,
  isLoading = false,
  error,
  entityType,
  branchId,
  actorId,
  onEntityTypeChange,
  onBranchChange,
  onActorChange,
  entityTypes,
  branches,
  actors,
  onOpenRecord,
  formatDate,
  labelForActor,
  labelForBranch,
  labelForRole,
}: AuditTrailTabProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  const select =
    'rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2 text-sm'

  return (
    <div className="space-y-4">
      {/* The combined filter the tab exists to answer. */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={entityType}
          onChange={(e) => onEntityTypeChange(e.target.value)}
          className={select}
          aria-label={t('audit.entityType', 'نوع رکورد')}
        >
          <option value="">{t('audit.allEntityTypes', 'همه‌ی رکوردها')}</option>
          {entityTypes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={branchId}
          onChange={(e) => onBranchChange(e.target.value)}
          className={select}
          aria-label={t('audit.branch', 'شعبه')}
        >
          <option value="">{t('audit.allBranches', 'همه‌ی شعب')}</option>
          {branches.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={actorId}
          onChange={(e) => onActorChange(e.target.value)}
          className={select}
          aria-label={t('audit.actor', 'کاربر')}
        >
          <option value="">{t('audit.allActors', 'همه‌ی کاربران')}</option>
          {actors.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <span className="ms-auto text-sm text-[hsl(var(--fg-tertiary))]">
          {t('audit.total', 'تعداد')}: <span className="tabular-nums">{total}</span>
        </span>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-12 text-center">
          <ShieldCheck
            className="mx-auto mb-3 size-12 text-[hsl(var(--fg-tertiary))]"
            aria-hidden
          />
          <p className="mb-1 text-[hsl(var(--fg-secondary))]">
            {t('audit.empty', 'رخداد ثبت‌شده‌ای در این بازه نیست')}
          </p>
          {/*
            Honest about WHY it is empty. "No records" reads as "nothing has
            happened", which is not what this means today — most financial
            services do not write to the audit trail yet.
          */}
          <p className="mx-auto max-w-md text-sm text-[hsl(var(--fg-tertiary))]">
            {t(
              'audit.emptyHint',
              'سابقهٔ تغییرات فعلاً فقط برای عملیات مدیریتی ثبت می‌شود. رخدادهای روزمره را در تب «رخدادهای من» ببینید.',
            )}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border-default))] text-xs text-[hsl(var(--fg-tertiary))]">
                <th className="px-4 py-2.5 text-start font-medium">{t('audit.time', 'زمان')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('audit.actor', 'کاربر')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('audit.role', 'نقش')}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t('audit.branch', 'شعبه')}</th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t('audit.action', 'عملیات')}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t('audit.entityType', 'نوع رکورد')}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t('audit.entityId', 'شناسه رکورد')}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t('audit.changes', 'قبل / بعد')}
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const isOpen = openId === row.id

                return (
                  <Fragment key={row.id}>
                    <tr className="border-b border-[hsl(var(--border-default)/0.5)] last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-[hsl(var(--fg-secondary))]">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="px-4 py-2.5 text-[hsl(var(--fg-primary))]">
                        {labelForActor(row.user_id)}
                      </td>
                      <td className="px-4 py-2.5 text-[hsl(var(--fg-tertiary))]">
                        {labelForRole(row.user_id)}
                      </td>
                      <td className="px-4 py-2.5 text-[hsl(var(--fg-tertiary))]">
                        {labelForBranch(row.branch_id)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs font-medium',
                            ACTION_TONE[row.action] ?? FALLBACK_TONE,
                          )}
                        >
                          {t(`audit.actions.${row.action}`, row.action)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[hsl(var(--fg-secondary))]">
                        {t(`audit.entities.${row.entity_type}`, row.entity_type)}
                      </td>
                      <td className="px-4 py-2.5">
                        {/*
                          H6 — clickable through to the real record. The parent
                          maps entity_type to a route; this component does not
                          know the product's URLs.
                        */}
                        {row.entity_id && onOpenRecord ? (
                          <button
                            type="button"
                            onClick={() => onOpenRecord(row.entity_type, row.entity_id as string)}
                            className="font-mono text-xs text-[hsl(var(--color-primary))] hover:underline"
                          >
                            {row.entity_id.slice(0, 8)}
                          </button>
                        ) : (
                          <span className="font-mono text-xs text-[hsl(var(--fg-tertiary))]">
                            {row.entity_id ? row.entity_id.slice(0, 8) : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => setOpenId(isOpen ? null : row.id)}
                          aria-expanded={isOpen}
                          className="inline-flex items-center gap-1 text-xs text-[hsl(var(--color-primary))] hover:underline"
                        >
                          {t('audit.viewChanges', 'مشاهده')}
                          <ChevronDown
                            className={cn('size-3 transition-transform', isOpen && 'rotate-180')}
                            aria-hidden
                          />
                        </button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-[hsl(var(--surface-muted)/0.4)]">
                        <td colSpan={8} className="p-0">
                          <AuditDetailRow row={row} t={t} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
})
