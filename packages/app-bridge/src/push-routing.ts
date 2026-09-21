// ============================================
// Which road a queued write takes to the server.
//
// ⚠️ THE LINE IS FINANCIAL EFFECT, NOT «CREATE VS UPDATE».
//
// There are two ways into the server and they are not interchangeable:
//
//   • the DOMAIN routes (`POST /api/invoices`, `POST /api/transactions`)
//     move stock, book ledger entries, take an invoice number and derive the
//     money from the lines;
//
//   • `POST /api/sync/push` writes the row, with optimistic concurrency and a
//     filed conflict, and NO domain logic whatsoever.
//
// An invoice sent down the second road is an invoice that sold nothing: no
// stock left the warehouse, no revenue was booked, and the ledger and the
// document disagree forever. So anything that touches money — a total, a paid
// amount, a status, a quantity — goes through the domain, always, in both
// directions, for creates AND updates AND deletes.
//
// What the versioned road is for is the rest: a customer's phone number, a
// product's barcode, a category. Those are the edits two devices genuinely
// make at once, and they are the ones that were silently losing data to
// last-write-wins.
//
// This lives in the contract because both hosts queue writes, and a host that
// decided routing for itself would be one Android build away from sending an
// invoice down the wrong road.
// ============================================

import type { LocalTable } from './contract'

/**
 * Entities whose every write has a financial effect.
 *
 * ⚠️ WHOLE ENTITIES, NOT FIELDS. An invoice update that only changes `notes`
 * still has to be re-derived by the service, because the service is what
 * decides whether the invoice may be edited at all — a finalized one may not,
 * and only it knows that.
 */
export const FINANCIAL_ENTITIES: readonly LocalTable[] = [
  'invoice',
  'invoice_item',
  'transaction',
  'inventory_movement',
]

/**
 * Fields that carry money or stock, wherever they appear.
 *
 * A descriptive entity can still hold one — `product.quantity` and
 * `product.buy_price` are stock and cost, not description — so an otherwise
 * safe update that touches one of these is routed to the domain too.
 */
export const FINANCIAL_FIELDS: readonly string[] = [
  'total',
  'subtotal',
  'paid_amount',
  'discount_total',
  'tax_total',
  'amount',
  'status',
  'quantity',
  'buy_price',
  'sell_price',
  'opening_balance',
  'credit_limit',
  'salary',
]

/**
 * Entities whose updates are genuinely descriptive.
 *
 * ⚠️ AN ALLOW-LIST. Everything not named here validates, so a table added
 * later is safe by default instead of safe only if somebody remembered.
 */
export const DESCRIPTIVE_ENTITIES: readonly LocalTable[] = ['customer', 'product', 'employee']

export type PushRoute = 'domain' | 'versioned'

/**
 * Where this write goes.
 *
 * ⚠️ DEFAULTS TO THE DOMAIN. An entity nobody classified, or a payload whose
 * shape is unfamiliar, takes the road that validates — never the one that
 * writes the row as given. Guessing wrong in this direction is a slower save;
 * guessing wrong in the other is a wrong number in somebody's books.
 */
export function routeFor(input: {
  entity: LocalTable
  operation: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
}): PushRoute {
  if (FINANCIAL_ENTITIES.includes(input.entity)) return 'domain'

  // A create always goes through the domain: defaults, numbering and the
  // opening balances a new row implies are the server's to decide.
  if (input.operation === 'create') return 'domain'

  // A delete can cascade into money — deleting a customer with an unpaid
  // balance is not a text edit — so it is the domain's call too.
  if (input.operation === 'delete') return 'domain'

  // ⚠️ AN UNKNOWN ENTITY IS NOT A SAFE ONE.
  //
  // Reaching this point on a table nobody classified used to mean «no
  // financial field in the payload, so take the fast road» — which routes a
  // table added next year straight past the domain, on its first update, with
  // nothing to notice. Only the entities named below are known to be
  // descriptive; everything else validates.
  if (!DESCRIPTIVE_ENTITIES.includes(input.entity)) return 'domain'

  const touchesMoney = Object.keys(input.payload).some((key) => FINANCIAL_FIELDS.includes(key))
  return touchesMoney ? 'domain' : 'versioned'
}

/**
 * The payload as the versioned road may receive it.
 *
 * ⚠️ A SECOND GATE, NOT A CONVENIENCE. `routeFor` already refused a payload
 * carrying money, but a caller that builds the payload elsewhere — or a field
 * added to a table later — would slip through on the next change. Stripping
 * here means the versioned road CANNOT carry a financial field even if the
 * routing above is one day wrong.
 */
export function stripFinancialFields(payload: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (FINANCIAL_FIELDS.includes(key)) continue
    safe[key] = value
  }
  return safe
}
