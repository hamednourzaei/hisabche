// backend/src/services/activity.service.ts
// ============================================
// Activity Service — Entity Activity Feed v2.0
// با Cursor Pagination + Cache + Performance
// FIXED: Removed duplicate getEntitySummary implementation (TS2393)
// ============================================

import { supabase } from '../db'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface ActivityItemDto {
  id: string
  action: string
  title: string
  description?: string
  actor: string
  timestamp: string
  isRead: boolean
  importance: number
}

export interface EntitySummaryDto {
  label: string
  subtitle?: string | undefined
  amount?: number | undefined
  currency?: string | undefined
  status?: string | undefined
  statusLabel?: string | undefined
  statusColor?: string | undefined
  /**
   * فقط برای فاکتورها. فید فعالیت فروش و خرید را با هم نشان می‌دهد، پس بدون
   * این فیلد یک خرید دقیقاً شبیه یک فروش دیده می‌شود. کلاینت واژه‌ی درست
   * (خریدار / فروشنده) را از روی همین انتخاب می‌کند.
   */
  transactionType?: 'sale' | 'purchase' | undefined
  activityCount: number
  lastActivity: string
  route: string
}

export interface ActivityGroupDto {
  entityType: 'invoice' | 'customer' | 'product' | 'payment' | 'supplier' | 'inventory'
  entityId: string
  entitySummary: EntitySummaryDto
  activities: ActivityItemDto[]
  unreadCount: number
  latestAt: string
  hasUnread: boolean
  priority: 'critical' | 'high' | 'medium' | 'low'
}

export interface CreateActivityInput {
  actorId: string
  actorName: string
  // ✅ FIX: required — activities.workspace_id is NOT NULL in the DB
  workspaceId: string
  entityType: string
  entityId: string
  action: string
  title: string
  description?: string
  metadata?: Record<string, unknown>
  importance?: number
}

export interface PaginatedActivitiesResponse {
  data: ActivityGroupDto[]
  nextCursor: string | null
  hasMore: boolean
  total: number
}

// ─── Status Helpers ─────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  pending: 'text-amber-500 bg-amber-500/10',
  paid: 'text-emerald-500 bg-emerald-500/10',
  completed: 'text-emerald-500 bg-emerald-500/10',
  cancelled: 'text-red-500 bg-red-500/10',
  partial: 'text-blue-500 bg-blue-500/10',
  overdue: 'text-rose-500 bg-rose-500/10',
  draft: 'text-gray-500 bg-gray-500/10',
}

const statusLabels: Record<string, string> = {
  pending: 'در انتظار',
  paid: 'پرداخت شده',
  completed: 'تکمیل شده',
  cancelled: 'لغو شده',
  partial: 'بخشی پرداخت',
  overdue: 'سررسید شده',
  draft: 'پیش‌نویس',
}

/**
 * مسیر واقعیِ هر نوع موجودیت.
 *
 * قبلاً مسیر گروه با جمع‌بستنِ کورکورانه (`/${entityType}s/${id}`) ساخته
 * می‌شد؛ برای invoice و customer درست بود ولی برای بقیه به مسیرهای ناموجود
 * می‌رسید — `/products/:id` (مسیر واقعی `/warehouse/:id` است)،
 * `/inventorys/:id` (جمعِ غلط) و `/payments/:id` و `/suppliers/:id` که اصلاً
 * وجود ندارند. کلیک روی آن گروه‌ها کاربر را به صفحه‌ی ۴۰۴ می‌برد.
 */
const detailRouteByEntityType: Record<string, (id: string) => string> = {
  invoice: (id) => `/invoices/${id}`,
  customer: (id) => `/customers/${id}`,
  supplier: (id) => `/customers/${id}`,
  product: (id) => `/warehouse/${id}`,
  inventory: (id) => `/warehouse/${id}`,
  // پرداخت صفحه‌ی اختصاصی ندارد؛ در پروندهٔ مشتری دیده می‌شود.
  payment: () => `/accounting`,
}

