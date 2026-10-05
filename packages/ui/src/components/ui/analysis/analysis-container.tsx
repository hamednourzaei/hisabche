'use client'

// ============================================
// «تحلیل کسب‌وکار» — one page, five questions a business asks of its own data:
//
//   وصول مطالبات      who do I remind today, and how firmly?
//   تأمین‌کنندگان      who delivers late, and where is my spending concentrated?
//   نقطه‌ی سربه‌سر      how many of each product cover my fixed costs?
//   بازگشت مشتری      of the customers who first bought in a month, who came back?
//   سرمایه در گردش    how many days of trading are tied up in debts and stock?
//
// Every figure is computed by the server from rows the business already has.
// Nothing is estimated on screen, and each section says in words when it has
// nothing to show and WHY — «no overdue invoices» and «no invoices at all» are
// different answers.
// ============================================

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber, toIsoDay } from '@hisabche/formatting'
import { presetRange } from '@hisabche/ui-contract'
import { useCurrencyStore } from '@hisabche/store'
import {
  apiErrorMessage,
  useBreakEven,
  useCohorts,
  useCollectionsWorklist,
  useSupplierAnalysis,
  useWorkingCapital,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { useLocalePush } from '../../../hooks/use-locale-push'
import { DateRangePicker, type DateRange } from '../dashboard/date-range-picker'
import { MoneyInput } from '../money-input'
import { SearchableTable } from '../data-table'
import { HubTabs } from '../hub-tabs'
import { SegmentedControl } from '../segmented-control'
import { PeerBenchmark } from './peer-benchmark'
import { ReportBuilder } from './report-builder'

type T = (key: string, fallback?: string) => string
type Section =
  'collections' | 'suppliers' | 'breakEven' | 'cohorts' | 'workingCapital' | 'benchmark' | 'reports'

/**
 * The seven parts in three groups, behind two switches — the row of
 * seven tabs is gone. The parts themselves are unchanged.
 */
export const ANALYSIS_GROUPS = {
  money: ['collections', 'workingCapital', 'breakEven'],
  market: ['suppliers', 'cohorts', 'benchmark'],
  reports: ['reports'],
} as const
export type AnalysisGroup = keyof typeof ANALYSIS_GROUPS
const GROUP_ORDER: readonly AnalysisGroup[] = ['money', 'market', 'reports']

/** The group a part belongs to. */
export function analysisGroupOf(section: string): AnalysisGroup {
  return (
    GROUP_ORDER.find((group) => (ANALYSIS_GROUPS[group] as readonly string[]).includes(section)) ??
    'money'
  )
}

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'
const th = 'px-3 py-2.5 text-start text-xs font-medium text-[hsl(var(--fg-secondary))]'
const td = 'px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))]'

/** Closed lists: a value from the server is looked up only when it is one of these. */
export const ANALYSIS_TONES = ['courtesy', 'formal', 'firm', 'final'] as const
export const ANALYSIS_SUPPLIER_BANDS = ['low', 'moderate', 'high', 'unknown'] as const
export const ANALYSIS_SUPPLIER_SIGNALS = [
  'LATE_DELIVERY',
  'PRICE_DRIFT',
  'INACTIVITY',
  'UNRECEIVED',
] as const
export const ANALYSIS_BREAK_EVEN_REASONS = [
  'NO_REVENUE',
  'NO_CONTRIBUTION',
  'NO_FIXED_COSTS',
] as const

function Failed({ t, error }: { t: T; error: unknown }) {
  const message = apiErrorMessage(error, '')
  return (
    <p role="alert" className={cn(card, 'p-4 text-sm text-[hsl(var(--color-destructive))]')}>
      {message || t('analysis.failed', 'این بخش خوانده نشد. دوباره تلاش کنید.')}
    </p>
  )
}

function Loading() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-11 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]" />
      ))}
    </div>
  )
}

function Empty({ children }: { children: string }) {
  return (
    <p className={cn(card, 'p-6 text-center text-sm text-[hsl(var(--fg-secondary))]')}>
      {children}
    </p>
  )
}

