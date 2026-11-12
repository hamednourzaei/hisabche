// ============================================
// backend/src/services/accounting/overhead-allocation.service.ts
//
// V61 §2.7 — Explicit overhead allocation policy & idempotent period runs.
// Posts through ledger.postDocument / reverses through ledger.reverseDocument.
// ============================================

import {
  computeOverheadAllocation,
  type OverheadBasis,
  type OverheadPolicyInput,
  type OverheadRunInput,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { baseCurrencyOf } from '../base-currency'
import type { TenancyContext } from '../tenancy.service'
import { AccountingService } from './accounting.service'
const accountingService = new AccountingService()

export interface OverheadPolicyRow {
  id: string
  workspace_id: string
  basis: OverheadBasis
  source_account_ids: string[]
  target_dimension_id: string
  manual_weights: Record<string, number> | null
  version: number
  is_active: boolean
}

export class OverheadAllocationService {
  async getPolicy(ctx: TenancyContext): Promise<OverheadPolicyRow | null> {
    const { data, error } = await supabase
      .from('overhead_policies')
      .select(
        'id, workspace_id, basis, source_account_ids, target_dimension_id, manual_weights, version, is_active',
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return null
      throw new DatabaseError('Failed to read overhead policy', error)
    }
    return (data as OverheadPolicyRow | null) ?? null
  }

  async savePolicy(ctx: TenancyContext, input: OverheadPolicyInput): Promise<OverheadPolicyRow> {
    const current = await this.getPolicy(ctx)
    const nextVersion = current ? current.version + 1 : 1
    if (current) {
      await supabase
        .from('overhead_policies')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', current.id)
    }
    const { data, error } = await supabase
      .from('overhead_policies')
      .insert({
        workspace_id: ctx.workspaceId,
        basis: input.basis,
        source_account_ids: input.sourceAccountIds,
        target_dimension_id: input.targetDimensionId,
        manual_weights: input.manualWeights ?? null,
        version: nextVersion,
        is_active: true,
        created_by: ctx.userId,
      })
      .select(
        'id, workspace_id, basis, source_account_ids, target_dimension_id, manual_weights, version, is_active',
      )
      .single()
    if (error || !data) throw new DatabaseError('Failed to save overhead policy', error)
    return data as OverheadPolicyRow
  }

  async runAllocation(
    ctx: TenancyContext,
    input: OverheadRunInput & {
      poolAmountMinor: number | null
      targets: Array<{ dimensionValueId: string; driverValue: number | null }>
    },
  ) {
    const policy = await this.getPolicy(ctx)
    if (!policy) throw new ConflictError('OVERHEAD_ALLOCATION_NOT_CONFIGURED')

    const idempotencyKey = `overhead-${input.period}`
    const { data: existing, error: exErr } = await supabase
      .from('overhead_allocation_runs')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (exErr && exErr.code !== '42P01' && exErr.code !== 'PGRST205') {
      throw new DatabaseError('Failed to check existing overhead run', exErr)
    }
    if (existing) return { run: existing, replay: true }

    const computed = computeOverheadAllocation({
      basis: policy.basis,
      poolAmountMinor: input.poolAmountMinor,
      targets: input.targets,
      manualWeights: policy.manual_weights ?? undefined,
    })
    if (computed.status !== 'allocated') {
      throw new ConflictError(
        computed.status === 'unknown_cost' ? 'OVERHEAD_COST_UNKNOWN' : 'OVERHEAD_DRIVER_ZERO',
      )
    }

    const bookCurrency = await baseCurrencyOf(ctx.workspaceId)
    const currency = input.currency ?? bookCurrency

    const { data: runRow, error: insErr } = await supabase
      .from('overhead_allocation_runs')
      .insert({
        workspace_id: ctx.workspaceId,
        policy_id: policy.id,
        policy_version: policy.version,
        period: input.period,
        currency,
        idempotency_key: idempotencyKey,
        pool_amount_minor: input.poolAmountMinor,
        allocations: computed.allocations,
        status: 'posted',
        created_by: ctx.userId,
      })
      .select('*')
      .single()
    if (insErr || !runRow) throw new DatabaseError('Failed to record overhead run', insErr)

    const sourceAccountId = policy.source_account_ids[0]!
    const lines = [
      {
        accountId: sourceAccountId,
        debitMinor: 0,
        creditMinor: input.poolAmountMinor!,
        description: `Overhead pool cleared (${input.period})`,
      },
      ...computed.allocations.map((a) => ({
        accountId: sourceAccountId,
        debitMinor: a.amountMinor,
        creditMinor: 0,
        description: `Overhead allocated to ${a.dimensionValueId} (${input.period})`,
        dimensionValueId: a.dimensionValueId,
      })),
    ]

    const posting = await accountingService.postDocument(ctx, {
      sourceType: 'overhead_allocation',
      sourceId: (runRow as { id: string }).id,
      date: input.entryDate,
      description: `Overhead allocation ${input.period}`,
      reference: idempotencyKey,
      lines: lines as never,
    })

    if (posting.status === 'posted' || posting.status === 'already_posted') {
      await supabase
        .from('overhead_allocation_runs')
        .update({ journal_entry_id: posting.entryId })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', (runRow as { id: string }).id)
    }

    return { run: runRow, replay: false, posting }
  }

  async reverseRun(ctx: TenancyContext, runId: string, reason: string, date?: string) {
    const { data: runRow, error } = await supabase
      .from('overhead_allocation_runs')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', runId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to load overhead run', error)
    if (!runRow) throw new NotFoundError('Overhead allocation run')

    const outcome = await accountingService.reverseDocument(ctx, 'overhead_allocation', runId, {
      reason,
      date,
    })
    await supabase
      .from('overhead_allocation_runs')
      .update({ status: 'reversed', reversed_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', runId)

    return { runId, outcome }
  }
}

export const overheadAllocationService = new OverheadAllocationService()