function detailRoute(entityType: string, entityId: string): string {
  const build = detailRouteByEntityType[entityType]
  return build ? build(entityId) : `/activities`
}

// ─── Main Service ──────────────────────────────────────────────────────────

export class ActivityService {
  private cacheTTL = 60

  // ─── Create Activity ─────────────────────────────────────────────────────
  async createActivity(input: CreateActivityInput) {
    console.log('📝 [ActivityService] Creating activity:', {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      title: input.title,
      actorName: input.actorName,
      workspaceId: input.workspaceId,
    })

    if (!input.actorId) {
      throw new DatabaseError('actorId is required')
    }
    if (!input.entityType || !input.entityId) {
      throw new DatabaseError('entityType and entityId are required')
    }
    // ✅ FIX: fail fast with a clear message instead of hitting the
    // DB and getting a cryptic 23502 not-null violation.
    if (!input.workspaceId) {
      throw new DatabaseError('workspaceId is required')
    }

    const { data, error } = await supabase
      .from('activities')
      .insert({
        actor_id: input.actorId,
        actor_name: input.actorName || input.actorId.slice(0, 8),
        // ✅ FIX: previously missing — activities.workspace_id is NOT NULL
        workspace_id: input.workspaceId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        action: input.action,
        title: input.title,
        description: input.description || '',
        metadata: input.metadata || {},
        importance: input.importance || 0,
        is_read: false,
      })
      .select()
      .single()

    if (error) {
      console.error('❌ [ActivityService] Failed to create activity:', error)
      throw new DatabaseError('Failed to create activity', error)
    }

    console.log('✅ [ActivityService] Activity created:', data.id)
    await this.invalidateCache(input.actorId)

    return data
  }

