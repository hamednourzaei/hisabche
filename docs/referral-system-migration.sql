-- ============================================================================
-- REFERRAL SYSTEM — additive, idempotent, re-runnable.
--
-- The owner's model, in full:
--   • معرف: 10% of the subscription amount ACTUALLY PAID by the referred user
--   • activation: only after the FIRST SUCCESSFUL PAYMENT — never on sign-up
--   • duration: the first 12 paid months, then it stops
--   • the new user: 10% off their first payment
--   • reward is in-product CREDIT; a cash payout needs a $10 threshold
--
-- ⚠️ 10% OF THE SUBSCRIPTION, NEVER OF TURNOVER. A shop moving millions
-- through Hisabche is not a bigger commission — the revenue model is the
-- subscription, and tying a referral to turnover would promise a share of
-- money this business never earns.
--
-- ⚠️ RUN THIS YOURSELF IN THE SQL EDITOR. Nothing in this repository executes
-- DDL against the live database. The verification query is at the bottom.
--
-- ----------------------------------------------------------------------------
-- LOCK NOTE
--
-- Everything here is CREATE ... IF NOT EXISTS on NEW tables, so no existing
-- table is rewritten and no running query is blocked. `lock_timeout` is set
-- anyway: if another migration is mid-flight this one fails fast instead of
-- queueing behind it while holding its own locks.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1. The code a person shares.
--
-- ⚠️ ONE ROW PER USER, and the CODE is globally unique — it appears in a URL
-- with no workspace context, so it must resolve on its own.
--
-- ⚠️ NOT GUESSABLE. The application generates it from 16 random bytes over an
-- alphabet with no look-alike characters. A sequential or name-derived code
-- would let anyone credit themselves against a stranger's sign-ups.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  code        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_codes_code_key UNIQUE (code),
  CONSTRAINT referral_codes_user_key UNIQUE (user_id)
);

-- ----------------------------------------------------------------------------
-- 2. Attribution — who invited this business, decided once.
--
-- ⚠️ ONE REFERRER PER WORKSPACE, FOR EVER. The unique constraint IS the rule:
-- without it a second sign-up in the same shop would create a second referral
-- and pay twice, and a later «switch my referrer» would silently move an
-- earned commission to somebody else.
--
-- ⚠️ THE 12-MONTH WINDOW STARTS AT THE FIRST PAYMENT, NOT AT SIGN-UP.
-- `first_paid_at` is null until then, and while it is null this row has earned
-- nothing. A business that signs up and never pays costs the referrer nothing
-- and earns them nothing — which is the whole point of «only on a successful
-- payment».
--
-- `attribution_expires_at` closes the other end: a code clicked today does not
-- credit somebody who signs up two years later.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  referred_user_id       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  referred_workspace_id  uuid REFERENCES workspaces (id) ON DELETE SET NULL,
  -- ⚠️ A SNAPSHOT, like an invoice line's product name: the page must still
  -- read correctly after a workspace is renamed or deleted.
  referred_name          text,
  code                   text NOT NULL,
  signed_up_at           timestamptz NOT NULL DEFAULT now(),
  -- When the first successful payment landed. NULL = nothing earned yet.
  first_paid_at          timestamptz,
  -- Commissions stop 12 months after `first_paid_at`; written when it is set.
  commission_ends_at     timestamptz,
  -- After this, the code no longer attributes a new sign-up.
  attribution_expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  -- Was the new user's 10% welcome discount actually applied to a payment?
  -- ⚠️ Recorded, not assumed: «offered» and «used» are different facts.
  signup_discount_bps    integer NOT NULL DEFAULT 1000
                         CHECK (signup_discount_bps BETWEEN 0 AND 10000),
  signup_discount_used_at timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_workspace_once UNIQUE (referred_workspace_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx
  ON referrals (referrer_user_id, signed_up_at DESC);

-- ----------------------------------------------------------------------------
-- 3. The commission LEDGER.
--
-- ⚠️ A LEDGER, NOT A BALANCE COLUMN. A refund, a chargeback or a cancelled
-- subscription does not edit the row that was earned — it appends a REVERSAL.
-- Editing would destroy the record of what was paid and when, which is the one
-- thing an audit needs. Same rule the rest of this product follows for money.
--
-- ⚠️ THE BASE AMOUNT AND RATE ARE STORED, NOT RE-DERIVED. If the price of
-- «pro» changes next year, last year's commissions must still show what they
-- were actually calculated from.
--
-- ⚠️ MONEY IS AN INTEGER IN THE SMALLEST UNIT (راهنمای سشن §۱٫۳).
-- $12.00 is 1200. `rate_bps` is basis points: 1000 = 10%.
--
-- ⚠️ ONE ROW PER PAID PERIOD, enforced by the unique key, so a webhook retry
-- cannot pay twice. `period_index` is 1..12 — the cap is data, not a comment.
--
-- `kind`: 'earned' is money owed; 'reversal' is a negative entry pointing at
-- the row it cancels. The balance is the SUM, never a stored number.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_commissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id       uuid NOT NULL REFERENCES referrals (id) ON DELETE CASCADE,
  referrer_user_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subscription_id   uuid,
  kind              text NOT NULL DEFAULT 'earned'
                    CHECK (kind IN ('earned', 'reversal')),
  -- The earned row this reverses. NULL on an 'earned' row.
  reverses_id       uuid REFERENCES referral_commissions (id) ON DELETE SET NULL,
  reversal_reason   text CHECK (
                      reversal_reason IS NULL
                      OR reversal_reason IN ('refund', 'chargeback', 'cancellation', 'manual')
                    ),
  plan              text NOT NULL,
  interval          text NOT NULL CHECK (interval IN ('month', 'year')),
  period_start      timestamptz NOT NULL,
  -- 1 for the first paid period, up to 12. The window's enforcement.
  period_index      integer NOT NULL CHECK (period_index BETWEEN 1 AND 12),
  base_amount_minor bigint NOT NULL CHECK (base_amount_minor >= 0),
  rate_bps          integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  -- ⚠️ SIGNED. A reversal is negative; the balance is a plain SUM and cannot
  -- disagree with the rows it came from.
  amount_minor      bigint NOT NULL,
  currency          text NOT NULL,
  -- pending: earned, not yet settled · credited: turned into product credit
  -- · paid: cash paid out · void: never owed.
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'credited', 'paid', 'void')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_commissions_period_once
    UNIQUE (subscription_id, period_start, kind)
);

