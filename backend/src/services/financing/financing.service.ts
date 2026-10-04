// ============================================
// backend/src/services/financing/financing.service.ts
//
// Capabilities #125 (loans) and #126 (investments) — two REGISTERS kept beside
// the books.
//
// ⚠️ NOTHING HERE POSTS TO THE LEDGER. The interest shown is the domain's
// calculation (`accruedInterest`: simple interest over the actual days), the
// instalment is `instalment`, and a holding's value is what a person stated on
// a day. Which accounts any of it belongs in is the owner's decision.
//
// ⚠️ TOTALS ARE PER CURRENCY. A dollar loan and an afghani loan are never
// added; neither are holdings.
//
// A row is closed with `is_active = false`, never deleted.
// ============================================

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import {
  accruedInterest,
  instalment,
  summarisePortfolio,
  type Facility,
  type FacilityKind,
  type PortfolioSummary,
} from './working-capital.domain'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])
const FACILITY_COLUMNS =
  'id, kind, counterparty, principal_minor, currency, annual_rate_percent, start_date, end_date, charges_per_year, is_active'
const HOLDING_COLUMNS = 'id, label, cost_minor, market_value_minor, currency, valued_on, is_active'

export const CHARGE_FREQUENCIES = [1, 2, 4, 12] as const

export class FinancingNotConfiguredError extends BaseError {
  constructor() {
    super('FINANCING_MIGRATION_PENDING', 503)
    this.name = 'FinancingNotConfiguredError'
  }
}

export interface FacilityView {
  id: string
  kind: FacilityKind
  counterparty: string
  /** Major units of `currency`. */
  principal: number
  currency: string
  annualRatePercent: number
  startDate: string
  endDate: string | null
  chargesPerYear: number
  isActive: boolean
  /** Simple interest from the start date to today (or the end date, if earlier). */
  accruedInterest: number
  accruedDays: number
  /**
   * The level instalment over the facility's term — null when there is no end
   * date (no term to spread it over) or the term is shorter than one period.
   */
  instalment: { perInstalment: number; total: number; count: number } | null
}

export interface HoldingView {
  id: string
  label: string
  cost: number
  marketValue: number
  currency: string
  valuedOn: string
  isActive: boolean
}

interface FacilityRow {
  id: string
  kind: FacilityKind
  counterparty: string
  principal_minor: number | string
  currency: string
  annual_rate_percent: number | string
  start_date: string
  end_date: string | null
  charges_per_year: number
  is_active: boolean
}
interface HoldingRow {
  id: string
  label: string
  cost_minor: number | string
  market_value_minor: number | string
  currency: string
  valued_on: string
  is_active: boolean
}

const day = (value: string) => String(value).slice(0, 10)
const today = () => new Date().toISOString().slice(0, 10)

/** Whole charging periods between two days: months ÷ (12 ÷ chargesPerYear). */
function periodsBetween(start: string, end: string, chargesPerYear: number): number {
  const [sy, sm, sd] = start.split('-').map(Number) as [number, number, number]
  const [ey, em, ed] = end.split('-').map(Number) as [number, number, number]
  const months = (ey - sy) * 12 + (em - sm) - (ed < sd ? 1 : 0)
  return Math.floor(months / (12 / chargesPerYear))
}

