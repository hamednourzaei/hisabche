import { FastifyInstance } from 'fastify'
import { JobService } from '../services/job.service'
import { NotificationService } from '../services/notification.service'
import { supabase } from '../db'
import { claimJobs, completeJob, failJob, type ClaimedJob } from '../services/distributed-work'
import { emailService } from '../services/email.service'

const jobService = new JobService()
const notificationService = new NotificationService()

async function checkOverdueInvoices() {
  const today = new Date().toISOString().split('T')[0]

  const { data: invoices } = await supabase
    .from('invoices')
    // ⚠️ The invoice's OWN workspace. This used to look up "the first workspace
    // this user belongs to" — one extra query per invoice (N+1), and for a
    // person in two businesses, a notification filed under the wrong one.
    // workspace_id is the security boundary (راهنمای سشن §۱٫۱).
    .select('id, invoice_number, total, user_id, due_date, workspace_id')
    .lt('due_date', today)
    .eq('status', 'pending')
    .limit(50)

  if (!invoices?.length) return

  for (const inv of invoices) {
    try {
      const workspaceId = inv.workspace_id as string | null
      if (!workspaceId) continue

      await notificationService.create(workspaceId, {
        user_id: inv.user_id,
        title: 'فاکتور سررسید شده',
        body: `فاکتور #${inv.invoice_number} به مبلغ ${inv.total} افغانی سررسید شده است.`,
        type: 'warning',
        action_url: `/invoices/${inv.id}`,
        entity_type: 'invoice',
        entity_id: inv.id,
      })
    } catch {
      // Continue
    }
  }
}

const JOB_HANDLERS: Record<string, () => Promise<void>> = {
  CHECK_OVERDUE_INVOICES: checkOverdueInvoices,
}

/**
 * One poll. With the claim function installed (docs/background-jobs-claim-
 * migration.sql) a job is taken by exactly one instance — the claim is a single
 * statement with FOR UPDATE SKIP LOCKED — and only the holder may finish it.
 *
 * Before that migration the old read-then-mark path runs, which is correct for
 * ONE instance only.
 */
export async function pollJobs(): Promise<void> {
  const claimed = await claimJobs(5).catch((err) => {
    console.error('[jobs] claim failed:', err)
    return [] as ClaimedJob[]
  })

  if (claimed === null) {
    await pollJobsSingleInstance()
    return
  }

  for (const job of claimed) {
    const handler = JOB_HANDLERS[job.job_type]
    try {
      if (!handler) throw new Error(`Unknown job_type: ${job.job_type}`)
      await handler()
      await completeJob(job.id)
    } catch (err) {
      await failJob(job.id, err instanceof Error ? err.message : 'Unknown error').catch((e) =>
        console.error('[jobs] could not record the failure:', e),
      )
    }
  }
}

/** The pre-migration path: read, then mark. Safe with one instance only. */
async function pollJobsSingleInstance(): Promise<void> {
  const jobs = await jobService.fetchPending()
  for (const job of jobs) {
    await jobService.markProcessing(job.id)
    const handler = JOB_HANDLERS[job.job_type as string]
    if (handler) {
      try {
        await handler()
        await jobService.markCompleted(job.id)
      } catch (err: any) {
        await jobService.markFailed(job.id, err?.message || 'Unknown error')
      }
    } else {
      await jobService.markFailed(job.id, `Unknown job_type: ${job.job_type}`)
    }
  }
}

const EMAIL_POLL_MS = 60_000

export async function pollEmailOutbox(): Promise<void> {
  try {
    const counts = await emailService.drainOutbox()
    if (counts && (counts.sent || counts.retry || counts.failed)) {
      console.log(
        `[email-outbox] sent=${counts.sent} retry=${counts.retry} failed=${counts.failed}`,
      )
    }
  } catch (err) {
    console.error('[email-outbox] poll failed:', err)
  }
}

export async function jobSchedulerPlugin(fastify: FastifyInstance) {
  // ✅ FIX: فاصله از ۶۰ ثانیه به ۱۰ دقیقه افزایش یافت.
  // بررسی شد که هیچ‌جای پروژه (نه route ها، نه scheduler، نه جای
  // دیگری) هیچ‌وقت jobService.create(...) را صدا نمی‌زند — یعنی
  // جدول background_jobs عملاً همیشه خالی است و این interval فقط
  // یک کوئری خالی به Supabase می‌زد بدون هیچ نتیجه‌ای، ۱۴۴۰ بار در
  // روز. تا زمانی که یک مسیر واقعی برای ساخت job اضافه نشود
  // (مثلاً CHECK_OVERDUE_INVOICES که در JOB_HANDLERS تعریف شده ولی
  // هیچ‌جا trigger نمی‌شود)، این فقط یک safety net است، نه چیزی
  // که تأخیرش اهمیت عملیاتی داشته باشد.
  const interval = setInterval(() => void pollJobs(), 10 * 60_000)

  // Email outbox (docs/email-outbox-migration.sql): retries that are due, and
  // emails whose sending instance died before finishing. Every instance polls;
  // each row is claimed by one of them. Almost every email is sent at once by
  // emailService.send — this only catches what that could not finish.
  const emailInterval = setInterval(() => void pollEmailOutbox(), EMAIL_POLL_MS)
  fastify.addHook('onClose', () => {
    clearInterval(interval)
    clearInterval(emailInterval)
  })
}