export function AnalysisContainer() {
  const tOriginal = useTranslations()
  const t: T = (key, fallback) => {
    const value = tOriginal(key as Parameters<typeof tOriginal>[0])
    return value && value !== key ? value : (fallback ?? key)
  }
  const locale = useIntlLocale()
  const [section, setSection] = useState<Section>('collections')
  const group = analysisGroupOf(section)

  const sections: Array<{ id: Section; label: string }> = [
    { id: 'collections', label: t('analysis.tabs.collections', 'وصول مطالبات') },
    { id: 'suppliers', label: t('analysis.tabs.suppliers', 'تأمین‌کنندگان') },
    { id: 'breakEven', label: t('analysis.tabs.breakEven', 'نقطه‌ی سربه‌سر') },
    { id: 'cohorts', label: t('analysis.tabs.cohorts', 'بازگشت مشتری') },
    { id: 'workingCapital', label: t('analysis.tabs.workingCapital', 'سرمایه در گردش') },
    { id: 'benchmark', label: t('analysis.tabs.benchmark', 'مقایسه') },
    { id: 'reports', label: t('analysis.tabs.reports', 'گزارش‌ساز') },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4">
      <header>
        <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
          {t('nav.analysis', 'تحلیل کسب‌وکار')}
        </h1>
        <p className="mt-1 text-sm text-[hsl(var(--fg-tertiary))]">
          {t(
            'nav.analysis_description',
            'چه کسی بدهکار است، کدام تأمین‌کننده دیر می‌رساند، و کجا سربه‌سر می‌شوید',
          )}
        </p>
      </header>

      <div className="space-y-3">
        <HubTabs
          label={t('analysis.groupsLabel', 'بخش')}
          items={GROUP_ORDER.map((id) => ({ id, label: t(`analysis.groups.${id}`, id) }))}
          active={group}
          // Opening a tab opens its first part.
          onSelect={(next) => setSection(ANALYSIS_GROUPS[next][0])}
        />
        {/* A group with one part needs no second switch. */}
        {ANALYSIS_GROUPS[group].length > 1 ? (
          <SegmentedControl
            branch
            label={t('analysis.partsLabel', 'نما')}
            options={ANALYSIS_GROUPS[group].map((value) => ({
              value,
              label: sections.find((item) => item.id === value)?.label ?? value,
            }))}
            value={section as (typeof ANALYSIS_GROUPS)[AnalysisGroup][number]}
            onChange={setSection}
          />
        ) : null}
      </div>

      {section === 'collections' ? <Collections t={t} locale={locale} /> : null}
      {section === 'suppliers' ? <Suppliers t={t} locale={locale} /> : null}
      {section === 'breakEven' ? <BreakEven t={t} locale={locale} /> : null}
      {section === 'cohorts' ? <Cohorts t={t} locale={locale} /> : null}
      {section === 'workingCapital' ? <WorkingCapital t={t} locale={locale} /> : null}
      {section === 'benchmark' ? <PeerBenchmark /> : null}
      {section === 'reports' ? <ReportBuilder /> : null}
    </div>
  )
}

// ─── Collections ─────────────────────────────────────────────────────────────

