// ============================================
// Root providers — TanStack Query tuned for a desktop client.
// ============================================

import {
  createNotificationMutationCache,
  LOCAL_OWNER_HEADER,
  readStorage,
  registerEntitySyncReader,
  registerLocalTransport,
  registerOfflineQueue,
  setAppEdition,
  setOfflineTokenMode,
  STORAGE_KEYS,
} from '@hisabche/api'
import React, { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerCameraScanner } from '@hisabche/ui/barcode/camera-host'
import { registerReceiptPrinterHost } from '@hisabche/ui/print/printer-host'
import { ToastProvider } from '@hisabche/ui/toast-provider'
import { bindActiveWorkspace, useWorkspaceStore } from '@hisabche/store'

import { useAuthStore } from '@/features/auth/auth.store'
import { currentOutboxOwner } from '@/features/sync/outbox-owner'
import { hasSyncedTable } from '@/features/sync/device-sync-state'
import { MAX_ATTEMPTS, stagesSnapshot } from '@/features/sync/sync-engine'
import { reasonOf, stageOf } from '@/features/sync/outbox-stage'
import { bridge, localApi } from '@/shared/lib/bridge'
import {
  PERSISTED_CACHE_MAX_AGE_MS,
  cacheOwner,
  createPersistedQueryCache,
  createQueryCachePersister,
} from '@hisabche/api/src/lib/persisted-query-cache'

// The session a queued change belongs to. The local engine writes the domain
// row into the payload; a delivery / cancellation key ends with its own verb,
// so the clientId is the fallback when the payload carries no id.
function queuedEntityId(payload: Record<string, unknown>, clientId: string): string {
  const id = payload.id
  if (typeof id === 'string' && id.length > 0) return id
  return clientId.replace(/-(deliver|cancel)$/, '')
}

/**
 * Refusals that need a person's DECISION, not a retry: the settlement the
 * device chose could not be honoured, so the delivery has to be decided again.
 * Everything else the server refuses is `rejected` — still a person's job, but
 * the row itself is what it says it is.
 */
const ATTENTION_CODES = new Set([
  'INSUFFICIENT_PACKAGE_CREDIT',
  'SESSION_CHANGED',
  'SESSION_ALREADY_DELIVERED_DIFFERENTLY',
  'DELIVERED_INVOICE_CORRECTION_REQUIRED',
  'CREDIT_REFERENCE_MISSING',
  'SETTLEMENT_INVOICE_INVALID',
])

// Publish the active workspace into @hisabche/api, which scopes every realtime
// subscription to one business. At module scope rather than in an effect:
// React runs child effects before parent ones, so an effect here would fire
// after the realtime hooks had already looked for a workspace.
if (typeof window !== 'undefined') {
  bindActiveWorkspace()

  const local = localApi()
  if (local) {
    // ⚠️ THE OUTBOX ROW'S OWNER IS STAMPED AT THE MOMENT OF THE WRITE.
    //
    // The local engine writes the outbox row inside the invoice transaction.
    // The account that made the change is the session's — the same
    // `currentOutboxOwner()` the device queue stamps — so it travels with the
    // request instead of being guessed from the device's local user row.
    registerLocalTransport((req) => {
      const owner = currentOutboxOwner()
      return local.request({
        ...req,
        headers: owner.userId
          ? { ...req.headers, [LOCAL_OWNER_HEADER]: owner.userId }
          : req.headers,
      })
    })
  }

  const isOffline =
    (window as { __hisabcheEdition?: string }).__hisabcheEdition === 'offline' ||
    readStorage(STORAGE_KEYS.edition) === 'offline'

  if (isOffline) {
    setAppEdition('offline')
    setOfflineTokenMode(true)
  }

  // A host with a device database takes a write the network could not — see
  // packages/api/src/lib/offline-queue.ts. `__hisabcheOnline` is what the
  // mobile host reports (its WebView's navigator.onLine never changes).
  const device = bridge()
  if (device) {
    registerOfflineQueue({
      isOffline: () =>
        (window as { __hisabcheOnline?: boolean }).__hisabcheOnline === false ||
        navigator.onLine === false,
      // ⚠️ THE OWNER IS STAMPED HERE, AT THE MOMENT OF THE WRITE. A queued row
      // with no owner would be sent by whoever signs in next.
      enqueue: (entry) => device.db.enqueue({ ...entry, ...currentOutboxOwner() }),
      readRows: async (table, search, options) => {
        const page = await device.db.query<Record<string, unknown>>({
          table,
          search,
          limit: options?.limit ?? 500,
          offset: options?.offset ?? 0,
          ...(options?.where ? { where: options.where } : {}),
          ...(options?.orderBy ? { orderBy: options.orderBy } : {}),
          ...(options?.direction ? { direction: options.direction } : {}),
          ...(options?.searchColumns ? { searchColumns: options.searchColumns } : {}),
        })
        return { ...page, synced: hasSyncedTable(table) }
      },
      hasSynced: (table) => hasSyncedTable(table),
      // The scanner asks the device first (instant, and the only answer
      // offline). Two rows = ambiguous, so up to five are read, not one.
      findByBarcode: (barcode) =>
        device.db
          .query<Record<string, unknown>>({
            table: 'product',
            where: { barcode, is_active: 1 },
            limit: 5,
          })
          .then((page) => page.rows),
    })

    // ⚠️ A ROW'S OWN SYNC STATE, FROM THIS DEVICE'S OWN OUTBOX.
    //
    // The service-delivery list shows «in the queue» / «the server refused
    // this» beside each session. Only the host has a queue, so the host
    // registers the reader (`packages/api/src/lib/entity-sync-state.ts`) — the
    // same seam the offline queue uses. The browser registers nothing and the
    // column says «نامعلوم» instead of promising a server it never asked.
    registerEntitySyncReader(async (entityType) => {
      const entries = await device.db.queue()
      return entries
        .filter((entry) => entry.entity === entityType)
        .map((entry) => {
          const id = queuedEntityId(entry.payload, entry.clientId)
          const stage = stageOf(entry, stagesSnapshot().inFlight, MAX_ATTEMPTS)
          // A sale refused for the credit limit is waiting for an approver: it needs attention, it is not dead.
          if (stage === 'credit_validation') {
            return {
              entityType,
              entityId: id,
              state: 'attention',
              code: reasonOf(entry.lastError),
            } as const
          }
          if (stage === 'rejected') {
            const code = reasonOf(entry.lastError)
            return {
              entityType,
              entityId: id,
              state: code && ATTENTION_CODES.has(code) ? 'attention' : 'rejected',
              code,
            } as const
          }
          return { entityType, entityId: id, state: 'pending', code: null } as const
        })
    })

    // Receipts print silently to the chosen printer — a host capability the
    // browser build does not have (packages/ui/src/lib/print/printer-host.ts).
    registerReceiptPrinterHost({
      listPrinters: () => device.print.listPrinters(),
      printHtml: ({ html, deviceName, silent, pageWidthMm, copies }) =>
        device.print.html({
          html,
          silent,
          pageWidthMm,
          copies,
          ...(deviceName ? { deviceName } : {}),
        }),
      printEscPos: ({ data, deviceName }) =>
        device.print.escPos({ data, ...(deviceName ? { deviceName } : {}) }),
    })

    // The phone's camera as a barcode scanner. Only a host that HAS one
    // answers barcode.scan; elsewhere no camera button is drawn at all.
    const camera = device.barcode
    registerCameraScanner(camera ? { scan: () => camera.scan() } : null)
  }
}

