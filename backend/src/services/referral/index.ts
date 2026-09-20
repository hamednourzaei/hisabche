// ============================================
// backend/src/services/referral/index.ts — the Referral Core public surface.
// Nothing outside this folder imports `referral.repository` or names the
// `referrals` / `referral_codes` / `referral_commissions` tables.
// ============================================

export { ReferralService, referralService, type ReferralOverview } from './referral.service'
export {
  ATTRIBUTION_WINDOW_DAYS,
  COMMISSION_PERIOD_LIMIT,
  PAYOUT_THRESHOLD_MINOR,
  REFERRAL_RATE_BPS,
  SIGNUP_DISCOUNT_BPS,
  commissionEndsAt,
  commissionMinor,
  discountedFirstPaymentMinor,
  eligibility,
  generateReferralCode,
  isAttributionOpen,
  isReferralCodeShape,
  type CommissionStatus,
  type EligibilityReason,
  type ReferralListItem,
  type ReferralSummary,
  type ReversalReason,
} from './referral.domain'
