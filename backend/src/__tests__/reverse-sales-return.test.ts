// ============================================
// backend/src/__tests__/reverse-sales-return.test.ts
//
// Unit tests for the thin InvoiceReturnService:
// Verifies RPC dispatch, parameter mapping, error translation,
// and cache invalidation.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConflictError, NotFoundError } from '../errors/database.error'

const WORKSPACE_A = '11111111-1111-1111-1111-111111111111'
const WORKSPACE_B = '22222222-2222-2222-2222-222222222222'
const INVOICE_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const INVOICE_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const LINE_A_ID = 'line-1111-1111-1111-111111111111'

let rpcHandler: (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>
let invalidatedWorkspaces: string[] = []

vi.mock('../utils/money-cache', () => ({
  invalidateMoneyCaches: async (ws: string) => {
    invalidatedWorkspaces.push(ws)
  },
}))

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, val: unknown) => ({
          eq: (_col2: string, val2: unknown) => ({
            maybeSingle: async () => {
              if (table === 'invoices' && val === INVOICE_B_ID && val2 === WORKSPACE_A) {
                return { data: null, error: null }
              }
              if (table === 'invoices' && val === INVOICE_A_ID && val2 === WORKSPACE_A) {
                return { data: { id: INVOICE_A_ID }, error: null }
              }
              return { data: null, error: null }
            },
            then: (resolve: (res: unknown) => void) => {
              resolve({ data: [], error: null })
            },
          }),
        }),
      }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => rpcHandler(fn, args),
  },
}))

describe('InvoiceReturnService (thin RPC caller)', () => {
  let service: any

  beforeEach(async () => {
    invalidatedWorkspaces = []
    const mod = await import('../services/sales/invoice-return.service')
    service = new mod.InvoiceReturnService()
  })

  it('rejects fetching returns if invoice does not belong to workspace', async () => {
    await expect(service.getReturns(WORKSPACE_A, INVOICE_B_ID)).rejects.toThrow(NotFoundError)
  })

  it('translates INVOICE_NOT_FOUND RPC error to NotFoundError', async () => {
    rpcHandler = async () => ({
      data: null,
      error: { message: 'INVOICE_NOT_FOUND', code: 'P0002' },
    })

    await expect(
      service.createReturn(WORKSPACE_A, {
        originalInvoiceId: INVOICE_B_ID,
        returnType: 'sale_return',
        returnNumber: 'RET-001',
        returnDate: '2026-10-26',
        lines: [{ originalLineId: LINE_A_ID, returnQuantity: 1 }],
      }),
    ).rejects.toThrow(NotFoundError)
  })

  it('translates RETURN_QUANTITY_EXCEEDS_ORIGINAL RPC error to ConflictError', async () => {
    rpcHandler = async () => ({
      data: null,
      error: { message: 'RETURN_QUANTITY_EXCEEDS_ORIGINAL', code: 'P0001' },
    })

    await expect(
      service.createReturn(WORKSPACE_A, {
        originalInvoiceId: INVOICE_A_ID,
        returnType: 'sale_return',
        returnNumber: 'RET-001',
        returnDate: '2026-10-26',
        lines: [{ originalLineId: LINE_A_ID, returnQuantity: 100 }],
      }),
    ).rejects.toThrow(ConflictError)
  })

  it('dispatches RPC, returns created document, and calls invalidateMoneyCaches', async () => {
    let capturedArgs: any = null
    rpcHandler = async (_fn, args) => {
      capturedArgs = args
      return {
        data: {
          id: 'return-uuid-1',
          workspaceId: WORKSPACE_A,
          originalInvoiceId: INVOICE_A_ID,
          returnNumber: 'RET-001',
          grandTotalMinor: 20000,
        },
        error: null,
      }
    }

    const res = await service.createReturn(WORKSPACE_A, {
      originalInvoiceId: INVOICE_A_ID,
      returnType: 'sale_return',
      returnNumber: 'RET-001',
      returnDate: '2026-10-26',
      lines: [
        {
          originalLineId: LINE_A_ID,
          returnQuantity: 2,
          restockChoice: 'restock',
          reasonCode: 'defective',
        },
      ],
    })

    expect(res.id).toBe('return-uuid-1')
    expect(res.grandTotalMinor).toBe(20000)
    expect(capturedArgs.p_workspace_id).toBe(WORKSPACE_A)
    expect(capturedArgs.p_return.originalInvoiceId).toBe(INVOICE_A_ID)
    expect(capturedArgs.p_lines[0].quantity).toBe(2)
    expect(capturedArgs.p_lines[0].restockChoice).toBe('restock')
    expect(invalidatedWorkspaces).toContain(WORKSPACE_A)
  })
})
