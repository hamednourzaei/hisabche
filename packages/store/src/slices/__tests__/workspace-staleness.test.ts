import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useWorkspaceStore } from '../workspace.slice'

/**
 * A persisted `workspaceId` the server does not confirm.
 *
 * This is the bug that cost a full day of debugging, and it is worth stating
 * precisely because the symptom pointed somewhere else entirely.
 *
 *   1. the database was reset — every workspace dropped
 *   2. `workspaceId` survived in localStorage, because the store persists it
 *   3. `fetchWorkspace` got back `[]` and did `set({ loading: false })`,
 *      leaving the dead id exactly where it was
 *   4. every request carried a workspace that no longer existed → 403
 *
 * A hundred 403s in the console read as an authorization failure. The actual
 * defect was a client-side cache trusting itself over the server, and the only
 * way out was clearing site data by hand.
 *
 * ⚠️ The rule these tests encode: a SUCCESSFUL empty answer is evidence and
 * must be honoured. A FAILED request is not evidence about anything and must
 * leave stored state alone.
 */

const ORIGINAL_FETCH = globalThis.fetch

/** Puts the store in the state a returning user's browser would restore. */
function withStoredWorkspace(id: string) {
  useWorkspaceStore.setState({
    workspaceId: id,
    workspaceName: 'Stale Business',
    members: [],
    hasNoWorkspace: null,
    loading: false,
  })
}

function mockFetch(handler: (url: string) => { ok: boolean; body?: unknown }) {
  globalThis.fetch = vi.fn(async (input: unknown) => {
    const { ok, body } = handler(String(input))
    return { ok, json: async () => body } as Response
  }) as unknown as typeof fetch
}

describe('workspace store — stale persisted id', () => {
  beforeEach(() => {
    vi.mock('@hisabche/api-client', () => ({}))
  })

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
    vi.restoreAllMocks()
  })

  it('clears a stored workspace the server no longer lists', async () => {
    withStoredWorkspace('aa166a46-275c-49d8-8ffa-e1e3242896bb')

    // The exact shape after a database reset: authenticated, zero workspaces.
    mockFetch(() => ({ ok: true, body: [] }))

    await useWorkspaceStore.getState().fetchWorkspace('2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e')

    const state = useWorkspaceStore.getState()

    expect(state.workspaceId, 'a workspace the server does not list must not survive').toBeNull()
    expect(
      state.hasNoWorkspace,
      'the UI needs this to route to onboarding instead of a dashboard',
    ).toBe(true)
  })

  it('keeps a stored workspace when the request FAILS', async () => {
    const stored = 'aa166a46-275c-49d8-8ffa-e1e3242896bb'
    withStoredWorkspace(stored)

    // Offline, or an expired token. This says nothing about which workspaces
    // exist — and this product is offline-first, so a failed request during a
    // network drop must not log the user out of their own books.
    mockFetch(() => ({ ok: false }))

    await useWorkspaceStore.getState().fetchWorkspace('2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e')

    const state = useWorkspaceStore.getState()

    expect(state.workspaceId, 'a failed request is not evidence of absence').toBe(stored)
    expect(state.hasNoWorkspace, 'nothing was learned, so nothing is claimed').not.toBe(true)
  })

  it('prefers the stored workspace when the server still lists it', async () => {
    const stored = 'bbbbbbbb-0000-0000-0000-000000000002'
    withStoredWorkspace(stored)

    // Two workspaces, the stored one SECOND. Taking `[0]` unconditionally
    // would silently move the user into a different business's books — which
    // in an accounting product means posting a sale to the wrong company.
    mockFetch((url) => {
      if (url.endsWith('/workspaces')) {
        return {
          ok: true,
          body: [
            { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Other' },
            { id: stored, name: 'Stale Business' },
          ],
        }
      }
      return {
        ok: true,
        body: [
          {
            id: 'm1',
            user_id: '2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e',
            role: 'owner',
            joined_at: '2026-01-01',
          },
        ],
      }
    })

    await useWorkspaceStore.getState().fetchWorkspace('2a51e3d6-e3c9-4947-ab4f-5bbc54a8ec8e')

    expect(useWorkspaceStore.getState().workspaceId, 'the user chose this one').toBe(stored)
  })

  it('does not persist hasNoWorkspace', () => {
    // ⚠️ It is the server's answer, re-asked on every load. Persisted, a
    // remembered "you have none" would survive being invited to one — and the
    // user would be sent to onboarding forever.
    const source = String(useWorkspaceStore.persist?.getOptions?.().partialize ?? '')

    expect(source, 'partialize must not carry hasNoWorkspace').not.toContain('hasNoWorkspace')
  })
})
