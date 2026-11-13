// ============================================
// backend/src/services/referral/referral.repository.ts
//
// ⚠️ THE ONLY FILE THAT NAMES `referral_codes`, `referrals` and
// `referral_commissions`. Everything else goes through the service — the
// core-module rule (`.claude/architecture/core-modules.md`), enforced by
// `referral-core.test.ts`.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'

type Row = Record<string, any>

const PAGE = 1000

/**
 * ⚠️ The referral tables arrive with a migration the owner runs by hand
 * (`docs/referral-system-migration.sql`). Until then PostgREST answers 42P01.
 * That is «not configured yet», not a crash — every read below turns it into
 * an empty result and the page shows its own empty state.
 */
export function isMissingReferralSchema(error: { code?: string; message?: string } | null) {
  if (!error) return false
  return error.code === '42P01' || /relation .*referral/i.test(error.message ?? '')
}

export class ReferralRepository {
  async findCodeByUser(userId: string): Promise<Row | null> {
    const { data, error } = await supabase
      .from('referral_codes')
      .select('id, user_id, code, created_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      if (isMissingReferralSchema(error)) return null
      throw new DatabaseError('Failed to read the referral code', error)
    }
    return data
  }

  async findCode(code: string): Promise<Row | null> {
    const { data, error } = await supabase
      .from('referral_codes')
      .select('id, user_id, code')
      .eq('code', code)
      .maybeSingle()

    if (error) {
      if (isMissingReferralSchema(error)) return null
      throw new DatabaseError('Failed to resolve the referral code', error)
    }
    return data
  }

  async insertCode(userId: string, code: string): Promise<Row | null> {
    const { data, error } = await supabase
      .from('referral_codes')
      .insert({ user_id: userId, code })
      .select('id, user_id, code, created_at')
      .single()

    if (error) {
      if (isMissingReferralSchema(error)) return null
      throw new DatabaseError('Failed to create the referral code', error)
    }
    return data
  }

  /**
   * ⚠️ PAGED. A figure someone is paid on must not stop at PostgREST's default
   * 1000 rows (راهنمای سشن §۷٫۴).
   */
  async listReferrals(referrerUserId: string): Promise<Row[]> {
    const rows: Row[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('referrals')
        .select(
          'id, referred_name, referred_workspace_id, signed_up_at, first_paid_at, commission_ends_at',
        )
        .eq('referrer_user_id', referrerUserId)
        .order('signed_up_at', { ascending: false })
        .range(from, from + PAGE - 1)

      if (error) {
        if (isMissingReferralSchema(error)) return []
        throw new DatabaseError('Failed to read referrals', error)
      }
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE) return rows
    }
  }

  async listCommissions(referrerUserId: string): Promise<Row[]> {
    const rows: Row[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('referral_commissions')
        .select(
          'referral_id, kind, plan, interval, period_index, base_amount_minor, amount_minor, currency, status, created_at',
        )
        .eq('referrer_user_id', referrerUserId)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)

      if (error) {
        if (isMissingReferralSchema(error)) return []
        throw new DatabaseError('Failed to read commissions', error)
      }
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE) return rows
    }
  }

  async insertReferral(row: Row): Promise<Row | null> {
    const { data, error } = await supabase.from('referrals').insert(row).select('id').single()

    if (error) {
      if (isMissingReferralSchema(error)) return null
      // 23505 — this workspace already has a referral. The unique constraint
      // is the point: a business is referred once, so a duplicate is a no-op
      // rather than a failure the caller has to handle.
      if (error.code === '23505') return null
      throw new DatabaseError('Failed to record the referral', error)
    }
    return data
  }

  async findReferralByWorkspace(workspaceId: string): Promise<Row | null> {
    const { data, error } = await supabase
      .from('referrals')
      .select(
        'id, referrer_user_id, first_paid_at, signup_discount_bps, signup_discount_used_at, attribution_expires_at',
      )
      .eq('referred_workspace_id', workspaceId)
      .maybeSingle()

    if (error) {
      if (isMissingReferralSchema(error)) return null
      throw new DatabaseError('Failed to resolve the referral', error)
    }
    return data
  }

  /**
   * How many paid periods this referral has already earned.
   *
   * ⚠️ `count: 'exact'` with `head: true` — the number decides whether the
   * 12-period window is exhausted, so an estimate is not acceptable
   * (راهنمای سشن §۷٫۴). Reversals are excluded: a refunded month still
   * consumed its slot, but only `earned` rows define the index.
   */
  async countEarnedPeriods(referralId: string): Promise<number> {
    const { count, error } = await supabase
      .from('referral_commissions')
      .select('id', { count: 'exact', head: true })
      .eq('referral_id', referralId)
      .eq('kind', 'earned')

    if (error) {
      if (isMissingReferralSchema(error)) return 0
      throw new DatabaseError('Failed to count referral periods', error)
    }
    return count ?? 0
  }

  /** The earned row a reversal points at. */
  async findEarned(subscriptionId: string, periodStart: string): Promise<Row | null> {
    const { data, error } = await supabase
      .from('referral_commissions')
      .select(
        'id, referral_id, referrer_user_id, plan, interval, period_index, base_amount_minor, rate_bps, amount_minor, currency',
      )
      .eq('subscription_id', subscriptionId)
      .eq('period_start', periodStart)
      .eq('kind', 'earned')
      .maybeSingle()

    if (error) {
      if (isMissingReferralSchema(error)) return null
      throw new DatabaseError('Failed to resolve the commission to reverse', error)
    }
    return data
  }

  /**
   * Open the 12-month window.
   *
   * ⚠️ `is('first_paid_at', null)` — the window is opened ONCE. Without it a
   * retry would push the end date forward and quietly extend the programme.
   */
  async markFirstPayment(referralId: string, patch: Row): Promise<void> {
    const { error } = await supabase
      .from('referrals')
      .update(patch)
      .eq('id', referralId)
      .is('first_paid_at', null)

    if (error && !isMissingReferralSchema(error)) {
      throw new DatabaseError('Failed to open the commission window', error)
    }
  }

  /** The welcome discount is the first payment only; record that it was used. */
  async markDiscountUsed(referralId: string, at: string): Promise<void> {
    const { error } = await supabase
      .from('referrals')
      .update({ signup_discount_used_at: at })
      .eq('id', referralId)
      .is('signup_discount_used_at', null)

    if (error && !isMissingReferralSchema(error)) {
      throw new DatabaseError('Failed to record the welcome discount', error)
    }
  }

  async insertCommission(row: Row): Promise<Row | null> {
    const { data, error } = await supabase
      .from('referral_commissions')
      .insert(row)
      .select('id')
      .single()

    if (error) {
      if (isMissingReferralSchema(error)) return null
      // 23505 — a commission already exists for this subscription period. A
      // webhook retry must not pay twice; the constraint makes that
      // impossible and this makes the retry succeed quietly.
      if (error.code === '23505') return null
      throw new DatabaseError('Failed to record the commission', error)
    }
    return data
  }
}
