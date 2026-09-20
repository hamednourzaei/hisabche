// ============================================
// backend/src/services/referral/referral.domain.ts
//
// The referral programme's rules. No database, no HTTP — testable directly.
//
// THE MODEL, as the owner specified it:
//   • 10% of the subscription amount actually PAID by the referred business
//   • earned only after a SUCCESSFUL PAYMENT — never on sign-up
//   • for the first 12 paid periods, then it stops
//   • the new business gets 10% off its first payment
//   • a refund, chargeback or cancellation REVERSES what it earned
//   • trial and free plans earn nothing
//   • paid out as product credit; cash needs a $10 threshold
//
// ⚠️ 10% OF THE SUBSCRIPTION, NEVER OF TURNOVER. A shop moving millions
// through Hisabche is not a larger commission: the revenue here is the
// subscription, and paying a share of turnover would promise money this
// business never receives.
// ============================================

/**
 * ⚠️ THE RATE LIVES HERE, ONCE, IN BASIS POINTS.
 *
 * 1000 bps = 10%. Basis points rather than `0.1` because the whole money path
 * in this product is integer (راهنمای سشن §۱٫۳); a float rate reintroduces the
 * rounding it exists to avoid.
 */
export const REFERRAL_RATE_BPS = 1000

/** The new business's welcome discount, on its FIRST payment only. */
export const SIGNUP_DISCOUNT_BPS = 1000

/**
 * How many paid periods a single referral earns on.
 *
 * ⚠️ NOT «for ever». An uncapped 10% is a permanent claim on every customer's
 * revenue — it compounds with every referral and there is no point at which
 * the business stops paying for one sign-up.
 */
export const COMMISSION_PERIOD_LIMIT = 12

/** How long a code keeps crediting a sign-up after it is shared. */
export const ATTRIBUTION_WINDOW_DAYS = 90

/** Minimum balance before a CASH payout. Product credit has no threshold. */
export const PAYOUT_THRESHOLD_MINOR = 1000 // $10.00

export type CommissionKind = 'earned' | 'reversal'
export type CommissionStatus = 'pending' | 'credited' | 'paid' | 'void'
export type ReversalReason = 'refund' | 'chargeback' | 'cancellation' | 'manual'

/**
 * Is this activation allowed to earn anything at all?
 *
 * Every branch is a rule the owner asked for, and each returns a REASON rather
 * than a bare false — the referral page shows why a sign-up has earned
 * nothing, which is the difference between «not yet» and «never».
 */
export type EligibilityReason =
  'ok' | 'trial' | 'unpriced_plan' | 'window_exhausted' | 'not_paid_yet'

export function eligibility(input: {
  isTrial: boolean
  priceMinor: number | null
  periodIndex: number
  hasSuccessfulPayment: boolean
}): EligibilityReason {
  // ⚠️ A TRIAL IS NOT A PAYMENT. Somebody on a free trial has handed over
  // nothing; 10% of nothing is not a commission, it is a promise to pay out
  // of the company's own pocket.
  if (input.isTrial) return 'trial'

  // ⚠️ «NOT PRICED» IS NOT «FREE». `free` costs nothing and `enterprise` is
  // negotiated elsewhere — neither has an amount here to take a share of, and
  // a 0 row would read as «earned nothing» rather than «no price on file».
  if (input.priceMinor === null || input.priceMinor <= 0) return 'unpriced_plan'

  if (!input.hasSuccessfulPayment) return 'not_paid_yet'

  if (input.periodIndex < 1 || input.periodIndex > COMMISSION_PERIOD_LIMIT) {
    return 'window_exhausted'
  }

  return 'ok'
}

/**
 * The commission, in the smallest unit.
 *
 * ⚠️ FLOOR, NOT ROUND. Rounding up pays out money that was never charged; over
 * thousands of referrals those half-units are real. The fraction stays with
 * the house, which is the conventional direction and the only one that can
 * never exceed the stated rate.
 */
export function commissionMinor(baseAmountMinor: number, rateBps = REFERRAL_RATE_BPS): number {
  if (!Number.isFinite(baseAmountMinor) || baseAmountMinor <= 0) return 0
  if (!Number.isFinite(rateBps) || rateBps <= 0) return 0
  return Math.floor((baseAmountMinor * rateBps) / 10_000)
}

/**
 * What the referred business pays on its FIRST payment, after the welcome
 * discount.
 *
 * ⚠️ THE DISCOUNT IS ON THE FIRST PAYMENT ONLY, and the commission is taken
 * from what was ACTUALLY paid — not from the list price. Paying 10% of a price
 * nobody paid would be paying out of the discount as well as the margin.
 */
export function discountedFirstPaymentMinor(
  listPriceMinor: number,
  discountBps = SIGNUP_DISCOUNT_BPS,
): number {
  if (!Number.isFinite(listPriceMinor) || listPriceMinor <= 0) return 0
  const discount = Math.floor((listPriceMinor * discountBps) / 10_000)
  return Math.max(0, listPriceMinor - discount)
}

/** When a referral's earning window closes, given its first payment. */
export function commissionEndsAt(firstPaidAt: string, months = COMMISSION_PERIOD_LIMIT): string {
  const start = new Date(firstPaidAt)
  if (Number.isNaN(start.getTime())) return firstPaidAt
  const end = new Date(start)
  end.setMonth(end.getMonth() + months)
  return end.toISOString()
}

/** Has a code gone stale? Attribution is not open for ever. */
export function isAttributionOpen(expiresAt: string | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return true
  const deadline = Date.parse(expiresAt)
  if (Number.isNaN(deadline)) return true
  return now.getTime() <= deadline
}

