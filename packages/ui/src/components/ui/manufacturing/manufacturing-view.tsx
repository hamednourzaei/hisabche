// packages/ui/src/components/ui/manufacturing/manufacturing-view.tsx
'use client'

import { memo, useMemo, useState, type ReactNode } from 'react'
import { Check, ClipboardList, Factory, History, Layers, Pencil, Plus } from 'lucide-react'
import type { BOM, WorkOrder } from '@hisabche/api'
import { formatDate as formatIntlDate, formatNumber } from '@hisabche/formatting'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import { Button } from '../button'
import { DataTable, TableFilterSelect, matchesSearch, type TableColumn } from '../data-table'
import { HubTabs } from '../hub-tabs'
import { SegmentedControl } from '../segmented-control'

/* ═══════════════════════════════════════════════════════════════════════════
   ManufacturingView — the manufacturing page.

   Four parts over ONE domain: two tabs on top and ONE switch under them, the
   way /customers is laid out (owner's request, 5 Oct 2026 — the row of four
   tabs is gone):

     ساخت      what is defined and planned   — فرمول‌های ساخت · دستورهای تولید
     سوابق     what was actually made        — تاریخچه‌ی تولید · گزارش

   The tabs are the shared `HubTabs`, the switch the shared `SegmentedControl`,
   and the two lists the shared
   `DataTable`. «ساخت محصول» is always one press away, whichever part is open.

   Presentational: rows come in as props; the history and the report are
   handed in as nodes because they page and fetch on their own.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ManufacturingTabId = 'boms' | 'workOrders' | 'history' | 'report'

/** The two groups, and the parts under each. */
export const MANUFACTURING_GROUPS = {
  make: ['boms', 'workOrders'],
  records: ['history', 'report'],
} as const
export type ManufacturingGroup = keyof typeof MANUFACTURING_GROUPS
const GROUPS: readonly ManufacturingGroup[] = ['make', 'records']
const GROUP_ICON = { make: Layers, records: History } as const

/** The group a part belongs to. */
export function manufacturingGroupOf(tab: ManufacturingTabId): ManufacturingGroup {
  return (MANUFACTURING_GROUPS.records as readonly string[]).includes(tab) ? 'records' : 'make'
}

