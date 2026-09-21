// ============================================
// ⚠️ `/api/sync/push` WRITES THE ROW. IT DOES NOT SELL ANYTHING.
//
// It applies optimistic concurrency, files a conflict and updates the table —
// and that is all. No stock moves, no ledger entry is booked, no total is
// re-derived from the lines, no invoice number is taken.
//
// So a client able to send `total`, `paid_amount`, `status` or `amount`
// through it could mark an invoice paid with no payment behind it, or set a
// total the ledger never saw. The document and the books would then disagree
// permanently, and nothing in either app would notice.
//
// The allow-list in `sync.service.ts` used to include exactly those fields.
// No client called the endpoint yet, which is the only reason this was not a
// live incident. This test is what stops the next client from making it one.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(join(__dirname, '..', 'services/sync.service.ts'), 'utf8')

/** Comments explain the rule and name the very fields asserted against. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Everything that carries money or stock. */
const FINANCIAL = [
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
  'credit_limit',
  'opening_balance',
  'salary',
]

/** The `WRITABLE` map, as the service declares it. */
function writableBlock(): string {
  const start = code.indexOf('const WRITABLE')
  expect(start).toBeGreaterThan(-1)
  const end = code.indexOf('\n}', start)
  return code.slice(start, end)
}

describe('the generic sync road cannot move money', () => {
  it('⚠️ no financial field is writable through it', () => {
    const block = writableBlock()

    for (const field of FINANCIAL) {
      expect(block).not.toContain(`'${field}'`)
    }
  })

  it('⚠️ the invoice entity is reduced to its descriptive tail', () => {
    const block = writableBlock()
    const invoice = /invoice:\s*\[([^\]]*)\]/.exec(block)?.[1] ?? ''

    // Guards the guard: an empty match would make every assertion vacuous.
    expect(invoice).toContain("'id'")
    expect(invoice).toContain("'notes'")
    expect(invoice).not.toContain("'total'")
    expect(invoice).not.toContain("'status'")
    expect(invoice).not.toContain("'paid_amount'")
  })

  it('⚠️ a payment carries nothing but its note', () => {
    const block = writableBlock()
    const transaction = /transaction:\s*\[([^\]]*)\]/.exec(block)?.[1] ?? ''

    expect(transaction).toContain("'id'")
    expect(transaction).not.toContain("'amount'")
    expect(transaction).not.toContain("'type'")
    expect(transaction).not.toContain("'invoice_id'")
  })

  it('⚠️ stock is not a row update', () => {
    const block = writableBlock()
    const product = /product:\s*\[([^\]]*)\]/.exec(block)?.[1] ?? ''

    expect(product).toContain("'name'")
    // Stock changes through an inventory movement, which is costed.
    expect(product).not.toContain("'quantity'")
    expect(product).not.toContain("'buy_price'")
  })

  it('⚠️ the workspace and the user are still never writable', () => {
    // The rule this endpoint was rebuilt around: authority comes from the
    // verified token, never from the body.
    const block = writableBlock()
    expect(block).not.toContain("'workspace_id'")
    expect(block).not.toContain("'user_id'")
    expect(block).not.toContain("'version'")
  })
})

describe('a financial field is refused, not silently ignored', () => {
  it('⚠️ the service throws rather than dropping it', () => {
    // ⚠️ DROPPING AND REFUSING ARE DIFFERENT ANSWERS.
    //
    // `pickWritable` drops an unknown key on purpose — a newer client sending
    // a field this server has not learned about should still succeed on the
    // rest. That is forward compatibility.
    //
    // A financial key is not that. Ignoring `total` and answering «applied»
    // tells somebody who just changed an amount that it saved, when nothing
    // changed. They close the screen trusting a number the books do not have
    // — the fake success state this codebase forbids (G1).
    expect(code).toContain('REFUSED_FIELDS')
    expect(code).toContain('FINANCIAL_FIELD_NOT_WRITABLE')

    // The refusal names the road that does recalculate, so the client can act
    // on it instead of just showing a red box.
    expect(code).toContain('/api/invoices')
  })

  it('⚠️ every field removed from the allow-list is also refused', () => {
    // Otherwise narrowing the allow-list creates exactly the silent drop this
    // file exists to prevent: the field stops being written and nobody is
    // told.
    const refused = /REFUSED_FIELDS: readonly string\[\] = \[([^\]]*)\]/.exec(code)?.[1] ?? ''
    expect(refused).toBeTruthy()

    for (const field of FINANCIAL) {
      expect(refused).toContain(`'${field}'`)
    }
  })
})
