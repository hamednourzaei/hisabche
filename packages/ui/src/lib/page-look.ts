'use client'

// ============================================
// «نمای شخصی» — what ONE person chose not to see on a page.
//
// A cashier who never reads the sales chart hides it; the chart is then not
// mounted, its query does not run and its realtime channel does not open. That
// is the point: hiding is a way to do less work, not a coat of paint.
//
// ⚠️ THIS IS NOT PERMISSION, AND IT CAN NEVER BECOME ONE.
//
//   permission     the owner decides what a role may see. Enforced by the
//                  server; a denied part is not in the menu and its page is
//                  not mounted (NoAccessNotice).
//   this           the person decides what they WANT to see, among the things
//                  they may. Nothing here is read by the server, and nothing
//                  here can show a part the role does not include — the
//                  permission is applied first, and a hidden id for a part the
//                  person no longer may see is simply never asked about.
//
// ONE store, on the device, keyed by `user.workspace`: a choice made in one
// business does not follow the person into another, and two people sharing a
// computer do not inherit each other's page. Stable ids («salesChart»), never
// positions.
//
// It is the same kind of thing as the table's hidden columns
// (data-table/use-table-state) — a look, not data — and like them it lives on
// the device. It is not synced between devices.
// ============================================

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useAuthStore, useWorkspaceStore } from '@hisabche/store'

const PREFIX = 'hisabche.look.'
const NOTHING: readonly string[] = Object.freeze([])

type Looks = Record<string, readonly string[]>

/** Parsed once per owner, so a snapshot is the same object until it changes. */
const cache = new Map<string, Looks>()
const listeners = new Set<() => void>()

function load(owner: string): Looks {
  const known = cache.get(owner)
  if (known) return known
  let looks: Looks = {}
  try {
    const raw = window.localStorage.getItem(PREFIX + owner)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      looks = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>)
          .filter(([, ids]) => Array.isArray(ids))
          .map(([page, ids]) => [
            page,
            Object.freeze((ids as unknown[]).filter((id): id is string => typeof id === 'string')),
          ]),
      )
    }
  } catch {
    // Unreadable or blocked storage: nothing is hidden. The page still works.
  }
  cache.set(owner, looks)
  return looks
}

function save(owner: string, looks: Looks): void {
  cache.set(owner, looks)
  try {
    window.localStorage.setItem(PREFIX + owner, JSON.stringify(looks))
  } catch {
    // A full or blocked storage must not break the toggle; the choice then
    // lasts for this visit.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  // Another tab of the same person changing their page.
  const onStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith(PREFIX)) return
    cache.delete(event.key.slice(PREFIX.length))
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** `user.workspace`, or null while either is not known yet. */
export function lookOwner(
  userId: string | null | undefined,
  workspaceId: string | null | undefined,
): string | null {
  return userId && workspaceId ? `${userId}.${workspaceId}` : null
}

export interface PageLook {
  /**
   * The owner is known and the stored choice has been read. Until then nothing
   * is known to be hidden — and nothing may FETCH on the assumption that it is
   * shown: use `active()` for a query's `enabled`.
   */
  ready: boolean
  hiddenIds: readonly string[]
  /** Not hidden. For RENDERING: before `ready`, a part shows its loading state. */
  shows: (id: string) => boolean
  /** Ready and not hidden. For a query's `enabled` and a subscription. */
  active: (id: string) => boolean
  toggle: (id: string) => void
  /** Show everything on this page again. */
  reset: () => void
}

/** One page's look for the signed-in person in the active business. */
export function usePageLook(pageId: string): PageLook {
  const userId = useAuthStore((state) => state.user?.id ?? null)
  const workspaceId = useWorkspaceStore((state) => state.workspaceId)
  const owner = lookOwner(userId, workspaceId)

  const hiddenIds = useSyncExternalStore(
    subscribe,
    () => (owner ? (load(owner)[pageId] ?? NOTHING) : NOTHING),
    // The server knows no person: it renders as if nothing were hidden, and the
    // client takes over after hydration without a mismatch.
    () => NOTHING,
  )
  const ready = owner !== null

  const toggle = useCallback(
    (id: string) => {
      if (!owner) return
      const looks = load(owner)
      const current = looks[pageId] ?? NOTHING
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
      save(owner, { ...looks, [pageId]: Object.freeze(next) })
    },
    [owner, pageId],
  )

  const reset = useCallback(() => {
    if (!owner) return
    const looks = { ...load(owner) }
    delete looks[pageId]
    save(owner, looks)
  }, [owner, pageId])

  return useMemo(
    () => ({
      ready,
      hiddenIds,
      shows: (id: string) => !hiddenIds.includes(id),
      active: (id: string) => ready && !hiddenIds.includes(id),
      toggle,
      reset,
    }),
    [hiddenIds, ready, reset, toggle],
  )
}

/** Tests only: forget what was read from storage. */
export function __resetPageLooks(): void {
  cache.clear()
}
