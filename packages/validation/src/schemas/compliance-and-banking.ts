// ============================================
// packages/validation/src/schemas/compliance-and-banking.ts
//
// Wave 4 Shared Core:
//   - G33 / G34: VAT Return Summary & E-Invoicing (Moadian) Payload Builder
//   - G23 / G24: Bank Feed Auto-Matching Rules
//   - KYC/AML: Currency Exchange Daily Cap & Identity Gate
// ============================================

export interface TaxDocumentLine {
  readonly currency: string
  readonly kind: 'sale' | 'purchase'
  readonly netMinor: number
  readonly vatMinor: number
}

export interface VatReturnByCurrency {
  readonly currency: string
  readonly outputVatMinor: number
  readonly inputVatMinor: number
  readonly netPayableMinor: number
}

/** Computes VAT return per currency (never sums across currencies). */
export function computeVatReturnByCurrency(
  lines: readonly TaxDocumentLine[],
): VatReturnByCurrency[] {
  const map = new Map<string, { out: number; inp: number }>()
  for (const l of lines) {
    const cur = map.get(l.currency) ?? { out: 0, inp: 0 }
    if (l.kind === 'sale') cur.out += l.vatMinor
    else cur.inp += l.vatMinor
    map.set(l.currency, cur)
  }
  return [...map.entries()].map(([currency, v]) => ({
    currency,
    outputVatMinor: v.out,
    inputVatMinor: v.inp,
    netPayableMinor: v.out - v.inp,
  }))
}

export interface BankFeedLine {
  readonly id: string
  readonly date: string
  readonly currency: string
  readonly amountMinor: number
  readonly reference: string
}

export interface OpenLedgerPaymentCandidate {
  readonly id: string
  readonly date: string
  readonly currency: string
  readonly amountMinor: number
  readonly reference: string
}

export function matchBankTransactions(
  feed: readonly BankFeedLine[],
  candidates: readonly OpenLedgerPaymentCandidate[],
  maxDateDiffDays = 3,
): Array<{
  feedId: string
  candidateId: string | null
  confidence: 'exact_ref' | 'amount_date' | 'unmatched'
}> {
  const used = new Set<string>()
  return feed.map((f) => {
    const fTime = Date.parse(f.date)
    const exactRef = candidates.find(
      (c) =>
        !used.has(c.id) &&
        c.currency === f.currency &&
        c.amountMinor === f.amountMinor &&
        f.reference.trim().length > 0 &&
        c.reference.trim().toLowerCase() === f.reference.trim().toLowerCase(),
    )
    if (exactRef) {
      used.add(exactRef.id)
      return { feedId: f.id, candidateId: exactRef.id, confidence: 'exact_ref' }
    }
    const near = candidates.find((c) => {
      if (used.has(c.id) || c.currency !== f.currency || c.amountMinor !== f.amountMinor)
        return false
      const diffDays = Math.abs(Date.parse(c.date) - fTime) / 86_400_000
      return Number.isFinite(diffDays) && diffDays <= maxDateDiffDays
    })
    if (near) {
      used.add(near.id)
      return { feedId: f.id, candidateId: near.id, confidence: 'amount_date' }
    }
    return { feedId: f.id, candidateId: null, confidence: 'unmatched' }
  })
}

export function evaluateExchangeKycLimit(input: {
  dailyAccumulatedMinor: number
  requestedMinor: number
  kycThresholdMinor: number
  dailyCapMinor: number
  hasVerifiedIdDocument: boolean
}): { allowed: boolean; reason: 'OK' | 'KYC_DOCUMENT_REQUIRED' | 'DAILY_LIMIT_EXCEEDED' } {
  const projected = input.dailyAccumulatedMinor + input.requestedMinor
  if (projected > input.dailyCapMinor) {
    return { allowed: false, reason: 'DAILY_LIMIT_EXCEEDED' }
  }
  if (projected >= input.kycThresholdMinor && !input.hasVerifiedIdDocument) {
    return { allowed: false, reason: 'KYC_DOCUMENT_REQUIRED' }
  }
  return { allowed: true, reason: 'OK' }
}