function createQueryClient(): QueryClient {
  // Every successful write refreshes the notification badge, so the person who
  // just issued an invoice sees the count change without reloading.
  let ref: QueryClient | null = null
  const client = new QueryClient({
    mutationCache: createNotificationMutationCache(() => ref),
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2,
        // As long as a saved cache may be shown: a shorter gcTime drops a
        // screen not visited this session from memory, and the next save then
        // drops it from the device too (see persisted-query-cache.ts).
        gcTime: PERSISTED_CACHE_MAX_AGE_MS,
        retry: 2,
        // The window is long-lived; refetching on focus keeps a left-open
        // dashboard from going stale.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: 0 },
    },
  })
  ref = client
  return client
}

/**
 * Keeps the on-device query cache owned by whoever is signed in, in whichever
 * workspace — see persisted-query-cache.ts for why the owner is the design.
 */
function usePersistedQueryCache(client: QueryClient): void {
  const [cache] = useState(() =>
    createPersistedQueryCache(
      client,
      createQueryCachePersister(typeof window === 'undefined' ? undefined : window.localStorage),
    ),
  )
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const userId = useAuthStore((s) => s.session?.user?.id ?? null)
  const workspaceId = useWorkspaceStore((s) => s.workspaceId)

  useEffect(() => {
    // Before hydration "no user" means "not read yet", not "signed out" —
    // treating it as a sign-out would wipe the cache on every launch.
    if (!isHydrated) return
    void cache.setOwner(cacheOwner(userId, workspaceId))
  }, [cache, isHydrated, userId, workspaceId])
}

/**
 * ⚠️ THE WORKSPACE WAS NEVER LOADED IN THIS SHELL.
 *
 * `fetchWorkspace` had exactly one caller — the workspace settings page — so
 * on Windows, Mac, Android and iOS `workspaceId` stayed null unless someone
 * happened to open that page. Nothing failed: realtime quietly subscribed to
 * nothing (`subscribeToChannel` returns early without a workspace), the sync
 * engine ran with a null workspace, and the device cache had no owner to be
 * saved under. Signed in means loaded now. A failed request keeps what is
 * stored; only the server's own answer changes it (see workspace.slice.ts).
 */
function useLoadWorkspace(): void {
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const userId = useAuthStore((s) => s.session?.user?.id ?? null)
  const fetchWorkspace = useWorkspaceStore((s) => s.fetchWorkspace)

  useEffect(() => {
    if (isHydrated && userId) void fetchWorkspace(userId)
  }, [isHydrated, userId, fetchWorkspace])
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient)
  useLoadWorkspace()
  usePersistedQueryCache(client)
  return (
    <QueryClientProvider client={client}>
      {/* ⚠️ THIS WAS MISSING, AND IT CRASHED WHOLE SCREENS.
          `packages/ui` is shared with the web app, where `apps/web/app/[lang]/
          providers.tsx` mounts this. Desktop mounted only the query client, so
          every shared component that calls `useToast` threw

              Error: useToast must be used within ToastProvider

          and React Router's boundary replaced the page with an error. Settings
          was one — `BusinessStampSection` calls it — and any other shared
          component that reports success or failure through a toast was one
          mis-click away from the same thing.

          The two shells render the same components; they need the same
          providers under them. */}
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}
