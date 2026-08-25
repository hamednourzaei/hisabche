// ============================================
// backend/src/routes/invoice.routes.ts
// FIXED: Invalidate analytics cache after invoice operations
// FIXED: Create activity records so the Activity Center receives data
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { InvoiceService } from '../services/invoice.service'
import { ActivityService } from '../services/activity.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

const invoiceService = new InvoiceService()
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
          customerId: q.customerId || undefined,
          supplierId: q.supplierId || undefined,
          currency: (q.currency as 'AFN' | 'USD' | 'PKR' | 'IRR') || undefined,
          dateFrom: q.dateFrom || undefined,
          dateTo: q.dateTo || undefined,
          minTotal: q.minTotal ? Number(q.minTotal) : undefined,
          maxTotal: q.maxTotal ? Number(q.maxTotal) : undefined,
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
      preHandler: [authenticate, requireWorkspaceContext],
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

        const invoice = await invoiceService.create(request.tenancy, data)

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
        fastify.log.error(err)
        return reply.code(500).send({ error: err.message })
      }
    },
  )

  // ─── PATCH /api/invoices/:id ────────────────────────────
  // ✅ FIX: Invalidate analytics cache
  // ✅ FIX: Create activity record (previously missing)
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
        await invoiceService.delete(id, request.tenancy)

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
        fastify.log.error(err)
        return reply.code(500).send({ error: err.message })
      }
    },
  )
}
