import { FastifyInstance } from "fastify";
import { JobService } from "../services/job.service";
import { NotificationService } from "../services/notification.service";
import { supabase } from "../db";

const jobService = new JobService();
const notificationService = new NotificationService();

async function checkOverdueInvoices() {
  const today = new Date().toISOString().split("T")[0];

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, user_id, due_date")
    .lt("due_date", today)
    .eq("status", "pending")
    .limit(50);

  if (!invoices?.length) return;

  for (const inv of invoices) {
    try {
      // Get workspace_id from workspace_members
      const { data: members } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", inv.user_id)
        .limit(1);

      const workspaceId = members?.[0]?.workspace_id;
      if (!workspaceId) continue;

      await notificationService.create(workspaceId, {
        user_id: inv.user_id,
        title: "فاکتور سررسید شده",
        body: `فاکتور #${inv.invoice_number} به مبلغ ${inv.total} افغانی سررسید شده است.`,
        type: "warning",
        action_url: `/invoices/${inv.id}`,
        entity_type: "invoice",
        entity_id: inv.id,
      });
    } catch {
      // Continue
    }
  }
}

const JOB_HANDLERS: Record<string, () => Promise<void>> = {
  CHECK_OVERDUE_INVOICES: checkOverdueInvoices,
};

export async function jobSchedulerPlugin(fastify: FastifyInstance) {
  const interval = setInterval(async () => {
    const jobs = await jobService.fetchPending();
    for (const job of jobs) {
      await jobService.markProcessing(job.id);
      const handler = JOB_HANDLERS[job.job_type as string];
      if (handler) {
        try {
          await handler();
          await jobService.markCompleted(job.id);
        } catch (err: any) {
          await jobService.markFailed(job.id, err?.message || "Unknown error");
        }
      } else {
        await jobService.markFailed(job.id, `Unknown job_type: ${job.job_type}`);
      }
    }
  }, 60_000);

  fastify.addHook("onClose", () => clearInterval(interval));
}