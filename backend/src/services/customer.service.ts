// ============================================
// backend/src/services/customer.service.ts — v2.3
// FIXED: TypeScript type for getBalance return
// ============================================

import { baseCurrencyOf } from './base-currency'
import { supabase } from '../db'
import { scopes } from './authorization/scope.service'
import { CreateCustomer, UpdateCustomer, CustomerFilters } from '@hisabche/validation'
import { ConflictError, DatabaseError, NotFoundError } from '../errors/database.error'
import { ValidationError } from '../errors/validation.error'
import type { TenancyContext } from './tenancy.service'
import { memoryCache } from '../utils/pagination'
import { logBusinessEvent } from './event-log.service'
import { partyBalancesByCurrency } from './payments'
import { applyKeyset, decodeCursor, encodeCursor } from '../utils/keyset-cursor'
import {
  asReplay,
  IdempotencyUnavailableError,
  isMissingIdempotencySupport,
  type Replayable,
} from '../utils/client-request'

// ✅ Types
export type DeclaredRole = 'buyer' | 'seller' | 'both'

export const VALID_DECLARED_ROLES = new Set<string>(['buyer', 'seller', 'both'])

export function assertDeclaredRole(role: unknown): asserts role is DeclaredRole | null | undefined {
  if (role === undefined || role === null) return
  if (typeof role !== 'string' || !VALID_DECLARED_ROLES.has(role)) {
    throw new ValidationError('CUSTOMER_DECLARED_ROLE_INVALID')
  }
}

export interface CustomerRow {
  id: string
  full_name: string
  phone: string
  email: string
  address: string | null
  notes: string
  opening_balance: number
  is_active: boolean
  type: string
  declared_role?: DeclaredRole | null
  created_at: string
  updated_at: string | null
  [key: string]: unknown
}

export interface Customer {
  id: string
  fullName: string
  phone: string
  email: string
  address: string | null
  notes: string
  openingBalance: number
  isActive: boolean
  type: string
  declaredRole: DeclaredRole | null
  role?: PartyRole
  createdAt: string
  updatedAt: string | null
}

interface CustomerWithBalance extends Customer {
  balance: number
}

interface BalanceResult {
  customerId: string
  /** The currency the books are kept in — the currency of `balance`. */
  currency: string
  /**
   * What they owe IN THE BOOKS CURRENCY. It used to be every transaction
   * added together whatever its currency: 100 dollars and 10,000 afghani
   * answered 10,100. Other currencies are in `balances`, never in here.
   */
  balance: number
  /** One row per currency the customer has a transaction in; books currency first. */
  balances: Array<{ currency: string; balance: number }>
  /** They owe something, in any currency. */
  isDebtor: boolean
}

// ✅ Mapper
/**
 * The transaction role a party has played, derived from their invoices.
 * 'both' is a real, common state — a person you buy from and sell to.
 */
export type PartyRole = 'none' | 'buyer' | 'seller' | 'both'

/** Roles accumulate; seeing a second kind of invoice promotes the party. */
export function mergeRole(current: PartyRole, incoming: 'buyer' | 'seller'): PartyRole {
  if (current === 'none') return incoming
  if (current === incoming) return current
  return 'both'
}

/**
 * Effective role = declared role merged with the derived role from invoices.
 * Declared seller + a sale invoice -> both.
 * Declared buyer + no invoice -> buyer.
 * Nothing declared (null) + purchase invoice -> seller.
 * Nothing declared + no invoice -> none.
 */
export function resolveEffectiveRole(
  declaredRole: DeclaredRole | null | undefined,
  derivedRole: PartyRole,
): PartyRole {
  if (!declaredRole) return derivedRole
  if (derivedRole === 'none') return declaredRole
  if (declaredRole === 'both' || derivedRole === 'both') return 'both'
  if (declaredRole === derivedRole) return declaredRole
  return 'both'
}

/** A 'both' party legitimately matches a buyer filter AND a seller filter. */
export function matchesRole(role: PartyRole, filter: 'buyer' | 'seller'): boolean {
  return role === filter || role === 'both'
}

export function isMissingColumnError(error: unknown, column = 'declared_role'): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: string; message?: string; details?: string; hint?: string }
  const isMissingCode = err.code === '42703' || err.code === 'PGRST204'
  if (!isMissingCode) return false
  const msg = `${err.message ?? ''} ${err.details ?? ''} ${err.hint ?? ''}`
  return msg.includes(column)
}