/**
 * A referral code: short, unambiguous, and safe in a URL.
 *
 * ⚠️ NO `0/O` AND NO `1/I/L`. The code is read off one screen and typed into
 * another phone; a character pair that looks identical is a sign-up that
 * silently credits nobody.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateReferralCode(randomBytes: Uint8Array, length = 8): string {
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[(randomBytes[i] ?? 0) % ALPHABET.length]
  }
  return code
}

export function isReferralCodeShape(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z2-9]{6,16}$/.test(value)
}

// ─── Reading the ledger ────────────────────────────────────────────────────

export interface ReferralRow {
  id: string
  referred_name?: string | null
  referred_workspace_id?: string | null
  signed_up_at: string
  first_paid_at?: string | null
  commission_ends_at?: string | null
}

export interface CommissionRow {
  referral_id: string
  kind?: string | null
  plan: string
  interval: string
  period_index?: number | null
  base_amount_minor: number
  amount_minor: number
  currency: string
  status: string
  created_at: string
}

export interface ReferralListItem {
  id: string
  name: string
  signedUpAt: string
  plan: string | null
  interval: string | null
  /** NET of reversals — what this sign-up has actually earned. */
  commissionMinor: number
  baseAmountMinor: number
  currency: string | null
  /** 0 when nothing has been earned yet. */
  paidPeriods: number
  /** How many of the 12 remain. */
  periodsRemaining: number
  /** true once they have paid at least once. */
  isActive: boolean
  status: CommissionStatus | 'none'
}

export interface ReferralSummary {
  /** Everybody who signed up with the link. */
  referredCount: number
  /** Of those, how many have paid at least once. */
  activeCount: number
  /** Net, this calendar month. */
  thisMonthMinor: number
  /** Net, all time. */
  totalMinor: number
  /** Earned and not yet settled. */
  pendingMinor: number
  /**
   * ⚠️ NULL WHEN CURRENCIES ARE MIXED. A total across currencies is not a
   * number; the page shows them separately rather than adding dollars to
   * afghanis.
   */
  currency: string | null
  currencies: string[]
  /** Cash payout needs this much; product credit does not. */
  payoutThresholdMinor: number
}

const signed = (row: CommissionRow): number => {
  const amount = Number(row.amount_minor) || 0
  // The ledger stores reversals negative, but a row written before that was
  // true — or by a tool that did not know — must not be counted as a credit.
  if (row.kind === 'reversal' && amount > 0) return -amount
  return amount
}

/** Void rows are money that turned out never to be owed. */
const counts = (row: CommissionRow): boolean => row.status !== 'void'

/**
 * One row per referred business, with what it has earned NET of reversals.
 *
 * ⚠️ A REFERRAL WITH NO COMMISSION IS STILL A ROW. They signed up and simply
 * have not paid yet; dropping them would make the list disagree with the
 * «invited» figure above it.
 */
export function buildReferralList(
  referrals: ReferralRow[],
  commissions: CommissionRow[],
): ReferralListItem[] {
  const byReferral = new Map<string, CommissionRow[]>()
  for (const commission of commissions) {
    const list = byReferral.get(commission.referral_id) ?? []
    list.push(commission)
    byReferral.set(commission.referral_id, list)
  }

  return referrals.map((referral) => {
    const rows = (byReferral.get(referral.id) ?? []).filter(counts)
    const earned = rows.filter((row) => row.kind !== 'reversal')
    const latest = earned.reduce<CommissionRow | null>(
      (best, row) => (!best || row.created_at > best.created_at ? row : best),
      null,
    )

    const periods = earned.reduce((max, row) => Math.max(max, Number(row.period_index) || 0), 0)

    return {
      id: referral.id,
      name: referral.referred_name ?? '',
      signedUpAt: referral.signed_up_at,
      plan: latest?.plan ?? null,
      interval: latest?.interval ?? null,
      commissionMinor: rows.reduce((sum, row) => sum + signed(row), 0),
      baseAmountMinor: latest ? Number(latest.base_amount_minor) || 0 : 0,
      currency: latest?.currency ?? null,
      paidPeriods: periods,
      periodsRemaining: Math.max(0, COMMISSION_PERIOD_LIMIT - periods),
      // ⚠️ «Active» means they have PAID, not that they exist.
      isActive: Boolean(referral.first_paid_at),
      status: (latest?.status as CommissionStatus | undefined) ?? 'none',
    }
  })
}

/** The figures the dashboard card and the page's KPI row show. */
export function summarize(
  referrals: ReferralRow[],
  commissions: CommissionRow[],
  now = new Date(),
): ReferralSummary {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  let totalMinor = 0
  let thisMonthMinor = 0
  let pendingMinor = 0
  const currencies = new Set<string>()

  for (const row of commissions) {
    if (!counts(row)) continue
    currencies.add(row.currency)
    const amount = signed(row)
    totalMinor += amount
    if (row.created_at >= monthStart) thisMonthMinor += amount
    if (row.status === 'pending') pendingMinor += amount
  }

  const list = [...currencies]

  return {
    referredCount: referrals.length,
    activeCount: referrals.filter((referral) => Boolean(referral.first_paid_at)).length,
    thisMonthMinor,
    totalMinor,
    pendingMinor,
    currency: list.length === 1 ? (list[0] as string) : null,
    currencies: list,
    payoutThresholdMinor: PAYOUT_THRESHOLD_MINOR,
  }
}
