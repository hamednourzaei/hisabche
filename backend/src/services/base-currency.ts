// ============================================
// backend/src/services/base-currency.ts
//
// The currency a business keeps its books in.
//
// It used to be the letters 'AFN', typed into sixteen files: the default of an
// invoice with no currency, of a payment, of an opening balance, of a cost
// layer, and the «base» the revaluation compared everything against. A
// business that keeps its books in toman had nowhere to say so, and every one
// of those defaults was silently wrong for it.
//
// Now it is one stored value per workspace (`workspaces.base_currency`,
// docs/base-currency-01-migration.sql) read through this file.
//
//   • The default is explicit and unchanged: AFN. A database that has not had
//     the migration answers AFN too — exactly what every caller did before.
//   • A read that FAILS for any other reason throws. Answering AFN on the
//     strength of a failure would stamp the wrong currency on a document.
//   • It can be changed only while the books are empty. Once one invoice,
//     payment or journal entry exists, every amount in the ledger is in the
//     old currency, and renaming it would relabel them all without converting
//     one.
//
// ⚠️ Imports no other service (CLAUDE.md: a shared constant taken from a
// service closes an import cycle that only shows on the live server).
// ============================================

import { CURRENCY_CODES } from '@hisabche/validation'

import { supabase } from '../db'
import { ConflictError, DatabaseError, NotFoundError } from '../errors/database.error'
import { ValidationError } from '../errors/validation.error'

/** The books currency of a workspace that has never chosen one. */
export const DEFAULT_BASE_CURRENCY = 'AFN'

const isMissingColumn = (code: string | undefined) => code === '42703' || code === 'PGRST204'

export interface BaseCurrency {
  currency: string
  /** False once any financial document exists: the books are in this currency. */
  changeable: boolean
  /** False until the migration has run — the value cannot be stored yet. */
  configurable: boolean
}

export async function baseCurrencyOf(workspaceId: string): Promise<string> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('base_currency')
    .eq('id', workspaceId)
    .maybeSingle()

  if (error) {
    if (isMissingColumn(error.code)) return DEFAULT_BASE_CURRENCY
    throw new DatabaseError('Failed to read the base currency', error)
  }
  const stored = (data as { base_currency?: string | null } | null)?.base_currency
  return stored && stored.trim() !== '' ? stored : DEFAULT_BASE_CURRENCY
}

// The tables whose rows are amounts in the books currency.
const BOOKS = ['invoices', 'payments', 'journal_entries', 'transactions'] as const

async function booksAreEmpty(workspaceId: string): Promise<boolean> {
  for (const table of BOOKS) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
    // «Could not prove the books are empty» is treated as «they are not».
    if (error) return false
    if ((count ?? 0) > 0) return false
  }
  return true
}

export async function describeBaseCurrency(workspaceId: string): Promise<BaseCurrency> {
  const probe = await supabase
    .from('workspaces')
    .select('base_currency')
    .eq('id', workspaceId)
    .maybeSingle()
  const configurable = !(probe.error && isMissingColumn(probe.error.code))
  if (probe.error && configurable) {
    throw new DatabaseError('Failed to read the base currency', probe.error)
  }
  const stored = (probe.data as { base_currency?: string | null } | null)?.base_currency
  return {
    currency: stored && stored.trim() !== '' ? stored : DEFAULT_BASE_CURRENCY,
    configurable,
    changeable: configurable && (await booksAreEmpty(workspaceId)),
  }
}

export async function setBaseCurrency(
  ctx: { workspaceId: string; role: string },
  currency: string,
): Promise<BaseCurrency> {
  if (ctx.role !== 'owner') throw new ConflictError('BASE_CURRENCY_FORBIDDEN')
  if (!(CURRENCY_CODES as readonly string[]).includes(currency)) {
    throw new ValidationError('BASE_CURRENCY_UNSUPPORTED')
  }

  const current = await describeBaseCurrency(ctx.workspaceId)
  if (!current.configurable) throw new ConflictError('BASE_CURRENCY_SCHEMA_REQUIRED')
  if (current.currency === currency) return current
  if (!current.changeable) throw new ConflictError('BASE_CURRENCY_LOCKED')

  const { data, error } = await supabase
    .from('workspaces')
    .update({ base_currency: currency })
    .eq('id', ctx.workspaceId)
    .select('id')
    .maybeSingle()
  if (error) throw new DatabaseError('Failed to save the base currency', error)
  if (!data) throw new NotFoundError('Workspace')

  return { currency, configurable: true, changeable: true }
}
