// ============================================
// backend/src/services/invoice.service.ts
// Hisabche v3.2 — با JOIN customers + Notification + Activity (full)
// FIXED (v3.2): workspaceId به createActivity اضافه شد (خطای build:
// Property 'workspaceId' is missing in type 'CreateActivityInput').
// از تابع resolveWorkspaceId موجود در همین کلاس استفاده شده تا با
// همان منطقی که برای notification استفاده می‌شود هماهنگ باشد.
//
// ✅ RESOLVED: the duplicate activity noted here is fixed. invoice.routes.ts
// no longer records its own activity for invoice creation — this service is
// the single owner, because it is the only layer that knows the resolved
// party name, the workspace id and the transaction type (sale | purchase).
// ============================================

import { supabase } from '../db'
import { WorkflowService } from '../services/workflow.service'
import { NotificationService } from '../services/notification.service'
import { CreateInvoice, UpdateInvoice, InvoiceFilters } from '@hisabche/validation'
import { DatabaseError, NotFoundError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'
import { ActivityService } from './activity.service'

// ============================================
// ✅ OPTIMIZED: فقط ستون‌های مورد نیاز
// ============================================

const INVOICE_LIST_COLUMNS = `
  id, 
  invoice_number, 
  type, 
  customer_id, 
  supplier_id,
  date, 
  due_date, 
  subtotal, 
  discount_total, 
  tax_total,
  total, 
  paid_amount, 
  currency, 
  payment_method, 
  status, 
  created_at,
  updated_at
`

// Nested details are selected with the item, never in a follow-up query —
// N items must not become N+1 round-trips. Ordered so the invoice renders the
// components in the order the user typed them.
const INVOICE_ITEM_DETAILS_COLUMNS = `
  invoice_item_details (
    id, title, quantity, amount, unit, unit_label, weight_grams, sort_order
  )
`

/** Item columns that `docs/unified-sale-purchase-migration.sql` adds. */
const INVOICE_ITEM_UNIT_COLUMNS = 'unit, unit_label, weight_grams,'

/**
 * Does this error mean "the schema does not have that yet" rather than "the
 * query is wrong"?
 *
 *   42703   — undefined_column (Postgres)
 *   PGRST200 — PostgREST could not find the relationship between two tables
 *
 * Both are what a database that has not run a migration returns for a column
 * or embedded table the code already knows about.
 */
function isMissingSchemaError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42703' || error.code === 'PGRST200') return true
  return /does not exist|could not find|schema cache/i.test(error.message ?? '')
}

/**
 * Which optional schema pieces this database actually has.
 *
 * Probed once per process rather than per request: without this, every read
 * would pay a failed round-trip before falling back. Reset is deliberately not
 * exposed — a migration lands with a deploy, and a deploy restarts the process.
 */
const schemaSupport = {
  publicToken: true,
  itemDetails: true,
  itemUnits: true,
  /**
   * Whether the customer embed can name its foreign key explicitly.
   * `customers!fk_invoices_customer` is faster to resolve but depends on the
   * constraint being named exactly that; falling back to the inferred
   * relationship keeps the read working if it is not.
   */
  namedCustomerFk: true,
}

// ============================================

export class InvoiceService {
  private workflowService: WorkflowService
  private notificationService: NotificationService
  private activityService: ActivityService

  constructor() {
    this.workflowService = new WorkflowService()
    this.notificationService = new NotificationService()
    this.activityService = new ActivityService()
  }

  // ─── ✅ تابع دریافت نام نمایشی کاربر ──────────────────────────────────
  private async getUserDisplayName(userId: string): Promise<string> {
    try {
      // 1. از جدول profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, display_name')
        .eq('id', userId)
        .maybeSingle()

      if (!profileError) {
        if (profile?.full_name) return profile.full_name
        if (profile?.display_name) return profile.display_name
      }

      // 2. از جدول users (اگر وجود دارد)
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('email, raw_user_meta_data')
        .eq('id', userId)
        .maybeSingle()

      if (!userError && user) {
        if (user.raw_user_meta_data?.full_name) {
          return user.raw_user_meta_data.full_name
        }
        if (user.email) {
          return user.email.split('@')[0] || user.email
        }
      }

      // 3. Fallback: 8 کاراکتر اول userId
      return userId.slice(0, 8)
    } catch (error) {
      console.error(`[InvoiceService] Error getting user name for ${userId}:`, error)
      return userId.slice(0, 8)
    }
  }

  // ─── ✅ دریافت workspaceId ──────────────────────────────────────────────
  private async resolveWorkspaceId(userId: string): Promise<string> {
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (membershipError) {
      console.error(
        `[InvoiceService] Failed to fetch workspace membership for user ${userId}:`,
        membershipError,
      )
    }

    return membership?.workspace_id ?? userId
  }

