// ============================================
// The till a payment names.
//
// One read, used wherever cash is about to be put into or taken out of a till
// that a PERSON chose (a sale's receipt, a purchase's payment): is it a till
// of this business, is it open, may this member use it, and what currency
// does it count in.
//
// ⚠️ The till id comes from the client and is a REQUEST. Everything about the
// till is read here, inside the workspace — nothing the client says about its
// currency or status is believed.
// ============================================

import { supabase } from '../../db'
import { ForbiddenError } from '../../errors/auth.error'
import { ConflictError, DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { branches } from '../branch'
import { mayUseBranch } from '../branch/branch.domain'
import type { TenancyContext } from '../tenancy.service'

const MISSING_COLUMN = new Set(['42703', 'PGRST204'])

export interface ChosenTill {
  id: string
  /** NULL = the books currency (every till opened before a till had one). */
  currency: string | null
  branchId: string | null
}

type TillRow = {
  id: string
  status: string
  branch_id: string | null
  currency?: string | null
}

export async function tillForPayment(ctx: TenancyContext, sessionId: string): Promise<ChosenTill> {
  const withCurrency = await supabase
    .from('pos_sessions')
    .select('id, status, branch_id, currency')
    .eq('workspace_id', ctx.workspaceId)
    .eq('id', sessionId)
    .maybeSingle()

  let row = withCurrency.data as TillRow | null
  let error = withCurrency.error
  if (error && MISSING_COLUMN.has(error.code ?? '')) {
    // Before pos-till-currency-01: every till counts in the books currency.
    const plain = await supabase
      .from('pos_sessions')
      .select('id, status, branch_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', sessionId)
      .maybeSingle()
    row = plain.data as TillRow | null
    error = plain.error
  }
  if (error) throw new DatabaseError('Failed to read the till of the payment', error)

  // A till of another business reads as no till: its existence is not said.
  if (!row) throw new ValidationError('PAYMENT_TILL_NOT_FOUND')
  // Closed, being counted, or suspended: its count must not move under it.
  if (row.status !== 'open') throw new ConflictError('PAYMENT_TILL_NOT_OPEN')

  // A till placed in a branch belongs to the people of that branch.
  if (row.branch_id) {
    const scope = await branches.scopeFor(ctx)
    if (!mayUseBranch(scope, row.branch_id)) {
      throw new ForbiddenError('PAYMENT_TILL_NOT_PERMITTED')
    }
  }

  return { id: row.id, currency: row.currency ?? null, branchId: row.branch_id ?? null }
}