function Collections({ t, locale }: { t: T; locale: string }) {
  const push = useLocalePush()
  const list = useCollectionsWorklist()

  if (list.isLoading) return <Loading />
  if (list.error || !list.data) return <Failed t={t} error={list.error} />

  const data = list.data
  const toneClass: Record<string, string> = {
    courtesy: 'bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]',
    formal: 'bg-[hsl(var(--color-warning)/0.15)] text-[hsl(var(--fg-primary))]',
    firm: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
    final: 'bg-[hsl(var(--color-destructive))] text-white',
  }

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat
          label={t('analysis.collections.open', 'فاکتورهای باز')}
          value={formatNumber(data.openInvoices, locale, 0)}
        />
        {/* One figure per currency: afghani and dollars are never added together. */}
        {data.outstandingByCurrency.map((row) => (
          <Stat
            key={row.currency}
            label={`${t('analysis.collections.outstanding', 'مانده‌ی طلب')} (${row.currency})`}
            value={formatNumber(row.outstanding, locale, 2)}
          />
        ))}
        <Stat
          label={t('analysis.collections.toRemind', 'نیاز به یادآوری امروز')}
          value={formatNumber(data.actions.length, locale, 0)}
        />
      </dl>

      {data.actions.length === 0 ? (
        <Empty>
          {data.openInvoices === 0
            ? t('analysis.collections.nothingOwed', 'هیچ فاکتور فروشِ پرداخت‌نشده‌ای ندارید.')
            : t(
                'analysis.collections.nothingDue',
                'فاکتور باز دارید، ولی هنوز موعد یادآوری هیچ‌کدام نرسیده است.',
              )}
        </Empty>
      ) : (
        <SearchableTable
          empty={t('analysis.noMatch', 'چیزی با این جست‌وجو نیست')}
          tableId="analysis-collections"
          rows={data.actions}
          rowKey={(action) => action.invoiceId}
          onRowClick={(action) => push(`/invoices/${action.invoiceId}`)}
          words={(action) => [action.customerName ?? '', action.invoiceNumber]}
          columns={[
            {
              id: 'customer',
              labelKey: 'analysis.collections.customer',
              labelFallback: 'مشتری',
              locked: true,
              sortValue: (action) => action.customerName ?? '',
              render: (action) =>
                action.customerName ?? t('analysis.collections.walkIn', 'فروش بدون مشتری'),
            },
            {
              id: 'invoice',
              labelKey: 'analysis.collections.invoice',
              labelFallback: 'فاکتور',
              sortValue: (action) => action.invoiceNumber,
              render: (action) => <span className="tabular-nums">{action.invoiceNumber}</span>,
            },
            {
              id: 'amount',
              labelKey: 'analysis.collections.amount',
              labelFallback: 'مانده',
              align: 'end',
              sortValue: (action) => action.outstanding,
              render: (action) => (
                <span className="tabular-nums">
                  {formatNumber(action.outstanding, locale, 2)}{' '}
                  <span className="text-xs text-[hsl(var(--fg-tertiary))]">{action.currency}</span>
                </span>
              ),
            },
            {
              id: 'daysLate',
              labelKey: 'analysis.collections.daysLate',
              labelFallback: 'روز تأخیر',
              align: 'end',
              sortValue: (action) => action.daysLate,
              render: (action) => (
                <span className="tabular-nums">{formatNumber(action.daysLate, locale, 0)}</span>
              ),
            },
            {
              id: 'tone',
              labelKey: 'analysis.collections.tone',
              labelFallback: 'لحن یادآوری',
              sortValue: (action) => (ANALYSIS_TONES as readonly string[]).indexOf(action.tone),
              render: (action) => (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    toneClass[action.tone],
                  )}
                >
                  {(ANALYSIS_TONES as readonly string[]).includes(action.tone)
                    ? t(`analysis.collections.tones.${action.tone}`, action.tone)
                    : action.tone}
                </span>
              ),
            },
          ]}
        />
      )}
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">
        {t(
          'analysis.collections.note',
          'این فهرست برای پیگیری خود شماست؛ پیامی از طرف برنامه برای مشتری فرستاده نمی‌شود. لحن بر اساس تعداد روز تأخیر است: ۳، ۱۵، ۴۵ و ۷۵ روز.',
        )}
      </p>
    </div>
  )
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