export function mapCustomer(raw: CustomerRow): Customer {
  return {
    id: raw.id,
    fullName: raw.full_name,
    phone: raw.phone,
    email: raw.email,
    address: raw.address,
    notes: raw.notes,
    openingBalance: raw.opening_balance,
    isActive: raw.is_active,
    type: raw.type,
    declaredRole: raw.declared_role ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

const LIST_COLUMNS =
  'id, full_name, phone, email, opening_balance, is_active, type, declared_role, created_at'
const LIST_COLUMNS_LEGACY =
  'id, full_name, phone, email, opening_balance, is_active, type, created_at'

const DETAIL_COLUMNS =
  'id, full_name, phone, email, address, notes, opening_balance, is_active, type, declared_role, created_at, updated_at'
const DETAIL_COLUMNS_LEGACY =
  'id, full_name, phone, email, address, notes, opening_balance, is_active, type, created_at, updated_at'

export class CustomerService {
  // ─── Cache Keys ────────────────────────────────────────────
  //
  // ⚠️ Keyed by WORKSPACE, not by user. These used to be `customers:${userId}`,
  // which was correct while each user had a private set of customers. Under
  // the shared-book model it is a bug in both directions: a customer added by
  // the owner would be missing from the manager's list until the TTL expired,
  // and each member would pay for their own copy of identical data.
  private getListCacheKey(workspaceId: string, filters: CustomerFilters) {
    return `customers:${workspaceId}:${JSON.stringify(filters)}`
  }

  private getDetailCacheKey(workspaceId: string, id: string) {
    return `customer:${workspaceId}:${id}`
  }

  private getBalanceCacheKey(workspaceId: string, customerId: string) {
    return `customer:balance:${workspaceId}:${customerId}`
  }

  // ─── List — Cursor-based Pagination ──────────────────────
  async list(ctx: TenancyContext, filters: CustomerFilters) {
    const { workspaceId } = ctx
    const {
      search,
      isActive,
      hasBalance,
      type,
      role,
      limit = 20,
      page = 1,
      cursor,
      sortBy = 'created_at',
      sortDirection = 'desc',
    } = filters

    // ✅ کش کردن
    const cacheKey = this.getListCacheKey(workspaceId, filters)
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const maxLimit = Math.min(limit, 100)
    const fetchLimit = maxLimit + 1

    const keyset = cursor ? decodeCursor(cursor, sortBy) : null
    // ⚠️ THE TOTAL IS COUNTED ON THIS QUERY (27 Sep 2026). It came from a
    // second HEAD request with `count: 'estimated'` over the WHOLE workspace:
    // one extra round trip plus a planner EXPLAIN per list call, and with a
    // search active the page count was the unfiltered one — «page 1 of 20»
    // for three matches. PostgREST counts the filtered set and ignores the
    // range, which is exactly the number the pager needs. On the keyset
    // (cursor) path there is no total: a count after the cursor would be
    // «rows remaining», not the size of the list.
    let query = supabase
      .from('customers')
      .select(LIST_COLUMNS, keyset ? undefined : { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order(sortBy, { ascending: sortDirection === 'asc' })
      .order('id', { ascending: sortDirection === 'asc' })

    // `page` used to be ignored: page 2 of the customers table was page 1 again.
    const pageNumber = Number(page) || 1
    if (!keyset && pageNumber > 1) {
      const offset = (pageNumber - 1) * maxLimit
      query = query.range(offset, offset + maxLimit)
    } else {
      query = query.limit(fetchLimit)
    }

    if (search) query = query.ilike('full_name', `%${search}%`)
    if (isActive !== undefined) query = query.eq('is_active', isActive)
    if (hasBalance !== undefined) {
      query = hasBalance ? query.gt('opening_balance', 0) : query.eq('opening_balance', 0)
    }
    if (type !== undefined) query = query.eq('type', type)

    if (keyset) query = applyKeyset(query, sortBy, sortDirection, keyset)

    let rawRows: CustomerRow[] | null
    let queryError: unknown
    let totalCount: number | null | undefined

    const primaryResult = await query
    if (primaryResult.error && isMissingColumnError(primaryResult.error, 'declared_role')) {
      let fallbackQuery = supabase
        .from('customers')
        .select(LIST_COLUMNS_LEGACY, keyset ? undefined : { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .order(sortBy, { ascending: sortDirection === 'asc' })
        .order('id', { ascending: sortDirection === 'asc' })

      if (!keyset && pageNumber > 1) {
        const offset = (pageNumber - 1) * maxLimit
        fallbackQuery = fallbackQuery.range(offset, offset + maxLimit)
      } else {
        fallbackQuery = fallbackQuery.limit(fetchLimit)
      }

      if (search) fallbackQuery = fallbackQuery.ilike('full_name', `%${search}%`)
      if (isActive !== undefined) fallbackQuery = fallbackQuery.eq('is_active', isActive)
      if (hasBalance !== undefined) {
        fallbackQuery = hasBalance
          ? fallbackQuery.gt('opening_balance', 0)
          : fallbackQuery.eq('opening_balance', 0)
      }
      if (type !== undefined) fallbackQuery = fallbackQuery.eq('type', type)

      if (keyset) fallbackQuery = applyKeyset(fallbackQuery, sortBy, sortDirection, keyset)
      const fallbackResult = await fallbackQuery
      rawRows = fallbackResult.data as CustomerRow[] | null
      queryError = fallbackResult.error
      totalCount = fallbackResult.count
    } else {
      rawRows = primaryResult.data as CustomerRow[] | null
      queryError = primaryResult.error
      totalCount = primaryResult.count
    }

    if (queryError) throw new DatabaseError('Failed to fetch customers', queryError)

    const allRows = rawRows ?? []
    const hasMore = allRows.length > maxLimit
    const items = hasMore ? allRows.slice(0, maxLimit) : allRows
    const last = items.length > 0 ? (items[items.length - 1] as Record<string, unknown>) : null
    const nextCursor = hasMore && last ? encodeCursor(last, sortBy) : null

    const roles = await this.resolveRoles(
      workspaceId,
      items.map((row) => row.id),
    )

    const withRoles = items.map((row) => {
      const mapped = mapCustomer(row)
      const derived = roles.get(mapped.id) ?? 'none'
      const role = resolveEffectiveRole(mapped.declaredRole, derived)
      return { ...mapped, role }
    })

    const result = {
      customers: role ? withRoles.filter((c) => matchesRole(c.role, role)) : withRoles,
      nextCursor,
      hasMore,
      ...(keyset ? {} : { total: totalCount ?? 0 }),
      limit: maxLimit,
    }

    // ✅ ذخیره در کش
    await memoryCache.set(cacheKey, result, 30)
    return result
  }

  /**
   * Derive each party's transaction role from their invoices.
   *
   * A party is a BUYER if they appear on sale invoices and a SELLER if they
   * appear on purchase invoices — and can legitimately be BOTH. The role is
   * NOT stored: `customers.type` already means payment terms (cash|credit) and
   * must not be repurposed, and duplicating a person into two records just to
   * label them would corrupt their balance and history.
   *
   * One query for the whole page, not one per customer.
   */
  private async resolveRoles(
    workspaceId: string,
    customerIds: string[],
  ): Promise<Map<string, PartyRole>> {
    const roles = new Map<string, PartyRole>()
    if (customerIds.length === 0) return roles

    const { data } = await supabase
      .from('invoices')
      .select('customer_id, type')
      .eq('workspace_id', workspaceId)
      .in('customer_id', customerIds)

    for (const row of data ?? []) {
      const id = (row as { customer_id: string | null }).customer_id
      if (!id) continue
      // A missing type means a pre-existing invoice, which was always a sale.
      const isPurchase = (row as { type?: string | null }).type === 'purchase'
      const seen = roles.get(id) ?? 'none'
      roles.set(id, mergeRole(seen, isPurchase ? 'seller' : 'buyer'))
    }

    return roles
  }

  // ─── Get By ID ──────────────────────────────────────────
  async getById(id: string, ctx: TenancyContext): Promise<CustomerWithBalance> {
    const { workspaceId } = ctx
    const cacheKey = this.getDetailCacheKey(workspaceId, id)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as CustomerWithBalance

    // ✅ موازی‌سازی: گرفتن customer + balance
    const [customerResult, balanceResult] = await Promise.all([
      supabase
        .from('customers')
        .select(DETAIL_COLUMNS)
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .single(),
      this.getBalance(id, ctx),
    ])

    let rawCustomer: CustomerRow | null = customerResult.data as CustomerRow | null
    let customerError = customerResult.error

    if (customerError && isMissingColumnError(customerError, 'declared_role')) {
      const fallback = await supabase
        .from('customers')
        .select(DETAIL_COLUMNS_LEGACY)
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .single()
      rawCustomer = fallback.data as CustomerRow | null
      customerError = fallback.error
    }

    if (customerError || !rawCustomer) throw new DatabaseError('Customer not found', customerError)

    const roles = await this.resolveRoles(workspaceId, [id])
    const derived = roles.get(id) ?? 'none'
    const mapped = mapCustomer(rawCustomer)
    const result: CustomerWithBalance = {
      ...mapped,
      role: resolveEffectiveRole(mapped.declaredRole, derived),
      balance: balanceResult.balance,
    }

    await memoryCache.set(cacheKey, result, 300)
    return result
  }

  // ─── Create ──────────────────────────────────────────────
  private async findByClientRequestId(workspaceId: string, key: string): Promise<Customer | null> {
    const first = await supabase
      .from('customers')
      .select(DETAIL_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('client_request_id', key)
      .maybeSingle()

    let rawCustomer: CustomerRow | null = first.data as CustomerRow | null
    let error = first.error

    if (error && isMissingColumnError(error, 'declared_role')) {
      const fallback = await supabase
        .from('customers')
        .select(DETAIL_COLUMNS_LEGACY)
        .eq('workspace_id', workspaceId)
        .eq('client_request_id', key)
        .maybeSingle()
      rawCustomer = fallback.data as CustomerRow | null
      error = fallback.error
    }
    if (error) {
      if (isMissingIdempotencySupport(error)) throw new IdempotencyUnavailableError('customer')
      throw new DatabaseError('Failed to look up the request', error)
    }
    return rawCustomer ? mapCustomer(rawCustomer) : null
  }

  async create(
    ctx: TenancyContext,
    data: CreateCustomer,
    options: { clientRequestId?: string | null } = {},
  ): Promise<Replayable<Customer>> {
    const { workspaceId, userId } = ctx
    const clientRequestId = options.clientRequestId ?? null

    assertDeclaredRole((data as { declaredRole?: unknown }).declaredRole)

    // A replayed offline create answers with the customer it already made —
    // before the opening-balance transaction below could be written twice.
    if (clientRequestId) {
      const existing = await this.findByClientRequestId(workspaceId, clientRequestId)
      if (existing) return asReplay(existing)
    }

    const insertPayload: Record<string, unknown> = {
      full_name: data.fullName,
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || null,
      notes: data.notes || '',
      opening_balance: data.openingBalance || 0,
      is_active: data.isActive !== false,
      type: data.type || 'cash',
      // workspace_id scopes the row; user_id records who created it. Both
      // are written, and only the first is ever a filter.
      workspace_id: workspaceId,
      user_id: userId,
      ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
    }

    if (data.declaredRole) {
      insertPayload.declared_role = data.declaredRole
    }

    const first = await supabase
      .from('customers')
      .insert(insertPayload)
      .select(DETAIL_COLUMNS)
      .single()

    let rawCustomer: CustomerRow | null = first.data as CustomerRow | null
    let error = first.error

    if (error && isMissingColumnError(error, 'declared_role')) {
      if (data.declaredRole) {
        throw new ValidationError('CUSTOMER_DECLARED_ROLE_SCHEMA_REQUIRED')
      }
      delete insertPayload.declared_role
      const fallback = await supabase
        .from('customers')
        .insert(insertPayload)
        .select(DETAIL_COLUMNS_LEGACY)
        .single()
      rawCustomer = fallback.data as CustomerRow | null
      error = fallback.error
    }

    if (error && clientRequestId) {
      if (error.code === '23505') {
        const winner = await this.findByClientRequestId(workspaceId, clientRequestId)
        if (winner) return asReplay(winner)
      }
      if (isMissingIdempotencySupport(error)) throw new IdempotencyUnavailableError('customer')
    }
    if (error || !rawCustomer) throw new DatabaseError('Failed to create customer', error)

    const customer = mapCustomer(rawCustomer)

    // ═══════════════════════════════════════════════════════════════════════
    // THE OPENING BALANCE OF A CREDIT PARTY
    //
    // ⚠️ 1. THE COMPENSATING DELETE IS GONE, AND IT WAS FORBIDDEN.
    //
    // On a failed transaction insert this used to run
    //
    //     await supabase.from('customers').delete().eq('id', customer.id)
    //
    // supabase-js has no transactions, so that DELETE is not a rollback — it
    // is a second write that can itself fail, leaving exactly the half-state
    // it was meant to prevent, and it was addressed by id with no
    // `workspace_id` filter. This codebase's fourth rule names the pattern
    // and forbids it: a multi-table write is a Postgres function called
    // through `.rpc()`.
    //
    // ⚠️ 3. IT IS SKIPPED WHEN THERE IS NOTHING TO POST.
    //
    // A zero opening balance used to create a zero-amount «sale» on every
    // credit customer, which is a row in the ledger that says nothing and
    // shows up in every statement of account.
    // ═══════════════════════════════════════════════════════════════════════
    const opening = Number(data.openingBalance) || 0

    if (data.type === 'credit' && opening !== 0) {
      const { error: txError } = await supabase.from('transactions').insert({
        customer_id: customer.id,
        type: 'sale',
        amount: opening,
        // The opening balance is in the currency this business keeps its
        // books in (services/base-currency.ts). It used to be the literal
        // 'AFN', which was right only for a business whose books are in AFN.
        currency: await baseCurrencyOf(workspaceId),
        description: 'Credit sale - opening balance',
        workspace_id: workspaceId,
        user_id: userId,
      })

      if (txError) {
        // The customer stays. Deleting it here is the forbidden compensating
        // write, and losing a record somebody just entered — with their name,
        // phone and address — to recover from a failure on a DIFFERENT row is
        // the worse of the two outcomes. The message says exactly what is
        // missing so it can be added.
        throw new DatabaseError(
          'Customer created, but the opening balance transaction failed and must be entered manually',
          txError,
        )
      }
    }

    // ✅ Clear cache
    await this.invalidateCache(workspaceId, customer.id)

    logBusinessEvent({
      userId,
      workspaceId,
      entityType: 'customer',
      entityId: customer.id,
      action: 'created',
      title: `مشتری جدید: ${customer.fullName}`,
      description: customer.phone || customer.email || undefined,
      notify: false,
    }).catch((err) => console.error('[CustomerService] logBusinessEvent failed:', err))

    return customer
  }

  // ─── Update ──────────────────────────────────────────────
  /**
   * `expectedUpdatedAt` makes the write conditional: it lands only if the row
   * is still the one the caller read (compare-and-set on `updated_at`), and
   * answers CUSTOMER_CHANGED otherwise. Absent = unconditional, as before;
   * `null` = «it had never been edited when I read it».
   *
   * A change that was PROPOSED to a person and approved later (the AI
   * pipeline) must not overwrite what a colleague saved in between.
   */
  async update(
    id: string,
    ctx: TenancyContext,
    data: UpdateCustomer,
    options: { expectedUpdatedAt?: string | null | undefined } = {},
  ): Promise<Customer> {
    assertDeclaredRole((data as { declaredRole?: unknown }).declaredRole)

    // Workspace alone is not enough on a row addressed by id. Before this, any
    // member of the workspace could mutate any row in it by knowing an id —
    // including one raised by a colleague in a branch they do not hold.
    // `assertMay` reads the row's own branch and creator and refuses on either.
    await scopes.assertMay(ctx, 'customer', id, 'customer.write')

    const { workspaceId } = ctx
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.fullName !== undefined) updates.full_name = data.fullName
    if (data.phone !== undefined) updates.phone = data.phone
    if (data.email !== undefined) updates.email = data.email
    if (data.address !== undefined) updates.address = data.address
    if (data.notes !== undefined) updates.notes = data.notes
    if (data.isActive !== undefined) updates.is_active = data.isActive
    if (data.type !== undefined) updates.type = data.type
    if (data.declaredRole !== undefined) updates.declared_role = data.declaredRole

    const conditional = options.expectedUpdatedAt !== undefined
    let write = supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
    if (typeof options.expectedUpdatedAt === 'string') {
      write = write.eq('updated_at', options.expectedUpdatedAt)
    } else if (options.expectedUpdatedAt === null) {
      write = write.is('updated_at', null)
    }

    // A conditional write that matched no row is a refusal, not a failure:
    // `assertMay` above already proved the customer exists.
    const first = conditional
      ? await write.select(DETAIL_COLUMNS).maybeSingle()
      : await write.select(DETAIL_COLUMNS).single()

    let rawCustomer: CustomerRow | null = first.data as CustomerRow | null
    let error = first.error

    if (error && isMissingColumnError(error, 'declared_role')) {
      if (data.declaredRole !== undefined && data.declaredRole !== null) {
        throw new ValidationError('CUSTOMER_DECLARED_ROLE_SCHEMA_REQUIRED')
      }
      delete updates.declared_role
      let fallbackWrite = supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .eq('workspace_id', workspaceId)
      if (typeof options.expectedUpdatedAt === 'string') {
        fallbackWrite = fallbackWrite.eq('updated_at', options.expectedUpdatedAt)
      } else if (options.expectedUpdatedAt === null) {
        fallbackWrite = fallbackWrite.is('updated_at', null)
      }
      const retry = conditional
        ? await fallbackWrite.select(DETAIL_COLUMNS_LEGACY).maybeSingle()
        : await fallbackWrite.select(DETAIL_COLUMNS_LEGACY).single()
      rawCustomer = retry.data as CustomerRow | null
      error = retry.error
    }

    if (error) throw new DatabaseError('Failed to update customer', error)
    if (!rawCustomer) {
      if (conditional) throw new ConflictError('CUSTOMER_CHANGED')
      throw new DatabaseError('Customer not found')
    }

    // ✅ Clear cache
    await this.invalidateCache(workspaceId, id)

    return mapCustomer(rawCustomer)
  }

  // ─── Delete ──────────────────────────────────────────────
  async delete(id: string, ctx: TenancyContext): Promise<void> {
    // Workspace alone is not enough on a row addressed by id. Before this, any
    // member of the workspace could mutate any row in it by knowing an id —
    // including one raised by a colleague in a branch they do not hold.
    // `assertMay` reads the row's own branch and creator and refuses on either.
    await scopes.assertMay(ctx, 'customer', id, 'customer.write')

    const { workspaceId } = ctx

    // ⚠️ AN ESTIMATE MUST NOT DECIDE WHETHER A DELETE IS SAFE.
    //
    // This was `count: 'estimated'`, which PostgreSQL answers from table
    // STATISTICS — a planner estimate that is routinely wrong and can read 0
    // for a table that has rows, especially soon after an insert or before the
    // next ANALYZE. A customer with real movements was therefore deletable,
    // orphaning every transaction that pointed at them.
    //
    // The question is «are there ANY», so it is asked as an existence check:
    // one row, exact, and cheaper than any count.
    const { data: linked, error: linkedError } = await supabase
      .from('transactions')
      .select('id')
      .eq('customer_id', id)
      .eq('workspace_id', workspaceId)
      .limit(1)
      .maybeSingle()

    if (linkedError) throw new DatabaseError('Failed to check customer transactions', linkedError)
    if (linked) throw new ConflictError('CUSTOMER_HAS_TRANSACTIONS')

    // ⚠️ `transactions` is the OLD ledger. Invoices and payments are where a
    // customer's history lives now, and neither was looked at: a customer with
    // a hundred invoices and an unpaid balance was deleted, and every one of
    // those documents was left pointing at nobody (there is no foreign key
    // from `invoices` to `customers` to stop it).
    const [invoiced, paid] = await Promise.all([
      supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('customer_id', id),
      supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('party_type', 'customer')
        .eq('party_id', id),
    ])
    if (invoiced.error) throw new DatabaseError('Failed to check customer invoices', invoiced.error)
    if ((invoiced.count ?? 0) > 0) throw new ConflictError('CUSTOMER_HAS_INVOICES')
    // Before the payments core is installed there are no payments to hold.
    if (paid.error && !['42P01', 'PGRST205'].includes(paid.error.code ?? '')) {
      throw new DatabaseError('Failed to check customer payments', paid.error)
    }
    if ((paid.count ?? 0) > 0) throw new ConflictError('CUSTOMER_HAS_PAYMENTS')

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) throw new DatabaseError('Failed to delete customer', error)

    // ✅ Clear cache
    await this.invalidateCache(workspaceId, id)
  }

  // ─── Get Balance ─────────────────────────────────────────
  async getBalance(customerId: string, ctx: TenancyContext): Promise<BalanceResult> {
    const { workspaceId } = ctx
    const cacheKey = this.getBalanceCacheKey(workspaceId, customerId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as BalanceResult

    // The customer must belong to this workspace before its transactions are
    // summed. `transactions_view` is a VIEW, and whether it exposes
    // workspace_id is not something this service can assume — so tenancy is
    // established on the `customers` table, which certainly has the column,
    // and the sum then follows the verified customer id.
    const { data: owned, error: ownerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (ownerError) throw new DatabaseError('Failed to verify customer', ownerError)
    if (!owned) throw new NotFoundError('Customer')

    // ═══════════════════════════════════════════════════════════════════════
    // ⚠️ A BALANCE MUST NOT BE COMPUTED FROM A TRUNCATED SET.
    //
    // This read was `.limit(10000)`. PostgREST returns the first ten thousand
    // rows and says nothing about the rest, so a party with more movements
    // than that got a balance summed from an arbitrary prefix — a number that
    // is simply WRONG, with no error and no flag. A shop with a daily-trading
    // customer reaches that in a few years, and the failure looks like an
    // ordinary figure.
    //
    // Paged to exhaustion instead. The rows are two small columns, and a
    // balance that is right matters more than one round trip saved.
    //
    // ⚠️ `PAGE` MUST STAY BELOW PostgREST's OWN `max-rows` or every page comes
    // back short, the loop stops early, and the truncation returns silently in
    // a new disguise. A short page is therefore treated as the last page ONLY
    // when it is genuinely shorter than requested.
    // ═══════════════════════════════════════════════════════════════════════
    const PAGE = 1000
    const transactions: Array<{ type: string; amount: unknown; currency?: string | null }> = []

    for (let from = 0; ; from += PAGE) {
      const { data: page, error } = await supabase
        .from('transactions_view')
        .select('type, amount, currency')
        .eq('customer_id', customerId)
        // Ordered, so paging is deterministic. Without it PostgreSQL may
        // return rows in any order and a row can be seen twice or never.
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)

      if (error) throw new DatabaseError('Failed to fetch transactions', error)

      transactions.push(...(page ?? []))
      if (!page || page.length < PAGE) break
    }

    // ⚠️ SIGN — this used to read `sale || receipt` on the PLUS side, so money
    // RECEIVED from a customer increased what they were recorded as owing. A
    // shopkeeper who took 500 from a debtor saw the debt go up by 500.
    //
    // What each movement means for "how much does this party owe us":
    //   sale     we billed them            → owes more
    //   receipt  money arrived from them   → owes less
    //   payment  money we paid out to them → owes more (we settled our side)
    //   return   we credited them          → owes less
    const bookCurrency = await baseCurrencyOf(workspaceId)
    const balances = partyBalancesByCurrency(
      (transactions ?? []).map((tx) => ({
        date: '',
        reference: '',
        amount: Number(tx.amount) || 0,
        ...(tx.currency ? { currency: tx.currency } : {}),
        kind:
          tx.type === 'sale'
            ? ('sale' as const)
            : tx.type === 'receipt'
              ? ('payment_in' as const)
              : tx.type === 'payment'
                ? ('payment_out' as const)
                : ('return' as const),
      })),
      bookCurrency,
    )

    const balance = balances[0]?.balance ?? 0
    const result: BalanceResult = {
      customerId,
      currency: bookCurrency,
      balance,
      balances,
      isDebtor: balances.some((entry) => entry.balance > 0),
    }

    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  // ─── Invalidate Cache ─────────────────────────────────────
  private async invalidateCache(workspaceId: string, customerId?: string) {
    await memoryCache.invalidate(`customers:${workspaceId}:*`)
    await memoryCache.invalidate(`dashboard:${workspaceId}`)
    if (customerId) {
      await memoryCache.invalidate(`customer:${workspaceId}:${customerId}`)
      await memoryCache.invalidate(`customer:balance:${workspaceId}:${customerId}`)
    }
  }
}

export default CustomerService
