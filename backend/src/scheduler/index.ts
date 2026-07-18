// ============================================
// backend/src/scheduler/index.ts
// Cron Job Scheduler
// ============================================

import cron from 'node-cron'
import { TrialExpirationWorker } from '../workers/trial-expiration.worker'

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

  console.log('✅ Scheduler started.')
}