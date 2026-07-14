// backend/src/services/customer.service.ts — v2.0 + Cache Invalidation
// ============================================

import { supabase } from '../db'
import { CreateCustomer, UpdateCustomer, CustomerFilters } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'

function mapCustomer(raw: Record<string, any>) {
  return {
    id: raw.id, fullName: raw.full_name, phone: raw.phone, email: raw.email,
    address: raw.address, notes: raw.notes, openingBalance: raw.opening_balance,
    isActive: raw.is_active, type: raw.type, createdAt: raw.created_at, updatedAt: raw.updated_at,
  }
}

const LIST_COLUMNS = 'id, full_name, phone, email, opening_balance, is_active, type, created_at'
const DETAIL_COLUMNS = 'id, full_name, phone, email, address, notes, opening_balance, is_active, type, created_at, updated_at'

export class CustomerService {
  // ─── List ───
  async list(userId: string, filters: CustomerFilters) {
    const { search, isActive, hasBalance, type, page, limit, sortBy, sortDirection } = filters
    const from = (page - 1) * limit; const to = from + limit - 1

    let query = supabase
      .from('customers').select(LIST_COLUMNS, { count: 'exact' })
      .eq('user_id', userId)
      .order(sortBy || 'created_at', { ascending: sortDirection === 'asc' })
      .range(from, to)

    if (search) query = query.ilike('full_name', `%${search}%`)
    if (isActive !== undefined) query = query.eq('is_active', isActive)
    if (hasBalance !== undefined) query = hasBalance ? query.gt('opening_balance', 0) : query.eq('opening_balance', 0)
    if (type !== undefined) query = query.eq('type', type)

    const { data, error, count } = await query
    if (error) throw new DatabaseError('Failed to fetch customers', error)
    return { customers: (data || []).map(mapCustomer), total: count || 0, page, limit }
  }

  // ─── Get By ID ───
  async getById(id: string, userId: string) {
    const { data: customer, error } = await supabase
      .from('customers').select(DETAIL_COLUMNS).eq('id', id).eq('user_id', userId).single()
    if (error || !customer) throw new DatabaseError('Customer not found', error)
    const balance = await this.getBalance(id, userId)
    return { ...mapCustomer(customer), balance: balance.balance }
  }

  // ─── Create ───
  async create(userId: string, data: CreateCustomer) {
    const { data: customer, error } = await supabase
      .from('customers').insert({
        full_name: data.fullName, phone: data.phone || '', email: data.email || '',
        address: data.address || null, notes: data.notes || '',
        opening_balance: data.openingBalance || 0, is_active: data.isActive !== false,
        type: data.type || 'cash', user_id: userId,
      })
      .select(DETAIL_COLUMNS).single()

    if (error) throw new DatabaseError('Failed to create customer', error)

    if (data.type === 'credit') {
      const { error: txError } = await supabase.from('transactions').insert({
        customer_id: customer.id, type: 'sale', amount: data.openingBalance || 0,
        currency: 'AFN', description: 'Credit sale - opening balance', user_id: userId,
      })
      if (txError) {
        await supabase.from('customers').delete().eq('id', customer.id)
        throw new DatabaseError('Failed to create credit transaction', txError)
      }
    }

    // ✅ Cache Invalidation
    memoryCache.invalidate(`customers:${userId}`)
    memoryCache.invalidate(`dashboard:${userId}`)

    return mapCustomer(customer)
  }

  // ─── Update ───
  async update(id: string, userId: string, data: UpdateCustomer) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.fullName !== undefined) updates.full_name = data.fullName
    if (data.phone !== undefined) updates.phone = data.phone
    if (data.email !== undefined) updates.email = data.email
    if (data.address !== undefined) updates.address = data.address
    if (data.notes !== undefined) updates.notes = data.notes
    if (data.isActive !== undefined) updates.is_active = data.isActive
    if (data.type !== undefined) updates.type = data.type

    const { data: customer, error } = await supabase
      .from('customers').update(updates).eq('id', id).eq('user_id', userId)
      .select(DETAIL_COLUMNS).single()

    if (error) throw new DatabaseError('Failed to update customer', error)
    if (!customer) throw new DatabaseError('Customer not found')

    // ✅ Cache Invalidation
    memoryCache.invalidate(`customers:${userId}`)
    memoryCache.invalidate(`dashboard:${userId}`)

    return mapCustomer(customer)
  }

  // ─── Delete ───
  async delete(id: string, userId: string): Promise<void> {
    const { count } = await supabase
      .from('transactions').select('id', { count: 'exact', head: true }).eq('customer_id', id)
    if (count && count > 0) throw new DatabaseError('Customer has transactions, cannot delete')

    const { error } = await supabase.from('customers').delete().eq('id', id).eq('user_id', userId)
    if (error) throw new DatabaseError('Failed to delete customer', error)

    // ✅ Cache Invalidation
    memoryCache.invalidate(`customers:${userId}`)
    memoryCache.invalidate(`dashboard:${userId}`)
  }

  // ─── Get Balance ───
  async getBalance(customerId: string, userId: string) {
    const { data: transactions, error } = await supabase
      .from('transactions').select('type, amount').eq('customer_id', customerId).eq('user_id', userId)
    if (error) throw new DatabaseError('Failed to fetch transactions', error)

    const balance = (transactions || []).reduce((acc, tx) => {
      const amount = Number(tx.amount)
      if (tx.type === 'sale' || tx.type === 'receipt') return acc + amount
      if (tx.type === 'payment' || tx.type === 'return') return acc - amount
      return acc
    }, 0)

    return { customerId, balance, isDebtor: balance > 0 }
  }
}