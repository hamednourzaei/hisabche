// ============================================
// Which tills a cash payment may name.
//
// One rule, shared by every place cash is recorded against an invoice (the
// invoice being created, a payment added later, a customer's payment). It is
// the SAME rule the server applies (`tillAmountMinor` in payments.domain.ts);
// the server decides, this only keeps a choice it would refuse off the list.
//
//   · the till is OPEN (a suspended or closed till takes nothing)
//   · it counts in the payment's currency, or in the books currency — a
//     foreign payment goes into a books-currency till at the payment's rate
//
// ⚠️ NOTHING IS CHOSEN FOR THE PERSON unless there is exactly one till the
// money could go to. With two, picking one silently is how cash ends up in
// the wrong drawer.
// ============================================

export interface TillLike {
  sessionId: string
  label?: string | null | undefined
  /** Absent = the books currency. */
  currency?: string | undefined
  status?: string | undefined
}

export interface TillChoice {
  id: string
  label: string | null
  currency: string
  /** The till counts in the books currency and the payment does not. */
  atRate: boolean
}

export function tillChoices(
  tills: readonly TillLike[],
  paymentCurrency: string | undefined,
  bookCurrency: string | undefined,
): TillChoice[] {
  // Without the books currency a till with no currency of its own cannot be
  // placed; nothing is offered rather than everything.
  if (!bookCurrency) return []
  const wanted = paymentCurrency || bookCurrency
  return tills
    .filter((till) => (till.status ?? 'open') === 'open')
    .map((till) => ({
      id: till.sessionId,
      label: till.label?.trim() || null,
      currency: till.currency || bookCurrency,
    }))
    .filter((till) => till.currency === wanted || till.currency === bookCurrency)
    .map((till) => ({ ...till, atRate: till.currency !== wanted }))
}

/** The one till this money could go to, or '' when the person has to say. */
export function onlyTill(choices: readonly TillChoice[]): string {
  return choices.length === 1 ? choices[0]!.id : ''
}

/** A till chosen earlier that is no longer on the list is not sent. */
export function keptTill(choices: readonly TillChoice[], chosen: string): string {
  return choices.some((choice) => choice.id === chosen) ? chosen : ''
}
