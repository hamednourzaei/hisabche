-- ============================================================================
-- docs/wallet-01-migration.sql                           (28 Sep 2026)
--
-- ⚠️ RUN AFTER docs/subscription-upgrade-requests-migration.sql (it reuses
-- create_subscription_upgrade_request and approve_subscription_upgrade).
--
-- A WALLET PER BUSINESS (per workspace, never per user).
--
--   wallet_payment_methods  how money reaches the platform (card-to-card, a
--                           foreign-currency account). Defined by a platform
--                           admin. DEFAULT: none — the UI says so plainly.
--   wallets                 one row per (workspace, currency). balance_minor
--                           ≥ 0, and it moves ONLY inside the functions below.
--   wallet_transactions     the ledger. Append-only (a trigger refuses UPDATE
--                           and DELETE). Signed amount, balance_after.
--   wallet_topup_requests   «I paid; please credit». A tracking number is
--                           required; one receipt reference can be credited
--                           once per method.
--
-- WHY FUNCTIONS: supabase-js has no transactions (CLAUDE.md rule 4). A top-up
-- is a request row + a balance + a ledger row; paying a plan is a balance + a
-- ledger row + an upgrade request + the activation. Each is ONE function call.
--
-- MONEY: integer minor units only (rule 3). The plan price is computed by the
-- backend from plan-pricing.ts; the function trusts no client number.
--
-- SAFETY
--   * Additive and idempotent (IF NOT EXISTS, CREATE OR REPLACE, guarded DO).
--   * The one existing object touched: the payment_method CHECK of
--     subscription_upgrade_requests is WIDENED to accept 'wallet' (every value
--     accepted before is still accepted).
--   * Every function: SECURITY INVOKER, fixed search_path, EXECUTE for
--     service_role only. Members READ their own workspace's wallet through RLS;
--     nothing on the client path writes.
--   * The receipts bucket is PRIVATE; a receipt is read through a short-lived
--     signed URL issued by the backend.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.wallet_pay_subscription_upgrade(uuid, uuid, text, text, text, bigint, text, text, text);
--   DROP FUNCTION IF EXISTS public.wallet_adjust(uuid, text, bigint, uuid, text);
--   DROP FUNCTION IF EXISTS public.reject_wallet_topup(uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.cancel_wallet_topup(uuid, uuid, uuid);
--   DROP FUNCTION IF EXISTS public.approve_wallet_topup(uuid, uuid, bigint, text);
--   DROP FUNCTION IF EXISTS public.create_wallet_topup_request(uuid, uuid, uuid, bigint, text, text, date, text, text, text);
--   -- Tables hold money records: keep them. If they must go, export first:
--   -- DROP TABLE public.wallet_topup_requests, public.wallet_transactions, public.wallets, public.wallet_payment_methods;
--   The backend answers WALLET_NOT_CONFIGURED (503) while they are absent.
-- ============================================================================

-- ─── 1. Payment methods (platform-level) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_payment_methods (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind IN ('card_to_card', 'foreign_currency')),
  currency     text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  title        text NOT NULL CHECK (length(btrim(title)) > 0),
  -- What the payer must do, shown on the top-up form.
  instructions text NOT NULL DEFAULT '',
  -- The card number or the account the money goes to.
  destination  text NOT NULL CHECK (length(btrim(destination)) > 0),
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. Wallets ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  currency      text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  balance_minor bigint NOT NULL DEFAULT 0 CHECK (balance_minor >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, currency)
);