  // ─── List Invoices — با JOIN customers ───
  async list(userId: string, filters: InvoiceFilters) {
    const {
      search,
      type,
      status,
      customerId,
      supplierId,
      currency,
      dateFrom,
      dateTo,
      minTotal,
      maxTotal,
      limit = 20,
      cursor,
      page = 1,
      sortBy = 'created_at',
      sortDirection = 'desc',
    } = filters

    const cacheKey = `invoices:${userId}:${JSON.stringify(filters)}`
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const maxLimit = Math.min(limit, 100)
    const fetchLimit = maxLimit + 1

    let query = supabase
      .from('invoices')
      .select(
        `
        id,
        invoice_number,
        type,
        customer_id,
        supplier_id,
        date,
        due_date,
        subtotal,
        discount_total,
        tax_total,
        total,
        paid_amount,
        currency,
        payment_method,
        status,
        created_at,
        updated_at,
        public_token,
        customer:customers!fk_invoices_customer (
          id,
          full_name,
          phone,
          email
        ),
        invoice_items ( quantity )
      `,
      )
      .eq('user_id', userId)
      .order(sortBy, { ascending: sortDirection === 'asc' })

    // ✅ FIX: رابط کاربری فاکتورها صفحه‌محور است (قبلی/بعدی + «۱ / ۳») و
    // پارامتر page را می‌فرستد، ولی این سرویس فقط cursor را می‌شناخت و page
    // را کاملاً نادیده می‌گرفت — یعنی هر بار همان صفحه‌ی اول برمی‌گشت و
    // دکمه‌های صفحه‌بندی هیچ کاری نمی‌کردند. حالا وقتی cursor نباشد از
    // offset استفاده می‌شود. (cursor برای مصرف‌کننده‌های infinite-scroll
    // دست‌نخورده باقی می‌ماند.)
    if (!cursor && page > 1) {
      const offset = (page - 1) * maxLimit
      query = query.range(offset, offset + maxLimit)
    } else {
      query = query.limit(fetchLimit)
    }

    if (search) query = query.ilike('invoice_number', `%${search}%`)
    if (type) query = query.eq('type', type)
    if (status) query = query.eq('status', status)
    if (customerId) query = query.eq('customer_id', customerId)
    if (supplierId) query = query.eq('supplier_id', supplierId)
    if (currency) query = query.eq('currency', currency)
    if (dateFrom) query = query.gte('date', dateFrom)
    if (dateTo) query = query.lte('date', dateTo)
    if (minTotal !== undefined) query = query.gte('total', minTotal)
    if (maxTotal !== undefined) query = query.lte('total', maxTotal)

    if (cursor) {
      if (sortDirection === 'desc') {
        query = query.lt(sortBy, cursor)
      } else {
        query = query.gt(sortBy, cursor)
      }
    }

    // ✅ FIX: کوئری شمارش هیچ‌کدام از فیلترها را اعمال نمی‌کرد و همیشه کل
    // فاکتورهای کاربر را می‌شمرد؛ در نتیجه با فیلتر/جستجو تعداد صفحات
    // («۱ / ۳») غلط می‌شد و کاربر به صفحه‌هایی می‌رفت که خالی بودند.
    // وقتی فیلتری فعال است از شمارش دقیق استفاده می‌شود چون تخمین
    // (estimated) برای زیرمجموعه‌های فیلترشده قابل اتکا نیست.
    const hasFilters =
      Boolean(
        search || type || status || customerId || supplierId || currency || dateFrom || dateTo,
      ) ||
      minTotal !== undefined ||
      maxTotal !== undefined

    let countQuery = supabase
      .from('invoices')
      .select('id', { count: hasFilters ? 'exact' : 'estimated', head: true })
      .eq('user_id', userId)

    if (search) countQuery = countQuery.ilike('invoice_number', `%${search}%`)
    if (type) countQuery = countQuery.eq('type', type)
    if (status) countQuery = countQuery.eq('status', status)
    if (customerId) countQuery = countQuery.eq('customer_id', customerId)
    if (supplierId) countQuery = countQuery.eq('supplier_id', supplierId)
    if (currency) countQuery = countQuery.eq('currency', currency)
    if (dateFrom) countQuery = countQuery.gte('date', dateFrom)
    if (dateTo) countQuery = countQuery.lte('date', dateTo)
    if (minTotal !== undefined) countQuery = countQuery.gte('total', minTotal)
    if (maxTotal !== undefined) countQuery = countQuery.lte('total', maxTotal)

    const [queryResult, countResult] = await Promise.all([query, countQuery])

    const { data, error } = queryResult
    if (error) {
      console.error('Invoice list error:', error)
      throw new DatabaseError('Failed to fetch invoices', error)
    }

    const hasMore = (data?.length || 0) > maxLimit
    const items = hasMore ? data.slice(0, maxLimit) : data
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.id : null

    const invoices = (items || []).map((inv: any) => ({
      ...inv,
      customerName: (inv.customer as any)?.full_name || null,
      customer: (inv.customer as any) || null,
      itemsSent: ((inv.invoice_items as any[]) || []).reduce(
        (sum, i) => sum + (Number(i.quantity) || 0),
        0,
      ),
    }))

    const result = {
      invoices,
      nextCursor,
      hasMore,
      total: countResult.count || 0,
      limit: maxLimit,
    }

    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  /**
   * Turn off the one optional schema piece the error is complaining about.
   *
   * Returns false when there is nothing left to drop, which ends the retry
   * loop and lets the real error surface rather than spinning.
   */
  private degradeSchemaSupport(error: { message?: string }): boolean {
    const message = error.message ?? ''

    if (schemaSupport.publicToken && /public_token/.test(message)) {
      schemaSupport.publicToken = false
      console.warn('[InvoiceService] public_token missing — run invoice-public-share-migration.sql')
      return true
    }

    if (schemaSupport.itemDetails && /invoice_item_details/.test(message)) {
      schemaSupport.itemDetails = false
      console.warn(
        '[InvoiceService] invoice_item_details missing — run unified-sale-purchase-migration.sql. ' +
          'Nested line-item details will not be returned until it is applied.',
      )
      return true
    }

    if (schemaSupport.itemUnits && /unit_label|weight_grams|\bunit\b/.test(message)) {
      schemaSupport.itemUnits = false
      console.warn(
        '[InvoiceService] item unit columns missing — run unified-sale-purchase-migration.sql. ' +
          'Units and weights will not be returned until it is applied.',
      )
      return true
    }

    if (schemaSupport.namedCustomerFk && /fk_invoices_customer|customers/.test(message)) {
      schemaSupport.namedCustomerFk = false
      console.warn(
        '[InvoiceService] fk_invoices_customer not resolvable — falling back to the inferred ' +
          'customer relationship. Check the foreign key name on invoices.customer_id.',
      )
      return true
    }

    // Unrecognised schema error: drop everything optional once, then give up.
    if (
      schemaSupport.publicToken ||
      schemaSupport.itemDetails ||
      schemaSupport.itemUnits ||
      schemaSupport.namedCustomerFk
    ) {
      schemaSupport.publicToken = false
      schemaSupport.itemDetails = false
      schemaSupport.itemUnits = false
      schemaSupport.namedCustomerFk = false
      console.warn(
        '[InvoiceService] unrecognised schema error, dropping optional columns:',
        message,
      )
      return true
    }

    return false
  }

  /**
   * Column list for a single invoice, built from what this database actually
   * has.
   *
   * Every optional piece here is added by a migration that may not have run on
   * a given environment yet: `public_token` by the public-share migration,
   * and the item unit columns plus `invoice_item_details` by the unified
   * sale/purchase migration. Selecting a column Postgres does not have is an
   * error, not an empty result — so an un-migrated database made this method
   * throw NotFound for invoices that plainly exist.
   */
  private invoiceSelect(): string {
    const itemColumns = `
          id,
          invoice_id,
          product_id,
          product_name,
          quantity,
          ${schemaSupport.itemUnits ? INVOICE_ITEM_UNIT_COLUMNS : ''}
          unit_price,
          discount,
          total_price,
          notes
          ${schemaSupport.itemDetails ? `,${INVOICE_ITEM_DETAILS_COLUMNS}` : ''}
    `

    return `
        ${schemaSupport.publicToken ? 'public_token,' : ''}
        id,
        invoice_number,
        type,
        customer_id,
        supplier_id,
        date,
        due_date,
        subtotal,
        discount_total,
        tax_total,
        total,
        paid_amount,
        currency,
        payment_method,
        status,
        notes,
        reference,
        user_id,
        created_at,
        updated_at,
        customer:customers${schemaSupport.namedCustomerFk ? '!fk_invoices_customer' : ''} (
          id,
          full_name,
          phone,
          email,
          address
        ),
        invoice_items (${itemColumns})
      `
  }

  // ─── Get Invoice By ID ───
  async getById(id: string, userId: string) {
    // The select string is built at runtime, so Supabase cannot infer a row
    // type from it — same reason the previous implementation used `any` here.
    const read = async (): Promise<{ data: any; error: any }> =>
      supabase
        .from('invoices')
        .select(this.invoiceSelect())
        .eq('id', id)
        .eq('user_id', userId)
        .single()

    let { data, error } = await read()

    // A schema error means this database is behind on a migration, not that
    // the invoice is missing. Narrow what we ask for, remember it for the rest
    // of the process, and retry — degraded data beats a 404 on a record that
    // exists, and beats a 500 on a create that already succeeded.
    while (error && isMissingSchemaError(error) && this.degradeSchemaSupport(error)) {
      ;({ data, error } = await read())
    }

    if (error || !data) {
      throw new NotFoundError('Invoice')
    }

    return {
      ...data,
      customerName: (data.customer as any)?.full_name || null,
      customer: (data.customer as any) || null,
    }
  }

  // ─── Get Invoice for public (unauthenticated) read-only view ─────────────
  // ⚠️ Looked up by `public_token` (unguessable uuid), NEVER by the
  // sequential/primary `id` — that would let anyone enumerate every
  // invoice by iterating ids. Only returns the fields InvoiceDocument
  // needs; no user_id / internal fields are exposed.
  //
  // Graceful fallback: until docs/invoice-public-share-migration.sql is
  // run, the `public_token` column doesn't exist yet. Postgres returns
  // error code 42703 (undefined_column) in that case — we catch it and
  // fall back to treating the given token as the raw invoice `id`
  // instead, so the feature still works (just with a guessable link)
  // until the migration lands.
  async getPublicByToken(token: string) {
    const columns = `
      id,
      public_token,
      invoice_number,
      date,
      due_date,
      subtotal,
      discount_total,
      tax_total,
      total,
      paid_amount,
      currency,
      status,
      notes,
      customer:customers!fk_invoices_customer ( full_name, phone, email, address ),
      invoice_items (
        id, product_name, quantity, unit, unit_label, weight_grams,
        unit_price, discount, total_price,
        ${INVOICE_ITEM_DETAILS_COLUMNS}
      )
    `

    let data: any = null
    let error: any = null

    ;({ data, error } = await supabase
      .from('invoices')
      .select(columns)
      .eq('public_token', token)
      .single())

    if (error && (error.code === '42703' || /public_token/.test(error.message || ''))) {
      // Column not migrated yet — fall back to raw id lookup.
      ;({ data, error } = await supabase
        .from('invoices')
        .select(columns.replace('public_token,\n      ', ''))
        .eq('id', token)
        .single())
    }

    if (error || !data) {
      throw new NotFoundError('Invoice')
    }

    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      date: data.date,
      dueDate: data.due_date,
      subtotal: data.subtotal,
      discountTotal: data.discount_total,
      taxTotal: data.tax_total,
      total: data.total,
      paidAmount: data.paid_amount,
      currency: data.currency,
      status: data.status,
      notes: data.notes,
      customer: data.customer || null,
      items: data.invoice_items || [],
    }
  }

