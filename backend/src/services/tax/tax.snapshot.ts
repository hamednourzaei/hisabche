// ============================================
// backend/src/services/tax/tax.snapshot.ts
//
// Freezing the tax that applied, so an offline device and the server can
// disagree without either of them being silently overruled.
//
// ---------------------------------------------------------------------------
// THE PROBLEM SERVER-FIRST ERPs DO NOT HAVE
//
// Odoo and ERPNext resolve a tax rate at posting time, on the server, against
// the live configuration. That is correct for them: there is exactly one
// moment and one source of truth.
//
// Hisabche cannot do that. A shopkeeper writes an invoice on a phone with no
// signal at 09:00; the rate changes at 11:00; the phone syncs at 14:00. Three
// answers are available and two of them are wrong:
//
//   WRONG  re-resolve at sync    the customer was charged 10% and the books
//                               say 15% — the invoice they hold is now a lie
//   WRONG  trust the device      a phone that never saw the change decides the
//                               rate for everyone, forever
//   RIGHT  freeze, then compare  the invoice keeps the rate it was written
//                               with, and the DIFFERENCE becomes something a
//                               person is shown
//
// So the device resolves and FREEZES: the rule id, its version, the component
// definitions and the computed figures all travel with the document. At sync
// the server recomputes from the frozen snapshot — arriving at the identical
// number, because the snapshot contains everything the computation needs — and
// separately checks whether today's configuration would have produced
// something else.
//
// If it would, that is not an error and not a silent correction. It is a
// FINDING: this invoice was written under a rate that is no longer current.
// The conflict core owns what happens next.
// ============================================

import {
  computeDocument,
  type ComputedDocument,
  type TaxComponent,
  type RoundingPolicy,
} from './tax.domain'

export interface TaxSnapshot {
  /** Bumped whenever a workspace's tax configuration changes. */
  configVersion: number
  /** The document's own date — what the rate was resolved AGAINST. */
  resolvedOn: string
  /** When the device resolved it. Diagnostic only; never used to decide. */
  resolvedAt: string
  /** Which rule chose these components, per line. */
  ruleByLine: Record<string, string | null>
  /**
   * The component definitions as they were, in full.
   *
   * Copied rather than referenced on purpose: a snapshot that pointed at a
   * `tax_components` row would silently change meaning the moment somebody
   * edited that row, which is the exact failure this file prevents.
   */
  components: TaxComponent[]
  policy: RoundingPolicy
}

export interface FrozenTax {
  snapshot: TaxSnapshot
  computed: ComputedDocument
}

/**
 * Recompute a document from its own snapshot.
 *
 * Deterministic by construction: the snapshot carries every input, so this
 * returns the same figures on the phone that wrote it, on the server that
 * receives it, and on any machine auditing it three years later.
 */
export function recomputeFromSnapshot(
  snapshot: TaxSnapshot,
  lines: Array<{
    lineId: string
    quantity: number
    unitPriceMinor: number
    discountMinor?: number
  }>,
): ComputedDocument {
  const byId = new Map(snapshot.components.map((c) => [c.id, c]))

  return computeDocument(
    lines.map((line) => ({
      ...line,
      // The rule recorded FOR THIS LINE, not whichever rule matches now.
      components: (snapshot.ruleByLine[line.lineId] ? snapshot.components : []).filter((c) =>
        byId.has(c.id),
      ),
    })),
    snapshot.policy,
  )
}

export type DriftKind =
  /** The workspace's tax configuration changed after this was written. */
  | 'config_version'
  /** A component's rate is different now. */
  | 'rate_changed'
  /** A component that applied then does not exist now. */
  | 'component_removed'
  /** A component applies now that did not then. */
  | 'component_added'

export interface TaxDrift {
  kind: DriftKind
  componentId?: string
  labelKey?: string
  was?: number
  now?: number
}

/**
 * Has the configuration moved since this document was written?
 *
 * Reports the DIFFERENCE. It does not re-rate anything: the invoice the
 * customer holds keeps the figures it was issued with, and whether to correct
 * it is a decision with a credit note attached, not a background job.
 *
 * An empty result means the frozen figures are still what today's rules would
 * produce — which is the common case and worth being able to state.
 */
export function detectDrift(
  snapshot: TaxSnapshot,
  current: { configVersion: number; components: TaxComponent[] },
): TaxDrift[] {
  const drift: TaxDrift[] = []

  if (snapshot.configVersion !== current.configVersion) {
    drift.push({
      kind: 'config_version',
      was: snapshot.configVersion,
      now: current.configVersion,
    })
  }

  const frozenById = new Map(snapshot.components.map((c) => [c.id, c]))
  const currentById = new Map(current.components.map((c) => [c.id, c]))

  for (const [id, frozen] of frozenById) {
    const live = currentById.get(id)

    if (!live) {
      drift.push({ kind: 'component_removed', componentId: id, labelKey: frozen.labelKey })
      continue
    }

    if (live.rate !== frozen.rate) {
      drift.push({
        kind: 'rate_changed',
        componentId: id,
        labelKey: frozen.labelKey,
        was: frozen.rate,
        now: live.rate,
      })
    }
  }

  for (const [id, live] of currentById) {
    if (!frozenById.has(id)) {
      drift.push({ kind: 'component_added', componentId: id, labelKey: live.labelKey })
    }
  }

  return drift
}

/**
 * Does a document's stored total still match its own snapshot?
 *
 * Run at sync and on demand. A mismatch means the stored figures were produced
 * by something other than this snapshot — a client bug, a hand-edited row, a
 * partially-applied migration — and it is a data-integrity finding rather than
 * a tax question.
 */
export function verifyAgainstSnapshot(
  frozen: FrozenTax,
  storedTotalMinor: number,
): { matches: boolean; expectedMinor: number; storedMinor: number; differenceMinor: number } {
  const expectedMinor = frozen.computed.totalMinor

  return {
    matches: expectedMinor === storedTotalMinor,
    expectedMinor,
    storedMinor: storedTotalMinor,
    differenceMinor: storedTotalMinor - expectedMinor,
  }
}
