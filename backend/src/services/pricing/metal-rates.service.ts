// ============================================
// backend/src/services/pricing/metal-rates.service.ts
//
// Metal Rates & Gold Operations Service (Gold & Jewellery)
// Enforces workspace_id tenancy boundary on every query and delegates
// domain math + validation to @hisabche/validation gold-jewellery.domain.
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  planSecondHandGoldPurchase,
  reconcileGoldLocationWeights,
  recordGoldMeltScrapMovement,
  type GoldMeltScrapRequest,
  type GoldReconcileLocationRequest,
  type SecondHandGoldPurchaseRequest,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'

const isNotReady = (error: { code?: string } | null) =>
  error?.code === '42P01' ||
  error?.code === 'PGRST205' ||
  error?.code === 'PGRST202' ||
  error?.code === '42883'

export class MetalRatesService {
  constructor(private readonly db: SupabaseClient = supabase) {}

  async getLatestMetalRate(workspaceId: string) {
    const { data, error } = await this.db
      .from('metal_rates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('rate_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  }

  async listMetalRates(workspaceId: string) {
    const { data, error } = await this.db
      .from('metal_rates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('rate_date', { ascending: false })
      .limit(90)

    if (error) throw error
    return data ?? []
  }

  async recordMetalRate(
    workspaceId: string,
    input: {
      rateDate: string
      rate24kMinorPerGram: number
      setBy?: string | undefined
    },
  ) {
    const payload: Record<string, unknown> = {
      workspace_id: workspaceId,
      rate_date: input.rateDate,
      rate_24k_minor_per_gram: input.rate24kMinorPerGram,
    }
    if (input.setBy) payload.set_by = input.setBy

    const { data, error } = await this.db.from('metal_rates').insert(payload).select().single()

    if (error) throw error
    return data
  }

  private async requireLatestRateSnapshot(ctx: TenancyContext) {
    const latest = (await this.getLatestMetalRate(ctx.workspaceId)) as {
      rate_24k_minor_per_gram?: number | string
      rate_date?: string
      created_at?: string
      set_by?: string | null
    } | null
    if (!latest || !latest.rate_24k_minor_per_gram) {
      throw new ValidationError('GOLD_RATE_REQUIRED')
    }
    return {
      rate24kMinorPerGram: Number(latest.rate_24k_minor_per_gram),
      capturedAt: latest.created_at ?? latest.rate_date ?? new Date().toISOString(),
      capturedBy: latest.set_by ?? ctx.userId,
    }
  }

  async listGoldOperations(ctx: TenancyContext) {
    const { data, error } = await this.db
      .from('gold_operations')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (isNotReady(error)) return { ready: false, operations: [] }
    if (error) throw new DatabaseError('Failed to list gold operations', error)
    return { ready: true, operations: data ?? [] }
  }

  async recordSecondHandPurchase(
    ctx: TenancyContext,
    input: SecondHandGoldPurchaseRequest,
    clientRequestId: string | null,
  ) {
    const rateSnapshot = await this.requireLatestRateSnapshot(ctx)
    let plan
    try {
      plan = planSecondHandGoldPurchase({
        scrapWeightMg: input.scrapWeightMg,
        scrapKarat: input.karat,
        rateSnapshot,
        deductionBp: input.deductionBp,
        kycThresholdMinor: input.kycThresholdMinor ?? null,
        hasIdentityCaptured: Boolean(input.identity),
      })
    } catch (err) {
      throw new ValidationError(err instanceof Error ? err.message : 'GOLD_OPERATION_INVALID')
    }

    const { data, error } = await this.db.rpc('gold_record_second_hand_purchase', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_op: {
        karat: input.karat,
        input_weight_mg: input.scrapWeightMg,
        recovered_pure_mg: plan.pureEquivalentMg,
        rate_24k_minor_per_gram: rateSnapshot.rate24kMinorPerGram,
        gross_credit_minor: plan.grossCreditMinor,
        deduction_bp: input.deductionBp,
        net_credit_minor: plan.netCreditMinor,
        customer_id: input.customerId ?? null,
        id_full_name: input.identity?.fullName ?? null,
        id_type: input.identity?.idType ?? null,
        id_number: input.identity?.idNumber ?? null,
        kyc_threshold_minor: input.kycThresholdMinor ?? null,
        note: input.note ?? null,
        client_request_id: clientRequestId,
      },
    })
    if (error && (error.message ?? '').includes('GOLD_KYC_REQUIRED')) {
      throw new ValidationError('GOLD_KYC_REQUIRED')
    }
    if (isNotReady(error)) throw new ValidationError('GOLD_MIGRATION_PENDING')
    if (error) throw new DatabaseError('Failed to record second-hand gold purchase', error)
    return data
  }

  async recordMeltScrap(
    ctx: TenancyContext,
    input: GoldMeltScrapRequest,
    clientRequestId: string | null,
  ) {
    const rateSnapshot = await this.requireLatestRateSnapshot(ctx)
    let melt
    try {
      melt = recordGoldMeltScrapMovement({
        inputWeightMg: input.inputWeightMg,
        recoveredPureMg: input.recoveredPureMg,
        rate24kMinorPerGram: rateSnapshot.rate24kMinorPerGram,
      })
    } catch (err) {
      throw new ValidationError(err instanceof Error ? err.message : 'GOLD_WEIGHT_INVALID')
    }

    const { data, error } = await this.db.rpc('gold_record_melt_scrap', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_op: {
        karat: input.karat,
        input_weight_mg: melt.inputWeightMg,
        recovered_pure_mg: melt.recoveredPureMg,
        rate_24k_minor_per_gram: rateSnapshot.rate24kMinorPerGram,
        waste_cost_minor: melt.wasteCostMinor,
        note: input.note ?? null,
        client_request_id: clientRequestId,
      },
    })
    if (error && (error.message ?? '').includes('GOLD_RECOVERED_EXCEEDS_INPUT')) {
      throw new ValidationError('GOLD_RECOVERED_EXCEEDS_INPUT')
    }
    if (isNotReady(error)) throw new ValidationError('GOLD_MIGRATION_PENDING')
    if (error) throw new DatabaseError('Failed to record gold melt/scrap movement', error)
    return data
  }

  async listGoldReconciliations(ctx: TenancyContext) {
    const { data, error } = await this.db
      .from('gold_location_reconciliations')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('reconciled_at', { ascending: false })
      .limit(200)
    if (isNotReady(error)) return { ready: false, reconciliations: [] }
    if (error) throw new DatabaseError('Failed to list gold location reconciliations', error)
    return { ready: true, reconciliations: data ?? [] }
  }

  async reconcileLocation(
    ctx: TenancyContext,
    input: GoldReconcileLocationRequest,
    clientRequestId: string | null,
  ) {
    const check = reconcileGoldLocationWeights({
      location: input.location,
      systemWeightMg: input.systemWeightMg,
      physicalCountedMg: input.physicalCountedMg,
    })

    const { data, error } = await this.db.rpc('gold_reconcile_location', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_rec: {
        location: check.location,
        karat: input.karat,
        system_weight_mg: check.systemWeightMg,
        physical_counted_mg: check.physicalCountedMg,
        note: input.note ?? null,
        client_request_id: clientRequestId,
      },
    })
    if (isNotReady(error)) throw new ValidationError('GOLD_MIGRATION_PENDING')
    if (error) throw new DatabaseError('Failed to record gold location reconciliation', error)
    return data
  }
}
