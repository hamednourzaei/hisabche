// ============================================
// backend/src/services/crm.service.ts — Optimized v2.1
// FIXED: Added cache, pagination, count, parallel queries
// ============================================

import { supabase } from '../db'
import { CreateInteraction, CreateOpportunity, UpdateOpportunity } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'

// ✅ Column Selection Constants
const INTERACTION_COLUMNS = 'id, customer_id, type, subject, content, interaction_date, created_at'
const INTERACTION_MINIMAL_COLUMNS = 'id, customer_id, type, subject, interaction_date'

const OPPORTUNITY_COLUMNS = 'id, customer_id, title, description, stage, value, expected_close_date, probability, created_at, updated_at'
const OPPORTUNITY_MINIMAL_COLUMNS = 'id, customer_id, title, stage, value, probability, expected_close_date'

export class CrmService {

  // ─── Cache Keys ────────────────────────────────────────────
  private getInteractionsCacheKey(userId: string, customerId?: string) {
    return `crm:interactions:${userId}:${customerId || 'all'}`
  }

  private getOpportunitiesCacheKey(userId: string, customerId?: string) {
    return `crm:opportunities:${userId}:${customerId || 'all'}`
  }

  // ─── Interactions ─────────────────────────────────────────
  async listInteractions(
    userId: string, 
    customerId?: string,
    options?: { limit?: number; page?: number }
  ) {
    const limit = Math.min(options?.limit || 50, 100)
    const page = options?.page || 1
    const offset = (page - 1) * limit

    const cacheKey = this.getInteractionsCacheKey(userId, customerId)
    
    // ✅ کش کردن با پارامترهای صفحه‌بندی
    const paginatedCacheKey = `${cacheKey}:${page}:${limit}`
    const cached = await memoryCache.get<{ interactions: any[]; total: number; page: number; limit: number; totalPages: number }>(paginatedCacheKey)
    if (cached) return cached

    let query = supabase
      .from('interactions')
      .select(INTERACTION_MINIMAL_COLUMNS, { count: 'estimated' })
      .eq('user_id', userId)
      .order('interaction_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (customerId) query = query.eq('customer_id', customerId)

    const { data, error, count } = await query
    if (error) throw new DatabaseError('Failed to fetch interactions', error)

    const result = {
      interactions: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    }

    await memoryCache.set(paginatedCacheKey, result, 60) // 1 minute
    return result
  }

  async createInteraction(userId: string, data: CreateInteraction) {
    const { data: interaction, error } = await supabase
      .from('interactions')
      .insert({
        customer_id: data.customerId,
        type: data.type,
        subject: data.subject || '',
        content: data.content || '',
        interaction_date: data.interactionDate || new Date().toISOString(),
        user_id: userId,
      })
      .select(INTERACTION_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create interaction', error)

    // ✅ Clear cache
    await this.invalidateInteractionCache(userId, data.customerId)
    
    return interaction
  }

  // ─── Opportunities ────────────────────────────────────────
  async listOpportunities(
    userId: string, 
    customerId?: string,
    options?: { limit?: number; page?: number }
  ) {
    const limit = Math.min(options?.limit || 50, 100)
    const page = options?.page || 1
    const offset = (page - 1) * limit

    const cacheKey = this.getOpportunitiesCacheKey(userId, customerId)
    const paginatedCacheKey = `${cacheKey}:${page}:${limit}`

    const cached = await memoryCache.get<{ opportunities: any[]; total: number; page: number; limit: number; totalPages: number }>(paginatedCacheKey)
    if (cached) return cached

    let query = supabase
      .from('opportunities')
      .select(OPPORTUNITY_MINIMAL_COLUMNS, { count: 'estimated' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (customerId) query = query.eq('customer_id', customerId)

    const { data, error, count } = await query
    if (error) throw new DatabaseError('Failed to fetch opportunities', error)

    const result = {
      opportunities: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    }

    await memoryCache.set(paginatedCacheKey, result, 60)
    return result
  }

  async createOpportunity(userId: string, data: CreateOpportunity) {
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .insert({
        customer_id: data.customerId,
        title: data.title,
        description: data.description || '',
        stage: data.stage || 'lead',
        value: data.value || 0,
        expected_close_date: data.expectedCloseDate || null,
        probability: data.probability || 0,
        user_id: userId,
      })
      .select(OPPORTUNITY_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create opportunity', error)

    // ✅ Clear cache
    await this.invalidateOpportunityCache(userId, data.customerId)
    
    return opportunity
  }

  async updateOpportunity(userId: string, id: string, data: UpdateOpportunity) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.stage !== undefined) updates.stage = data.stage
    if (data.value !== undefined) updates.value = data.value
    if (data.expectedCloseDate !== undefined) updates.expected_close_date = data.expectedCloseDate
    if (data.probability !== undefined) updates.probability = data.probability

    // ✅ ابتدا دریافت customerId برای invalidate کش
    const { data: existing } = await supabase
      .from('opportunities')
      .select('customer_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(OPPORTUNITY_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update opportunity', error)

    // ✅ Clear cache
    if (existing) {
      await this.invalidateOpportunityCache(userId, existing.customer_id)
    }
    
    return opportunity
  }

  // ─── Get Opportunity by ID ─────────────────────────────────
  async getOpportunity(userId: string, id: string) {
    const cacheKey = `crm:opportunity:${userId}:${id}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('opportunities')
      .select(OPPORTUNITY_COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) throw new DatabaseError('Failed to fetch opportunity', error)

    await memoryCache.set(cacheKey, data, 300) // 5 minutes
    return data
  }

  // ─── Get Customer Interactions ────────────────────────────
  async getCustomerInteractions(userId: string, customerId: string) {
    const cacheKey = `crm:customer:interactions:${userId}:${customerId}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('interactions')
      .select(INTERACTION_COLUMNS)
      .eq('user_id', userId)
      .eq('customer_id', customerId)
      .order('interaction_date', { ascending: false })
      .limit(20)

    if (error) throw new DatabaseError('Failed to fetch customer interactions', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 120) // 2 minutes
    return result
  }

  // ─── Get Opportunity Pipeline ──────────────────────────────
  async getOpportunityPipeline(userId: string) {
    const cacheKey = `crm:pipeline:${userId}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('opportunities')
      .select('stage, value, probability, id, title')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error) throw new DatabaseError('Failed to fetch pipeline', error)

    const pipeline: Record<string, { count: number; value: number; items: any[] }> = {}
    const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']

    for (const stage of stages) {
      pipeline[stage] = { count: 0, value: 0, items: [] }
    }

    for (const opp of data || []) {
      const stage = opp.stage || 'lead'
      if (pipeline[stage]) {
        pipeline[stage].count++
        pipeline[stage].value += Number(opp.value) || 0
        pipeline[stage].items.push(opp)
      }
    }

    await memoryCache.set(cacheKey, pipeline, 120)
    return pipeline
  }

  // ─── Invalidate Cache ──────────────────────────────────────
  async invalidateInteractionCache(userId: string, customerId?: string) {
    await memoryCache.invalidate(this.getInteractionsCacheKey(userId, customerId))
    await memoryCache.invalidate(this.getInteractionsCacheKey(userId))
    await memoryCache.invalidate(`crm:customer:interactions:${userId}:${customerId || '*'}`)
  }

  async invalidateOpportunityCache(userId: string, customerId?: string) {
    await memoryCache.invalidate(this.getOpportunitiesCacheKey(userId, customerId))
    await memoryCache.invalidate(this.getOpportunitiesCacheKey(userId))
    await memoryCache.invalidate(`crm:pipeline:${userId}`)
    await memoryCache.invalidate(`crm:opportunity:${userId}:*`)
  }
}

export default CrmService