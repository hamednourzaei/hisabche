// ============================================
// backend/src/services/event.service.ts — Optimized v2.1
// FIXED: Parallel handlers, count: estimated, cache
// ============================================

import { supabase } from '../db'
import { CreateEventLog, EventTypeCode } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'
import crypto from 'crypto'
import { WORKER_ID } from './distributed-work'

type EventHandler = (event: {
  id: string
  eventType: string
  entityType: string
  entityId: string
  payload: Record<string, unknown>
  userId: string
}) => Promise<void>

// ✅ Column Selection Constants
const EVENT_PROCESS_COLUMNS =
  'id, event_type, entity_type, entity_id, payload, user_id, retry_count, max_retries'
const EVENT_MINIMAL_COLUMNS = 'id, event_type, entity_type, created_at'

/** How long a claimed event is held before another instance may recover it. */
const EVENT_LEASE_SECONDS = 5 * 60

interface ClaimedEvent {
  id: string
  event_type: string
  entity_type: string
  entity_id: string
  payload: Record<string, unknown>
  user_id: string
}

export class EventService {
  private handlers: Map<string, EventHandler[]> = new Map()
  private isProcessing = false
  private batchSize = 10

  // ─── Cache Keys ──────────────────────────────────────────────
  private getStatsCacheKey() {
    return `event:stats`
  }

