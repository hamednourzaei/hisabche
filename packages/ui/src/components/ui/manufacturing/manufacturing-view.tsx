// packages/ui/src/components/ui/manufacturing/manufacturing-view.tsx
'use client'

import { memo, useMemo, type ReactNode } from 'react'
import {
  BarChart3,
  Check,
  ClipboardList,
  Factory,
  History,
  Layers,
  Pencil,
  Plus,
} from 'lucide-react'
import type { BOM, WorkOrder } from '@hisabche/api'
import { formatDate as formatIntlDate, formatNumber } from '@hisabche/formatting'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'

/* ═══════════════════════════════════════════════════════════════════════════
   ManufacturingView — the manufacturing page.

   Four tabs over ONE domain: the definitions, the planned orders, what was
   actually made, and the report. «ساخت محصول» is always one press away,
   whichever tab is open.

   Presentational: rows come in as props; the history and the report are
   handed in as nodes because they page and fetch on their own.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ManufacturingTabId = 'boms' | 'workOrders' | 'history' | 'report'

interface ManufacturingViewProps {
  t: (key: string, fallback?: string) => string
  locale: string
  activeTab: ManufacturingTabId
  onTabChange: (tab: ManufacturingTabId) => void
  boms: BOM[]
  workOrders: WorkOrder[]
  isLoading: boolean
  error?: string | null
  onProduce: () => void
  onEditDefinition: (bom: BOM) => void
  onCompleteWorkOrder: (workOrder: WorkOrder) => void
  onOpenCreateWorkOrder: () => void
  history: ReactNode
  report: ReactNode
}

const STATUS_BADGE_MAP: Record<string, string> = {
  planned: 'bg-[hsl(var(--fg-tertiary)/0.12)] text-[hsl(var(--fg-tertiary))]',
  in_progress: 'bg-[hsl(var(--color-info)/0.12)] text-[hsl(var(--color-info))]',
  completed: 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))]',
  cancelled: 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]',
}

const th = 'px-4 py-3 text-start font-medium text-[hsl(var(--fg-secondary))] text-xs'

function formatDate(lang: string, date: string | null): string {
  if (!date) return '-'
  try {
    return formatIntlDate(date, lang, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return date
  }
}

export const ManufacturingView = memo(function ManufacturingView({
  t,
  locale,
  activeTab,
  onTabChange,
  boms,
  workOrders,
  isLoading,
  error,
  onProduce,
  onEditDefinition,
  onCompleteWorkOrder,
  onOpenCreateWorkOrder,
  history,
  report,
}: ManufacturingViewProps) {
  const { lang: dateLang } = useDateFormat()

  const statusLabel = useMemo(
    () => (status: string) => {
      const map: Record<string, string> = {
        planned: t('manufacturing.status.planned', 'برنامه‌ریزی‌شده'),
        in_progress: t('manufacturing.status.inProgress', 'در حال انجام'),
        completed: t('manufacturing.status.completed', 'تکمیل‌شده'),
        cancelled: t('manufacturing.status.cancelled', 'لغوشده'),
      }
      return map[status] || status
    },
    [t],
  )

  const tabs: Array<{ id: ManufacturingTabId; label: string; icon: typeof Layers }> = [
    { id: 'boms', label: t('manufacturing.tabs.boms', 'فرمول‌های ساخت'), icon: Layers },
    {
      id: 'workOrders',
      label: t('manufacturing.tabs.workOrders', 'دستورهای تولید'),
      icon: ClipboardList,
    },
    { id: 'history', label: t('manufacturing.tabs.history', 'تاریخچه‌ی تولید'), icon: History },
    { id: 'report', label: t('manufacturing.tabs.report', 'گزارش'), icon: BarChart3 },
  ]

  const shell =
    'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden'

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Factory className="size-6 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {t('nav.production', 'ساخت و تولید')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'workOrders' ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenCreateWorkOrder}>
              <Plus className="size-4" aria-hidden="true" />
              {t('manufacturing.workOrders.create', 'دستور تولید جدید')}
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={onProduce}>
            <Plus className="size-4" aria-hidden="true" />
            {t('manufacturing.produce', 'ساخت محصول')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        className="flex items-center gap-1 overflow-x-auto border-b border-[hsl(var(--border-default))]"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-[hsl(var(--color-primary))] text-[hsl(var(--color-primary))]'
                : 'border-transparent text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]',
            )}
          >
            <tab.icon className="size-4" aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'history' ? <div className={shell}>{history}</div> : null}
      {activeTab === 'report' ? report : null}

      {activeTab === 'boms' || activeTab === 'workOrders' ? (
        <>
          {/* A failed read is shown as a failure — never as an empty table. */}
          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.05)] p-4 text-center text-[hsl(var(--color-destructive))]"
            >
              {error}
            </div>
          ) : (
            <div className={shell}>
              {isLoading ? (
                <div className="p-8 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-12 rounded-xl bg-[hsl(var(--surface-muted))] animate-pulse"
                    />
                  ))}
                </div>
              ) : activeTab === 'boms' ? (
                boms.length === 0 ? (
                  <div className="p-12 text-center">
                    <Layers
                      className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]"
                      aria-hidden="true"
                    />
                    <p className="text-[hsl(var(--fg-secondary))] mb-3">
                      {t('manufacturing.boms.empty', 'هیچ فرمول ساختی ثبت نشده')}
                    </p>
                    <Button type="button" size="sm" onClick={onProduce}>
                      <Plus className="size-4" aria-hidden="true" />
                      {t('manufacturing.produce', 'ساخت محصول')}
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                          <th className={th}>{t('manufacturing.boms.product', 'محصول')}</th>
                          <th className={th}>{t('manufacturing.boms.version', 'نسخه')}</th>
                          <th className={th}>
                            {t('manufacturing.boms.itemsCount', 'تعداد اقلام')}
                          </th>
                          <th className={th}>{t('manufacturing.boms.unitCost', 'بهای واحد')}</th>
                          <th className={cn(th, 'text-center')}>
                            {t('manufacturing.boms.status', 'وضعیت')}
                          </th>
                          <th className={th}>
                            <span className="sr-only">
                              {t('manufacturing.panel.edit', 'ویرایش فرمول')}
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {boms.map((bom) => (
                          <tr
                            key={bom.id}
                            className="border-b border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors"
                          >
                            <td className="px-4 py-3 text-[hsl(var(--fg-primary))]">
                              {bom.product?.name ??
                                t('manufacturing.history.productGone', 'کالا حذف شده')}
                            </td>
                            <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))]">
                              {formatNumber(bom.version, locale, 0)}
                            </td>
                            <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))]">
                              {formatNumber(bom.itemsCount, locale, 0)}
                            </td>
                            <td className="px-4 py-3 text-xs tabular-nums text-[hsl(var(--fg-primary))]">
                              {formatNumber(bom.unitCost, locale, 4)}{' '}
                              {bom.currency
                                ? t(`currency.${bom.currency.toLowerCase()}`, bom.currency)
                                : ''}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-xs font-medium',
                                  bom.isActive
                                    ? STATUS_BADGE_MAP.completed
                                    : STATUS_BADGE_MAP.cancelled,
                                )}
                              >
                                {bom.isActive
                                  ? t('manufacturing.boms.active', 'فعال')
                                  : t('manufacturing.boms.inactive', 'غیرفعال')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {/* Only the active revision is editable: an old
                                  one is history, and editing the product's
                                  definition always starts from the current. */}
                              {bom.isActive && bom.product ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t('manufacturing.panel.edit', 'ویرایش فرمول')}
                                  onClick={() => onEditDefinition(bom)}
                                >
                                  <Pencil className="size-4" aria-hidden="true" />
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : workOrders.length === 0 ? (
                <div className="p-12 text-center">
                  <ClipboardList
                    className="size-12 mx-auto mb-3 text-[hsl(var(--fg-tertiary))]"
                    aria-hidden="true"
                  />
                  <p className="text-[hsl(var(--fg-secondary))] mb-3">
                    {t('manufacturing.workOrders.empty', 'هیچ دستور تولیدی ثبت نشده')}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={onOpenCreateWorkOrder}>
                    <Plus className="size-4" aria-hidden="true" />
                    {t('manufacturing.workOrders.create', 'دستور تولید جدید')}
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))]">
                        <th className={th}>{t('manufacturing.workOrders.product', 'محصول')}</th>
                        <th className={th}>{t('manufacturing.workOrders.quantity', 'تعداد')}</th>
                        <th className={th}>{t('manufacturing.workOrders.status', 'وضعیت')}</th>
                        <th className={cn(th, 'hidden sm:table-cell')}>
                          {t('manufacturing.workOrders.startDate', 'تاریخ شروع')}
                        </th>
                        <th className={cn(th, 'text-center')}>
                          {t('manufacturing.workOrders.actions', 'عملیات')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {workOrders.map((workOrder) => (
                        <tr
                          key={workOrder.id}
                          className="border-b border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted)/0.5)] transition-colors"
                        >
                          <td className="px-4 py-3 text-[hsl(var(--fg-primary))]">
                            {workOrder.product?.name ??
                              t('manufacturing.history.productGone', 'کالا حذف شده')}
                          </td>
                          <td className="px-4 py-3 text-xs tabular-nums text-[hsl(var(--fg-secondary))]">
                            {formatNumber(workOrder.quantity, locale, 4)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-xs font-medium',
                                STATUS_BADGE_MAP[workOrder.status] || STATUS_BADGE_MAP.planned,
                              )}
                            >
                              {statusLabel(workOrder.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[hsl(var(--fg-secondary))] hidden sm:table-cell whitespace-nowrap">
                            {formatDate(dateLang, workOrder.startDate)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {/* «تکمیل» opens the production form: completing an
                                order IS producing it — components, cost, stock —
                                not flipping a status. A finished order has no
                                button at all. */}
                            {workOrder.status !== 'completed' &&
                            workOrder.status !== 'cancelled' &&
                            workOrder.product ? (
                              <button
                                type="button"
                                onClick={() => onCompleteWorkOrder(workOrder)}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium',
                                  'border border-[hsl(var(--color-success)/0.4)] text-[hsl(var(--color-success))]',
                                  'hover:bg-[hsl(var(--color-success)/0.08)]',
                                )}
                              >
                                <Check className="size-3.5" aria-hidden="true" />
                                {t('manufacturing.workOrders.complete', 'تکمیل')}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
})

ManufacturingView.displayName = 'ManufacturingView'
