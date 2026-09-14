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

import { PaymentsService } from './payments/payments.service'
import { supabase } from '../db'
import { sod } from './authorization'
import { scopes } from './authorization/scope.service'
import { OUTSTANDING_OR_FILTER } from './invoices/outstanding.domain'
import { fetchInvoiceSummaryAggregate } from './aggregates/analytics-aggregates'
import { summarizeInvoices, type InvoiceSummaryRow } from './invoices/invoice-list-summary.domain'
import { toBaseQuantity, type ProductUnitOption } from './inventory/unit-conversion.domain'
import { conflicts } from './conflict'
import { detectBreaches } from './pos/negative-stock.domain'
import { WorkflowService } from '../services/workflow.service'
import { NotificationService } from '../services/notification.service'
import {
  CreateInvoice,
  UpdateInvoice,
  InvoiceFilters,
  computeInvoiceMoney,
  type AccountRole,
} from '@hisabche/validation'
import { ledger, type DraftLine } from './accounting'
import { costing } from './inventory-costing'
import { rules } from './rules'
import { tax } from './tax'
import { DatabaseError, NotFoundError } from '../errors/database.error'
import { ValidationError } from '../errors/validation.error'
import {
  AWAITING_APPROVAL_STATUS,
  decideApproval,
  mayPostDocument,
  type ApprovalOutcome,
} from './workflow/approval-gate.domain'
import { memoryCache } from '../utils/pagination'
import { ActivityService } from './activity.service'
import type { TenancyContext } from './tenancy.service'
import { requireWorkspace } from './tenancy.service'

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

/**
 * Is this document's business date inside [from, to)?
 *
 * ⚠️ A MISSING OR UNPARSEABLE DATE IS , NOT TODAY.
 * The comparison it replaces was a bare  on a nullable column, where
 *  is silently false — so the bug was invisible. Being explicit
 * keeps the same safe answer while saying out loud that it was a decision.
 */
function isOnDay(value: unknown, from: Date, to: Date): boolean {
  if (typeof value !== 'string' || value === '') return false
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return false
  return at >= from && at < to
}

/**
 * The list filters, stated once. The page query, its count and the summary
 * scan must select the same invoices — a count or a total over a different set
 * than the table is the drift the count query already suffered once.
 */
interface InvoiceFilterable<Q> {
  eq(column: string, value: string): Q
  ilike(column: string, pattern: string): Q
  or(filter: string): Q
  gte(column: string, value: string | number): Q
  lte(column: string, value: string | number): Q
}

function applyInvoiceListFilters<Q extends InvoiceFilterable<Q>>(
  query: Q,
  filters: InvoiceFilters,
): Q {
  let q = query
  if (filters.search) q = q.ilike('invoice_number', `%${filters.search}%`)
  if (filters.type) q = q.eq('type', filters.type)
  if (filters.status) q = q.eq('status', filters.status)
  // H1 — the rule is imported, not restated. See outstanding.domain.ts.
  if (filters.outstanding) q = q.or(OUTSTANDING_OR_FILTER)
  if (filters.customerId) q = q.eq('customer_id', filters.customerId)
  if (filters.supplierId) q = q.eq('supplier_id', filters.supplierId)
  if (filters.currency) q = q.eq('currency', filters.currency)
  if (filters.dateFrom) q = q.gte('date', filters.dateFrom)
  if (filters.dateTo) q = q.lte('date', filters.dateTo)
  if (filters.minTotal !== undefined) q = q.gte('total', filters.minTotal)
  if (filters.maxTotal !== undefined) q = q.lte('total', filters.maxTotal)
  return q
}

/** What posting an invoice to the ledger actually did. */
export type LedgerPostResult =
  | { status: 'posted' }
  | { status: 'already_posted' }
  | { status: 'nothing_to_post' }
  | { status: 'skipped'; missing: string[] }
  | { status: 'not_postable'; reason: string }

/** A list from a row that may carry it under either key, or not at all. */
function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : []
}

export class InvoiceService {
  private workflowService: WorkflowService
  private notificationService: NotificationService
  private activityService: ActivityService
  /**
   * T9 — the only writer of settlement. Invoice creation asks THIS to record
   * money; it never writes `paid_amount` itself.
   */
  private payments: PaymentsService

  constructor() {
    this.workflowService = new WorkflowService()
    this.notificationService = new NotificationService()
    this.activityService = new ActivityService()
    this.payments = new PaymentsService()
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
  //
  // ⚠️ SECURITY — this used to end `?? userId`, handing back the USER's id as
  // a workspace id. That is a fabricated tenancy boundary living in the same
  // UUID space as real workspace ids, and it was written onto activity and
  // notification rows.
  //
  // It now delegates to requireWorkspace(), the single resolver, which fails
  // closed: no membership throws rather than inventing one, revoked and
  // suspended members are excluded, and a multi-workspace user is refused
  // rather than silently assigned whichever row PostgreSQL returned first.
  //
  // This private helper remains only for the call sites in this file that
  // still take a bare userId. As each is converted to accept a TenancyContext
  // from the route, it goes away.
  private async resolveWorkspaceId(userId: string): Promise<string> {
    const ctx = await requireWorkspace(userId)
    return ctx.workspaceId
  }

  // ─── List Invoices — با JOIN customers ───
  async list(ctx: TenancyContext, filters: InvoiceFilters) {
    const { workspaceId } = ctx
    const {
      search,
      type,
      status,
      customerId,
      supplierId,
      currency,
      dateFrom,
      dateTo,
      outstanding,
      minTotal,
      maxTotal,
      includeSummary,
      limit = 20,
      cursor,
      page = 1,
      sortBy = 'created_at',
      sortDirection = 'desc',
    } = filters

    const cacheKey = `invoices:${workspaceId}:${JSON.stringify(filters)}`
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
      .eq('workspace_id', workspaceId)
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

    query = applyInvoiceListFilters(query, filters)

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
        search ||
        type ||
        status ||
        outstanding ||
        customerId ||
        supplierId ||
        currency ||
        dateFrom ||
        dateTo,
      ) ||
      minTotal !== undefined ||
      maxTotal !== undefined

    let countQuery = supabase
      .from('invoices')
      .select('id', { count: hasFilters ? 'exact' : 'estimated', head: true })
      .eq('workspace_id', workspaceId)

    if (search) countQuery = countQuery.ilike('invoice_number', `%${search}%`)
    if (type) countQuery = countQuery.eq('type', type)
    if (status) countQuery = countQuery.eq('status', status)
    // Same filter on the count, or the pager offers pages the list cannot fill.
    if (outstanding) countQuery = countQuery.or(OUTSTANDING_OR_FILTER)
    if (customerId) countQuery = countQuery.eq('customer_id', customerId)
    if (supplierId) countQuery = countQuery.eq('supplier_id', supplierId)
    if (currency) countQuery = countQuery.eq('currency', currency)
    if (dateFrom) countQuery = countQuery.gte('date', dateFrom)
    if (dateTo) countQuery = countQuery.lte('date', dateTo)
    if (minTotal !== undefined) countQuery = countQuery.gte('total', minTotal)
    if (maxTotal !== undefined) countQuery = countQuery.lte('total', maxTotal)

    const [queryResult, countResult, summary] = await Promise.all([
      query,
      countQuery,
      includeSummary ? this.summarizeList(workspaceId, filters) : Promise.resolve(undefined),
    ])

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
      // Additive, and only when asked: every other caller of this list keeps
      // the exact response it had, and does not pay for a full scan.
      ...(summary ? { summary } : {}),
    }

