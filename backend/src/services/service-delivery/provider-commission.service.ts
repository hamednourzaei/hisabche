// ============================================
// backend/src/services/service-delivery/provider-commission.service.ts
//
// V54 — the provider commission REPORT (owner decision N-7). Reads; computes
// nothing itself — `buildProviderCommissionReport` (validation) is the rule.
//
// ⚠️ The base is each service's CURRENT price (sessions do not store a price),
// and the answer says so (`priceBasis`). A session settled by an invoice at a
// different price still counts at the list price; that is stated, not hidden.
// ⚠️ Not posted, not paid: this is what the owner reads to pay staff.
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildProviderCommissionReport,
  type CommissionServicePrice,
  type ProviderCommissionReport,
} from '@hisabche/validation'
import { FRACTION_DIGITS, type KnownCurrency } from '@hisabche/formatting'
import { supabase } from '../../db'
import { ConflictError, DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'

const isMissingTable = (code: string | undefined) => code === '42P01' || code === 'PGRST205'
const DAY = /^\d{4}-\d{2}-\d{2}$/

function toMinor(major: unknown, currency: string | null): number | null {
  const value = Number(major)
  if (!currency || !(currency in FRACTION_DIGITS) || !Number.isFinite(value)) return null
  const digits = FRACTION_DIGITS[currency as KnownCurrency]
  return Math.round(value * 10 ** digits)
}

export interface ProviderCommissionAnswer extends ProviderCommissionReport {
  /** False until docs/provider-commission-01-migration.sql has run: no rate can exist. */
  readonly configurable: boolean
  readonly priceBasis: 'current_list_price'
}

export class ProviderCommissionService {
  constructor(private readonly db: SupabaseClient = supabase) {}

  async report(ctx: TenancyContext, from: string, to: string): Promise<ProviderCommissionAnswer> {
    if (!DAY.test(from) || !DAY.test(to) || from > to) {
      throw new ValidationError('COMMISSION_PERIOD_INVALID')
    }

    const sessions = await this.db
      .from('service_delivery_sessions')
      .select('practitioner_id, service_offering_id, status')
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', 'delivered')
      .gte('session_date', from)
      .lte('session_date', to)
      .is('deleted_at', null)
    if (sessions.error) throw new DatabaseError('Failed to read the sessions', sessions.error)
    const rows = (sessions.data ?? []) as Array<{
      practitioner_id: string | null
      service_offering_id: string
      status: string
    }>

    const serviceIds = [...new Set(rows.map((row) => row.service_offering_id))]
    const prices = new Map<string, CommissionServicePrice>()
    if (serviceIds.length > 0) {
      const products = await this.db
        .from('products')
        .select('id, sell_price, currency')
        .eq('workspace_id', ctx.workspaceId)
        .in('id', serviceIds)
      if (products.error) throw new DatabaseError('Failed to read the services', products.error)
      for (const product of (products.data ?? []) as Array<{
        id: string
        sell_price: unknown
        currency: string | null
      }>) {
        prices.set(product.id, {
          priceMinor: toMinor(product.sell_price, product.currency),
          currency: product.currency,
        })
      }
    }

    const rates = new Map<string, number>()
    let configurable = true
    const stored = await this.db
      .from('provider_commission_rates')
      .select('employee_id, rate_bp')
      .eq('workspace_id', ctx.workspaceId)
    if (stored.error) {
      if (!isMissingTable(stored.error.code)) {
        throw new DatabaseError('Failed to read the commission rates', stored.error)
      }
      configurable = false
    } else {
      for (const row of (stored.data ?? []) as Array<{ employee_id: string; rate_bp: number }>) {
        rates.set(row.employee_id, Number(row.rate_bp))
      }
    }

    return {
      ...buildProviderCommissionReport(
        rows.map((row) => ({
          practitionerId: row.practitioner_id,
          serviceOfferingId: row.service_offering_id,
          status: row.status,
        })),
        prices,
        rates,
      ),
      configurable,
      priceBasis: 'current_list_price',
    }
  }

  /** Set one provider's rate. The employee must belong to THIS workspace. */
  async setRate(ctx: TenancyContext, employeeId: string, rateBp: number): Promise<void> {
    const employee = await this.db
      .from('employees')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', employeeId)
      .maybeSingle()
    if (employee.error) throw new DatabaseError('Failed to read the employee', employee.error)
    if (!employee.data) throw new ValidationError('EMPLOYEE_NOT_FOUND')

    const { error } = await this.db.from('provider_commission_rates').upsert(
      {
        workspace_id: ctx.workspaceId,
        employee_id: employeeId,
        rate_bp: rateBp,
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId,
      },
      { onConflict: 'workspace_id,employee_id' },
    )
    if (error) {
      if (isMissingTable(error.code)) throw new ConflictError('COMMISSION_NOT_CONFIGURED')
      throw new DatabaseError('Failed to store the commission rate', error)
    }
  }
}
