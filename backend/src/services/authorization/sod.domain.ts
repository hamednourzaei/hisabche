// ============================================
// backend/src/services/authorization/sod.domain.ts
//
// Segregation of duties: pairs of things ONE person must not do to the SAME
// document, even when their role grants both.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT JUST ANOTHER CAPABILITY
//
// Capabilities answer "may this role do this". SoD answers a different
// question: "may this PERSON do this, given what they already did to THIS
// record". An owner holds every capability by definition, and an owner who
// records a payment and then cancels it themselves is exactly the sequence
// SoD exists to catch — no capability check can see it, because nothing about
// the role is wrong.
//
// So the input is not a role. It is a role, an actor, a document, and what
// that actor has already done to it.
//
// ---------------------------------------------------------------------------
// SMALL SHOPS ARE THE COMMON CASE
//
// Most Hisabche workspaces are one or two people, where every rule below would
// block ordinary work. SoD is therefore OFF by default and turned on per
// workspace, and even when on it supports a recorded override rather than a
// dead end. A control that forces people to share a login is worse than no
// control at all.
// ============================================

import type { Capability, WorkspaceRole } from './authorization.domain'

export type SoDMode =
  /** Not enforced. The default, and correct for a one-person shop. */
  | 'off'
  /** Enforced, but a person with the authority may override with a reason. */
  | 'warn'
  /** Enforced with no override. */
  | 'strict'

export interface SoDSettings {
  mode: SoDMode
  /** Rule ids the workspace has deliberately switched off. */
  disabledRules: string[]
}

export const DEFAULT_SOD_SETTINGS: SoDSettings = { mode: 'off', disabledRules: [] }

export interface SoDRule {
  id: string
  /** The action being attempted. */
  capability: Capability
  /**
   * Actions on the SAME document that make the attempt a conflict. Recorded
   * as capabilities so the two halves speak the same vocabulary.
   */
  conflictsWith: Capability[]
  /**
   * ⚠️ J5 — the entity both halves are recorded against.
   *
   * `SoDService.priorActions` looks up by `(entity_type, entity_id)`, so a
   * rule whose two halves live on DIFFERENT entities can never fire: the
   * prior action is filed under a key the check never queries.
   *
   * Two of the original five rules were exactly that — `account.manage` on an
   * account paired with `ledger.post` on a journal entry, and `invoice.update`
   * on an invoice paired with `ledger.reverse` on a journal entry. Both read
   * as real controls and neither had ever been capable of blocking anything.
   *
   * Naming the entity here makes that shape impossible to write again, and
   * `sod-rule-coverage.test.ts` checks every rule against its real call sites.
   */
  entityType: string
  /** Why, in one sentence, for the person who is refused. */
  rationale: string
}

/**
 * The rules.
 *
 * Each is a real separation a bookkeeper would recognise, not a generic
 * "creator cannot approve" template: the whole point of naming them
 * individually is that a workspace can switch off the one that does not fit
 * how it works without switching off the rest.
 */
export const SOD_RULES: SoDRule[] = [
  {
    id: 'payment.record-then-cancel',
    capability: 'payment.cancel',
    conflictsWith: ['payment.record'],
    entityType: 'payment',
    rationale: 'The person who took the money should not be the one who erases the record of it.',
  },
  {
    id: 'invoice.create-then-delete',
    capability: 'invoice.delete',
    conflictsWith: ['invoice.create'],
    entityType: 'invoice',
    rationale: 'Raising a document and removing it are the two halves of hiding a sale.',
  },
  {
    id: 'ledger.post-then-reverse',
    capability: 'ledger.reverse',
    conflictsWith: ['ledger.post'],
    entityType: 'journal_entry',
    rationale: 'Posting an entry and reversing it unobserved leaves no net trace of either.',
  },
  {
    id: 'budget.draft-then-approve',
    capability: 'budget.approve',
    conflictsWith: ['budget.manage'],
    entityType: 'budget',
    rationale: 'Whoever sets a spending limit should not be the only person who agrees to it.',
  },
]

