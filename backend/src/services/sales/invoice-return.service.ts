// ============================================
// backend/src/services/sales/invoice-return.service.ts
//
// Invoice Returns Service (Option 18 / Returns)
// Thin caller of atomic Postgres function `invoice_return_create`.
// Ensures full atomic ledger reversal, restocking, cost recovery, and tenancy isolation.
// ============================================

import { fractionDigits, type KnownCurrency } from '@hisabche/formatting'
import type { ReturnLineRequest } from '@hisabche/validation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { asReplay } from '../../utils/client-request'
import { invalidateMoneyCaches } from '../../utils/money-cache'

export class InvoiceReturnService {
  constructor(private readonly db: SupabaseClient = supabase) {}

  async getReturns(workspaceId: string, originalInvoiceId: string) {
    // Fail closed: verify invoice belongs to workspace first
    const { data: inv, error: invErr } = await this.db
      .from('invoices')
      .select('id')
      .eq('id', originalInvoiceId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (invErr) throw new DatabaseError('Failed to verify invoice ownership', invErr)
    if (!inv) throw new NotFoundError('Invoice')

    const { data, error } = await this.db
      .from('invoice_returns')
      .select('*, lines:invoice_return_lines(*)')
      .eq('workspace_id', workspaceId)
      .eq('original_invoice_id', originalInvoiceId)

    if (error) throw new DatabaseError('Failed to fetch returns', error)
    return data ?? []
  }

  async createReturn(
    workspaceId: string,
    input: {
      originalInvoiceId: string
      returnType: 'sale_return' | 'purchase_return'
      returnNumber: string
      returnDate: string
      userId?: string | undefined
      clientRequestId?: string | null | undefined
      lines: readonly ReturnLineRequest[]
    },
  ) {
    if (!workspaceId) throw new ValidationError('ACCOUNTING_WORKSPACE_REQUIRED')

    // Idempotency check: if clientRequestId provided, check if return already exists
    if (input.clientRequestId) {
      const { data: existing } = await this.db
        .from('invoice_returns')
        .select('*, lines:invoice_return_lines(*)')
        .eq('workspace_id', workspaceId)
        .eq('client_request_id', input.clientRequestId)
        .maybeSingle()

      if (existing) {
        return asReplay(existing)
      }
    }

    // Fail closed: verify invoice belongs to workspace first and read currency for precision
    const { data: inv, error: invErr } = await this.db
      .from('invoices')
      .select('id, currency')
      .eq('id', input.originalInvoiceId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (invErr) throw new DatabaseError('Failed to verify invoice ownership', invErr)
    if (!inv) throw new NotFoundError('Invoice')

    const p_fraction_digits = inv.currency
      ? (fractionDigits(inv.currency as KnownCurrency) ?? 2)
      : 2

    // Call atomic Postgres function with exact minor unit factor
    const { data, error } = await this.db.rpc('invoice_return_create', {
      p_workspace_id: workspaceId,
      p_user_id: input.userId ?? null,
      p_fraction_digits,
      p_return: {
        originalInvoiceId: input.originalInvoiceId,
        returnType: input.returnType,
        returnNumber: input.returnNumber,
        returnDate: input.returnDate,
      },
      p_lines: input.lines.map((l) => ({
        originalLineId: l.originalLineId,
        quantity: l.returnQuantity,
        restockChoice: l.restockChoice ?? 'restock',
        reasonCode: l.reasonCode ?? 'return',
      })),
    })

    if (error) {
      const msg = error.message ?? ''
      // The function does not exist: docs/invoice-return-01-migration.sql has not
      // been applied to this database. Say so instead of a bare 500.
      if (
        error.code === 'PGRST202' ||
        error.code === '42883' ||
        /could not find the function|function .* does not exist/i.test(msg)
      ) {
        throw new DatabaseError(
          'RETURN_FUNCTION_MISSING: apply docs/invoice-return-01-migration.sql',
          error,
        )
      }
      if (msg.includes('INVOICE_NOT_FOUND')) throw new NotFoundError('Invoice')
      if (msg.includes('INVOICE_LINE_NOT_FOUND')) throw new NotFoundError('Invoice line')
      if (msg.includes('RETURN_QUANTITY_EXCEEDS_ORIGINAL')) {
        throw new ConflictError('RETURN_QUANTITY_EXCEEDS_ORIGINAL')
      }
      if (msg.includes('RETURN_ACCOUNTS_MISSING')) {
        throw new ConflictError(msg)
      }
      if (
        msg.includes('ACCOUNTING_WORKSPACE_REQUIRED') ||
        msg.includes('INVALID_RETURN_PARAMETERS') ||
        msg.includes('INVALID_FRACTION_DIGITS')
      ) {
        throw new ValidationError(msg)
      }
      if (msg.includes('JOURNAL_ENTRY_UNBALANCED')) {
        throw new ConflictError('JOURNAL_ENTRY_UNBALANCED')
      }
      throw new DatabaseError(msg, error)
    }

    if (input.clientRequestId && data && typeof data === 'object' && 'id' in data) {
      await this.db
        .from('invoice_returns')
        .update({ client_request_id: input.clientRequestId })
        .eq('workspace_id', workspaceId)
        .eq('id', (data as { id: string }).id)
    }

    // Invalidate financial and dashboard caches
    await invalidateMoneyCaches(workspaceId)

    return data
  }
}

export const invoiceReturnService = new InvoiceReturnService()
