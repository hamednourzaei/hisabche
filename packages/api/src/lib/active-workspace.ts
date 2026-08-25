// ============================================
// packages/api/src/lib/active-workspace.ts
//
// Which workspace this client is currently acting in, for the parts of
// `packages/api` that need it — today, the realtime subscription filter.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT JUST `useWorkspaceStore()`
//
// It would be, if the dependency graph allowed it. It does not:
// `@hisabche/store` already depends on `@hisabche/api`, so importing the store
// here makes a cycle and pnpm refuses to build the workspace. (CLAUDE.md
// describes the direction as `api → store`; the manifests say the opposite,
// and the manifests are what runs.)
//
// So the value is PUSHED in by whoever owns the store rather than pulled out
// of it. `WorkspaceSync` in @hisabche/store does that in one effect.
//
// ---------------------------------------------------------------------------
// IT FAILS CLOSED
//
// The initial value is `null`, and `null` means "subscribe to nothing" — never
// "subscribe to everything". A caller that forgets to register loses realtime
// wake-ups, which is a performance regression; the alternative default would
// have been a cross-tenant subscription, which is a breach. Those are not
// comparable, so the safe one is the default.
// ============================================

type Listener = (workspaceId: string | null) => void

let activeWorkspaceId: string | null = null
const listeners = new Set<Listener>()

/** The current workspace, or null when none is resolved yet. */
export function getActiveWorkspaceId(): string | null {
  return activeWorkspaceId
}

/**
 * Publish the active workspace.
 *
 * Called by the store binding on every change, including the change to `null`
 * on sign-out — which is what tears down subscriptions belonging to a
 * workspace the user has just stopped being a member of.
 */
export function setActiveWorkspaceId(workspaceId: string | null): void {
  if (workspaceId === activeWorkspaceId) return

  activeWorkspaceId = workspaceId

  // A copy: a listener may unregister from inside its own callback, and
  // mutating the live set mid-iteration would skip the next one.
  for (const listener of [...listeners]) {
    try {
      listener(workspaceId)
    } catch (err) {
      console.warn('[active-workspace] listener threw:', err)
    }
  }
}

/** Observe changes. Returns an unsubscribe function. */
export function onActiveWorkspaceChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test-only reset. */
export function __resetActiveWorkspaceForTests(): void {
  activeWorkspaceId = null
  listeners.clear()
}
