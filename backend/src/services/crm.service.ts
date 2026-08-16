// ============================================
// backend/src/services/crm.service.ts — Optimized v2.1
// FIXED: Added cache, pagination, count, parallel queries
// ============================================

import { supabase } from '../db'
import { CreateInteraction, CreateOpportunity, UpdateOpportunity } from '@hisabche/validation'
import { DatabaseError, NotFoundError } from '../errors/database.error'
import { ValidationError } from '../errors/validation.error'
import { memoryCache } from '../utils/pagination'
import { logBusinessEvent } from './event-log.service'

// ✅ Column Selection Constants
// ⚠️ status / public_token / employee_id / employee_name / customers_snapshot /
// status_history come from docs/task-assignment-migration.sql. Until that
// migration runs, selecting them raises Postgres 42703 (undefined_column) —
// callers that need to work before/after the migration use the same
// graceful-fallback pattern as invoice.service.ts's public_token handling.
const INTERACTION_COLUMNS =
  'id, customer_id, type, subject, content, interaction_date, created_at, status, public_token, employee_id, employee_name, customers_snapshot, status_history, customer_outcomes'
const INTERACTION_MINIMAL_COLUMNS = INTERACTION_COLUMNS
const INTERACTION_LEGACY_COLUMNS =
  'id, customer_id, type, subject, content, interaction_date, created_at'

const OPPORTUNITY_COLUMNS =
  'id, customer_id, title, description, stage, value, expected_close_date, probability, created_at, updated_at'
const OPPORTUNITY_MINIMAL_COLUMNS =
  'id, customer_id, title, stage, value, probability, expected_close_date'

// ✅ Mapper — snake_case (DB) -> camelCase (frontend). Missing this mapper
// was the root cause of the CRM "date column doesn't show a date" bug:
// the frontend reads `interaction.interactionDate` but the DB row only
// has `interaction_date`, so every date rendered as "-".
function mapInteraction(raw: Record<string, any>) {
  return {
    id: raw.id,
    customerId: raw.customer_id,
    type: raw.type,
    subject: raw.subject,
    content: raw.content,
    interactionDate: raw.interaction_date,
    createdAt: raw.created_at,
    status: raw.status ?? 'pending',
    publicToken: raw.public_token ?? null,
    employeeId: raw.employee_id ?? null,
    employeeName: raw.employee_name ?? null,
    customers: Array.isArray(raw.customers_snapshot) ? raw.customers_snapshot : [],
    statusHistory: Array.isArray(raw.status_history) ? raw.status_history : [],
    // Per-customer results. An absent entry means "not attempted yet", which is
    // deliberately distinct from a recorded failure so progress stays honest.
    customerOutcomes: Array.isArray(raw.customer_outcomes) ? raw.customer_outcomes : [],
  }
}

export class CrmService {
  // ─── Cache Keys ────────────────────────────────────────────
  private getInteractionsCacheKey(userId: string, customerId?: string) {
    return `crm:interactions:${userId}:${customerId || 'all'}`
  }

  private getOpportunitiesCacheKey(userId: string, customerId?: string) {
    return `crm:opportunities:${userId}:${customerId || 'all'}`
  }

  // ─── Interactions (a.k.a. Tasks) ───────────────────────────
  async listInteractions(
    userId: string,
    customerId?: string,
    options?: { limit?: number; page?: number },
  ) {
    const limit = Math.min(options?.limit || 50, 100)
    const page = options?.page || 1
    const offset = (page - 1) * limit

    const cacheKey = this.getInteractionsCacheKey(userId, customerId)

    // ✅ کش کردن با پارامترهای صفحه‌بندی
    const paginatedCacheKey = `${cacheKey}:${page}:${limit}`
    const cached = await memoryCache.get<{
      interactions: any[]
      total: number
      page: number
      limit: number
      totalPages: number
    }>(paginatedCacheKey)
    if (cached) return cached

    const runQuery = (columns: string) => {
      let query = supabase
        .from('interactions')
        .select(columns, { count: 'estimated' })
        .eq('user_id', userId)
        .order('interaction_date', { ascending: false })
        .range(offset, offset + limit - 1)
      if (customerId) query = query.eq('customer_id', customerId)
      return query
    }

    let { data, error, count } = await runQuery(INTERACTION_MINIMAL_COLUMNS)
    if (error && (error.code === '42703' || /column/.test(error.message || ''))) {
      // Task-assignment migration not run yet — fall back to legacy columns.
      ;({ data, error, count } = await runQuery(INTERACTION_LEGACY_COLUMNS))
    }
    if (error) throw new DatabaseError('Failed to fetch interactions', error)

    const result = {
      interactions: (data || []).map(mapInteraction),
      total: count || 0,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0,
    }

    await memoryCache.set(paginatedCacheKey, result, 60) // 1 minute
    return result
  }

