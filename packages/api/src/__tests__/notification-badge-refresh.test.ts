// ============================================
// The unread badge moves without a page reload.
//
// ⚠️ THE BUG THIS PREVENTS: realtime was the ONLY mechanism, and it was
// silent. `notifications` was never in the `supabase_realtime` publication, so
// the subscription connected, reported SUBSCRIBED, and was never told
// anything — which looks exactly like «nothing changed». Issuing an invoice
// updated the badge only after a reload.
//
// The tab that CAUSED the change now refreshes on its own. Realtime remains
// the path for somebody else's changes, and needs the publication for it.
// ============================================

import { MutationCache, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { createNotificationMutationCache } from '../lib/notification-refresh'

function harness() {
  let client: QueryClient | null = null
  const cache: MutationCache = createNotificationMutationCache(() => client)
  client = new QueryClient({ mutationCache: cache, defaultOptions: { mutations: { retry: 0 } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue()
  return { client, invalidate }
}

const run = async (
  client: QueryClient,
  options: { mutationKey?: readonly unknown[]; fail?: boolean } = {},
) => {
  const mutation = client.getMutationCache().build(client, {
    ...(options.mutationKey ? { mutationKey: options.mutationKey } : {}),
    mutationFn: async () => {
      if (options.fail) throw new Error('nope')
      return 'ok'
    },
  })
  await mutation.execute(undefined).catch(() => {})
}

describe('a successful write refreshes the badge', () => {
  it('⚠️ any mutation — not a list of the ones somebody remembered', () => {
    // Wiring this into each hook would be thirty places to forget one, and
    // the forgotten one is the one the user notices.
    const { client, invalidate } = harness()
    return run(client, { mutationKey: ['invoices'] }).then(() => {
      const keys = invalidate.mock.calls.map(
        (call) => (call[0] as { queryKey: string[] }).queryKey[0],
      )
      expect(keys).toContain('notifications')
      expect(keys).toContain('activities')
    })
  })

  it('⚠️ NOT after a failure — nothing was created, and a broken endpoint would storm', () => {
    const { client, invalidate } = harness()
    return run(client, { mutationKey: ['invoices'], fail: true }).then(() => {
      expect(invalidate).not.toHaveBeenCalled()
    })
  })

  it('⚠️ a notification mutation does not invalidate twice', () => {
    // `useMarkAsRead` already invalidates its own keys.
    const { client, invalidate } = harness()
    return run(client, { mutationKey: ['notifications'] }).then(() => {
      expect(invalidate).not.toHaveBeenCalled()
    })
  })

  it('survives a client that is not there yet', () => {
    // The cache is built before the client exists — see the TDZ note in the
    // web providers.
    const cache = createNotificationMutationCache(() => null)
    const client = new QueryClient({ mutationCache: cache })
    return expect(run(client, { mutationKey: ['invoices'] })).resolves.toBeUndefined()
  })
})
