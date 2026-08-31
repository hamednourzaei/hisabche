'use client'

// ============================================
// packages/ui/src/components/ui/expiry/expiry-view.tsx
//
// Batches, expiry and what an issue would consume.
//
// ---------------------------------------------------------------------------
// EXPIRED IS SHOWN FIRST, AND IS A REFUSAL
//
// Expired stock leads the report because it is the only group whose deadline
// has already passed. Next to it is what that stock is WORTH — the gap between
// what the balance sheet counts and what the shop can actually sell is the
// figure a write-off decision needs, and neither number alone gives it.
//
// The issue plan shows expired batches under `blockedByExpiry`, not as an
// option with a warning. There is no override control on this screen, because
// medicine sold past its date is not a data-quality problem.
//
// A shortfall is shown as a shortfall. Stock the shop does not have must read
// as missing, never as a plan that quietly covers less than was asked for.
// ============================================

import { memo, useState } from 'react'
import type { AllocationPlan, ExpiryReport, StockBatch } from '@hisabche/api'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  ErrorNote,
  Field,
  Loading,
  Money,
  Panel,
  Stat,
  StatGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  NumberField,
} from '../capability/capability-kit'

export interface ExpiryViewProps {
  t: (key: string, fallback?: string) => string
  report: ExpiryReport | null
  batches: StockBatch[]
  plan: AllocationPlan | null
  isLoading: boolean
  error: string | null
  actionError: string | null
  isBusy: boolean
  onPlanIssue: (input: { productId: string; quantity: number }) => void
  onRefresh: () => void
}

const STATE_TONE: Record<string, string> = {
  expired: 'bad',
  near_expiry: 'warn',
  fresh: 'good',
  no_expiry: 'neutral',
}

// Expired first. The server already orders the buckets this way; the view
// states the order it depends on rather than trusting an array's shape.
const STATE_ORDER = ['expired', 'near_expiry', 'fresh', 'no_expiry']

export const ExpiryView = memo(function ExpiryView({
  t,
  report,
  batches,
  plan,
  isLoading,
  error,
  actionError,
  isBusy,
  onPlanIssue,
  onRefresh,
}: ExpiryViewProps) {
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(1)

  const buckets = [...(report?.buckets ?? [])].sort(
    (a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state),
  )

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('expiry.title', 'انقضا و بچ')}
        description={t('expiry.subtitle', 'کالای منقضی، نزدیک انقضا، و برنامه‌ی مصرف')}
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

      {isLoading ? <Loading label={t('common.loading', 'در حال بارگذاری…')} /> : null}

      {report ? (
        <Panel
          title={t('expiry.report', 'گزارش انقضا')}
          description={t('expiry.as_of', 'تا تاریخ') + ': ' + report.asOf}
        >
          <StatGrid>
            <Stat
              label={t('expiry.expired_value', 'ارزش کالای منقضی')}
              value={
                <Money
                  minor={report.expiredValueMinor}
                  tone={report.expiredValueMinor > 0 ? 'bad' : 'muted'}
                />
              }
              hint={t('expiry.expired_value_hint', 'در ترازنامه هست، قابل فروش نیست.')}
            />
            {buckets.map((bucket) => (
              <Stat
                key={bucket.state}
                label={t(`expiry.state_${bucket.state}`, bucket.state)}
                value={bucket.totalQuantity}
                hint={`${bucket.batches.length} ${t('expiry.batches', 'بچ')}`}
              />
            ))}
          </StatGrid>
        </Panel>
      ) : null}

      {buckets
        .filter((bucket) => bucket.batches.length > 0 && bucket.state !== 'no_expiry')
        .map((bucket) => (
          <Panel
            key={bucket.state}
            title={t(`expiry.state_${bucket.state}`, bucket.state)}
            action={
              <Badge tone={STATE_TONE[bucket.state] ?? 'neutral'}>{bucket.totalQuantity}</Badge>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('expiry.batch', 'بچ')}</TableHead>
                  <TableHead>{t('expiry.quantity', 'مقدار')}</TableHead>
                  <TableHead>{t('expiry.expiry_date', 'تاریخ انقضا')}</TableHead>
                  <TableHead>{t('expiry.days_remaining', 'روز باقی‌مانده')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bucket.batches.map((batch) => (
                  <TableRow key={batch.batchId}>
                    <TableCell className="py-2 font-mono text-xs" dir="ltr">
                      {batch.batchNumber}
                    </TableCell>
                    <TableCell>{batch.quantity}</TableCell>
                    <TableCell className="py-2 tabular-nums" dir="ltr">
                      {batch.expiryDate ?? '—'}
                    </TableCell>
                    <TableCell>
                      {batch.daysRemaining == null ? (
                        '—'
                      ) : (
                        <span
                          className={
                            batch.daysRemaining < 0 ? 'text-[hsl(var(--color-destructive))]' : ''
                          }
                        >
                          {batch.daysRemaining}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        ))}

      <Panel
        title={t('expiry.plan_title', 'برنامه‌ی مصرف')}
        description={t(
          'expiry.plan_hint',
          'نشان می‌دهد از کدام بچ برداشته می‌شود — چیزی مصرف نمی‌کند. پیش‌فرض FEFO.',
        )}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
          <Field
            label={t('expiry.product', 'کالا')}
            value={productId}
            onChange={setProductId}
            disabled={isBusy}
            dir="ltr"
          />
          <NumberField
            label={t('expiry.quantity', 'مقدار')}
            value={quantity}
            onChange={setQuantity}
            min={1}
            disabled={isBusy}
          />
          <ActionButton
            className="self-end"
            disabled={isBusy || productId.trim() === '' || quantity <= 0}
            onClick={() => onPlanIssue({ productId: productId.trim(), quantity })}
          >
            {t('expiry.plan_action', 'محاسبه')}
          </ActionButton>
        </div>

        {plan ? (
          <div className="mt-4 space-y-3 text-sm">
            {plan.shortfall > 0 ? (
              <ErrorNote message={`${t('expiry.shortfall', 'کسری')}: ${plan.shortfall}`} />
            ) : null}

            <ul className="divide-y divide-[hsl(var(--border))]">
              {plan.allocations.map((allocation) => (
                <li
                  key={allocation.batchId}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="font-mono text-xs" dir="ltr">
                    {allocation.batchNumber}
                    {allocation.expiryDate ? ` · ${allocation.expiryDate}` : ''}
                  </span>
                  <span className="tabular-nums">{allocation.quantity}</span>
                </li>
              ))}
            </ul>

            {plan.blockedByExpiry.length > 0 ? (
              <div>
                <p className="mb-1 text-xs text-[hsl(var(--color-destructive))]">
                  {t('expiry.blocked', 'به دلیل انقضا کنار گذاشته شد')}
                </p>
                <ul className="text-xs text-[hsl(var(--muted-foreground))]">
                  {plan.blockedByExpiry.map((blocked) => (
                    <li key={blocked.batchId} dir="ltr" className="font-mono">
                      {blocked.batchNumber} · {blocked.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Panel>

      {!isLoading && batches.length === 0 && !report ? (
        <Panel title={t('expiry.empty_title', 'بچی ثبت نشده')}>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {t('expiry.empty_hint', 'بچ هنگام دریافت کالای تاریخ‌دار ثبت می‌شود.')}
          </p>
        </Panel>
      ) : null}
    </CapabilityPage>
  )
})

ExpiryView.displayName = 'ExpiryView'