  async createInteraction(userId: string, data: CreateInteraction) {
    const customerIds =
      data.customerIds && data.customerIds.length > 0 ? data.customerIds : [data.customerId]

    let customersSnapshot: Array<{ id: string; name: string; phone: string | null }> = []
    if (customerIds.length > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, full_name, phone')
        .in('id', customerIds)
        .eq('user_id', userId)
      customersSnapshot = (customers || []).map((c: any) => ({
        id: c.id,
        name: c.full_name,
        phone: c.phone ?? null,
      }))
    }

    const now = new Date().toISOString()
    const insertPayload: Record<string, unknown> = {
      customer_id: data.customerId,
      type: data.type,
      subject: data.subject || '',
      content: data.content || '',
      interaction_date: data.interactionDate || now,
      user_id: userId,
      status: 'pending',
      employee_id: data.employeeId || null,
      employee_name: data.employeeName || null,
      customers_snapshot: customersSnapshot,
      status_history: [{ status: 'pending', changedAt: now, changedBy: 'owner' }],
    }

    let { data: interaction, error } = await supabase
      .from('interactions')
      .insert(insertPayload)
      .select(INTERACTION_COLUMNS)
      .single()

    if (error && (error.code === '42703' || /column/.test(error.message || ''))) {
      // Task-assignment migration not run yet — insert legacy columns only.
      ;({ data: interaction, error } = await supabase
        .from('interactions')
        .insert({
          customer_id: data.customerId,
          type: data.type,
          subject: data.subject || '',
          content: data.content || '',
          interaction_date: data.interactionDate || now,
          user_id: userId,
        })
        .select(INTERACTION_LEGACY_COLUMNS)
        .single())
    }

    if (error || !interaction) throw new DatabaseError('Failed to create interaction', error)

    // ✅ Clear cache
    await this.invalidateInteractionCache(userId, data.customerId)

    return mapInteraction(interaction)
  }

  // ─── Update task status (owner, authenticated) ─────────────
  async updateInteractionStatus(
    userId: string,
    id: string,
    status: 'pending' | 'in_progress' | 'completed',
    changedBy = 'owner',
  ) {
    return this.applyStatusChange({ id, userId }, status, changedBy)
  }

  // ─── Get task for public (unauthenticated) view ────────────
  // ⚠️ Looked up by `public_token` (unguessable uuid), never by `id` —
  // same reasoning as InvoiceService.getPublicByToken: looking up by the
  // sequential id would let anyone enumerate every task.
  async getPublicTaskByToken(token: string) {
    const { data, error } = await supabase
      .from('interactions')
      .select(INTERACTION_COLUMNS)
      .eq('public_token', token)
      .single()

    if (error || !data) throw new NotFoundError('Task')
    return mapInteraction(data)
  }

  // ─── Update task status via public token (assigned employee, no login) ─
  // Scoped to ONLY this one task's status — nothing else is readable or
  // writable through this path.
  async updatePublicTaskStatus(token: string, status: 'in_progress' | 'completed') {
    return this.applyStatusChange({ publicToken: token }, status, 'employee')
  }

  // ─── Per-customer outcome ──────────────────────────────────
  // A task covers many customers; this records the result for exactly one of
  // them. Called both by the owner (authenticated) and by an assigned employee
  // through the unauthenticated public-token view.
  async recordCustomerOutcome(
    lookup: { id: string; userId: string } | { publicToken: string },
    input: { customerId: string; outcome: 'done' | 'failed'; note?: string | undefined },
    recordedBy: 'owner' | 'employee',
  ) {
    const note = input.note?.trim() ?? ''

    // A failure without a reason is useless to whoever created the task —
    // the whole point of the ❌ path is capturing why.
    if (input.outcome === 'failed' && !note) {
      throw new ValidationError('A note is required when marking a customer as failed')
    }

    let existingQuery = supabase
      .from('interactions')
      .select('id, user_id, customer_id, customers_snapshot, customer_outcomes')
    existingQuery =
      'id' in lookup
        ? existingQuery.eq('id', lookup.id).eq('user_id', lookup.userId)
        : existingQuery.eq('public_token', lookup.publicToken)

    const { data: existing, error: fetchError } = await existingQuery.single()
    if (fetchError || !existing) throw new NotFoundError('Task')

    // The public endpoint is unauthenticated, so the customer id arriving in
    // the body is untrusted. Only ids already on this task's own snapshot may
    // be written — otherwise a token holder could attach notes to arbitrary
    // customers belonging to the owner.
    const snapshot: Array<{ id: string }> = Array.isArray(existing.customers_snapshot)
      ? existing.customers_snapshot
      : []

    if (!snapshot.some((c) => c.id === input.customerId)) {
      throw new NotFoundError('Customer on this task')
    }

    const current: Array<Record<string, unknown>> = Array.isArray(existing.customer_outcomes)
      ? existing.customer_outcomes
      : []

    // Re-recording replaces the previous entry: an employee who reached someone
    // on a second attempt must be able to correct an earlier ❌.
    const next = [
      ...current.filter((entry) => entry['customerId'] !== input.customerId),
      {
        customerId: input.customerId,
        outcome: input.outcome,
        recordedAt: new Date().toISOString(),
        recordedBy,
        ...(note ? { note } : {}),
      },
    ]

    let updateQuery = supabase
      .from('interactions')
      .update({ customer_outcomes: next })
      .eq('id', existing.id)
    updateQuery = 'id' in lookup ? updateQuery.eq('user_id', lookup.userId) : updateQuery

    const { data, error } = await updateQuery.select(INTERACTION_COLUMNS).single()

    if (error) {
      // Migration not run yet — see docs/task-customer-outcomes-migration.sql.
      if (error.code === '42703' || /column/.test(error.message || '')) {
        throw new DatabaseError(
          'Per-customer outcomes require the task-customer-outcomes migration',
          error,
        )
      }
      throw new DatabaseError('Failed to record customer outcome', error)
    }

    await this.invalidateInteractionCache(existing.user_id, existing.customer_id)
    return mapInteraction(data)
  }

