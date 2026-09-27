// backend/src/services/activity.service.ts
// ============================================
// Activity Service — Entity Activity Feed v2.0
// با Cursor Pagination + Cache + Performance
// FIXED: Removed duplicate getEntitySummary implementation (TS2393)
// ============================================

import { supabase } from '../db'
import type { TenancyContext } from './tenancy.service'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'

// ─── DTOs ────────────────────────────────────────────────────────────────────

/**
 * The four role words the CLIENT vocabulary uses — the same ones
 * `workspace_members.role` is written with by `workspace.service.ts` and the
 * same ones `ROLE_TONE` in `packages/ui` colours.
 *
 * `null` is a real answer, not a missing one: see `resolveActorRoles`.
 */
export type ActorRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface ActivityItemDto {
  id: string
  action: string
  title: string
  description?: string
  actor: string
  /**
   * The role the actor holds in the workspace that owns this activity, or
   * `null` when they hold none.
   *
   * ⚠️ `null` MEANS UNKNOWN AND MUST STAY UNKNOWN. An actor who has left the
   * workspace, whose access was revoked, or whose row predates memberships has
   * no role to report. Defaulting such a row to `member` or `viewer` would put
   * a false statement about a real person on the screen, so it is not done
   * here and must not be done in the client either.
   */
  actorRole?: ActorRole | null
}

/**
 * What the feed and an entity's timeline read (27 Sep 2026) — every column
 * they render, and NOT `entity_snapshot`: a JSON copy of the whole record at
 * the time, never shown in a list, and it made each page of `select('*')` many
 * times larger than the text on screen.
 */
export const ACTIVITY_COLUMNS =
  'id, workspace_id, actor_id, actor_name, entity_type, entity_id, action, title, description, reference_number, icon, metadata, importance, is_read, is_pinned, is_archived, created_at, updated_at'

/** Entity types whose summary is read from their table (batched). */
const BATCHED_ENTITIES = new Set(['invoice', 'customer', 'product', 'payment'])

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

// ─── Actor Roles ────────────────────────────────────────────────────────────

/**
 * Stored role values, normalised to the client vocabulary the UI colours.
 *
 * TWO VOCABULARIES WRITE TO ONE COLUMN — see the long note in
 * `tenancy.service.ts`. `workspace.service.ts` writes
 * `owner | admin | member | viewer`; parts of the server speak
 * `owner | manager | seller`. Both are TRANSLATED here, because translating a
 * value that was actually stored is not a guess.
 *
 * Anything else returns `undefined` and the caller reports NO ROLE. That is
 * deliberate: degrading an unrecognised value to the lowest role is the right
 * instinct for an authorization decision (fail closed) and the wrong one for a
 * LABEL, which would then assert something false about a person.
 */
const STORED_ROLE_TO_ACTOR_ROLE: Record<string, ActorRole> = {
  owner: 'owner',
  admin: 'admin',
  member: 'member',
  viewer: 'viewer',
  manager: 'admin',
  seller: 'member',
}

export function toActorRole(stored: unknown): ActorRole | null {
  if (typeof stored !== 'string') return null
  return STORED_ROLE_TO_ACTOR_ROLE[stored] ?? null
}

/**
 * The role each of these actors currently holds in ONE workspace.
 *
 * ⚠️ `workspace_id` IS THE FILTER. `user_id` narrows the lookup to the actors
 * we are about to render and is never the security boundary — the same rule
 * the rest of this file follows. Without the workspace predicate this would
 * return a person's role in somebody else's business.
 *
 * Membership is judged exactly as `tenancy.service.ts` judges it: `has_access`
 * true and not suspended. An actor missing from the result has no CURRENT
 * membership, and the caller renders «unknown» rather than inventing one.
 */
