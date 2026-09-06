'use client'

// ============================================
// packages/ui/src/components/ui/conflicts/conflicts-view.tsx
//
// The offline conflict queue.
//
// ---------------------------------------------------------------------------
// WHY THIS SCREEN EXISTS
//
// A device wrote while it was offline, the record had moved on underneath it,
// and the server refused rather than guessing. BOTH versions are kept and
// NEITHER is applied until a person decides.
//
// So a row here is not a notification. It is a sale, a payment or a stock
// movement that has not been recorded yet, and every day it sits in this queue
// is a day the books are wrong in a way the books themselves cannot show.
//
// ---------------------------------------------------------------------------
// THREE RULES THIS SCREEN ENFORCES
//
// 1. Both sides are shown, always, side by side. A screen that displayed only
//    the difference would hide which record is being changed.
//
// 2. Financial divergences are marked and cannot be resolved silently. Money,
//    quantity and the identity of what was traded are what the server flags,
//    from an explicit list — never a guess at the field name.
//
// 3. A reason is required, on every resolution, including "keep the server
//    version". A financial correction with no reason is unauditable, and the
//    person who has to explain it later is not the person deciding now.
//
// There is deliberately no "resolve all". Each conflict is a separate question
// about what actually happened.
// ============================================

import { memo, useState } from 'react'
import type { Conflict, FieldDivergence, ResolutionChoice } from '@hisabche/api'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  ErrorNote,
  Field,
  Loading,
  Panel,
  Stat,
  StatGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../capability/capability-kit'
import { routeForEntity } from '../../../lib/entity-route'

export interface ConflictsViewProps {
  t: (key: string, fallback?: string) => string
  conflicts: Conflict[]
  status: 'open' | 'resolved' | 'all'
  selected: Conflict | null
  isLoading: boolean
  error: string | null
  actionError: string | null
  isBusy: boolean
  canResolve: boolean
  onStatusChange: (status: 'open' | 'resolved' | 'all') => void
  onSelect: (conflictId: string) => void
  /** H8 — open the record a conflict is about. */
  onOpenRecord?: ((route: string) => void) | undefined
  onResolve: (input: {
    choice: ResolutionChoice
    fieldChoices?: Record<string, 'server' | 'client'>
    reason: string
  }) => void
  onRefresh: () => void
}

/**
 * A value from either side, rendered so the two are comparable.
 *
 * Objects and arrays are stringified rather than summarised: `items` on an
 * invoice IS the disagreement, and "3 items" on both sides would read as
 * agreement when the lines differ.
 */
function renderValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value, null, 1)
  return String(value)
}

const STATUS_TABS: Array<'open' | 'resolved' | 'all'> = ['open', 'resolved', 'all']

