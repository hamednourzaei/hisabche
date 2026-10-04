// ============================================
// backend/src/scheduler/index.ts
// Cron Job Scheduler
//
// ⚠️ EVERY BACKEND INSTANCE STARTS THESE CRONS. With N instances each tick
// fires N times, so each task is wrapped in runScheduledOnce: the first
// instance to claim the tick's slot in Postgres runs it; the rest skip. A tick
// also cannot start while another instance's run of the same task is still
// open (docs/background-jobs-claim-migration.sql).
// ============================================

import cron from 'node-cron'
import { TrialExpirationWorker } from '../workers/trial-expiration.worker'
import { eventService } from '../services/event.service'
import { runScheduledOnce, slotOf } from '../services/distributed-work'
import { runDepreciationPosting } from '../workers/depreciation-posting.worker'
import { automationService } from '../services/automation/automation.service'
import { escalationService } from '../services/workflow/escalation.service'

const trialWorker = new TrialExpirationWorker()

// ⚠️ EXPLICIT UTC, never the server's local time.
//
// node-cron uses the PROCESS timezone unless told otherwise, so the same
// deployment would run the midnight task at a different real moment on a machine
// with another TZ — and two instances with different TZs would each run the
// daily task in a different UTC-day slot. Every schedule here is UTC and every
// slot is derived from the epoch (slotOf), so neither depends on the host.
//
// Neither task follows a local-business-time rule: trial expiry compares
// timestamps, and event recovery is an interval. 00:00 UTC is 04:30 in Kabul
// (UTC+4:30, no DST) and 03:30 in Tehran (UTC+3:30). A future task that must
// run at a LOCAL business hour should pass that IANA zone here explicitly —
// node-cron then handles DST — not rely on the host's.
export const SCHEDULER_TIMEZONE = 'UTC'

const DAY_SECONDS = 24 * 60 * 60
const EVENT_RECOVERY_SECONDS = 3 * 60

/** The daily trial-expiration pass — once per UTC day across all instances. */
export async function runTrialExpirationTick(now: Date = new Date()): Promise<boolean> {
  return runScheduledOnce('trial-expiration', slotOf(DAY_SECONDS, now), async () => {
    console.log('⏰ Running Trial Expiration Worker...')
    await trialWorker.run()
  })
}

/** The event-log recovery pass — once per 3-minute slot across all instances. */
export async function runEventRecoveryTick(now: Date = new Date()): Promise<boolean> {
  return runScheduledOnce(
    'event-log-recovery',
    slotOf(EVENT_RECOVERY_SECONDS, now),
    async () => {
      const result = await eventService.processPending()
      if (result.processed > 0 || result.failed > 0) {
        console.log(`⏰ Event Log Recovery: processed=${result.processed} failed=${result.failed}`)
      }
    },
    // Shorter than the period: a run still open after this is presumed dead.
    EVENT_RECOVERY_SECONDS,
  )
}

/**
 * Capability #70 — the daily depreciation pass, once per UTC day across all
 * instances.
 *
 * ⚠️ DAILY, not monthly, and that is deliberate. `postDue` measures against each
 * row's own `on_date`, so a daily run posts one period and a run that missed ten
 * days posts ten — on their own accounting dates. Monthly scheduling would mean
 * a shop that was down on the 1st posted a whole month on the 2nd, and the whole
 * point of a precomputed schedule is that a late run is still correct.
 *
 * The daily cost is one indexed read of rows that are already `posted_at IS
 * NULL` — normally zero.
 */
export async function runDepreciationTick(now: Date = new Date()): Promise<boolean> {
  return runScheduledOnce('depreciation-posting', slotOf(DAY_SECONDS, now), async () => {
    const result = await runDepreciationPosting()
    if (result.posted > 0 || result.errors.length > 0) {
      console.log(
        `⏰ Depreciation: workspaces=${result.workspaces} posted=${result.posted} ` +
          `skipped=${result.skipped} errors=${result.errors.length}`,
      )
    }
  })
}

/**
 * Capability #63 — the standing arrangements a business defined (recurring
 * invoices), once per UTC day across all instances.
 *
 * ⚠️ DAILY, AND LATE IS FINE. Each arrangement remembers the last day it was
 * evaluated and the pass walks every day after it, so a run that missed the 1st
 * issues the 1st's invoice the next morning, dated the 1st. The invoice itself
 * is idempotent per (arrangement, day), so a pass retried after a crash issues
 * nothing twice.
 */
