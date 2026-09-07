// ============================================
// backend/src/services/currency/currencies.service.ts
//
// PATCH 1 / L0.1 — reading the `currencies` reference table.
//
// ---------------------------------------------------------------------------
// ⚠️ ONLY ACTIVE CURRENCIES ARE OFFERED, AND THAT IS THE WHOLE POINT
//
// The table holds 162 real currencies. The product can only format 25 of them:
// `FRACTION_DIGITS` in @hisabche/formatting covers exactly the codes in
// `CURRENCY_CODES`, and rule 9 requires an unknown code to resolve to
// `undefined` precision rather than borrow another currency's.
//
// So serving the whole table to a picker would let someone select BHD and have
// every amount in their workspace formatted with no precision contract — a
// WRONG AMOUNT, not a missing option. That is the exact failure L0.1 was
// stopped for the first time.
//
// `is_active` is the gate. This service never returns an inactive row to a
// picker, and `listAll` exists only for an admin view that needs to see what
// could be activated.
//
// ---------------------------------------------------------------------------
// ⚠️ THE FALLBACK IS THE CODE'S OWN LIST, NOT AN INVENTION
//
// If the table is absent — the migration has not been applied on that
// environment — this degrades to `CURRENCY_CODES`, which is the same set
// `is_active` marks. So the picker offers the same 25 either way and nothing
// silently widens.
// ============================================

import { CURRENCY_CODES } from '@hisabche/validation'

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'

export interface CurrencyRecord {
  code: string
  name: string
  nameFa: string | null
  symbol: string | null
  /** ISO 4217 minor units. See the migration for the non-2 groups. */
  decimalPlaces: number
  isActive: boolean
}

const SCHEMA_ABSENT = new Set(['42P01', 'PGRST205', '42703', 'PGRST204'])

interface Row {
  code: string
  name: string
  name_fa: string | null
  symbol: string | null
  decimal_places: number
  is_active: boolean
}

/**
 * What the picker falls back to when the table is missing.
 *
 * Deliberately minimal: code only, with the precision left to the client's
 * own `FRACTION_DIGITS`. Inventing names and symbols here would be a second
 * copy of the reference data to keep in step.
 */
function fallback(): CurrencyRecord[] {
  return CURRENCY_CODES.map((code) => ({
    code,
    name: code,
    nameFa: null,
    symbol: null,
    // The client already knows the real precision for every one of these; the
    // 2 here is never used for formatting, only to satisfy the shape.
    decimalPlaces: 2,
    isActive: true,
  }))
}

function map(row: Row): CurrencyRecord {
  return {
    code: row.code,
    name: row.name,
    nameFa: row.name_fa,
    symbol: row.symbol,
    decimalPlaces: Number(row.decimal_places),
    isActive: row.is_active,
  }
}

export class CurrenciesService {
  /** The currencies a user may actually choose. */
  async listActive(): Promise<{ currencies: CurrencyRecord[]; source: 'table' | 'fallback' }> {
    const { data, error } = await supabase
      .from('currencies')
      .select('code, name, name_fa, symbol, decimal_places, is_active')
      .eq('is_active', true)
      .order('code', { ascending: true })

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return { currencies: fallback(), source: 'fallback' }
      throw new DatabaseError('Failed to fetch currencies', error)
    }

    // An empty result means the migration ran but the activation UPDATE did
    // not. Serving an empty picker would make the product unusable, so this
    // degrades the same way a missing table does.
    if (!data || data.length === 0) return { currencies: fallback(), source: 'fallback' }

    return { currencies: (data as Row[]).map(map), source: 'table' }
  }

  /**
   * Every row, active or not.
   *
   * ⚠️ NOT for a customer-facing picker. Activating a code is a code change as
   * well as a data change — see the migration header — so this exists for an
   * operator deciding what to activate, not for a selector.
   */
  async listAll(): Promise<CurrencyRecord[]> {
    const { data, error } = await supabase
      .from('currencies')
      .select('code, name, name_fa, symbol, decimal_places, is_active')
      .order('code', { ascending: true })

    if (error) {
      if (SCHEMA_ABSENT.has(error.code)) return []
      throw new DatabaseError('Failed to fetch currencies', error)
    }
    return ((data ?? []) as Row[]).map(map)
  }
}
