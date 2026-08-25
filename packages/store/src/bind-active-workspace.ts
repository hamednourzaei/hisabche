// ============================================
// packages/store/src/bind-active-workspace.ts
//
// Publishes the active workspace from this store into `@hisabche/api`, so the
// realtime layer can scope its subscriptions to one business.
//
// ---------------------------------------------------------------------------
// WHY THE BINDING LIVES HERE AND NOT IN packages/api
//
// `@hisabche/store` depends on `@hisabche/api`, not the other way round. So
// api cannot read this store — importing it there is a dependency cycle that
// pnpm refuses to build. The dependency direction decides which side pushes,
// and this is the side that can.
//
// It is a `subscribe` on the vanilla store rather than a React hook: the value
// must be published from the moment the app starts, including before any
// component that cares has mounted, and including on sign-out when those
// components are unmounting.
// ============================================

import { setActiveWorkspaceId } from '@hisabche/api'

import { useWorkspaceStore } from './slices/workspace.slice'

let bound = false

/**
 * Start mirroring `workspaceId` into the api package. Idempotent.
 *
 * Call once during app start-up — `apps/web`, `apps/desktop` and `apps/admin`
 * each do this in their root provider. Until it is called, realtime resolves
 * no workspace and therefore subscribes to NOTHING, which is the safe failure:
 * missed wake-ups rather than a cross-tenant subscription.
 */
export function bindActiveWorkspace(): () => void {
  if (bound) return () => {}
  bound = true

  // Publish the current value immediately. The store rehydrates from
  // localStorage synchronously, so by the time this runs a returning user
  // already has their workspace and should not wait for a change event that
  // may never come.
  setActiveWorkspaceId(useWorkspaceStore.getState().workspaceId)

  const unsubscribe = useWorkspaceStore.subscribe((state, previous) => {
    if (state.workspaceId === previous.workspaceId) return
    // Includes the transition to null on sign-out, which is what closes
    // channels belonging to a workspace the user has just left.
    setActiveWorkspaceId(state.workspaceId)
  })

  return () => {
    bound = false
    unsubscribe()
  }
}
