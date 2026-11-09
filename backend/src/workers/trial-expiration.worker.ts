// ============================================
// backend/src/workers/trial-expiration.worker.ts
// Trial Expiration Worker — daily (scheduler/index.ts)
// ============================================
//
// Audit L-02 (8 Nov 2026) — what this worker used to get wrong:
//
// · It ended a trial at `trial_ends_at`, while `isSubscriptionExpired` and
//   /billing promise GRACE_PERIOD_DAYS more. The day the trial ended the shop
//   lost its grace window. A trial is now ended only after the grace window.
// · It expired by USER id, which turned every subscription of that person —
//   a paid one for another business included — into «free». Now by row id
//   (`BillingService.expireTrial`).
// · The e-mail read a `users` table no migration creates, logged the address,
//   and then did nothing (`// TODO`). `emailService.sendTrialExpired` existed
//   and nobody called it. It now goes through the e-mail outbox like every
//   other mail; the address comes from Supabase Auth and is never logged.
// · The in-app notice had no workspace, so it showed in every business.

import { supabase } from '../db'
import { BillingService, GRACE_PERIOD_DAYS } from '../services/billing.service'
import { emailService } from '../services/email.service'

const billingService = new BillingService()

const DAY_MS = 24 * 60 * 60 * 1000

interface ExpiredTrialRow {
  id: string
  user_id: string
  workspace_id: string | null
  plan: string
  trial_ends_at: string
}

export interface TrialExpirationResult {
  expired: number
  extended: number
  errors: number
  details: {
    subscriptionId: string
    plan: string
    trialEndsAt: string
    status: string
  }[]
}

/** The latest `trial_ends_at` whose grace window is over at `now`. */
export function trialCutoff(now: Date): string {
  return new Date(now.getTime() - GRACE_PERIOD_DAYS * DAY_MS).toISOString()
}

export class TrialExpirationWorker {
  async run(now: Date = new Date()): Promise<TrialExpirationResult> {
    const result: TrialExpirationResult = { expired: 0, extended: 0, errors: 0, details: [] }

    const expiredTrials = await this.getExpiredTrials(now)
    for (const trial of expiredTrials) {
      try {
        await this.processExpiredTrial(trial)
        result.expired++
        result.details.push({
          subscriptionId: trial.id,
          plan: trial.plan,
          trialEndsAt: trial.trial_ends_at,
          status: 'expired',
        })
      } catch (err) {
        console.error(`[trial-expiration] subscription ${trial.id} failed:`, err)
        result.errors++
      }
    }

    if (expiredTrials.length > 0) await this.logAudit(result)
    return result
  }

  private async getExpiredTrials(now: Date): Promise<ExpiredTrialRow[]> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, user_id, workspace_id, plan, trial_ends_at')
      .eq('is_trial', true)
      .eq('trial_used', false)
      .lt('trial_ends_at', trialCutoff(now))
      .in('status', ['trial', 'active'])

    if (error) throw error
    return (data ?? []) as ExpiredTrialRow[]
  }

  private async processExpiredTrial(trial: ExpiredTrialRow): Promise<void> {
    // The state change first: a mail about an expiry that then failed to be
    // written would be a message about something that did not happen.
    await billingService.expireTrial(trial.id, trial.user_id, trial.workspace_id)

    await this.logEvent(trial)
    await this.sendInAppNotification(trial)
    await this.sendExpirationEmail(trial)
  }

  /** Queued in the e-mail outbox (email.service → enqueueEmail). Never logs the address. */
  private async sendExpirationEmail(trial: ExpiredTrialRow): Promise<void> {
    try {
      const { data, error } = await supabase.auth.admin.getUserById(trial.user_id)
      if (error || !data.user?.email) return
      const meta = data.user.user_metadata as Record<string, unknown> | undefined
      const name = typeof meta?.full_name === 'string' ? meta.full_name : ''
      await emailService.sendTrialExpired(data.user.email, name)
    } catch (err) {
      // A mail that cannot be queued must not undo the expiry (CLAUDE.md:
      // a notification never reverses a write that happened).
      console.error(
        `[trial-expiration] mail not queued for subscription ${trial.id}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  private async sendInAppNotification(trial: ExpiredTrialRow): Promise<void> {
    const { error } = await supabase.from('notifications').insert({
      user_id: trial.user_id,
      workspace_id: trial.workspace_id,
      title: 'دوره آزمایشی شما به پایان رسید',
      body: 'برای ادامه استفاده از امکانات Pro، اشتراک خود را ارتقا دهید.',
      type: 'warning',
      action_url: '/billing',
      created_at: new Date().toISOString(),
    })
    if (error)
      console.error(`[trial-expiration] notice not written for ${trial.id}:`, error.message)
  }

  private async logEvent(trial: ExpiredTrialRow): Promise<void> {
    const { error } = await supabase.from('billing_events').insert({
      user_id: trial.user_id,
      event_type: 'trial_expired',
      event_data: { subscriptionId: trial.id, trialEndsAt: trial.trial_ends_at, plan: trial.plan },
      created_at: new Date().toISOString(),
    })
    if (error) console.error(`[trial-expiration] event not logged for ${trial.id}:`, error.message)
  }

  private async logAudit(result: TrialExpirationResult): Promise<void> {
    const { error } = await supabase.from('audit_logs').insert({
      action: 'trial_expiration_worker',
      entity_type: 'system',
      new_data: result,
      created_at: new Date().toISOString(),
    })
    if (error) console.error('[trial-expiration] audit not logged:', error.message)
  }
}
