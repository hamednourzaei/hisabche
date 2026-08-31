// ============================================
// packages/ui-contract/src/work-state.ts
//
// ONE state, resolved from many, so every screen says the same thing.
//
// ---------------------------------------------------------------------------
// THE PROBLEM THIS SOLVES
//
// `state.ts` already names three independent axes: a data lifecycle, a submit
// lifecycle, and a connectivity state. All three are true at once, constantly.
// A shopkeeper on a weak connection, editing an invoice, with one unresolved
// conflict from this morning, is simultaneously `populated`, `submitting`,
// `offline` and in conflict.
//
// Nothing decided what they SEE. So each screen decided for itself, and the
// product grew four vocabularies for one situation: `offline-banner`,
// `sync-status`, `save-indicator` and `realtime-indicator` each render their
// own idea of "not saved yet", in their own words, in their own colours.
//
// This module is the missing decision: given everything that is true, which
// ONE thing does the user need to be told. It is pure data and pure functions
// so the answer is the same on web, desktop and mobile, and so the precedence
// can be argued with in a test rather than in three codebases.
//
// ---------------------------------------------------------------------------
// WHY PRECEDENCE, NOT A LIST
//
// Showing everything true at once is how a screen ends up with three badges
// contradicting each other. The order below is by what the person can DO about
// it, most actionable first — not by technical severity.
//
// `forbidden` outranks everything because no other message is worth reading if
// the answer is "not you". `conflict` outranks `offline` because a conflict is
// work waiting for a decision, while being offline is a condition that will
// pass on its own.
// ============================================

/**
 * The ten states §5 of the roadmap requires every applicable experience to
 * support. Written once, here.
 */
export const WORK_STATES = [
  'forbidden',
  'error',
  'conflict',
  'offline',
  'syncing',
  'saving',
  'saved',
  'loading',
  'empty',
  'ready',
] as const

export type WorkState = (typeof WORK_STATES)[number]

/**
 * Everything a screen might know at once. Every field optional: a screen that
 * cannot be offline simply does not pass `isOffline`, rather than passing
 * `false` and implying it checked.
 */
export interface WorkStateInput {
  /** The server said no. Not "the button is hidden" — an actual refusal. */
  isForbidden?: boolean
  /** Something failed and the user must see it. */
  hasError?: boolean
  /** Unresolved conflicts waiting for a human decision. */
  conflictCount?: number
  /** No connection. Writes are queued locally. */
  isOffline?: boolean
  /** Queued local writes still to reach the server. */
  pendingCount?: number
  /** A sync run is in flight. */
  isSyncing?: boolean
  /** A mutation is in flight. */
  isSaving?: boolean
  /** A mutation completed recently enough to still be worth confirming. */
  justSaved?: boolean
  /** A read is in flight and there is nothing to show yet. */
  isLoading?: boolean
  /** The read finished and returned nothing. */
  isEmpty?: boolean
}

/**
 * Most actionable first. The index in this array IS the precedence, so adding
 * a state means deciding where it sits — which is the decision, not an
 * afterthought.
 */
const PRECEDENCE: readonly WorkState[] = WORK_STATES

export function statePrecedence(state: WorkState): number {
  return PRECEDENCE.indexOf(state)
}

/**
 * Which single state the user is told about.
 *
 * ⚠️ `loading` deliberately ranks BELOW `saving` and `offline`. A background
 * refetch while the user is mid-edit must not replace "saving…" with a
 * skeleton — that reads as the work being thrown away. A screen with nothing
 * to show yet has `isLoading` and nothing else true, so it still resolves to
 * `loading`.
 *
 * ⚠️ `empty` ranks below `loading` for the same reason in reverse: a list that
 * has not loaded yet is not an empty list, and telling someone "no customers"
 * before the request returns is a lie they may act on.
 */
export function resolveWorkState(input: WorkStateInput): WorkState {
  if (input.isForbidden) return 'forbidden'
  if (input.hasError) return 'error'
  if ((input.conflictCount ?? 0) > 0) return 'conflict'
  if (input.isOffline) return 'offline'
  if (input.isSyncing || (input.pendingCount ?? 0) > 0) return 'syncing'
  if (input.isSaving) return 'saving'
  if (input.justSaved) return 'saved'
  if (input.isLoading) return 'loading'
  if (input.isEmpty) return 'empty'
  return 'ready'
}

