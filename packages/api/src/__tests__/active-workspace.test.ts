// ============================================
// The active-workspace registry.
//
// This exists because `@hisabche/store` depends on `@hisabche/api`, so api
// cannot read the store — the workspace is pushed in from the store side.
// That indirection is exactly the kind of thing that quietly stops working, so
// its contract is pinned here.
//
// The property that matters is the DEFAULT: unset must mean "no workspace",
// and no workspace must mean "subscribe to nothing". The opposite default
// would be a cross-tenant realtime subscription, so it is asserted directly
// rather than assumed.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getActiveWorkspaceId,
  onActiveWorkspaceChange,
  setActiveWorkspaceId,
  __resetActiveWorkspaceForTests,
} from '../lib/active-workspace'

const WS_A = 'workspace-a'
const WS_B = 'workspace-b'

beforeEach(() => {
  __resetActiveWorkspaceForTests()
})

describe('it fails closed before anything registers', () => {
  it('starts with no workspace', () => {
    // Not '' and not a sentinel that could reach a filter — null, which the
    // realtime layer treats as "do not subscribe".
    expect(getActiveWorkspaceId()).toBeNull()
  })
})

describe('publishing a workspace', () => {
  it('makes it readable', () => {
    setActiveWorkspaceId(WS_A)
    expect(getActiveWorkspaceId()).toBe(WS_A)
  })

  it('notifies listeners on change', () => {
    const seen: Array<string | null> = []
    onActiveWorkspaceChange((id) => seen.push(id))

    setActiveWorkspaceId(WS_A)
    setActiveWorkspaceId(WS_B)

    expect(seen).toEqual([WS_A, WS_B])
  })

  it('does not notify when the value is unchanged', () => {
    const listener = vi.fn()
    setActiveWorkspaceId(WS_A)
    onActiveWorkspaceChange(listener)

    setActiveWorkspaceId(WS_A)

    // useSyncExternalStore re-renders on every notification, and a store that
    // fires on no-ops turns each render into another render.
    expect(listener).not.toHaveBeenCalled()
  })

  it('publishes the transition to null on sign-out', () => {
    const seen: Array<string | null> = []
    setActiveWorkspaceId(WS_A)
    onActiveWorkspaceChange((id) => seen.push(id))

    setActiveWorkspaceId(null)

    // This is what tears down channels belonging to a workspace the user has
    // just stopped being a member of.
    expect(seen).toEqual([null])
    expect(getActiveWorkspaceId()).toBeNull()
  })
})

describe('listener hygiene', () => {
  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn()
    const off = onActiveWorkspaceChange(listener)

    off()
    setActiveWorkspaceId(WS_A)

    expect(listener).not.toHaveBeenCalled()
  })

  it('one throwing listener does not silence the others', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const seen: string[] = []

    onActiveWorkspaceChange(() => {
      throw new Error('boom')
    })
    onActiveWorkspaceChange(() => seen.push('survivor'))

    setActiveWorkspaceId(WS_A)

    expect(seen).toEqual(['survivor'])
    warn.mockRestore()
  })

  it('lets a listener unsubscribe from inside its own callback', () => {
    const seen: string[] = []
    let off: (() => void) | null = null

    off = onActiveWorkspaceChange(() => {
      seen.push('self-removing')
      off?.()
    })
    onActiveWorkspaceChange(() => seen.push('other'))

    // Iterating the live set would have skipped 'other' here.
    setActiveWorkspaceId(WS_A)

    expect(seen).toEqual(['self-removing', 'other'])
  })
})