CREATE INDEX IF NOT EXISTS referral_commissions_referrer_idx
  ON referral_commissions (referrer_user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Settlement.
--
-- ⚠️ THE THRESHOLD LIVES HERE AS DATA. «at least $10» is a business rule that
-- will be tuned; a constant in TypeScript would mean a deploy to change it and
-- no record of what it was when a payout was refused.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_payouts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount_minor      bigint NOT NULL CHECK (amount_minor > 0),
  currency          text NOT NULL,
  -- 'credit' keeps the money inside the product — the owner's preference,
  -- because it creates no cash pressure. 'cash' is a real transfer.
  method            text NOT NULL DEFAULT 'credit' CHECK (method IN ('credit', 'cash')),
  threshold_minor   bigint NOT NULL,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_payouts_referrer_idx
  ON referral_payouts (referrer_user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Row security.
--
-- ⚠️ `auth_workspace_ids()` DOES NOT EXIST ON THIS DATABASE — an earlier
-- migration failed with 42883 for using it. These policies use `auth.uid()`
-- directly, which is what these tables are keyed by: a referral belongs to a
-- PERSON, not to a workspace.
--
-- The service role bypasses RLS, so the backend still writes a commission for
-- somebody other than the caller — which is exactly what an activation does.
-- ----------------------------------------------------------------------------
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_codes_own ON referral_codes;
CREATE POLICY referral_codes_own ON referral_codes
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS referrals_own ON referrals;
CREATE POLICY referrals_own ON referrals
  FOR SELECT USING (referrer_user_id = auth.uid());

DROP POLICY IF EXISTS referral_commissions_own ON referral_commissions;
CREATE POLICY referral_commissions_own ON referral_commissions
  FOR SELECT USING (referrer_user_id = auth.uid());

DROP POLICY IF EXISTS referral_payouts_own ON referral_payouts;
CREATE POLICY referral_payouts_own ON referral_payouts
  FOR SELECT USING (referrer_user_id = auth.uid());

COMMIT;

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- These are new tables holding new facts; nothing existing depends on them.
-- Dropping them destroys every recorded referral and every commission — that
-- is data loss, not a no-op. Export first if any row exists.
--
--   BEGIN;
--   DROP TABLE IF EXISTS referral_payouts;
--   DROP TABLE IF EXISTS referral_commissions;
--   DROP TABLE IF EXISTS referrals;
--   DROP TABLE IF EXISTS referral_codes;
--   COMMIT;
--
-- To switch the feature OFF without losing data, stop the backend writing to
-- it rather than dropping the tables.
-- ============================================================================

-- ============================================================================
-- VERIFICATION — run separately, after the migration.
-- Every row must read ok = true.
-- ============================================================================
-- SELECT 'referral_codes exists'       AS check, to_regclass('public.referral_codes')       IS NOT NULL AS ok
-- UNION ALL SELECT 'referrals exists',           to_regclass('public.referrals')            IS NOT NULL
-- UNION ALL SELECT 'commissions exists',         to_regclass('public.referral_commissions') IS NOT NULL
-- UNION ALL SELECT 'payouts exists',             to_regclass('public.referral_payouts')     IS NOT NULL
-- UNION ALL SELECT 'code is unique',             EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referral_codes_code_key')
-- UNION ALL SELECT 'one referrer per workspace', EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_workspace_once')
-- UNION ALL SELECT 'one row per paid period',    EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referral_commissions_period_once')
-- UNION ALL SELECT 'window capped at 12',        EXISTS (
--   SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
--   WHERE t.relname = 'referral_commissions' AND pg_get_constraintdef(c.oid) ILIKE '%period_index%12%')
-- UNION ALL SELECT 'rls on codes',               relrowsecurity FROM pg_class WHERE relname = 'referral_codes'
-- UNION ALL SELECT 'rls on referrals',           relrowsecurity FROM pg_class WHERE relname = 'referrals'
-- UNION ALL SELECT 'rls on commissions',         relrowsecurity FROM pg_class WHERE relname = 'referral_commissions'
-- UNION ALL SELECT 'rls on payouts',             relrowsecurity FROM pg_class WHERE relname = 'referral_payouts';
