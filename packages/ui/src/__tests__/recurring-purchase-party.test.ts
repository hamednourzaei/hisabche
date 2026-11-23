// ============================================
// packages/ui/src/__tests__/recurring-purchase-party.test.ts
//
// A recurring PURCHASE template was saved with the party in `customerId`.
//
// The invoice itself was correct: `POST /api/invoices` mapped a purchase to
// `supplierId` (invoice-preview-container.tsx:364-368). The recurring template
// two hundred lines below it did not — it sent `customerId` for every invoice
// type. The server validates a template with the invoice's own schema, so the
// template either failed to save or saved a purchase whose supplier was filed
// as a customer, and every issue of that arrangement repeated the mistake.
//
// The payload is `z.record(z.unknown())`, so the compiler could not see it.
// This test reads the source and asserts the mapping; it strips comments first
// so the explanation above cannot satisfy it.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE = join(
  __dirname,
  '..',
  'components',
  'ui',
  'invoice-builder',
  'containers',
  'invoice-preview-container.tsx',
)

/** Comments removed, whitespace flattened: an assertion must match code only. */
function code(): string {
  return readFileSync(SOURCE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
}

describe('a recurring template carries the same party as its invoice', () => {
  it('maps a purchase to supplierId and a sale to customerId, in the template payload', () => {
    const text = code()

    // The template branch is the `invoice:` object inside createRecurring.mutateAsync.
    const start = text.indexOf('createRecurring.mutateAsync')
    expect(start, 'createRecurring.mutateAsync is gone — update this guard').toBeGreaterThan(-1)
    const template = text.slice(start, text.indexOf('items,', start))

    expect(template).toContain(
      "draft.transactionType === 'purchase' ? { supplierId: primaryCustomer.id } : { customerId: primaryCustomer.id }",
    )
    // And not the old shape: a bare customerId beside a purchase type.
    expect(template).not.toContain(
      '...(primaryCustomer?.id ? { customerId: primaryCustomer.id } : {}),',
    )
  })
})
