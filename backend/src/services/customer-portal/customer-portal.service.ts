// ============================================
// backend/src/services/customer-portal/customer-portal.service.ts
//
// One customer's own account, behind a link the owner sends them
// (docs/developer-platform-04-portal-migration.sql).
//
// ⚠️ THE LINK IS ITS MAKER, NARROWED TO ONE CUSTOMER. Each visit resolves the
// maker's membership exactly as a request would (resolveWorkspaceAccess) and
// reads with THAT context — the same balance function the customer screen
// uses, never a second formula. A maker removed from the workspace takes
// their links with them. Nothing here writes.
// ============================================

import { randomBytes } from 'node:crypto'

import { supabase } from '../../db'
import { isMissingSchema } from '../blog/blog.domain'
import { NotConfiguredError } from '../developer/developer.repository'
import { resolveWorkspaceAccess } from '../authorization/workspace-access.service'
import { CustomerService } from '../customer.service'
import type { TenancyContext } from '../tenancy.service'

export class PortalError extends Error {
  constructor(
    readonly code: 'PORTAL_CUSTOMER_NOT_FOUND' | 'PORTAL_LINK_NOT_FOUND',
    readonly statusCode: number,
  ) {
    super(code)
    this.name = 'PortalError'
  }
}

function check(error: { code?: string; message?: string } | null): void {
  if (!error) return
  if (isMissingSchema(error)) throw new NotConfiguredError()
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

export interface PortalLinkRow {
  id: string
  customer_id: string
  token: string
  created_at: string
  expires_at: string | null
  last_used_at: string | null
  revoked_at: string | null
}
const LINK_COLUMNS = 'id, customer_id, token, created_at, expires_at, last_used_at, revoked_at'

/** Rows shown on the portal — a page to read, with the exact count beside it. */
export const PORTAL_LIST_LIMIT = 100

export interface PortalView {
  businessName: string | null
  customerName: string
  /**
   * From CustomerService.getBalance — the figure the business itself sees.
   * No currency: the books have no per-workspace currency column, and
   * inventing one would label the number with a guess.
   */
  balance: number
  isDebtor: boolean
  invoices: Array<{
    invoiceNumber: string | null
    date: string
    dueDate: string | null
    total: number
    paidAmount: number
    currency: string
    status: string
    /** Opens the existing public invoice page, when the invoice has a link. */
    publicToken: string | null
  }>
  invoiceCount: number
  payments: Array<{
    number: string | null
    date: string
    amount: number
    currency: string
    method: string
  }>
  paymentCount: number
  orders: Array<{ orderNumber: string; status: string; total: number; createdAt: string }>
}

export function createCustomerPortalService(
  customers: Pick<CustomerService, 'getBalance'> = new CustomerService(),
) {
  async function customerName(workspaceId: string, customerId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('customers')
      .select('full_name')
      .eq('workspace_id', workspaceId)
      .eq('id', customerId)
      .maybeSingle()
    check(error)
    return (data as { full_name: string } | null)?.full_name ?? null
  }

  return {
    // ─── for members ─────────────────────────────────────────────────────────

    async createLink(
      ctx: TenancyContext,
      customerId: string,
      expiresInDays: number | null,
    ): Promise<PortalLinkRow> {
      if (!(await customerName(ctx.workspaceId, customerId))) {
        throw new PortalError('PORTAL_CUSTOMER_NOT_FOUND', 404)
      }
      const { data, error } = await supabase
        .from('customer_portal_links')
        .insert({
          workspace_id: ctx.workspaceId,
          customer_id: customerId,
          token: randomBytes(32).toString('hex'),
          created_by: ctx.userId,
          expires_at: expiresInDays
            ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
            : null,
        })
        .select(LINK_COLUMNS)
        .single()
      check(error)
      return data as PortalLinkRow
    },

    async listLinks(ctx: TenancyContext, customerId: string): Promise<PortalLinkRow[]> {
      const { data, error } = await supabase
        .from('customer_portal_links')
        .select(LINK_COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
      check(error)
      return (data ?? []) as PortalLinkRow[]
    },

    async revokeLink(ctx: TenancyContext, linkId: string): Promise<void> {
      const { data, error } = await supabase
        .from('customer_portal_links')
        .update({ revoked_at: new Date().toISOString() })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', linkId)
        .is('revoked_at', null)
        .select('id')
      check(error)
      if ((data ?? []).length === 0) throw new PortalError('PORTAL_LINK_NOT_FOUND', 404)
    },

    // ─── for the customer ────────────────────────────────────────────────────

    /** The portal, or null for a link that is unknown, revoked, expired or orphaned. */
    async view(token: string): Promise<PortalView | null> {
      if (!/^[0-9a-f]{64}$/.test(token)) return null
      const { data: link, error } = await supabase
        .from('customer_portal_links')
        .select('id, workspace_id, customer_id, created_by, expires_at')
        .eq('token', token)
        .is('revoked_at', null)
        .maybeSingle()
      check(error)
      const row = link as {
        id: string
        workspace_id: string
        customer_id: string
        created_by: string
        expires_at: string | null
      } | null
      if (!row) return null
      if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null

      // The maker must still be a member; their context is the reader.
      let ctx: TenancyContext
      try {
        ctx = await resolveWorkspaceAccess(row.created_by, row.workspace_id)
      } catch {
        return null
      }

      const name = await customerName(ctx.workspaceId, row.customer_id)
      if (!name) return null

      const [balance, invoices, payments, orders, business] = await Promise.all([
        customers.getBalance(row.customer_id, ctx),
        supabase
          .from('invoices')
          .select(
            'invoice_number, date, due_date, total, paid_amount, currency, status, public_token',
            { count: 'exact' },
          )
          .eq('workspace_id', ctx.workspaceId)
          .eq('customer_id', row.customer_id)
          .eq('type', 'sale')
          .order('date', { ascending: false })
          .limit(PORTAL_LIST_LIMIT),
        supabase
          .from('payments')
          .select('payment_number, entry_date, amount, currency, method', { count: 'exact' })
          .eq('workspace_id', ctx.workspaceId)
          .eq('party_type', 'customer')
          .eq('party_id', row.customer_id)
          .eq('direction', 'in')
          .eq('status', 'posted')
          .order('entry_date', { ascending: false })
          .limit(PORTAL_LIST_LIMIT),
        supabase
          .from('sales_orders')
          .select('order_number, status, total, created_at')
          .eq('workspace_id', ctx.workspaceId)
          .eq('customer_id', row.customer_id)
          .order('created_at', { ascending: false })
          .limit(PORTAL_LIST_LIMIT),
        supabase.from('workspaces').select('name').eq('id', ctx.workspaceId).maybeSingle(),
      ])
      check(invoices.error)
      check(payments.error)
      // Orders are optional: before migration 03 there are none to show.
      if (orders.error && !isMissingSchema(orders.error)) check(orders.error)

      void supabase
        .from('customer_portal_links')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', row.id)
        .then(({ error: touchError }) => {
          if (touchError) console.error('[portal] last_used_at not recorded:', touchError.message)
        })

      return {
        businessName: (business.data as { name?: string } | null)?.name ?? null,
        customerName: name,
        balance: balance.balance,
        isDebtor: balance.isDebtor,
        invoices: ((invoices.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          invoiceNumber: (r.invoice_number as string | null) ?? null,
          date: String(r.date),
          dueDate: (r.due_date as string | null) ?? null,
          total: Number(r.total ?? 0),
          paidAmount: Number(r.paid_amount ?? 0),
          currency: String(r.currency ?? ''),
          status: String(r.status),
          publicToken: (r.public_token as string | null) ?? null,
        })),
        invoiceCount: invoices.count ?? 0,
        payments: ((payments.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          number: (r.payment_number as string | null) ?? null,
          date: String(r.entry_date),
          amount: Number(r.amount),
          currency: String(r.currency),
          method: String(r.method),
        })),
        paymentCount: payments.count ?? 0,
        orders: orders.error
          ? []
          : ((orders.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
              orderNumber: String(r.order_number),
              status: String(r.status),
              total: Number(r.total),
              createdAt: String(r.created_at),
            })),
      }
    },
  }
}

export const customerPortalService = createCustomerPortalService()
export type CustomerPortalService = ReturnType<typeof createCustomerPortalService>
