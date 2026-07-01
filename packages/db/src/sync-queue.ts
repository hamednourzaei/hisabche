// ============================================
// packages/db/src/sync-queue.ts
// ============================================

import { supabaseClient } from './supabase'

// تابع کمکی برای آپدیت store بدون import مستقیم
function getSyncStore() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const store = require('@hisabche/store')
    return store.useSyncStore
  } catch {
    return null
  }
}

export interface QueueItem {
  id: string
  userId: string
  entityType: string
  entityId?: string | null
  action: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: number
  retryCount: number
  maxRetries: number
  errorMessage?: string | null
  createdAt: string
  processedAt?: string | null
}

export class SyncQueue {
  private isProcessing = false
  private batchSize = 10
  private maxRetries = 3

  // ─── Store Helper ─────────────────────────────────────────
  private addPending() {
    const store = getSyncStore()
    if (store) store.getState().addPending()
  }

  private removePending() {
    const store = getSyncStore()
    if (store) store.getState().removePending()
  }

  private setSyncing(syncing: boolean) {
    const store = getSyncStore()
    if (store) store.getState().setSyncing(syncing)
  }

  private setLastSynced(ts: number) {
    const store = getSyncStore()
    if (store) store.getState().setLastSynced(ts)
  }

  // ─── Enqueue ──────────────────────────────────────────────
  async enqueue(
    userId: string,
    entityType: string,
    action: 'create' | 'update' | 'delete',
    payload: Record<string, unknown>,
    entityId?: string,
    priority = 5,
  ): Promise<string> {
    const { data, error } = await supabaseClient
      .from('sync_queue')
      .insert({
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId || null,
        action,
        payload,
        priority,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) {
      return this.localEnqueue(userId, entityType, action, payload, entityId, priority)
    }

    this.addPending()
    return data?.id || ''
  }

  // ─── Local Fallback ───────────────────────────────────────
  private localEnqueue(
    userId: string,
    entityType: string,
    action: 'create' | 'update' | 'delete',
    payload: Record<string, unknown>,
    entityId?: string,
    priority = 5,
  ): string {
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const items = this.getLocalQueue()
    items.push({
      id,
      userId,
      entityType,
      entityId: entityId || null,
      action,
      payload,
      status: 'pending',
      priority,
      retryCount: 0,
      maxRetries: this.maxRetries,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem('sync_queue', JSON.stringify(items))
    this.addPending()
    return id
  }

  private getLocalQueue(): QueueItem[] {
    try {
      const raw = localStorage.getItem('sync_queue')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  // ─── Process Queue ────────────────────────────────────────
  async processQueue(userId: string): Promise<{ processed: number; failed: number }> {
    if (this.isProcessing) return { processed: 0, failed: 0 }

    this.isProcessing = true
    this.setSyncing(true)

    let processed = 0
    let failed = 0

    try {
      const { data: onlineItems } = await supabaseClient
        .from('sync_queue')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(this.batchSize)

      if (onlineItems) {
        for (const item of onlineItems) {
          const success = await this.processItem(userId, item as QueueItem)
          success ? processed++ : failed++
          if (success) this.removePending()
        }
      }

      const localItems = this.getLocalQueue().filter(i => i.status === 'pending')
      if (localItems.length > 0) {
        for (const item of localItems.slice(0, this.batchSize)) {
          const success = await this.processLocalItem(item)
          success ? processed++ : failed++
          if (success) this.removePending()
        }
      }
    } catch (err) {
      console.error('Sync queue processing error:', err)
    } finally {
      this.isProcessing = false
      this.setSyncing(false)
      this.setLastSynced(Date.now())
    }

    return { processed, failed }
  }

  // ─── Process Single Item ──────────────────────────────────
  private async processItem(userId: string, item: QueueItem): Promise<boolean> {
    try {
      await supabaseClient
        .from('sync_queue')
        .update({ status: 'processing' })
        .eq('id', item.id)

      const result = await this.executeAction(item.entityType, item.action, item.payload)

      if (result) {
        await supabaseClient
          .from('sync_queue')
          .update({ status: 'completed', processed_at: new Date().toISOString() })
          .eq('id', item.id)
        return true
      }
      throw new Error('Action failed')
    } catch (err) {
      const newRetryCount = item.retryCount + 1
      await supabaseClient
        .from('sync_queue')
        .update({
          status: newRetryCount >= (item.maxRetries || this.maxRetries) ? 'failed' : 'pending',
          retry_count: newRetryCount,
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq('id', item.id)
      return false
    }
  }

  private async processLocalItem(item: QueueItem): Promise<boolean> {
    try {
      const result = await this.executeAction(item.entityType, item.action, item.payload)
      if (result) {
        this.removeLocalItem(item.id)
        return true
      }
      return false
    } catch (err) {
      item.retryCount++
      item.errorMessage = err instanceof Error ? err.message : String(err)
      if (item.retryCount >= item.maxRetries) item.status = 'failed'
      this.updateLocalItem(item)
      return false
    }
  }

  // ─── Execute Action ───────────────────────────────────────
  private async executeAction(
    table: string,
    action: 'create' | 'update' | 'delete',
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    const { id, ...data } = payload as Record<string, unknown>

    switch (action) {
      case 'create': return !(await supabaseClient.from(table).insert(data)).error
      case 'update': return !(await supabaseClient.from(table).update(data).eq('id', id as string)).error
      case 'delete': return !(await supabaseClient.from(table).delete().eq('id', id as string)).error
      default: return false
    }
  }

  // ─── Local Queue Helpers ──────────────────────────────────
  private removeLocalItem(id: string): void {
    const items = this.getLocalQueue().filter(i => i.id !== id)
    localStorage.setItem('sync_queue', JSON.stringify(items))
  }

  private updateLocalItem(item: QueueItem): void {
    const items = this.getLocalQueue().map(i => (i.id === item.id ? item : i))
    localStorage.setItem('sync_queue', JSON.stringify(items))
  }

  // ─── Get Stats ────────────────────────────────────────────
  async getStats(userId: string) {
    const { count: pending } = await supabaseClient
      .from('sync_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending')

    const { count: failed } = await supabaseClient
      .from('sync_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'failed')

    const localPending = this.getLocalQueue().filter(i => i.status === 'pending').length

    return {
      pendingOnline: pending || 0,
      pendingLocal: localPending,
      failed: failed || 0,
      total: (pending || 0) + localPending + (failed || 0),
    }
  }

  // ─── Retry Failed ─────────────────────────────────────────
  async retryFailed(userId: string): Promise<number> {
    const { data: items } = await supabaseClient
      .from('sync_queue')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'failed')

    if (!items) return 0

    await supabaseClient
      .from('sync_queue')
      .update({ status: 'pending', retry_count: 0, error_message: null })
      .eq('user_id', userId)
      .eq('status', 'failed')

    return items.length
  }
}

export const syncQueue = new SyncQueue()