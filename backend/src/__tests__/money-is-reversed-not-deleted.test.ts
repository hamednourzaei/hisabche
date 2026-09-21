// ============================================
// ⚠️ A PAYMENT THAT DISAPPEARS TAKES THE TRUTH WITH IT.
//
// `DELETE /api/transactions/:id` ran `supabase.from('transactions').delete()`
// straight against the table. The row vanished and nothing else moved:
//
//   • the invoices that payment settled kept their `paid_amount`, so an
//     invoice stayed «paid» with no payment behind it;
//   • the ledger kept the entry that booked the cash in;
//   • and the audit trail kept no record that the money was ever received,
//     because the record WAS the deleted row.
//
// It also required no capability, so any member could do it.
//
// `cancelPayment` is what the operation actually is: it un-allocates the
// invoices, books the reversing entry, enforces separation of duties and
// demands `payment.cancel`. This test is what keeps the shortcut from coming
// back the next time somebody wants a quick delete.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const routes = (name: string): string =>
  readFileSync(join(__dirname, '..', 'routes', name), 'utf8')
    // Comments explain the bug and name the very calls asserted against.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const transactions = routes('transaction.routes.ts')

describe('money is reversed, never deleted', () => {
  it('⚠️ no route deletes a financial row straight from the table', () => {
    // The pattern, not the file: `.from('transactions').delete()` in any
    // route is the same bug wearing a different name.
    for (const table of ['transactions', 'invoices', 'invoice_items', 'payments']) {
      expect(transactions).not.toContain(`.from('${table}')\n        .delete()`)
      expect(transactions).not.toMatch(
        new RegExp(`from\\(['"]${table}['"]\\)[\\s\\S]{0,80}\\.delete\\(\\)`),
      )
    }
  })

  it('⚠️ deleting a transaction goes through the cancellation service', () => {
    expect(transactions).toContain('paymentsService.cancelPayment(')
  })

  it('⚠️ and requires the capability that cancelling requires', () => {
    // Reversing a receipt was open to any member. The person who took the
    // money is also not the person who may erase it — `cancelPayment`
    // enforces that, but only if it is reached at all.
    expect(transactions).toContain("requireCapability('payment.cancel')")
  })

  it('⚠️ the cancellation carries a reason, so the audit trail has one', () => {
    expect(transactions).toMatch(/reason \?\?/)
  })

  it('⚠️ every route file answers a refusal the same way', () => {
    // Two hand-written copies of the same error mapping is how one endpoint
    // answers with a translatable code and another with a bare message.
    for (const file of ['transaction.routes.ts', 'payments.routes.ts']) {
      expect(routes(file)).toContain('failRoute')
    }
  })
})
