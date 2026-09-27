// Editing an invoice (27 Sep 2026):
//   - the stock given back is the NET of what the invoice moved, not the old
//     lines re-read without their unit («2 cartons» gave back 2 pieces);
//   - the header's money is derived from the lines, never taken from the body;
//   - a line edit names the version it read; a stale one writes nothing.
// The SQL half of the same rules: invoice-write-document.pg.test.ts.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { netReversal } from '../services/invoices/stock-reversal.domain'

const W = 'wh-1'

describe('netReversal', () => {
  it('a sale of 48 (2 cartons) comes back as 48 — whatever unit made it', () => {
    expect(
      netReversal([
        { product_id: 'p', quantity: -48, from_warehouse_id: W, to_warehouse_id: null },
      ]),
    ).toEqual([
      {
        product_id: 'p',
        type: 'purchase',
        quantity: 48,
        from_warehouse_id: null,
        to_warehouse_id: W,
      },
    ])
  })

  it('earlier edits are netted in: never reversed twice', () => {
    const recorded = [
      { product_id: 'p', quantity: -48, from_warehouse_id: W, to_warehouse_id: null },
      { product_id: 'p', quantity: 48, from_warehouse_id: null, to_warehouse_id: W }, // edit 1's give-back
      { product_id: 'p', quantity: '-24', from_warehouse_id: W, to_warehouse_id: null }, // edit 1's new line
    ]
    expect(netReversal(recorded)).toEqual([
      {
        product_id: 'p',
        type: 'purchase',
        quantity: 24,
        from_warehouse_id: null,
        to_warehouse_id: W,
      },
    ])
  })

  it('a purchase goes back out of the warehouse it arrived in', () => {
    expect(
      netReversal([{ product_id: 'p', quantity: 10, from_warehouse_id: null, to_warehouse_id: W }]),
    ).toEqual([
      { product_id: 'p', type: 'sale', quantity: -10, from_warehouse_id: W, to_warehouse_id: null },
    ])
  })

  it('per product AND warehouse; a net of zero moves nothing', () => {
    const out = netReversal([
      { product_id: 'a', quantity: -1, from_warehouse_id: W, to_warehouse_id: null },
      { product_id: 'a', quantity: -2, from_warehouse_id: 'wh-2', to_warehouse_id: null },
      { product_id: 'b', quantity: -3, from_warehouse_id: W, to_warehouse_id: null },
      { product_id: 'b', quantity: 3, from_warehouse_id: null, to_warehouse_id: W },
    ])
    expect(out.map((m) => [m.product_id, m.quantity, m.to_warehouse_id])).toEqual([
      ['a', 1, W],
      ['a', 2, 'wh-2'],
    ])
  })

  it('float noise does not leave a phantom 0.000000001 movement', () => {
    expect(
      netReversal([
        { product_id: 'p', quantity: -0.1, from_warehouse_id: W, to_warehouse_id: null },
        { product_id: 'p', quantity: -0.2, from_warehouse_id: W, to_warehouse_id: null },
        { product_id: 'p', quantity: 0.3, from_warehouse_id: null, to_warehouse_id: W },
      ]),
    ).toEqual([])
  })
})

describe('update() — refusal rules (source)', () => {
  // Comments stripped (CLAUDE.md §9): the explanation of a removed line quotes it.
  const src = readFileSync(join(__dirname, '..', 'services', 'invoice.service.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*\r?\n/gm, '')
  const update = src.slice(
    src.indexOf('  async update('),
    src.indexOf('  private async replaceInvoiceItems('),
  )

  it('the client total is never written', () => {
    expect(update).not.toContain('updates.total = data.total')
    expect(update).toContain('INVOICE_TOTAL_IS_DERIVED')
  })

  it('a line edit requires the version, and the money comes from computeInvoiceMoney', () => {
    expect(update).toContain('INVOICE_VERSION_REQUIRED')
    expect(update).toContain('computeInvoiceMoney({')
    expect(update).toContain('expectedVersion,')
  })

  it('the edit path writes through the single document function', () => {
    const replace = src.slice(src.indexOf('  private async replaceInvoiceItems('))
    expect(replace.slice(0, 3000)).toContain('replaceItems: true')
    expect(replace.slice(0, 3000)).not.toContain(".from('invoice_items').delete()")
  })

  it('no compensating DELETE of an invoice remains (rule 4)', () => {
    expect(src).not.toMatch(/from\('invoices'\)\s*\.delete\(\)\s*\.eq\('id', invoiceId\)/)
  })
})

describe('PATCH /api/invoices/:id — errors keep their status', () => {
  const routes = readFileSync(join(__dirname, '..', 'routes', 'invoice.routes.ts'), 'utf8')
  it('a 409 / 400 / 404 is not turned into a 500', () => {
    const patch = routes.slice(
      routes.indexOf("'/api/invoices/:id',"),
      routes.indexOf('DELETE /api/invoices/:id'),
    )
    expect(patch).toContain("sendFailure(reply, fastify.log, err, 'Failed to update invoice')")
  })
})