// ---------------------------------------------------------------------------
// TWO RULES REMOVED IN J5 — and why removing them changed nothing
//
//   account.manage-then-post   ledger.post   conflictsWith account.manage
//   conflict.raise-then-resolve ledger.reverse conflictsWith invoice.update
//
// Neither could ever have produced a verdict other than `allowed`:
//
//   1. `priorActions` is keyed by (entity_type, entity_id). `account.manage`
//      would be filed against an ACCOUNT; the check for `ledger.post` queries
//      a JOURNAL ENTRY. The two keys never meet.
//   2. Nothing called `assertAllowed` for `ledger.post` at all, and nothing
//      ever recorded `account.manage` or `invoice.update`. Both halves of both
//      rules were absent.
//
// So no workspace ever had these enforced, no override was ever taken against
// them, and no behaviour changes by their removal. They read as controls in
// `GET /api/governance/sod` — which is worse than not having them, because a
// workspace owner reviewing that list would believe the separation was held.
//
// The INTENT of the first is real (whoever invents an account should not be
// the only person who ever posts to it) but it needs cross-document SoD, which
// this model does not have and for which no policy is defined. G4: not built
// on a guess. Recorded in HANDOFF-PHASES-G-TO-O.md instead.
//
// The second describes conflict resolution between offline devices — a feature
// (G8) that does not exist yet. Its rationale and its mechanics did not even
// describe the same thing.
// ---------------------------------------------------------------------------

export interface PriorAction {
  capability: Capability
  actorId: string
}

export type SoDVerdict =
  | { kind: 'allowed' }
  /** Blocked outright; `strict` mode, or no override authority. */
  | { kind: 'blocked'; ruleId: string; rationale: string }
  /**
   * Refused, but overridable by someone with the authority, who must give a
   * reason that is then recorded.
   */
  | { kind: 'requires_override'; ruleId: string; rationale: string }

/**
 * May this actor perform `capability` on this document?
 *
 * `priorActions` are the things ALREADY done to this same document, by anyone.
 * Only the ones done by THIS actor can create a conflict — a payment somebody
 * else recorded is precisely the payment this actor is allowed to cancel.
 */
export function checkSoD(
  input: {
    capability: Capability
    actorId: string
    role: WorkspaceRole
    priorActions: PriorAction[]
  },
  settings: SoDSettings = DEFAULT_SOD_SETTINGS,
): SoDVerdict {
  if (settings.mode === 'off') return { kind: 'allowed' }

  const disabled = new Set(settings.disabledRules)

  for (const rule of SOD_RULES) {
    if (disabled.has(rule.id)) continue
    if (rule.capability !== input.capability) continue

    const ownPrior = input.priorActions.filter(
      (action) =>
        action.actorId === input.actorId && rule.conflictsWith.includes(action.capability),
    )

    if (ownPrior.length === 0) continue

    // In `warn` mode an owner may proceed on the record — the small-shop case
    // where the owner genuinely is both people. The override is recorded, so
    // the control becomes visibility rather than prevention.
    if (settings.mode === 'warn' && input.role === 'owner') {
      return { kind: 'requires_override', ruleId: rule.id, rationale: rule.rationale }
    }

    return { kind: 'blocked', ruleId: rule.id, rationale: rule.rationale }
  }

  return { kind: 'allowed' }
}

export type OverrideRuleCode = 'SOD_OVERRIDE_REASON_REQUIRED' | 'SOD_OVERRIDE_NOT_PERMITTED'

/**
 * Whether an override may be exercised, and whether it is properly justified.
 *
 * An override with no reason is the same as no control: the record would say
 * somebody bypassed a separation of duties and not why.
 */
export function validateOverride(
  verdict: SoDVerdict,
  reason: string | undefined,
): OverrideRuleCode[] {
  const problems: OverrideRuleCode[] = []

  if (verdict.kind !== 'requires_override') problems.push('SOD_OVERRIDE_NOT_PERMITTED')
  if (!reason || reason.trim().length === 0) problems.push('SOD_OVERRIDE_REASON_REQUIRED')

  return problems
}

/** Rules a workspace has in force, for showing what is actually enforced. */
export function activeRules(settings: SoDSettings): SoDRule[] {
  if (settings.mode === 'off') return []
  const disabled = new Set(settings.disabledRules)
  return SOD_RULES.filter((rule) => !disabled.has(rule.id))
}