function toFacility(row: FacilityRow, asOf: string): FacilityView {
  const facility: Facility = {
    id: row.id,
    kind: row.kind,
    principalMinor: Number(row.principal_minor),
    annualRatePercent: Number(row.annual_rate_percent),
    startDate: day(row.start_date),
    endDate: row.end_date ? day(row.end_date) : null,
    chargesPerYear: row.charges_per_year,
  }
  const accrued = accruedInterest(facility, facility.startDate, asOf)
  const count = facility.endDate
    ? periodsBetween(facility.startDate, facility.endDate, facility.chargesPerYear)
    : 0
  const plan =
    count >= 1
      ? instalment(
          facility.principalMinor,
          facility.annualRatePercent,
          facility.chargesPerYear,
          count,
        )
      : null

  return {
    id: row.id,
    kind: row.kind,
    counterparty: row.counterparty,
    principal: facility.principalMinor / 100,
    currency: row.currency,
    annualRatePercent: facility.annualRatePercent,
    startDate: facility.startDate,
    endDate: facility.endDate,
    chargesPerYear: facility.chargesPerYear,
    isActive: row.is_active,
    accruedInterest: accrued.accruedMinor / 100,
    accruedDays: accrued.days,
    instalment: plan
      ? { perInstalment: plan.perInstalmentMinor / 100, total: plan.totalMinor / 100, count }
      : null,
  }
}

const toHolding = (row: HoldingRow): HoldingView => ({
  id: row.id,
  label: row.label,
  cost: Number(row.cost_minor) / 100,
  marketValue: Number(row.market_value_minor) / 100,
  currency: row.currency,
  valuedOn: day(row.valued_on),
  isActive: row.is_active,
})

function fail(error: { code?: string; message: string }, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new FinancingNotConfiguredError()
  throw new DatabaseError(what, error)
}

const toMinor = (major: number) => Math.round(major * 100)

export class FinancingService {
  // ─── Loans (#125) ────────────────────────────────────────────

