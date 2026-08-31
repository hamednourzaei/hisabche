'use client'

// ============================================
// packages/ui/src/components/ui/state/work-state.tsx
//
// The platform adapter for `@hisabche/ui-contract`'s work state.
//
// ---------------------------------------------------------------------------
// WHAT THIS REPLACES
//
// Four components each rendered their own idea of "not saved yet", in their
// own words and their own colours: `offline-banner`, `sync-status`,
// `save-indicator`, `realtime-indicator`. They still exist and still work —
// this is not a rewrite of them. It is the ONE thing a capability screen
// mounts so that a new screen does not become the fifth vocabulary.
//
// The decision of WHICH state to show lives in the contract package, where it
// is pure and tested. This file only paints it, using the project's own Badge
// and Card and nothing else.
// ============================================

import { memo } from 'react'
import {
  WORK_STATE_PRESENTATION,
  describeWorkState,
  isWorthShowing,
  type WorkStateInput,
  type WorkStateTone,
} from '@hisabche/ui-contract'

import { Badge as UiBadge } from '../badge'
import { Button } from '../button'
import { Card, CardContent } from '../card'

/** Contract tone → the project's own Badge variant. One mapping, one place. */
const TONE_VARIANT: Record<
  WorkStateTone,
  'outline' | 'secondary' | 'success' | 'warning' | 'destructive'
> = {
  neutral: 'outline',
  info: 'secondary',
  good: 'success',
  warn: 'warning',
  bad: 'destructive',
}

export interface WorkStateProps extends WorkStateInput {
  /** Translator. A raw string is never accepted — §1.3 allows no literal. */
  t: (key: string, fallback?: string) => string
  /** Rendered next to the count for states that carry one. */
  countLabelKey?: string
}

/**
 * The compact form: one badge, for a header or a toolbar.
 *
 * Renders NOTHING when the state is `ready`. A permanent "everything is fine"
 * badge is a badge nobody reads, and it costs the space the real messages
 * need.
 */
export const WorkStateBadge = memo(function WorkStateBadge({ t, ...input }: WorkStateProps) {
  const message = describeWorkState(input)
  if (!isWorthShowing(message.state)) return null

  const presentation = WORK_STATE_PRESENTATION[message.state]

  return (
    <span
      // `assertive` is reserved for a refusal and an error. Announcing
      // "saving…" assertively interrupts a screen reader on every keystroke.
      role="status"
      aria-live={presentation.announce === 'silent' ? 'off' : presentation.announce}
    >
      <UiBadge variant={TONE_VARIANT[message.tone]}>
        {t(message.labelKey)}
        {message.count !== null ? (
          <span className="ms-1 tabular-nums" dir="ltr">
            {message.count}
          </span>
        ) : null}
      </UiBadge>
    </span>
  )
})

WorkStateBadge.displayName = 'WorkStateBadge'

export interface WorkStateNoteProps extends WorkStateProps {
  /** Offered only for states the contract marks actionable. */
  onAction?: () => void
  actionLabelKey?: string
}

/**
 * The full form: a panel that explains and offers the one thing to do.
 *
 * §57 — an error must answer what happened, why, and what can I do. The first
 * two are the label and the count; the third is `onAction`, and it is offered
 * only when the contract says the state is actionable. A "retry" button on
 * "you are offline" would be a button that does nothing.
 */
export const WorkStateNote = memo(function WorkStateNote({
  t,
  onAction,
  actionLabelKey,
  ...input
}: WorkStateNoteProps) {
  const message = describeWorkState(input)
  if (!isWorthShowing(message.state)) return null

  const presentation = WORK_STATE_PRESENTATION[message.state]
  const showAction = presentation.actionable && Boolean(onAction)

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div
          className="flex items-center gap-2"
          role="status"
          aria-live={presentation.announce === 'silent' ? 'off' : presentation.announce}
        >
          <UiBadge variant={TONE_VARIANT[message.tone]}>{t(message.labelKey)}</UiBadge>

          <span className="text-sm text-[hsl(var(--fg-secondary))]">
            {t(`${message.labelKey}_detail`, '')}
          </span>

          {message.count !== null ? (
            <span className="text-sm tabular-nums text-[hsl(var(--fg-secondary))]" dir="ltr">
              {message.count}
            </span>
          ) : null}
        </div>

        {showAction ? (
          <Button variant="outline" size="sm" onClick={onAction}>
            {t(actionLabelKey ?? 'common.retry')}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
})

WorkStateNote.displayName = 'WorkStateNote'
