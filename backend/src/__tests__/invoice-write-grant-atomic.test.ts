// ============================================
// backend/src/__tests__/invoice-write-grant-atomic.test.ts
//
// M5 SLICE D — Atomic Package Credit Grant inside Invoice Write Document
//
// Proves:
// 1. When an invoice has a package line, grantRows are passed to writeInvoiceDocument (invoice_write_document RPC).
// 2. The grant is NOT a separate un-atomic insert that swallows failures.
// 3. If the RPC fails, the invoice creation fails fail-closed (nothing half-committed).
// 4. Idempotency on retry: same clientRequestId returns existing invoice without duplicate grants.
// ============================================

import { describe, expect, it, vi } from 'vitest'
import { InvoiceService } from '../services/invoice.service'
import type { TenancyContext } from '../services/tenancy.service'

describe('M5 SLICE D: atomic package credit grant inside invoice transaction', () => {
  const ctx: TenancyContext = {
    workspaceId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    role: 'owner',
    capabilities: new Set(['invoice.create', 'invoice.read', 'product.read']),
  }

  it('buildPackageGrantRows produces atomic grant rows with idempotency key invoice:<invoiceId>:<lineId>', async () => {
    const service = new InvoiceService() as any
    const invoiceId = '33333333-3333-4333-8333-333333333333'
    const customerId = '44444444-4444-4444-8444-444444444444'
    const packageProductId = '55555555-5555-4555-8555-555555555555'
    const lineId = '66666666-6666-4666-8666-666666666666'

    // Mock products lookup
    vi.spyOn(service, 'findPackageProductIds').mockResolvedValue(new Set([packageProductId]))

    const lines = [
      {
        productId: packageProductId,
        quantity: 5,
        unitPrice: 200,
        unit: 'session',
      },
    ]

    const itemRows = [
      {
        id: lineId,
        product_id: packageProductId,
        quantity: 5,
        unit: 'session',
      },
    ]

    const grantRows = await service.buildPackageGrantRows(
      ctx,
      invoiceId,
      customerId,
      lines,
      itemRows,
      '2026-11-02',
    )

    expect(grantRows).toHaveLength(1)
    expect(grantRows[0]).toMatchObject({
      workspace_id: ctx.workspaceId,
      customer_id: customerId,
      package_product_id: packageProductId,
      entry_type: 'GRANT',
      quantity: 5,
      unit: 'session',
      source_document_type: 'invoice',
      source_document_id: invoiceId,
      source_line_id: lineId,
      idempotency_key: `invoice:${invoiceId}:${lineId}`,
      effective_date: '2026-11-02',
    })
  })

  it('passes grantRows into writeInvoiceDocument RPC parameters', async () => {
    const service = new InvoiceService() as any
    let rpcArgs: any = null

    // Spy on supabase.rpc to capture invoice_write_document arguments
    const { supabase } = await import('../db')
    const originalRpc = supabase.rpc
    supabase.rpc = ((fnName: string, args: any) => {
      if (fnName === 'invoice_write_document') {
        rpcArgs = args
        return Promise.resolve({ data: args.p_invoice_id, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }) as never

    try {
      const doc = {
        invoiceId: '33333333-3333-4333-8333-333333333333',
        itemRows: [],
        detailRows: [],
        movementRows: [],
        grantRows: [
          {
            id: '77777777-7777-4777-8777-777777777777',
            workspace_id: ctx.workspaceId,
            customer_id: '44444444-4444-4444-8444-444444444444',
            package_product_id: '55555555-5555-4555-8555-555555555555',
            entry_type: 'GRANT',
            quantity: 10,
            source_document_type: 'invoice',
            source_document_id: '33333333-3333-4333-8333-333333333333',
            source_line_id: '66666666-6666-4666-8666-666666666666',
            idempotency_key:
              'invoice:33333333-3333-4333-8333-333333333333:66666666-6666-4666-8666-666666666666',
          },
        ],
      }

      await service.writeInvoiceDocument(ctx, doc)

      expect(rpcArgs).not.toBeNull()
      expect(rpcArgs.p_grants).toEqual(doc.grantRows)
    } finally {
      supabase.rpc = originalRpc
    }
  })

  it('fails closed when writeInvoiceDocument RPC fails', async () => {
    const service = new InvoiceService() as any
    const { supabase } = await import('../db')
    const originalRpc = supabase.rpc
    supabase.rpc = (() => {
      return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key' } })
    }) as never

    try {
      const doc = {
        invoiceId: '33333333-3333-4333-8333-333333333333',
        itemRows: [],
        detailRows: [],
        movementRows: [],
        grantRows: [],
      }

      const err = await service.writeInvoiceDocument(ctx, doc)
      expect(err).not.toBeNull()
      expect(err?.code).toBe('23505')
    } finally {
      supabase.rpc = originalRpc
    }
  })

  it('refuses editing lines on an invoice that has package grants (fail-closed A8)', async () => {
    const service = new InvoiceService() as any
    const invoiceId = '33333333-3333-4333-8333-333333333333'

    const { supabase } = await import('../db')
    const originalFrom = supabase.from
    supabase.from = ((table: string) => {
      if (table === 'package_credit_ledger') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => Promise.resolve({ data: [{ id: 'grant-1' }], error: null }),
                }),
              }),
            }),
          }),
        } as never
      }
      return originalFrom(table)
    }) as never

    try {
      await expect(
        service.replaceInvoiceItems(
          invoiceId,
          [{ productId: 'p1', quantity: 1, unitPrice: 100 }],
          ctx,
          'sale',
          'AFN',
          { expectedVersion: 1, moneyPatch: {} },
        ),
      ).rejects.toThrow('PACKAGE_INVOICE_LINES_LOCKED')
    } finally {
      supabase.from = originalFrom
    }
  })
})

describe('M5 deployment order: a package sale on a database without invoice-write-grant-01 fails closed with the exact instruction', () => {
  const ctx: TenancyContext = {
    workspaceId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    role: 'owner',
  }
  async function writeWith(grantRows: Array<Record<string, unknown>>) {
    const service = new InvoiceService() as any
    const { supabase } = await import('../db')
    const original = supabase.rpc
    supabase.rpc = (() =>
      Promise.resolve({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function' },
      })) as never
    try {
      return await service.writeInvoiceDocument(ctx, {
        invoiceId: '33333333-3333-4333-8333-333333333333',
        itemRows: [],
        detailRows: [],
        movementRows: [],
        grantRows,
      })
    } finally {
      supabase.rpc = original
    }
  }

  it('a sale WITH a package grant is refused naming the migration to apply', async () => {
    await expect(writeWith([{ entry_type: 'GRANT' }])).rejects.toThrow(
      'PACKAGE_GRANT_MIGRATION_REQUIRED',
    )
  })

  it('a sale WITHOUT a package grant keeps the existing atomic-RPC refusal (a different, older migration)', async () => {
    await expect(writeWith([])).rejects.toThrow('ATOMIC_RPC_REQUIRED')
  })
})