export const WORK_ORDER_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'] as const

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
  const [bomSearch, setBomSearch] = useState('')
  const [bomFilter, setBomFilter] = useState('all')
  const [orderSearch, setOrderSearch] = useState('')
  const [orderFilter, setOrderFilter] = useState('all')

  const group = manufacturingGroupOf(activeTab)

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

  const partLabel: Record<ManufacturingTabId, string> = {
    boms: t('manufacturing.tabs.boms', 'فرمول‌های ساخت'),
    workOrders: t('manufacturing.tabs.workOrders', 'دستورهای تولید'),
    history: t('manufacturing.tabs.history', 'تاریخچه‌ی تولید'),
    report: t('manufacturing.tabs.report', 'گزارش'),
  }
  const productGone = t('manufacturing.history.productGone', 'کالا حذف شده')

  const bomRows = boms
    .filter((bom) => bomFilter === 'all' || bom.isActive === (bomFilter === 'active'))
    .filter((bom) => matchesSearch(bomSearch, [bom.product?.name ?? productGone]))
  const orderRows = workOrders
    .filter((workOrder) => orderFilter === 'all' || workOrder.status === orderFilter)
    .filter((workOrder) =>
      matchesSearch(orderSearch, [
        workOrder.product?.name ?? productGone,
        statusLabel(workOrder.status),
      ]),
    )

  const bomColumns: TableColumn<BOM>[] = [
    {
      id: 'product',
      labelKey: 'manufacturing.boms.product',
      labelFallback: 'محصول',
      locked: true,
      sortValue: (bom) => bom.product?.name ?? '',
      render: (bom) => <span className="font-medium">{bom.product?.name ?? productGone}</span>,
    },
    {
      id: 'version',
      labelKey: 'manufacturing.boms.version',
      labelFallback: 'نسخه',
      showFrom: 'md',
      sortValue: (bom) => bom.version,
      render: (bom) => (
        <span className="text-xs text-[hsl(var(--fg-secondary))]">
          {formatNumber(bom.version, locale, 0)}
        </span>
      ),
    },
    {
      id: 'items',
      labelKey: 'manufacturing.boms.itemsCount',
      labelFallback: 'تعداد اقلام',
      showFrom: 'md',
      sortValue: (bom) => bom.itemsCount,
      render: (bom) => (
        <span className="text-xs text-[hsl(var(--fg-secondary))]">
          {formatNumber(bom.itemsCount, locale, 0)}
        </span>
      ),
    },
    {
      id: 'unitCost',
      labelKey: 'manufacturing.boms.unitCost',
      labelFallback: 'بهای واحد',
      align: 'end',
      sortValue: (bom) => bom.unitCost,
      render: (bom) => (
        <span className="text-xs tabular-nums">
          {formatNumber(bom.unitCost, locale, 4)}{' '}
          {bom.currency ? t(`currency.${bom.currency.toLowerCase()}`, bom.currency) : ''}
        </span>
      ),
    },
    {
      id: 'status',
      labelKey: 'manufacturing.boms.status',
      labelFallback: 'وضعیت',
      sortValue: (bom) => (bom.isActive ? 0 : 1),
      render: (bom) => (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            bom.isActive ? STATUS_BADGE_MAP.completed : STATUS_BADGE_MAP.cancelled,
          )}
        >
          {bom.isActive
            ? t('manufacturing.boms.active', 'فعال')
            : t('manufacturing.boms.inactive', 'غیرفعال')}
        </span>
      ),
    },
    {
      id: 'edit',
      labelKey: 'manufacturing.panel.edit',
      labelFallback: 'ویرایش فرمول',
      locked: true,
      align: 'end',
      // Only the active revision is editable: an old one is history, and
      // editing the product's definition always starts from the current.
      render: (bom) =>
        bom.isActive && bom.product ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('manufacturing.panel.edit', 'ویرایش فرمول')}
            onClick={() => onEditDefinition(bom)}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
        ) : null,
    },
  ]

  const orderColumns: TableColumn<WorkOrder>[] = [
    {
      id: 'product',
      labelKey: 'manufacturing.workOrders.product',
      labelFallback: 'محصول',
      locked: true,
      sortValue: (workOrder) => workOrder.product?.name ?? '',
      render: (workOrder) => (
        <span className="font-medium">{workOrder.product?.name ?? productGone}</span>
      ),
    },
    {
      id: 'quantity',
      labelKey: 'manufacturing.workOrders.quantity',
      labelFallback: 'تعداد',
      align: 'end',
      sortValue: (workOrder) => workOrder.quantity,
      render: (workOrder) => (
        <span className="text-xs tabular-nums text-[hsl(var(--fg-secondary))]">
          {formatNumber(workOrder.quantity, locale, 4)}
        </span>
      ),
    },
    {
      id: 'status',
      labelKey: 'manufacturing.workOrders.status',
      labelFallback: 'وضعیت',
      sortValue: (workOrder) => workOrder.status,
      render: (workOrder) => (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            STATUS_BADGE_MAP[workOrder.status] || STATUS_BADGE_MAP.planned,
          )}
        >
          {statusLabel(workOrder.status)}
        </span>
      ),
    },
    {
      id: 'startDate',
      labelKey: 'manufacturing.workOrders.startDate',
      labelFallback: 'تاریخ شروع',
      showFrom: 'sm',
      sortValue: (workOrder) => workOrder.startDate,
      render: (workOrder) => (
        <span className="whitespace-nowrap text-xs text-[hsl(var(--fg-secondary))]">
          {formatDate(dateLang, workOrder.startDate)}
        </span>
      ),
    },
    {
      id: 'actions',
      labelKey: 'manufacturing.workOrders.actions',
      labelFallback: 'عملیات',
      locked: true,
      align: 'end',
      // «تکمیل» opens the production form: completing an order IS producing
      // it — components, cost, stock — not flipping a status. A finished order
      // has no button at all.
      render: (workOrder) =>
        workOrder.status !== 'completed' &&
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
        ) : null,
    },
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

      {/* Like /customers: two tabs on top, ONE switch under them. */}
      <HubTabs
        label={t('manufacturing.groupsLabel', 'بخش')}
        items={GROUPS.map((id) => ({
          id,
          label: t(`manufacturing.groups.${id}`, id),
          icon: GROUP_ICON[id],
        }))}
        active={group}
        // Opening a tab opens its first part.
        onSelect={(next) => onTabChange(MANUFACTURING_GROUPS[next][0])}
      />
      <>
        <SegmentedControl
          branch
          label={t('manufacturing.partsLabel', 'نما')}
          options={MANUFACTURING_GROUPS[group].map((value) => ({
            value,
            label: partLabel[value],
          }))}
          value={activeTab as (typeof MANUFACTURING_GROUPS)[ManufacturingGroup][number]}
          onChange={onTabChange}
        />
      </>

      {activeTab === 'history' ? <div className={shell}>{history}</div> : null}
      {activeTab === 'report' ? report : null}

      {activeTab === 'boms' || activeTab === 'workOrders' ? (
        // A failed read is shown as a failure — never as an empty table.
        error ? (
          <div
            role="alert"
            className="rounded-2xl border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.05)] p-4 text-center text-[hsl(var(--color-destructive))] text-sm"
          >
            {error}
          </div>
        ) : isLoading ? (
          <div className={cn(shell, 'space-y-3 p-8')}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))]"
              />
            ))}
          </div>
        ) : activeTab === 'boms' ? (
          <DataTable
            tableId="manufacturing-boms"
            t={t}
            rows={bomRows}
            columns={bomColumns}
            rowKey={(bom) => bom.id}
            searchValue={bomSearch}
            onSearchChange={setBomSearch}
            actions={
              <TableFilterSelect
                label={t('manufacturing.boms.status', 'وضعیت')}
                value={bomFilter}
                onChange={setBomFilter}
                allValue="all"
                options={[
                  { value: 'all', label: t('common.all', 'همه') },
                  { value: 'active', label: t('manufacturing.boms.active', 'فعال') },
                  { value: 'inactive', label: t('manufacturing.boms.inactive', 'غیرفعال') },
                ]}
              />
            }
            minWidthClass="min-w-[420px]"
            emptyState={
              <div className="p-12 text-center">
                <Layers
                  className="mx-auto mb-3 size-12 text-[hsl(var(--fg-tertiary))]"
                  aria-hidden="true"
                />
                <p className="mb-3 text-[hsl(var(--fg-secondary))]">
                  {boms.length === 0
                    ? t('manufacturing.boms.empty', 'هیچ فرمول ساختی ثبت نشده')
                    : t('manufacturing.noMatch', 'چیزی با این فیلتر نیست')}
                </p>
                {boms.length === 0 ? (
                  <Button type="button" size="sm" onClick={onProduce}>
                    <Plus className="size-4" aria-hidden="true" />
                    {t('manufacturing.produce', 'ساخت محصول')}
                  </Button>
                ) : null}
              </div>
            }
          />
        ) : (
          <DataTable
            tableId="manufacturing-work-orders"
            t={t}
            rows={orderRows}
            columns={orderColumns}
            rowKey={(workOrder) => workOrder.id}
            searchValue={orderSearch}
            onSearchChange={setOrderSearch}
            actions={
              <TableFilterSelect
                label={t('manufacturing.workOrders.status', 'وضعیت')}
                value={orderFilter}
                onChange={setOrderFilter}
                allValue="all"
                options={[
                  { value: 'all', label: t('common.all', 'همه') },
                  ...WORK_ORDER_STATUSES.map((status) => ({
                    value: status as string,
                    label: statusLabel(status),
                  })),
                ]}
              />
            }
            minWidthClass="min-w-[420px]"
            emptyState={
              <div className="p-12 text-center">
                <ClipboardList
                  className="mx-auto mb-3 size-12 text-[hsl(var(--fg-tertiary))]"
                  aria-hidden="true"
                />
                <p className="mb-3 text-[hsl(var(--fg-secondary))]">
                  {workOrders.length === 0
                    ? t('manufacturing.workOrders.empty', 'هیچ دستور تولیدی ثبت نشده')
                    : t('manufacturing.noMatch', 'چیزی با این فیلتر نیست')}
                </p>
                {workOrders.length === 0 ? (
                  <Button type="button" variant="outline" size="sm" onClick={onOpenCreateWorkOrder}>
                    <Plus className="size-4" aria-hidden="true" />
                    {t('manufacturing.workOrders.create', 'دستور تولید جدید')}
                  </Button>
                ) : null}
              </div>
            }
          />
        )
      ) : null}
    </div>
  )
})

ManufacturingView.displayName = 'ManufacturingView'
