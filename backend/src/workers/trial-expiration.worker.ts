// ============================================
// backend/src/workers/trial-expiration.worker.ts
// Trial Expiration Worker — Cron Job
// ============================================

import { supabase } from '../db'
import { BillingService } from '../services/billing.service'

const billingService = new BillingService()

export interface TrialExpirationResult {
  expired: number
  extended: number
  errors: number
  details: {
    userId: string
    plan: string
    trialEndsAt: string
    status: string
  }[]
}

export class TrialExpirationWorker {
  // ─── Run the worker ──────────────────────────────────────────
  async run(): Promise<TrialExpirationResult> {
    console.log('🔄 Trial Expiration Worker started...')

    const result: TrialExpirationResult = {
      expired: 0,
      extended: 0,
      errors: 0,
      details: [],
    }

    try {
      // ۱. دریافت Trialهای منقضی‌شده
      const expiredTrials = await this.getExpiredTrials()

      if (expiredTrials.length === 0) {
        console.log('✅ No expired trials found.')
        return result
      }

      console.log(`📋 Found ${expiredTrials.length} expired trials`)

      // ۲. پردازش هر Trial
      for (const trial of expiredTrials) {
        try {
          await this.processExpiredTrial(trial)
          result.expired++
          result.details.push({
            userId: trial.user_id,
            plan: trial.plan,
            trialEndsAt: trial.trial_ends_at,
            status: 'expired',
          })
        } catch (err) {
          console.error(`❌ Error processing trial for user ${trial.user_id}:`, err)
          result.errors++
        }
      }

      console.log(`✅ Trial Expiration Worker completed. Expired: ${result.expired}, Errors: ${result.errors}`)

      // ۳. ثبت Audit Log
      await this.logAudit(result)

      return result

    } catch (err) {
      console.error('❌ Trial Expiration Worker failed:', err)
      throw err
    }
  }

  // ─── Get expired trials ──────────────────────────────────────
  private async getExpiredTrials(): Promise<any[]> {
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('is_trial', true)
      .eq('trial_used', false)
      .lt('trial_ends_at', now)
      .in('status', ['trial', 'active'])

    if (error) {
      console.error('❌ Error fetching expired trials:', error)
      throw error
    }

    return data || []
  }

  // ─── Process a single expired trial ──────────────────────────
  private async processExpiredTrial(trial: any): Promise<void> {
    console.log(`⏰ Processing expired trial for user ${trial.user_id}`)

    const userId = trial.user_id

    // ۱. ارسال ایمیل به کاربر (قبل از تغییر)
    await this.sendExpirationEmail(userId, trial.trial_ends_at)

    // ۲. تغییر وضعیت اشتراک
    await billingService.expireTrial(userId)

    // ۳. ثبت رویداد
    await this.logEvent(userId, 'trial_expired', {
      trialEndsAt: trial.trial_ends_at,
      plan: trial.plan,
    })

    // ۴. ارسال نوتیفیکیشن درون برنامه‌ای
    await this.sendInAppNotification(userId, 'trial_expired')

    console.log(`✅ Trial expired for user ${userId}`)
  }

  // ─── Send expiration email ───────────────────────────────────
  private async sendExpirationEmail(userId: string, trialEndsAt: string): Promise<void> {
    try {
      // دریافت ایمیل کاربر
      const { data: user } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('id', userId)
        .single()

      if (!user?.email) return

      // ارسال ایمیل (با Resend یا سرویس ایمیل)
      console.log(`📧 Sending expiration email to ${user.email}`)
      
      // TODO: پیاده‌سازی ارسال ایمیل
      // await emailService.sendTrialExpired(user.email, user.full_name, trialEndsAt)

    } catch (err) {
      console.error(`❌ Error sending expiration email for user ${userId}:`, err)
    }
  }

  // ─── Send in-app notification ───────────────────────────────
  private async sendInAppNotification(userId: string, type: string): Promise<void> {
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'دوره آزمایشی شما به پایان رسید',
        body: 'برای ادامه استفاده از امکانات Pro، اشتراک خود را ارتقا دهید.',
        type: 'warning',
        action_url: '/pricing',
        created_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error(`❌ Error sending notification for user ${userId}:`, err)
    }
  }

  // ─── Log event ───────────────────────────────────────────────
  private async logEvent(userId: string, eventType: string, data: any): Promise<void> {
    try {
      await supabase.from('billing_events').insert({
        user_id: userId,
        event_type: eventType,
        event_data: data,
        created_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error(`❌ Error logging event for user ${userId}:`, err)
    }
  }

  // ─── Log audit ──────────────────────────────────────────────
  private async logAudit(result: TrialExpirationResult): Promise<void> {
    try {
      await supabase.from('audit_logs').insert({
        action: 'trial_expiration_worker',
        entity_type: 'system',
        new_data: result,
        created_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('❌ Error logging audit:', err)
    }
  }
}