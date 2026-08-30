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
// ============================================

import { memo } from 'react'
import type { FixedAsset, ScheduleRow, DepreciationRunResult } from '@hisabche/api'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  ErrorNote,
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
  error: string | null
  actionError: string | null
  isBusy: boolean
  lastRun: DepreciationRunResult | null
  onSelect: (assetId: string) => void
  onRunDepreciation: () => void
  onRefresh: () => void
}

export const AssetsView = memo(function AssetsView({
  t,
  assets,
  selectedId,
  schedule,
  isLoading,
  isScheduleLoading,
  error,
  actionError,
  isBusy,
  lastRun,
  onSelect,
  onRunDepreciation,
  onRefresh,
}: AssetsViewProps) {
  const selected = assets.find((asset) => asset.id === selectedId) ?? null

  // Book value comes from the last posted row, not from a fresh calculation:
  // the books are what the ledger holds, not what the schedule predicts.
  const posted = schedule.filter((row) => row.posted_at != null)
  const lastPosted = posted[posted.length - 1]

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('assets.title', 'دارایی‌های ثابت')}
        description={t('assets.subtitle', 'استهلاک، دفتر دارایی و واگذاری')}
        action={
          <div className="flex gap-2">
            <ActionButton variant="quiet" onClick={onRefresh} disabled={isLoading}>
              {t('common.refresh', 'تازه‌سازی')}
            </ActionButton>
            <ActionButton onClick={onRunDepreciation} disabled={isBusy}>
              {t('assets.run_depreciation', 'اجرای استهلاک')}
            </ActionButton>
          </div>
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

      {isLoading ? <Loading label={t('common.loading', 'در حال بارگذاری…')} /> : null}

      {!isLoading && assets.length === 0 ? (
        <Panel title={t('assets.empty_title', 'هنوز دارایی ثابتی ثبت نشده')}>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t(
              'assets.empty_hint',
              'دارایی ثابت از فاکتور خرید یا از تنظیمات حسابداری ثبت می‌شود.',
            )}
          </p>
        </Panel>
      ) : null}

      {assets.length > 0 ? (
        <Panel title={t('assets.register', 'دفتر دارایی')}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-xs text-[hsl(var(--muted-foreground))]">
                <tr className="text-start">
                  <th className="py-2 text-start">{t('assets.name', 'نام')}</th>
                  <th className="py-2 text-start">{t('assets.cost', 'بهای تمام‌شده')}</th>
                  <th className="py-2 text-start">{t('assets.method', 'روش')}</th>
                  <th className="py-2 text-start">{t('assets.periods', 'دوره‌ها')}</th>
                  <th className="py-2 text-start">{t('common.status', 'وضعیت')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => onSelect(asset.id)}
                    className={
                      'cursor-pointer transition hover:bg-[hsl(var(--muted)/0.4)] ' +
                      (asset.id === selectedId ? 'bg-[hsl(var(--muted)/0.5)]' : '')
                    }
                  >
                    <td className="py-2">{asset.name}</td>
                    <td className="py-2">
                      <Money minor={asset.costMinor} />
                    </td>
                    <td className="py-2 text-[hsl(var(--muted-foreground))]">
                      {t(`assets.method_${asset.method}`, asset.method)}
                    </td>
                    <td className="py-2 tabular-nums">{asset.periods}</td>
                    <td className="py-2">
                      {asset.disposedOn ? (
                        <Badge tone="neutral">{t('assets.disposed', 'واگذارشده')}</Badge>
                      ) : (
                        <Badge tone="good">{t('assets.active', 'فعال')}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {selected ? (
        <Panel
          title={t('assets.schedule', 'جدول استهلاک') + ' — ' + selected.name}
          description={t('assets.schedule_hint', 'کل جدول از پیش محاسبه شده و تاریخ‌دار است.')}
        >
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

          {isScheduleLoading ? <Loading label={t('common.loading', 'در حال بارگذاری…')} /> : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="text-xs text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="py-2 text-start">{t('assets.period', 'دوره')}</th>
                  <th className="py-2 text-start">{t('common.date', 'تاریخ')}</th>
                  <th className="py-2 text-start">{t('assets.amount', 'مبلغ')}</th>
                  <th className="py-2 text-start">{t('assets.book_value', 'ارزش دفتری')}</th>
                  <th className="py-2 text-start">{t('common.status', 'وضعیت')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {schedule.map((row) => (
                  <tr key={row.period}>
                    <td className="py-2 tabular-nums">{row.period}</td>
                    <td className="py-2 tabular-nums" dir="ltr">
                      {row.on_date?.slice(0, 10)}
                    </td>
                    <td className="py-2">
                      <Money minor={row.amount_minor} />
                    </td>
                    <td className="py-2">
                      <Money minor={row.book_value_minor} tone="muted" />
                    </td>
                    <td className="py-2">
                      {row.cancelled_at ? (
                        <Badge tone="neutral">{t('assets.cancelled', 'لغوشده')}</Badge>
                      ) : row.posted_at ? (
                        <Badge tone="good">{t('assets.posted', 'ثبت‌شده')}</Badge>
                      ) : (
                        <Badge tone="warn">{t('assets.pending', 'در انتظار')}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </CapabilityPage>
  )
})

AssetsView.displayName = 'AssetsView'
