// ============================================
// backend/src/services/crm.service.ts — Optimized v2.0
// ============================================

import { supabase } from '../db'
import { CreateInteraction, CreateOpportunity, UpdateOpportunity } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'

// ✅ Column Selection Constants
const INTERACTION_COLUMNS = 'id, customer_id, type, subject, content, interaction_date, created_at'
const OPPORTUNITY_COLUMNS = 'id, customer_id, title, description, stage, value, expected_close_date, probability, created_at, updated_at'

export class CrmService {
  // ─── Interactions ─────────────────────────────────────────
  async listInteractions(userId: string, customerId?: string) {
    let query = supabase
      .from('interactions')
      .select(INTERACTION_COLUMNS)
      .eq('user_id', userId)
      .order('interaction_date', { ascending: false })

    if (customerId) query = query.eq('customer_id', customerId)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch interactions', error)
    return data || []
  }

  async createInteraction(userId: string, data: CreateInteraction) {
    const { data: interaction, error } = await supabase
      .from('interactions')
      .insert({
        customer_id: data.customerId, type: data.type,
        subject: data.subject || '', content: data.content || '',
        interaction_date: data.interactionDate || new Date().toISOString(), user_id: userId,
      })
      .select(INTERACTION_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create interaction', error)
    return interaction
  }

  // ─── Opportunities ────────────────────────────────────────
  async listOpportunities(userId: string, customerId?: string) {
    let query = supabase
      .from('opportunities')
      .select(OPPORTUNITY_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (customerId) query = query.eq('customer_id', customerId)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch opportunities', error)
    return data || []
  }

  async createOpportunity(userId: string, data: CreateOpportunity) {
    const { data: opportunity, error } = await supabase
      .from('opportunities')
      .insert({
        customer_id: data.customerId, title: data.title,
        description: data.description || '', stage: data.stage || 'lead',
        value: data.value || 0, expected_close_date: data.expectedCloseDate || null,
        probability: data.probability || 0, user_id: userId,
      })
      .select(OPPORTUNITY_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create opportunity', error)
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

    const { data: opportunity, error } = await supabase
      .from('opportunities').update(updates).eq('id', id).eq('user_id', userId)
      .select(OPPORTUNITY_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update opportunity', error)
    return opportunity
  }
}