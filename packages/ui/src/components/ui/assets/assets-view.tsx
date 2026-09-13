'use client'

// ============================================
// packages/ui/src/components/ui/assets/assets-view.tsx
//
// Fixed assets and their depreciation.
//
// ---------------------------------------------------------------------------
// THE SCHEDULE IS SHOWN WHOLE
//
// Every period, dated, with the ones already posted marked. Not "monthly
// depreciation: 4,166" — a formula tells a shopkeeper nothing about the two
// months they were closed and never posted, and those two months are exactly
// what a late run has to recover.
//
// `skipped` from a run is shown as loudly as `posted`. An asset with no
// expense account configured simply never depreciates, and silence about it is
// how a year of depreciation goes missing without anybody noticing.
//
// ---------------------------------------------------------------------------
// LAYOUT — the invoices list structure: header with the primary action,
// status filter, stat strip, the register on the shared DataTable (a row
// opens its schedule), then the selected asset's schedule on a second one.
// ============================================

import { memo, useMemo, useState } from 'react'
import { Archive, Building2, CheckCircle2, Landmark } from 'lucide-react'
import type { FixedAsset, ScheduleRow, DepreciationRunResult } from '@hisabche/api'
import { useDateFormat } from '../../../hooks/use-date-format'
import { DataTable, matchesSearch, type TableColumn } from '../data-table'
import { SegmentedFilter } from '../segmented-filter'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  ListSection,
  Loading,
  Money,
  Panel,
  Stat,
  StatGrid,
} from '../capability/capability-kit'

export interface AssetsViewProps {
  t: (key: string, fallback?: string) => string
  assets: FixedAsset[]
  selectedId: string | null
  schedule: ScheduleRow[]
  isLoading: boolean
  isScheduleLoading: boolean
  /** A failed schedule read must not render as a schedule with no periods. */
  scheduleError: string | null
  error: string | null
  actionError: string | null
  isBusy: boolean
  lastRun: DepreciationRunResult | null
  onSelect: (assetId: string) => void
  onRunDepreciation: () => void
  onRefresh: () => void
}

type DisposalFilter = 'all' | 'active' | 'disposed'