  // ─── Create Invoice ──────────────────────────────────────────────────────
  async create(userId: string, data: CreateInvoice) {
    const invoiceNumber = await this.generateInvoiceNumber()

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        type: data.type,
        date: data.date || new Date().toISOString(),
        due_date: data.dueDate || null,
        customer_id: data.customerId || null,
        supplier_id: data.supplierId || null,
        subtotal: data.subtotal || 0,
        discount_total: data.discountTotal || 0,
        discount_type: data.discountType || 'fixed',
        tax_rate: data.taxRate || 0,
        tax_total: data.taxTotal || 0,
        total: data.total || 0,
        paid_amount: data.paidAmount || 0,
        payment_method: data.paymentMethod || 'cash',
        currency: data.currency || 'AFN',
        status:
          data.paidAmount && data.total && data.paidAmount >= data.total ? 'completed' : 'pending',
        notes: data.notes || '',
        reference: data.reference || '',
        user_id: userId,
      })
      .select(INVOICE_LIST_COLUMNS)
      .single()

    if (invoiceError || !invoice) throw new DatabaseError('Failed to create invoice', invoiceError)

    // ─── ایجاد آیتم‌های فاکتور ──────────────────────────────────────────
    if (data.items?.length) {
      const items = data.items.map((item) => ({
        invoice_id: invoice.id,
        product_id: item.productId,
        product_name: item.productName || '',
        quantity: item.quantity,
        unit: item.unit || 'piece',
        unit_label: item.unitLabel ?? null,
        weight_grams: item.weightGrams ?? null,
        unit_price: item.unitPrice,
        discount: item.discount || 0,
        total_price: item.totalPrice || item.quantity * item.unitPrice,
        notes: item.notes || '',
        user_id: userId,
      }))

      // `.select()` so the generated item ids come back — the nested details
      // need them, and a second round-trip per item would be N+1.
      const { data: insertedItems, error: itemsError } = await supabase
        .from('invoice_items')
        .insert(items)
        .select('id')

      if (itemsError || !insertedItems) {
        await supabase.from('invoices').delete().eq('id', invoice.id)
        throw new DatabaseError('Failed to create invoice items', itemsError)
      }

      await this.insertItemDetails(data.items, insertedItems, invoice.id)

      // A purchase moves stock too — it just moves it the other way. Guarding
      // this on `type === "sale"` meant every purchase left inventory
      // untouched, which is why bought goods never appeared in the warehouse.
      await this.batchUpdateStock(data.items, userId, data.type === 'purchase' ? 1 : -1)
    }

    // ─── ✅ دریافت نام مشتری ──────────────────────────────────────────────
    let customerName: string | null = null
    if (data.customerId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('full_name')
        .eq('id', data.customerId)
        .maybeSingle()
      customerName = customer?.full_name || null
    }

    // ─── ✅ دریافت نام کاربر و workspace ────────────────────────────────
    const actorName = await this.getUserDisplayName(userId)
    const workspaceId = await this.resolveWorkspaceId(userId)

    // ─── ✅ ایجاد Activity ──────────────────────────────────────────────────
    const isPurchaseInvoice = invoice.type === 'purchase'
    try {
      await this.activityService.createActivity({
        actorId: userId,
        actorName: actorName,
        workspaceId: workspaceId,
        entityType: 'invoice',
        entityId: invoice.id,
        action: 'created',
        // Activity must name the transaction it describes. Every invoice used
        // to read "فاکتور ... ایجاد شد" with a "مشتری:" prefix, so a purchase
        // from a supplier was indistinguishable from a sale in the feed.
        title: `${isPurchaseInvoice ? 'خرید' : 'فروش'} #${invoice.invoice_number} ثبت شد`,
        description: `${isPurchaseInvoice ? 'فروشنده' : 'مشتری'}: ${
          customerName || (isPurchaseInvoice ? 'بدون فروشنده' : 'بدون مشتری')
        } • مبلغ: ${invoice.total} ${invoice.currency}`,
        metadata: {
          invoice_number: invoice.invoice_number,
          // Consumers filter on this; without it the feed cannot tell the two
          // transaction types apart.
          transaction_type: invoice.type ?? 'sale',
          customer_name: customerName,
          total: invoice.total,
          currency: invoice.currency,
          status: invoice.status,
        },
        importance: 4,
      })
    } catch (activityError) {
      console.error('[InvoiceService] Failed to create activity:', activityError)
    }

    // ─── ✅ ایجاد نوتیفیکیشن ──────────────────────────────────────────────
    try {
      console.log(
        `[InvoiceService] Creating notification for invoice ${invoice.id} with workspaceId: ${workspaceId}`,
      )

      await this.notificationService.create(workspaceId, {
        user_id: userId,
        title: '✅ صورت‌حساب جدید ایجاد شد',
        body: `صورت‌حساب شماره ${invoice.invoice_number} با مبلغ ${invoice.total} ${invoice.currency} ثبت شد.`,
        type: 'success',
        entity_type: 'invoice',
        entity_id: invoice.id,
        action_url: `/invoices/${invoice.id}`,
        metadata: {
          invoice_number: invoice.invoice_number,
          total: invoice.total,
          currency: invoice.currency,
          customer_name: customerName,
        },
      })

      if (data.customerId) {
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('user_id')
          .eq('id', data.customerId)
          .maybeSingle()

        if (customerError) {
          console.error('Failed to fetch customer for notification:', customerError)
        }

        if (customer?.user_id) {
          await this.notificationService.create(workspaceId, {
            user_id: customer.user_id,
            title: '📄 صورت‌حساب جدید برای شما',
            body: `یک صورت‌حساب جدید به مبلغ ${invoice.total} ${invoice.currency} برای شما ثبت شده است.`,
            type: 'info',
            entity_type: 'invoice',
            entity_id: invoice.id,
            action_url: `/invoices/${invoice.id}`,
            metadata: {
              invoice_number: invoice.invoice_number,
              total: invoice.total,
              currency: invoice.currency,
              customer_name: customerName,
            },
          })
        }
      }
    } catch (notifError) {
      console.error('[InvoiceService] Failed to create notification:', notifError)
    }

    // ─── پس‌زمینه ──────────────────────────────────────────────────────────
    this.invalidateUserCache(userId)

    this.createAccountingEntries(userId, invoice.id, {
      ...data,
      invoiceNumber,
      total: data.total || 0,
    }).catch((err) => console.error('Accounting entry failed:', err))

    this.tryStartWorkflow(userId, invoice.id, Number(data.total || 0)).catch((err) =>
      console.error('Workflow failed:', err),
    )

    return this.getById(invoice.id, userId)
  }

  // ─── Update Invoice ──────────────────────────────────────────────────────
  async update(id: string, userId: string, data: UpdateInvoice) {
    const currentInvoice = await this.getById(id, userId)

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.status !== undefined) updates.status = data.status
    if (data.paidAmount !== undefined) updates.paid_amount = data.paidAmount
    if (data.total !== undefined) updates.total = data.total
    if (data.notes !== undefined) updates.notes = data.notes
    if (data.reference !== undefined) updates.reference = data.reference

    const { data: invoice, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(INVOICE_LIST_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update invoice', error)
    if (!invoice) throw new NotFoundError('Invoice')

    // ─── آیتم‌ها و جزئیات ─────────────────────────────────────────────────
    // Only when the caller actually sends items. Omitting `items` keeps this
    // a metadata-only patch, which is what every existing caller does — their
    // behaviour is unchanged.
    if ((data as { items?: unknown[] }).items?.length) {
      await this.replaceInvoiceItems(
        id,
        (data as { items: any[] }).items,
        userId,
        String(invoice.type ?? 'sale'),
      )
    }

    // ─── ✅ بررسی پرداخت ──────────────────────────────────────────────────
    const isNowPaid =
      (data.status === 'completed' || data.status === 'paid') &&
      currentInvoice.status !== 'completed' &&
      currentInvoice.status !== 'paid'

    const isFullyPaid =
      data.paidAmount !== undefined && data.paidAmount >= (data.total ?? currentInvoice.total)

    if (isNowPaid || isFullyPaid) {
      try {
        const workspaceId = await this.resolveWorkspaceId(userId)

        console.log(
          `[InvoiceService] Creating payment notification for invoice ${invoice.id} with workspaceId: ${workspaceId}`,
        )

        await this.notificationService.create(workspaceId, {
          user_id: userId,
          title: '💰 صورت‌حساب پرداخت شد',
          body: `صورت‌حساب شماره ${invoice.invoice_number} به مبلغ ${invoice.total} ${invoice.currency} پرداخت شد.`,
          type: 'success',
          entity_type: 'invoice',
          entity_id: invoice.id,
          action_url: `/invoices/${invoice.id}`,
          metadata: {
            invoice_number: invoice.invoice_number,
            total: invoice.total,
            currency: invoice.currency,
          },
        })
      } catch (notifError) {
        console.error('[InvoiceService] Failed to create payment notification:', notifError)
      }
    }

    this.invalidateUserCache(userId)
    return invoice
  }

  // ─── Delete Invoice ──────────────────────────────────────────────────────
  async delete(id: string, userId: string): Promise<void> {
    await supabase.from('invoice_items').delete().eq('invoice_id', id)
    const { error } = await supabase.from('invoices').delete().eq('id', id).eq('user_id', userId)
    if (error) throw new DatabaseError('Failed to delete invoice', error)
    this.invalidateUserCache(userId)
  }

  // ─── Invalidate Cache ────────────────────────────────────────────────────
  private invalidateUserCache(userId: string) {
    memoryCache.invalidate(`dashboard:v2:${userId}`)
    memoryCache.invalidate(`sales:${userId}`)
    memoryCache.invalidate(`insights:${userId}`)
    memoryCache.invalidate(`invoices:${userId}`)
    memoryCache.invalidate(`customers:${userId}`)
    memoryCache.invalidate(`products:${userId}`)
  }

  // ─── Get Summary ─────────────────────────────────────────────────────────
  async getSummary(userId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data: allInvoices } = await supabase
      .from('invoices')
      .select('total, paid_amount, status, created_at, type')
      .eq('user_id', userId)

    const { data: products } = await supabase
      .from('products')
      .select('quantity, min_stock_level')
      .eq('user_id', userId)

    // «فروش امروز» و «بدهی» فقط از فروش می‌آیند. فاکتور خرید نه فروش است و نه
    // طلب ما از مشتری. فاکتورهای قدیمیِ بدون type فروش در نظر گرفته می‌شوند تا
    // معنایشان عوض نشود.
    const invoices = (allInvoices || []).filter((i: any) => i.type !== 'purchase')
    const purchases = (allInvoices || []).filter((i: any) => i.type === 'purchase')

    const todaySales = invoices
      .filter((i) => i.created_at >= today.toISOString() && i.created_at < tomorrow.toISOString())
      .reduce((sum: number, i: any) => sum + (i.total || 0), 0)

    const todayPurchases = purchases
      .filter((i) => i.created_at >= today.toISOString() && i.created_at < tomorrow.toISOString())
      .reduce((sum: number, i: any) => sum + (i.total || 0), 0)

    const totalDebt = invoices
      .filter((i) => i.status !== 'paid')
      .reduce((sum: number, i: any) => sum + Math.max(0, (i.total || 0) - (i.paid_amount || 0)), 0)

    const totalPayable = purchases
      .filter((i) => i.status !== 'paid')
      .reduce((sum: number, i: any) => sum + Math.max(0, (i.total || 0) - (i.paid_amount || 0)), 0)

    const lowStockCount = (products || []).filter(
      (p: any) => (p.min_stock_level || 0) > 0 && (p.quantity || 0) <= (p.min_stock_level || 0),
    ).length

    return { todaySales, totalDebt, lowStockCount, todayPurchases, totalPayable }
  }

  // ─── Invoice Item Details ────────────────────────────────────────────────
  /**
   * Persist the nested components of each item ("گردنبند" → زنجیر / سنگ / اجرت).
   *
   * One batched insert for the whole invoice, not one per detail — N details
   * must never become N round-trips.
   *
   * `insertedItems` comes back from a single `.insert().select("id")`, which
   * preserves the order of the rows given to it, so index i of `items` is
   * index i of `insertedItems`.
   *
   * On failure the whole invoice is removed: an invoice whose items lost their
   * details is worse than no invoice at all, and `ON DELETE CASCADE` cleans up
   * the item rows.
   */
  private async insertItemDetails(
    items: any[],
    insertedItems: { id: string }[],
    invoiceId: string,
  ): Promise<void> {
    const rows = items.flatMap((item, index) => {
      const parentId = insertedItems[index]?.id
      if (!parentId || !item.details?.length) return []

      return item.details.map((detail: any, order: number) => ({
        invoice_item_id: parentId,
        title: detail.title,
        quantity: detail.quantity ?? 1,
        amount: detail.amount ?? 0,
        unit: detail.unit || 'piece',
        unit_label: detail.unitLabel ?? null,
        weight_grams: detail.weightGrams ?? null,
        // Trust the client's explicit ordering, fall back to array position.
        sort_order: detail.sortOrder ?? order,
      }))
    })

    if (rows.length === 0) return

    const { error } = await supabase.from('invoice_item_details').insert(rows)
    if (error) {
      await supabase.from('invoices').delete().eq('id', invoiceId)
      throw new DatabaseError('Failed to create invoice item details', error)
    }
  }

  /**
   * Replace an invoice's items and their details.
   *
   * Delete-then-insert rather than diffing: an invoice's line set is small and
   * edited wholesale, and `ON DELETE CASCADE` removes the old details with the
   * old items, so no orphan can survive. Diffing would buy nothing here and
   * would add a class of bug (stale detail attached to a replaced item).
   */
  private async replaceInvoiceItems(
    invoiceId: string,
    items: any[],
    userId: string,
    type: string,
  ): Promise<void> {
    // Reverse the OLD items' stock effect before deleting them, then apply the
    // new ones below. Skipping this would silently drift inventory on every
    // edit — the stock of the removed lines would never come back.
    const direction: 1 | -1 = type === 'purchase' ? 1 : -1
    const { data: oldItems } = await supabase
      .from('invoice_items')
      .select('product_id, quantity')
      .eq('invoice_id', invoiceId)

    if (oldItems?.length) {
      const reversal = oldItems.map((row: any) => ({
        productId: row.product_id,
        quantity: Number(row.quantity) || 0,
      }))
      await this.batchUpdateStock(reversal, userId, (direction * -1) as 1 | -1)
    }

    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId)

    const rows = items.map((item) => ({
      invoice_id: invoiceId,
      product_id: item.productId,
      product_name: item.productName || '',
      quantity: item.quantity,
      unit: item.unit || 'piece',
      unit_label: item.unitLabel ?? null,
      weight_grams: item.weightGrams ?? null,
      unit_price: item.unitPrice,
      discount: item.discount || 0,
      total_price: item.totalPrice || item.quantity * item.unitPrice,
      notes: item.notes || '',
      user_id: userId,
    }))

    const { data: inserted, error } = await supabase.from('invoice_items').insert(rows).select('id')

    if (error || !inserted) {
      throw new DatabaseError('Failed to replace invoice items', error)
    }

    await this.insertItemDetails(items, inserted, invoiceId)
    await this.batchUpdateStock(items, userId, direction)
  }

  // ─── Batch Update Stock ──────────────────────────────────────────────────
  /**
   * Apply an invoice's items to inventory.
   *
   * `direction` is +1 for a purchase (stock arrives) and -1 for a sale (stock
   * leaves). It is the ONLY thing that differs between the two transaction
   * types — the lookup, the movement rows and the write path are shared.
   */
  private async batchUpdateStock(items: any[], userId: string, direction: 1 | -1 = -1) {
    if (!items || items.length === 0) return

    const productIds = items.filter((item) => item.productId).map((item) => item.productId)

    if (productIds.length === 0) return

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, quantity')
      .in('id', productIds)

    if (productsError) {
      throw new DatabaseError('Failed to fetch products for stock update', productsError)
    }

    const productMap = new Map()
    for (const product of products) {
      productMap.set(product.id, product.quantity)
    }

    const updatePromises = items
      .filter((item) => item.productId && productMap.has(item.productId))
      .map(async (item) => {
        const currentQuantity = Number(productMap.get(item.productId)) || 0
        const delta = direction * (Number(item.quantity) || 0)
        // Stock can never go negative; a purchase is always additive.
        const newQuantity = Math.max(0, currentQuantity + delta)
        await supabase.from('products').update({ quantity: newQuantity }).eq('id', item.productId)
      })

    await Promise.all(updatePromises)

    const movements = items
      .filter((item) => item.productId)
      .map((item) => ({
        product_id: item.productId,
        // The movement must name the transaction that caused it. Hardcoding
        // "sale" made every stock movement look like a sale in reports.
        type: direction === 1 ? 'purchase' : 'sale',
        quantity: direction * (Number(item.quantity) || 0),
        reference_type: 'invoice',
        user_id: userId,
      }))

    if (movements.length > 0) {
      await supabase.from('stock_movements').insert(movements)
    }
  }

  // ─── Accounting Entries ──────────────────────────────────────────────────
  private async createAccountingEntries(
    userId: string,
    invoiceId: string,
    data: { type: string; total: number; items?: any[]; invoiceNumber?: string; date?: string },
  ): Promise<void> {
    try {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, code, type')
        .in('code', ['1200', '4000', '5000', '1000'])
        .eq('user_id', userId)

      if (!accounts || accounts.length < 4) return

      const accountMap: Record<string, string> = {}
      for (const acc of accounts) accountMap[acc.code] = acc.id

      const receivableId = accountMap['1200']
      const revenueId = accountMap['4000']
      const cogsId = accountMap['5000']
      const inventoryId = accountMap['1000']
      // 2000 = حساب‌های پرداختنی. اگر در چارت حساب‌ها نباشد، خرید به‌جای آن
      // روی حساب‌های دریافتنی نمی‌نشیند — بلکه هیچ سند حسابداری ساخته
      // نمی‌شود، که بهتر از ثبت غلط است.
      const payableId = accountMap['2000']

      if (!receivableId || !revenueId || !cogsId || !inventoryId) return
      if (data.type === 'purchase' && !payableId) return

      const isPurchase = data.type === 'purchase'

      const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          date: data.date ? data.date.split('T')[0] : new Date().toISOString().split('T')[0],
          description: `${isPurchase ? 'فاکتور خرید' : 'فاکتور فروش'} ${
            data.invoiceNumber || invoiceId.substring(0, 8)
          }`,
          reference: invoiceId,
          user_id: userId,
        })
        .select()
        .single()

      if (journalError || !journalEntry) return

      // ⚠️ FIX: این دو خط برای هر فاکتوری زده می‌شد، از جمله خرید — یعنی هر
      // خرید یک ردیف «درآمد» در دفتر کل می‌ساخت و صورت سود و زیان را خراب
      // می‌کرد.
      //
      // فروش: بدهکار حساب‌های دریافتنی / بستانکار درآمد.
      // خرید: بدهکار موجودی کالا / بستانکار حساب‌های پرداختنی — کالا وارد
      //        انبار شده و ما به تأمین‌کننده بدهکاریم. هیچ درآمدی در کار نیست.
      const journalLines: any[] = isPurchase
        ? [
            {
              journal_id: journalEntry.id,
              account_id: inventoryId,
              debit: data.total,
              credit: 0,
              user_id: userId,
            },
            {
              journal_id: journalEntry.id,
              account_id: payableId,
              debit: 0,
              credit: data.total,
              user_id: userId,
            },
          ]
        : [
            {
              journal_id: journalEntry.id,
              account_id: receivableId,
              debit: data.total,
              credit: 0,
              user_id: userId,
            },
            {
              journal_id: journalEntry.id,
              account_id: revenueId,
              debit: 0,
              credit: data.total,
              user_id: userId,
            },
          ]

      if (data.type === 'sale' && data.items?.length) {
        const productIds = data.items.map((item) => item.productId)
        const { data: products } = await supabase
          .from('products')
          .select('id, buy_price')
          .in('id', productIds)

        const productPriceMap = new Map()
        for (const product of products || []) {
          productPriceMap.set(product.id, product.buy_price || 0)
        }

        for (const item of data.items) {
          const itemCost = (productPriceMap.get(item.productId) || 0) * item.quantity
          journalLines.push(
            {
              journal_id: journalEntry.id,
              account_id: cogsId,
              debit: itemCost,
              credit: 0,
              user_id: userId,
            },
            {
              journal_id: journalEntry.id,
              account_id: inventoryId,
              debit: 0,
              credit: itemCost,
              user_id: userId,
            },
          )
        }
      }

      const { error: linesError } = await supabase.from('journal_lines').insert(journalLines)
      if (linesError) {
        await supabase.from('journal_entries').delete().eq('id', journalEntry.id)
      }
    } catch (err) {
      console.error('❌ Error in createAccountingEntries:', err)
    }
  }

  // ─── Generate Invoice Number ─────────────────────────────────────────────
  private async generateInvoiceNumber(): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('get_next_invoice_number')
      if (!error && data) {
        return `INV-${String(data).padStart(6, '0')}`
      }
    } catch {
      const timestamp = Date.now().toString(36).toUpperCase()
      const random = Math.random().toString(36).substring(2, 6).toUpperCase()
      return `INV-${timestamp}-${random}`
    }
    return `INV-${Date.now().toString(36).toUpperCase()}`
  }

  // ─── Try Start Workflow ──────────────────────────────────────────────────
  private async tryStartWorkflow(userId: string, invoiceId: string, total: number): Promise<void> {
    try {
      const { data: workflows } = await supabase
        .from('workflows')
        .select('id')
        .eq('entity_type', 'invoice')
        .eq('is_active', true)
        .is('deleted_at', null)
        .limit(1)

      const workflow = workflows?.[0]
      if (!workflow) return

      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      const workspaceId = membership?.workspace_id
      if (!workspaceId) return

      await this.workflowService.startWorkflow(workspaceId, {
        workflow_id: workflow.id,
        entity_type: 'invoice',
        entity_id: invoiceId,
      })
    } catch {
      /* silent — never block invoice creation */
    }
  }
}

export default InvoiceService
