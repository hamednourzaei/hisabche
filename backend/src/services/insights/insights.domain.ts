// ============================================
// backend/src/services/insights/insights.domain.ts
//
// The figures a copilot is allowed to talk about, and how they are derived.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT AN AI FILE
//
// `.claude/detail.md` asks for an AI copilot that explains the business. The
// dangerous version of that feature is a model given a database connection and
// asked to compute the answer: it will produce a number that looks right, that
// nobody can reproduce, and that disagrees with the ledger.
//
// So the split is:
//
//   HERE          every figure, computed deterministically from real rows,
//                 with the inputs it came from attached
//   A MODEL       turns that structure into a sentence in the user's language
//
// A model may PHRASE an insight. It may never produce one. That is what makes
// "why did my profit drop" answerable with numbers somebody can check against
// the invoice list, rather than with a plausible paragraph.
//
// Everything here is pure. Given the same rows it returns the same answer,
// which is the property that makes an explanation trustworthy at all.
// ============================================

export interface PeriodTotals {
  from: string
  to: string
  revenue: number
  costOfGoodsSold: number
  invoiceCount: number
}

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export function grossProfit(totals: PeriodTotals): number {
  return round2(totals.revenue - totals.costOfGoodsSold)
}

/** Profit ÷ revenue. Zero revenue has no margin — not a margin of zero. */
export function grossMargin(totals: PeriodTotals): number | null {
  if (totals.revenue === 0) return null
  return round2((grossProfit(totals) / totals.revenue) * 100)
}

export type ChangeDirection = 'up' | 'down' | 'flat'

export interface Change {
  metric: string
  previous: number
  current: number
  absolute: number
  /** Null when the previous value was zero: growth from nothing is not 300%. */
  percent: number | null
  direction: ChangeDirection
}

export function compare(metric: string, previous: number, current: number): Change {
  const absolute = round2(current - previous)

  return {
    metric,
    previous: round2(previous),
    current: round2(current),
    absolute,
    // A jump from 0 to 50 is not "infinite growth" and must not be rendered as
    // a percentage at all.
    percent: previous === 0 ? null : round2((absolute / Math.abs(previous)) * 100),
    direction: absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'flat',
  }
}

// ─── Explaining a change ─────────────────────────────────────────────────────

export interface Contributor {
  /** What moved: a product, a customer, a branch. */
  key: string
  label: string
  previous: number
  current: number
  delta: number
  /** Share of the total change this one accounts for, 0–1. */
  share: number
}

/**
 * Which items account for a change, largest contribution first.
 *
 * This is the whole substance of "why did profit drop": not an adjective, but
 * the three products whose margin fell and how much each of them cost you.
 *
 * Contributions are signed. An item that moved AGAINST the overall direction
 * is kept, with a negative share — hiding it would make the remaining shares
 * sum to more than the change and quietly overstate every cause.
 */
export function explainChange(
  previous: Array<{ key: string; label: string; value: number }>,
  current: Array<{ key: string; label: string; value: number }>,
  options: { limit?: number } = {},
): { total: Change; contributors: Contributor[] } {
  const previousByKey = new Map(previous.map((row) => [row.key, row]))
  const currentByKey = new Map(current.map((row) => [row.key, row]))
  const keys = new Set([...previousByKey.keys(), ...currentByKey.keys()])

  const previousTotal = previous.reduce((sum, row) => sum + row.value, 0)
  const currentTotal = current.reduce((sum, row) => sum + row.value, 0)
  const totalDelta = currentTotal - previousTotal

  const contributors: Contributor[] = []

  for (const key of keys) {
    const before = previousByKey.get(key)?.value ?? 0
    const after = currentByKey.get(key)?.value ?? 0
    const delta = after - before

    if (delta === 0) continue

    contributors.push({
      key,
      label: currentByKey.get(key)?.label ?? previousByKey.get(key)?.label ?? key,
      previous: round2(before),
      current: round2(after),
      delta: round2(delta),
      share: totalDelta === 0 ? 0 : round2(delta / totalDelta),
    })
  }

  contributors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  return {
    total: compare('total', previousTotal, currentTotal),
    contributors: contributors.slice(0, options.limit ?? 10),
  }
}

// ─── Anomalies ───────────────────────────────────────────────────────────────