-- The balance moves only inside the wallet functions: they set a
-- transaction-local flag; anything else (a stray UPDATE from any client or
-- script) is refused, so the balance can never drift from its ledger.
CREATE OR REPLACE FUNCTION public.wallet_balance_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('hisabche.wallet_write', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' AND NEW.balance_minor = 0 THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'WALLET_DIRECT_WRITE: a wallet balance moves only through the wallet functions'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallets_balance_guard ON public.wallets;
CREATE TRIGGER wallets_balance_guard
  BEFORE INSERT OR UPDATE OF balance_minor ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.wallet_balance_guard();

-- ─── 3. The ledger ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL,
  wallet_id      uuid NOT NULL REFERENCES public.wallets(id),
  currency       text NOT NULL,
  amount_minor   bigint NOT NULL CHECK (amount_minor <> 0),
  balance_after  bigint NOT NULL CHECK (balance_after >= 0),
  kind           text NOT NULL CHECK (kind IN ('topup', 'adjustment', 'subscription_payment')),
  reference_type text,
  reference_id   uuid,
  actor_id       uuid,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_transactions_wallet_idx
  ON public.wallet_transactions (workspace_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.wallet_ledger_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'WALLET_LEDGER_APPEND_ONLY: a ledger line is corrected with a new line, never edited'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS wallet_transactions_append_only ON public.wallet_transactions;
CREATE TRIGGER wallet_transactions_append_only
  BEFORE UPDATE OR DELETE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.wallet_ledger_append_only();

-- ─── 4. Top-up requests ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallet_topup_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL,
  method_id             uuid NOT NULL REFERENCES public.wallet_payment_methods(id),
  currency              text NOT NULL,
  amount_minor          bigint NOT NULL CHECK (amount_minor > 0),
  -- What the admin actually received and credited (may differ from the claim).
  credited_amount_minor bigint CHECK (credited_amount_minor IS NULL OR credited_amount_minor > 0),
  payer_reference       text NOT NULL CHECK (length(btrim(payer_reference)) > 0),
  card_last4            text CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'),
  paid_at               date NOT NULL,
  receipt_path          text,
  receipt_mime          text,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by          uuid NOT NULL,
  member_note           text,
  decided_by            uuid,
  decided_at            timestamptz,
  admin_note            text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ONE RECEIPT, CREDITED ONCE. A reference that is pending or approved cannot
-- be filed again for the same method; a rejected or withdrawn one can (the
-- member may have mistyped it the first time).
CREATE UNIQUE INDEX IF NOT EXISTS wallet_topup_requests_reference_key
  ON public.wallet_topup_requests (method_id, payer_reference)
  WHERE status IN ('pending', 'approved');
CREATE INDEX IF NOT EXISTS wallet_topup_requests_queue_idx
  ON public.wallet_topup_requests (status, created_at);
CREATE INDEX IF NOT EXISTS wallet_topup_requests_workspace_idx
  ON public.wallet_topup_requests (workspace_id, created_at DESC);

-- ─── 5. «Paid from the wallet» is a payment method of an upgrade ──────────
DO $$
DECLARE
  v_name text;
BEGIN
  SELECT c.conname INTO v_name
    FROM pg_constraint c
   WHERE c.conrelid = 'public.subscription_upgrade_requests'::regclass
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%payment_method%';
  IF v_name IS NOT NULL AND v_name <> 'subscription_upgrade_requests_payment_method_check2' THEN
    EXECUTE format('ALTER TABLE public.subscription_upgrade_requests DROP CONSTRAINT %I', v_name);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'subscription_upgrade_requests_payment_method_check2'
  ) THEN
    ALTER TABLE public.subscription_upgrade_requests
      ADD CONSTRAINT subscription_upgrade_requests_payment_method_check2
      CHECK (payment_method IS NULL OR payment_method IN ('card_to_card', 'gateway', 'manual', 'wallet'));
  END IF;
END
$$;

-- ─── 6. Functions ──────────────────────────────────────────────────────────

-- The one place a balance moves: lock-or-create the wallet, check the floor,
-- write the balance and its ledger line together. Internal (called by the
-- functions below, never granted to anyone).
CREATE OR REPLACE FUNCTION public.wallet_post(
  p_workspace_id uuid,
  p_currency     text,
  p_amount_minor bigint,
  p_kind         text,
  p_ref_type     text,
  p_ref_id       uuid,
  p_actor_id     uuid,
  p_note         text
)
RETURNS bigint
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wallet  public.wallets%ROWTYPE;
  v_balance bigint;
BEGIN
  IF p_amount_minor = 0 THEN
    RAISE EXCEPTION 'WALLET_AMOUNT_INVALID' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.wallets (workspace_id, currency) VALUES (p_workspace_id, p_currency)
    ON CONFLICT (workspace_id, currency) DO NOTHING;
  SELECT * INTO v_wallet FROM public.wallets
   WHERE workspace_id = p_workspace_id AND currency = p_currency
   FOR UPDATE;

  v_balance := v_wallet.balance_minor + p_amount_minor;
  IF v_balance < 0 THEN
    RAISE EXCEPTION 'WALLET_INSUFFICIENT_FUNDS' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('hisabche.wallet_write', 'on', true);
  UPDATE public.wallets SET balance_minor = v_balance, updated_at = now() WHERE id = v_wallet.id;
  PERFORM set_config('hisabche.wallet_write', 'off', true);

  INSERT INTO public.wallet_transactions
    (workspace_id, wallet_id, currency, amount_minor, balance_after, kind,
     reference_type, reference_id, actor_id, note)
  VALUES
    (p_workspace_id, v_wallet.id, p_currency, p_amount_minor, v_balance, p_kind,
     p_ref_type, p_ref_id, p_actor_id, p_note);

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_wallet_topup_request(
  p_workspace_id    uuid,
  p_user_id         uuid,
  p_method_id       uuid,
  p_amount_minor    bigint,
  p_payer_reference text,
  p_card_last4      text,
  p_paid_at         date,
  p_receipt_path    text,
  p_receipt_mime    text,
  p_note            text
)
RETURNS public.wallet_topup_requests
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_method public.wallet_payment_methods%ROWTYPE;
  v_row    public.wallet_topup_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_method FROM public.wallet_payment_methods WHERE id = p_method_id;
  IF NOT FOUND OR NOT v_method.is_active THEN
    RAISE EXCEPTION 'WALLET_METHOD_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;
  IF v_method.kind = 'card_to_card' AND (p_card_last4 IS NULL OR p_card_last4 !~ '^[0-9]{4}$') THEN
    RAISE EXCEPTION 'WALLET_CARD_LAST4_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_paid_at > current_date + 1 THEN
    RAISE EXCEPTION 'WALLET_PAID_AT_IN_FUTURE' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.wallet_topup_requests
      (workspace_id, method_id, currency, amount_minor, payer_reference, card_last4,
       paid_at, receipt_path, receipt_mime, requested_by, member_note)
    VALUES
      (p_workspace_id, p_method_id, v_method.currency, p_amount_minor, btrim(p_payer_reference),
       CASE WHEN v_method.kind = 'card_to_card' THEN p_card_last4 END,
       p_paid_at, p_receipt_path, p_receipt_mime, p_user_id, NULLIF(btrim(p_note), ''))
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'WALLET_TOPUP_DUPLICATE_REFERENCE' USING ERRCODE = '23505';
  END;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_wallet_topup(
  p_request_id     uuid,
  p_admin_id       uuid,
  p_credited_minor bigint DEFAULT NULL,
  p_note           text   DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req    public.wallet_topup_requests%ROWTYPE;
  v_amount bigint;
BEGIN
  SELECT * INTO v_req FROM public.wallet_topup_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_TOPUP_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'WALLET_TOPUP_NOT_PENDING' USING ERRCODE = 'P0001';
  END IF;

  v_amount := COALESCE(p_credited_minor, v_req.amount_minor);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'WALLET_AMOUNT_INVALID' USING ERRCODE = '22023'; END IF;

  UPDATE public.wallet_topup_requests
     SET status = 'approved', credited_amount_minor = v_amount,
         decided_by = p_admin_id, decided_at = now(), admin_note = NULLIF(btrim(p_note), '')
   WHERE id = p_request_id;

  RETURN public.wallet_post(v_req.workspace_id, v_req.currency, v_amount, 'topup',
                            'wallet_topup_request', v_req.id, p_admin_id, NULLIF(btrim(p_note), ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_wallet_topup(
  p_request_id uuid,
  p_admin_id   uuid,
  p_note       text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_note IS NULL OR length(btrim(p_note)) = 0 THEN
    -- The member is told why; a refusal without a reason is unanswerable.
    RAISE EXCEPTION 'WALLET_NOTE_REQUIRED' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO v_status FROM public.wallet_topup_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_TOPUP_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'WALLET_TOPUP_NOT_PENDING' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.wallet_topup_requests
     SET status = 'rejected', decided_by = p_admin_id, decided_at = now(), admin_note = btrim(p_note)
   WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_wallet_topup(
  p_request_id   uuid,
  p_workspace_id uuid,
  p_user_id      uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.wallet_topup_requests
   WHERE id = p_request_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_TOPUP_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'WALLET_TOPUP_NOT_PENDING' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.wallet_topup_requests
     SET status = 'cancelled', decided_by = p_user_id, decided_at = now()
   WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_adjust(
  p_workspace_id uuid,
  p_currency     text,
  p_amount_minor bigint,
  p_admin_id     uuid,
  p_note         text
)
RETURNS bigint
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_note IS NULL OR length(btrim(p_note)) = 0 THEN
    RAISE EXCEPTION 'WALLET_NOTE_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'WALLET_CURRENCY_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN public.wallet_post(p_workspace_id, p_currency, p_amount_minor, 'adjustment',
                            NULL, NULL, p_admin_id, btrim(p_note));
END;
$$;

-- Pay a plan from the wallet: debit, file the upgrade request as paid by
-- 'wallet', and activate it through approve_subscription_upgrade — ONE
-- transaction. The backend computes the price (plan-pricing.ts).
CREATE OR REPLACE FUNCTION public.wallet_pay_subscription_upgrade(
  p_workspace_id    uuid,
  p_user_id         uuid,
  p_current_plan    text,
  p_plan            text,
  p_interval        text,
  p_amount_minor    bigint,
  p_plan_currency   text,
  p_wallet_currency text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wallet   public.wallets%ROWTYPE;
  v_req      public.subscription_upgrade_requests%ROWTYPE;
  v_sub      uuid;
  v_balance  bigint;
  v_active   boolean;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    -- Not priced by the product (enterprise): the wallet cannot pay it.
    RAISE EXCEPTION 'WALLET_PLAN_NOT_PRICED' USING ERRCODE = 'P0001';
  END IF;
  IF p_wallet_currency IS DISTINCT FROM p_plan_currency THEN
    RAISE EXCEPTION 'WALLET_CURRENCY_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  -- The lock that serialises two purchases for one business.
  SELECT * INTO v_wallet FROM public.wallets
   WHERE workspace_id = p_workspace_id AND currency = p_wallet_currency
   FOR UPDATE;
  IF NOT FOUND OR v_wallet.balance_minor < p_amount_minor THEN
    RAISE EXCEPTION 'WALLET_INSUFFICIENT_FUNDS' USING ERRCODE = 'P0001';
  END IF;

  -- Replay of the same request (lost response): answer with the first.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT r.* INTO v_req FROM public.subscription_upgrade_requests r
      JOIN public.wallet_transactions t ON t.reference_id = r.id AND t.kind = 'subscription_payment'
     WHERE r.workspace_id = p_workspace_id AND r.payment_method = 'wallet'
       AND r.payment_reference = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('request_id', v_req.id, 'subscription_id', NULL,
                                'balance_after', v_wallet.balance_minor, 'replayed', true);
    END IF;
  END IF;

  -- ⚠️ Paying the SAME plan while it is active would restart its period from
  -- now (approve_subscription_upgrade does not extend) and silently waste the
  -- time already paid for. Refused; it is also what makes a second concurrent
  -- purchase fail once the first has committed.
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
     WHERE s.workspace_id = p_workspace_id AND s.plan = p_plan
       AND s.status = 'active' AND s.period_end > now()
  ) INTO v_active;
  IF v_active THEN
    RAISE EXCEPTION 'SUBSCRIPTION_ALREADY_ACTIVE' USING ERRCODE = 'P0001';
  END IF;

  -- Raises UPGRADE_REQUEST_PENDING when a manual request is already waiting.
  v_req := public.create_subscription_upgrade_request(
    p_workspace_id, p_user_id, p_current_plan, p_plan, p_interval,
    p_amount_minor, p_plan_currency, 'wallet', p_idempotency_key, NULL);

  v_balance := public.wallet_post(p_workspace_id, p_wallet_currency, -p_amount_minor,
                                  'subscription_payment', 'subscription_upgrade_request',
                                  v_req.id, p_user_id, NULL);

  v_sub := public.approve_subscription_upgrade(v_req.id, p_user_id, p_amount_minor, 'paid from the wallet');

  RETURN jsonb_build_object('request_id', v_req.id, 'subscription_id', v_sub,
                            'balance_after', v_balance, 'replayed', false);
END;
$$;

-- ─── 7. Row security: members read their own business's wallet ─────────────
ALTER TABLE wallet_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_topup_requests ENABLE ROW LEVEL SECURITY;

-- auth_workspace_ids() lives in `private` on a database that ran
-- linter-2026-09-14, in `public` before it (BUG-065). Each branch is written
-- out; PL/pgSQL resolves only the one that runs.
DO $$
BEGIN
  DROP POLICY IF EXISTS wallets_workspace_read ON wallets;
  DROP POLICY IF EXISTS wallet_transactions_workspace_read ON wallet_transactions;
  DROP POLICY IF EXISTS wallet_topup_requests_workspace_read ON wallet_topup_requests;

  IF to_regprocedure('private.auth_workspace_ids()') IS NOT NULL THEN
    CREATE POLICY wallets_workspace_read ON wallets FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT private.auth_workspace_ids()));
    CREATE POLICY wallet_transactions_workspace_read ON wallet_transactions FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT private.auth_workspace_ids()));
    CREATE POLICY wallet_topup_requests_workspace_read ON wallet_topup_requests FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT private.auth_workspace_ids()));
  ELSIF to_regprocedure('public.auth_workspace_ids()') IS NOT NULL THEN
    CREATE POLICY wallets_workspace_read ON wallets FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT public.auth_workspace_ids()));
    CREATE POLICY wallet_transactions_workspace_read ON wallet_transactions FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT public.auth_workspace_ids()));
    CREATE POLICY wallet_topup_requests_workspace_read ON wallet_topup_requests FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT public.auth_workspace_ids()));
  ELSE
    RAISE NOTICE 'wallet: auth_workspace_ids() not found — RLS on with no read policy (clients read nothing; the backend is unaffected).';
  END IF;