    await memoryCache.set(cacheKey, result, 60)
    return result
  }

  /**
   * The stat-card figures over EVERY invoice matching the filters.
   *
   * Paged through in ordered 1000-row pages rather than one unbounded select:
   * PostgREST caps a response at its max-rows setting and returns the short
   * page without an error, which would bring back exactly the silent
   * truncation this exists to remove. See invoice-list-summary.domain.ts.
   */
  private async summarizeList(workspaceId: string, filters: InvoiceFilters) {
    const PAGE = 1000
    const rows: InvoiceSummaryRow[] = []

    for (let from = 0; ; from += PAGE) {
      let pageQuery = supabase
        .from('invoices')
        .select('total, status, date, created_at, currency')
        .eq('workspace_id', workspaceId)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      pageQuery = applyInvoiceListFilters(pageQuery, filters)
      const { data: page, error } = await pageQuery

      if (error) throw new DatabaseError('Failed to summarize invoices', error)

      rows.push(...((page ?? []) as InvoiceSummaryRow[]))
      if (!page || page.length < PAGE) break
    }

    return summarizeInvoices(rows, new Date())
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
  async getById(id: string, ctx: TenancyContext) {
    const { workspaceId } = ctx
    // The select string is built at runtime, so Supabase cannot infer a row
    // type from it — same reason the previous implementation used `any` here.
    const read = async (): Promise<{ data: any; error: any }> =>
      supabase
        .from('invoices')
        .select(this.invoiceSelect())
        .eq('id', id)
        .eq('workspace_id', workspaceId)
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
      // ⚠️ SECURITY — there was a fallback here that retried the lookup as
      // `.eq('id', token)` when the `public_token` column was missing.
      //
      // This route is UNAUTHENTICATED by design. Its entire safety argument is
      // that an invoice can only be reached through an unguessable share
      // token — invoice-public.routes.ts says so in its header. The fallback
      // turned it into "any invoice, by its id, with no authentication and no
      // workspace": exactly the enumeration the design claims to prevent. A
      // database that had not run the migration silently published every
      // invoice on the platform.
      //
      // It now fails closed. An unmigrated database serves no public invoices,
      // which is the right outcome — the feature is unavailable, not unsafe.
      console.error(
        '[InvoiceService] public_token column is missing — public invoice links are ' +
          'disabled until the migration runs. Refusing to fall back to id lookup.',
      )
      throw new NotFoundError('Invoice')
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
  /**
   * `branchId` is the branch the request resolved to, or null for a business
   * with no branches — which is most of them. It is stamped on the invoice so
   * a two-shop business can ask how each shop did; it is NOT a security
   * boundary, and it never widens what the workspace already authorized.
   */
  async create(ctx: TenancyContext, data: CreateInvoice, branchId: string | null = null) {
    const { workspaceId, userId } = ctx

    // ═══════════════════════════════════════════════════════════════════════
    // ⚠️ THE MONEY IS DERIVED FROM THE LINES BEFORE ANYTHING IS WRITTEN.
    //
    // `subtotal`, `discount_total`, `tax_total` and `total` used to be taken
    // straight from the request body, and `createAccountingEntries` booked the
    // ledger from that same `total`. Nothing recomputed the header.
    //
    // A request carrying items worth 5,000,000 and `"total": 1` therefore
    // removed the full stock, consumed the full cost layers, and booked
    // revenue of ONE — with COGS computed from the real consumed cost, making
    // the journal entry a guaranteed loss and the receivable wrong by the
    // difference. `"total": 0` was worse still: `createAccountingEntries`
    // returns early on a non-positive total, so the goods left the shelf and
    // nothing at all was booked.
    //
    // `computeInvoiceMoney` uses the same arithmetic as the grid's own
    // `summarize`, so the figure a person approved on screen is the figure
    // their books carry.
    // ═══════════════════════════════════════════════════════════════════════
    const money = computeInvoiceMoney({
      items: data.items ?? [],
      discountTotal: data.discountTotal,
      taxRate: data.taxRate,
      taxTotal: data.taxTotal,
    })

    // ═══════════════════════════════════════════════════════════════════════
    // ⚠️ THE CUSTOMER IS VERIFIED BEFORE ANYTHING IS WRITTEN.
    //
    // This check used to sit AFTER the invoice row, its items, their details
    // and `batchUpdateStock` had all been written — and on a miss it ran
    //
    //     await supabase.from('invoices').delete()...
    //
    // So `POST /api/invoices` with a valid product and a `customerId` from
    // another workspace deducted the stock, wrote `stock_movements` rows
    // pointing at the invoice, consumed the cost layers, and then deleted the
    // invoice. The movements' `reference_id` pointed at a row that no longer
    // existed, the goods were gone with no document explaining where, and the
    // consumed layers were never released.
    //
    // The compensating DELETE is also forbidden outright by this codebase's
    // fourth rule: supabase-js has no transactions, so it is not a rollback —
    // it is a second write that can fail on its own.
    //
    // Validating first makes all of that unreachable. Nothing to compensate.
    // ═══════════════════════════════════════════════════════════════════════
    let customerName: string | null = null
    if (data.customerId) {
      // The tenancy filter is the point: without it a client could attach ANY
      // customer id to its invoice — a cross-workspace write that also leaked
      // the other shop's customer name back through the activity feed.
      const { data: customer } = await supabase
        .from('customers')
        .select('full_name')
        .eq('id', data.customerId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      if (!customer) throw new NotFoundError('Customer')
      customerName = (customer as { full_name: string }).full_name
    }

    const invoiceNumber = await this.generateInvoiceNumber()

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        branch_id: branchId,
        type: data.type,
        date: data.date || new Date().toISOString(),
        due_date: data.dueDate || null,
        customer_id: data.customerId || null,
        supplier_id: data.supplierId || null,
        // ⚠️ DERIVED, NOT ACCEPTED. See `money` above.
        subtotal: money.subtotal,
        discount_total: money.discountTotal,
        discount_type: data.discountType || 'fixed',
        // The flat rate the client sent is kept for backward compatibility with
        // screens that still show it, but it decides nothing: the tax core
        // computes the real figures below and they overwrite these.
        tax_rate: data.taxRate || 0,
        tax_total: money.taxTotal,
        total: money.total,
        // ⚠️ T9 — ALWAYS ZERO AT INSERT, AND THAT IS THE FIX.
        //
        // This line used to read `paid_amount: data.paidAmount || 0`. Phase F
        // made `paid_amount` a projection of `SUM(payment_allocations)` and
        // closed the PATCH that wrote it — but this insert kept writing it, so
        // creation remained a second writer on a derived number.
        //
        // A real sale showed the consequence: `paid_amount` was ۱۸٬۰۰۰٬۰۰۰
        // with no payment behind it, and the drift warning built in H2 caught
        // it. The invoice claimed to be paid and the ledger had never seen a
        // rial of it.
        //
        // The money is recorded as an actual payment below, and this column
        // follows from the allocations the way every other screen expects.
        paid_amount: 0,
        payment_method: data.paymentMethod || 'cash',
        currency: data.currency || 'AFN',
        // ⚠️ J3 — THIS LINE IS THE CONFLATION, and it is kept deliberately.
        //
        // `completed` is a DOCUMENT word being set by whether the invoice was
        // PAID at creation. `settlementDate()` then reads `status ===
        // 'completed'` to decide when it settled, which works only because of
        // that accident.
        //
        // It stays because every screen, filter and export reads this column,
        // and the deprecation flow is three releases: add beside → move
        // readers → remove. Changing it now would move a value under readers
        // that have not been converted.
        //
        // `document_status` below is the correct answer, written alongside.
        status:
          data.paidAmount && data.total && data.paidAmount >= data.total ? 'completed' : 'pending',
        notes: data.notes || '',
        reference: data.reference || '',

        // ⚠️ J3 — `document_status` is deliberately NOT written here.
        //
        // Two reasons. The column defaults to NULL and `invoice_state` reads
        // NULL as `draft`, which is correct at insert time — nothing has been
        // posted yet.
        //
        // And putting it in this insert would make the ENTIRE create path fail
        // with 42703 on a database that has not run phase-j-03. Invoice
        // creation is the one thing that must never depend on an optional
        // column; it is set in a separate, tolerant write once the ledger has
        // actually been written (see `markPosted` below).

        // workspace_id is the tenancy boundary; user_id records the actor.
        workspace_id: workspaceId,
        user_id: userId,
      })
      .select(INVOICE_LIST_COLUMNS)
      .single()

    if (invoiceError || !invoice) throw new DatabaseError('Failed to create invoice', invoiceError)

    // ═══════════════════════════════════════════════════════════════════════
    // ⚠️ APPROVAL IS DECIDED BEFORE THE STOCK MOVES, NOT AFTER.
    //
    // This decision used to run AFTER the items block — which had already
    // called `batchUpdateStock`. So an invoice a rule routed to approval moved
    // the stock once at creation and `postApprovedInvoice` moved it AGAIN at
    // approval: a ten-unit sale removed twenty units, leaving two
    // `stock_movements` rows against one invoice and the ledger's inventory
    // account permanently disagreeing with the shelf.
    //
    // The held branch below claims «nothing was ever booked», and for the
    // ledger that was true — but the goods had already left. A REJECTED
    // invoice therefore took the stock with it and nothing gave it back.
    //
    // ⚠️ IT ALSO READ `data.total` — THE CLIENT'S NUMBER.
    //
    // The approval threshold was compared against a figure the request
    // supplied, so `"total": 1` on a five-million invoice walked past any
    // «anything above X needs a manager» rule. It reads the derived total now,
    // like the document and the ledger do.
    // ═══════════════════════════════════════════════════════════════════════
    const approval = await this.routeForApproval(ctx, invoice.id, money.total, {
      type: data.type,
      currency: data.currency,
      customerId: data.customerId ?? null,
    })

    /** Held for approval: the goods must not move until somebody says so. */
    const isHeld = !mayPostDocument(approval)

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
        // ⚠️ THE INVOICE IS NOT DELETED HERE.
        //
        // It used to be, and that is the forbidden compensating write: with no
        // transaction, the DELETE is a second statement that can fail on its
        // own or never run at all if the process dies — leaving exactly the
        // half-state it was meant to prevent.
        //
        // Deleting it does not even undo the visible damage. The invoice
        // number has already been taken from `get_next_invoice_number`, so the
        // gap in the series exists either way; all the DELETE adds is the loss
        // of the header somebody just entered.
        //
        // So the row stays, with no items, which is a state the invoice screen
        // can show and a person can correct. The error says what happened.
        //
        // ⚠️ THE REAL FIX IS AN RPC. `invoices` + `invoice_items` +
        // `invoice_item_details` + `stock_movements` is one write and belongs
        // in one Postgres function — the pattern this codebase already uses
        // for `product_units_replace`. That is a larger piece of work; this
        // stops the current behaviour making things worse in the meantime.
        throw new DatabaseError(
          `Invoice ${invoiceNumber} was created but its items could not be saved`,
          itemsError,
        )
      }

      await this.insertItemDetails(data.items, insertedItems, invoice.id, workspaceId)

      // A purchase moves stock too — it just moves it the other way. Guarding
      // this on `type === "sale"` meant every purchase left inventory
      // untouched, which is why bought goods never appeared in the warehouse.
      // ⚠️ NOT WHILE THE DOCUMENT IS HELD. `postApprovedInvoice` runs the same
      // call on approval; doing it here too moved every held invoice's stock
      // twice. A document waiting for a decision has had no effect yet — that
      // is what waiting means.
      if (!isHeld) {
        await this.batchUpdateStock(data.items, ctx, data.type === 'purchase' ? 1 : -1, invoice.id)
      }
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
          .eq('workspace_id', workspaceId)
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
    this.invalidateWorkspaceCache(workspaceId)

    // J5 — the half of `invoice.create-then-delete` that was missing.
    //
    // The rule has existed since SoD shipped and could never fire, because
    // nothing ever wrote down that this person raised this invoice. Awaited,
    // unlike the costing chain below: the index has to be in place before the
    // same request could conceivably come back to delete the row.
    await sod.recordAction(ctx, 'invoice.create', 'invoice', invoice.id)

    // Tax, computed by the tax core and FROZEN onto the document.
    //
    // Not `total × rate`: that cannot express a per-item rate, a tax-inclusive
    // retail price, a compound charge or withholding — and it gives a
    // different answer than the tax return does. The snapshot is what lets an
    // invoice written offline reproduce its own figures at sync instead of
    // being silently re-rated.
    this.applyTax(ctx, invoice.id, data).catch((err) =>
      console.error(`[InvoiceService] tax computation failed for ${invoice.id}:`, err),
    )

    // ─── G6 — APPROVAL DECIDES BEFORE ANYTHING IS BOOKED ─────────────────────
    //
    // AWAITED, and ordered before the ledger. These two used to run side by
    // side as unawaited chains: the journal entry was booked while the workflow
    // instance was still at step one, so «در انتظار تأیید» described a document
    // that had already had its full financial effect. Approving it changed a
    // status column; rejecting it changed a status column.
    if (!isHeld) {
      // Costing FIRST, then the ledger: the journal entry needs the cost that
      // was actually consumed, and only the costing core can say what that was.
      // Chaining them also stops a failed costing run from booking a sale with
      // a made-up cost of goods.
      this.applyCosting(ctx, invoice.id, String(data.type ?? 'sale'), data.items ?? [], data.date)
        .then((cogs) =>
          this.createAccountingEntries(ctx, invoice.id, {
            ...data,
            invoiceNumber,
            // The SAME derived total the document carries. Booking
            // `data.total` here is what let a request say «total: 1» on a
            // five-million invoice and have the books believe it.
            total: money.total,
            costOfGoodsSold: cogs,
          }),
        )
        // J3 — `posted` is written HERE and nowhere earlier, because this is
        // the first moment it is true. An invoice marked posted whose ledger
        // write then failed would be a document claiming an effect it does not
        // have, which is exactly the drift V3 in the migration checks for.
        // ⚠️ ONLY WHEN SOMETHING WAS ACTUALLY BOOKED. This used to mark the
        // invoice posted even when the ledger SKIPPED it for a missing account,
        // so the document claimed an entry that did not exist.
        .then((result) =>
          result.status === 'posted' || result.status === 'already_posted'
            ? this.markPosted(ctx, invoice.id)
            : undefined,
        )
        .catch((err) => console.error('Accounting entry failed:', err))
    } else {
      // Held. The invoice exists and is visible — it is a draft, not a hidden
      // row — but nothing irreversible has happened to it. `postApprovedInvoice`
      // runs the costing, the ledger and the stock when the workflow approves.
      //
      // Rejection therefore needs no reversal: nothing was ever booked.
      await supabase
        .from('invoices')
        .update({ status: AWAITING_APPROVAL_STATUS })
        .eq('id', invoice.id)
        .eq('workspace_id', workspaceId)

      console.info(
        `[InvoiceService] invoice ${invoice.id} held for approval; ledger and stock deferred.`,
      )
    }

    // ─── T9 — the money, recorded as money ──────────────────────────────
    await this.recordCreationPayments(ctx, invoice.id, data)

    return this.getById(invoice.id, ctx)
  }

  /**
   * Turn «this was paid at the counter» into real payment records.
   *
   * ---------------------------------------------------------------------
   * WHY THIS IS A SEPARATE STEP AND NOT PART OF THE INSERT
   *
   * A payment is its own document with its own ledger entry. Writing
   * `paid_amount` on the invoice row said the money existed without any
   * record of it arriving — no payment, no allocation, no journal entry, and
   * nothing to reverse if it turned out to be wrong.
   *
   * ---------------------------------------------------------------------
   * ⚠️ A FAILURE HERE DOES NOT DELETE THE INVOICE
   *
   * supabase-js has no transactions and a compensating DELETE is forbidden.
   * It is also the wrong thing: the invoice is real, the goods moved, the
   * ledger was written. What failed is the RECEIPT.
   *
   * So the error is raised to the caller with the invoice left in its true
   * state — created and unpaid. That is honest and repairable: the payment
   * can be added from the invoice's own payments panel. Swallowing the error
   * would put us back where we started, with an invoice whose paid amount
   * nobody can account for.
   */
  private async recordCreationPayments(
    ctx: TenancyContext,
    invoiceId: string,
    data: CreateInvoice,
  ): Promise<void> {
    // Each entry becomes its own payment: one row carrying a blended method
    // would make the till and the bank reconciliation both wrong.
    const tranches =
      data.payments && data.payments.length > 0
        ? data.payments.map((p) => ({
            method: p.method,
            amount: p.amount,
            reference: p.reference ?? data.reference ?? '',
          }))
        : data.paidAmount && data.paidAmount > 0
          ? [
              {
                method: data.paymentMethod ?? 'cash',
                amount: data.paidAmount,
                reference: data.reference ?? '',
              },
            ]
          : []

    if (tranches.length === 0) return

    // A purchase is money going OUT to a supplier; a sale is money coming IN.
    // Getting this backwards would put the payment on the wrong side of the
    // ledger and invert the party's balance.
    const isPurchase = data.type === 'purchase'
    const partyType = isPurchase ? ('supplier' as const) : ('customer' as const)
    const partyId = (isPurchase ? data.supplierId : data.customerId) ?? null

    for (const tranche of tranches) {
      await this.payments.recordPayment(ctx, {
        direction: isPurchase ? 'out' : 'in',
        partyType,
        // null for a walk-in cash sale. `openInvoicesByIds` is what makes this
        // work — the party-based lookup filters `customer_id = null` and
        // matches nothing, which is why there was no working path before.
        partyId,
        amount: tranche.amount,
        entryDate: (data.date ?? new Date().toISOString()).slice(0, 10),
        currency: data.currency ?? 'AFN',
        method: tranche.method,
        reference: tranche.reference,
        notes: '',
        // Explicit: this money settles THIS invoice. Without it the payment
        // would auto-allocate oldest-first and could land on a different
        // invoice entirely.
        allocations: [{ invoiceId, amount: tranche.amount }],
      })
    }
  }

  // ─── Update Invoice ──────────────────────────────────────────────────────
  async update(id: string, ctx: TenancyContext, data: UpdateInvoice) {
    // Workspace alone is not enough here. Before this call, a seller could
    // edit an invoice another seller raised, and a member pinned to one branch
    // could edit another branch's — both by knowing an id. `assertMay` reads
    // the row's own branch and creator and refuses on either.
    await scopes.assertMay(ctx, 'invoice', id, 'invoice.update')

    const { workspaceId, userId } = ctx
    const currentInvoice = await this.getById(id, ctx)

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.status !== undefined) updates.status = data.status

    // J3 — cancellation is the one status change that is unambiguously about
    // the DOCUMENT, so it is mirrored onto the document dimension.
    //
    // The other values are not mirrored, and that is the point of the split:
    // `completed` and `paid` describe settlement and are already derived from
    // `payment_allocations`; translating them here would put the conflation
    // back into the new column.
    //
    // Written through a separate tolerant call rather than added to `updates`,
    // so a database without the column does not fail the whole update.
    const cancelling = data.status === 'cancelled'

    // ─── PHASE F — `paidAmount` is no longer accepted from a PATCH ───────────
    //
    // It used to be written straight through: `updates.paid_amount =
    // data.paidAmount`. That let any client mark an invoice fully paid without
    // a single payment existing — no `payments` row, no allocation, no journal
    // entry, and a receivables report that disagreed with the cash.
    //
    // `paid_amount` is now a projection of `SUM(payment_allocations)`,
    // recomputed by a database trigger. Accepting it here would put a second
    // writer on a derived figure, which is the whole defect class Phases B–F
    // exist to close.
    //
    // Refused loudly rather than ignored: silently dropping a field the caller
    // sent tells them the money was recorded when it was discarded.
    if (data.paidAmount !== undefined) {
      throw new ValidationError(
        'INVOICE_PAID_AMOUNT_IS_DERIVED: record a payment through POST /api/payments; paid_amount is computed from payment allocations and cannot be set directly.',
      )
    }
    if (data.total !== undefined) updates.total = data.total
    if (data.notes !== undefined) updates.notes = data.notes
    if (data.reference !== undefined) updates.reference = data.reference

    const { data: invoice, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(INVOICE_LIST_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update invoice', error)
    if (!invoice) throw new NotFoundError('Invoice')

    if (cancelling) await this.markCancelled(ctx, id)

    // ─── آیتم‌ها و جزئیات ─────────────────────────────────────────────────
    // Only when the caller actually sends items. Omitting `items` keeps this
    // a metadata-only patch, which is what every existing caller does — their
    // behaviour is unchanged.
    if ((data as { items?: unknown[] }).items?.length) {
      await this.replaceInvoiceItems(
        id,
        (data as { items: any[] }).items,
        ctx,
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

    this.invalidateWorkspaceCache(workspaceId)
    return invoice
  }

  // ─── Delete Invoice ──────────────────────────────────────────────────────
  async delete(
    id: string,
    ctx: TenancyContext,
    options: { override?: { reason: string } | undefined } = {},
  ): Promise<void> {
    const { workspaceId } = ctx

    // Checked BEFORE the line items go. Deleting the children first and then
    // discovering the actor may not have the parent would leave an invoice
    // with no lines and no way back.
    await scopes.assertMay(ctx, 'invoice', id, 'invoice.delete')

    // J5 — raising a document and removing it are the two halves of hiding a
    // sale. Same ordering rule as above: refused before anything is destroyed,
    // not after. Silent unless the workspace turned SoD on.
    await sod.assertAllowed(ctx, 'invoice.delete', 'invoice', id, options.override)

    // Written down BEFORE the delete succeeds, so a second attempt by the same
    // person is still seen even if the first half-failed. `recordAction` never
    // throws — a missing index weakens a future check, it does not fail work.
    await sod.recordAction(ctx, 'invoice.delete', 'invoice', id)

    await supabase.from('invoice_items').delete().eq('invoice_id', id)
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)
    if (error) throw new DatabaseError('Failed to delete invoice', error)
    this.invalidateWorkspaceCache(workspaceId)
  }

  // ─── Invalidate Cache ────────────────────────────────────────────────────
  private invalidateWorkspaceCache(workspaceId: string) {
    memoryCache.invalidate(`dashboard:v2:${workspaceId}`)
    memoryCache.invalidate(`sales:${workspaceId}`)
    memoryCache.invalidate(`insights:${workspaceId}`)
    memoryCache.invalidate(`invoices:${workspaceId}`)
    memoryCache.invalidate(`customers:${workspaceId}`)
    memoryCache.invalidate(`products:${workspaceId}`)
  }

  // ─── Get Summary ─────────────────────────────────────────────────────────
  async getSummary(ctx: TenancyContext) {
    const { workspaceId } = ctx
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // ⚠️ AGGREGATED IN POSTGRES FIRST. The row path below is capped by
    // PostgREST max-rows (1000) and runs only while `invoices_summary_kpis`
    // is not installed.
    const aggregate = await fetchInvoiceSummaryAggregate(workspaceId, today, tomorrow)
    if (aggregate) return aggregate

    const { data: allInvoices, error: invoicesError } = await supabase
      .from('invoices')
      // ⚠️ `date`, NOT `created_at`.
      //
      // `created_at` is NULLABLE and is null on real production rows: the
      // schema files declare `DEFAULT now()`, but they create the table with
      // `CREATE TABLE IF NOT EXISTS`, so on a database where `invoices`
      // already existed the default was never added and nothing failed.
      //
      // `null >= '2026-09-12T00:00:00Z'` is false, so every such invoice fell
      // out of the filter below and «فروش امروز» read zero on a day with
      // sales. Silent, and it looks exactly like a shop that sold nothing.
      //
      // `date` is `NOT NULL` and is the business date of the document, which
      // is the right thing to ask «was this sold today» about anyway — an
      // invoice entered tonight for yesterday's sale belongs to yesterday.
      .select('total, paid_amount, status, date, type')
      .eq('workspace_id', workspaceId)

    // §7 #3 — a failed read is not «no sales, no debt». These errors used to be
    // dropped, so a broken query rendered as a row of zeros.
    if (invoicesError) throw new DatabaseError('Failed to summarise invoices', invoicesError)

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('quantity, min_stock_level')
      .eq('workspace_id', workspaceId)

    if (productsError) throw new DatabaseError('Failed to count low stock', productsError)

    // «فروش امروز» و «بدهی» فقط از فروش می‌آیند. فاکتور خرید نه فروش است و نه
    // طلب ما از مشتری. فاکتورهای قدیمیِ بدون type فروش در نظر گرفته می‌شوند تا
    // معنایشان عوض نشود.
    const invoices = (allInvoices || []).filter((i: any) => i.type !== 'purchase')
    const purchases = (allInvoices || []).filter((i: any) => i.type === 'purchase')

    const todaySales = invoices
      .filter((i: any) => isOnDay(i.date, today, tomorrow))
      .reduce((sum: number, i: any) => sum + (i.total || 0), 0)

    const todayPurchases = purchases
      .filter((i: any) => isOnDay(i.date, today, tomorrow))
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
    workspaceId: string,
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
    if (!error) return

    /**
     * A server whose `unified-sale-purchase-migration.sql` has not been applied
     * has the details table but not its optional columns, and PostgREST answers
     * PGRST204 "Could not find the 'unit_label' column".
     *
     * That must not take the whole invoice down. `unit_label` and
     * `weight_grams` decorate a component; `title`, `quantity` and `amount`
     * ARE the component. So the optional pair is dropped and the insert is
     * retried, which keeps every figure on the invoice intact and loses only
     * two labels that the schema has nowhere to put yet.
     *
     * A failure of the retry is a real failure and still rolls the invoice
     * back — a line whose components vanished is worse than no invoice.
     */
    const missingColumn =
      error.code === 'PGRST204' || error.code === '42703' || /column/i.test(error.message ?? '')

    if (missingColumn) {
      console.warn(
        '[InvoiceService] invoice_item_details is missing unit_label/weight_grams — ' +
          'run unified-sale-purchase-migration.sql. Saving components without them.',
      )

      const reduced = rows.map(({ unit_label: _label, weight_grams: _weight, ...rest }) => rest)
      const retry = await supabase.from('invoice_item_details').insert(reduced)
      if (!retry.error) return
    }

    // Scoped even though this id came from the insert we just performed. A
    // DELETE on a financial table with `.eq('id', …)` alone is exactly the
    // shape that becomes an IDOR the moment the id starts arriving from a
    // caller instead of from the line above.
    await supabase.from('invoices').delete().eq('id', invoiceId).eq('workspace_id', workspaceId)
    throw new DatabaseError('Failed to create invoice item details', error)
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
    ctx: TenancyContext,
    type: string,
  ): Promise<void> {
    const { userId } = ctx
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
      await this.batchUpdateStock(reversal, ctx, (direction * -1) as 1 | -1, invoiceId)

      // Give the consumed cost layers their quantities back before the old
      // lines are deleted. Without this an edited sale keeps holding stock it
      // no longer sells, and the layers it drew from stay short for good.
      if (direction === -1) {
        await costing
          .releaseDocument(ctx, 'invoice', invoiceId)
          .catch((err) => console.error('[InvoiceService] cost release failed:', err))
      } else {
        // A purchase edit would have to unwind layers that later sales may
        // already have consumed. That is a revaluation, not a release, and it
        // belongs with the backdated-entry work rather than being faked here.
        console.warn(
          `[InvoiceService] purchase ${invoiceId} edited: existing cost layers were left as they are`,
        )
      }
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

    await this.insertItemDetails(items, inserted, invoiceId, ctx.workspaceId)
    await this.batchUpdateStock(items, ctx, direction, invoiceId)

    // The new lines carry new ids, so the costing keys differ from the ones
    // just released and the goods move again rather than being deduplicated
    // against the old document.
    await this.applyCosting(ctx, invoiceId, type, items)
  }

  // ─── Batch Update Stock ──────────────────────────────────────────────────
  /**
   * Apply an invoice's items to inventory.
   *
   * `direction` is +1 for a purchase (stock arrives) and -1 for a sale (stock
   * leaves). It is the ONLY thing that differs between the two transaction
   * types — the lookup, the movement rows and the write path are shared.
   *
   * ⚠️ `invoiceId` — H4.
   *
   * These rows were written with `reference_type: 'invoice'` and NO
   * `reference_id`. Every sale movement said it came from an invoice and could
   * not say which one. `purchasing.service` and `manufacturing.service` both
   * write their reference id; this was the only writer that did not, so a
   * product's stock history had a hole exactly where sales are.
   *
   * That matters more since Phase C: `stock_movements` IS the quantity now, so
   * when an on-hand figure looks wrong these rows are the only place the answer
   * lives — and half of them named no document.
   */
  /**
   * The warehouse a sale leaves from, when there is only one it could be.
   *
   * ---------------------------------------------------------------------------
   * ⚠️ SALES MOVED NO WAREHOUSE STOCK AT ALL.
   *
   * Movements written here carried neither `from_warehouse_id` nor
   * `to_warehouse_id`. The Phase C trigger maintains TWO figures from them:
   *
   *     products.quantity        ← updated for any non-transfer movement
   *     warehouse_stock.quantity ← updated ONLY when the movement names a warehouse
   *
   * `warehouse.service.ts` reads `warehouse_stock`. So selling reduced the
   * product total and left the warehouse figure untouched for ever — the shelf
   * said the goods were still there, and the two numbers drifted apart by
   * exactly everything that had ever been sold.
   *
   * ⚠️ AND THE AMBIGUOUS CASE IS NOT GUESSED.
   *
   * With several warehouses, nothing on an invoice line says which building the
   * goods left. Picking one would move stock in a warehouse the goods were
   * never in — a wrong figure in the source of truth, written confidently. With
   * exactly one warehouse there is no choice to make, and that is the only case
   * this resolves. Zero or several leaves the movement unattributed, exactly as
   * before, and the product total still moves.
   */
  private async soleWarehouseId(workspaceId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('warehouses')
      .select('id')
      .eq('workspace_id', workspaceId)
      .limit(2)

    // A failed lookup is «unknown», not «none» — but both leave the movement
    // unattributed, which is the safe direction: the product total still moves
    // and no warehouse is debited on a guess.
    if (error || !data || data.length !== 1) return null

    return (data[0] as { id: string }).id
  }

  private async batchUpdateStock(
    items: any[],
    ctx: TenancyContext,
    direction: 1 | -1 = -1,
    invoiceId?: string | undefined,
  ) {
    const { workspaceId, userId } = ctx
    if (!items || items.length === 0) return

    const productIds = items.filter((item) => item.productId).map((item) => item.productId)

    if (productIds.length === 0) return

    // ⚠️ SECURITY — scoped to the workspace. Without this filter an invoice
    // could name another shop's product id and move THEIR inventory: the
    // update below writes a new quantity keyed only by product id. Products
    // outside this workspace simply do not enter productMap, so the filtered
    // map below silently skips them.
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, quantity')
      .eq('workspace_id', workspaceId)
      .in('id', productIds)

    if (productsError) {
      throw new DatabaseError('Failed to fetch products for stock update', productsError)
    }

    const productMap = new Map()
    for (const product of products) {
      productMap.set(product.id, product.quantity)
    }

    // ─── L1 — MULTI-UOM: the line's unit becomes the BASE quantity ──────────
    //
    // «2 cartons» must reach `stock_movements` as «48 pieces». The conversion
    // is here, in the service, and NOT in the UI — the spec's own warning. A
    // conversion enforced on screen is absent from the API, the importer, the
    // mobile app and every offline write that syncs in later.
    //
    // ⚠️ A product with NO declared units converts by 1, which is every
    // product that existed before L1. See unit-conversion.domain.ts: driving
    // this off `units.conversion_factor` instead would re-read every
    // historical «5 kg» line as 5000 and corrupt the source of truth for every
    // weighed product.
    const unitOptions = await this.loadProductUnits(workspaceId, productIds)

    // Which warehouse the goods leave from / arrive at, when unambiguous.
    const warehouseId = await this.soleWarehouseId(workspaceId)

    // ─── PHASE C — the movement IS the update ────────────────────────────────
    //
    // This used to read each product's quantity, add the delta in Node, and
    // write the result back. Three defects in four lines, none of which raised
    // an error:
    //
    //   * read-then-write (lesson 14). Two concurrent sales of the last unit
    //     both read "1 available" and both wrote "0", so one unit was sold
    //     twice and the shortfall never appeared anywhere.
    //   * `Math.max(0, …)` clamped a shortfall to zero (lesson 15), destroying
    //     the only evidence that stock had been oversold.
    //   * it made `products.quantity` a fourth writer of a figure that
    //     purchasing and manufacturing were separately overwriting from the
    //     cost layers. Whichever ran last won.
    //
    // `stock_movements` is now the source of truth and the projection trigger
    // maintains `products.quantity` and `warehouse_stock` from it — inside the
    // database, so the increment is atomic and cannot be raced. Nothing here
    // needs to know the current quantity at all.
    //
    // A shortfall is no longer clamped: if a sale takes stock below zero, the
    // movement records that truthfully and the negative figure is visible.
    // That is information, not corruption — and it is how someone finds out
    // their count was wrong.

    const movements = items
      // Products outside this workspace never entered productMap, so naming
      // another shop's product id moves nothing (lesson 17).
      .filter((item) => item.productId && productMap.has(item.productId))
      .map((item) => {
        // L1 — the line's own unit, converted to the product's base.
        //
        // ⚠️ REFUSED, not silently passed through, when the unit is not one
        // the product declares: storing a carton count as a piece count is a
        // wrong quantity in the source of truth that nothing would flag.
        const converted = toBaseQuantity(
          Number(item.quantity) || 0,
          item.unit ?? null,
          unitOptions.get(item.productId) ?? [],
        )

        if (!converted.ok) {
          throw new ValidationError(`${converted.code}: product ${item.productId}`)
        }

        return {
          product_id: item.productId,
          // The movement must name the transaction that caused it. Hardcoding
          // "sale" made every stock movement look like a sale in reports.
          type: direction === 1 ? 'purchase' : 'sale',
          quantity: direction * converted.baseQuantity,
          reference_type: 'invoice',
          // H4 — WHICH invoice. Omitted before, so `reference_type` named a kind
          // of document and nothing could reach the document itself.
          //
          // `?? null` rather than dropping the key: an explicit null records
          // «this movement has no document» honestly, and is what the column
          // already holds for every historical row. Guessing one would be worse
          // (§12) — old rows stay unknown.
          reference_id: invoiceId ?? null,
          // A sale leaves a warehouse; a purchase arrives at one. Null when the
          // workspace has zero or several — see soleWarehouseId().
          ...(warehouseId
            ? direction === 1
              ? { to_warehouse_id: warehouseId }
              : { from_warehouse_id: warehouseId }
            : {}),
          workspace_id: workspaceId,
          user_id: userId,
        }
      })

    if (movements.length > 0) {
      const { error: movementError } = await supabase.from('stock_movements').insert(movements)

      // This insert used to be fire-and-forget, which was survivable while
      // `products.quantity` was written separately. It is not survivable now:
      // the movement is the only thing that moves stock, so swallowing the
      // error means the invoice exists and the goods never left (lesson 4).
      if (movementError) {
        throw new DatabaseError('Failed to record stock movements', movementError)
      }

      // ─── M2 — did this sale take stock below zero? ────────────────────────
      //
      // Two tills selling the last units concurrently, or one sale exceeding
      // what is on the shelf. BOTH sales stay recorded: M2.4 forbids silent
      // reject, overwrite, delete and stock correction. The negative on-hand
      // stays visible — Phase C already treats it as information — and a
      // conflict goes to a person.
      //
      // Read back rather than predicted: the quantity is maintained by the
      // projection trigger, and computing it here would be the read-modify-
      // write Phase C removed.
      if (direction === -1 && invoiceId) {
        await this.flagNegativeStock(ctx, invoiceId, movements)
      }
    }
  }

  /**
   * M2 — file a conflict for every product this sale pushed below zero.
   *
   * ⚠️ NEVER THROWS. The sale is already recorded and the money is already
   * taken; failing to FILE the conflict must not undo it. A swallowed error
   * here costs the warning, not the record — the negative stock is still
   * visible in the product list and in H4's movement history either way.
   */
  private async flagNegativeStock(
    ctx: TenancyContext,
    invoiceId: string,
    movements: { product_id: string; quantity: number }[],
  ): Promise<void> {
    try {
      const productIds = [...new Set(movements.map((m) => m.product_id))]

      const { data, error } = await supabase
        .from('products')
        .select('id, quantity')
        .eq('workspace_id', ctx.workspaceId)
        .in('id', productIds)
        .lt('quantity', 0)

      if (error || !data || data.length === 0) return

      const soldByProduct = new Map<string, number>()
      for (const movement of movements) {
        soldByProduct.set(
          movement.product_id,
          (soldByProduct.get(movement.product_id) ?? 0) + Math.abs(movement.quantity),
        )
      }

      const breaches = detectBreaches(
        data.map((product) => ({
          productId: String(product.id),
          onHandAfter: Number(product.quantity) || 0,
          quantitySold: soldByProduct.get(String(product.id)) ?? 0,
          // The online path has no «what the device believed» — it read the
          // live figure. Left null rather than filled with the current
          // quantity, which would be a fabricated belief (§12).
          deviceBelievedOnHand: null,
        })),
      )

      for (const breach of breaches) {
        // Keyed by the INVOICE, so re-saving the same invoice updates the same
        // conflict instead of filing another (M2.5).
        await conflicts.recordStockBreach(
          { workspaceId: ctx.workspaceId, userId: ctx.userId },
          { productId: breach.productId, mutationId: invoiceId, breach },
        )
      }
    } catch (err) {
      console.error('[Invoice] negative stock detected but the conflict was not filed:', err)
    }
  }

  /**
   * L1 — the units each product may be traded in.
   *
   * ⚠️ AN EMPTY MAP IS THE CORRECT ANSWER, NOT A FAILURE.
   *
   * `product_units` is opt-in: no rows means the product is single-unit and
   * its quantity is already the base, which is every product that existed
   * before L1. A missing TABLE means the same thing on a database that has not
   * run phase-l-02 — so a 42P01 returns an empty map rather than failing the
   * invoice. Refusing to sell because a units table is absent would be a far
   * worse failure than not converting.
   */
  private async loadProductUnits(
    workspaceId: string,
    productIds: string[],
  ): Promise<Map<string, ProductUnitOption[]>> {
    const byProduct = new Map<string, ProductUnitOption[]>()
    if (productIds.length === 0) return byProduct

    const { data, error } = await supabase
      .from('product_unit_options')
      .select(
        'product_id, unit_id, unit_code, conversion_factor_to_base, is_base_unit, is_purchase_default, is_sale_default',
      )
      .eq('workspace_id', workspaceId)
      .in('product_id', productIds)

    if (error) {
      const missing = error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703'
      if (missing) return byProduct
      throw new DatabaseError('Failed to load product units', error)
    }

    for (const row of data ?? []) {
      const list = byProduct.get(row.product_id) ?? []
      list.push({
        unitId: String(row.unit_id),
        unitCode: String(row.unit_code),
        conversionFactorToBase: Number(row.conversion_factor_to_base) || 1,
        isBaseUnit: Boolean(row.is_base_unit),
        isPurchaseDefault: Boolean(row.is_purchase_default),
        isSaleDefault: Boolean(row.is_sale_default),
      })
      byProduct.set(row.product_id, list)
    }

    return byProduct
  }

  // ─── Tax ─────────────────────────────────────────────────────────────────
  /**
   * Compute the document's tax and freeze what produced it.
   *
   * Writes three things: the money figures in MINOR UNITS (so a hundred-line
   * invoice foots exactly), one `invoice_tax_lines` row per component (which
   * is what a return is filed from, written once and never recomputed on
   * read), and the snapshot itself.
   */
  private async applyTax(
    ctx: TenancyContext,
    invoiceId: string,
    data: {
      type?: string | undefined
      date?: string | undefined
      items?: any[] | undefined
      customerId?: string | null | undefined
    },
  ): Promise<void> {
    const items = (data.items ?? []).filter((item) => Number(item?.quantity) > 0)
    if (items.length === 0) return

    const entryDate = (data.date ? String(data.date) : new Date().toISOString()).slice(0, 10)

    const { computed, snapshot } = await tax.computeAndFreeze(ctx, {
      date: entryDate,
      lines: items.map((item, index) => ({
        lineId: String(item.id ?? index),
        productId: item.productId ?? null,
        categoryId: item.categoryId ?? null,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        discount: Number(item.discount) || 0,
      })),
    })

    // No rule matched any line: this workspace has not configured tax. That is
    // a legitimate state — not every shop here is registered — and it must not
    // write empty rows that would appear on a return as zero-rated turnover.
    const hasTax = computed.summary.length > 0
    if (!hasTax) return

    const { error } = await supabase
      .from('invoices')
      .update({
        net_minor: computed.netMinor,
        tax_minor: computed.taxMinor,
        withholding_minor: computed.withholdingMinor,
        total_minor: computed.totalMinor,
        rounding_residual_minor: computed.roundingResidualMinor,
        tax_snapshot: snapshot,
        tax_config_version: snapshot.configVersion,
      })
      .eq('id', invoiceId)
      .eq('workspace_id', ctx.workspaceId)

    if (error) throw new DatabaseError('Failed to store the computed tax', error)

    const direction = data.type === 'purchase' ? 'purchase' : 'sale'

    // Upserted on (invoice, component, rate) so a retry rewrites the same rows
    // rather than doubling the turnover on a tax return.
    const { error: linesError } = await supabase.from('invoice_tax_lines').upsert(
      computed.summary.map((row) => ({
        workspace_id: ctx.workspaceId,
        invoice_id: invoiceId,
        component_id: row.componentId,
        label_key: row.labelKey,
        treatment: row.treatment,
        rate: row.rate,
        base_minor: row.baseMinor,
        amount_minor: row.amountMinor,
        direction,
        entry_date: entryDate,
      })),
      { onConflict: 'workspace_id,invoice_id,component_id,rate' },
    )

    if (linesError) throw new DatabaseError('Failed to store the tax breakdown', linesError)
  }

  // ─── Costing ─────────────────────────────────────────────────────────────
  /**
   * Move the invoice's goods through the costing core and return what the sale
   * cost.
   *
   * A purchase RECEIVES: each line becomes a cost layer holding what was paid
   * for it, so a later sale can be priced from the purchase it actually drew
   * from.
   *
   * A sale ISSUES: the costing core consumes the oldest layers first and says
   * what they were worth. That figure — and nothing else — is the cost of
   * goods sold.
   *
   * Both directions are idempotent per invoice line, so a retry does not
   * receive the same goods twice or sell the same units twice.
   */
  private async applyCosting(
    ctx: TenancyContext,
    invoiceId: string,
    type: string,
    items: any[],
    date?: string,
  ): Promise<number> {
    const entryDate = date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10)
    // Lines without a product are services; they hold no stock and cost
    // nothing to deliver from inventory.
    const stocked = (items ?? []).filter((item) => item?.productId && Number(item.quantity) > 0)
    if (stocked.length === 0) return 0

    let costOfGoodsSold = 0

    for (const [index, item] of stocked.entries()) {
      const quantity = Number(item.quantity) || 0
      // The line index makes two lines of the same product on one invoice
      // distinct, which is what keeps the idempotency key honest.
      const line = String(item.id ?? index)

      try {
        if (type === 'purchase') {
          const lineTotal = Number(item.totalPrice) || quantity * (Number(item.unitPrice) || 0)
          await costing.recordReceipt(ctx, {
            productId: item.productId,
            warehouseId: item.warehouseId ?? null,
            quantity,
            // What was actually paid per unit, after the line discount. The
            // list price would overstate the layer and every profit drawn
            // from it.
            unitCost: quantity > 0 ? lineTotal / quantity : 0,
            entryDate,
            sourceType: 'invoice',
            sourceId: invoiceId,
            sourceLine: line,
          })
        } else {
          const result = await costing.recordIssue(ctx, {
            productId: item.productId,
            warehouseId: item.warehouseId ?? null,
            quantity,
            entryDate,
            consumerType: 'invoice',
            consumerId: invoiceId,
            consumerLine: line,
          })
          costOfGoodsSold += result.totalCost
        }
      } catch (err) {
        // One line failing must not silently cost the whole invoice nothing.
        // The invoice already exists; what is reported here is that its books
        // are incomplete, which is a fact somebody has to see.
        console.error(`[InvoiceService] costing failed for invoice ${invoiceId} line ${line}:`, err)
        throw err
      }
    }

    return Math.round(costOfGoodsSold * 100) / 100
  }

  // ─── Accounting Entries ──────────────────────────────────────────────────
  /**
   * Book the invoice in the ledger, through the accounting core's port.
   *
   * What this method used to do, and no longer does:
   *
   *   It looked accounts up by the literal codes '1000', '1200', '2000',
   *   '4000' and '5000'. A shop that numbered its chart of accounts any other
   *   way got no entries at all, and was never told.
   *
   *   It stamped `user_id` on the journal rows and no workspace, so the very
   *   entries it wrote were invisible to the accounting screens, which read
   *   the ledger by workspace.
   *
   *   It inserted the header, inserted the lines, and DELETED the header if
   *   the second insert failed. A crash in between left a header with no lines
   *   in the books permanently.
   *
   *   It had no idempotency: posting the same invoice twice booked its revenue
   *   twice.
   *
   * All four are now the ledger's problem, which is where they belong. This
   * method only says what happened in accounting terms.
   */
  private async createAccountingEntries(
    ctx: TenancyContext,
    invoiceId: string,
    data: {
      type: string
      total: number
      items?: any[]
      invoiceNumber?: string
      date?: string
      /**
       * What the goods actually cost, from the consumed cost layers. Passed in
       * rather than computed here: this method has no business deciding which
       * purchase a sale drew from, and when it tried, it used the product's
       * CURRENT buy price for goods bought at a different one.
       */
      costOfGoodsSold?: number
    },
  ): Promise<LedgerPostResult> {
    const isPurchase = data.type === 'purchase'
    const total = Number(data.total) || 0
    if (total <= 0) return { status: 'nothing_to_post' }

    const needed: AccountRole[] = isPurchase
      ? ['inventory', 'payable']
      : ['receivable', 'sales', 'cogs', 'inventory']

    const { accounts, missing } = await ledger.ensureAccountsForRoles(ctx, needed)

    if (missing.length > 0) {
      // Not an error the shopkeeper caused, and not a reason to refuse the
      // invoice — but it is not silence either. Their books will have a gap
      // until the chart of accounts names these roles.
      console.warn(
        `[InvoiceService] invoice ${invoiceId} not booked: no account for ${missing.join(', ')}`,
      )
      return { status: 'skipped', missing: missing.map(String) }
    }

    const lines: DraftLine[] = isPurchase
      ? [
          // Goods arrived and we owe the supplier. No revenue is involved —
          // the version before this booked one, which inflated the income
          // statement by the value of every purchase.
          { accountId: accounts.inventory!, debit: total, credit: 0 },
          { accountId: accounts.payable!, debit: 0, credit: total },
        ]
      : [
          { accountId: accounts.receivable!, debit: total, credit: 0 },
          { accountId: accounts.sales!, debit: 0, credit: total },
        ]

    // Cost of goods sold, as the costing core actually consumed it.
    //
    // This block used to price the goods at `products.buy_price` — the CURRENT
    // buy price. A phone bought at 10,000,000 and later restocked at 9,000,000
    // had both of its sales reported at 9,000,000, overstating the profit on
    // the first by a million with nothing in the system able to say so.
    if (!isPurchase) {
      const cost = Number(data.costOfGoodsSold) || 0
      if (cost > 0) {
        lines.push(
          { accountId: accounts.cogs!, debit: cost, credit: 0 },
          { accountId: accounts.inventory!, debit: 0, credit: cost },
        )
      }
    }

    const outcome = await ledger.postDocument(ctx, {
      sourceType: 'invoice',
      sourceId: invoiceId,
      date: data.date ? data.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      description: `${isPurchase ? 'فاکتور خرید' : 'فاکتور فروش'} ${
        data.invoiceNumber || invoiceId.slice(0, 8)
      }`,
      reference: data.invoiceNumber || invoiceId,
      lines,
    })

    if (outcome.status === 'skipped') {
      console.warn(
        `[InvoiceService] invoice ${invoiceId} not booked: ${outcome.missing.join(', ')}`,
      )
      return { status: 'skipped', missing: outcome.missing.map(String) }
    }
    return { status: outcome.status === 'already_posted' ? 'already_posted' : 'posted' }
  }

  /**
   * Post an existing invoice to the ledger — the retry for one whose automatic
   * posting at creation did not happen.
   *
   * ⚠️ WHY THIS EXISTS. Posting at creation runs after the response, and its
   * failures were only a console line: a missing receivable/sales account, a
   * closed period, anything. The invoice then said «not in the ledger» with no
   * reason and no way to try again. This returns the real reason and can be
   * re-run.
   *
   * Safe to repeat: costing is idempotent per invoice line, and the ledger
   * refuses a second entry for the same source (`already_posted`).
   */
  /**
   * Post every invoice in the workspace that has no journal entry yet.
   *
   * The history case: invoices issued while posting was being skipped (no
   * chart of accounts) never reached the ledger, so the journal, trial
   * balance, balance sheet and P&L stayed empty. Idempotent — an invoice
   * already booked comes back `already_posted` and nothing is written twice.
   * Read in ordered 1000-row pages so PostgREST's row cap cannot drop any.
   */
  async postAllUnposted(ctx: TenancyContext): Promise<{
    checked: number
    posted: number
    skipped: Array<{ invoiceId: string; status: string; detail: string }>
  }> {
    const PAGE = 1000
    const ids: string[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, status')
        .eq('workspace_id', ctx.workspaceId)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw new DatabaseError('Failed to list invoices for posting', error)
      const rows = data ?? []
      for (const row of rows) {
        if (row.status !== 'cancelled' && row.status !== AWAITING_APPROVAL_STATUS) ids.push(row.id)
      }
      if (rows.length < PAGE) break
    }

    let posted = 0
    const skipped: Array<{ invoiceId: string; status: string; detail: string }> = []
    for (const id of ids) {
      try {
        const result = await this.postToLedger(id, ctx)
        if (result.status === 'posted') posted++
        else if (result.status === 'skipped')
          skipped.push({ invoiceId: id, status: 'skipped', detail: result.missing.join(', ') })
        else if (result.status === 'not_postable')
          skipped.push({ invoiceId: id, status: 'not_postable', detail: result.reason })
      } catch (err) {
        // One bad invoice must not stop the rest; its reason is reported.
        skipped.push({
          invoiceId: id,
          status: 'error',
          detail: err instanceof Error ? err.message : String(err),
        })
      }
    }
    return { checked: ids.length, posted, skipped }
  }

  async postToLedger(id: string, ctx: TenancyContext): Promise<LedgerPostResult> {
    await scopes.assertMay(ctx, 'invoice', id, 'invoice.update')
    const invoice: any = await this.getById(id, ctx)

    const status = String(invoice?.status ?? '')
    if (status === 'cancelled' || status === AWAITING_APPROVAL_STATUS) {
      return { status: 'not_postable', reason: status }
    }

    const type = String(invoice?.type ?? 'sale')
    const items = asArray(invoice?.items ?? invoice?.invoice_items).map((item: any) => ({
      id: item.id,
      productId: item.productId ?? item.product_id ?? null,
      warehouseId: item.warehouseId ?? item.warehouse_id ?? null,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice ?? item.unit_price) || 0,
      totalPrice: Number(item.totalPrice ?? item.total_price) || 0,
    }))
    const date = String(invoice?.date ?? '')

    const cogs = await this.applyCosting(ctx, id, type, items, date || undefined)
    const result = await this.createAccountingEntries(ctx, id, {
      type,
      total: Number(invoice?.total) || 0,
      items,
      invoiceNumber: invoice?.invoiceNumber ?? invoice?.invoice_number,
      ...(date ? { date } : {}),
      costOfGoodsSold: cogs,
    })

    if (result.status === 'posted' || result.status === 'already_posted') {
      await this.markPosted(ctx, id)
    }
    return result
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
  /**
   * G6 — route for approval, and say whether the document is HELD.
   *
   * ⚠️ RETURNS A DECISION NOW. It used to return `void` and be called
   * fire-and-forget beside the ledger chain, so the journal entry was booked
   * while the workflow instance was still at step one — «در انتظار تأیید» was a
   * label on a document that had already had its full financial effect.
   *
   * The caller awaits this and does not post when it says `hold`.
   */
  private async routeForApproval(
    ctx: TenancyContext,
    invoiceId: string,
    total: number,
    data?: {
      type?: string | undefined
      currency?: string | undefined
      customerId?: string | null | undefined
    },
  ): Promise<ApprovalOutcome> {
    const { workspaceId } = ctx
    try {
      // ⚠️ TWO DEFECTS THIS REPLACES.
      //
      // The `workflows` query had NO WORKSPACE FILTER, so the first active
      // invoice workflow in the entire database started approvals on every
      // shop's invoices.
      //
      // And it was unconditional: `total` was accepted as an argument and then
      // never read, so "invoices over 5,000,000 need the manager" was
      // impossible to express — every invoice, of every size, went to
      // approval. Which chain, and whether one is needed at all, is now a
      // RULE the business writes, not a hardcoded "the first one we find".
      const decision = await rules.evaluate(ctx, 'invoice', {
        invoice: { total, type: data?.type, currency: data?.currency },
        customer: { id: data?.customerId },
      })

      if (!decision.requiresApproval) return { kind: 'post_now' }

      // Only templates that actually exist, in THIS workspace, and are active.
      // A rule naming a deleted or foreign template must not hold a document
      // hostage to an approval nobody can grant — see `decideApproval`.
      const startable: string[] = []

      for (const workflowId of decision.workflowIds) {
        const { data: workflows } = await supabase
          .from('workflows')
          .select('id')
          .eq('id', workflowId)
          .eq('workspace_id', workspaceId)
          .eq('entity_type', 'invoice')
          .eq('is_active', true)
          .is('deleted_at', null)
          .limit(1)

        if (workflows?.[0]) startable.push(workflows[0].id)
      }

      const outcome = decideApproval({
        requiresApproval: decision.requiresApproval,
        workflowIds: startable,
      })

      if (outcome.kind === 'post_now') {
        // A rule demanded approval and named nothing that can grant it. Posting
        // is the safer failure — holding would strand the document with no
        // route out — but it IS a misconfiguration and is said out loud.
        console.warn(
          `[InvoiceService] invoice ${invoiceId}: a rule required approval but no active workflow matched. Posting without approval.`,
        )
        return outcome
      }

      for (const workflowId of outcome.workflowIds) {
        await this.workflowService.startWorkflow(workspaceId, {
          workflow_id: workflowId,
          entity_type: 'invoice',
          entity_id: invoiceId,
        })
      }

      return outcome
    } catch (err) {
      // ⚠️ POSTS ON FAILURE, LOUDLY.
      //
      // If the approval routing itself breaks — the rules engine is down, the
      // workflow insert fails — the choice is between an invoice that posts
      // without the approval it should have had, and an invoice frozen forever
      // with no workflow instance and therefore no way for anyone to release
      // it.
      //
      // The second is worse: it is indistinguishable from "waiting on a
      // colleague" and there is no screen anywhere that would show the
      // difference. Posting leaves a wrong entry that CAN be reversed; the
      // freeze leaves a shop unable to invoice.
      console.error(`[InvoiceService] approval routing failed for ${invoiceId}:`, err)
      return { kind: 'post_now' }
    }
  }

  /**
   * J3 — record that this document is now POSTED.
   *
   * Called only after the journal entry has actually been written. `posted` is
   * a claim about the ledger, and a document claiming it without an entry
   * behind it is the drift the migration's V3 query looks for.
   *
   * ⚠️ Tolerates the column being absent. On a database that has not run
   * phase-j-03 this is a no-op rather than an error: the invoice is posted
   * either way, and `invoice_state` falls back to reading the ledger directly.
   * Failing here would turn a missing optional column into a failed sale.
   */
  private async markPosted(ctx: TenancyContext, invoiceId: string): Promise<void> {
    await this.setDocumentStatus(ctx, invoiceId, 'posted')
  }

  /** J3 — a cancelled document, on the dimension that means it. */
  private async markCancelled(ctx: TenancyContext, invoiceId: string): Promise<void> {
    await this.setDocumentStatus(ctx, invoiceId, 'cancelled')
  }

  private async setDocumentStatus(
    ctx: TenancyContext,
    invoiceId: string,
    value: 'draft' | 'posted' | 'cancelled',
  ): Promise<void> {
    const { error } = await supabase
      .from('invoices')
      .update({ document_status: value })
      .eq('id', invoiceId)
      .eq('workspace_id', ctx.workspaceId)

    if (!error) return

    if (isMissingSchemaError(error)) {
      console.warn(
        '[InvoiceService] invoices.document_status not migrated; skipping. Run docs/phase-j-03-document-status-migration.sql.',
      )
      return
    }

    // Not fatal — the money is booked and that is what matters — but not
    // silent either: the column now disagrees with the ledger.
    console.error(
      `[InvoiceService] failed to set document_status=${value} on ${invoiceId}:`,
      error.message,
    )
  }

  /**
   * G6 — post a document whose approval has just completed.
   *
   * Called by the workflow service when an instance reaches `approved`. This is
   * the other half of the gate: without it, approving a document would move a
   * status column and still never book anything.
   *
   * Idempotent by construction — the ledger port is idempotent per
   * (sourceType, sourceId), so a replayed approval books nothing twice.
   */
  async postApprovedInvoice(ctx: TenancyContext, invoiceId: string): Promise<void> {
    const invoice = await this.getById(invoiceId, ctx)
    if (!invoice) throw new NotFoundError('Invoice')

    const raw = invoice as Record<string, any>

    // ⚠️ `invoice_items`, and mapped to camelCase.
    //
    // `getById` returns the embed under its DATABASE name with database column
    // names, while `applyCosting` and `batchUpdateStock` both read
    // `item.productId`. Passing the rows through unmapped type-checks fine and
    // silently does nothing: every row fails the `item?.productId` filter, so
    // the costing consumes no layers and the stock never moves — an approved
    // invoice with no effect, which is the exact failure this whole gate
    // exists to prevent.
    const items = ((raw.invoice_items ?? raw.items ?? []) as Record<string, any>[]).map((item) => ({
      ...item,
      productId: item.productId ?? item.product_id,
      quantity: Number(item.quantity) || 0,
      unitPrice: item.unitPrice ?? item.unit_price,
      totalPrice: item.totalPrice ?? item.total_price,
    }))

    const cogs = await this.applyCosting(
      ctx,
      invoiceId,
      String(raw.type ?? 'sale'),
      items,
      raw.date,
    )

    await this.createAccountingEntries(ctx, invoiceId, {
      invoiceNumber: raw.invoice_number ?? raw.invoiceNumber,
      total: Number(raw.total) || 0,
      type: raw.type,
      date: raw.date,
      currency: raw.currency,
      customerId: raw.customer_id ?? raw.customerId,
      supplierId: raw.supplier_id ?? raw.supplierId,
      items,
      costOfGoodsSold: cogs,
    } as never)

    // Purchase adds, sale removes — the same direction rule `batchUpdateStock`
    // documents, applied at approval time instead of at creation time.
    await this.batchUpdateStock(items, ctx, raw.type === 'purchase' ? 1 : -1, invoiceId)

    // J3 — the document is posted now, and only now. Before approval it was a
    // draft with no ledger entry behind it, which is what made rejection free.
    await this.markPosted(ctx, invoiceId)

    this.invalidateWorkspaceCache(ctx.workspaceId)
  }
}

export default InvoiceService
