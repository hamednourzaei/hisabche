// ============================================
// backend/src/routes/invoice.routes.ts
// FIXED: Invalidate analytics cache after invoice operations
// FIXED: Create activity records so the Activity Center receives data
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { InvoiceService } from "../services/invoice.service";
import { ActivityService } from "../services/activity.service";
import { authenticate } from "../middleware/auth.middleware";
import { cacheMiddleware, clearCache } from "../middleware/cache.middleware";

const invoiceService = new InvoiceService();
const activityService = new ActivityService();

export async function invoiceRoutes(fastify: FastifyInstance) {
  // GET /api/invoices
  fastify.get(
    "/api/invoices",
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'invoices' })]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const q = request.query as Record<string, string>;
        const filters = {
          search: q.search ?? "",
          type: (q.type as "sale" | "purchase") || undefined,
          status: q.status || undefined,
          customerId: q.customerId || undefined,
          supplierId: q.supplierId || undefined,
          currency: (q.currency as "AFN" | "USD" | "PKR" | "IRR") || undefined,
          dateFrom: q.dateFrom || undefined,
          dateTo: q.dateTo || undefined,
          minTotal: q.minTotal ? Number(q.minTotal) : undefined,
          maxTotal: q.maxTotal ? Number(q.maxTotal) : undefined,
          page: Math.max(1, parseInt(q.page ?? "1")),
          limit: Math.min(100, parseInt(q.limit ?? "20")),
          sortBy: q.sortBy ?? "created_at",
          sortDirection: (q.sortDirection as "asc" | "desc") ?? "desc",
        };

        const userId = (request as any).userId;
        const result = await invoiceService.list(userId, filters as any);
        return reply.send(result);
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // GET /api/invoices/:id
  fastify.get(
    "/api/invoices/:id",
    {
      preHandler: [authenticate, cacheMiddleware({ ttl: 120, keyPrefix: 'invoice' })]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const userId = (request as any).userId;
        const invoice = await invoiceService.getById(id, userId);
        return reply.send(invoice);
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(404).send({ error: err.message });
      }
    }
  );

  // ─── POST /api/invoices ─────────────────────────────────
  // ✅ FIX: Invalidate analytics cache
  // ✅ FIX: Create activity record (previously missing — activities table was never populated)
  fastify.post(
    "/api/invoices",
    {
      preHandler: [authenticate]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as any;
        const userId = (request as any).userId;

        const data = {
          type: body.type ?? "sale",
          customerId: body.customerId,
          supplierId: body.supplierId,
          date: body.date,
          dueDate: body.dueDate,
          subtotal: body.subtotal ?? 0,
          discountTotal: body.discountTotal ?? 0,
          discountType: body.discountType ?? "fixed",
          taxRate: body.taxRate ?? 0,
          taxTotal: body.taxTotal ?? 0,
          total: body.total ?? 0,
          paidAmount: body.paidAmount ?? 0,
          paymentMethod: body.paymentMethod ?? "cash",
          currency: body.currency ?? "AFN",
          notes: body.notes ?? "",
          reference: body.reference ?? "",
          invoiceNumber: body.invoiceNumber,
          items:
            body.items?.map((item: any) => ({
              productId: item.productId ?? item.product_id,
              productName: item.productName ?? item.product_name ?? "",
              quantity: item.quantity ?? 1,
              unitPrice: item.unitPrice ?? item.unit_price ?? 0,
              discount: item.discount ?? 0,
              totalPrice: item.totalPrice ?? item.total_price ?? 0,
            })) ?? [],
        };

        const invoice = await invoiceService.create(userId, data);

        // ✅ FIX: Invalidate all related caches
        await clearCache(`invoices:${userId}:*`);
        await clearCache(`dashboard:v2:${userId}`);
        await clearCache(`sales:${userId}:*`);
        await clearCache(`insights:${userId}`);

        // ✅ FIX: Create activity record — wrapped in try/catch so a failure
        // here never blocks the invoice response itself.
        try {
          await activityService.createActivity({
            actorId: userId,
            actorName: (request as any).user?.email ?? "",
            entityType: "invoice",
            entityId: invoice.id,
            action: "created",
            title: `فاکتور ${invoice.invoice_number ?? ""} ایجاد شد`,
            metadata: {
              invoice_number: invoice.invoice_number,
              total: invoice.total,
              currency: invoice.currency,
              status: invoice.status,
              customer_name: body.customerName ?? undefined,
            },
            importance: 2,
          });
          await clearCache(`activities:${userId}:*`);
          await clearCache(`activities-unread:${userId}`);
        } catch (activityErr) {
          fastify.log.error(activityErr, "Failed to create activity for invoice create");
        }

        return reply.code(201).send(invoice);
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // ─── PATCH /api/invoices/:id ────────────────────────────
  // ✅ FIX: Invalidate analytics cache
  // ✅ FIX: Create activity record (previously missing)
  fastify.patch(
    "/api/invoices/:id",
    {
      preHandler: [authenticate]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        const userId = (request as any).userId;
        const invoice = await invoiceService.update(id, userId, body);

        // ✅ FIX: Invalidate all related caches
        await clearCache(`invoice:${userId}:${id}`);
        await clearCache(`invoices:${userId}:*`);
        await clearCache(`dashboard:v2:${userId}`);
        await clearCache(`sales:${userId}:*`);
        await clearCache(`insights:${userId}`);

        // ✅ FIX: Create activity record
        try {
          await activityService.createActivity({
            actorId: userId,
            actorName: (request as any).user?.email ?? "",
            entityType: "invoice",
            entityId: id,
            action: "updated",
            title: `فاکتور ${invoice.invoice_number ?? ""} ویرایش شد`,
            metadata: {
              invoice_number: invoice.invoice_number,
              total: invoice.total,
              currency: invoice.currency,
              status: invoice.status,
            },
            importance: 1,
          });
          await clearCache(`activities:${userId}:*`);
          await clearCache(`activities-unread:${userId}`);
        } catch (activityErr) {
          fastify.log.error(activityErr, "Failed to create activity for invoice update");
        }

        return reply.send(invoice);
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // ─── DELETE /api/invoices/:id ───────────────────────────
  // ✅ FIX: Invalidate analytics cache
  // ✅ FIX: Create activity record (previously missing)
  fastify.delete(
    "/api/invoices/:id",
    {
      preHandler: [authenticate]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const userId = (request as any).userId;
        await invoiceService.delete(id, userId);

        // ✅ FIX: Invalidate all related caches
        await clearCache(`invoice:${userId}:${id}`);
        await clearCache(`invoices:${userId}:*`);
        await clearCache(`dashboard:v2:${userId}`);
        await clearCache(`sales:${userId}:*`);
        await clearCache(`insights:${userId}`);

        // ✅ FIX: Create activity record
        try {
          await activityService.createActivity({
            actorId: userId,
            actorName: (request as any).user?.email ?? "",
            entityType: "invoice",
            entityId: id,
            action: "deleted",
            title: "فاکتور حذف شد",
            importance: 2,
          });
          await clearCache(`activities:${userId}:*`);
          await clearCache(`activities-unread:${userId}`);
        } catch (activityErr) {
          fastify.log.error(activityErr, "Failed to create activity for invoice delete");
        }

        return reply.code(204).send();
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );
}