function Suppliers({ t, locale }: { t: T; locale: string }) {
  const analysis = useSupplierAnalysis()

  if (analysis.isLoading) return <Loading />
  if (analysis.error || !analysis.data) return <Failed t={t} error={analysis.error} />

  const data = analysis.data
  if (data.orders === 0) {
    return (
      <Empty>
        {t(
          'analysis.suppliers.noOrders',
          'هنوز سفارش خریدی ثبت نشده است. این تحلیل از سفارش‌های خرید ساخته می‌شود.',
        )}
      </Empty>
    )
  }

  const bandClass: Record<string, string> = {
    low: 'text-[hsl(var(--color-success))]',
    moderate: 'text-[hsl(var(--fg-primary))]',
    high: 'text-[hsl(var(--color-destructive))]',
    unknown: 'text-[hsl(var(--fg-tertiary))]',
  }

  return (
    <div className="space-y-3">
      {data.concentration.length > 0 ? (
        <div className={cn(card, 'p-4')}>
          <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
            {t('analysis.suppliers.concentrationTitle', 'تمرکز خرید')}
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-[hsl(var(--fg-secondary))]">
            {data.concentration.map((finding) => (
              <li key={`${finding.kind}-${finding.subjectId}`}>
                {finding.kind === 'SUPPLIER_CONCENTRATION'
                  ? t(
                      'analysis.suppliers.concentrationSupplier',
                      'سهم این تأمین‌کننده از کل خرید شما',
                    )
                  : t(
                      'analysis.suppliers.concentrationProduct',
                      'این کالا فقط از یک تأمین‌کننده خریده می‌شود',
                    )}
                {': '}
                <span className="font-medium text-[hsl(var(--fg-primary))]">
                  {finding.subjectName}
                </span>
                {finding.kind === 'SUPPLIER_CONCENTRATION' ? (
                  <span className="ms-1 tabular-nums">
                    — {formatNumber(finding.sharePercent, locale, 1)}٪
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SearchableTable
        empty={t('analysis.noMatch', 'چیزی با این جست‌وجو نیست')}
        tableId="analysis-suppliers"
        rows={data.suppliers}
        rowKey={(supplier) => supplier.supplierId}
        words={(supplier) => [supplier.name]}
        columns={[
          {
            id: 'supplier',
            labelKey: 'analysis.suppliers.supplier',
            labelFallback: 'تأمین‌کننده',
            locked: true,
            sortValue: (supplier) => supplier.name,
            render: (supplier) => <span className="font-medium">{supplier.name}</span>,
          },
          {
            id: 'band',
            labelKey: 'analysis.suppliers.band',
            labelFallback: 'ریسک',
            sortValue: (supplier) =>
              (ANALYSIS_SUPPLIER_BANDS as readonly string[]).indexOf(supplier.band),
            render: (supplier) => (
              <span className={cn('font-medium', bandClass[supplier.band])}>
                {(ANALYSIS_SUPPLIER_BANDS as readonly string[]).includes(supplier.band)
                  ? t(`analysis.suppliers.bands.${supplier.band}`, supplier.band)
                  : supplier.band}
              </span>
            ),
          },
          {
            id: 'orders',
            labelKey: 'analysis.suppliers.orders',
            labelFallback: 'سفارش',
            align: 'end',
            sortValue: (supplier) => supplier.evidence.purchases,
            render: (supplier) => (
              <span className="tabular-nums">
                {formatNumber(supplier.evidence.purchases, locale, 0)}
              </span>
            ),
          },
          {
            id: 'late',
            labelKey: 'analysis.suppliers.late',
            labelFallback: 'میانگین تأخیر (روز)',
            align: 'end',
            sortValue: (supplier) => supplier.evidence.averageDaysLate,
            render: (supplier) => (
              <span className="tabular-nums">
                {supplier.evidence.averageDaysLate === null
                  ? '—'
                  : formatNumber(supplier.evidence.averageDaysLate, locale, 0)}
              </span>
            ),
          },
          {
            id: 'why',
            labelKey: 'analysis.suppliers.why',
            labelFallback: 'دلیل',
            showFrom: 'md',
            render: (supplier) => (
              <span className="text-xs text-[hsl(var(--fg-secondary))]">
                {supplier.signals.length === 0
                  ? supplier.band === 'unknown'
                    ? t('analysis.suppliers.tooFew', 'سفارش کافی برای قضاوت نیست')
                    : '—'
                  : supplier.signals
                      .map((signal) =>
                        (ANALYSIS_SUPPLIER_SIGNALS as readonly string[]).includes(signal.key)
                          ? t(`analysis.suppliers.signals.${signal.key}`, signal.key)
                          : signal.key,
                      )
                      .join('، ')}
              </span>
            ),
          },
        ]}
      />

      {data.ordersWithoutPromisedDate > 0 ? (
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">
          {formatNumber(data.ordersWithoutPromisedDate, locale, 0)}{' '}
          {t(
            'analysis.suppliers.noPromise',
            'سفارش «تاریخ تحویل موعود» ندارند و در سنجش تأخیر حساب نشده‌اند. برای سنجش دقیق، این تاریخ را هنگام ثبت سفارش وارد کنید.',
          )}
        </p>
      ) : null}
    </div>
  )
}

// ─── Break-even ──────────────────────────────────────────────────────────────

function BreakEven({ t, locale }: { t: T; locale: string }) {
  const currency = useCurrencyStore((s) => s.primaryCurrency)
  const [range, setRange] = useState<DateRange>(() => presetRange('30days'))
  const [other, setOther] = useState('')

  const otherValue = useMemo(() => {
    const typed = other.trim()
    if (typed === '') return null
    const value = Number(typed)
    return Number.isFinite(value) && value >= 0 ? value : null
  }, [other])

  const analysis = useBreakEven({
    from: toIsoDay(range.from),
    to: toIsoDay(range.to),
    currency,
    otherFixedCosts: otherValue,
  })

  const money = (value: number) => formatNumber(value, locale, 2)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <DateRangePicker value={range} onChange={(next) => setRange(next)} t={t} />
        <div className="w-56">
          <MoneyInput
            name="otherFixedCosts"
            label={t('analysis.breakEven.other', 'هزینه‌های ثابت دیگر (اجاره، آب و برق…)')}
            value={other}
            onChange={setOther}
          />
        </div>
      </div>

      {analysis.isLoading ? (
        <Loading />
      ) : analysis.error || !analysis.data ? (
        <Failed t={t} error={analysis.error} />
      ) : analysis.data.rows.length === 0 ? (
        <Empty>{t('analysis.breakEven.empty', 'در این بازه فروشی ثبت نشده است.')}</Empty>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat
              label={`${t('analysis.breakEven.fixed', 'هزینه‌ی ثابت بازه')} (${t(`currency.${analysis.data.currency.toLowerCase()}`, analysis.data.currency)})`}
              value={money(analysis.data.fixedCostsTotal)}
            />
          </dl>
          {analysis.data.isLowerBound ? (
            <p className="rounded-[var(--radius-md)] border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.08)] p-3 text-xs text-[hsl(var(--fg-primary))]">
              {t(
                'analysis.breakEven.lowerBound',
                'فقط حقوق‌ها حساب شده است. تا هزینه‌های ثابت دیگر را وارد نکنید، تعداد سربه‌سر واقعی از این عددها بیشتر است.',
              )}
            </p>
          ) : null}
          <SearchableTable
            empty={t('analysis.noMatch', 'چیزی با این جست‌وجو نیست')}
            tableId="analysis-break-even"
            rows={analysis.data.rows}
            rowKey={(row, index) => row.productId ?? `row-${index}`}
            words={(row) => [row.name]}
            columns={[
              {
                id: 'product',
                labelKey: 'analysis.breakEven.product',
                labelFallback: 'کالا',
                locked: true,
                sortValue: (row) => row.name,
                render: (row) => <span className="font-medium">{row.name}</span>,
              },
              {
                id: 'sold',
                labelKey: 'analysis.breakEven.sold',
                labelFallback: 'فروش (تعداد)',
                align: 'end',
                sortValue: (row) => row.quantity,
                render: (row) => (
                  <span className="tabular-nums">{formatNumber(row.quantity, locale, 3)}</span>
                ),
              },
              {
                id: 'contribution',
                labelKey: 'analysis.breakEven.contribution',
                labelFallback: 'سود ناخالص',
                align: 'end',
                sortValue: (row) => row.contribution,
                render: (row) => <span className="tabular-nums">{money(row.contribution)}</span>,
              },
              {
                id: 'margin',
                labelKey: 'analysis.breakEven.margin',
                labelFallback: 'حاشیه',
                align: 'end',
                showFrom: 'md',
                sortValue: (row) => row.contributionPercent,
                render: (row) => (
                  <span className="tabular-nums">
                    {row.contributionPercent === null
                      ? '—'
                      : `${formatNumber(row.contributionPercent, locale, 1)}٪`}
                  </span>
                ),
              },
              {
                id: 'quantity',
                labelKey: 'analysis.breakEven.quantity',
                labelFallback: 'تعداد سربه‌سر',
                align: 'end',
                sortValue: (row) => row.breakEvenQuantity,
                // Null is «cannot be reached / not computable», and the reason is
                // said — it is never shown as zero.
                render: (row) =>
                  row.breakEvenQuantity !== null ? (
                    <span className="tabular-nums">
                      {formatNumber(row.breakEvenQuantity, locale, 0)}
                    </span>
                  ) : (
                    <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {row.breakEvenReason &&
                      (ANALYSIS_BREAK_EVEN_REASONS as readonly string[]).includes(
                        row.breakEvenReason,
                      )
                        ? t(
                            `analysis.breakEven.reasons.${row.breakEvenReason}`,
                            row.breakEvenReason,
                          )
                        : '—'}
                    </span>
                  ),
              },
            ]}
          />
        </>
      )}
    </div>
  )
}

// ─── Cohorts ─────────────────────────────────────────────────────────────────

function Cohorts({ t, locale }: { t: T; locale: string }) {
  const analysis = useCohorts()

  if (analysis.isLoading) return <Loading />
  if (analysis.error || !analysis.data) return <Failed t={t} error={analysis.error} />

  const rows = analysis.data.cohorts
  if (rows.length === 0) {
    return (
      <Empty>
        {t(
          'analysis.cohorts.empty',
          'هنوز فروشی به مشتریِ ثبت‌شده ندارید. فروش بدون مشتری در این تحلیل نمی‌آید.',
        )}
      </Empty>
    )
  }

  const months = Math.min(6, Math.max(...rows.map((row) => row.retained.length)))

  return (
    <div className="space-y-3">
      <div className={cn(card, 'overflow-x-auto')}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
              <th className={th}>{t('analysis.cohorts.month', 'ماه اولین خرید')}</th>
              <th className={th}>{t('analysis.cohorts.size', 'مشتری')}</th>
              {Array.from({ length: months }, (_, index) => (
                <th key={index} className={th}>
                  {index === 0
                    ? t('analysis.cohorts.first', 'همان ماه')
                    : `${t('analysis.cohorts.after', 'ماهِ')} ${formatNumber(index, locale, 0)}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cohort} className="border-b border-[hsl(var(--border-default))]">
                <td className={cn(td, 'tabular-nums')} dir="ltr">
                  {row.cohort}
                </td>
                <td className={cn(td, 'tabular-nums')}>{formatNumber(row.size, locale, 0)}</td>
                {Array.from({ length: months }, (_, index) => {
                  const value = row.retained[index]
                  return (
                    <td key={index} className={cn(td, 'tabular-nums')}>
                      {value === null || value === undefined ? (
                        // Not observed yet — a month that has not happened is
                        // not «nobody came back».
                        <span className="text-[hsl(var(--fg-tertiary))]">…</span>
                      ) : (
                        formatNumber(value, locale, 0)
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">
        {t(
          'analysis.cohorts.note',
          'هر ردیف مشتریانی است که اولین خریدشان در آن ماه (میلادی) بوده، و هر ستون تعدادی که در ماه‌های بعد دوباره خرید کرده‌اند. «…» یعنی آن ماه هنوز نرسیده است.',
        )}
      </p>
    </div>
  )
}

// ─── Working capital ─────────────────────────────────────────────────────────

function WorkingCapital({ t, locale }: { t: T; locale: string }) {
  const currency = useCurrencyStore((s) => s.primaryCurrency)
  const [range, setRange] = useState<DateRange>(() => presetRange('30days'))
  const analysis = useWorkingCapital({
    from: toIsoDay(range.from),
    to: toIsoDay(range.to),
    currency,
  })

  // Null is «cannot be computed for this period» — shown as a dash with the
  // reason below, never as zero days.
  const days = (value: number | null) => (value === null ? '—' : formatNumber(value, locale, 1))
  const money = (value: number) => formatNumber(value, locale, 2)

  return (
    <div className="space-y-3">
      <DateRangePicker value={range} onChange={(next) => setRange(next)} t={t} />

      {analysis.isLoading ? (
        <Loading />
      ) : analysis.error || !analysis.data ? (
        <Failed t={t} error={analysis.error} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label={t('analysis.workingCapital.dso', 'روزهای وصول طلب')}
              value={days(analysis.data.dso)}
            />
            <Stat
              label={t('analysis.workingCapital.dio', 'روزهای ماندن کالا')}
              value={days(analysis.data.dio)}
            />
            <Stat
              label={t('analysis.workingCapital.dpo', 'روزهای پرداخت به تأمین‌کننده')}
              value={days(analysis.data.dpo)}
            />
            <Stat
              label={t('analysis.workingCapital.ccc', 'چرخه‌ی نقد (روز)')}
              value={days(analysis.data.cashConversionCycle)}
            />
          </dl>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label={`${t('analysis.workingCapital.receivables', 'طلب از مشتریان')} (${analysis.data.currency})`}
              value={money(analysis.data.receivables)}
            />
            <Stat
              label={`${t('analysis.workingCapital.payables', 'بدهی به تأمین‌کنندگان')} (${analysis.data.currency})`}
              value={money(analysis.data.payables)}
            />
            <Stat
              label={t('analysis.workingCapital.inventory', 'موجودی کالا به بهای تمام‌شده')}
              value={money(analysis.data.inventoryAtCost)}
            />
            <Stat
              label={t('analysis.workingCapital.net', 'سرمایه در گردش (بدون نقد)')}
              value={money(analysis.data.netWorkingCapital)}
            />
          </dl>

          {analysis.data.cashConversionCycle === null ? (
            <p className={cn(card, 'p-3 text-xs text-[hsl(var(--fg-secondary))]')}>
              {t(
                'analysis.workingCapital.incomplete',
                'در این بازه فروش، خرید یا بهای کالای فروخته‌شده‌ی کافی ثبت نشده است؛ نسبتی که قابل محاسبه نیست با «—» آمده، نه صفر.',
              )}
            </p>
          ) : analysis.data.cashConversionCycle < 0 ? (
            <p className={cn(card, 'p-3 text-xs text-[hsl(var(--fg-secondary))]')}>
              {t(
                'analysis.workingCapital.negativeIsGood',
                'چرخه‌ی نقد منفی خوب است: یعنی پیش از آنکه به تأمین‌کننده بپردازید، پول فروش را گرفته‌اید.',
              )}
            </p>
          ) : null}

          {analysis.data.otherCurrencies.length > 0 ? (
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('analysis.workingCapital.otherCurrencies', 'سندهای این ارزها در این عددها نیست')}
              {': '}
              {analysis.data.otherCurrencies.join('، ')}
            </p>
          ) : null}
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">
            {t(
              'analysis.workingCapital.note',
              'موجودی نقد و بانک در این محاسبه نیست. طلب و بدهی مانده‌ی امروز است و فروش و خرید مربوط به بازه‌ی انتخاب‌شده.',
            )}
          </p>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(card, 'p-3')}>
      <dt className="text-xs text-[hsl(var(--fg-secondary))]">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
        {value}
      </dd>
    </div>
  )
}
