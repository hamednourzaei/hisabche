'use client'

// ============================================
// packages/ui/src/components/ui/referrals/referrals-view.tsx
//
// «صفحه رفرال»: two KPI cards, the link, and the table of who joined.
//
// The programme, in the owner's words: 10% of the subscription the referred
// business actually PAYS, starting at their first successful payment, for the
// first 12 paid periods; the new business gets 10% off its first payment.
//
// ⚠️ THE TERMS ARE RENDERED FROM THE SERVER'S `terms`, NOT WRITTEN HERE.
// A page that says «۱۰٪ تا ۱۲ ماه» while the backend pays something else is a
// promise the product does not keep. If the rate is tuned later, this text
// follows it without an edit (landing-claims rule, §۸).
// ============================================

import { memo, useMemo, useState } from 'react'
import { Check, Copy, Gift, Users, Wallet } from 'lucide-react'
import type { ReferralRow, ReferralSummary, ReferralTerms } from '@hisabche/api'

import { DataTable, matchesSearch, type TableColumn } from '../data-table'
import { EmptyState } from '../empty-state'
import { KpiCard, KpiGrid } from '../kpi-card'
import { useDateFormat } from '../../../hooks/use-date-format'
import { cn } from '../../../lib/utils'

type Translate = (key: string, fallback?: string) => string

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))]',
  credited: 'bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]',
  paid: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  void: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
  none: 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))]',
}

/**
 * Money, from the smallest unit.
 *
 * ⚠️ THE CURRENCY IS THE SERVER'S, never assumed. A wrong symbol on an amount
 * is worse than no symbol — and a row that earned nothing yet has no currency
 * at all, so it shows a dash rather than «$0.00», which would read as a
 * measured zero.
 */
