// ============================================
// backend/src/services/currency/currency.service.ts
//
// Exchange rates, and what foreign balances are worth today.
// ============================================

import { selectAllPages } from '../../utils/fetch-all-pages'
import { supabase } from '../../db'
import { ConflictError, DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'
import { ledger } from '../accounting'

import { rateFor, runRevaluation, type ForeignBalance, type RateQuote } from './revaluation.domain'

export class CurrencyService {
  private async invalidate(workspaceId: string) {
    await memoryCache.invalidate(`currency:${workspaceId}`)
  }

  async listRates(ctx: TenancyContext, currency?: string): Promise<RateQuote[]> {
    // The whole history (27 Sep 2026), not its newest 1000 quotes. A single
    // rate for a date is read by getRateFor with one row.
    const { data, error } = await selectAllPages((lo, hi) => {
      let query = supabase
        .from('exchange_rates')
        .select('currency_code, rate, rate_date')
        .eq('workspace_id', ctx.workspaceId)
      if (currency) query = query.eq('currency_code', currency)
      return query
        .order('rate_date', { ascending: false })
        .order('currency_code', { ascending: true })
        .range(lo, hi)
    })
    if (error) throw new DatabaseError('Failed to fetch exchange rates', error)

    return (data ?? []).map((row) => ({
      currency: row.currency_code,
      rate: Number(row.rate) || 0,
      onDate: String(row.rate_date ?? '').slice(0, 10),
    }))
  }

  async setRate(
    ctx: TenancyContext,
    input: { currency: string; rate: number; onDate: string },
  ): Promise<RateQuote> {
    if (ctx.role === 'seller') throw new ConflictError('RATE_MANAGE_FORBIDDEN')
    if (!(input.rate > 0)) throw new ValidationError('RATE_INVALID')

    const { data, error } = await supabase
      .from('exchange_rates')
      .upsert(
        {
          workspace_id: ctx.workspaceId,
          currency_code: input.currency,
          rate: input.rate,
          rate_date: input.onDate.slice(0, 10),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,currency_code,rate_date' },
      )
      .select('currency_code, rate, rate_date')
      .single()

    if (error) throw new DatabaseError('Failed to save the exchange rate', error)

    await this.invalidate(ctx.workspaceId)
    return {
      currency: data.currency_code,
      rate: Number(data.rate),
      onDate: String(data.rate_date).slice(0, 10),
    }
  }

  /**
   * The rate for a date — the most recent quote ON OR BEFORE it.
   *
   * Never a later one. Valuing a past event with information nobody had at the
   * time is what makes a restated figure impossible to defend.
   */
  async getRateFor(ctx: TenancyContext, currency: string, onDate: string) {
    // ONE row: the newest quote on or before the date (27 Sep 2026). This
    // used to load the currency's newest 1000 quotes and pick in Node — per
    // currency, per revaluation — and a date older than the 1000th quote found
    // no rate at all even when one existed.
    const target = onDate.slice(0, 10)
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('currency_code, rate, rate_date')
      .eq('workspace_id', ctx.workspaceId)
      .eq('currency_code', currency)
      .lte('rate_date', target)
      .order('rate_date', { ascending: false })
      .limit(1)
    if (error) throw new DatabaseError('Failed to fetch the exchange rate', error)

    const quotes = (data ?? []).map((row) => ({
      currency: row.currency_code,
      rate: Number(row.rate) || 0,
      onDate: String(row.rate_date ?? '').slice(0, 10),
    }))
    return rateFor(quotes, currency, target)
  }

  /** Outstanding foreign-currency receivables and payables. */
  private async openBalances(ctx: TenancyContext, baseCurrency: string): Promise<ForeignBalance[]> {
    // Every row, in ordered pages (27 Sep 2026): a `.limit(N)` here was silently cut to
    // PostgREST max-rows (1000), and this read feeds a total or a decision.
    const { data, error } = await selectAllPages((from, to) =>
      supabase
        .from('invoice_outstanding')
        .select('invoice_id, type, currency, outstanding, total')
        .eq('workspace_id', ctx.workspaceId)
        .neq('currency', baseCurrency)
        .gt('outstanding', 0)
        .order('invoice_id', { ascending: true })
        .range(from, to),
    )

    if (error) throw new DatabaseError('Failed to read foreign balances', error)

    return (data ?? []).map((row) => {
      const foreignMinor = Math.round((Number(row.outstanding) || 0) * 100)
      return {
        sourceType: row.type === 'purchase' ? ('payable' as const) : ('receivable' as const),
        sourceId: row.invoice_id,
        currency: row.currency,
        foreignMinor,
        // The rate the document was booked at. Frozen on the invoice; falling
        // back to 1 would silently revalue against a rate nobody used.
        bookedRate: 1,
        bookedBaseMinor: foreignMinor,
      }
    })
  }

  /**
   * Value every open foreign balance at today's rate.
   *
   * Reverses the previous run first: an unrealised difference is an opinion
   * about a rate, and last period's opinion must not still be sitting in the
   * books underneath this one.
   */
  async revalue(
    ctx: TenancyContext,
    input: {
      asOf: string
      baseCurrency?: string | undefined
      rates?: Record<string, number> | undefined
    },
  ) {
    if (ctx.role !== 'owner' && ctx.role !== 'manager') {
      throw new ConflictError('REVALUATION_FORBIDDEN')
    }

    const asOf = input.asOf.slice(0, 10)
    const base = input.baseCurrency ?? 'AFN'
    const balances = await this.openBalances(ctx, base)

    // Rates supplied explicitly win; otherwise the stored quote for the date.
    const rates: Record<string, number> = { ...(input.rates ?? {}) }
    for (const currency of new Set(balances.map((b) => b.currency))) {
      if (rates[currency] !== undefined) continue
      const quote = await this.getRateFor(ctx, currency, asOf)
      if ('rate' in quote) rates[currency] = quote.rate
    }

    const { data: previous } = await supabase
      .from('fx_revaluations')
      .select('net_minor')
      .eq('workspace_id', ctx.workspaceId)
      .lt('as_of', asOf)
      .order('as_of', { ascending: false })
      .limit(1)
      .maybeSingle()

    const run = runRevaluation(balances, rates, asOf, Number(previous?.net_minor) || 0)

    const { data: saved, error } = await supabase
      .from('fx_revaluations')
      .upsert(
        {
          workspace_id: ctx.workspaceId,
          as_of: asOf,
          rates,
          gain_minor: run.gainMinor,
          loss_minor: run.lossMinor,
          net_minor: run.netDifferenceMinor,
          reversed_minor: run.reversesPreviousMinor,
          created_by: ctx.userId,
        },
        { onConflict: 'workspace_id,as_of' },
      )
      .select('id')
      .single()

    if (error) throw new DatabaseError('Failed to record the revaluation', error)

    if (run.lines.length > 0) {
      await supabase.from('fx_revaluation_lines').insert(
        run.lines.map((line) => ({
          workspace_id: ctx.workspaceId,
          revaluation_id: saved.id,
          source_type: line.sourceType,
          source_id: line.sourceId,
          currency: line.currency,
          foreign_minor: line.foreignMinor,
          booked_rate: line.bookedRate,
          closing_rate: line.closingRate,
          booked_base_minor: line.bookedBaseMinor,
          revalued_base_minor: line.revaluedBaseMinor,
          difference_minor: line.differenceMinor,
        })),
      )
    }

    await this.postRevaluation(
      ctx,
      saved.id,
      asOf,
      run.netDifferenceMinor + run.reversesPreviousMinor,
    )
    await this.invalidate(ctx.workspaceId)

    return { revaluationId: saved.id, ...run }
  }

  private async postRevaluation(
    ctx: TenancyContext,
    revaluationId: string,
    asOf: string,
    netMinor: number,
  ) {
    if (netMinor === 0) return

    const { accounts, missing } = await ledger.ensureAccountsForRoles(ctx, ['receivable', 'sales'])
    if (missing.length > 0) {
      console.warn(
        `[Currency] revaluation ${revaluationId} not booked: missing ${missing.join(', ')}`,
      )
      return
    }

    const amount = Math.abs(netMinor) / 100

    const outcome = await ledger.postDocument(ctx, {
      sourceType: 'fx_revaluation',
      sourceId: revaluationId,
      date: asOf,
      description: `تجدید ارزیابی ارز ${asOf}`,
      reference: revaluationId,
      lines:
        netMinor > 0
          ? [
              { accountId: accounts.receivable!, debit: amount, credit: 0 },
              { accountId: accounts.sales!, debit: 0, credit: amount },
            ]
          : [
              { accountId: accounts.sales!, debit: amount, credit: 0 },
              { accountId: accounts.receivable!, debit: 0, credit: amount },
            ],
    })

    if (outcome.status === 'posted' || outcome.status === 'already_posted') {
      await supabase
        .from('fx_revaluations')
        .update({ journal_entry_id: outcome.entryId })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', revaluationId)
    }
  }

  async listRevaluations(ctx: TenancyContext, limit = 50) {
    const { data, error } = await supabase
      .from('fx_revaluations')
      .select(
        'id, as_of, gain_minor, loss_minor, net_minor, reversed_minor, journal_entry_id, created_at',
      )
      .eq('workspace_id', ctx.workspaceId)
      .order('as_of', { ascending: false })
      .limit(Math.min(limit, 200))

    if (error) throw new DatabaseError('Failed to fetch revaluations', error)
    return data ?? []
  }
}
