import { FastifyInstance } from 'fastify'
import { JobService } from '../services/job.service'
import { NotificationService } from '../services/notification.service'
import { supabase } from '../db'
import { claimJobs, completeJob, failJob, type ClaimedJob } from '../services/distributed-work'
import { emailService } from '../services/email.service'
import { developerService } from '../services/developer/developer.service'
import { NotConfiguredError } from '../services/developer/developer.repository'
import { ordersService } from '../services/orders/orders.service'
import { researchTopic, saveResearchRun } from '../services/blog/research.service'
import { generateBrief } from '../services/blog/brief.service'
import { generateDraft } from '../services/blog/draft.service'
import { runQualityGate } from '../services/blog/quality-gate.service'
import { suggestInternalLinks } from '../services/blog/internal-links.service'
import type { TenancyContext } from '../services/tenancy.service'

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

/**
 * The content-intelligence research pass.
 *
 * ⚠️ A JOB HAS NO LOGGED-IN USER, so the tenancy context is built from the
 * payload — which is written by an admin-authorised route, not by a browser
 * directly. The workspace comes from the payload because a scheduled job cannot
 * ask `authenticate` who is calling: it wakes up on a timer.
 *
 * ⚠️ AND IT THROWS WHEN IT CANNOT DO THE WORK. `researchTopic` raises
 * `RESEARCH_NOT_CONFIGURED` when `TAVILY_API_KEY` is absent, and that failure
 * propagates here on purpose: `failJob` records it, the admin sees a failed run
 * with a reason, and the brief is NOT written from model guesswork with an empty
 * citation list.
 *
 * ⚠️ AND IT NEVER PUBLISHES. This function reads, searches and stores. The
 * furthest it goes is a `blog_research_runs` row and its sources.
 */
