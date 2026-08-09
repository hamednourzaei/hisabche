// ============================================
// Interaction and data states.
//
// Derived from states the repository already renders. `loading`, `empty`,
// `error` exist as components today (mobile: skeleton/empty-state/error-state,
// web: skeleton/empty-state/error-boundary). `offline` and `syncing` exist as
// banners on web and mobile. Nothing here is speculative.
// ============================================

/** Pointer/keyboard state of an interactive element. */
export type InteractionState = 'default' | 'hover' | 'active' | 'focused' | 'disabled' | 'selected'

/** Lifecycle of a data-bearing view. Every list and detail screen has these. */
export type DataState = 'idle' | 'loading' | 'empty' | 'populated' | 'error'

/** Lifecycle of a mutation. */
export type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

/**
 * Connectivity, from the offline-first architecture in packages/offline.
 * Presentation differs per platform; the states do not.
 */
export type SyncState = 'online' | 'offline' | 'syncing' | 'pending' | 'failed'

/** Accessibility expectations a platform adapter must honour. */
export interface A11yContract {
  /** Focus must be visibly indicated using `focus.ring`. */
  readonly focusVisible: true
  /** Disabled elements stay perceivable and are removed from the tab order. */
  readonly disabledIsNotHidden: true
  /** Every icon-only control carries an accessible label. */
  readonly iconOnlyNeedsLabel: true
  /** Errors are announced, not only coloured. */
  readonly errorIsAnnounced: true
  /** Status is never conveyed by colour alone. */
  readonly statusNotColourAlone: true
}

export const A11Y_CONTRACT: A11yContract = {
  focusVisible: true,
  disabledIsNotHidden: true,
  iconOnlyNeedsLabel: true,
  errorIsAnnounced: true,
  statusNotColourAlone: true,
}
