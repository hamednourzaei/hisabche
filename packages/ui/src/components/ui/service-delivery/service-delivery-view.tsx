'use client'

// ============================================
// «جلسات خدمت» — the tab itself: the list, its filters and its counts.
//
// ⚠️ ONE TABLE, THE SHARED ONE. `DataTable` brings search, sorting, column
// settings, the pager and the card layout under 768px; this file names the
// columns and nothing else.
//
// ⚠️ COUNTS ARE LABELLED BY SOURCE. «در صف ارسال» is a DEVICE count (the
// outbox); «تأییدشده» is the server's. A summary that added them would tell a
// shopkeeper the server has accepted work it has never seen.
//
// ⚠️ A ROW WITH NO SYNC ANSWER SAYS «نامعلوم». The browser has no outbox: it
// cannot know, and a green tick there would be a promise nobody made.
//
// ⚠️ NO CANCELLATION REASON COLUMN. Neither SQLite nor PostgreSQL keeps one
// (M4 audit, prompt corrections §2), so there is nothing to show — not an
// empty column, and not a reason this screen invents.
// ============================================

import { memo } from 'react'
import { CalendarClock, CircleSlash, CloudOff, Plus, RefreshCw, TriangleAlert } from 'lucide-react'

import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  ErrorNote,
  Loading,
} from '../capability/capability-kit'
import { DataTable } from '../data-table/data-table'
import type { TableColumn } from '../data-table/table-types'
import { TableFilterMenu } from '../data-table/table-filter-menu'
import type { EntitySyncState } from '@hisabche/api'
import {
  cancellable,
  type ServiceSessionRow,
  type ServiceSessionSummary,
} from './service-delivery-model'

export type Translate = (key: string, fallback?: string) => string

const STATUS_TONE: Record<string, string> = {
  scheduled: 'info',
  in_progress: 'info',
  delivered: 'good',
  cancelled: 'neutral',
  no_show: 'warn',
}

const SYNC_TONE: Record<EntitySyncState, string> = {
  pending: 'warn',
  confirmed: 'good',
  rejected: 'bad',
  attention: 'bad',
}

/**
 * One session's sync state, as a badge.
 *
 * A refusal carries the server's CODE (never its sentence) and, when known,
 * the row says what happened. Retrying is the sync centre's job: this screen
 * can re-queue nothing, and a delivery the server refused is not silently sent
 * again with a different settlement.
 */
export const SessionSyncBadge = memo(function SessionSyncBadge({
  state,
  code,
  t,
}: {
  state: EntitySyncState | null
  code: string | null
  t: Translate
}) {
  if (!state) {
    return (
      <Badge tone="neutral">
        <CloudOff aria-hidden="true" className="me-1 inline size-3" />
        {t('serviceDelivery.sync.unknown', 'نامعلوم')}
      </Badge>
    )
  }

  const label =
    state === 'pending'
      ? t('serviceDelivery.sync.pending', 'در صف ارسال')
      : state === 'rejected'
        ? t('serviceDelivery.sync.rejected', 'سرور رد کرد')
        : state === 'attention'
          ? t('serviceDelivery.sync.attention', 'نیاز به بررسی')
          : t('serviceDelivery.sync.confirmed', 'تأییدشده توسط سرور')

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge tone={SYNC_TONE[state]}>
        {state === 'rejected' || state === 'attention' ? (
          <CircleSlash aria-hidden="true" className="me-1 inline size-3" />
        ) : null}
        {label}
      </Badge>
      {code ? (
        <span dir="ltr" className="text-[10px] tabular-nums text-[hsl(var(--fg-tertiary))]">
          {code}
        </span>
      ) : null}
    </span>
  )
})

function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2">
      <dt className="text-xs text-[hsl(var(--fg-secondary))]">{label}</dt>
      <dd className="text-lg font-bold tabular-nums text-[hsl(var(--fg-primary))]">{value}</dd>
    </div>
  )
}

