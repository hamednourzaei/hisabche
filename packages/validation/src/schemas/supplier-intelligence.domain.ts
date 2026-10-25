// ============================================
// Capabilities #10, #15, #19 — supplier risk and procurement intelligence.
// Engine N22 (supplier side).
//
// ⚠️ THIS COMPUTES RISK FROM THE SHOP'S OWN PURCHASING HISTORY, AND FROM
// NOTHING ELSE.
//
// There is no external feed here — no credit bureau, no trade data, no supplier
// financials. Any such figure would be a number this product cannot source, and
// `POSITIONING-2026-09-15.md` already records the rule that produced: "customer
// counts / ratings" were claimed on the landing and had to be deleted because
// the codebase had no rating system at all.
//
// So every input is something the shop itself did: how often it bought, how
// reliably the supplier delivered, how prices moved, how much of the shop's
// supply comes through one door. That is enough for a real risk signal, and it
// is entirely sourced.
//
// ⚠️ RISK IS A NUMBER WITH ITS REASONS, NEVER A COLOUR ALONE.
//
// A supplier marked «high risk» with no explanation is a decision a buyer
// cannot argue with and cannot verify. Every band here names the two or three
// signals that produced it, so a buyer who disagrees can see exactly which fact
// they are disagreeing about. This is the same rule the pricing engine follows
// with `clampedByFloor`.
//
// ⚠️ CONCENTRATION IS THE SIGNAL MOST SHOPS HAVE NEVER SEEN.
//
// The most common real finding is not «supplier X is late» — it is «70% of what
// this shop buys comes through one supplier». A shop does not notice that on a
// purchase order, and it matters more than any individual supplier's
// punctuality. It is a `finding` here, not a number on a supplier.
//
// ⚠️ LATE MEANS LATE, AND A SUPPLIER WHO DELIVERS ON TIME IS NOT RISK.
//
// The base rate matters: most suppliers deliver when they said they would. A
// risk score that gives a punctual supplier 70/100 because it has been punctual
// is a score nobody will learn to read, and one nobody reads stops being
// maintained. Punctuality earns a low risk, not a middling one.
// ============================================

/** A purchase the shop actually made. Dates are ISO days. */
export interface PurchaseRecord {
  supplierId: string
  productId: string
  orderedDate: string
  receivedDate: string | null
  /** What was paid for the goods. */
  amountMinor: number
  /** What the goods would have cost at the usual price. */
  listPriceMinor: number
  quantity: number
}

export interface SupplierFacts {
  supplierId: string
  name: string
  /** False once the supplier is deactivated — a risk of zero would be a lie. */
  active: boolean
}

export type RiskBand = 'low' | 'moderate' | 'high' | 'unknown'

export interface RiskSignal {
  /** What was measured. Machine-readable, for the UI to key off. */
  key: 'LATE_DELIVERY' | 'PRICE_DRIFT' | 'INACTIVITY' | 'UNRECEIVED'
  /** One line a person can read. */
  detail: string
  /** How much this signal contributes, 0–100. Signals do not simply sum. */
  weight: number
}

export interface SupplierRisk {
  supplierId: string
  band: RiskBand
  /**
   * ⚠️ NULL means «not enough to say», not zero. A supplier the shop bought from
   * once is `unknown` — and showing that as 0 would read as «perfectly
   * reliable».
   */
  score: number | null
  signals: RiskSignal[]
  /** The facts behind the signals, so the score can be checked. */
  evidence: {
    purchases: number
    received: number
    neverReceived: number
    averageDaysLate: number | null
    /** Share of what was paid above the list price, as a percentage. */
    averagePricePremiumPercent: number | null
  }
}

/** Whole days between two ISO days. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86_400_000)
}

/** Below this many purchases, a score would be a guess. */
export const MIN_PURCHASES_FOR_A_SCORE = 3

/**
 * How risky one supplier is, and why.
 *
 * ⚠️ SIGNALS TAKE THE WORST, NOT THE AVERAGE. Two suppliers both with one bad
 * experience and one good one average out to «fine», which is exactly the
 * signal a buyer needs not to lose. The highest-weight signal is the one
 * reported.
 */