export async function runAutomationTick(now: Date = new Date()): Promise<boolean> {
  return runScheduledOnce('automation-daily', slotOf(DAY_SECONDS, now), async () => {
    const result = await automationService.runDue(now.toISOString().slice(0, 10))
    if (result.ran > 0 || result.failed > 0) {
      console.log(
        `⏰ Automation: evaluated=${result.evaluated} ran=${result.ran} ` +
          `skipped=${result.skipped} failed=${result.failed}`,
      )
    }
  })
}

/**
 * Capability #68 — approvals nobody answered, once per hour across all
 * instances. A step past its workflow's policy gains a higher role allowed to
 * act on it, and those people are told. Nothing is approved by this.
 */
export async function runEscalationTick(now: Date = new Date()): Promise<boolean> {
  return runScheduledOnce('workflow-escalation', slotOf(60 * 60, now), async () => {
    const result = await escalationService.runDue(now)
    if (result.escalated > 0 || result.noOne > 0) {
      console.log(
        `⏰ Escalation: checked=${result.checked} escalated=${result.escalated} ` +
          `no-one=${result.noOne}`,
      )
    }
  })
}

export function startScheduler() {
  console.log('🔄 Starting scheduler...')

  // ─── Trial Expiration Worker ──────────────
  // هر روز ساعت ۰۰:۰۰ اجرا می‌شود
  cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        await runTrialExpirationTick()
      } catch (err) {
        console.error('❌ Trial Expiration Worker failed:', err)
      }
    },
    { timezone: SCHEDULER_TIMEZONE, name: 'trial-expiration' },
  )

  // ─── Event Log Recovery ───────────────────
  // ✅ FIX (Phase 2 — Event Architecture, محدودشده):
  // event.service.ts در emit() به‌صورت fire-and-forget بلافاصله
  // processEvent() را صدا می‌زند — این برای حالت عادی کافی است.
  // اما اگر سرور دقیقاً بین insert موفق در event_log و اتمام
  // processEvent کرش کند، آن رویداد برای همیشه pending می‌ماند،
  // چون قبلاً هیچ فراخوانی خودکار دیگری به processPending() وجود
  // نداشت (فقط از طریق POST /api/events/process به‌صورت دستی).
  // این cron همان نقش fallback recovery را ایفا می‌کند — نه
  // پردازش اصلی رویدادها.
  // هر ۳ دقیقه اجرا می‌شود.
  cron.schedule(
    '*/3 * * * *',
    async () => {
      try {
        await runEventRecoveryTick()
      } catch (err) {
        console.error('❌ Event Log Recovery failed:', err)
      }
    },
    { timezone: SCHEDULER_TIMEZONE, name: 'event-log-recovery' },
  )

  // ─── Depreciation Posting (#۷۰) ──────────────
  // روزی یک‌بار، UTC. هر ردیف با `posted_at IS NULL` در تاریخ خودش ثبت می‌شود،
  // پس یک اجرای دیرهنگام هم درست است — فقط دیر است.
  cron.schedule(
    '15 0 * * *',
    async () => {
      try {
        await runDepreciationTick()
      } catch (err) {
        console.error('❌ Depreciation posting failed:', err)
      }
    },
    { timezone: SCHEDULER_TIMEZONE, name: 'depreciation-posting' },
  )

  // ─── Standing arrangements (#۶۳ فاکتور تکراری) ──────────────
  // روزی یک‌بار، UTC، بعد از استهلاک. اجرای دیرهنگام هم درست است: هر قرار
  // روزهای ازدست‌رفته را خودش می‌پیماید و فاکتور را به تاریخ همان روز می‌زند.
  cron.schedule(
    '30 0 * * *',
    async () => {
      try {
        await runAutomationTick()
      } catch (err) {
        console.error('❌ Automation pass failed:', err)
      }
    },
    { timezone: SCHEDULER_TIMEZONE, name: 'automation-daily' },
  )

  // ─── Approval escalation (#۶۸) ──────────────
  // هر ساعت، دقیقه‌ی ۵. فقط گردش‌کارهایی که سیاست ارجاع دارند خوانده می‌شوند؛
  // بدون سیاست، هیچ کاری نمی‌کند.
  cron.schedule(
    '5 * * * *',
    async () => {
      try {
        await runEscalationTick()
      } catch (err) {
        console.error('❌ Escalation pass failed:', err)
      }
    },
    { timezone: SCHEDULER_TIMEZONE, name: 'workflow-escalation' },
  )

  console.log('✅ Scheduler started.')
}