export const AssetsView = memo(function AssetsView({
  t,
  assets,
  selectedId,
  schedule,
  isLoading,
  isScheduleLoading,
  scheduleError,
  error,
  actionError,
  isBusy,
  lastRun,
  onSelect,
  onRunDepreciation,
  onRefresh,
}: AssetsViewProps) {
  const { date } = useDateFormat()
  const [filter, setFilter] = useState<DisposalFilter>('all')
  const [search, setSearch] = useState('')
  const [scheduleSearch, setScheduleSearch] = useState('')

  const selected = assets.find((asset) => asset.id === selectedId) ?? null

  // Book value comes from the last posted row, not from a fresh calculation:
  // the books are what the ledger holds, not what the schedule predicts.
  const posted = schedule.filter((row) => row.posted_at != null)
  const lastPosted = posted[posted.length - 1]

  const activeAssets = assets.filter((asset) => !asset.disposedOn)
  const activeCostMinor = activeAssets.reduce((sum, asset) => sum + asset.costMinor, 0)

  const rows = useMemo(
    () =>
      assets
        .filter((asset) =>
          filter === 'all' ? true : filter === 'active' ? !asset.disposedOn : !!asset.disposedOn,
        )
        .filter((asset) =>
          matchesSearch(search, [asset.name, t(`assets.method_${asset.method}`, asset.method)]),
        ),
    [assets, filter, search, t],
  )

  const scheduleRows = useMemo(
    () =>
      schedule.filter((row) =>
        matchesSearch(scheduleSearch, [row.period, row.on_date ? date(row.on_date) : null]),
      ),
    [date, schedule, scheduleSearch],
  )

  const columns = useMemo<TableColumn<FixedAsset>[]>(
    () => [
      {
        id: 'name',
        labelKey: 'assets.name',
        labelFallback: 'نام',
        locked: true,
        sortValue: (asset) => asset.name,
        render: (asset) => (
          <span
            className={
              asset.id === selectedId
                ? 'font-semibold text-[hsl(var(--color-primary))]'
                : 'font-medium text-[hsl(var(--fg-primary))]'
            }
          >
            {asset.name}
          </span>
        ),
      },
      {
        id: 'cost',
        labelKey: 'assets.cost',
        labelFallback: 'بهای تمام‌شده',
        align: 'end',
        sortValue: (asset) => asset.costMinor,
        render: (asset) => <Money minor={asset.costMinor} />,
      },
      {
        id: 'method',
        labelKey: 'assets.method',
        labelFallback: 'روش',
        showFrom: 'md',
        sortValue: (asset) => asset.method,
        render: (asset) => (
          <span className="text-[hsl(var(--fg-secondary))]">
            {t(`assets.method_${asset.method}`, asset.method)}
          </span>
        ),
      },
      {
        id: 'periods',
        labelKey: 'assets.periods',
        labelFallback: 'دوره‌ها',
        align: 'end',
        showFrom: 'md',
        sortValue: (asset) => asset.periods,
        render: (asset) => <span className="tabular-nums">{asset.periods}</span>,
      },
      {
        id: 'status',
        labelKey: 'common.status',
        labelFallback: 'وضعیت',
        sortValue: (asset) => (asset.disposedOn ? 0 : 1),
        render: (asset) =>
          asset.disposedOn ? (
            <Badge tone="neutral">{t('assets.disposed', 'واگذارشده')}</Badge>
          ) : (
            <Badge tone="good">{t('assets.active', 'فعال')}</Badge>
          ),
      },
    ],
    [selectedId, t],
  )

  const scheduleColumns = useMemo<TableColumn<ScheduleRow>[]>(
    () => [
      {
        id: 'period',
        labelKey: 'assets.period',
        labelFallback: 'دوره',
        locked: true,
        sortValue: (row) => row.period,
        render: (row) => <span className="tabular-nums">{row.period}</span>,
      },
      {
        id: 'date',
        labelKey: 'common.date',
        labelFallback: 'تاریخ',
        sortValue: (row) => row.on_date,
        render: (row) => (
          <span className="text-[hsl(var(--fg-secondary))]">
            {row.on_date ? date(row.on_date) : '—'}
          </span>
        ),
      },
      {
        id: 'amount',
        labelKey: 'assets.amount',
        labelFallback: 'مبلغ',
        align: 'end',
        sortValue: (row) => row.amount_minor,
        render: (row) => <Money minor={row.amount_minor} />,
      },
      {
        id: 'bookValue',
        labelKey: 'assets.book_value',
        labelFallback: 'ارزش دفتری',
        align: 'end',
        showFrom: 'md',
        sortValue: (row) => row.book_value_minor,
        render: (row) => <Money minor={row.book_value_minor} tone="muted" />,
      },
      {
        id: 'status',
        labelKey: 'common.status',
        labelFallback: 'وضعیت',
        render: (row) =>
          row.cancelled_at ? (
            <Badge tone="neutral">{t('assets.cancelled', 'لغوشده')}</Badge>
          ) : row.posted_at ? (
            <Badge tone="good">{t('assets.posted', 'ثبت‌شده')}</Badge>
          ) : (
            <Badge tone="warn">{t('assets.pending', 'در انتظار')}</Badge>
          ),
      },
    ],
    [date, t],
  )

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('assets.title', 'دارایی‌های ثابت')}
        description={t('assets.subtitle', 'استهلاک، دفتر دارایی و واگذاری')}
        action={
          <>
            <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
              {t('common.refresh', 'تازه‌سازی')}
            </ActionButton>
            <ActionButton onClick={onRunDepreciation} disabled={isBusy}>
              {t('assets.run_depreciation', 'اجرای استهلاک')}
            </ActionButton>
          </>
        }
      />

      {actionError ? <ErrorNote message={actionError} /> : null}

      {lastRun ? (
        <Panel
          title={t('assets.run_result', 'نتیجه‌ی اجرا')}
          description={t('assets.run_hint', 'اجرای دوباره چیزی ثبت نمی‌کند — هر دوره یک بار.')}
        >
          <p className="text-sm">
            {t('assets.posted_count', 'ثبت‌شده')}: {lastRun.posted.length}
          </p>
          {lastRun.skipped.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-[hsl(var(--color-warning))]">
              {lastRun.skipped.map((item, index) => (
                <li key={`${item.assetId}-${item.period}-${index}`}>
                  {t('assets.period', 'دوره')} {item.period} — {item.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : null}

      <SegmentedFilter
        label={t('common.status', 'وضعیت')}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('common.all', 'همه') },
          { value: 'active', label: t('assets.active', 'فعال') },
          { value: 'disposed', label: t('assets.disposed', 'واگذارشده') },
        ]}
      />

      {!isLoading && !error && assets.length > 0 ? (
        <StatGrid>
          <Stat
            icon={Building2}
            label={t('assets.stat_total', 'تعداد دارایی‌ها')}
            value={assets.length}
          />
          <Stat
            icon={CheckCircle2}
            label={t('assets.active', 'فعال')}
            value={activeAssets.length}
          />
          <Stat
            icon={Archive}
            label={t('assets.disposed', 'واگذارشده')}
            value={assets.length - activeAssets.length}
          />
          <Stat
            icon={Landmark}
            label={t('assets.stat_active_cost', 'بهای تمام‌شده‌ی دارایی‌های فعال')}
            value={<Money minor={activeCostMinor} />}
          />
        </StatGrid>
      ) : null}

      <ListSection title={t('assets.register', 'دفتر دارایی')}>
        {isLoading ? (
          <Loading label={t('common.loading', 'در حال بارگذاری…')} />
        ) : error ? (
          <ErrorNote
            message={error}
            onRetry={onRefresh}
            retryLabel={t('common.retry', 'تلاش دوباره')}
          />
        ) : (
          <DataTable
            tableId="assets"
            t={t}
            rows={rows}
            columns={columns}
            rowKey={(asset) => asset.id}
            onRowClick={(asset) => onSelect(asset.id)}
            searchValue={search}
            onSearchChange={setSearch}
            minWidthClass="min-w-[420px] sm:min-w-[640px]"
            emptyState={
              assets.length === 0 ? (
                <EmptyState
                  icon="product"
                  title={t('assets.empty_title', 'هنوز دارایی ثابتی ثبت نشده')}
                  description={t(
                    'assets.empty_hint',
                    'دارایی ثابت از فاکتور خرید یا از تنظیمات حسابداری ثبت می‌شود.',
                  )}
                />
              ) : (
                <EmptyState
                  icon="search"
                  title={t('assets.no_match', 'دارایی‌ای با این فیلتر نیست')}
                />
              )
            }
          />
        )}
      </ListSection>

      {selected ? (
        <ListSection
          title={t('assets.schedule', 'جدول استهلاک') + ' — ' + selected.name}
          description={t('assets.schedule_hint', 'کل جدول از پیش محاسبه شده و تاریخ‌دار است.')}
        >
          {isScheduleLoading ? (
            <Loading label={t('common.loading', 'در حال بارگذاری…')} />
          ) : scheduleError ? (
            <ErrorNote
              message={scheduleError}
              onRetry={onRefresh}
              retryLabel={t('common.retry', 'تلاش دوباره')}
            />
          ) : (
            <>
              <StatGrid>
                <Stat
                  label={t('assets.cost', 'بهای تمام‌شده')}
                  value={<Money minor={selected.costMinor} />}
                />
                <Stat
                  label={t('assets.salvage', 'ارزش اسقاط')}
                  value={<Money minor={selected.salvageMinor} tone="muted" />}
                />
                <Stat
                  label={t('assets.accumulated', 'استهلاک انباشته')}
                  value={<Money minor={lastPosted?.accumulated_minor ?? 0} />}
                  hint={`${posted.length} / ${schedule.length}`}
                />
                <Stat
                  label={t('assets.book_value', 'ارزش دفتری')}
                  value={<Money minor={lastPosted?.book_value_minor ?? selected.costMinor} />}
                />
              </StatGrid>

              <DataTable
                tableId="assets-schedule"
                t={t}
                rows={scheduleRows}
                columns={scheduleColumns}
                rowKey={(row) => String(row.period)}
                searchValue={scheduleSearch}
                onSearchChange={setScheduleSearch}
                minWidthClass="min-w-[420px] sm:min-w-[640px]"
                emptyState={
                  <EmptyState
                    icon="search"
                    title={t('assets.schedule_empty', 'دوره‌ای در جدول نیست')}
                  />
                }
              />
            </>
          )}
        </ListSection>
      ) : null}
    </CapabilityPage>
  )
})

AssetsView.displayName = 'AssetsView'