export type AnomalyKind =
  'margin_collapse' | 'sold_below_cost' | 'estimated_cost' | 'stale_receivable' | 'unusual_discount'

export interface Anomaly {
  kind: AnomalyKind
  /** What it is about: an invoice id, a product id. */
  subjectId: string
  subjectLabel: string
  /** The numbers behind it. A copilot phrases these; it never invents them. */
  evidence: Record<string, number | string>
  severity: 'high' | 'medium' | 'low'
}

export interface LineForReview {
  invoiceId: string
  invoiceNumber: string
  productId: string
  productLabel: string
  revenue: number
  cost: number
  discountPercent?: number
  costIsEstimated?: boolean
}

/**
 * Things worth a person's attention, found by arithmetic rather than by
 * pattern-matching on a hunch.
 *
 * Each anomaly carries the numbers that produced it. "This sale lost money"
 * is only useful next to what it sold for and what it cost.
 */
export function detectAnomalies(
  lines: LineForReview[],
  options: { marginFloorPercent?: number; discountCeilingPercent?: number } = {},
): Anomaly[] {
  const marginFloor = options.marginFloorPercent ?? 5
  const discountCeiling = options.discountCeilingPercent ?? 30

  const anomalies: Anomaly[] = []

  for (const line of lines) {
    // Sold below what it cost. Unambiguous, and the most expensive kind of
    // mistake to leave running for a month.
    if (line.cost > line.revenue) {
      anomalies.push({
        kind: 'sold_below_cost',
        subjectId: line.invoiceId,
        subjectLabel: `${line.invoiceNumber} · ${line.productLabel}`,
        evidence: {
          revenue: round2(line.revenue),
          cost: round2(line.cost),
          loss: round2(line.cost - line.revenue),
        },
        severity: 'high',
      })
      continue
    }

    if (line.revenue > 0) {
      const margin = ((line.revenue - line.cost) / line.revenue) * 100
      if (margin < marginFloor) {
        anomalies.push({
          kind: 'margin_collapse',
          subjectId: line.invoiceId,
          subjectLabel: `${line.invoiceNumber} · ${line.productLabel}`,
          evidence: {
            marginPercent: round2(margin),
            floorPercent: marginFloor,
            revenue: round2(line.revenue),
          },
          severity: 'medium',
        })
      }
    }

    // A cost the costing core had to guess, because stock was issued that was
    // never received. The profit on this line is a guess too, and saying so is
    // more useful than a confident wrong number.
    if (line.costIsEstimated) {
      anomalies.push({
        kind: 'estimated_cost',
        subjectId: line.invoiceId,
        subjectLabel: `${line.invoiceNumber} · ${line.productLabel}`,
        evidence: { cost: round2(line.cost) },
        severity: 'medium',
      })
    }

    if ((line.discountPercent ?? 0) > discountCeiling) {
      anomalies.push({
        kind: 'unusual_discount',
        subjectId: line.invoiceId,
        subjectLabel: `${line.invoiceNumber} · ${line.productLabel}`,
        evidence: {
          discountPercent: round2(line.discountPercent ?? 0),
          ceilingPercent: discountCeiling,
        },
        severity: 'low',
      })
    }
  }

  const rank = { high: 0, medium: 1, low: 2 }
  return anomalies.sort((a, b) => rank[a.severity] - rank[b.severity])
}

// ─── The shape a model is given ──────────────────────────────────────────────

export interface Explanation {
  /** A stable code, not a sentence. The client or a model renders it. */
  headlineKey: string
  /** Every number that went into it, so the claim can be checked. */
  figures: Record<string, number | string | null>
  contributors: Contributor[]
  anomalies: Anomaly[]
  /**
   * True when some input was estimated rather than measured. A copilot MUST
   * surface this — an explanation built on a guessed cost that presents itself
   * as fact is the failure mode this whole core exists to prevent.
   */
  hasEstimatedInputs: boolean
}

export function buildExplanation(input: {
  headlineKey: string
  figures: Record<string, number | string | null>
  contributors?: Contributor[]
  anomalies?: Anomaly[]
}): Explanation {
  const anomalies = input.anomalies ?? []

  return {
    headlineKey: input.headlineKey,
    figures: input.figures,
    contributors: input.contributors ?? [],
    anomalies,
    hasEstimatedInputs: anomalies.some((anomaly) => anomaly.kind === 'estimated_cost'),
  }
}
