'use client'

// ============================================
// packages/ui/src/components/ui/orders/orders-view.tsx
//
// Sales orders — from the website, integrations and the dashboard. Props only.
//
// The buttons offered are exactly the moves the lifecycle allows from the
// order's state (docs/developer-platform-03-commerce-migration.sql). «Paid» is
// never a button: it follows the order's invoice.
//
// «Not set up yet» (503) and «not allowed» (403) are their own sentences,
// never an empty list (راهنمای سشن §۷٫۶).
// ============================================

import { memo, useMemo, useState } from 'react'
import type { OrderStatus } from '@hisabche/validation'
import type { OrderAction, SalesOrderRow } from '@hisabche/api'
import { ShoppingBag } from 'lucide-react'

import { useDateFormat } from '../../../hooks/use-date-format'
import { formatSelectedMoney } from '../../../lib/money-display'
import { DataTable, type TableColumn } from '../data-table'
import { SegmentedFilter } from '../segmented-filter'
import { CustomerPicker } from '../customer-picker'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  ListSection,
  Loading,
  Panel,
} from '../capability/capability-kit'

export type OrdersState = 'loading' | 'ready' | 'not-configured' | 'forbidden' | 'error'

export interface OrdersViewProps {
  t: (key: string, fallback?: string) => string
  state: OrdersState
  error: string | null
  status: OrderStatus | 'all'
  onStatusChange: (status: OrderStatus | 'all') => void
  rows: SalesOrderRow[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  selected: SalesOrderRow | null
  selectedLoading: boolean
  onSelect: (id: string | null) => void
  onAction: (input: {
    id: string
    action: OrderAction
    reason?: string
    customerId?: string
  }) => void
  busy: boolean
  actionError: string | null
  /** The server asked a person to choose the customer (two share the phone). */
  needsCustomer: boolean
  onRetry: () => void
}

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: 'warn',
  confirmed: 'info',
  invoiced: 'info',
  paid: 'good',
  fulfilled: 'good',
  cancelled: 'neutral',
}

/** The moves the lifecycle offers from each state — mirrored from transition_sales_order. */
export const ACTIONS_FROM: Record<OrderStatus, OrderAction[]> = {
  pending: ['confirm', 'cancel'],
  confirmed: ['invoice', 'cancel'],
  invoiced: ['fulfill'],
  paid: ['fulfill'],
  fulfilled: [],
  cancelled: [],
}

const FILTERS: Array<OrderStatus | 'all'> = [
  'all',
  'pending',
  'confirmed',
  'invoiced',
  'paid',
  'fulfilled',
  'cancelled',
]

