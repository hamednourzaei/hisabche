// ============================================
// backend/src/services/referral/referral.service.ts
//
// Referral Core — orchestration. Rules in `referral.domain.ts`, tables in
// `referral.repository.ts`.
//
// The lifecycle this implements, end to end:
//
//   Referral link → Signup → Attribution → Workspace created
//     → Subscription started → PAYMENT CONFIRMED → Commission ledger
//     → Available reward
//
// ⚠️ THE ARROW THAT MATTERS IS «PAYMENT CONFIRMED». Nothing before it earns
// anything. A sign-up, a trial and a started-but-unpaid subscription all
// produce a referral row and zero commission.
// ============================================

import { randomBytes } from 'node:crypto'

import type { Plan } from '@hisabche/validation'
import { PLAN_PRICING } from '../billing.service'
import {
  ATTRIBUTION_WINDOW_DAYS,
  COMMISSION_PERIOD_LIMIT,
  PAYOUT_THRESHOLD_MINOR,
  REFERRAL_RATE_BPS,
  SIGNUP_DISCOUNT_BPS,
  buildReferralList,
  commissionEndsAt,
  commissionMinor,
  discountedFirstPaymentMinor,
  eligibility,
  generateReferralCode,
  isAttributionOpen,
  isReferralCodeShape,
  summarize,
  type ReferralListItem,
  type ReferralSummary,
  type ReversalReason,
} from './referral.domain'
import { ReferralRepository } from './referral.repository'

export interface ReferralOverview {
  /** null while the migration has not been run — the page says so. */
  code: string | null
  summary: ReferralSummary
  referrals: ReferralListItem[]
  terms: {
    rateBps: number
    signupDiscountBps: number
    periodLimit: number
    attributionWindowDays: number
    payoutThresholdMinor: number
  }
}

export class ReferralService {
  private repo = new ReferralRepository()

  /**
   * The caller's code, created on first read.
   *
   * ⚠️ A COLLISION IS RETRIED, NOT IGNORED. The code is globally unique, so an
   * insert can lose a race; returning null there would leave somebody with no
   * link and no error anywhere.
   */
  async getOrCreateCode(userId: string): Promise<string | null> {
    const existing = await this.repo.findCodeByUser(userId)
    if (existing?.code) return existing.code as string

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateReferralCode(randomBytes(16))
      const inserted = await this.repo.insertCode(userId, code)
      if (inserted?.code) return inserted.code as string

      // Either the schema is missing (nothing to do) or somebody took that
      // code between the check and the insert. Re-read first: a concurrent
      // request may have created OUR row.
      const mine = await this.repo.findCodeByUser(userId)
      if (mine?.code) return mine.code as string
    }

