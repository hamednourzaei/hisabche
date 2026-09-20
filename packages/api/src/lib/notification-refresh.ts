// ============================================
// packages/api/src/lib/notification-refresh.ts
//
// The unread badge updates when THIS tab causes a notification.
//
// ---------------------------------------------------------------------------
// ⚠️ REALTIME IS NOT ENOUGH ON ITS OWN — AND IT WAS THE ONLY THING WIRED UP.
//
// `useUnreadCount` subscribes to the `notifications` table and waits to be
// told that something changed. Two problems with that as the ONLY mechanism:
//
//   1. Postgres only broadcasts a table that is in the `supabase_realtime`
//      PUBLICATION. `notifications` was never added to it (see
//      docs/realtime-publication-migration.sql), so the subscription is
//      connected, healthy, and silent. Nothing in the client can tell the
//      difference between «no change» and «never told about a change».
//
//   2. Even with the publication, the round trip is Postgres → Realtime →
//      socket → invalidate → refetch. The user who just issued the invoice is
//      looking at the bell now.
//
// So the tab that CAUSED the change refreshes on its own: every successful
// mutation asks the notification queries to refetch. Realtime stays as the
// path for changes made by somebody ELSE — that is what it is for, and what
// it still needs the publication to do.
//
// ⚠️ ONE CACHE, NOT A CALL IN EVERY HOOK. Wiring this into each mutation
// would be thirty places to forget one, and the one forgotten is the one the
// user notices.
// ============================================

import { MutationCache, type QueryClient } from '@tanstack/react-query'

/** Keys the badge and the panel read. Kept beside them in `hooks/notifications`. */
const NOTIFICATION_KEY = 'notifications'
const ACTIVITY_KEY = 'activities'

/**
 * A `MutationCache` that refreshes the notification badge after any successful
 * write.
 *
 * ⚠️ `onSuccess`, NOT `onSettled`. A failed mutation created no notification,
 * and refetching after every failure turns a broken endpoint into a refetch
 * storm on top of it.
 *
 * ⚠️ The refetch is NOT awaited and its failure is swallowed: a badge that
 * could not refresh must never surface as an error over a save that worked.
 */
export function createNotificationMutationCache(
  getQueryClient: () => QueryClient | null,
): MutationCache {
  return new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      const queryClient = getQueryClient()
      if (!queryClient) return

      // A notification mutation invalidating itself would loop: mark-as-read
      // succeeds → invalidate → refetch → (no mutation) — the refetch is not a
      // mutation, so it terminates, but the extra round trip is pointless
      // because those hooks already invalidate their own keys.
      const key = mutation.options.mutationKey?.[0]
      if (key === NOTIFICATION_KEY) return

      void queryClient.invalidateQueries({ queryKey: [NOTIFICATION_KEY] })
      // The activity feed is fed by the same server-side events.
      void queryClient.invalidateQueries({ queryKey: [ACTIVITY_KEY] })
    },
  })
}