  // ─── Register Handler ───────────────────────────────────────
  on(eventType: EventTypeCode | string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) || []
    existing.push(handler)
    this.handlers.set(eventType, existing)
  }

  // ─── Emit Event ─────────────────────────────────────────────
  async emit(data: CreateEventLog): Promise<string> {
    const idempotencyKey = crypto.randomBytes(16).toString('hex')

    const { data: event, error } = await supabase
      .from('event_log')
      .insert({
        event_type: data.eventType,
        entity_type: data.entityType,
        entity_id: data.entityId,
        payload: data.payload || {},
        user_id: data.userId,
        idempotency_key: idempotencyKey,
        // ⚠️ Explicit: the column's default is TRUE (base schema), which made
        // every event "processed" on insert — so neither the claim nor the
        // recovery pass ever saw one. An event is pending until processed.
        processed: false,
      })
      .select('id')
      .single()

    if (error) throw new DatabaseError('Failed to emit event', error)
    if (!event) throw new DatabaseError('Failed to create event')

    // ✅ Invalidate stats cache
    await memoryCache.invalidate(this.getStatsCacheKey())

    this.processEvent(event.id).catch((err) =>
      console.error(`Event processing error [${event.id}]:`, err),
    )
    return event.id
  }

  // ─── Process Event ──────────────────────────────────────────
  /**
   * Process one event — only if this instance can CLAIM it (docs/event-log-
   * claim-migration.sql): one statement with FOR UPDATE SKIP LOCKED, so the
   * emitting instance and any recovery pass on any instance never run the same
   * event's handlers at once. Before that migration the old path runs, which
   * is correct for ONE instance only.
   */
  private async processEvent(eventId: string): Promise<void> {
    const claimed = await this.claimEvents(1, eventId)
    if (claimed === null) return this.processEventSingleInstance(eventId)
    const event = claimed[0]
    // Already processed, out of retries, or held by another instance.
    if (!event) return
    await this.runClaimed(event)
  }

  /** `null` = the claim function is not installed yet. */
  private async claimEvents(limit: number, eventId?: string): Promise<ClaimedEvent[] | null> {
    const { data, error } = await supabase.rpc('claim_event_log', {
      p_worker: WORKER_ID,
      p_limit: limit,
      p_lease_seconds: EVENT_LEASE_SECONDS,
      p_event_id: eventId ?? null,
    })
    if (error && (error.code === 'PGRST202' || error.code === '42883')) return null
    if (error) throw new DatabaseError('Failed to claim events', error)
    return (data ?? []) as ClaimedEvent[]
  }

  /** Run a claimed event's handlers, then finish it — as its holder only. */
  private async runClaimed(event: ClaimedEvent): Promise<void> {
    const handlers = this.handlers.get(event.event_type) ?? []
    const results = await Promise.allSettled(
      handlers.map((handler) =>
        handler({
          id: event.id,
          eventType: event.event_type,
          entityType: event.entity_type,
          entityId: event.entity_id,
          payload: event.payload,
          userId: event.user_id,
        }),
      ),
    )
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason as Error)?.message || 'Unknown')

    if (errors.length === 0) {
      await supabase.rpc('complete_event_log', { p_id: event.id, p_worker: WORKER_ID })
    } else {
      await supabase.rpc('fail_event_log', {
        p_id: event.id,
        p_worker: WORKER_ID,
        p_error: `Handler failed: ${errors.join(', ')}`,
      })
    }
    await memoryCache.invalidate(this.getStatsCacheKey())
    if (errors.length > 0) throw new Error(errors.join(', '))
  }

  /** The pre-migration path: read, run, mark. Safe with one instance only. */
  private async processEventSingleInstance(eventId: string): Promise<void> {
    const { data: event, error } = await supabase
      .from('event_log')
      .select(EVENT_PROCESS_COLUMNS)
      .eq('id', eventId)
      .single()

    if (error || !event) return

    const handlers = this.handlers.get(event.event_type)
    if (!handlers || handlers.length === 0) {
      await supabase
        .from('event_log')
        .update({ processed: true, completed_at: new Date().toISOString() })
        .eq('id', eventId)
      await memoryCache.invalidate(this.getStatsCacheKey())
      return
    }

    // ✅ اجرای موازی handlers با Promise.allSettled
    const results = await Promise.allSettled(
      handlers.map((handler) =>
        handler({
          id: event.id,
          eventType: event.event_type,
          entityType: event.entity_type,
          entityId: event.entity_id,
          payload: event.payload,
          userId: event.user_id,
        }),
      ),
    )

    const hasError = results.some((result) => result.status === 'rejected')
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason)

    if (hasError) {
      const newRetryCount = (event.retry_count || 0) + 1
      const isMaxRetries = newRetryCount >= (event.max_retries || 3)

      if (isMaxRetries) {
        await supabase
          .from('event_log')
          .update({
            retry_count: newRetryCount,
            error_message: `Max retries exceeded: ${errors.map((e) => e?.message || 'Unknown').join(', ')}`,
          })
          .eq('id', eventId)
      } else {
        const nextRetry = new Date()
        nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, newRetryCount))
        await supabase
          .from('event_log')
          .update({
            retry_count: newRetryCount,
            next_retry_at: nextRetry.toISOString(),
            error_message: `Handler failed, will retry: ${errors.map((e) => e?.message || 'Unknown').join(', ')}`,
          })
          .eq('id', eventId)
      }
    } else {
      await supabase
        .from('event_log')
        .update({ processed: true, completed_at: new Date().toISOString() })
        .eq('id', eventId)
      await memoryCache.invalidate(this.getStatsCacheKey())
    }
  }

  // ─── Process Pending Events ────────────────────────────────
  async processPending(): Promise<{ processed: number; failed: number }> {
    if (this.isProcessing) return { processed: 0, failed: 0 }
    this.isProcessing = true
    let processed = 0,
      failed = 0

    try {
      // Claimed atomically across every instance; the old read-then-process
      // path below runs only until docs/event-log-claim-migration.sql is in.
      const claimed = await this.claimEvents(this.batchSize)
      if (claimed !== null) {
        const results = await Promise.allSettled(claimed.map((event) => this.runClaimed(event)))
        for (const result of results) {
          if (result.status === 'fulfilled') processed++
          else failed++
        }
        return { processed, failed }
      }

      // ✅ فقط ستون‌های ضروری
      const { data: events } = await supabase
        .from('event_log')
        .select(EVENT_MINIMAL_COLUMNS)
        .eq('processed', false)
        .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
        .order('created_at', { ascending: true })
        .limit(this.batchSize)

      if (events) {
        // ✅ پردازش موازی با Promise.allSettled
        const results = await Promise.allSettled(
          events.map((event) => this.processEventSingleInstance(event.id)),
        )

        for (const result of results) {
          if (result.status === 'fulfilled') processed++
          else failed++
        }
      }
    } catch (err) {
      console.error('Process pending events error:', err)
    } finally {
      this.isProcessing = false
    }

    // ✅ Invalidate stats cache
    await memoryCache.invalidate(this.getStatsCacheKey())

    return { processed, failed }
  }

  // ─── Seed Event Types ──────────────────────────────────────
  async seedEventTypes(): Promise<void> {
    const types = [
      'invoice.created',
      'invoice.paid',
      'invoice.cancelled',
      'stock.added',
      'stock.removed',
      'stock.transferred',
      'stock.low',
      'journal.created',
      'account.created',
      'employee.created',
      'employee.terminated',
      'leave.requested',
      'leave.approved',
      'project.created',
      'task.completed',
      'member.invited',
      'member.joined',
      'user.login',
      'user.logout',
      'data.exported',
    ]

    for (const type of types) {
      const { data: existing } = await supabase
        .from('event_types')
        .select('type')
        .eq('type', type)
        .single()

      if (!existing) {
        await supabase.from('event_types').insert({ type })
      }
    }
  }

  // ─── Get Stats — OPTIMIZED ──────────────────────────────────
  async getStats() {
    const cacheKey = this.getStatsCacheKey()

    // ✅ کش کردن آمار
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    // ✅ استفاده از count: "estimated"
    const [pendingResult, processedResult, totalResult] = await Promise.all([
      supabase
        .from('event_log')
        .select('id', { count: 'estimated', head: true })
        .eq('processed', false),
      supabase
        .from('event_log')
        .select('id', { count: 'estimated', head: true })
        .eq('processed', true),
      supabase.from('event_log').select('id', { count: 'estimated', head: true }),
    ])

    const result = {
      pending: pendingResult.count || 0,
      processed: processedResult.count || 0,
      total: totalResult.count || 0,
    }

    // ✅ ذخیره در کش با TTL ۳۰ ثانیه
    await memoryCache.set(cacheKey, result, 30)
    return result
  }

  // ─── Cleanup Processed Events ──────────────────────────────
  async cleanupProcessed(daysToKeep: number): Promise<{ deleted: number }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    // ✅ یک کوئری برای حذف مستقیم
    const { data: deleted, error } = await supabase
      .from('event_log')
      .delete()
      .eq('processed', true)
      .lt('completed_at', cutoffDate.toISOString())
      .select('id')

    if (error) throw new DatabaseError('Failed to cleanup events', error)

    // ✅ Invalidate stats cache
    await memoryCache.invalidate(this.getStatsCacheKey())

    return { deleted: deleted?.length || 0 }
  }

  // ─── Get Events by Entity ──────────────────────────────────
  async getEventsByEntity(entityType: string, entityId: string, limit = 50) {
    const cacheKey = `events:entity:${entityType}:${entityId}:${limit}`

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('event_log')
      .select(EVENT_MINIMAL_COLUMNS)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new DatabaseError('Failed to fetch entity events', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 120) // 2 minutes
    return result
  }

  // ─── Get Events by Type ────────────────────────────────────
  async getEventsByType(eventType: string, limit = 50) {
    const cacheKey = `events:type:${eventType}:${limit}`

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('event_log')
      .select(EVENT_MINIMAL_COLUMNS)
      .eq('event_type', eventType)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new DatabaseError('Failed to fetch type events', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  // ─── Invalidate Cache ──────────────────────────────────────
  async invalidateCache(): Promise<void> {
    await memoryCache.invalidate(this.getStatsCacheKey())
    await memoryCache.invalidate('events:entity:*')
    await memoryCache.invalidate('events:type:*')
  }
}

export const eventService = new EventService()