  // ─── Get Activities ─────────────────────────────────────────────────────────────
  async getActivities(
    userId: string,
    filters?: {
      type?: string | undefined
      unread?: boolean | undefined
      search?: string | undefined
      limit?: number | undefined
      cursor?: string | undefined
      page?: number | undefined
    },
  ): Promise<PaginatedActivitiesResponse> {
    const cacheKey = `activities:${userId}:${JSON.stringify(filters)}`

    try {
      const cached = await memoryCache.get(cacheKey)
      if (cached) return cached as PaginatedActivitiesResponse
    } catch (cacheError) {
      // اگر کش مشکل داشت، ادامه بده
      console.warn('⚠️ Cache error, continuing without cache:', cacheError)
    }

    const limit = Math.min(filters?.limit || 20, 100)

    try {
      let query = supabase
        .from('activities')
        .select('*', { count: 'exact' })
        .eq('actor_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit + 1)

      // ✅ FIX: این endpoint فقط cursor را می‌شناخت، ولی UI صفحه‌محور است
      // («۱ / ۳») و page می‌فرستد — پس همیشه همان صفحه‌ی اول برمی‌گشت و
      // دکمه‌ی «صفحه بعد» کاری نمی‌کرد.
      const page = Math.max(1, Number(filters?.page) || 1)
      if (!filters?.cursor && page > 1) {
        const offset = (page - 1) * limit
        query = query.range(offset, offset + limit)
      }

      if (filters?.cursor) {
        query = query.lt('created_at', filters.cursor)
      }

      if (filters?.type) {
        query = query.eq('entity_type', filters.type)
      }

      if (filters?.unread) {
        query = query.eq('is_read', false)
      }

      if (filters?.search) {
        query = query.ilike('title', `%${filters.search}%`)
      }

      const { data: activities, error, count } = await query

      if (error) {
        console.error('❌ [ActivityService] Failed to fetch activities:', error)
        throw new DatabaseError('Failed to fetch activities', error)
      }

      // ✅ اگر داده‌ای وجود نداشت، خالی برگردان
      if (!activities || activities.length === 0) {
        return {
          data: [],
          nextCursor: null,
          hasMore: false,
          total: 0,
        }
      }

      const hasMore = activities.length > limit
      const items = hasMore ? activities.slice(0, limit) : activities
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.created_at : null

      const groups = new Map<string, any[]>()
      for (const activity of items) {
        const key = `${activity.entity_type}:${activity.entity_id}`
        if (!groups.has(key)) {
          groups.set(key, [])
        }
        groups.get(key)!.push(activity)
      }

      const result: ActivityGroupDto[] = []

      // ✅ FIX (کندی): getEntitySummary قبلاً داخل حلقه با await صدا زده
      // می‌شد، یعنی برای هر گروه یک رفت‌وبرگشت جداگانه و **ترتیبی** به
      // دیتابیس. با ۱۴ گروه این یعنی ۱۴ کوئری پشت‌سرهم و پاسخ ۳.۵ ثانیه‌ای.
      // حالا همه با هم موازی اجرا می‌شوند، پس زمان کل تقریباً برابر کندترین
      // کوئری است نه مجموع همه.
      const summaryByKey = new Map<string, Partial<EntitySummaryDto> | null>()
      await Promise.all(
        Array.from(groups.keys()).map(async (key) => {
          const [entityType, entityId] = key.split(':') as [string, string]
          try {
            summaryByKey.set(key, await this.getEntitySummary(entityType, entityId, userId))
          } catch (summaryError) {
            console.warn(`⚠️ Failed to get summary for ${key}`, summaryError)
            summaryByKey.set(key, null)
          }
        }),
      )

      for (const [key, groupItems] of groups) {
        const [entityType, entityId] = key.split(':') as [string, string]
        const sortedItems = groupItems.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        const latest = sortedItems[0]
        const metadata = latest.metadata || {}

        // خلاصه‌ها بالاتر به‌صورت موازی گرفته شده‌اند.
        const summary = summaryByKey.get(key) ?? null

        const unreadCount = sortedItems.filter((i) => !i.is_read).length

        result.push({
          entityType: entityType as ActivityGroupDto['entityType'],
          entityId,
          entitySummary: {
            label: metadata?.invoice_number
              ? `INV-${metadata.invoice_number}`
              : latest.title || 'بدون عنوان',
            subtitle: metadata?.customer_name || summary?.subtitle || undefined,
            amount: metadata?.total || summary?.amount || undefined,
            currency: metadata?.currency || summary?.currency || undefined,
            status: metadata?.status || summary?.status || undefined,
            statusLabel: metadata?.status ? statusLabels[metadata.status] : undefined,
            statusColor: metadata?.status ? statusColors[metadata.status] : undefined,
            // metadata.transaction_type را invoice.service هنگام ثبت فاکتور
            // می‌نویسد؛ اگر رویداد قدیمی بود، از خلاصه‌ی موجودیت می‌خوانیم.
            transactionType:
              entityType === 'invoice'
                ? ((metadata?.transaction_type as 'sale' | 'purchase' | undefined) ??
                  summary?.transactionType ??
                  'sale')
                : undefined,
            activityCount: sortedItems.length,
            lastActivity: latest.created_at,
            route: detailRoute(entityType, entityId),
          },
          activities: sortedItems.map((item) => ({
            id: item.id,
            action: item.action,
            title: item.title,
            description: item.description,
            actor: item.actor_name,
            timestamp: item.created_at,
            isRead: item.is_read,
            importance: item.importance || 0,
          })),
          unreadCount,
          latestAt: latest.created_at,
          hasUnread: unreadCount > 0,
          priority: this.getPriority(latest.importance || 0, unreadCount),
        })
      }

      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      result.sort((a, b) => {
        const aPriority = priorityOrder[a.priority] ?? 2
        const bPriority = priorityOrder[b.priority] ?? 2
        if (aPriority !== bPriority) return aPriority - bPriority
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1
        return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
      })

      const response: PaginatedActivitiesResponse = {
        data: result,
        nextCursor,
        hasMore,
        total: count || 0,
      }

      try {
        await memoryCache.set(cacheKey, response, this.cacheTTL)
      } catch (cacheError) {
        console.warn('⚠️ Failed to set cache:', cacheError)
      }

      return response
    } catch (error) {
      console.error('❌ [ActivityService] Unexpected error in getActivities:', error)
      // ✅ به جای throw، خالی برگردان
      return {
        data: [],
        nextCursor: null,
        hasMore: false,
        total: 0,
      }
    }
  }

  // ─── Get Entity Summary ──────────────────────────────────────────────────
  // NOTE: Only one implementation now (previously duplicated — TS2393).
  // This is the more complete version, covering invoice/customer/product/payment.
  private async getEntitySummary(
    entityType: string,
    entityId: string,
    userId: string,
  ): Promise<Partial<EntitySummaryDto> | null> {
    try {
      // ✅ اگر entityType یا entityId خالی بود، null برگردان
      if (!entityType || !entityId) {
        return null
      }

      if (entityType === 'invoice') {
        try {
          const { data, error } = await supabase
            .from('invoices')
            .select(
              `
              id,
              invoice_number,
              total,
              currency,
              status,
              type,
              customer:customers!fk_invoices_customer (
                full_name
              )
            `,
            )
            .eq('id', entityId)
            .eq('user_id', userId)
            .maybeSingle()

          if (error || !data) {
            console.warn(`⚠️ Invoice not found: ${entityId}`, error?.message)
            return null
          }

          const customer = Array.isArray(data.customer) ? data.customer[0] : data.customer

          return {
            label: `INV-${data.invoice_number || entityId.slice(0, 8)}`,
            subtitle: customer?.full_name || undefined,
            amount: data.total || undefined,
            currency: data.currency || undefined,
            status: data.status || undefined,
            // فاکتورهای قدیمیِ بدون type فروش‌اند — همان قراردادی که
            // invoice.service و analytics.service استفاده می‌کنند.
            transactionType: (data.type as 'sale' | 'purchase' | null) ?? 'sale',
          }
        } catch (err) {
          console.warn(`⚠️ Failed to fetch invoice ${entityId}:`, err)
          return null
        }
      }

      if (entityType === 'customer') {
        try {
          const { data, error } = await supabase
            .from('customers')
            .select('full_name, phone, email, opening_balance')
            .eq('id', entityId)
            .eq('user_id', userId)
            .maybeSingle()

          if (error || !data) {
            console.warn(`⚠️ Customer not found: ${entityId}`, error?.message)
            return null
          }

          return {
            label: data.full_name || entityId.slice(0, 8),
            subtitle: data.phone || data.email || undefined,
            amount: data.opening_balance || undefined,
            currency: 'AFN',
          }
        } catch (err) {
          console.warn(`⚠️ Failed to fetch customer ${entityId}:`, err)
          return null
        }
      }

      if (entityType === 'product') {
        try {
          const { data, error } = await supabase
            .from('products')
            .select('name, sku, quantity, sell_price, currency')
            .eq('id', entityId)
            .eq('user_id', userId)
            .maybeSingle()

          if (error || !data) {
            console.warn(`⚠️ Product not found: ${entityId}`, error?.message)
            return null
          }

          return {
            label: data.name,
            subtitle: data.sku || `موجودی: ${data.quantity}`,
            amount: data.sell_price,
            currency: data.currency || 'AFN',
          }
        } catch (err) {
          console.warn(`⚠️ Failed to fetch product ${entityId}:`, err)
          return null
        }
      }

      if (entityType === 'payment') {
        try {
          const { data, error } = await supabase
            .from('transactions')
            .select('amount, currency, description, reference')
            .eq('id', entityId)
            .eq('user_id', userId)
            .maybeSingle()

          if (error || !data) {
            console.warn(`⚠️ Payment not found: ${entityId}`, error?.message)
            return null
          }

          return {
            label: data.reference || 'پرداخت',
            subtitle: data.description,
            amount: data.amount,
            currency: data.currency || 'AFN',
          }
        } catch (err) {
          console.warn(`⚠️ Failed to fetch payment ${entityId}:`, err)
          return null
        }
      }

      // ✅ Default fallback برای سایر entity types — نگاشت واقعی مسیر
      // (قبلاً با pluralize کورکورانه `/${entityType}s/${id}` می‌ساخت که
      // برای employee به `/employees/:id` (مسیر ناموجود) می‌رسید)
      const routeMap: Record<string, string> = {
        employee: `/human-resources/${entityId}`,
        project: `/projects/${entityId}`,
        purchase_order: `/purchasing`,
        work_order: `/manufacturing`,
        workflow: `/approvals`,
        workflow_instance: `/approvals`,
        opportunity: `/crm`,
        interaction: `/crm`,
        billing: `/billing`,
      }

      return {
        label: entityType,
        subtitle: entityId,
        activityCount: 0,
        lastActivity: new Date().toISOString(),
        route: routeMap[entityType] || `/activities`,
      }
    } catch (error) {
      console.error(`❌ Failed to get entity summary for ${entityType}:${entityId}`, error)
      return null
    }
  }

  // ─── Get Priority ────────────────────────────────────────────────────────
  private getPriority(importance: number, unreadCount: number): ActivityGroupDto['priority'] {
    if (importance >= 4 && unreadCount > 0) return 'critical'
    if (importance >= 3 || unreadCount > 0) return 'high'
    if (importance >= 2) return 'medium'
    return 'low'
  }

  // ─── Mark as Read ────────────────────────────────────────────────────────
  async markAsRead(userId: string, ids: string[]) {
    console.log('📝 [ActivityService] Marking as read:', ids)

    if (!ids || ids.length === 0) {
      console.warn('⚠️ [ActivityService] No ids provided for markAsRead')
      return
    }

    const { error } = await supabase
      .from('activities')
      .update({ is_read: true })
      .in('id', ids)
      .eq('actor_id', userId)

    if (error) {
      console.error('❌ [ActivityService] Failed to mark as read:', error)
      throw new DatabaseError('Failed to mark activities as read', error)
    }

    console.log(`✅ [ActivityService] Marked ${ids.length} activities as read`)
    await this.invalidateCache(userId)
  }

  // ─── Mark All as Read ────────────────────────────────────────────────────
  async markAllAsRead(userId: string) {
    console.log('📝 [ActivityService] Marking all as read for user:', userId)

    const { error } = await supabase
      .from('activities')
      .update({ is_read: true })
      .eq('actor_id', userId)
      .eq('is_read', false)

    if (error) {
      console.error('❌ [ActivityService] Failed to mark all as read:', error)
      throw new DatabaseError('Failed to mark all activities as read', error)
    }

    console.log(`✅ [ActivityService] Marked all activities as read for user: ${userId}`)
    await this.invalidateCache(userId)
  }

  // ─── Get Unread Count ────────────────────────────────────────────────────
  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = `activities:unread:${userId}`
    const cached = await memoryCache.get(cacheKey)
    if (cached !== null) return cached as number

    const { count, error } = await supabase
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('actor_id', userId)
      .eq('is_read', false)

    if (error) {
      console.error('❌ [ActivityService] Failed to get unread count:', error)
      throw new DatabaseError('Failed to get unread count', error)
    }

    const result = count || 0
    await memoryCache.set(cacheKey, result, 10)
    return result
  }

  // ─── Delete Activity ─────────────────────────────────────────────────────
  async deleteActivity(userId: string, id: string) {
    console.log('📝 [ActivityService] Deleting activity:', id)

    const { error } = await supabase.from('activities').delete().eq('id', id).eq('actor_id', userId)

    if (error) {
      console.error('❌ [ActivityService] Failed to delete activity:', error)
      throw new DatabaseError('Failed to delete activity', error)
    }

    console.log(`✅ [ActivityService] Deleted activity: ${id}`)
    await this.invalidateCache(userId)
  }

  // ─── Invalidate Cache ────────────────────────────────────────────────────
  private async invalidateCache(userId: string) {
    await memoryCache.invalidate(`activities:${userId}:*`)
    await memoryCache.invalidate(`activities:unread:${userId}`)
  }
}

export default ActivityService
