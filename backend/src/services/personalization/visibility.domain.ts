// ============================================
// backend/src/services/personalization/visibility.domain.ts
//
// What a user has chosen NOT to see.
//
// ---------------------------------------------------------------------------
// THE ONE RULE THIS FILE EXISTS TO ENFORCE
//
//   VISIBILITY IS NOT AUTHORIZATION.
//
// Hiding something is a preference. It never grants, revokes, or modifies
// permission, and it never deletes or disables data. The order is always:
//
//   1. Authorization decides what the user MAY see   (authorization core)
//   2. Visibility decides what they WANT to see      (this file)
//
// Never the reverse. Resolving visibility first and treating the result as
// access would turn a UI preference into a security boundary, and the day
// somebody un-hides a module they would gain data they were never allowed.
//
// So `resolveVisibility` takes the authorized set as an input and can only
// ever return a SUBSET of it. There is no code path here that adds anything.
//
// ---------------------------------------------------------------------------
// FOUR LEVELS
//
//   module   the whole area           "I don't do manufacturing"
//   page     one screen inside it     "I never open the aging report"
//   widget   one block on a screen    "hide the profit chart"
//   field    one input on a form      "I don't use weight in grams"
//
// Advanced FIELDS default to hidden; everything else defaults to visible. A
// new module appearing in an update should show up, but a new expert-level
// field should not clutter a shopkeeper's invoice form uninvited.
// ============================================

export type VisibilityLevel = 'module' | 'page' | 'widget' | 'field'

export interface UiVisibilityProfile {
  workspaceId: string
  userId: string
  modules: Record<string, boolean>
  pages: Record<string, boolean>
  widgets: Record<string, boolean>
  /** Expert-level inputs. Absent means HIDDEN — the opposite of the others. */
  advancedFields: Record<string, boolean>
  updatedAt?: string
}

export function emptyProfile(workspaceId: string, userId: string): UiVisibilityProfile {
  return { workspaceId, userId, modules: {}, pages: {}, widgets: {}, advancedFields: {} }
}

const BUCKET: Record<
  VisibilityLevel,
  keyof Pick<UiVisibilityProfile, 'modules' | 'pages' | 'widgets' | 'advancedFields'>
> = {
  module: 'modules',
  page: 'pages',
  widget: 'widgets',
  field: 'advancedFields',
}

/**
 * Is this key visible to this user?
 *
 * An unset key is visible for modules, pages and widgets, and HIDDEN for
 * advanced fields. That asymmetry is deliberate and is the whole shape of the
 * feature: the product grows by adding things people can see, and it stays
 * usable by not adding expert inputs to everyone's forms.
 */
export function isVisible(
  profile: UiVisibilityProfile,
  level: VisibilityLevel,
  key: string,
): boolean {
  const stored = profile[BUCKET[level]][key]
  if (stored !== undefined) return stored
  return level !== 'field'
}

/**
 * The keys this user should be shown, out of the ones they are ALLOWED.
 *
 * `authorized` is the gate; this function can only remove from it. Passing a
 * key here that authorization did not include cannot make it appear — which
 * is what makes "visibility is not authorization" true in code rather than
 * only in a comment.
 */
export function resolveVisibility(
  profile: UiVisibilityProfile,
  level: VisibilityLevel,
  authorized: string[],
): string[] {
  return authorized.filter((key) => isVisible(profile, level, key))
}

export type VisibilityRuleCode =
  'VISIBILITY_KEY_INVALID' | 'VISIBILITY_LEVEL_INVALID' | 'VISIBILITY_TOO_MANY_KEYS'

/** Keys are stable identifiers the client and server agree on, not free text. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,80}$/i
const MAX_KEYS_PER_LEVEL = 500

export function validatePatch(
  level: string,
  entries: Record<string, boolean>,
): VisibilityRuleCode[] {
  const problems: VisibilityRuleCode[] = []

  if (!['module', 'page', 'widget', 'field'].includes(level)) {
    problems.push('VISIBILITY_LEVEL_INVALID')
  }

  const keys = Object.keys(entries)

  // A profile is one row per user; an unbounded map of client-supplied keys is
  // an unbounded row.
  if (keys.length > MAX_KEYS_PER_LEVEL) problems.push('VISIBILITY_TOO_MANY_KEYS')

  if (keys.some((key) => !KEY_PATTERN.test(key))) problems.push('VISIBILITY_KEY_INVALID')

  return [...new Set(problems)]
}

/** Apply a patch, returning a new profile. Unmentioned keys are untouched. */
export function applyPatch(
  profile: UiVisibilityProfile,
  level: VisibilityLevel,
  entries: Record<string, boolean>,
): UiVisibilityProfile {
  const bucket = BUCKET[level]
  return { ...profile, [bucket]: { ...profile[bucket], ...entries } }
}

/**
 * Everything the user has hidden, so the UI can always offer it back.
 *
 * Non-negotiable: there is ALWAYS a way to un-hide. A preference that cannot
 * be reversed is indistinguishable from a bug, and the person who hit it has
 * no way to tell which it was.
 */
export function hiddenKeys(profile: UiVisibilityProfile): Array<{
  level: VisibilityLevel
  key: string
}> {
  const hidden: Array<{ level: VisibilityLevel; key: string }> = []

  for (const level of ['module', 'page', 'widget', 'field'] as VisibilityLevel[]) {
    for (const [key, visible] of Object.entries(profile[BUCKET[level]])) {
      if (!visible) hidden.push({ level, key })
    }
  }

  return hidden
}

// ─── Onboarding suggestions ──────────────────────────────────────────────────

export interface UsageSignal {
  /** The key the signal is about. */
  key: string
  level: VisibilityLevel
  /** How many times the user opened or used it in the observed window. */
  uses: number
  /** Days since they last used it, or null if never. */
  daysSinceLastUse: number | null
}

export type SuggestionKind = 'hide' | 'show'

export interface Suggestion {
  level: VisibilityLevel
  key: string
  kind: SuggestionKind
  reason: string
}

/**
 * What the system might propose, given how the person actually works.
 *
 * It PROPOSES. Nothing here changes a profile: the user answers with
 * [add] [hide] [not now] [stop suggesting], and until they do, the interface
 * stays exactly as it was. An interface that rearranges itself based on
 * inferred intent is one people stop trusting.
 */
export function suggestFrom(
  profile: UiVisibilityProfile,
  signals: UsageSignal[],
  options: { minDaysObserved: number; unusedAfterDays?: number } = { minDaysObserved: 14 },
): Suggestion[] {
  // Too early to infer anything. A week of a new shop's behaviour says more
  // about learning the app than about how they will use it.
  if (options.minDaysObserved < 14) return []

  const unusedAfter = options.unusedAfterDays ?? 30
  const suggestions: Suggestion[] = []

  for (const signal of signals) {
    const visible = isVisible(profile, signal.level, signal.key)

    if (visible && signal.uses === 0 && (signal.daysSinceLastUse ?? Infinity) >= unusedAfter) {
      suggestions.push({
        level: signal.level,
        key: signal.key,
        kind: 'hide',
        reason: 'never_used',
      })
      continue
    }

    // Something they hid but keep reaching for — usually because it is
    // reachable another way. Worth offering back, never restoring silently.
    if (!visible && signal.uses > 0) {
      suggestions.push({
        level: signal.level,
        key: signal.key,
        kind: 'show',
        reason: 'used_while_hidden',
      })
    }
  }

  return suggestions
}
