// ============================================
// backend/src/scheduler/index.ts
// Cron Job Scheduler
// ============================================

import cron from 'node-cron'
import { TrialExpirationWorker } from '../workers/trial-expiration.worker'
import { eventService } from '../services/event.service'

const trialWorker = new TrialExpirationWorker()

export function startScheduler() {
  console.log('🔄 Starting scheduler...')

  // ─── Trial Expiration Worker ──────────────
  // هر روز ساعت ۰۰:۰۰ اجرا می‌شود
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Running Trial Expiration Worker...')
    try {
      await trialWorker.run()
    } catch (err) {
      console.error('❌ Trial Expiration Worker failed:', err)
    }
  })

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
  cron.schedule('*/3 * * * *', async () => {
    try {
      const result = await eventService.processPending()
      if (result.processed > 0 || result.failed > 0) {
        console.log(
          `⏰ Event Log Recovery: processed=${result.processed} failed=${result.failed}`
        )
      }
    } catch (err) {
      console.error('❌ Event Log Recovery failed:', err)
    }
  })

  console.log('✅ Scheduler started.')
}