// ============================================
// backend/src/services/event.service.ts — Optimized v2.0
// ============================================

import { supabase } from '../db'
import { CreateEventLog, EventTypeCode } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import crypto from 'crypto'

type EventHandler = (event: {
  id: string; eventType: string; entityType: string; entityId: string; payload: Record<string, unknown>; userId: string
}) => Promise<void>

// ✅ Column Selection Constants
const EVENT_PROCESS_COLUMNS = 'id, event_type, entity_type, entity_id, payload, user_id, retry_count, max_retries'

export class EventService {
  private handlers: Map<string, EventHandler[]> = new Map()
  private isProcessing = false
  private batchSize = 10

  on(eventType: EventTypeCode | string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) || []
    existing.push(handler)
    this.handlers.set(eventType, existing)
  }

  async emit(data: CreateEventLog): Promise<string> {
    const idempotencyKey = crypto.randomBytes(16).toString('hex')

    const { data: event, error } = await supabase
      .from('event_log')
      .insert({
        event_type: data.eventType, entity_type: data.entityType,
        entity_id: data.entityId, payload: data.payload || {},
        user_id: data.userId, idempotency_key: idempotencyKey,
      })
      .select('id')
      .single()

    if (error) throw new DatabaseError('Failed to emit event', error)
    if (!event) throw new DatabaseError('Failed to create event')

    this.processEvent(event.id).catch(err => console.error(`Event processing error [${event.id}]:`, err))
    return event.id
  }

  private async processEvent(eventId: string): Promise<void> {
    // ✅ فقط ستون‌های ضروری
    const { data: event, error } = await supabase
      .from('event_log')
      .select(EVENT_PROCESS_COLUMNS)
      .eq('id', eventId)
      .single()

    if (error || !event) return

    const handlers = this.handlers.get(event.event_type)
    if (!handlers || handlers.length === 0) {
      await supabase.from('event_log').update({ processed: true, completed_at: new Date().toISOString() }).eq('id', eventId)
      return
    }

    let hasError = false
    for (const handler of handlers) {
      try {
        await handler({
          id: event.id, eventType: event.event_type, entityType: event.entity_type,
          entityId: event.entity_id, payload: event.payload, userId: event.user_id,
        })
      } catch (err) {
        hasError = true
        console.error(`Handler error for event ${event.id}:`, err)
      }
    }

    if (hasError) {
      const newRetryCount = (event.retry_count || 0) + 1
      const isMaxRetries = newRetryCount >= (event.max_retries || 3)

      if (isMaxRetries) {
        await supabase.from('event_log').update({ retry_count: newRetryCount, error_message: 'Max retries exceeded' }).eq('id', eventId)
      } else {
        const nextRetry = new Date()
        nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, newRetryCount))
        await supabase.from('event_log').update({ retry_count: newRetryCount, next_retry_at: nextRetry.toISOString(), error_message: 'Handler failed, will retry' }).eq('id', eventId)
      }
    } else {
      await supabase.from('event_log').update({ processed: true, completed_at: new Date().toISOString() }).eq('id', eventId)
    }
  }

  async processPending(): Promise<{ processed: number; failed: number }> {
    if (this.isProcessing) return { processed: 0, failed: 0 }
    this.isProcessing = true
    let processed = 0, failed = 0

    try {
      const { data: events } = await supabase
        .from('event_log')
        .select('id')
        .eq('processed', false)
        .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
        .order('created_at', { ascending: true })
        .limit(this.batchSize)

      if (events) {
        for (const event of events) {
          try { await this.processEvent(event.id); processed++ } catch { failed++ }
        }
      }
    } catch (err) { console.error('Process pending events error:', err) }
    finally { this.isProcessing = false }

    return { processed, failed }
  }

  async seedEventTypes(): Promise<void> {
    const types = ['invoice.created','invoice.paid','invoice.cancelled','stock.added','stock.removed','stock.transferred','stock.low','journal.created','account.created','employee.created','employee.terminated','leave.requested','leave.approved','project.created','task.completed','member.invited','member.joined','user.login','user.logout','data.exported']

    for (const type of types) {
      const { data: existing } = await supabase.from('event_types').select('type').eq('type', type).single()
      if (!existing) await supabase.from('event_types').insert({ type })
    }
  }

  // ✅ Fix: 'id' instead of '*'
  async getStats() {
    const [pendingResult, processedResult, totalResult] = await Promise.all([
      supabase.from('event_log').select('id', { count: 'exact', head: true }).eq('processed', false),
      supabase.from('event_log').select('id', { count: 'exact', head: true }).eq('processed', true),
      supabase.from('event_log').select('id', { count: 'exact', head: true }),
    ])

    return {
      pending: pendingResult.count || 0,
      processed: processedResult.count || 0,
      total: totalResult.count || 0,
    }
  }

  async cleanupProcessed(daysToKeep: number): Promise<{ deleted: number }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const { data: toDelete } = await supabase
      .from('event_log').select('id').eq('processed', true).lt('completed_at', cutoffDate.toISOString())

    if (!toDelete || toDelete.length === 0) return { deleted: 0 }

    const ids = toDelete.map(e => e.id)
    const { error } = await supabase.from('event_log').delete().in('id', ids)
    if (error) throw new DatabaseError('Failed to cleanup events', error)
    return { deleted: ids.length }
  }
}

export const eventService = new EventService()