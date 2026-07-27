// ============================================
// backend/src/services/customer.service.ts — v2.3
// FIXED: TypeScript type for getBalance return
// ============================================

import { supabase } from '../db'
import { CreateCustomer, UpdateCustomer, CustomerFilters } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'
import { logBusinessEvent } from './event-log.service'

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
const DETAIL_COLUMNS = 'id, full_name, phone, email, address, notes, opening_balance, is_active, type, created_at, updated_at'

export class CustomerService {

  // ─── Cache Keys ────────────────────────────────────────────
  private getListCacheKey(userId: string, filters: CustomerFilters) {
    return `customers:${userId}:${JSON.stringify(filters)}`
  }

  private getDetailCacheKey(userId: string, id: string) {
    return `customer:${userId}:${id}`
  }

  private getBalanceCacheKey(userId: string, customerId: string) {
    return `customer:balance:${userId}:${customerId}`
  }

  // ─── List — Cursor-based Pagination ──────────────────────
  async list(userId: string, filters: CustomerFilters) {
    const {
      search, isActive, hasBalance, type,
      limit = 20, cursor, sortBy = 'created_at', sortDirection = 'desc'
    } = filters

    // ✅ کش کردن
    const cacheKey = this.getListCacheKey(userId, filters)
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const maxLimit = Math.min(limit, 100)
    const fetchLimit = maxLimit + 1

    let query = supabase
      .from('customers')
      .select(LIST_COLUMNS)
      .eq('user_id', userId)
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
        .eq('user_id', userId),
    ])

    const { data, error } = queryResult
    if (error) throw new DatabaseError('Failed to fetch customers', error)

    const hasMore = (data?.length || 0) > maxLimit
    const items = hasMore ? data.slice(0, maxLimit) : data
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.id : null

    const result = {
      customers: (items || []).map(mapCustomer),
      nextCursor,
      hasMore,
      total: countResult.count || 0,
      limit: maxLimit,
    }

    // ✅ ذخیره در کش
    await memoryCache.set(cacheKey, result, 30)
    return result
  }

  // ─── Get By ID ──────────────────────────────────────────
  async getById(id: string, userId: string): Promise<CustomerWithBalance> {
    const cacheKey = this.getDetailCacheKey(userId, id)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as CustomerWithBalance

    // ✅ موازی‌سازی: گرفتن customer + balance
    const [customerResult, balanceResult] = await Promise.all([
      supabase
        .from('customers')
        .select(DETAIL_COLUMNS)
        .eq('id', id)
        .eq('user_id', userId)
        .single(),
      this.getBalance(id, userId),
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
  async create(userId: string, data: CreateCustomer): Promise<Customer> {
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
        user_id: userId,
      })
      if (txError) {
        await supabase.from('customers').delete().eq('id', customer.id)
        throw new DatabaseError('Failed to create credit transaction', txError)
      }
    }

    // ✅ Clear cache
    await this.invalidateCache(userId, customer.id)

    logBusinessEvent({
      userId,
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
  async update(id: string, userId: string, data: UpdateCustomer): Promise<Customer> {
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
      .eq('user_id', userId)
      .select(DETAIL_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update customer', error)
    if (!customer) throw new DatabaseError('Customer not found')

    // ✅ Clear cache
    await this.invalidateCache(userId, id)

    return mapCustomer(customer)
  }

  // ─── Delete ──────────────────────────────────────────────
  async delete(id: string, userId: string): Promise<void> {
    // ✅ count: estimated
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'estimated', head: true })
      .eq('customer_id', id)

    if (count && count > 0) {
      throw new DatabaseError('Customer has transactions, cannot delete')
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to delete customer', error)

    // ✅ Clear cache
    await this.invalidateCache(userId, id)
  }

  // ─── Get Balance ─────────────────────────────────────────
  async getBalance(customerId: string, userId: string): Promise<BalanceResult> {
    const cacheKey = this.getBalanceCacheKey(userId, customerId)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as BalanceResult

    // ✅ فقط ستون‌های مورد نیاز + limit
    const { data: transactions, error } = await supabase
      .from('transactions_view')
      .select('type, amount')
      .eq('customer_id', customerId)
      .eq('user_id', userId)
      .limit(10000)

    if (error) {
      throw new DatabaseError('Failed to fetch transactions', error)
    }

    const balance = (transactions || []).reduce((acc, tx) => {
      const amount = Number(tx.amount)
      if (tx.type === 'sale' || tx.type === 'receipt') {
        return acc + amount
      }
      if (tx.type === 'payment' || tx.type === 'return') {
        return acc - amount
      }
      return acc
    }, 0)

    const result: BalanceResult = {
      customerId,
      balance,
      isDebtor: balance > 0,
    }

    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  // ─── Invalidate Cache ─────────────────────────────────────
  private async invalidateCache(userId: string, customerId?: string) {
    await memoryCache.invalidate(`customers:${userId}:*`)
    await memoryCache.invalidate(`dashboard:${userId}`)
    if (customerId) {
      await memoryCache.invalidate(`customer:${userId}:${customerId}`)
      await memoryCache.invalidate(`customer:balance:${userId}:${customerId}`)
    }
  }
}

export default CustomerService