export const ConflictsView = memo(function ConflictsView({
  t,
  conflicts,
  status,
  selected,
  isLoading,
  error,
  actionError,
  isBusy,
  canResolve,
  onStatusChange,
  onSelect,
  onResolve,
  onOpenRecord,
  onRefresh,
}: ConflictsViewProps) {
  const [choice, setChoice] = useState<ResolutionChoice>('keep_server')
  const [fieldChoices, setFieldChoices] = useState<Record<string, 'server' | 'client'>>({})
  const [reason, setReason] = useState('')

  // H8 — where the record in conflict lives, or null for a type with no
  // detail screen. Computed once per render; no hook, so no ordering concern.
  const recordRoute =
    selected?.entityType && selected?.entityId
      ? routeForEntity(selected.entityType, selected.entityId)
      : null

  const divergences = selected?.divergences ?? []
  const financialCount = divergences.filter((d) => d.financial).length

  // Every field must be decided before a merge can be applied. A merge with an
  // undecided field would silently take one side, which is the guess this
  // whole queue exists to avoid.
  const undecided =
    choice === 'merge' ? divergences.filter((d) => !fieldChoices[d.field]).length : 0

  const canSubmit =
    canResolve && !isBusy && reason.trim() !== '' && undecided === 0 && selected != null

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('conflicts.title', 'تعارض‌های آفلاین')}
        description={t('conflicts.subtitle', 'نوشته‌هایی که سرور نپذیرفت و منتظر تصمیم‌اند')}
        action={
          <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
            {t('common.refresh', 'تازه‌سازی')}
          </ActionButton>
        }
      />

      {error ? (
        <ErrorNote
          message={error}
          onRetry={onRefresh}
          retryLabel={t('common.retry', 'تلاش دوباره')}
        />
      ) : null}
      {actionError ? <ErrorNote message={actionError} /> : null}

      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <ActionButton
            key={tab}
            variant={tab === status ? 'primary' : 'quiet'}
            onClick={() => onStatusChange(tab)}
          >
            {t(`conflicts.status_${tab}`, tab)}
          </ActionButton>
        ))}
      </div>

      {isLoading ? <Loading label={t('common.loading', 'در حال بارگذاری…')} /> : null}

      {!isLoading && conflicts.length === 0 ? (
        <Panel title={t('conflicts.empty_title', 'تعارضی در انتظار نیست')}>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t(
              'conflicts.empty_hint',
              'هر نوشته‌ی آفلاینی که سرور نپذیرد اینجا می‌آید و تا تصمیم شما اعمال نمی‌شود.',
            )}
          </p>
        </Panel>
      ) : null}

      {conflicts.length > 0 ? (
        <Panel
          title={t('conflicts.queue', 'صف تعارض')}
          description={t('conflicts.queue_hint', 'هیچ‌کدام هنوز اعمال نشده‌اند.')}
        >
          <ul className="divide-y divide-[hsl(var(--border))]">
            {conflicts.map((conflict) => (
              <li key={conflict.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conflict.id)}
                  className={
                    'flex w-full flex-wrap items-center justify-between gap-2 py-3 text-start text-sm transition hover:bg-[hsl(var(--muted)/0.4)] ' +
                    (conflict.id === selected?.id ? 'bg-[hsl(var(--muted)/0.5)]' : '')
                  }
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={conflict.hasFinancialDivergence ? 'bad' : 'warn'}>
                      {t(`conflicts.entity_${conflict.entityType}`, conflict.entityType)}
                    </Badge>
                    {conflict.hasFinancialDivergence ? (
                      <Badge tone="bad">{t('conflicts.financial', 'اختلاف مالی')}</Badge>
                    ) : null}
                    <span className="text-[hsl(var(--muted-foreground))]">
                      {conflict.divergences.length} {t('conflicts.fields', 'فیلد')}
                    </span>
                  </span>

                  <span className="flex items-center gap-2">
                    {conflict.status === 'resolved' ? (
                      <Badge tone="good">{t('conflicts.resolved', 'حل‌شده')}</Badge>
                    ) : conflict.status === 'superseded' ? (
                      <Badge tone="neutral">{t('conflicts.superseded', 'منسوخ')}</Badge>
                    ) : (
                      <Badge tone="warn">{t('conflicts.open', 'باز')}</Badge>
                    )}
                    <span
                      className="tabular-nums text-xs text-[hsl(var(--muted-foreground))]"
                      dir="ltr"
                    >
                      {conflict.createdAt?.slice(0, 16).replace('T', ' ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {selected ? (
        <>
          <Panel
            title={t('conflicts.detail', 'جزئیات تعارض')}
            description={t(
              'conflicts.detail_hint',
              'هر دو نسخه نگه داشته شده‌اند. هیچ‌کدام هنوز اعمال نشده.',
            )}
            action={
              selected.hasFinancialDivergence ? (
                <Badge tone="bad">{t('conflicts.needs_review', 'نیازمند تصمیم انسان')}</Badge>
              ) : null
            }
          >
            <StatGrid>
              <Stat
                label={t('conflicts.entity', 'موجودیت')}
                value={t(`conflicts.entity_${selected.entityType}`, selected.entityType)}
                hint={selected.entityId?.slice(0, 8)}
              />
              <Stat
                label={t('conflicts.operation', 'عملیات')}
                value={t(`conflicts.op_${selected.operation}`, selected.operation)}
              />
              <Stat
                label={t('conflicts.server_version', 'نسخه‌ی سرور')}
                value={selected.serverVersion ?? '—'}
              />
              <Stat
                label={t('conflicts.client_version', 'نسخه‌ی دستگاه')}
                value={selected.clientVersion ?? '—'}
                hint={
                  financialCount > 0
                    ? `${financialCount} ${t('conflicts.financial_fields', 'فیلد مالی')}`
                    : undefined
                }
              />
            </StatGrid>

            {/* H8 — the record in conflict, openable.
                A person deciding which version wins needs to see what the row
                looks like now. `routeForEntity` returns null for a type with
                no detail screen, and then nothing is offered rather than a
                link to a list that answers a different question. */}
            {recordRoute && onOpenRecord ? (
              <button
                type="button"
                onClick={() => onOpenRecord(recordRoute)}
                className="mt-3 rounded text-sm text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
              >
                {t('conflicts.openRecord', 'مشاهده‌ی رکورد')}
              </button>
            ) : null}
          </Panel>

          <Panel
            title={t('conflicts.divergences', 'اختلاف‌ها')}
            description={t(
              'conflicts.divergences_hint',
              'فقط فیلدهایی که دستگاه فرستاده مقایسه می‌شوند.',
            )}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('conflicts.field', 'فیلد')}</TableHead>
                  <TableHead>{t('conflicts.server_value', 'نسخه‌ی سرور')}</TableHead>
                  <TableHead>{t('conflicts.client_value', 'نسخه‌ی دستگاه')}</TableHead>
                  {choice === 'merge' ? (
                    <TableHead>{t('conflicts.pick', 'انتخاب')}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {divergences.map((divergence: FieldDivergence) => (
                  <TableRow key={divergence.field}>
                    <TableCell>
                      <span className="font-mono text-xs" dir="ltr">
                        {divergence.field}
                      </span>
                      {divergence.financial ? (
                        <div className="mt-1">
                          <Badge tone="bad">{t('conflicts.financial', 'اختلاف مالی')}</Badge>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <pre
                        className="max-w-[16rem] overflow-x-auto whitespace-pre-wrap break-words text-xs"
                        dir="ltr"
                      >
                        {renderValue(divergence.serverValue)}
                      </pre>
                    </TableCell>
                    <TableCell>
                      <pre
                        className="max-w-[16rem] overflow-x-auto whitespace-pre-wrap break-words text-xs"
                        dir="ltr"
                      >
                        {renderValue(divergence.clientValue)}
                      </pre>
                    </TableCell>
                    {choice === 'merge' ? (
                      <TableCell>
                        <div className="flex gap-1">
                          {(['server', 'client'] as const).map((side) => (
                            <ActionButton
                              key={side}
                              variant={
                                fieldChoices[divergence.field] === side ? 'primary' : 'quiet'
                              }
                              disabled={isBusy}
                              onClick={() =>
                                setFieldChoices((current) => ({
                                  ...current,
                                  [divergence.field]: side,
                                }))
                              }
                            >
                              {t(`conflicts.side_${side}`, side)}
                            </ActionButton>
                          ))}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>

          {selected.status === 'open' ? (
            <Panel
              title={t('conflicts.resolve', 'تصمیم')}
              description={t(
                'conflicts.resolve_hint',
                'دلیل اجباری است — حتی برای نگه‌داشتن نسخه‌ی سرور.',
              )}
            >
              {!canResolve ? (
                <ErrorNote
                  message={t(
                    'conflicts.forbidden',
                    'حل تعارض یک رکورد مالی را بازنویسی می‌کند و تصمیم مالک است.',
                  )}
                />
              ) : null}

              <div className="flex flex-wrap gap-2">
                {(['keep_server', 'keep_client', 'merge'] as const).map((option) => (
                  <ActionButton
                    key={option}
                    variant={choice === option ? 'primary' : 'quiet'}
                    disabled={isBusy || !canResolve}
                    onClick={() => setChoice(option)}
                  >
                    {t(`conflicts.choice_${option}`, option)}
                  </ActionButton>
                ))}
              </div>

              {choice === 'merge' && undecided > 0 ? (
                <p className="mt-3 text-sm text-[hsl(var(--color-warning))]">
                  {undecided} {t('conflicts.undecided', 'فیلد هنوز انتخاب نشده')}
                </p>
              ) : null}

              <div className="mt-3">
                <Field
                  label={t('conflicts.reason', 'دلیل')}
                  value={reason}
                  onChange={setReason}
                  disabled={isBusy || !canResolve}
                />
              </div>

              <ActionButton
                className="mt-4"
                disabled={!canSubmit}
                onClick={() => {
                  onResolve({
                    choice,
                    reason: reason.trim(),
                    ...(choice === 'merge' ? { fieldChoices } : {}),
                  })
                  setReason('')
                  setFieldChoices({})
                }}
              >
                {t('conflicts.apply', 'اعمال تصمیم')}
              </ActionButton>
            </Panel>
          ) : (
            <Panel title={t('conflicts.resolution', 'تصمیم ثبت‌شده')}>
              <StatGrid>
                <Stat
                  label={t('conflicts.choice', 'انتخاب')}
                  value={t(`conflicts.choice_${selected.resolution}`, selected.resolution ?? '—')}
                />
                <Stat
                  label={t('conflicts.reason', 'دلیل')}
                  value={selected.resolutionReason ?? '—'}
                />
                <Stat
                  label={t('conflicts.resolved_by', 'توسط')}
                  value={selected.resolvedBy?.slice(0, 8) ?? '—'}
                />
                <Stat
                  label={t('conflicts.resolved_at', 'زمان')}
                  value={selected.resolvedAt?.slice(0, 16).replace('T', ' ') ?? '—'}
                />
              </StatGrid>
            </Panel>
          )}
        </>
      ) : null}
    </CapabilityPage>
  )
})

ConflictsView.displayName = 'ConflictsView'
