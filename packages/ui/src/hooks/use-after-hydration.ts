'use client'

import { useSyncExternalStore } from 'react'

// A subscription that never fires: "has the client hydrated yet" never changes
// after it flips. Module-level so the identity is stable.
const subscribeToNothing = () => () => {}

/**
 * `false` for the server render AND the hydration render, `true` afterwards.
 *
 * For UI whose existence depends on data the server cannot have — anything
 * read from the persisted query cache or a persisted store. Rendering it on the
 * first client pass makes the DOM disagree with the server HTML (React #418).
 * `useSyncExternalStore` serves the server snapshot during hydration, so this
 * needs no effect and touches no auth or token state.
 */
export function useAfterHydration(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )
}