async function resolveActorRoles(
  workspaceId: string,
  actorIds: readonly string[],
): Promise<Map<string, ActorRole>> {
  const roles = new Map<string, ActorRole>()
  const ids = Array.from(new Set(actorIds.filter((id): id is string => Boolean(id))))
  if (!workspaceId || ids.length === 0) return roles

  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId)
    .in('user_id', ids)
    .eq('has_access', true)
    .is('suspended_at', null)

  if (error) {
    // A failed role lookup must not take the feed down. Every row then renders
    // as «unknown», which is what an unanswered question looks like.
    console.warn('⚠️ [ActivityService] Failed to resolve actor roles:', error.message)
    return roles
  }

  for (const row of data ?? []) {
    const role = toActorRole((row as { role?: unknown }).role)
    const userId = (row as { user_id?: unknown }).user_id
    if (role && typeof userId === 'string') roles.set(userId, role)
  }

  return roles
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
  /**
   * The feed itself stays keyed to `actor_id` — it is "what I did", and
   * `activities` is not one of the four shared entities.
   *
   * The ENTITY SUMMARIES attached to each row are shared business data, so
   * they are resolved against the authorized workspace. Those ids come from
   * the caller's own activity rows and so are already theirs, but a summary
   * lookup that trusts an id because of where it came from is one refactor
   * away from being an IDOR. It is filtered explicitly.
   */
  async getActivities(
    ctx: TenancyContext,
    filters?: {
      type?: string | undefined
      unread?: boolean | undefined
      search?: string | undefined
      limit?: number | undefined
      cursor?: string | undefined
      page?: number | undefined
    },
  ): Promise<PaginatedActivitiesResponse> {
    const { workspaceId, userId } = ctx
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
        .select(ACTIVITY_COLUMNS, { count: 'exact' })
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

      // Who performed each event, as a role. One query for the whole page,
      // scoped to the authorized workspace — see `resolveActorRoles`.
      const actorRoles = await resolveActorRoles(
        workspaceId,
        items.map((item) => item.actor_id as string),
      )

      // ✅ FIX (کندی): getEntitySummary قبلاً داخل حلقه با await صدا زده
      // می‌شد، یعنی برای هر گروه یک رفت‌وبرگشت جداگانه و **ترتیبی** به
      // دیتابیس. با ۱۴ گروه این یعنی ۱۴ کوئری پشت‌سرهم و پاسخ ۳.۵ ثانیه‌ای.
      // حالا همه با هم موازی اجرا می‌شوند، پس زمان کل تقریباً برابر کندترین
      // کوئری است نه مجموع همه.
      // ⚠️ ONE QUERY PER TYPE, NOT PER ROW (27 Sep 2026). The parallel
      // version still sent one query per group — thirty at once on a busy
      // page, queued on the connection pool: /api/v1/activities took 4.6 s in
      // production. `getEntitySummaries` reads each type with one `in()`.
      const summaryByKey = await this.getEntitySummaries(
        workspaceId,
        Array.from(groups.keys()).map((key) => key.split(':') as [string, string]),
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
            // `null`, never a default role — see `ActivityItemDto.actorRole`.
            actorRole: actorRoles.get(item.actor_id) ?? null,
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
      // ⚠️ THROWN, NOT AN EMPTY FEED (27 Sep 2026, CLAUDE.md §7.3). This
      // returned `{ data: [], total: 0 }` with a 200, which the route-level
      // cache then kept: a broken query read as «nothing happened» for
      // everyone until it expired.
      console.error('❌ [ActivityService] Unexpected error in getActivities:', error)
      throw error
    }
  }

  /**
   * Everything that happened to ONE business object.
   *
   * ---------------------------------------------------------------------------
   * NOT `getActivities` WITH A FILTER
   *
   * `getActivities` is a PERSONAL feed: it filters by `actor_id`, because "my
   * notifications" means the things I did or that were addressed to me. Reusing
   * it here would show an invoice's history as only the parts THIS user
   * performed — so a manager opening an invoice a seller raised would see an
   * empty timeline and conclude nothing had happened to it.
   *
   * An entity's history is a workspace fact, not a personal one. So the filter
   * is `workspace_id` + the entity, and the actor is a column you read rather
   * than a filter you apply. That is the same rule as everywhere else:
   * `workspace_id` is the boundary, `user_id` records who acted.
   */
  async getEntityActivities(
    ctx: TenancyContext,
    entityType: string,
    entityId: string,
    options: { limit?: number | undefined; cursor?: string | undefined } = {},
  ): Promise<{ activities: ActivityItemDto[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = Math.min(options.limit || 20, 100)

    let query = supabase
      .from('activities')
      .select(ACTIVITY_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      // One extra row, purely to answer "is there another page" without a
      // second COUNT query over a table that only grows.
      .limit(limit + 1)

    if (options.cursor) query = query.lt('created_at', options.cursor)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to fetch entity activities', error)

    const rows = data ?? []
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows

    return {
      activities: page as unknown as ActivityItemDto[],
      nextCursor: hasMore ? ((page[page.length - 1] as any)?.created_at ?? null) : null,
      hasMore,
    }
  }

  // ─── Entity summaries, batched ───────────────────────────────────────────
  /**
   * Summaries for many (type, id) pairs: one query per type, in parallel.
   *
   * ⚠️ PAYMENTS ARE READ FROM `payments` (27 Sep 2026). This read
   * `transactions`, but payments have lived in `payments` since the AR/AP
   * migration, so every payment in the activity feed showed no amount and
   * logged «Payment not found».
   *
   * A missing row is a document deleted since its activity was written —
   * normal, and silent. A failed query is logged once per type and those
   * cards show without a summary; the feed itself still loads.
   */
  private async getEntitySummaries(
    workspaceId: string,
    pairs: Array<[string, string]>,
  ): Promise<Map<string, Partial<EntitySummaryDto> | null>> {
    const out = new Map<string, Partial<EntitySummaryDto> | null>()
    const idsOf = (type: string) => [
      ...new Set(pairs.filter(([t, id]) => t === type && id).map(([, id]) => id)),
    ]

    const read = async <T>(
      type: string,
      table: string,
      columns: string,
      toSummary: (row: T) => Partial<EntitySummaryDto>,
    ) => {
      const ids = idsOf(type)
      if (ids.length === 0) return
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq('workspace_id', workspaceId)
        .in('id', ids)
      if (error) {
        console.warn(`⚠️ [ActivityService] ${type} summaries unavailable:`, error.message)
        return
      }
      for (const row of (data ?? []) as unknown as Array<T & { id: string }>) {
        out.set(`${type}:${row.id}`, toSummary(row))
      }
    }

    await Promise.all([
      read<{
        invoice_number: string | null
        total: number | null
        currency: string | null
        status: string | null
        type: string | null
        customer: { full_name: string | null } | Array<{ full_name: string | null }> | null
      }>(
        'invoice',
        'invoices',
        'id, invoice_number, total, currency, status, type, customer:customers!fk_invoices_customer (full_name)',
        (data) => {
          const customer = Array.isArray(data.customer) ? data.customer[0] : data.customer
          return {
            label: `INV-${data.invoice_number || ''}`,
            subtitle: customer?.full_name || undefined,
            amount: data.total || undefined,
            currency: data.currency || undefined,
            status: data.status || undefined,
            // فاکتورهای قدیمیِ بدون type فروش‌اند.
            transactionType: (data.type as 'sale' | 'purchase' | null) ?? 'sale',
          }
        },
      ),
      read<{
        full_name: string | null
        phone: string | null
        email: string | null
        opening_balance: number | null
      }>('customer', 'customers', 'id, full_name, phone, email, opening_balance', (data) => ({
        label: data.full_name || '',
        subtitle: data.phone || data.email || undefined,
        amount: data.opening_balance || undefined,
        currency: 'AFN',
      })),
      read<{
        name: string
        sku: string | null
        quantity: number | null
        sell_price: number | null
        currency: string | null
      }>('product', 'products', 'id, name, sku, quantity, sell_price, currency', (data) => ({
        label: data.name,
        subtitle: data.sku || `موجودی: ${data.quantity ?? 0}`,
        amount: data.sell_price ?? undefined,
        currency: data.currency || 'AFN',
      })),
      read<{
        amount: number | null
        currency: string | null
        reference: string | null
        notes: string | null
      }>('payment', 'payments', 'id, amount, currency, reference, notes', (data) => ({
        label: data.reference || 'پرداخت',
        subtitle: data.notes || undefined,
        amount: data.amount ?? undefined,
        currency: data.currency || 'AFN',
      })),
    ])

    // Other types carry no row to read — their summary is the route map.
    for (const [type, id] of pairs) {
      const key = `${type}:${id}`
      if (out.has(key)) continue
      out.set(
        key,
        BATCHED_ENTITIES.has(type) ? null : await this.getEntitySummary(type, id, workspaceId),
      )
    }
    return out
  }

  // ─── Get Entity Summary ──────────────────────────────────────────────────
  // NOTE: Only one implementation now (previously duplicated — TS2393).
  // This is the more complete version, covering invoice/customer/product/payment.
  /**
   * A 360 summary of one business object.
   *
   * ⚠️ Was `private` while four client hooks called an endpoint that would have
   * exposed it — so the screens showed nothing and the requests 404'd. The
   * computation was always here; only the door was missing.
   *
   * `workspaceId` is a parameter rather than read from a context because the
   * activity feed calls it in a loop for ids that came from its own rows. It
   * is filtered explicitly every time: a summary lookup that trusts an id
   * because of where it came from is one refactor away from being an IDOR.
   */
  async getEntitySummary(
    entityType: string,
    entityId: string,
    workspaceId: string,
  ): Promise<Partial<EntitySummaryDto> | null> {
    try {
      // ✅ اگر entityType یا entityId خالی بود، null برگردان
      if (!entityType || !entityId) {
        return null
      }

      // Invoices, customers, products and payments: the same batched read the
      // feed uses, for one id.
      if (BATCHED_ENTITIES.has(entityType)) {
        const summaries = await this.getEntitySummaries(workspaceId, [[entityType, entityId]])
        return summaries.get(`${entityType}:${entityId}`) ?? null
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
  /**
   * The five tab badges of /activities, EXACT.
   *
   * ⚠️ The page counted the groups it had LOADED — the first page — so «همه
   * (12)» meant «12 on screen», not the account. Each count here is a
   * `head: true` exact count (راهنمای سشن §۷٫۴), no rows transferred. They
   * count events, the same unit as the unread badge.
   */
  async getFilterCounts(userId: string): Promise<{
    all: number
    unread: number
    invoices: number
    payments: number
    customers: number
  }> {
    const cacheKey = `activities:counts:${userId}`
    const cached = await memoryCache.get(cacheKey)
    if (cached !== null) return cached as Awaited<ReturnType<ActivityService['getFilterCounts']>>

    const base = () =>
      supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('actor_id', userId)
    const results = await Promise.all([
      base(),
      base().eq('is_read', false),
      base().eq('entity_type', 'invoice'),
      base().eq('entity_type', 'payment'),
      base().eq('entity_type', 'customer'),
    ])
    const failed = results.find((r) => r.error)
    if (failed?.error) throw new DatabaseError('Failed to count activities', failed.error)
    const [all, unread, invoices, payments, customers] = results.map((r) => r.count ?? 0) as [
      number,
      number,
      number,
      number,
      number,
    ]
    const result = { all, unread, invoices, payments, customers }
    await memoryCache.set(cacheKey, result, 10)
    return result
  }

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
    await memoryCache.invalidate(`activities:counts:${userId}`)
  }
}

export default ActivityService