  /**
   * Distinct subjects this user has already used, most recent first.
   *
   * Feeds the subject autocomplete so a recurring campaign is typed once and
   * picked thereafter, rather than re-typed with slightly different wording
   * each time (which fragments the stats).
   */
  async listSubjectSuggestions(userId: string, limit = 20): Promise<string[]> {
    const { data, error } = await supabase
      .from('interactions')
      .select('subject, created_at')
      .eq('user_id', userId)
      .not('subject', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw new DatabaseError('Failed to load subject suggestions', error)

    const seen = new Set<string>()
    const suggestions: string[] = []

    for (const row of data || []) {
      const subject = String((row as Record<string, unknown>)['subject'] ?? '').trim()
      if (!subject) continue

      // Case-insensitive dedupe, but keep the casing the user actually typed.
      const key = subject.toLowerCase()
      if (seen.has(key)) continue

      seen.add(key)
      suggestions.push(subject)
      if (suggestions.length >= limit) break
    }

    return suggestions
  }

  private async applyStatusChange(
    lookup: { id: string; userId: string } | { publicToken: string },
    status: 'pending' | 'in_progress' | 'completed',
    changedBy: string,
  ) {
    let existingQuery = supabase
      .from('interactions')
      .select('id, user_id, customer_id, status_history')
    existingQuery =
      'id' in lookup
        ? existingQuery.eq('id', lookup.id).eq('user_id', lookup.userId)
        : existingQuery.eq('public_token', lookup.publicToken)

    const { data: existing, error: fetchError } = await existingQuery.single()
    if (fetchError || !existing) throw new NotFoundError('Task')

    const history = Array.isArray(existing.status_history) ? existing.status_history : []
    const updatedHistory = [...history, { status, changedAt: new Date().toISOString(), changedBy }]

    let updateQuery = supabase
      .from('interactions')
      .update({ status, status_history: updatedHistory })
      .eq('id', existing.id)
    updateQuery = 'id' in lookup ? updateQuery.eq('user_id', lookup.userId) : updateQuery

    const { data, error } = await updateQuery.select(INTERACTION_COLUMNS).single()
    if (error) throw new DatabaseError('Failed to update task status', error)

    await this.invalidateInteractionCache(existing.user_id, existing.customer_id)
    return mapInteraction(data)
  }

  // ─── Opportunities ────────────────────────────────────────
  async listOpportunities(
    userId: string,
    customerId?: string,
    options?: { limit?: number; page?: number },
  ) {
    const limit = Math.min(options?.limit || 50, 100)
    const page = options?.page || 1
    const offset = (page - 1) * limit

    const cacheKey = this.getOpportunitiesCacheKey(userId, customerId)
    const paginatedCacheKey = `${cacheKey}:${page}:${limit}`

    const cached = await memoryCache.get<{
      opportunities: any[]
      total: number
      page: number
      limit: number
      totalPages: number
    }>(paginatedCacheKey)
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

    logBusinessEvent({
      userId,
      entityType: 'opportunity',
      entityId: opportunity.id,
      action: 'created',
      title: `فرصت فروش جدید: ${opportunity.title}`,
      notify: false,
    }).catch((err) => console.error('[CrmService] logBusinessEvent failed:', err))

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

    if (data.stage === 'won' || data.stage === 'lost') {
      logBusinessEvent({
        userId,
        entityType: 'opportunity',
        entityId: opportunity.id,
        action: 'stage_changed',
        title:
          data.stage === 'won'
            ? `فرصت فروش «${opportunity.title}» برنده شد 🎉`
            : `فرصت فروش «${opportunity.title}» از دست رفت`,
        notifyType: data.stage === 'won' ? 'success' : 'warning',
        actionUrl: '/crm',
      }).catch((err) => console.error('[CrmService] logBusinessEvent failed:', err))
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
