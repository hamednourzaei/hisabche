// ============================================
// backend/src/routes/invoice.routes.ts
// FIXED: Invalidate analytics cache after invoice operations
// FIXED: Create activity records so the Activity Center receives data
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { InvoiceService } from '../services/invoice.service'
import {
  IdempotencyUnavailableError,
  readClientRequestId,
  sendCreated,
} from '../utils/client-request'
import { InvoiceRelatedService } from '../services/invoices/invoice-related.service'
import { ActivityService } from '../services/activity.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { resolveBranchContext } from '../middleware/branch.middleware'
import { BaseError } from '../errors/base.error'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

const invoiceService = new InvoiceService()
const invoiceRelatedService = new InvoiceRelatedService()
const activityService = new ActivityService()

export async function invoiceRoutes(fastify: FastifyInstance) {
  // GET /api/invoices
  fastify.get(
    '/api/invoices',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'invoices' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const q = request.query as Record<string, string>
        const filters = {
          search: q.search ?? '',
          type: (q.type as 'sale' | 'purchase') || undefined,
          status: q.status || undefined,
          // H1 — the dashboard's «بدهی مشتریان» card links here. Read as a
          // string: `?outstanding=false` must not switch the filter ON, which
          // is what a plain truthiness check on a query string would do.
          outstanding: ['true', '1', 'yes'].includes(String(q.outstanding).toLowerCase())
            ? true
            : undefined,
          customerId: q.customerId || undefined,
          supplierId: q.supplierId || undefined,
          currency: (q.currency as 'AFN' | 'USD' | 'PKR' | 'IRR') || undefined,
          dateFrom: q.dateFrom || undefined,
          dateTo: q.dateTo || undefined,
          minTotal: q.minTotal ? Number(q.minTotal) : undefined,
          maxTotal: q.maxTotal ? Number(q.maxTotal) : undefined,
          includeSummary: ['true', '1', 'yes'].includes(String(q.includeSummary).toLowerCase())
            ? true
            : undefined,
          page: Math.max(1, parseInt(q.page ?? '1')),
          limit: Math.min(100, parseInt(q.limit ?? '20')),
          sortBy: q.sortBy ?? 'created_at',
          sortDirection: (q.sortDirection as 'asc' | 'desc') ?? 'desc',
        }

        const result = await invoiceService.list(request.tenancy, filters as any)
        return reply.send(result)
      } catch (err: any) {
        fastify.log.error(err)
        return reply.code(500).send({ error: err.message })
      }
    },
  )

  // ─── GET /api/invoices/:id/related ──────────────────────
  //
  // H2 — the payments that make up `paid_amount`, and the journal entry the
  // invoice produced. Neither was reachable from anywhere before this.
  //
  // ⚠️ Declared BEFORE `/api/invoices/:id`. Fastify's router is not
  // order-sensitive for static segments, but keeping the more specific route
  // first keeps it obvious that `related` is not an invoice id.
  //
  // Deliberately NOT behind `cacheMiddleware`: recording a payment changes
  // this answer, and a two-minute cache would show an invoice as unpaid right
  // after the user recorded the payment that settled it.
  fastify.get(
    '/api/invoices/:id/related',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await invoiceRelatedService.get(request.tenancy, id))
      } catch (err: any) {
        if (err instanceof BaseError && err.statusCode < 500) {
          return reply.code(err.statusCode).send({ error: err.message })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: err.message })
      }
    },
  )

  // GET /api/invoices/:id
  fastify.get(
    '/api/invoices/:id',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'invoice' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const invoice = await invoiceService.getById(id, request.tenancy)
        return reply.send(invoice)
      } catch (err: any) {
        fastify.log.error(err)
        return reply.code(404).send({ error: err.message })
      }
    },
  )

  // ─── POST /api/invoices ─────────────────────────────────
  // ✅ FIX: Invalidate analytics cache
  // ✅ FIX: Create activity record (previously missing — activities table was never populated)
  fastify.post(
    '/api/invoices',
    {
      preHandler: [authenticate, requireWorkspaceContext, resolveBranchContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as any
        const { workspaceId, userId } = request.tenancy

        const data = {
          type: body.type ?? 'sale',
          customerId: body.customerId,
          supplierId: body.supplierId,
          date: body.date,
          dueDate: body.dueDate,
          subtotal: body.subtotal ?? 0,
          discountTotal: body.discountTotal ?? 0,
          discountType: body.discountType ?? 'fixed',
          taxRate: body.taxRate ?? 0,
          taxTotal: body.taxTotal ?? 0,
          total: body.total ?? 0,
          paidAmount: body.paidAmount ?? 0,
          paymentMethod: body.paymentMethod ?? 'cash',
          // ⚠️ FORWARDED. This mapping dropped `payments`, so a sale paid part
          // cash, part transfer reached the service as ONE payment carrying the
          // first method — the till and the bank reconciliation both wrong.
          ...(Array.isArray(body.payments)
            ? {
                payments: body.payments.map((p: any) => ({
                  method: p.method,
                  amount: Number(p.amount),
                  ...(typeof p.reference === 'string' ? { reference: p.reference } : {}),
                  ...(typeof p.note === 'string' ? { note: p.note.slice(0, 500) } : {}),
                })),
              }
            : {}),
          currency: body.currency ?? 'AFN',
          notes: body.notes ?? '',
          reference: body.reference ?? '',
          invoiceNumber: body.invoiceNumber,
          // This mapping normalises camelCase/snake_case, so every field the
          // service persists must be listed. It previously stopped at
          // totalPrice, which silently dropped `unit`, `unitLabel`,
          // `weightGrams`, `notes` and the whole `details` array on the way in
          // — the columns existed, the service wrote them, and nothing ever
          // arrived. A gram-priced line came back as a plain "piece" and every
          // line component vanished.
          items:
            body.items?.map((item: any) => ({
              productId: item.productId ?? item.product_id,
              productName: item.productName ?? item.product_name ?? '',
              quantity: item.quantity ?? 1,
              unit: item.unit ?? 'piece',
              unitLabel: item.unitLabel ?? item.unit_label,
              weightGrams: item.weightGrams ?? item.weight_grams,
              unitPrice: item.unitPrice ?? item.unit_price ?? 0,
              discount: item.discount ?? 0,
              totalPrice: item.totalPrice ?? item.total_price ?? 0,
              notes: item.notes ?? '',
              details:
                item.details?.map((detail: any, index: number) => ({
                  title: detail.title ?? '',
                  quantity: detail.quantity ?? 1,
                  amount: detail.amount ?? 0,
                  unit: detail.unit ?? 'piece',
                  unitLabel: detail.unitLabel ?? detail.unit_label,
                  weightGrams: detail.weightGrams ?? detail.weight_grams,
                  sortOrder: detail.sortOrder ?? detail.sort_order ?? index,
                })) ?? [],
            })) ?? [],
        }

        // The offline outbox sends one stable key per intended sale and resends
        // it unchanged. Anything that is not a sane key is ignored, never
        // echoed into a query.
        const clientRequestId = readClientRequestId(request)

        const invoice = await invoiceService.create(request.tenancy, data, request.branchId, {
          clientRequestId,
        })

        if ((invoice as { idempotentReplay?: boolean }).idempotentReplay) {
          // Already created by an earlier attempt: no cache churn, no second
          // activity, and 200 rather than 201 so the client can tell.
          return sendCreated(reply, invoice)
        }

        // ✅ FIX: Invalidate all related caches
        await clearCache(`invoices:${workspaceId}:*`)
        await clearCache(`dashboard:v2:${workspaceId}`)
        await clearCache(`sales:${workspaceId}:*`)
        await clearCache(`insights:${workspaceId}`)

        // ⚠️ FIX (duplicate activity): this route used to create a SECOND
        // activity record for an invoice that `invoiceService.create` had
        // already recorded — the duplication was flagged in the header comment
        // of invoice.service.ts. Every new invoice produced two feed entries,
        // and this one carried no transaction type, so a purchase showed up as
        // a generic "فاکتور ... ایجاد شد" next to the correct entry.
        //
        // The service is the single owner of invoice activity: it has the
        // resolved customer/supplier name, the workspace id and the
        // transaction type. This route only invalidates the caches.
        try {
          await clearCache(`activities:${workspaceId}:*`)
          await clearCache(`activities-unread:${workspaceId}`)
        } catch (activityErr) {
          fastify.log.error(activityErr, 'Failed to clear activity cache after invoice create')
        }

        return reply.code(201).send(invoice)
      } catch (err: any) {
        if (err instanceof IdempotencyUnavailableError) {
          // 503, not 4xx: the mobile runner treats 4xx as permanent and would
          // give up on a sale that only needs the migration to go through.
          return reply.code(503).send({ error: err.message, code: err.code })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: err.message })
      }
    },
  )

  // ─── PATCH /api/invoices/:id ────────────────────────────
  // ✅ FIX: Invalidate analytics cache
  // ✅ FIX: Create activity record (previously missing)
  // ─── POST /api/invoices/post-unposted ───────────────────
  // Book every invoice that has no journal entry yet (history from before the
  // chart of accounts existed). Registered BEFORE `/:id/...` routes.
  fastify.post(
    '/api/invoices/post-unposted',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { workspaceId } = request.tenancy
        const body = (request.body ?? {}) as { afterId?: unknown; batchSize?: unknown }
        const summary = await invoiceService.postAllUnposted(request.tenancy, {
          afterId:
            typeof body.afterId === 'string' && /^[0-9a-f-]{36}$/i.test(body.afterId)
              ? body.afterId
              : null,
          batchSize: typeof body.batchSize === 'number' ? body.batchSize : undefined,
        })
        await clearCache(`invoices:${workspaceId}:*`)
        await clearCache(`dashboard:v2:${workspaceId}`)
        return reply.send(summary)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to post unposted invoices' })
      }
    },
  )

  // ─── POST /api/invoices/:id/post-to-ledger ──────────────
  // Retry the ledger posting for an invoice whose automatic posting did not
  // happen, and say WHY when it still can't (e.g. the chart of accounts has no
  // receivable/sales account). Idempotent — see InvoiceService#postToLedger.
  fastify.post(
    '/api/invoices/:id/post-to-ledger',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const { workspaceId } = request.tenancy
        const result = await invoiceService.postToLedger(id, request.tenancy)
        await clearCache(`invoice:${workspaceId}:${id}`)
        await clearCache(`invoices:${workspaceId}:*`)
        return reply.send(result)
      } catch (err) {
        fastify.log.error(err)
        const status = (err as { statusCode?: number })?.statusCode ?? 500
        return reply
          .code(status)
          .send({ error: err instanceof Error ? err.message : 'Failed to post invoice to ledger' })
      }
    },
  )

  fastify.patch(
    '/api/invoices/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = request.body as any
        const { workspaceId, userId } = request.tenancy
        const invoice = await invoiceService.update(id, request.tenancy, body)

        // ✅ FIX: Invalidate all related caches
        await clearCache(`invoice:${workspaceId}:${id}`)
        await clearCache(`invoices:${workspaceId}:*`)
        await clearCache(`dashboard:v2:${workspaceId}`)
        await clearCache(`sales:${workspaceId}:*`)
        await clearCache(`insights:${workspaceId}`)

        // ✅ FIX: Create activity record
        try {
          await activityService.createActivity({
            actorId: userId,
            actorName: (request as any).user?.email ?? '',
            workspaceId,
            entityType: 'invoice',
            entityId: id,
            action: 'updated',
            title: `فاکتور ${invoice.invoice_number ?? ''} ویرایش شد`,
            metadata: {
              invoice_number: invoice.invoice_number,
              total: invoice.total,
              currency: invoice.currency,
              status: invoice.status,
            },
            importance: 1,
          })
          await clearCache(`activities:${workspaceId}:*`)
          await clearCache(`activities-unread:${workspaceId}`)
        } catch (activityErr) {
          fastify.log.error(activityErr, 'Failed to create activity for invoice update')
        }

        return reply.send(invoice)
      } catch (err: any) {
        fastify.log.error(err)
        return reply.code(500).send({ error: err.message })
      }
    },
  )

  // ─── DELETE /api/invoices/:id ───────────────────────────
  // ✅ FIX: Invalidate analytics cache
  // ✅ FIX: Create activity record (previously missing)
  fastify.delete(
    '/api/invoices/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const { workspaceId, userId } = request.tenancy

        // J5 — only honoured when segregation of duties actually offers an
        // override (`warn` mode, and an owner). Sending it otherwise changes
        // nothing, which is why it is read leniently rather than validated.
        const overrideReason = (request.body as { sodOverrideReason?: unknown } | null)
          ?.sodOverrideReason
        const override =
          typeof overrideReason === 'string' && overrideReason.trim().length > 0
            ? { reason: overrideReason.trim() }
            : undefined

        await invoiceService.delete(id, request.tenancy, { override })

        // ✅ FIX: Invalidate all related caches
        await clearCache(`invoice:${workspaceId}:${id}`)
        await clearCache(`invoices:${workspaceId}:*`)
        await clearCache(`dashboard:v2:${workspaceId}`)
        await clearCache(`sales:${workspaceId}:*`)
        await clearCache(`insights:${workspaceId}`)

        // ✅ FIX: Create activity record
        try {
          await activityService.createActivity({
            actorId: userId,
            actorName: (request as any).user?.email ?? '',
            workspaceId,
            entityType: 'invoice',
            entityId: id,
            action: 'deleted',
            title: 'فاکتور حذف شد',
            importance: 2,
          })
          await clearCache(`activities:${workspaceId}:*`)
          await clearCache(`activities-unread:${workspaceId}`)
        } catch (activityErr) {
          fastify.log.error(activityErr, 'Failed to create activity for invoice delete')
        }

        return reply.code(204).send()
      } catch (err: any) {
        // J5 — a refusal is not a server fault.
        //
        // This returned 500 for everything, so `SOD_BLOCKED:...` and
        // `INVOICE_DELETE_FORBIDDEN` both reached the client as «خطای سرور».
        // The client cannot offer an override for an error it is told is a
        // crash, and the person refused never learns which rule refused them.
        if (err instanceof BaseError && err.statusCode < 500) {
          const code = /^[A-Z][A-Z_]{6,}(?::[a-z0-9.-]+)?/.exec(err.message)?.[0]
          return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: err.message })
      }
    },
  )
}