export interface ServiceDeliveryViewProps {
  t: Translate
  rows: readonly ServiceSessionRow[]
  /** Counted over the unfiltered rows, so a count is never «the page that is showing». */
  summary: ServiceSessionSummary
  /** How many of the UNFILTERED rows fall on today — the one card that can be acted on. */
  today: number
  isLoading: boolean
  error: string | null
  onRetry: () => void
  search: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  dateFilter: string
  onDateFilterChange: (value: string) => void
  hasBranches: boolean
  mayWrite: boolean
  mayCancel: boolean
  onCreate: () => void
  onDeliver: (row: ServiceSessionRow) => void
  onCancel: (row: ServiceSessionRow) => void
  onOpen: (row: ServiceSessionRow) => void
  /**
   * «حاضر شد» / «نیامد» on a booked session. Optional: a host that cannot
   * move a status offers no button rather than one that fails.
   */
  onMoveStatus?: ((row: ServiceSessionRow, to: 'in_progress' | 'no_show') => void) | undefined
  /** The row whose move is on its way — its buttons wait. */
  movingId?: string | null | undefined
  /** Only from a host with an outbox: the link to the page that can re-queue. */
  onOpenSyncCentre?: (() => void) | undefined
}

export function ServiceDeliveryView({
  t,
  rows,
  summary,
  today,
  isLoading,
  error,
  onRetry,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  dateFilter,
  onDateFilterChange,
  hasBranches,
  mayWrite,
  mayCancel,
  onCreate,
  onDeliver,
  onCancel,
  onOpen,
  onMoveStatus,
  movingId,
  onOpenSyncCentre,
}: ServiceDeliveryViewProps) {
  const statusOptions = [
    { value: 'all', label: t('serviceDelivery.filters.allStatuses', 'همه‌ی وضعیت‌ها') },
    ...(['scheduled', 'in_progress', 'delivered', 'cancelled', 'no_show'] as const).map(
      (status) => ({
        value: status,
        label: t(`serviceDelivery.status.${status}`, status),
      }),
    ),
  ]

  const dateOptions = [
    { value: 'all', label: t('serviceDelivery.filters.allDates', 'همه‌ی تاریخ‌ها') },
    { value: 'today', label: t('serviceDelivery.filters.today', 'امروز') },
    { value: 'upcoming', label: t('serviceDelivery.filters.upcoming', 'پیش‌رو') },
    { value: 'past', label: t('serviceDelivery.filters.past', 'گذشته') },
  ]

  const branchColumn: TableColumn<ServiceSessionRow>[] = hasBranches
    ? [
        {
          id: 'branch',
          labelKey: 'serviceDelivery.columns.branch',
          labelFallback: 'شعبه',
          showFrom: 'lg',
          render: (row) => row.branchName ?? t('serviceDelivery.noBranch', 'بدون شعبه'),
          sortValue: (row) => row.branchName ?? '',
        },
      ]
    : []

  const columns: TableColumn<ServiceSessionRow>[] = [
    {
      id: 'customer',
      labelKey: 'serviceDelivery.columns.customer',
      labelFallback: 'مشتری',
      locked: true,
      render: (row) => (
        <span className="font-medium">
          {row.customerName ?? t('serviceDelivery.unknown.customer', 'نام مشتری خوانده نشد')}
        </span>
      ),
      sortValue: (row) => row.customerName ?? '',
    },
    {
      id: 'service',
      labelKey: 'serviceDelivery.columns.service',
      labelFallback: 'خدمت',
      showFrom: 'sm',
      render: (row) =>
        row.serviceName ?? t('serviceDelivery.unknown.service', 'نام خدمت خوانده نشد'),
      sortValue: (row) => row.serviceName ?? '',
    },
    {
      id: 'practitioner',
      labelKey: 'serviceDelivery.columns.practitioner',
      labelFallback: 'مجری',
      showFrom: 'lg',
      render: (row) => row.practitionerName ?? t('serviceDelivery.noPractitioner', 'بدون مجری'),
      sortValue: (row) => row.practitionerName ?? '',
    },
    {
      id: 'when',
      labelKey: 'serviceDelivery.columns.date',
      labelFallback: 'تاریخ و ساعت',
      render: (row) => (
        <span dir="ltr" className="tabular-nums">
          {row.sessionDate} · {row.startTime}–{row.endTime}
        </span>
      ),
      sortValue: (row) => `${row.sessionDate} ${row.startTime}`,
    },
    {
      id: 'duration',
      labelKey: 'serviceDelivery.columns.duration',
      labelFallback: 'مدت (دقیقه)',
      showFrom: 'md',
      render: (row) => (
        <span dir="ltr" className="tabular-nums">
          {row.durationMinutes}
        </span>
      ),
      sortValue: (row) => row.durationMinutes,
    },
    {
      id: 'status',
      labelKey: 'serviceDelivery.columns.status',
      labelFallback: 'وضعیت',
      render: (row) => (
        <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>
          {t(`serviceDelivery.status.${row.status}`, row.status)}
        </Badge>
      ),
      sortValue: (row) => row.status,
    },
    {
      id: 'settlement',
      labelKey: 'serviceDelivery.columns.settlement',
      labelFallback: 'تسویه',
      showFrom: 'md',
      render: (row) =>
        t(`serviceDelivery.settlement.${row.settlementMethod}`, row.settlementMethod),
      sortValue: (row) => row.settlementMethod,
    },
    {
      id: 'sync',
      labelKey: 'serviceDelivery.columns.sync',
      labelFallback: 'ارسال به سرور',
      render: (row) => <SessionSyncBadge state={row.sync} code={row.syncCode} t={t} />,
      sortValue: (row) => row.sync ?? '',
    },
    ...branchColumn,
    {
      id: 'actions',
      labelKey: 'serviceDelivery.columns.actions',
      labelFallback: 'اقدام',
      locked: true,
      render: (row) => {
        const deliverable = row.status === 'scheduled' || row.status === 'in_progress'
        return (
          <span className="flex flex-wrap items-center gap-1">
            <ActionButton variant="quiet" onClick={() => onOpen(row)}>
              {t('serviceDelivery.actions.details', 'جزئیات')}
            </ActionButton>
            {mayWrite && onMoveStatus && row.status === 'scheduled' ? (
              <>
                <ActionButton
                  disabled={movingId === row.id}
                  onClick={() => onMoveStatus(row, 'in_progress')}
                >
                  {t('serviceDelivery.actions.checkIn', 'حاضر شد')}
                </ActionButton>
                <ActionButton
                  variant="quiet"
                  disabled={movingId === row.id}
                  onClick={() => onMoveStatus(row, 'no_show')}
                >
                  {t('serviceDelivery.actions.noShow', 'نیامد')}
                </ActionButton>
              </>
            ) : null}
            {mayWrite && deliverable ? (
              <ActionButton onClick={() => onDeliver(row)}>
                {t('serviceDelivery.actions.deliver', 'تحویل خدمت')}
              </ActionButton>
            ) : null}
            {mayCancel && cancellable(row.status) ? (
              <ActionButton variant="danger" onClick={() => onCancel(row)}>
                {t('serviceDelivery.actions.cancel', 'لغو جلسه')}
              </ActionButton>
            ) : null}
          </span>
        )
      },
    },
  ]

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('serviceDelivery.title', 'جلسات خدمت')}
        description={t(
          'serviceDelivery.subtitle',
          'هر جلسه یک خدمت است که به یک مشتری داده می‌شود؛ تحویل، تسویه و لغو از همین‌جا',
        )}
        action={
          <>
            <ActionButton variant="quiet" onClick={onRetry} disabled={isLoading}>
              <RefreshCw aria-hidden="true" className="me-1 inline size-4" />
              {t('serviceDelivery.actions.refresh', 'به‌روزرسانی')}
            </ActionButton>
            {mayWrite ? (
              <ActionButton onClick={onCreate}>
                <Plus aria-hidden="true" className="me-1 inline size-4" />
                {t('serviceDelivery.newSession', 'جلسه‌ی جدید')}
              </ActionButton>
            ) : null}
          </>
        }
      />

      <section aria-label={t('serviceDelivery.summary.title', 'خلاصه')}>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryCell
            label={t('serviceDelivery.summary.scheduled', 'زمان‌بندی‌شده')}
            value={summary.scheduled}
          />
          <SummaryCell label={t('serviceDelivery.summary.today', 'امروز')} value={today} />
          <SummaryCell
            label={t('serviceDelivery.summary.delivered', 'تحویل‌شده')}
            value={summary.delivered}
          />
          <SummaryCell
            label={t('serviceDelivery.summary.cancelled', 'لغوشده')}
            value={summary.cancelled}
          />
        </dl>
        {/* The two DEVICE counts do not deserve cards — they are not work. They
            stay on one line that says so, in small type. */}
        {summary.awaitingSync > 0 ? (
          <p className="mt-2 text-xs text-[hsl(var(--fg-secondary))]">
            {t('serviceDelivery.summary.awaiting', 'در صف ارسال (این دستگاه)')}:{' '}
            <span dir="ltr" className="tabular-nums">
              {summary.awaitingSync}
            </span>
          </p>
        ) : null}
        {summary.rejected > 0 && onOpenSyncCentre ? (
          <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-[hsl(var(--color-destructive))]">
            <TriangleAlert aria-hidden="true" className="inline size-3" />
            {t(
              'serviceDelivery.sync.rejectedHint',
              'تغییرهایی که سرور رد کرده تا کسی بررسی نکند دوباره فرستاده نمی‌شوند.',
            )}{' '}
            <button
              type="button"
              onClick={onOpenSyncCentre}
              className="underline underline-offset-2"
            >
              {t('serviceDelivery.sync.openSync', 'مرکز همگام‌سازی')}
            </button>
          </p>
        ) : null}
      </section>

      {error ? (
        <ErrorNote
          message={error}
          onRetry={onRetry}
          retryLabel={t('serviceDelivery.actions.retry', 'تلاش دوباره')}
        />
      ) : isLoading ? (
        <Loading label={t('serviceDelivery.loading', 'در حال بارگذاری…')} />
      ) : (
        <>
          <DataTable<ServiceSessionRow>
            tableId="service-delivery-sessions"
            t={t}
            rows={rows}
            columns={columns}
            rowKey={(row) => row.id}
            onRowClick={onOpen}
            searchValue={search}
            onSearchChange={onSearchChange}
            // One «فیلتر» for status and date, in the table's own toolbar beside
            // search and column settings (owner request, 9 Nov 2026).
            actions={
              <TableFilterMenu
                label={t('common.filter')}
                clearLabel={t('serviceDelivery.filters.clear')}
                groups={[
                  {
                    id: 'status',
                    label: t('serviceDelivery.filters.status'),
                    value: statusFilter,
                    options: statusOptions,
                    onChange: onStatusFilterChange,
                  },
                  {
                    id: 'date',
                    label: t('serviceDelivery.filters.date'),
                    value: dateFilter,
                    options: dateOptions,
                    onChange: onDateFilterChange,
                  },
                ]}
              />
            }
            cardTone={(row) =>
              row.sync === 'rejected' || row.sync === 'attention'
                ? 'destructive'
                : row.status === 'no_show'
                  ? 'warning'
                  : undefined
            }
            cardOrder={['customer', 'when', 'status', 'sync']}
            emptyState={
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <CalendarClock
                  aria-hidden="true"
                  className="size-8 text-[hsl(var(--fg-tertiary))]"
                />
                <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">
                  {t('serviceDelivery.empty', 'هنوز جلسه‌ای ثبت نشده است')}
                </p>
                <p className="max-w-md text-xs text-[hsl(var(--fg-secondary))]">
                  {t(
                    'serviceDelivery.emptyHint',
                    '«جلسه‌ی جدید» را بزنید تا اولین خدمت زمان‌بندی شود.',
                  )}
                </p>
              </div>
            }
          />
        </>
      )}
    </CapabilityPage>
  )
}