/* ─── How each state is presented ─────────────────────────────────────────── */

/**
 * The colour ROLE, never a colour. Adapters map these to their platform's
 * tokens; this package is forbidden from holding a literal.
 */
export type WorkStateTone = 'neutral' | 'info' | 'good' | 'warn' | 'bad'

/**
 * Whether the state must be ANNOUNCED to assistive technology, and how
 * insistently.
 *
 * `assertive` is reserved for the two states that change what the user may do:
 * a refusal and an error. Announcing "saving…" assertively interrupts a screen
 * reader mid-sentence on every keystroke, which is how a conscientious
 * accessibility feature becomes the reason someone turns it off.
 */
export type Announcement = 'assertive' | 'polite' | 'silent'

export interface WorkStatePresentation {
  readonly tone: WorkStateTone
  readonly announce: Announcement
  /** i18n key for the short label. Never literal text. */
  readonly labelKey: string
  /** Whether this state means the screen has no content to show. */
  readonly blocksContent: boolean
  /** Whether the user is expected to do something about it. */
  readonly actionable: boolean
}

export const WORK_STATE_PRESENTATION: Record<WorkState, WorkStatePresentation> = {
  forbidden: {
    tone: 'bad',
    announce: 'assertive',
    labelKey: 'state.forbidden',
    blocksContent: true,
    actionable: false,
  },
  error: {
    tone: 'bad',
    announce: 'assertive',
    labelKey: 'state.error',
    blocksContent: true,
    actionable: true,
  },
  conflict: {
    tone: 'warn',
    announce: 'polite',
    labelKey: 'state.conflict',
    // A conflict does NOT hide the screen. The books are still readable; one
    // record needs a decision. Blanking the page over it would make a small
    // problem look like an outage.
    blocksContent: false,
    actionable: true,
  },
  offline: {
    tone: 'warn',
    announce: 'polite',
    labelKey: 'state.offline',
    blocksContent: false,
    actionable: false,
  },
  syncing: {
    tone: 'info',
    announce: 'polite',
    labelKey: 'state.syncing',
    blocksContent: false,
    actionable: false,
  },
  saving: {
    tone: 'info',
    announce: 'polite',
    labelKey: 'state.saving',
    blocksContent: false,
    actionable: false,
  },
  saved: {
    tone: 'good',
    announce: 'polite',
    labelKey: 'state.saved',
    blocksContent: false,
    actionable: false,
  },
  loading: {
    tone: 'neutral',
    announce: 'polite',
    labelKey: 'state.loading',
    blocksContent: true,
    actionable: false,
  },
  empty: {
    tone: 'neutral',
    announce: 'polite',
    labelKey: 'state.empty',
    blocksContent: true,
    actionable: true,
  },
  ready: {
    tone: 'neutral',
    announce: 'silent',
    labelKey: 'state.ready',
    blocksContent: false,
    actionable: false,
  },
}

/**
 * Is this state worth showing at all?
 *
 * `ready` is the absence of news. A badge that says "everything is fine" on
 * every screen at all times is a badge nobody reads, and it costs the space
 * the real messages need.
 */
export function isWorthShowing(state: WorkState): boolean {
  return state !== 'ready'
}

/**
 * The offline promise, in the user's terms.
 *
 * §19 asks for one language across the whole product: "Saved", "Syncing",
 * "Offline — changes saved locally", "1 change needs review". The count is
 * carried separately from the key so a translator can write a plural rule
 * rather than the app concatenating a number onto a sentence.
 */
export interface WorkStateMessage {
  readonly state: WorkState
  readonly labelKey: string
  readonly count: number | null
  readonly tone: WorkStateTone
  readonly announce: Announcement
}

export function describeWorkState(input: WorkStateInput): WorkStateMessage {
  const state = resolveWorkState(input)
  const presentation = WORK_STATE_PRESENTATION[state]

  const count =
    state === 'conflict'
      ? (input.conflictCount ?? 0)
      : state === 'syncing'
        ? (input.pendingCount ?? 0)
        : null

  return {
    state,
    labelKey: presentation.labelKey,
    // A zero is not worth rendering — "syncing 0 changes" is noise.
    count: count && count > 0 ? count : null,
    tone: presentation.tone,
    announce: presentation.announce,
  }
}
