-- ============================================
-- docs/wave1-loyalty-credit-migration.sql
--
-- G01 (Gift Cards), G02 (Store Credit) & G65 (Loyalty Points)
-- Additive, idempotent, workspace-isolated tables with least-privilege RLS.
-- Never run DDL against live Supabase from an agent; a human runs this.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code text NOT NULL,
  currency text NOT NULL,
  initial_balance_minor bigint NOT NULL CHECK (initial_balance_minor > 0),
  balance_minor bigint NOT NULL CHECK (balance_minor >= 0),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, code)
);

CREATE TABLE IF NOT EXISTS public.gift_card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gift_card_id uuid NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('issue', 'redeem', 'adjust')),
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  invoice_id uuid,
  idempotency_key text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.store_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  currency text NOT NULL,
  amount_minor bigint NOT NULL,
  source_invoice_id uuid,
  reason text NOT NULL,
  idempotency_key text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.loyalty_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('earn', 'redeem', 'adjust')),
  points_delta integer NOT NULL CHECK (points_delta <> 0),
  invoice_id uuid,
  reason text NOT NULL,
  idempotency_key text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, idempotency_key)
);

REVOKE ALL ON TABLE public.gift_cards FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.gift_card_transactions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.store_credit_ledger FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.loyalty_points_ledger FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.gift_cards TO service_role;
GRANT SELECT, INSERT ON TABLE public.gift_card_transactions TO service_role;
GRANT SELECT, INSERT ON TABLE public.store_credit_ledger TO service_role;
GRANT SELECT, INSERT ON TABLE public.loyalty_points_ledger TO service_role;

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gift_cards_workspace_isolation ON public.gift_cards;
CREATE POLICY gift_cards_workspace_isolation ON public.gift_cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = gift_cards.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.has_access = true
        AND wm.suspended_at IS NULL
    )
  );

DROP POLICY IF EXISTS gift_card_tx_workspace_isolation ON public.gift_card_transactions;
CREATE POLICY gift_card_tx_workspace_isolation ON public.gift_card_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = gift_card_transactions.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.has_access = true
        AND wm.suspended_at IS NULL
    )
  );

DROP POLICY IF EXISTS store_credit_workspace_isolation ON public.store_credit_ledger;
CREATE POLICY store_credit_workspace_isolation ON public.store_credit_ledger
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = store_credit_ledger.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.has_access = true
        AND wm.suspended_at IS NULL
    )
  );

DROP POLICY IF EXISTS loyalty_points_workspace_isolation ON public.loyalty_points_ledger;
CREATE POLICY loyalty_points_workspace_isolation ON public.loyalty_points_ledger
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = loyalty_points_ledger.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.has_access = true
        AND wm.suspended_at IS NULL
    )
  );

COMMIT;

-- Rollback:
-- DROP TABLE IF EXISTS public.loyalty_points_ledger;
-- DROP TABLE IF EXISTS public.store_credit_ledger;
-- DROP TABLE IF EXISTS public.gift_card_transactions;
-- DROP TABLE IF EXISTS public.gift_cards;