function money(minor: number, currency: string | null, locale: string): string {
  if (!currency) return '—'
  const amount = minor / 100
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export interface ReferralsViewProps {
  t: Translate
  locale: string
  isLoading: boolean
  /** Separate from «empty»: a failed request must not read as «nobody joined». */
  error: string | null
  onRetry: () => void
  code: string | null
  link: string | null
  summary: ReferralSummary
  referrals: readonly ReferralRow[]
  terms: ReferralTerms
}

export const ReferralsView = memo(function ReferralsView({
  t,
  locale,
  isLoading,
  error,
  onRetry,
  code,
  link,
  summary,
  referrals,
  terms,
}: ReferralsViewProps) {
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)
  const { date: fmtDay } = useDateFormat()

  const rows = useMemo(
    () => referrals.filter((row) => matchesSearch(search, [row.name, row.plan ?? ''])),
    [referrals, search],
  )

  const columns = useMemo<TableColumn<ReferralRow>[]>(
    () => [
      {
        id: 'name',
        labelKey: 'referral.colName',
        labelFallback: 'ثبت‌نام‌شونده',
        locked: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <span className="font-medium text-[hsl(var(--fg-primary))]">
            {/* ⚠️ A snapshot taken at sign-up: the row must still read
                correctly after a workspace is renamed or deleted. */}
            {row.name || t('referral.unnamed', 'بدون نام')}
          </span>
        ),
      },
      {
        id: 'signedUpAt',
        labelKey: 'referral.colSignedUp',
        labelFallback: 'تاریخ ثبت‌نام',
        showFrom: 'md',
        sortValue: (row) => row.signedUpAt,
        render: (row) => <span className="tabular-nums">{fmtDay(row.signedUpAt) || '—'}</span>,
      },
      {
        id: 'plan',
        labelKey: 'referral.colPlan',
        labelFallback: 'پلن فعال‌شده',
        sortValue: (row) => row.plan ?? '',
        render: (row) =>
          row.plan ? (
            <span className="text-[hsl(var(--fg-secondary))]">
              {t(`billing.plan.${row.plan}`, row.plan)}
              {row.interval ? (
                <span className="ms-1 text-[hsl(var(--fg-tertiary))]">
                  ({t(`referral.interval.${row.interval}`, row.interval)})
                </span>
              ) : null}
            </span>
          ) : (
            // ⚠️ «Has not paid yet» is not «no plan». They signed up; nothing
            // has been earned because nothing has been paid.
            <span className="text-[hsl(var(--fg-tertiary))]">
              {t('referral.notPaidYet', 'هنوز پرداختی نداشته')}
            </span>
          ),
      },
      {
        id: 'periods',
        labelKey: 'referral.colPeriods',
        labelFallback: 'دوره‌های باقی‌مانده',
        showFrom: 'lg',
        align: 'end',
        sortValue: (row) => row.periodsRemaining,
        render: (row) =>
          row.isActive ? (
            <span className="tabular-nums text-[hsl(var(--fg-secondary))]">
              {row.paidPeriods} / {terms.periodLimit}
            </span>
          ) : (
            <span className="text-[hsl(var(--fg-tertiary))]">—</span>
          ),
      },
      {
        id: 'commission',
        labelKey: 'referral.colCommission',
        labelFallback: 'کمیسیون شما',
        align: 'end',
        sortValue: (row) => row.commissionMinor,
        render: (row) => (
          <span
            className={cn(
              'font-medium tabular-nums',
              row.commissionMinor > 0
                ? 'text-[hsl(var(--color-success))]'
                : 'text-[hsl(var(--fg-tertiary))]',
            )}
          >
            {money(row.commissionMinor, row.currency, locale)}
          </span>
        ),
      },
      {
        id: 'status',
        labelKey: 'team.status',
        labelFallback: 'وضعیت',
        sortValue: (row) => row.status,
        render: (row) => (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              STATUS_TONE[row.status] ?? STATUS_TONE.none,
            )}
          >
            {t(`referral.status.${row.status}`, row.status)}
          </span>
        ),
      },
    ],
    [fmtDay, locale, t, terms.periodLimit],
  )

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused; the input below is selectable, so
      // there is always a way to copy by hand.
      setCopied(false)
    }
  }

  const percent = (bps: number) => `${bps / 100}٪`

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <Gift className="size-6 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t('referral.title', 'معرفی حسابچه')}
          </h1>
          {/* The terms, from the server. See the note at the top of the file. */}
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {t('referral.subtitle', '{rate} از اشتراک دوستانت، تا {months} ماه')
              .replace('{rate}', percent(terms.rateBps))
              .replace('{months}', String(terms.periodLimit))}
          </p>
        </div>
      </header>

      {/* ── The two figures ── */}
      <KpiGrid className="sm:grid-cols-2">
        <KpiCard
          icon={Users}
          label={t('referral.kpiReferred', 'معرفی‌شده‌ها')}
          value={summary.referredCount}
          hint={t('referral.activeCount', '{count} نفر پرداخت‌کننده').replace(
            '{count}',
            String(summary.activeCount),
          )}
        />
        <KpiCard
          icon={Wallet}
          label={t('referral.kpiEarnings', 'درآمد کل')}
          value={money(summary.totalMinor, summary.currency, locale)}
          hint={t('referral.pendingAmount', 'در انتظار: {amount}').replace(
            '{amount}',
            money(summary.pendingMinor, summary.currency, locale),
          )}
        />
      </KpiGrid>

      {/* ── The link ── */}
      <section className="rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-5 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t('referral.linkTitle', 'لینک معرفی شما')}
          </h2>
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {t(
              'referral.linkHint',
              'کسب‌وکار جدیدی که با این لینک ثبت‌نام کند، {discount} تخفیف روی اولین پرداختش می‌گیرد.',
            ).replace('{discount}', percent(terms.signupDiscountBps))}
          </p>
        </div>

        {!code ? (
          // ⚠️ SAID OUT LOUD. A missing link with no explanation reads as a
          // broken page; this is «the database is not configured yet», which
          // is a different thing the owner can act on.
          <p
            role="status"
            className="rounded-xl border border-[hsl(var(--color-warning)/0.3)] bg-[hsl(var(--color-warning)/0.06)] px-3 py-2 text-sm text-[hsl(var(--fg-secondary))]"
          >
            {t('referral.notConfigured', 'سیستم معرفی هنوز روی پایگاه داده فعال نشده است.')}
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              readOnly
              value={link ?? ''}
              dir="ltr"
              onFocus={(event) => event.currentTarget.select()}
              aria-label={t('referral.linkTitle', 'لینک معرفی شما')}
              className="min-w-0 flex-1 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 py-2.5 text-start text-sm text-[hsl(var(--fg-primary))]"
            />
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-[hsl(var(--surface-muted))] px-2.5 py-1 font-mono text-xs text-[hsl(var(--fg-secondary))]">
                {code}
              </span>
              <button
                type="button"
                onClick={() => void copy()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[hsl(var(--color-primary))] px-4 py-2 text-sm font-bold text-[hsl(var(--color-primary-fg))] transition hover:brightness-110"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? t('referral.copied', 'کپی شد') : t('referral.copy', 'کپی لینک')}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Who joined ── */}
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--color-destructive)/0.4)] bg-[hsl(var(--color-destructive)/0.06)] p-3 text-sm text-[hsl(var(--color-destructive))]"
        >
          {error}
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-[hsl(var(--border-default))] px-3 py-1 text-[hsl(var(--fg-secondary))]"
          >
            {t('common.retry', 'تلاش دوباره')}
          </button>
        </div>
      ) : isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-[hsl(var(--surface-muted))]" />
      ) : (
        <DataTable
          tableId="referral-list"
          t={t}
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          searchValue={search}
          onSearchChange={setSearch}
          minWidthClass="min-w-[420px]"
          emptyState={
            <EmptyState
              icon="customer"
              title={t('referral.empty', 'هنوز کسی با لینک شما ثبت‌نام نکرده')}
              description={t(
                'referral.emptyHint',
                'لینک بالا را با کسب‌وکارهایی که می‌شناسید به اشتراک بگذارید.',
              )}
            />
          }
        />
      )}

      {/* ⚠️ The payout rule, stated where the money is shown. */}
      {summary.payoutThresholdMinor > 0 ? (
        <p className="text-center text-[11px] text-[hsl(var(--fg-tertiary))]">
          {t('referral.threshold', 'پرداخت نقدی از {amount} به بالا انجام می‌شود.').replace(
            '{amount}',
            money(summary.payoutThresholdMinor, summary.currency ?? 'USD', locale),
          )}
        </p>
      ) : null}
    </div>
  )
})

ReferralsView.displayName = 'ReferralsView'
