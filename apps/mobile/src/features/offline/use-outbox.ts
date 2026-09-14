// ============================================
// Outbox hooks — optimistic reads + automatic draining.
// ============================================

import { useEffect, useMemo, useRef, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { useQueryClient } from '@tanstack/react-query'
import type { InvoiceWithCustomer } from '@hisabche/api'

import { useOutboxStore, type OutboxEntry } from './outbox.store'
import { runSync } from './sync-runner'
import { persistQueryCache, restoreQueryCache } from './query-cache-persistence'

/** Queued invoices projected into the shape the list already renders. */
export function usePendingInvoices(): InvoiceWithCustomer[] {
  const entries = useOutboxStore((s) => s.entries)

  return useMemo(
    () =>
      entries.filter((e) => e.kind === 'invoice.create').map((entry) => toInvoicePreview(entry)),
    [entries],
  )
}

function toInvoicePreview(entry: OutboxEntry): InvoiceWithCustomer {
  return {
    ...entry.payload,
    id: entry.clientId,
    invoiceNumber: '—',
    status: entry.status === 'failed' ? 'cancelled' : 'pending',
    customerName: null,
  } as InvoiceWithCustomer
}

export function usePendingCount(): number {
  return useOutboxStore((s) => s.entries.length)
}

/** Live connectivity flag, so the UI can surface offline state immediately. */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false)
    })
    return unsubscribe
  }, [])

  return offline
}

/**
 * Restores this session's stored reads at start and keeps them current, so a
 * screen opened without a connection shows real local data. Scoped per
 * workspace (or user); the memory cache is emptied on sign-out.
 */
export function usePersistentQueryCache(scope: string | null): void {
  const queryClient = useQueryClient()
  const previous = useRef<string | null>(null)

  useEffect(() => {
    if (!scope) {
      // Signed out: nothing of the previous session stays in memory either.
      if (previous.current) queryClient.clear()
      previous.current = null
      return
    }
    previous.current = scope

    let cancelled = false
    let stop: () => void = () => undefined
    void restoreQueryCache(queryClient, scope).finally(() => {
      if (!cancelled) stop = persistQueryCache(queryClient, scope)
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [queryClient, scope])
}

/** Drains the queue on mount and whenever the device comes back online. */
export function useSyncOnReconnect(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    void runSync(queryClient)

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void runSync(queryClient)
    })

    return unsubscribe
  }, [queryClient])
}
