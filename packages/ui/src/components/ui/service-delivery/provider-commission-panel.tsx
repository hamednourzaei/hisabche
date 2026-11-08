'use client'

// ============================================
// «کمیسیون مجریان» — what each provider earned over a period (V54, N-7).
//
// A REPORT: nothing is posted or paid from here. The rule is the shared
// `buildProviderCommissionReport`; this panel only shows the server's answer
// and lets a manager set a provider's percent.
//
// ⚠️ «Unknown, not zero»: a provider with no rate shows «نرخ تعیین نشده», and
// sessions whose service has no price, or no provider, are counted apart.
// ⚠️ The base is the service's CURRENT price; the panel says so.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useProviderCommission,
  useSetProviderCommissionRate,
  type ProviderCommissionRowView,
} from '@hisabche/api'
import { toIsoDay } from '@hisabche/formatting'

import { Money } from '../capability/capability-kit'
import { DataTable } from '../data-table'
import type { TableColumn } from '../data-table/table-types'
import { JalaliDatePicker } from '../jalali-datepicker'
import { Input } from '../input'
import { Button } from '../button'
import { useToast } from '../toast-provider'

export interface ProviderCommissionPanelProps {
  /** Provider id → display name, from the screen's own employee list. */
  nameById: ReadonlyMap<string, string>
  mayEditRates: boolean
}

function monthStart(): string {
  const now = new Date()
  return toIsoDay(new Date(now.getFullYear(), now.getMonth(), 1))
}

export function ProviderCommissionPanel({ nameById, mayEditRates }: ProviderCommissionPanelProps) {
  const tOriginal = useTranslations()
  const t = (key: string, fallback?: string): string => {
    try {
      const value = tOriginal(key as never)
      return value === key ? (fallback ?? key) : value
    } catch {
      return fallback ?? key
    }
  }
  const toast = useToast()
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(() => toIsoDay(new Date()))
  const report = useProviderCommission(from, to)
  const setRate = useSetProviderCommissionRate()
  const [editing, setEditing] = useState<{ id: string; percent: string } | null>(null)

  const rows = report.data?.rows ?? []
  const saveRate = () => {
    if (!editing) return
    const percent = Number(editing.percent.replace('٫', '.'))
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      toast.error(t('serviceDelivery.commission.rateInvalid', 'درصد باید بین ۰ و ۱۰۰ باشد'))
      return
    }
    setRate.mutate(
      { employeeId: editing.id, rateBp: Math.round(percent * 100) },
      {
        onSuccess: () => setEditing(null),
        onError: (error) =>
          toast.error(
            t('serviceDelivery.commission.rateFailed', 'نرخ ذخیره نشد'),
            apiErrorMessage(error, ''),
          ),
      },
    )
  }

  const columns: TableColumn<ProviderCommissionRowView>[] = [
    {
      id: 'provider',
      labelKey: 'serviceDelivery.commission.provider',
      labelFallback: 'مجری',
      locked: true,
      render: (row) =>
        nameById.get(row.practitionerId) ?? t('serviceDelivery.unknown.employee', 'نام خوانده نشد'),
    },
    {
      id: 'sessions',
      labelKey: 'serviceDelivery.commission.sessions',
      labelFallback: 'جلسه‌ی تحویل‌شده',
      render: (row) => <span className="tabular-nums">{row.sessions}</span>,
      sortValue: (row) => row.sessions,
      align: 'end',
    },
    {
      id: 'base',
      labelKey: 'serviceDelivery.commission.base',
      labelFallback: 'ارزش خدمات',
      render: (row) => <Money minor={row.baseMinor} currency={row.currency} />,
      sortValue: (row) => row.baseMinor,
      align: 'end',
    },
    {
      id: 'rate',
      labelKey: 'serviceDelivery.commission.rate',
      labelFallback: 'نرخ',
      render: (row) =>
        editing?.id === row.practitionerId ? (
          <span className="flex items-center gap-1">
            <Input
              dir="ltr"
              inputMode="decimal"
              className="h-8 w-20"
              value={editing.percent}
              onChange={(event) =>
                setEditing({ id: row.practitionerId, percent: event.target.value })
              }
            />
            <Button onClick={saveRate} disabled={setRate.isPending}>
              {t('serviceDelivery.commission.save', 'ذخیره')}
            </Button>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="tabular-nums">
              {row.rateBp === null
                ? t('serviceDelivery.commission.noRate', 'نرخ تعیین نشده')
                : `${row.rateBp / 100}%`}
            </span>
            {mayEditRates && report.data?.configurable ? (
              <button
                type="button"
                className="text-xs underline underline-offset-2"
                onClick={() =>
                  setEditing({
                    id: row.practitionerId,
                    percent: row.rateBp === null ? '' : String(row.rateBp / 100),
                  })
                }
              >
                {t('serviceDelivery.commission.edit', 'تغییر')}
              </button>
            ) : null}
          </span>
        ),
    },
    {
      id: 'commission',
      labelKey: 'serviceDelivery.commission.amount',
      labelFallback: 'کمیسیون',
      render: (row) =>
        row.commissionMinor === null ? (
          <span className="text-[hsl(var(--fg-tertiary))]">
            {t('serviceDelivery.commission.unknown', 'نامعلوم')}
          </span>
        ) : (
          <Money minor={row.commissionMinor} currency={row.currency} />
        ),
      sortValue: (row) => row.commissionMinor,
      align: 'end',
    },
  ]

  return (
    <section data-provider-commission className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <h3 className="me-auto text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('serviceDelivery.commission.title', 'کمیسیون مجریان')}
        </h3>
        <JalaliDatePicker value={from} onChange={setFrom} />
        <JalaliDatePicker value={to} onChange={setTo} />
      </div>
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">
        {t(
          'serviceDelivery.commission.help',
          'گزارش است، نه پرداخت: بر اساس جلسه‌های تحویل‌شده و قیمت فعلی هر خدمت. در دفتر ثبت نمی‌شود.',
        )}
      </p>
      {report.isError ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {t('serviceDelivery.commission.unread', 'گزارش کمیسیون خوانده نشد؛ این «خالی» نیست.')}
        </p>
      ) : (
        <DataTable
          tableId="service-provider-commission"
          t={t}
          rows={rows}
          columns={columns}
          rowKey={(row) => `${row.practitionerId}|${row.currency}`}
          minWidthClass="min-w-[560px]"
          emptyState={
            <p className="p-4 text-sm text-[hsl(var(--fg-secondary))]">
              {report.isLoading
                ? t('serviceDelivery.loading', 'در حال بارگذاری…')
                : t(
                    'serviceDelivery.commission.empty',
                    'در این بازه جلسه‌ی تحویل‌شده‌ای با مجری نیست.',
                  )}
            </p>
          }
        />
      )}
      {report.data && (report.data.unpriced > 0 || report.data.unassigned > 0) ? (
        <p role="note" className="text-xs text-[hsl(var(--color-warning))]">
          {t(
            'serviceDelivery.commission.outside',
            'بیرون از گزارش: {unpriced} جلسه بی‌قیمت، {unassigned} جلسه بی‌مجری.',
          )
            .replace('{unpriced}', String(report.data.unpriced))
            .replace('{unassigned}', String(report.data.unassigned))}
        </p>
      ) : null}
    </section>
  )
}
