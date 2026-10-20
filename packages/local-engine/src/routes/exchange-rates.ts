// ============================================
// packages/local-engine/src/routes/exchange-rates.ts
//
// Currency exchange rates, base currency query & update,
// and custom currency units.
// ============================================

import { CURRENCY_CODES, baseCurrencyInputSchema, rateInputSchema } from '@hisabche/validation'
import { ConflictError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

export interface ExchangeRateRow {
  id: string
  workspace_id: string
  currency_code: string
  rate: number
  rate_date: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function areBooksEmpty(c: RouteHandlerContext): boolean {
  const { db, ctx } = c
  const ws = ctx.workspaceId

  const inv = db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM invoice WHERE workspace_id = ? AND deleted_at IS NULL',
    [ws],
  )
  if ((inv?.count ?? 0) > 0) return false

  const pay = db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM payment WHERE workspace_id = ? AND deleted_at IS NULL',
    [ws],
  )
  if ((pay?.count ?? 0) > 0) return false

  const je = db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM journal_entry WHERE workspace_id = ?',
    [ws],
  )
  if ((je?.count ?? 0) > 0) return false

  return true
}

export function registerExchangeRateRoutes(router: Router): void {
  // ─── GET /finance/currency/rates (and aliases) ──────────────
  const listRatesHandler = (c: RouteHandlerContext) => {
    const { db, ctx, query } = c
    const currency = query.currency

    let sql =
      'SELECT currency_code, rate, rate_date FROM exchange_rate WHERE workspace_id = ? AND deleted_at IS NULL'
    const params: unknown[] = [ctx.workspaceId]

    if (currency) {
      sql += ' AND currency_code = ?'
      params.push(currency)
    }

    sql += ' ORDER BY rate_date DESC, currency_code ASC'

    const rows = db.all<{
      currency_code: string
      rate: number
      rate_date: string
    }>(sql, params)

    return rows.map((row) => ({
      currency: row.currency_code,
      rate: Number(row.rate) || 0,
      onDate: String(row.rate_date || '').slice(0, 10),
    }))
  }

  router.get('/finance/currency/rates', listRatesHandler)
  router.get('/currency/rates', listRatesHandler)
  router.get('/exchange-rates', listRatesHandler)

  // ─── PUT /finance/currency/rates (and aliases) ──────────────
  const setRateHandler = (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const raw = (body || {}) as Record<string, unknown>
    const parsed = rateInputSchema.safeParse(raw)
    if (!parsed.success) {
      const isRateErr = parsed.error.issues.some((i) => i.path.includes('rate'))
      throw new ValidationError(isRateErr ? 'RATE_INVALID' : parsed.error.message)
    }
    const b = parsed.data

    const rate = b.rate
    if (b.currency === ctx.baseCurrency) {
      throw new ValidationError('RATE_BASE_CURRENCY')
    }

    const onDate = b.onDate.slice(0, 10)
    const now = new Date().toISOString()

    const existing = db.get<{ id: string }>(
      'SELECT id FROM exchange_rate WHERE workspace_id = ? AND currency_code = ? AND rate_date = ? AND deleted_at IS NULL LIMIT 1',
      [ctx.workspaceId, b.currency, onDate],
    )

    if (existing) {
      db.run(
        'UPDATE exchange_rate SET rate = ?, updated_at = ? WHERE id = ? AND workspace_id = ?',
        [rate, now, existing.id, ctx.workspaceId],
      )
    } else {
      const id = generateUuid()
      db.run(
        `INSERT INTO exchange_rate (
          id, workspace_id, currency_code, rate, rate_date, created_at, updated_at, deleted_at, origin, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'local', 'local_only')`,
        [id, ctx.workspaceId, b.currency, rate, onDate, now, now],
      )
    }

    return {
      currency: b.currency,
      rate,
      onDate,
    }
  }

  router.put('/finance/currency/rates', setRateHandler)
  router.put('/currency/rates', setRateHandler)
  router.post('/exchange-rates', setRateHandler)

  // ─── GET /finance/currency/units ─────────────────────────────
  const listUnitsHandler = () => {
    return { configured: false }
  }
  router.get('/finance/currency/units', listUnitsHandler)
  router.get('/currency/units', listUnitsHandler)

  // ─── GET /finance/currency/base ──────────────────────────────
  const getBaseCurrencyHandler = (c: RouteHandlerContext) => {
    const changeable = areBooksEmpty(c)
    return {
      currency: c.ctx.baseCurrency,
      configurable: true,
      changeable,
    }
  }

  router.get('/finance/currency/base', getBaseCurrencyHandler)
  router.get('/settings/base-currency', getBaseCurrencyHandler)

  // ─── PUT /finance/currency/base ──────────────────────────────
  const setBaseCurrencyHandler = (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const raw = (body || {}) as Record<string, unknown>
    const parsed = baseCurrencyInputSchema.safeParse(raw)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.message)
    }
    const currency = parsed.data.currency.trim()

    if (!currency || !(CURRENCY_CODES as readonly string[]).includes(currency)) {
      throw new ValidationError('BASE_CURRENCY_UNSUPPORTED')
    }

    if (currency === ctx.baseCurrency) {
      return {
        currency,
        configurable: true,
        changeable: areBooksEmpty(c),
      }
    }

    if (!areBooksEmpty(c)) {
      throw new ConflictError('BASE_CURRENCY_LOCKED')
    }

    const now = new Date().toISOString()
    db.run('UPDATE local_workspace SET base_currency = ?, updated_at = ? WHERE id = ?', [
      currency,
      now,
      ctx.workspaceId,
    ])

    return {
      currency,
      configurable: true,
      changeable: true,
    }
  }

  router.put('/finance/currency/base', setBaseCurrencyHandler)
  router.put('/settings/base-currency', setBaseCurrencyHandler)
}