export const OrdersView = memo(function OrdersView(props: OrdersViewProps) {
  const { t } = props
  const { dateTime } = useDateFormat()
  const [reason, setReason] = useState('')
  const [customer, setCustomer] = useState<{ id: string } | null>(null)

  const columns = useMemo<TableColumn<SalesOrderRow>[]>(
    () => [
      {
        id: 'number',
        labelKey: 'orders.number',
        labelFallback: 'orders.number',
        locked: true,
        render: (o) => (
          <span className="font-medium" dir="ltr">
            {o.order_number}
          </span>
        ),
      },
      {
        id: 'customer',
        labelKey: 'orders.customer',
        labelFallback: 'orders.customer',
        render: (o) => (
          <span>
            {o.customer_name}
            <span className="ms-2 text-xs text-[hsl(var(--fg-tertiary))]" dir="ltr">
              {o.customer_phone}
            </span>
          </span>
        ),
      },
      {
        id: 'total',
        labelKey: 'orders.total',
        labelFallback: 'orders.total',
        align: 'end',
        sortValue: (o) => Number(o.total),
        render: (o) => <span className="tabular-nums">{formatSelectedMoney(Number(o.total))}</span>,
      },
      {
        id: 'status',
        labelKey: 'orders.statusLabel',
        labelFallback: 'orders.statusLabel',
        render: (o) => <Badge tone={STATUS_TONE[o.status]}>{t(`orders.status.${o.status}`)}</Badge>,
      },
      {
        id: 'source',
        labelKey: 'orders.sourceLabel',
        labelFallback: 'orders.sourceLabel',
        showFrom: 'md',
        render: (o) => t(`orders.source.${o.source}`),
      },
      {
        id: 'created',
        labelKey: 'orders.created',
        labelFallback: 'orders.created',
        showFrom: 'sm',
        sortValue: (o) => o.created_at,
        render: (o) => dateTime(o.created_at),
      },
    ],
    [t, dateTime],
  )

  const pages = Math.max(1, Math.ceil(props.total / props.pageSize))
  const selected = props.selected

  return (
    <CapabilityPage>
      <CapabilityHeader title={t('orders.title')} description={t('orders.description')} />

      <SegmentedFilter
        label={t('orders.filterLabel')}
        value={props.status}
        onChange={props.onStatusChange}
        options={FILTERS.map((value) => ({
          value,
          label: value === 'all' ? t('orders.filterAll') : t(`orders.status.${value}`),
        }))}
      />

      <ListSection
        title={t('orders.listTitle')}
        description={`${t('orders.count')}: ${props.total}`}
      >
        {props.state === 'loading' ? (
          <Loading label={t('orders.loading')} />
        ) : props.state === 'not-configured' ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('orders.notConfigured')}</p>
        ) : props.state === 'forbidden' ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('orders.forbidden')}</p>
        ) : props.state === 'error' ? (
          <ErrorNote
            message={props.error ?? t('orders.loadError')}
            onRetry={props.onRetry}
            retryLabel={t('common.retry')}
          />
        ) : (
          <>
            <DataTable
              tableId="sales-orders"
              t={t}
              rows={props.rows}
              columns={columns}
              rowKey={(o) => o.id}
              onRowClick={(o) => props.onSelect(o.id)}
              minWidthClass="min-w-[360px]"
              emptyState={
                <EmptyState
                  icon={<ShoppingBag className="size-8" aria-hidden="true" />}
                  title={props.status === 'all' ? t('orders.emptyAll') : t('orders.emptyFiltered')}
                  description={t('orders.emptyHint')}
                />
              }
            />
            {pages > 1 && (
              <div className="flex items-center justify-between gap-2 pt-2 text-sm">
                <ActionButton
                  variant="quiet"
                  disabled={props.page === 0}
                  onClick={() => props.onPageChange(props.page - 1)}
                >
                  {t('orders.prev')}
                </ActionButton>
                <span dir="ltr">
                  {props.page + 1} / {pages}
                </span>
                <ActionButton
                  variant="quiet"
                  disabled={props.page + 1 >= pages}
                  onClick={() => props.onPageChange(props.page + 1)}
                >
                  {t('orders.next')}
                </ActionButton>
              </div>
            )}
          </>
        )}
      </ListSection>

      {props.selectedLoading && <Loading label={t('orders.loading')} />}

      {selected && (
        <Panel title={`${t('orders.detailTitle')} ${selected.order_number}`}>
          <div className="space-y-3 text-sm">
            <p>
              {selected.customer_name} · <span dir="ltr">{selected.customer_phone}</span>
              {selected.customer_email ? (
                <>
                  {' '}
                  · <span dir="ltr">{selected.customer_email}</span>
                </>
              ) : null}
            </p>
            {selected.customer_note && (
              <p className="text-[hsl(var(--fg-secondary))]">{selected.customer_note}</p>
            )}
            {selected.status === 'pending' && selected.expires_at && (
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('orders.expiresAt')}: {dateTime(selected.expires_at)}
              </p>
            )}
            {selected.cancel_reason && (
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('orders.cancelReason')}:{' '}
                {selected.cancel_reason === 'EXPIRED'
                  ? t('orders.expired')
                  : selected.cancel_reason}
              </p>
            )}

            <ul className="divide-y divide-[hsl(var(--border-default))]">
              {(selected.items ?? []).map((line) => (
                <li key={line.product_id} className="flex justify-between gap-2 py-2">
                  <span>
                    {line.product_name}
                    <span className="ms-2 text-xs text-[hsl(var(--fg-tertiary))]" dir="ltr">
                      × {Number(line.quantity)}
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {formatSelectedMoney(Number(line.line_total))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between font-semibold">
              <span>{t('orders.total')}</span>
              <span className="tabular-nums">{formatSelectedMoney(Number(selected.total))}</span>
            </p>

            {props.actionError && <ErrorNote message={props.actionError} />}

            {props.needsCustomer && selected.status === 'confirmed' && (
              <div className="space-y-2 rounded-xl bg-[hsl(var(--surface-muted))] p-3">
                <p>{t('orders.chooseCustomer')}</p>
                <CustomerPicker
                  value={null}
                  onChange={(c) => setCustomer(c ? { id: c.id } : null)}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {ACTIONS_FROM[selected.status].map((action) => (
                <ActionButton
                  key={action}
                  variant={
                    action === 'cancel' ? 'danger' : action === 'invoice' ? 'primary' : 'quiet'
                  }
                  disabled={
                    props.busy || (action === 'invoice' && props.needsCustomer && !customer)
                  }
                  onClick={() =>
                    props.onAction({
                      id: selected.id,
                      action,
                      ...(action === 'cancel' && reason.trim() ? { reason: reason.trim() } : {}),
                      ...(action === 'invoice' && customer ? { customerId: customer.id } : {}),
                    })
                  }
                >
                  {t(`orders.action.${action}`)}
                </ActionButton>
              ))}
            </div>
            {ACTIONS_FROM[selected.status].includes('cancel') && (
              <input
                name="reason"
                value={reason}
                maxLength={300}
                placeholder={t('orders.cancelReasonPlaceholder')}
                aria-label={t('orders.cancelReason')}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2"
              />
            )}
            {(selected.status === 'invoiced' || selected.status === 'paid') && (
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('orders.paidFollowsInvoice')}
              </p>
            )}
          </div>
        </Panel>
      )}
    </CapabilityPage>
  )
})

OrdersView.displayName = 'OrdersView'