END
$$;
-- wallet_payment_methods: no client policy — served by the backend only.

-- ─── 8. Grants ─────────────────────────────────────────────────────────────
-- Written out one by one (not a loop): rpc-not-callable-by-clients.test.ts
-- reads every REVOKE of a function the backend calls. The backend's role
-- (service_role) is the only caller; wallet_post is internal but the calling
-- functions run as that role, so it needs the grant too.
REVOKE ALL ON FUNCTION public.wallet_post(uuid, text, bigint, text, text, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wallet_post(uuid, text, bigint, text, text, uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_post(uuid, text, bigint, text, text, uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.create_wallet_topup_request(uuid, uuid, uuid, bigint, text, text, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_wallet_topup_request(uuid, uuid, uuid, bigint, text, text, date, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_wallet_topup_request(uuid, uuid, uuid, bigint, text, text, date, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.approve_wallet_topup(uuid, uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_wallet_topup(uuid, uuid, bigint, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_wallet_topup(uuid, uuid, bigint, text) TO service_role;
REVOKE ALL ON FUNCTION public.reject_wallet_topup(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_wallet_topup(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_wallet_topup(uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.cancel_wallet_topup(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_wallet_topup(uuid, uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_wallet_topup(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.wallet_adjust(uuid, text, bigint, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wallet_adjust(uuid, text, bigint, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_adjust(uuid, text, bigint, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.wallet_pay_subscription_upgrade(uuid, uuid, text, text, text, bigint, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wallet_pay_subscription_upgrade(uuid, uuid, text, text, text, bigint, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_pay_subscription_upgrade(uuid, uuid, text, text, text, bigint, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.wallet_balance_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wallet_balance_guard() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_ledger_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wallet_ledger_append_only() FROM anon, authenticated;

-- ─── 9. Receipts bucket (private) ──────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('wallet-receipts', 'wallet-receipts', false, 5242880,
            ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    ON CONFLICT (id) DO UPDATE
      SET public = false,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