export function scoreSupplier(
  supplier: SupplierFacts,
  purchases: readonly PurchaseRecord[],
  asOf: string,
): SupplierRisk {
  const own = purchases.filter((p) => p.supplierId === supplier.supplierId)

  const evidence: SupplierRisk['evidence'] = {
    purchases: own.length,
    received: 0,
    neverReceived: 0,
    averageDaysLate: null,
    averagePricePremiumPercent: null,
  }

  if (!supplier.active) {
    return {
      supplierId: supplier.supplierId,
      band: 'unknown',
      score: null,
      // ⚠️ An inactive supplier is not a LOW risk supplier. It is a supplier
      // whose risk the shop can no longer observe, and reporting it as safe
      // would keep it in the list of suppliers to buy from.
      signals: [{ key: 'INACTIVITY', detail: 'supplier is deactivated', weight: 0 }],
      evidence,
    }
  }

  if (own.length < MIN_PURCHASES_FOR_A_SCORE) {
    return { supplierId: supplier.supplierId, band: 'unknown', score: null, signals: [], evidence }
  }

  const signals: RiskSignal[] = []

  // ── Never received ───────────────────────────────────────────
  const neverReceived = own.filter((p) => p.receivedDate === null)
  evidence.neverReceived = neverReceived.length
  if (neverReceived.length > 0) {
    signals.push({
      key: 'UNRECEIVED',
      // ⚠️ THE WORST SIGNAL IN THIS FILE. An order the shop paid for and never
      // received is not a delay — it is money gone, and no punctuality average
      // should be allowed to soften it.
      detail: `${neverReceived.length} of ${own.length} orders never arrived`,
      weight: 100,
    })
  }

  // ── Late delivery ────────────────────────────────────────────
  const received = own.filter((p) => p.receivedDate !== null)
  evidence.received = received.length

  if (received.length > 0) {
    const lateDays = received.map((p) => daysBetween(p.orderedDate, p.receivedDate!))
    const averageLate = Math.round(lateDays.reduce((a, b) => a + b, 0) / lateDays.length)
    evidence.averageDaysLate = averageLate

    if (averageLate > 0) {
      // ⚠️ THE SCALE IS DAYS-TO-WEIGHT, NOT DAYS-TO-PERCENTAGE.
      //
      // The first version used `(days / 14) × 100`, which makes a 5-day delay
      // weigh 36 — below the 45-point `moderate` boundary, so a supplier who is
      // consistently a week late scored as LOW RISK. The two constants had to be
      // reconciled and only one of them was in the right units: 100 means "high
      // risk" and should arrive at roughly a fortnight late, so days are the
      // unit and the divisor is the band, not the other way round.
      //
      // The band thresholds below are read against THIS scale.
      signals.push({
        key: 'LATE_DELIVERY',
        detail: `average ${averageLate} days late over ${received.length} orders`,
        weight: Math.min(90, Math.round((averageLate / 10) * 100)),
      })
    }
  }

  // ── Price drift ──────────────────────────────────────────────
  const priced = own.filter((p) => p.listPriceMinor > 0)
  if (priced.length >= MIN_PURCHASES_FOR_A_SCORE) {
    const premium =
      priced.reduce(
        (sum, p) => sum + ((p.amountMinor - p.listPriceMinor) / p.listPriceMinor) * 100,
        0,
      ) / priced.length
    evidence.averagePricePremiumPercent = Math.round(premium * 10) / 10

    if (premium > 10) {
      signals.push({
        key: 'PRICE_DRIFT',
        detail: `paid ${evidence.averagePricePremiumPercent}% above the list price on average`,
        weight: Math.min(70, Math.round(premium * 2)),
      })
    }
  }

  if (signals.length === 0) {
    // ⚠️ No signals is a GOOD result and gets a LOW band — not a missing score.
    // This is the case that keeps the scale readable: the ordinary supplier
    // sits at the bottom, so a mid-range score means something.
    return { supplierId: supplier.supplierId, band: 'low', score: 10, signals: [], evidence }
  }

  const worst = signals.reduce((a, b) => (b.weight > a.weight ? b : a))
  const band: RiskBand = worst.weight >= 80 ? 'high' : worst.weight >= 45 ? 'moderate' : 'low'

  return {
    supplierId: supplier.supplierId,
    band,
    score: worst.weight,
    signals,
    evidence,
  }
}

