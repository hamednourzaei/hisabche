// ============================================
// backend/src/services/invoice-seller.ts
//
// Owner decision (12 Nov 2026, V61 open decision 1): «the seller of an invoice
// is a MEMBER of the business — owner, manager, employee, whoever — and the
// owner must be able to see each seller».
//
//   - The seller is a workspace MEMBER (a user id), not an `employees` row: an
//     owner or a manager who sells has no employee record, and an employee
//     record need not have an account.
//   - The issuer (`invoices.user_id`) IS the seller unless the form names
//     another member. Only that override is stored (`invoices.seller_user_id`,
//     invoices-seller-01). An invoice that names nobody reads as its issuer —
//     the owner's own rule, applied on read, nothing back-filled.
//   - The named member is checked here, on the server: a current member of
//     THIS business with access. A user id from the body is a request.
//   - Totals are per seller AND per currency, in minor units. No commission
//     is computed: there is no commission rate anywhere in the product, and
//     inventing one would be a number nobody decided.
// ============================================

import { supabase } from '../db'
import { BaseError } from '../errors/base.error'
import { DatabaseError } from '../errors/database.error'
import { ValidationError } from '../errors/validation.error'
import { selectAllPages } from '../utils/fetch-all-pages'
import { baseCurrencyOf } from './base-currency'
import type { TenancyContext } from './tenancy.service'

/** Roles that see every seller; everyone else sees only their own row. */
export const SEES_EVERY_SELLER = ['owner', 'admin', 'manager']

/** The column is not there yet (invoices-seller-01 not run). */
export class InvoiceSellerNotInstalledError extends BaseError {
  readonly code = 'INVOICE_SELLER_NOT_INSTALLED'
  constructor() {
    super('INVOICE_SELLER_NOT_INSTALLED: run docs/invoices-seller-01-migration.sql', 503)
    this.name = 'InvoiceSellerNotInstalledError'
  }
}

type DbError = { message?: string | undefined; code?: string | undefined } | null | undefined

/** 42703 / PGRST204 that names the seller column — not any missing column. */
export function isMissingSellerColumn(error: DbError): boolean {
  if (!error) return false
  if (error.code !== '42703' && error.code !== 'PGRST204') return false
  return String(error.message ?? '').includes('seller_user_id')
}

/**
 * The seller to STORE for a new invoice: null when the issuer is the seller
 * (nothing named, or the issuer named themself), otherwise the named member —
 * after proving they are a current member of this business.
 */
export async function resolveSellerOverride(
  ctx: TenancyContext,
  requested: string | null | undefined,
): Promise<string | null> {
  if (!requested || requested === ctx.userId) return null

  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id, has_access, suspended_at')
    .eq('workspace_id', ctx.workspaceId)
    .eq('user_id', requested)
    .maybeSingle()
  if (error) throw new DatabaseError('Failed to check the seller', error)

  const member = data as { has_access: boolean | null; suspended_at: string | null } | null
  if (!member || member.has_access !== true || member.suspended_at !== null) {
    throw new ValidationError(
      'INVOICE_SELLER_NOT_A_MEMBER: the seller must be a member of this business',
    )
  }
  return requested
}

export interface SellerSaleRow {
  user_id: string | null
  seller_user_id?: string | null
  currency: string | null
  total: number | string | null
}

export interface SellerTotal {
  sellerUserId: string
  currency: string
  invoiceCount: number
  totalMinor: number
}

/**
 * Pure: who sold what, per currency. The stored seller wins; an invoice with
 * none is its issuer's. A row with neither is left out and counted, never
 * credited to someone.
 */
export function summarizeSalesBySeller(
  rows: ReadonlyArray<SellerSaleRow>,
  bookCurrency: string,
  toMinor: (row: SellerSaleRow, currency: string) => number,
): { totals: SellerTotal[]; unattributed: number } {
  const byKey = new Map<string, SellerTotal>()
  let unattributed = 0
  for (const row of rows) {
    const seller = row.seller_user_id ?? row.user_id
    if (!seller) {
      unattributed += 1
      continue
    }
    const currency = row.currency || bookCurrency
    const key = `${seller}|${currency}`
    const entry = byKey.get(key) ?? {
      sellerUserId: seller,
      currency,
      invoiceCount: 0,
      totalMinor: 0,
    }
    entry.invoiceCount += 1
    entry.totalMinor += toMinor(row, currency)
    byKey.set(key, entry)
  }
  const totals = [...byKey.values()].sort(
    (a, b) => a.currency.localeCompare(b.currency) || b.totalMinor - a.totalMinor,
  )
  return { totals, unattributed }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** `invoices.date` is a timestamp: «up to the 30th» means before the 31st. */
function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** Sales (not purchases, not cancelled) per seller, for the given days. */
export async function salesBySeller(
  ctx: TenancyContext,
  range: { from?: string | undefined; to?: string | undefined },
  toMinor: (amount: number, currency: string) => number,
) {
  const from = range.from && DAY.test(range.from) ? range.from : null
  const to = range.to && DAY.test(range.to) ? range.to : null
  if (from && to && from > to) throw new ValidationError('SELLER_RANGE_REVERSED: from is after to')

  const read = (columns: string) =>
    selectAllPages<SellerSaleRow, { message: string; code?: string }>((start, end) => {
      let q = supabase
        .from('invoices')
        .select(columns)
        .eq('workspace_id', ctx.workspaceId)
        .eq('type', 'sale')
        .neq('status', 'cancelled')
      if (from) q = q.gte('date', from)
      if (to) q = q.lt('date', nextDay(to))
      return q.order('id', { ascending: true }).range(start, end) as unknown as PromiseLike<{
        data: SellerSaleRow[] | null
        error: { message: string; code?: string } | null
      }>
    })

  let sellerColumn = true
  let result = await read('user_id, seller_user_id, currency, total')
  if (isMissingSellerColumn(result.error)) {
    // Before invoices-seller-01 every invoice is its issuer's — the rule itself.
    sellerColumn = false
    result = await read('user_id, currency, total')
  }
  if (result.error) throw new DatabaseError('Failed to load sales by seller', result.error)

  const bookCurrency = await baseCurrencyOf(ctx.workspaceId)
  const summary = summarizeSalesBySeller(result.data ?? [], bookCurrency, (row, currency) =>
    toMinor(Number(row.total ?? 0), currency),
  )

  const seesAll = SEES_EVERY_SELLER.includes(ctx.role)
  const totals = seesAll
    ? summary.totals
    : summary.totals.filter((t) => t.sellerUserId === ctx.userId)
  return {
    from,
    to,
    sellerColumn,
    seesAll,
    totals,
    unattributed: seesAll ? summary.unattributed : 0,
  }
}
