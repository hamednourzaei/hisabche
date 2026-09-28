'use client'

// ============================================
// packages/ui/src/components/ui/orders/containers/orders-container.tsx
//
// Every data hook of the orders screen lives here; the view takes props only.
// ============================================

import { memo, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ORDER_ERROR_CODES, type OrderStatus } from '@hisabche/validation'
import {
  ORDERS_PAGE_SIZE,
  apiErrorMessage,
  useOrder,
  useOrderAction,
  useOrders,
} from '@hisabche/api'

import { OrdersView, type OrdersState } from '../orders-view'

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status
}
function codeOf(error: unknown): string | undefined {
  return (error as { response?: { data?: { code?: string } } } | null)?.response?.data?.code
}

export const OrdersContainer = memo(function OrdersContainer() {
  const tOriginal = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const value = tOriginal(key as Parameters<typeof tOriginal>[0])
      return value && value !== key ? value : (fallback ?? key)
    },
    [tOriginal],
  )

  const [status, setStatus] = useState<OrderStatus | 'all'>('pending')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [needsCustomer, setNeedsCustomer] = useState(false)

  const orders = useOrders(status, page)
  const selected = useOrder(selectedId)
  const action = useOrderAction()

  let state: OrdersState = 'ready'
  if (orders.isLoading) state = 'loading'
  else if (orders.error) {
    const s = statusOf(orders.error)
    state = s === 503 ? 'not-configured' : s === 403 ? 'forbidden' : 'error'
  }

  return (
    <OrdersView
      t={t}
      state={state}
      error={orders.error ? apiErrorMessage(orders.error, t('orders.loadError')) : null}
      status={status}
      onStatusChange={(next) => {
        setStatus(next)
        setPage(0)
      }}
      rows={orders.data?.rows ?? []}
      total={orders.data?.total ?? 0}
      page={page}
      pageSize={ORDERS_PAGE_SIZE}
      onPageChange={setPage}
      selected={selected.data ?? null}
      selectedLoading={Boolean(selectedId) && selected.isLoading}
      onSelect={(id) => {
        setSelectedId(id)
        setActionError(null)
        setNeedsCustomer(false)
      }}
      busy={action.isPending}
      actionError={actionError}
      needsCustomer={needsCustomer}
      onAction={(input) => {
        setActionError(null)
        action.mutate(input, {
          onSuccess: () => setNeedsCustomer(false),
          onError: (err) => {
            const code = codeOf(err)
            // Two customers share the phone, or none exists and this person
            // may not create one: ask which customer — never guess.
            if (code === 'ORDER_CUSTOMER_AMBIGUOUS' || code === 'ORDER_CUSTOMER_REQUIRED') {
              setNeedsCustomer(true)
              setActionError(t(`orders.error.${code}`))
              return
            }
            // Only a code on the shared list has a sentence; anything else is
            // read as the server wrote it (t() throws on an unknown key).
            setActionError(
              code && (ORDER_ERROR_CODES as readonly string[]).includes(code)
                ? t(`orders.error.${code}`)
                : apiErrorMessage(err, t('orders.actionFailed')),
            )
          },
        })
      }}
      onRetry={() => void orders.refetch()}
    />
  )
})

OrdersContainer.displayName = 'OrdersContainer'