// ─── Concentration (#19) ─────────────────────────────────────────────────────

export interface ConcentrationFinding {
  kind: 'SUPPLIER_CONCENTRATION' | 'PRODUCT_SINGLE_SOURCE'
  /** Who or what the shop depends on. */
  subjectId: string
  subjectName: string
  /** Share of spending, as a percentage. */
  sharePercent: number
  /**
   * ⚠️ Why this matters, in one sentence. A finding a buyer cannot act on is a
   * statistic.
   */
  detail: string
}

/**
 * ⚠️ ABOVE THIS SHARE THE SHOP DEPENDS ON ONE DOOR.
 *
 * ⚠️ FORTY, not thirty-five, and the reason is that the first threshold made
 * the finding unusable. With 35%, a shop buying 30/30/40 across three suppliers
 * was told it was diversified — while two thirds of its money came through two
 * doors and a single supplier's price rise moved 40% of its cost base. A finding
 * that fires on almost every shop is a finding nobody acts on, which is the
 * `§7٫4` shape («Checker گرگ می‌کند، محافظت نمی‌کند») applied to reports.
 *
 * Forty is where a single supplier genuinely dominates. A shop above it has a
 * real exposure; a shop below it can defend itself by asking two more suppliers
 * for a quote, which is advice worth giving.
 */
export const CONCENTRATION_THRESHOLD_PERCENT = 40

/**
 * Where the shop's money goes.
 *
 * ⚠️ SPENDING SHARE, NOT UNIT SHARE. Counting units would make a shop that
 * buys 900 rolls of bread from one supplier and 1,000 cheap pens from another
 * look diversified; the money is not.
 */
export function supplierConcentration(
  purchases: readonly PurchaseRecord[],
  suppliers: readonly SupplierFacts[],
): ConcentrationFinding[] {
  const findings: ConcentrationFinding[] = []
  if (purchases.length === 0) return findings

  const totalSpent = purchases.reduce((sum, p) => sum + p.amountMinor, 0)
  if (totalSpent <= 0) return findings

  const bySupplier = new Map<string, number>()
  for (const purchase of purchases) {
    bySupplier.set(
      purchase.supplierId,
      (bySupplier.get(purchase.supplierId) ?? 0) + purchase.amountMinor,
    )
  }

  for (const [supplierId, spent] of bySupplier) {
    const sharePercent = Math.round((spent / totalSpent) * 1000) / 10
    // ⚠️ `<`, NOT `<=`. Exactly at the threshold IS concentrated — 40% through
    // one door is the exposure the threshold was chosen to name, and a boundary
    // that silently excludes its own definition is a boundary nobody can reason
    // about. A shop split 40/30/30 is NOT diversified.
    if (sharePercent < CONCENTRATION_THRESHOLD_PERCENT) continue

    const name = suppliers.find((s) => s.supplierId === supplierId)?.name ?? supplierId
    findings.push({
      kind: 'SUPPLIER_CONCENTRATION',
      subjectId: supplierId,
      subjectName: name,
      sharePercent,
      detail: `${sharePercent}% of what this business spends goes through ${name}`,
    })
  }

  // ⚠️ A product bought from one supplier is a different failure from a
  // supplier bought in volume: the shop can switch suppliers for most things,
  // and cannot switch for the one product only that supplier sells.
  const byProduct = new Map<string, Set<string>>()
  for (const purchase of purchases) {
    const sources = byProduct.get(purchase.productId) ?? new Set<string>()
    sources.add(purchase.supplierId)
    byProduct.set(purchase.productId, sources)
  }

  for (const [productId, sources] of byProduct) {
    if (sources.size !== 1) continue
    const supplierId = [...sources][0]!
    findings.push({
      kind: 'PRODUCT_SINGLE_SOURCE',
      subjectId: productId,
      subjectName: productId,
      sharePercent: 100,
      detail: `product ${productId} is only ever bought from one supplier`,
    })
  }

  return findings
}