async function runContentResearch(job: HandlerJob): Promise<void> {
  // ⚠️ THE CLAIMED ROW, NOT A RE-READ. See `JobHandler` above: looking the job
  // up again is how two instances both run the same Tavily search.
  const payload = (job.payload ?? {}) as Record<string, unknown>

  const topic = typeof payload.topic === 'string' ? payload.topic : ''
  const workspaceId = typeof payload.workspaceId === 'string' ? payload.workspaceId : ''
  const briefId = typeof payload.briefId === 'string' ? payload.briefId : null

  // ⚠️ NO TOPIC OR NO WORKSPACE IS A FAILED RUN, not a silent skip. A job that
  // finds nothing to do looks identical to a job that was never scheduled, and
  // the first is a bug somebody spends an afternoon on.
  if (!topic || !workspaceId) {
    throw new Error('CONTENT_RESEARCH_PAYLOAD_INVALID: topic and workspaceId are required')
  }

  const ctx = {
    workspaceId,
    userId: typeof payload.userId === 'string' ? payload.userId : '',
    role: 'owner',
  } as TenancyContext

  if (briefId) {
    await supabase
      .from('blog_content_briefs')
      .update({ intelligence_status: 'researching', updated_at: new Date().toISOString() })
      .eq('id', briefId)
  }

  try {
    const result = await researchTopic(ctx, topic, briefId)
    const saved = await saveResearchRun(result, job.id)

    if (briefId) {
      // ⚠️ THE PERSISTED COUNT, NOT THE TAVILY COUNT. `result.sources` is what
      // the provider returned; `saved.sourceIds` is what the database holds. If
      // saving failed (a missing column, a dead constraint) the in-memory list
      // would still say "sources!" and the brief would be marked ready with an
      // empty citation table — a green status over lost data.
      const ready = saved.sourceIds.length > 0 && saved.failed === 0

      // ⚠️ `brief_ready` MEANS THE BRIEF IS FILLED, not merely that sources
      // exist. A status that says "ready" over empty intent/sections columns
      // is the same lie at one level up — so the plan is generated HERE, from
      // the persisted ids, before the status may advance. `generateBrief`
      // throws when no AI provider is configured; the catch below marks the
      // brief failed with that reason rather than leaving it half-planned.
      if (ready) await generateBrief(briefId, saved.sourceIds)

      await supabase
        .from('blog_content_briefs')
        .update({
          intelligence_status: ready ? 'brief_ready' : 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', briefId)
    }
  } catch (err) {
    // ⚠️ MARK THE BRIEF FAILED, then rethrow so the job is recorded as failed
    // too. A brief left in 'researching' looks like work in progress for ever,
    // and nobody can tell a stuck pipeline from a slow one.
    if (briefId) {
      await supabase
        .from('blog_content_briefs')
        .update({ intelligence_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', briefId)
    }
    throw err
  }
}

/**
 * What a handler is told about the job it is running.
 *
 * ⚠️ NARROWER THAN `ClaimedJob` ON PURPOSE. The claimed row carries retry
 * counters the poller needs, but a handler that only wants the payload does not
 * need them, and typing the parameter as the full row meant the pre-migration
 * path — which has no payload at all — could not call a handler without lying
 * about fields it does not have.
 *
 * `payload: null` is a REAL state, not a convenience: the pre-migration
 * `fetchPending` returns no payload, and a handler that assumed an object would
 * read `undefined.topic` and start a research run with no topic.
 */
interface HandlerJob {
  id: string
  job_type: string
  payload: Record<string, unknown> | null
}

/**
 * A handler receives the job row that WAS CLAIMED.
 *
 * ⚠️ NOT `() => Promise<void>`, and the first version of the research handler
 * was written that way — which meant it had to re-read `background_jobs` to find
 * its own payload. On a single instance that is merely wasteful. On two, BOTH
 * read the same pending row and BOTH call Tavily: the claim that makes a job
 * run once is bypassed by the handler going around it, which is the exact
 * failure `claim_background_jobs` was added to prevent on 26 September.
 *
 * So the claimed row is passed in. A handler that needs to know which job it is
 * running must be TOLD, not look it up.
 */
type JobHandler = (job: HandlerJob) => Promise<void>

/**
 * The content-intelligence draft pass (Phases 4–6, one job).
 *
 * ⚠️ DRAFT → GATE → LINKS, AND THE GATE DECIDES WHAT RUNS NEXT. A draft that
 * fails its gate gets no link suggestions: suggesting links into an article the
 * gate just refused is busywork that looks like progress. The gate's own row
 * carries the reasons; the editor regenerates or edits and re-runs.
 *
 * ⚠️ AND LIKE THE RESEARCH PASS: it never publishes, never writes blog_posts,
 * and every failure rethrows so `failJob` records the reason on the job row.
 */
async function runContentDraft(job: HandlerJob): Promise<void> {
  const payload = (job.payload ?? {}) as Record<string, unknown>

  const briefId = typeof payload.briefId === 'string' ? payload.briefId : ''
  const actorId = typeof payload.userId === 'string' ? payload.userId : ''

  if (!briefId || !actorId) {
    throw new Error('CONTENT_DRAFT_PAYLOAD_INVALID: briefId and userId are required')
  }

  const draft = await generateDraft(briefId, actorId)
  const verdict = await runQualityGate(draft.versionId, briefId)

  if (verdict.passed) {
    // A failure here must not roll the draft back: the version and its report
    // are real and readable, and link suggestions can be re-run. Logged and
    // the job still completes — the brief is at `validation_ready`, which is
    // true: the draft exists and passed its gate.
    try {
      await suggestInternalLinks(draft.versionId, actorId)
    } catch (err) {
      console.error(
        `[jobs] CONTENT_DRAFT: link suggestions failed for ${draft.versionId}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
}

const JOB_HANDLERS: Record<string, JobHandler> = {
  CHECK_OVERDUE_INVOICES: checkOverdueInvoices,
  CONTENT_RESEARCH: runContentResearch,
  CONTENT_DRAFT: runContentDraft,
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
      await handler(job)
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
        // ⚠️ The pre-migration path. `jobService.fetchPending` returns
        // JobMinimal rows with no payload, so a payload-carrying handler cannot
        // run here and says so rather than starting with an empty topic.
        await handler({ id: job.id, job_type: job.job_type, payload: null })
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

const WEBHOOK_POLL_MS = 30_000

/**
 * Outbound webhooks (docs/developer-platform-migration.sql). Every instance
 * polls; each delivery is claimed by one of them (FOR UPDATE SKIP LOCKED) and
 * only the holder may record its outcome. Quiet before the migration.
 */
export async function pollWebhooks(): Promise<void> {
  try {
    const counts = await developerService.drainWebhooks()
    if (counts.sent || counts.failed) {
      console.log(`[webhooks] sent=${counts.sent} failed=${counts.failed}`)
    }
  } catch (err) {
    if (err instanceof NotConfiguredError) return
    console.error('[webhooks] poll failed:', err)
  }
}

const REQUEST_LOG_PURGE_MS = 6 * 3600_000

/** Retention for the API request log (30 days). Quiet before migration 02. */
export async function purgeApiRequestLogs(): Promise<void> {
  try {
    const purged = await developerService.purgeRequestLogs()
    if (purged) console.log(`[api-keys] purged ${purged} request log rows`)
  } catch (err) {
    if (err instanceof NotConfiguredError) return
    console.error('[api-keys] request log purge failed:', err)
  }
}

const ORDER_EXPIRY_MS = 15 * 60_000

/** Pending website orders nobody confirmed in time → cancelled («EXPIRED»). Quiet before migration 03. */
export async function expirePendingOrders(): Promise<void> {
  try {
    const expired = await ordersService.expirePending()
    if (expired) console.log(`[orders] expired ${expired} pending orders`)
  } catch (err) {
    if (err instanceof NotConfiguredError) return
    console.error('[orders] expiry failed:', err)
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
  const webhookInterval = setInterval(() => void pollWebhooks(), WEBHOOK_POLL_MS)
  const purgeInterval = setInterval(() => void purgeApiRequestLogs(), REQUEST_LOG_PURGE_MS)
  const orderExpiryInterval = setInterval(() => void expirePendingOrders(), ORDER_EXPIRY_MS)
  fastify.addHook('onClose', () => {
    clearInterval(interval)
    clearInterval(emailInterval)
    clearInterval(webhookInterval)
    clearInterval(purgeInterval)
    clearInterval(orderExpiryInterval)
  })
}
