// ============================================
// backend/src/services/customer.service.ts — v2.3
// FIXED: TypeScript type for getBalance return
// ============================================

import { supabase } from '../db'
import { scopes } from './authorization/scope.service'
import { CreateCustomer, UpdateCustomer, CustomerFilters } from '@hisabche/validation'
import { DatabaseError, NotFoundError } from '../errors/database.error'
import type { TenancyContext } from './tenancy.service'
import { memoryCache } from '../utils/pagination'
import { logBusinessEvent } from './event-log.service'
import { partyBalance } from './payments'

// ✅ Types
interface Customer {
  id: string
  fullName: string
  phone: string
  email: string
  address: string | null
  notes: string
  openingBalance: number
  isActive: boolean
  type: string
  createdAt: string
  updatedAt: string
}

interface CustomerWithBalance extends Customer {
  balance: number
}

interface BalanceResult {
  customerId: string
  balance: number
  isDebtor: boolean
}

// ✅ Mapper
/**
 * The transaction role a party has played, derived from their invoices.
 * 'both' is a real, common state — a person you buy from and sell to.
 */
export type PartyRole = 'none' | 'buyer' | 'seller' | 'both'

/** Roles accumulate; seeing a second kind of invoice promotes the party. */
function mergeRole(current: PartyRole, incoming: 'buyer' | 'seller'): PartyRole {
  if (current === 'none') return incoming
  if (current === incoming) return current
  return 'both'
}

/** A 'both' party legitimately matches a buyer filter AND a seller filter. */
function matchesRole(role: PartyRole, filter: 'buyer' | 'seller'): boolean {
  return role === filter || role === 'both'
}

function mapCustomer(raw: Record<string, any>): Customer {
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
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

const LIST_COLUMNS = 'id, full_name, phone, email, opening_balance, is_active, type, created_at'
const DETAIL_COLUMNS =
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

    let query = supabase
      .from('customers')
      .select(LIST_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order(sortBy, { ascending: sortDirection === 'asc' })
      .limit(fetchLimit)

    if (search) query = query.ilike('full_name', `%${search}%`)
    if (isActive !== undefined) query = query.eq('is_active', isActive)
    if (hasBalance !== undefined) {
      query = hasBalance ? query.gt('opening_balance', 0) : query.eq('opening_balance', 0)
    }
    if (type !== undefined) query = query.eq('type', type)

    if (cursor) {
      if (sortDirection === 'desc') {
        query = query.lt(sortBy, cursor)
      } else {
        query = query.gt(sortBy, cursor)
      }
    }

    // ✅ موازی‌سازی: کوئری اصلی + count
    const [queryResult, countResult] = await Promise.all([
      query,
      supabase
        .from('customers')
        .select('id', { count: 'estimated', head: true })
        .eq('workspace_id', workspaceId),
    ])

    const { data, error } = queryResult
    if (error) throw new DatabaseError('Failed to fetch customers', error)

    const hasMore = (data?.length || 0) > maxLimit
    const items = hasMore ? data.slice(0, maxLimit) : data
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.id : null

    const roles = await this.resolveRoles(
      workspaceId,
      (items || []).map((row) => (row as { id: string }).id),
    )

    const withRoles = (items || []).map((row) => {
      const mapped = mapCustomer(row)
      return { ...mapped, role: roles.get(mapped.id) ?? 'none' }
    })

    const result = {
      customers: role ? withRoles.filter((c) => matchesRole(c.role, role)) : withRoles,
      nextCursor,
      hasMore,
      total: countResult.count || 0,
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

    const { data: customer, error } = customerResult
    if (error || !customer) throw new DatabaseError('Customer not found', error)

    const result: CustomerWithBalance = {
      ...mapCustomer(customer),
      balance: balanceResult.balance, // ✅ حالا TypeScript می‌داند balance وجود دارد
    }

    await memoryCache.set(cacheKey, result, 300)
    return result
  }

  // ─── Create ──────────────────────────────────────────────
  async create(ctx: TenancyContext, data: CreateCustomer): Promise<Customer> {
    const { workspaceId, userId } = ctx
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
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
      })
      .select(DETAIL_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create customer', error)

    if (data.type === 'credit') {
      const { error: txError } = await supabase.from('transactions').insert({
        customer_id: customer.id,
        type: 'sale',
        amount: data.openingBalance || 0,
        currency: 'AFN',
        description: 'Credit sale - opening balance',
        workspace_id: workspaceId,
        user_id: userId,
      })
      if (txError) {
        await supabase.from('customers').delete().eq('id', customer.id)
        throw new DatabaseError('Failed to create credit transaction', txError)
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
      title: `مشتری جدید: ${customer.full_name}`,
      description: customer.phone || customer.email || undefined,
      notify: false,
    }).catch((err) => console.error('[CustomerService] logBusinessEvent failed:', err))

    return mapCustomer(customer)
  }

  // ─── Update ──────────────────────────────────────────────
  async update(id: string, ctx: TenancyContext, data: UpdateCustomer): Promise<Customer> {
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

    const { data: customer, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(DETAIL_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update customer', error)
    if (!customer) throw new DatabaseError('Customer not found')

    // ✅ Clear cache
    await this.invalidateCache(workspaceId, id)

    return mapCustomer(customer)
  }

  // ─── Delete ──────────────────────────────────────────────
  async delete(id: string, ctx: TenancyContext): Promise<void> {
    // Workspace alone is not enough on a row addressed by id. Before this, any
    // member of the workspace could mutate any row in it by knowing an id —
    // including one raised by a colleague in a branch they do not hold.
    // `assertMay` reads the row's own branch and creator and refuses on either.
    await scopes.assertMay(ctx, 'customer', id, 'customer.write')

    const { workspaceId } = ctx

    // ✅ count: estimated
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'estimated', head: true })
      .eq('customer_id', id)
      .eq('workspace_id', workspaceId)

    if (count && count > 0) {
      throw new DatabaseError('Customer has transactions, cannot delete')
    }

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

    // ✅ فقط ستون‌های مورد نیاز + limit
    const { data: transactions, error } = await supabase
      .from('transactions_view')
      .select('type, amount')
      .eq('customer_id', customerId)
      .limit(10000)

    if (error) {
      throw new DatabaseError('Failed to fetch transactions', error)
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
    const balance = partyBalance(
      (transactions ?? []).map((tx) => ({
        date: '',
        reference: '',
        amount: Number(tx.amount) || 0,
        kind:
          tx.type === 'sale'
            ? ('sale' as const)
            : tx.type === 'receipt'
              ? ('payment_in' as const)
              : tx.type === 'payment'
                ? ('payment_out' as const)
                : ('return' as const),
      })),
    )

    const result: BalanceResult = {
      customerId,
      balance,
      isDebtor: balance > 0,
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
