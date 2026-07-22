// backend/src/routes/entity.routes.ts
import { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/auth.middleware";

export async function entityRoutes(fastify: FastifyInstance) {
  const { supabase } = fastify;

  // ─── GET /v1/entities/:type/:id/summary ──────────────
  fastify.get(
    "/v1/entities/:type/:id/summary",
    { preHandler: [authenticate] },
    async (request: any, reply: any) => {
      const { type, id } = request.params;
      const userId = request.userId;

      switch (type) {
        case "invoice": {
          const { data: invoice } = await supabase
            .from("invoices")
            .select(`
              id,
              invoice_number,
              customer:customers(full_name),
              total,
              currency,
              status,
              created_at
            `)
            .eq("id", id)
            .eq("user_id", userId)
            .single();

          if (!invoice) return reply.code(404).send({ error: "Invoice not found" });

          // ─── دریافت آخرین فعالیت ──────────────────────────
          const { data: activities } = await supabase
            .from("notifications")
            .select("title, created_at")
            .eq("entity_type", "invoice")
            .eq("entity_id", id)
            .order("created_at", { ascending: false })
            .limit(1);

          const lastActivity = activities?.[0];

          // ─── تعداد فعالیت‌ها ──────────────────────────────
          const { count } = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("entity_type", "invoice")
            .eq("entity_id", id);

          // ─── تعداد خوانده‌نشده‌ها ──────────────────────────
          const { count: unreadCount } = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("entity_type", "invoice")
            .eq("entity_id", id)
            .eq("is_read", false)
            .eq("user_id", userId);

          return reply.send({
            id: invoice.id,
            type: "invoice",
            label: `فاکتور #${invoice.invoice_number}`,
            subtitle: invoice.customer?.full_name || "بدون مشتری",
            amount: invoice.total,
            currency: invoice.currency || "AFN",
            status: invoice.status,
            statusLabel: getStatusLabel(invoice.status),
            statusColor: getStatusColor(invoice.status),
            lastActivity: lastActivity
              ? { title: lastActivity.title, time: lastActivity.created_at }
              : null,
            activityCount: count || 0,
            hasUnread: (unreadCount || 0) > 0,
            unreadCount: unreadCount || 0,
          });
        }

        case "customer":
          // ... پیاده‌سازی برای مشتری
          break;

        case "product":
          // ... پیاده‌سازی برای محصول
          break;

        default:
          return reply.code(400).send({ error: "Unsupported entity type" });
      }
    }
  );

  // ─── GET /v1/entities/:type/:id/activities ────────────
  fastify.get(
    "/v1/entities/:type/:id/activities",
    { preHandler: [authenticate] },
    async (request: any, reply: any) => {
      const { type, id } = request.params;
      const userId = request.userId;

      const { data: activities } = await supabase
        .from("notifications")
        .select("id, title, body, type, created_at")
        .eq("entity_type", type)
        .eq("entity_id", id)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      return reply.send(
        activities?.map((a) => ({
          id: a.id,
          type: getActivityType(a.type, a.title),
          title: a.title,
          description: a.body,
          timestamp: a.created_at,
        })) || []
      );
    }
  );
}