  async facilities(ctx: TenancyContext): Promise<{
    asOf: string
    facilities: FacilityView[]
    /** ACTIVE facilities only, one row per currency and direction. */
    totals: Array<{
      currency: string
      kind: FacilityKind
      principal: number
      accruedInterest: number
    }>
  }> {
    const asOf = today()
    const { data, error } = await supabase
      .from('loan_facilities')
      .select(FACILITY_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('is_active', { ascending: false })
      .order('start_date', { ascending: false })
      .order('id', { ascending: true })
      .limit(1000)
    if (error) fail(error, 'Failed to read loans')

    const facilities = ((data ?? []) as FacilityRow[]).map((row) => toFacility(row, asOf))
    const totals = new Map<
      string,
      { currency: string; kind: FacilityKind; principalMinor: number; accruedMinor: number }
    >()
    for (const facility of facilities) {
      if (!facility.isActive) continue
      const key = `${facility.currency}:${facility.kind}`
      const entry = totals.get(key) ?? {
        currency: facility.currency,
        kind: facility.kind,
        principalMinor: 0,
        accruedMinor: 0,
      }
      entry.principalMinor += toMinor(facility.principal)
      entry.accruedMinor += toMinor(facility.accruedInterest)
      totals.set(key, entry)
    }
    return {
      asOf,
      facilities,
      totals: [...totals.values()].map((entry) => ({
        currency: entry.currency,
        kind: entry.kind,
        principal: entry.principalMinor / 100,
        accruedInterest: entry.accruedMinor / 100,
      })),
    }
  }

  async createFacility(
    ctx: TenancyContext,
    input: {
      kind: FacilityKind
      counterparty: string
      principal: number
      currency: string
      annualRatePercent: number
      startDate: string
      endDate: string | null
      chargesPerYear: number
    },
  ): Promise<FacilityView> {
    if (input.endDate !== null && input.endDate <= input.startDate) {
      throw new ValidationError('FINANCING_DATES_INVERTED')
    }
    const principalMinor = toMinor(input.principal)
    if (principalMinor <= 0) throw new ValidationError('FINANCING_AMOUNT_INVALID')

    const { data, error } = await supabase
      .from('loan_facilities')
      .insert({
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        kind: input.kind,
        counterparty: input.counterparty.trim(),
        principal_minor: principalMinor,
        currency: input.currency,
        annual_rate_percent: input.annualRatePercent,
        start_date: input.startDate,
        end_date: input.endDate,
        charges_per_year: input.chargesPerYear,
      })
      .select(FACILITY_COLUMNS)
      .single()
    if (error) fail(error, 'Failed to save the loan')
    return toFacility(data as FacilityRow, today())
  }

  async setFacilityActive(
    ctx: TenancyContext,
    id: string,
    isActive: boolean,
  ): Promise<FacilityView> {
    const { data, error } = await supabase
      .from('loan_facilities')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select(FACILITY_COLUMNS)
      .maybeSingle()
    if (error) fail(error, 'Failed to update the loan')
    if (!data) throw new NotFoundError('Loan')
    return toFacility(data as FacilityRow, today())
  }

  // ─── Investments (#126) ──────────────────────────────────────

  async holdings(ctx: TenancyContext): Promise<{
    holdings: HoldingView[]
    /** ACTIVE holdings only, one summary per currency. Major units. */
    summaries: Array<{
      currency: string
      cost: number
      marketValue: number
      unrealisedGain: number
      unrealisedGainPercent: number | null
      basis: PortfolioSummary['basis']
    }>
  }> {
    const { data, error } = await supabase
      .from('investment_holdings')
      .select(HOLDING_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(1000)
    if (error) fail(error, 'Failed to read holdings')

    const rows = (data ?? []) as HoldingRow[]
    const byCurrency = new Map<string, HoldingRow[]>()
    for (const row of rows) {
      if (!row.is_active) continue
      byCurrency.set(row.currency, [...(byCurrency.get(row.currency) ?? []), row])
    }
    return {
      holdings: rows.map(toHolding),
      summaries: [...byCurrency.entries()].map(([currency, group]) => {
        const summary = summarisePortfolio(
          group.map((row) => ({
            id: row.id,
            label: row.label,
            costMinor: Number(row.cost_minor),
            marketValueMinor: Number(row.market_value_minor),
            currency,
          })),
        )
        return {
          currency,
          cost: summary.costMinor / 100,
          marketValue: summary.marketValueMinor / 100,
          unrealisedGain: summary.unrealisedGainMinor / 100,
          unrealisedGainPercent: summary.unrealisedGainPercent,
          basis: summary.basis,
        }
      }),
    }
  }

  async createHolding(
    ctx: TenancyContext,
    input: { label: string; cost: number; marketValue: number; currency: string; valuedOn: string },
  ): Promise<HoldingView> {
    const { data, error } = await supabase
      .from('investment_holdings')
      .insert({
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        label: input.label.trim(),
        cost_minor: toMinor(input.cost),
        market_value_minor: toMinor(input.marketValue),
        currency: input.currency,
        valued_on: input.valuedOn,
      })
      .select(HOLDING_COLUMNS)
      .single()
    if (error) fail(error, 'Failed to save the holding')
    return toHolding(data as HoldingRow)
  }

  /** State what a holding is worth today, or close it. The cost never changes. */
  async updateHolding(
    ctx: TenancyContext,
    id: string,
    input: {
      marketValue?: number | undefined
      valuedOn?: string | undefined
      isActive?: boolean | undefined
    },
  ): Promise<HoldingView> {
    // A new value needs the day it was stated; one without the other is refused
    // rather than dated «today» by assumption.
    if ((input.marketValue === undefined) !== (input.valuedOn === undefined)) {
      throw new ValidationError('FINANCING_VALUE_NEEDS_DATE')
    }
    const values: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.marketValue !== undefined) {
      values.market_value_minor = toMinor(input.marketValue)
      values.valued_on = input.valuedOn
    }
    if (input.isActive !== undefined) values.is_active = input.isActive

    const { data, error } = await supabase
      .from('investment_holdings')
      .update(values)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select(HOLDING_COLUMNS)
      .maybeSingle()
    if (error) fail(error, 'Failed to update the holding')
    if (!data) throw new NotFoundError('Holding')
    return toHolding(data as HoldingRow)
  }
}

export const financingService = new FinancingService()
