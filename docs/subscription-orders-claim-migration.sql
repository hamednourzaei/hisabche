-- ============================================================================
-- docs/subscription-orders-claim-migration.sql
--
-- V54.0 PHASE 5.1 — SUBSCRIPTION TO WORKSPACE CANONICAL PROVISIONING
--
-- ⚠️ PENDING HUMAN CONFIRMATION.
-- This migration is additive and idempotent. It creates the infrastructure for:
--   1. subscription_orders: Tracks commercial intent to purchase a subscription plan.
--   2. Claim Token Hashes: Secure single-use cryptographic tokens for "Buy First" onboarding.
--   3. canonical_provision_workspace(): Idempotent transactional engine that binds
--      an order, provisions a workspace, creates owner membership, activates subscription,
--      and initializes the onboarding state without partial failure.
-- ============================================================================

-- 1. Subscription Orders Table
CREATE TABLE IF NOT EXISTS public.subscription_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plan text NOT NULL CHECK (plan IN ('starter', 'pro', 'enterprise', 'offline')),
  billing_interval text NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL DEFAULT 'AFN',
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'payment_failed', 'claimed', 'expired', 'cancelled')),
  payment_method text CHECK (payment_method IN ('card_to_card', 'gateway', 'manual', 'cash')),
  payment_reference text,
  payment_verified_at timestamptz,
  -- Security: Store SHA-256 hash of claim token, never plaintext raw token
  claim_token_hash text UNIQUE,
  claim_token_expires_at timestamptz,
  claimed_by_user_id uuid REFERENCES auth.users(id),
  claimed_at timestamptz,
  -- Bound entities once provisioned
  provisioned_workspace_id uuid REFERENCES public.workspaces(id),
  created_by_user_id uuid REFERENCES auth.users(id), -- Nullable for Path A (Buy First before register)
  idempotency_key text UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for lookup and concurrency protection
CREATE INDEX IF NOT EXISTS idx_subscription_orders_claim_hash ON public.subscription_orders(claim_token_hash) WHERE claim_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscription_orders_status ON public.subscription_orders(status);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_user ON public.subscription_orders(created_by_user_id) WHERE created_by_user_id IS NOT NULL;

-- 2. Audit Event Log for Subscription Lifecycle
CREATE TABLE IF NOT EXISTS public.subscription_order_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.subscription_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id),
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sub_order_events_order ON public.subscription_order_events(order_id);

-- 3. Row Level Security Policies
ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_order_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.subscription_orders FROM PUBLIC, anon;
REVOKE ALL ON public.subscription_order_events FROM PUBLIC, anon;

GRANT SELECT ON public.subscription_orders TO authenticated;
-- Modifications are strictly restricted to service_role or vetted RPCs

-- 4. Canonical Idempotent Provisioning Engine (PostgreSQL Transactional RPC)
CREATE OR REPLACE FUNCTION public.canonical_provision_workspace(
  p_order_id uuid,
  p_user_id uuid,
  p_workspace_name text,
  p_base_currency text DEFAULT 'AFN',
  p_time_zone text DEFAULT 'Asia/Kabul'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.subscription_orders%ROWTYPE;
  v_workspace public.workspaces%ROWTYPE;
  v_subscription_id uuid;
  v_period_end timestamptz;
  v_slug text;
BEGIN
  -- 1. Lock and validate order atomically
  SELECT * INTO v_order
  FROM public.subscription_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotency check: if already claimed and provisioned for this user, return existing workspace
  IF v_order.status = 'claimed' AND v_order.provisioned_workspace_id IS NOT NULL THEN
    IF v_order.claimed_by_user_id = p_user_id THEN
      RETURN jsonb_build_object(
        'success', true,
        'workspace_id', v_order.provisioned_workspace_id,
        'already_provisioned', true
      );
    ELSE
      RAISE EXCEPTION 'ORDER_ALREADY_CLAIMED_BY_ANOTHER_USER' USING ERRCODE = '23505';
    END IF;
  END IF;

  IF v_order.status != 'paid' THEN
    RAISE EXCEPTION 'ORDER_NOT_PAID' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Generate slug and create workspace
  v_slug := lower(regexp_replace(p_workspace_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8);

  INSERT INTO public.workspaces (
    name,
    slug,
    owner_id,
    base_currency,
    time_zone,
    created_at,
    updated_at
  ) VALUES (
    p_workspace_name,
    v_slug,
    p_user_id,
    COALESCE(p_base_currency, 'AFN'),
    COALESCE(p_time_zone, 'Asia/Kabul'),
    now(),
    now()
  )
  RETURNING * INTO v_workspace;

  -- 3. Create Owner Membership atomically
  INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    has_access,
    created_at,
    updated_at
  ) VALUES (
    v_workspace.id,
    p_user_id,
    'owner',
    true,
    now(),
    now()
  );

  -- 4. Calculate subscription period
  IF v_order.billing_interval = 'year' THEN
    v_period_end := now() + interval '1 year';
  ELSE
    v_period_end := now() + interval '1 month';
  END IF;

  -- 5. Create or Bind Subscription to Workspace
  INSERT INTO public.subscriptions (
    workspace_id,
    user_id,
    plan,
    status,
    period_start,
    period_end,
    is_trial,
    trial_used,
    cancel_at_period_end,
    created_at,
    updated_at
  ) VALUES (
    v_workspace.id,
    p_user_id,
    v_order.plan,
    'active',
    now(),
    v_period_end,
    false,
    true,
    false,
    now(),
    now()
  )
  RETURNING id INTO v_subscription_id;

  -- 6. Mark order as claimed and bound
  UPDATE public.subscription_orders
  SET status = 'claimed',
      claimed_by_user_id = p_user_id,
      claimed_at = now(),
      provisioned_workspace_id = v_workspace.id,
      updated_at = now()
  WHERE id = p_order_id;

  -- 7. Record Audit Event
  INSERT INTO public.subscription_order_events (
    order_id,
    event_type,
    actor_user_id,
    details
  ) VALUES (
    p_order_id,
    'order_claimed_and_provisioned',
    p_user_id,
    jsonb_build_object(
      'workspace_id', v_workspace.id,
      'subscription_id', v_subscription_id,
      'plan', v_order.plan,
      'interval', v_order.billing_interval
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'workspace_id', v_workspace.id,
    'subscription_id', v_subscription_id,
    'already_provisioned', false
  );
END;
$$;

-- Grant execution to authenticated users & service role
REVOKE EXECUTE ON FUNCTION public.canonical_provision_workspace FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canonical_provision_workspace TO authenticated, service_role;

-- 5. Verification Query (Run to verify installation)
-- SELECT id, plan, status FROM public.subscription_orders LIMIT 1;
