// ============================================
// backend/src/routes/invoice-public.routes.ts
// Public, unauthenticated, read-only invoice view.
// Looked up by unguessable public_token — NOT by sequential id —
// so logged-out users can't enumerate every invoice by guessing ids.
// No `authenticate` preHandler on purpose. No mutation endpoints here.
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { InvoiceService } from "../services/invoice.service";

const invoiceService = new InvoiceService();

export async function invoicePublicRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { token: string } }>(
    "/api/public/invoices/:token",
    {
      // Simple throttle reusing the same fastify @fastify/rate-limit plugin
      // already registered globally in index.ts — no new rate-limit system.
      config: {
        rateLimit: { max: 30, timeWindow: "1 minute" },
      },
      schema: {
        params: {
          type: "object",
          required: ["token"],
          properties: { token: { type: "string" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
      try {
        const { token } = request.params;
        if (!token || token.length < 8) {
          return reply.code(400).send({ error: "Invalid token" });
        }

        const invoice = await invoiceService.getPublicByToken(token);
        return reply.send(invoice);
      } catch (err: any) {
        fastify.log.error(err);
        return reply.code(404).send({ error: "Invoice not found" });
      }
    }
  );
}
