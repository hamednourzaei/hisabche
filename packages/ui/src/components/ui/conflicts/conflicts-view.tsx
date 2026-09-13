'use client'

// ============================================
// packages/ui/src/components/ui/conflicts/conflicts-view.tsx
//
// The offline conflict queue — one table row per conflict, on the shared
// DataTable (the same one the warehouse list uses).
//
// ---------------------------------------------------------------------------
// WHY THIS SCREEN EXISTS
//
// A device wrote while it was offline, the record had moved on underneath it,
// and the server refused rather than guessing. BOTH versions are kept and
// NEITHER is applied until a person decides.
//
// ---------------------------------------------------------------------------
// THREE RULES THIS SCREEN ENFORCES
//
// 1. Both sides are shown, always. The row carries a compact per-field
//    summary; the decision dialog shows the full side-by-side values.
//
// 2. Financial divergences are marked and cannot be resolved silently.
//
// 3. A reason is required, on every resolution, including "keep the server
//    version". Every row action opens the dialog; nothing applies from a
//    single click.
//
// There is deliberately no "resolve all" and no bulk selection.
// ============================================

import { memo, useCallback, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../capability/capability-kit'
import { DataTable, type TableColumn } from '../data-table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../dialog'
import { routeForEntity } from '../../../lib/entity-route'
import { useDateFormat } from '../../../hooks/use-date-format'

type Translate = (key: string, fallback?: string) => string

export interface ConflictsViewProps {
  t: Translate
  conflicts: Conflict[]
  status: 'open' | 'resolved' | 'all'
  selected: Conflict | null
  isLoading: boolean
  error: string | null
  actionError: string | null
  isBusy: boolean
  canResolve: boolean
  onStatusChange: (status: 'open' | 'resolved' | 'all') => void
  /** Open (id) or close (null) the decision dialog. */
  onSelect: (conflictId: string | null) => void
  /** H8 — open the record a conflict is about. */
  onOpenRecord?: ((route: string) => void) | undefined
  onResolve: (input: {
    choice: ResolutionChoice
    fieldChoices?: Record<string, 'server' | 'client'>
    reason: string
  }) => void
  onRefresh: () => void
}

/** Operations and fields that have a plain-language label in every locale. */
const KNOWN_OPERATIONS = new Set(['create', 'update', 'delete', 'negative_stock'])
const KNOWN_FIELDS = new Set([
  'quantity',
  'shortfall',
  'buy_price',
  'sell_price',
  'opening_balance',
  'total',
  'subtotal',
  'discount_total',
  'tax_total',
  'paid_amount',
  'currency',
  'type',
  'customer_id',
  'supplier_id',
  'status',
  'date',
  'items',
  'amount',
  'direction',
  'party_id',
  'party_type',
  'entry_date',
  'lines',
  'entry_number',
])

function operationLabel(t: Translate, operation: string): string {
  return KNOWN_OPERATIONS.has(operation) ? t(`conflicts.op_${operation}`) : operation
}

function fieldLabel(t: Translate, field: string): string {
  return KNOWN_FIELDS.has(field) ? t(`conflicts.field_${field}`) : field
}

/**
 * A value from either side. A missing value is said in words — a bare dash
 * reads as "zero" or "broken" to a person.
 *
 * Objects and arrays are stringified rather than summarised: `items` on an
 * invoice IS the disagreement, and "3 items" on both sides would read as
 * agreement when the lines differ.
 */
function renderValue(t: Translate, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return t('conflicts.not_recorded')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function StatusBadge({ t, status }: { t: Translate; status: Conflict['status'] }) {
  if (status === 'resolved') return <Badge tone="good">{t('conflicts.resolved')}</Badge>
  if (status === 'superseded') return <Badge tone="neutral">{t('conflicts.superseded')}</Badge>
  return <Badge tone="warn">{t('conflicts.open')}</Badge>
}

function DifferenceSummary({ t, divergences }: { t: Translate; divergences: FieldDivergence[] }) {
  if (divergences.length === 0) {
    return <span className="text-[hsl(var(--fg-tertiary))]">{t('conflicts.no_difference')}</span>
  }
  return (
    <ul className="space-y-0.5 text-xs">
      {divergences.map((d) => (
        <li key={d.field} className="whitespace-normal">
          <span className="font-medium text-[hsl(var(--fg-primary))]">
            {fieldLabel(t, d.field)}
          </span>
          {': '}
          <span className="text-[hsl(var(--fg-secondary))]">{t('conflicts.side_server')} </span>
          <bdi dir="ltr" className="tabular-nums">
            {renderValue(t, d.serverValue)}
          </bdi>
          <span className="text-[hsl(var(--fg-tertiary))]"> / </span>
          <span className="text-[hsl(var(--fg-secondary))]">{t('conflicts.side_client')} </span>
          <bdi dir="ltr" className="tabular-nums">
            {renderValue(t, d.clientValue)}
          </bdi>
        </li>
      ))}
    </ul>
  )
}

const STATUS_TABS: Array<'open' | 'resolved' | 'all'> = ['open', 'resolved', 'all']
const CHOICES = ['keep_server', 'keep_client', 'merge'] as const

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
  const { dateTime } = useDateFormat()
  const [search, setSearch] = useState('')
  const [choice, setChoice] = useState<ResolutionChoice>('keep_server')
  const [fieldChoices, setFieldChoices] = useState<Record<string, 'server' | 'client'>>({})
  const [reason, setReason] = useState('')

  // Every row action lands here: nothing is applied without the dialog, and
  // the dialog cannot apply without a reason.
  const openDialog = useCallback(
    (conflictId: string, next: ResolutionChoice) => {
      setChoice(next)
      setFieldChoices({})
      setReason('')
      onSelect(conflictId)
    },
    [onSelect],
  )

  const columns = useMemo<TableColumn<Conflict>[]>(
    () => [
      {
        id: 'what',
        labelKey: 'conflicts.col_what',
        labelFallback: 'چه چیزی',
        locked: true,
        sortValue: (c) => c.entityLabel ?? c.entityId,
        render: (c) => {
          const route = c.entityId ? routeForEntity(c.entityType, c.entityId) : null
          const name = c.entityLabel ?? t('conflicts.unnamed_record')
          return (
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t(`conflicts.entity_${c.entityType}`)}
              </span>
              {route && onOpenRecord ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenRecord(route)
                  }}
                  className="inline-flex items-center gap-1 rounded font-medium text-[hsl(var(--color-primary))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
                  title={t('conflicts.openRecord')}
                >
                  {name}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </button>
              ) : (
                <span className="font-medium text-[hsl(var(--fg-primary))]">{name}</span>
              )}
            </div>
          )
        },
      },
      {
        id: 'happened',
        labelKey: 'conflicts.col_happened',
        labelFallback: 'چه شد',
        sortValue: (c) => c.operation,
        render: (c) => (
          <span className="text-[hsl(var(--fg-secondary))]">{operationLabel(t, c.operation)}</span>
        ),
      },
      {
        id: 'difference',
        labelKey: 'conflicts.col_difference',
        labelFallback: 'اختلاف',
        showFrom: 'md',
        render: (c) => <DifferenceSummary t={t} divergences={c.divergences} />,
      },
      {
        id: 'severity',
        labelKey: 'conflicts.col_severity',
        labelFallback: 'اهمیت',
        showFrom: 'sm',
        sortValue: (c) => (c.hasFinancialDivergence ? 1 : 0),
        render: (c) =>
          c.hasFinancialDivergence ? (
            <Badge tone="bad">{t('conflicts.financial')}</Badge>
          ) : (
            <Badge tone="neutral">{t('conflicts.non_financial')}</Badge>
          ),
      },
      {
        id: 'status',
        labelKey: 'conflicts.col_status',
        labelFallback: 'وضعیت',
        sortValue: (c) => c.status,
        render: (c) => <StatusBadge t={t} status={c.status} />,
      },
      {
        id: 'time',
        labelKey: 'conflicts.col_time',
        labelFallback: 'زمان',
        showFrom: 'lg',
        sortValue: (c) => c.createdAt,
        render: (c) => (
          <span className="tabular-nums text-xs text-[hsl(var(--fg-tertiary))]">
            {dateTime(c.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        labelKey: 'conflicts.col_actions',
        labelFallback: 'تصمیم',
        locked: true,
        align: 'end',
        render: (c) =>
          c.status === 'open' ? (
            <div className="inline-flex flex-wrap justify-end gap-1">
              {CHOICES.map((option) => (
                <ActionButton
                  key={option}
                  variant="quiet"
                  className="h-8 px-2 text-xs"
                  disabled={!canResolve || isBusy}
                  onClick={(event) => {
                    event.stopPropagation()
                    openDialog(c.id, option)
                  }}
                >
                  {t(`conflicts.choice_${option}`)}
                </ActionButton>
              ))}
            </div>
          ) : (
            <ActionButton
              variant="quiet"
              className="h-8 px-2 text-xs"
              onClick={(event) => {
                event.stopPropagation()
                onSelect(c.id)
              }}
            >
              {t('conflicts.view_decision')}
            </ActionButton>
          ),
      },
    ],
    [t, onOpenRecord, dateTime, canResolve, isBusy, onSelect, openDialog],
  )

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return conflicts
    return conflicts.filter((c) =>
      [
        c.entityLabel ?? '',
        t(`conflicts.entity_${c.entityType}`),
        operationLabel(t, c.operation),
        ...c.divergences.map((d) => fieldLabel(t, d.field)),
      ].some((text) => text.toLowerCase().includes(needle)),
    )
  }, [conflicts, search, t])

  const divergences = selected?.divergences ?? []

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
        title={t('conflicts.title')}
        description={t('conflicts.subtitle')}
        action={
          <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
            {t('common.refresh')}
          </ActionButton>
        }
      />

      {actionError && !selected ? <ErrorNote message={actionError} /> : null}

      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <ActionButton
            key={tab}
            variant={tab === status ? 'primary' : 'quiet'}
            onClick={() => onStatusChange(tab)}
          >
            {t(`conflicts.status_${tab}`)}
          </ActionButton>
        ))}
      </div>

      {error ? (
        <ErrorNote message={error} onRetry={onRefresh} retryLabel={t('common.retry')} />
      ) : isLoading ? (
        <Loading label={t('common.loading')} />
      ) : (
        <DataTable
          tableId="offline-conflicts"
          t={t}
          rows={rows}
          columns={columns}
          rowKey={(c) => c.id}
          onRowClick={(c) => openDialog(c.id, 'keep_server')}
          searchValue={search}
          onSearchChange={setSearch}
          minWidthClass="min-w-[520px] sm:min-w-[760px]"
          emptyState={
            <Panel title={t('conflicts.empty_title')}>
              <p className="text-sm text-[hsl(var(--fg-tertiary))]">{t('conflicts.empty_hint')}</p>
            </Panel>
          }
        />
      )}

      <Dialog
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) onSelect(null)
        }}
      >
        {selected ? (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {t(`conflicts.entity_${selected.entityType}`)} —{' '}
                {selected.entityLabel ?? t('conflicts.unnamed_record')}
              </DialogTitle>
              <DialogDescription>
                {operationLabel(t, selected.operation)} · {t('conflicts.detail_hint')}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('conflicts.field')}</TableHead>
                      <TableHead>{t('conflicts.server_value')}</TableHead>
                      <TableHead>{t('conflicts.client_value')}</TableHead>
                      {selected.status === 'open' && choice === 'merge' ? (
                        <TableHead>{t('conflicts.pick')}</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {divergences.map((d) => (
                      <TableRow key={d.field}>
                        <TableCell>
                          <span className="font-medium">{fieldLabel(t, d.field)}</span>
                          {d.financial ? (
                            <div className="mt-1">
                              <Badge tone="bad">{t('conflicts.financial')}</Badge>
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <pre
                            className="max-w-[14rem] whitespace-pre-wrap break-words text-xs"
                            dir="ltr"
                          >
                            {renderValue(t, d.serverValue)}
                          </pre>
                        </TableCell>
                        <TableCell>
                          <pre
                            className="max-w-[14rem] whitespace-pre-wrap break-words text-xs"
                            dir="ltr"
                          >
                            {renderValue(t, d.clientValue)}
                          </pre>
                        </TableCell>
                        {selected.status === 'open' && choice === 'merge' ? (
                          <TableCell>
                            <div className="flex gap-1">
                              {(['server', 'client'] as const).map((side) => (
                                <ActionButton
                                  key={side}
                                  variant={fieldChoices[d.field] === side ? 'primary' : 'quiet'}
                                  className="h-8 px-2 text-xs"
                                  disabled={isBusy}
                                  onClick={() =>
                                    setFieldChoices((current) => ({ ...current, [d.field]: side }))
                                  }
                                >
                                  {t(`conflicts.side_${side}`)}
                                </ActionButton>
                              ))}
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selected.status === 'open' ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {CHOICES.map((option) => (
                      <ActionButton
                        key={option}
                        variant={choice === option ? 'primary' : 'quiet'}
                        disabled={isBusy || !canResolve}
                        onClick={() => setChoice(option)}
                      >
                        {t(`conflicts.choice_${option}`)}
                      </ActionButton>
                    ))}
                  </div>

                  {choice === 'merge' && undecided > 0 ? (
                    <p className="text-sm text-[hsl(var(--color-warning))]">
                      {undecided} {t('conflicts.undecided')}
                    </p>
                  ) : null}

                  <div>
                    <Field
                      label={t('conflicts.reason')}
                      value={reason}
                      onChange={setReason}
                      disabled={isBusy || !canResolve}
                    />
                    <p className="mt-1 text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('conflicts.resolve_hint')}
                    </p>
                  </div>

                  {actionError ? <ErrorNote message={actionError} /> : null}

                  <div className="flex justify-end gap-2">
                    <ActionButton variant="quiet" onClick={() => onSelect(null)} disabled={isBusy}>
                      {t('common.cancel')}
                    </ActionButton>
                    <ActionButton
                      disabled={!canSubmit}
                      onClick={() =>
                        onResolve({
                          choice,
                          reason: reason.trim(),
                          ...(choice === 'merge' ? { fieldChoices } : {}),
                        })
                      }
                    >
                      {t('conflicts.apply')}
                    </ActionButton>
                  </div>
                </>
              ) : (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('conflicts.choice')}
                    </dt>
                    <dd>
                      {selected.resolution &&
                      (CHOICES as readonly string[]).includes(selected.resolution)
                        ? t(`conflicts.choice_${selected.resolution}`)
                        : (selected.resolution ?? t('conflicts.not_recorded'))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('conflicts.reason')}
                    </dt>
                    <dd>{selected.resolutionReason ?? t('conflicts.not_recorded')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('conflicts.resolved_by')}
                    </dt>
                    <dd dir="ltr" className="text-start">
                      {selected.resolvedBy?.slice(0, 8) ?? t('conflicts.not_recorded')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('conflicts.resolved_at')}
                    </dt>
                    <dd className="tabular-nums">
                      {selected.resolvedAt
                        ? dateTime(selected.resolvedAt)
                        : t('conflicts.not_recorded')}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </CapabilityPage>
  )
})

ConflictsView.displayName = 'ConflictsView'
