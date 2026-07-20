// ============================================
// backend/src/routes/invoice.routes.ts
// FIXED: Invalidate analytics cache after invoice operations
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { InvoiceService } from "../services/invoice.service";
import { authenticate } from "../middleware/auth.middleware";
import { cacheMiddleware, clearCache } from "../middleware/cache.middleware";

const invoiceService = new InvoiceService();

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
        
        return reply.code(201).send(invoice);
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // ─── PATCH /api/invoices/:id ────────────────────────────
  // ✅ FIX: Invalidate analytics cache
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
        
        return reply.send(invoice);
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );

  // ─── DELETE /api/invoices/:id ───────────────────────────
  // ✅ FIX: Invalidate analytics cache
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
        
        return reply.code(204).send();
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(500).send({ error: err.message });
      }
    }
  );
}