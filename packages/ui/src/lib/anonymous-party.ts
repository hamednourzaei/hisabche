// ============================================
// packages/ui/src/lib/anonymous-party.ts
//
// The sale that belongs to nobody, said the same way everywhere.
//
// ---------------------------------------------------------------------------
// ⚠️ ONE FACT, FOUR RENDERINGS
//
// A walk-in sale has no customer — `customer_id` is null, which is legal in
// the schema and correct in the data. But the product showed that one fact
// four different ways:
//
//     invoices-view.tsx      → '—'
//     invoices-mappers.ts    → ''            (a blank cell, reads as a bug)
//     inventory-ops-view.tsx → '—'
//     dashboard-mappers.ts   → t('common.noName')
//
// So the same invoice was «—» in one table, empty in another, and «بدون نام»
// on the dashboard. Nobody could tell whether that meant «no customer», «the
// name failed to load», or «this row is broken».
//
// ---------------------------------------------------------------------------
// ⚠️ WHY THERE IS NO «Unknown» ROW IN THE DATABASE
//
// The obvious implementation is a real customer record called «ناشناس» that
// every anonymous sale points at. It is the wrong one, for two reasons:
//
//  1. IT WOULD CORRUPT THE CUSTOMER COUNT — the very number this is meant to
//     keep honest. «مشتریان: ۲۴» would become 25, and the 25th is not a person.
//     With `customer_id` left null, the count of real customers is exactly
//     right and the anonymous sales are still attributable as a group.
//
//  2. IT WOULD MERGE DEBTS THAT ARE NOT THE SAME DEBT. Two different walk-in
//     buyers who each owe money would land on ONE balance. «ناشناس بدهکار
//     ۵۰,۰۰۰ است» is unactionable — you cannot collect it, and you cannot tell
//     the two people apart afterwards. An unpaid sale needs SOMETHING to
//     identify the buyer, which is why `invoice-anonymous-credit` refuses that
//     combination instead of silently pooling it.
//
// Null means «no customer». That is the truth, it counts correctly, and this
// module is the single place that decides how it is shown.
// ============================================

/** The i18n key for an anonymous party. Present in fa, af and en. */
export const ANONYMOUS_PARTY_KEY = 'customers.anonymous'

/**
 * Is this invoice's party absent?
 *
 * ⚠️ TRIMMED, AND THE ID IS CHECKED TOO. A name of `' '` is not a name, and a
 * row carrying a `customer_id` whose name simply has not loaded yet is NOT
 * anonymous — showing «ناشناس» there would state something false about a
 * customer who exists. Absent id AND absent name is the only anonymous case.
 */
export function isAnonymousParty(
  customerId: string | null | undefined,
  customerName: string | null | undefined,
): boolean {
  return !customerId && !customerName?.trim()
}

/**
 * What to print in the party column.
 *
 * `translate` is passed in because this package holds no strings. Callers that
 * already have a non-throwing `t` should pass that one — a missing key must
 * not take down a table.
 */
export function partyLabel(
  customerId: string | null | undefined,
  customerName: string | null | undefined,
  translate: (key: string) => string,
): string {
  const name = customerName?.trim()
  if (name) return name
  if (customerId) {
    // Has a customer, name not loaded. Not anonymous — say nothing rather than
    // assert «ناشناس» about a party that exists.
    return '—'
  }
  return translate(ANONYMOUS_PARTY_KEY)
}