    return null
  }

  async getOverview(userId: string): Promise<ReferralOverview> {
    const [code, referrals, commissions] = await Promise.all([
      this.getOrCreateCode(userId),
      this.repo.listReferrals(userId),
      this.repo.listCommissions(userId),
    ])

    return {
      code,
      summary: summarize(referrals as never, commissions as never),
      referrals: buildReferralList(referrals as never, commissions as never),
      terms: {
        rateBps: REFERRAL_RATE_BPS,
        signupDiscountBps: SIGNUP_DISCOUNT_BPS,
        periodLimit: COMMISSION_PERIOD_LIMIT,
        attributionWindowDays: ATTRIBUTION_WINDOW_DAYS,
        payoutThresholdMinor: PAYOUT_THRESHOLD_MINOR,
      },
    }
  }

  /**
   * Attribution: record that a new business signed up through a link.
   *
   * ⚠️ SELF-REFERRAL IS REFUSED. Otherwise anyone opens a second account with
   * their own link and pays themselves 10% of their own subscription.
   *
   * ⚠️ ONE REFERRER PER WORKSPACE, AND IT NEVER CHANGES. The database's unique
   * constraint is the enforcement; this returns quietly when it fires, because
   * a second attempt is not an error — it is somebody trying to move an
   * attribution that was already decided.
   *
   * ⚠️ NEVER THROWS. This runs inside sign-up. A bad, expired or unknown code
   * must not stop a person creating their account: the referral is a bonus,
   * the sign-up is the product.
   */
  async attachReferral(input: {
    code: string
    referredUserId: string
    referredWorkspaceId: string
    referredName: string
  }): Promise<void> {
    try {
      if (!isReferralCodeShape(input.code)) return

      const owner = await this.repo.findCode(input.code.toUpperCase())
      if (!owner?.user_id) return
      if (owner.user_id === input.referredUserId) return

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + ATTRIBUTION_WINDOW_DAYS)

      await this.repo.insertReferral({
        referrer_user_id: owner.user_id,
        referred_user_id: input.referredUserId,
        referred_workspace_id: input.referredWorkspaceId,
        referred_name: input.referredName,
        code: input.code.toUpperCase(),
        attribution_expires_at: expiresAt.toISOString(),
        signup_discount_bps: SIGNUP_DISCOUNT_BPS,
      })
    } catch (error) {
      console.error('[ReferralService] attach failed:', error)
    }
  }

  /**
   * What a referred business pays on its FIRST subscription payment.
   *
   * Returns null when there is no referral, no discount left, or no price —
   * the caller then charges the list price. Never a guess.
   */
  async firstPaymentPriceMinor(
    workspaceId: string,
    plan: Plan,
    interval: 'month' | 'year',
  ): Promise<{ listMinor: number; payableMinor: number; discountBps: number } | null> {
    try {
      const referral = await this.repo.findReferralByWorkspace(workspaceId)
      if (!referral?.id) return null
      // Already used: the welcome discount is the FIRST payment only.
      if (referral.signup_discount_used_at) return null

      const listMinor = this.listPriceMinor(plan, interval)
      if (listMinor === null) return null

      const discountBps = Number(referral.signup_discount_bps) || SIGNUP_DISCOUNT_BPS
      return {
        listMinor,
        payableMinor: discountedFirstPaymentMinor(listMinor, discountBps),
        discountBps,
      }
    } catch (error) {
      console.error('[ReferralService] first-payment price failed:', error)
      return null
    }
  }

  /**
   * A referred business's payment succeeded — write the commission.
   *
   * ⚠️ CALLED ON A CONFIRMED PAYMENT, NOT ON AN INVOICE OR AN UPGRADE.
   * An invoice is a request for money; a subscription row going `active` on a
   * trial is not money either. Only a settled payment reaches here.
   *
   * ⚠️ IDEMPOTENT. `(subscription_id, period_start, kind)` is unique in the
   * database, so a webhook retry inserts nothing the second time.
   *
   * ⚠️ NEVER THROWS. The customer has already paid by this point; referral
   * bookkeeping must not turn their success into an error.
   */
  async recordPayment(input: {
    workspaceId: string
    subscriptionId: string
    plan: Plan
    interval: 'month' | 'year'
    periodStart: string
    isTrial: boolean
    /** What was actually charged. Omit to use the plan's list price. */
    paidAmountMinor?: number | undefined
  }): Promise<void> {
    try {
      const referral = await this.repo.findReferralByWorkspace(input.workspaceId)
      if (!referral?.id) return

      // Which paid period is this? The first one also opens the 12-month
      // window and marks the referral active.
      const alreadyEarned = await this.repo.countEarnedPeriods(referral.id)
      const periodIndex = alreadyEarned + 1

      const listMinor = this.listPriceMinor(input.plan, input.interval)
      // ⚠️ WHAT WAS PAID, not what was listed. The welcome discount means the
      // first payment is smaller, and 10% of a price nobody paid would come
      // out of the discount as well as the margin.
      const baseAmountMinor =
        input.paidAmountMinor !== undefined ? input.paidAmountMinor : (listMinor ?? 0)

      const verdict = eligibility({
        isTrial: input.isTrial,
        priceMinor: baseAmountMinor > 0 ? baseAmountMinor : listMinor,
        periodIndex,
        hasSuccessfulPayment: true,
      })
      if (verdict !== 'ok') return

      const amountMinor = commissionMinor(baseAmountMinor)
      if (amountMinor <= 0) return

      const pricing = PLAN_PRICING[input.plan]

      const inserted = await this.repo.insertCommission({
        referral_id: referral.id,
        referrer_user_id: referral.referrer_user_id,
        subscription_id: input.subscriptionId,
        kind: 'earned',
        plan: input.plan,
        interval: input.interval,
        period_start: input.periodStart,
        period_index: periodIndex,
        base_amount_minor: baseAmountMinor,
        rate_bps: REFERRAL_RATE_BPS,
        amount_minor: amountMinor,
        currency: pricing?.currency ?? 'USD',
      })

      // The first successful payment is what starts the 12-month window and
      // makes this referral «active». Written only when a row was actually
      // inserted, so a retry does not move the window forward.
      if (inserted && !referral.first_paid_at) {
        await this.repo.markFirstPayment(referral.id, {
          first_paid_at: input.periodStart,
          commission_ends_at: commissionEndsAt(input.periodStart),
        })
      }

      if (inserted && periodIndex === 1) {
        await this.repo.markDiscountUsed(referral.id, input.periodStart)
      }
    } catch (error) {
      console.error('[ReferralService] payment credit failed:', error)
    }
  }

  /**
   * Money came back — reverse what it earned.
   *
   * ⚠️ AN APPEND, NOT AN EDIT. The earned row stays exactly as it was and a
   * negative row points at it. Editing would destroy the record of what was
   * paid and when, which is the one thing an audit needs.
   */
  async reverse(input: {
    subscriptionId: string
    periodStart: string
    reason: ReversalReason
  }): Promise<void> {
    try {
      const earned = await this.repo.findEarned(input.subscriptionId, input.periodStart)
      if (!earned?.id) return

      await this.repo.insertCommission({
        referral_id: earned.referral_id,
        referrer_user_id: earned.referrer_user_id,
        subscription_id: input.subscriptionId,
        kind: 'reversal',
        reverses_id: earned.id,
        reversal_reason: input.reason,
        plan: earned.plan,
        interval: earned.interval,
        period_start: input.periodStart,
        period_index: earned.period_index,
        base_amount_minor: earned.base_amount_minor,
        rate_bps: earned.rate_bps,
        // Negative, so the balance is a plain SUM that cannot disagree with
        // the rows it came from.
        amount_minor: -(Number(earned.amount_minor) || 0),
        currency: earned.currency,
      })
    } catch (error) {
      console.error('[ReferralService] reversal failed:', error)
    }
  }

  /** The list price in the smallest unit, or null when the plan has none. */
  private listPriceMinor(plan: Plan, interval: 'month' | 'year'): number | null {
    const pricing = PLAN_PRICING[plan]
    const price = interval === 'year' ? pricing?.yearly : pricing?.monthly
    if (price === null || price === undefined) return null
    return Math.round(price * 100)
  }
}

export const referralService = new ReferralService()
