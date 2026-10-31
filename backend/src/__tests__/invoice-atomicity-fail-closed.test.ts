// ============================================
// Target B: Invoice Atomicity & Fail-Closed Guard
//
// Asserts that writeInvoiceDocument:
// 1. Throws ATOMIC_RPC_REQUIRED if invoice_write_document RPC is missing (PGRST202 / 42883).
// 2. Prohibits silent stepwise degradation to prevent orphan partial-commit invoices.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Target B: invoice atomicity fail-closed invariant', () => {
  const serviceFile = join(__dirname, '..', 'services', 'invoice.service.ts')
  const content = readFileSync(serviceFile, 'utf8')

  it('prohibits fallback to stepwise write when RPC is missing', () => {
    // Assert writeInvoiceDocument does NOT call writeInvoiceDocumentStepwise
    const writeDocSection = content.slice(
      content.indexOf('private async writeInvoiceDocument('),
      content.indexOf('private async writeInvoiceDocumentStepwise('),
    )

    expect(writeDocSection).not.toContain('return this.writeInvoiceDocumentStepwise(ctx, doc)')
    expect(writeDocSection).toContain('ATOMIC_RPC_REQUIRED')
  })

  it('throws DatabaseError on PGRST202 or 42883', () => {
    const writeDocSection = content.slice(
      content.indexOf('private async writeInvoiceDocument('),
      content.indexOf('private async writeInvoiceDocumentStepwise('),
    )

    expect(writeDocSection).toMatch(/error\.code === 'PGRST202' \|\| error\.code === '42883'/)
    expect(writeDocSection).toContain('throw new DatabaseError(')
  })
})
