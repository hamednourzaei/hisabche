-- ==============================================================================
-- docs/admin-payment-gateways-01-migration.sql
--
-- V63 · P-1 — the platforms the OWNER receives money through.
--
-- WHY NOT customer-payment-gateway-01
--   That migration is the CUSTOMER's gateway: a workspace's own webhook and its
--   events (`payment_gateway_events`, tenanted by workspace_id). This one is the
--   platform's: which provider the product charges subscriptions with, in which
--   mode, and whether it is on. Mixing them would put platform credentials in a
--   table that every workspace can select from.
--
-- WHAT
--   1. public.platform_payment_gateways — one row per provider + environment.
--   2. A CHECK that `public_config` cannot carry a secret: only names of
--      secrets are stored (in `secret_names`), the values live in Vault.
--
-- ⚠️ NO CREDENTIAL COLUMN EXISTS ON PURPOSE. A gateway row is metadata; the
-- keys are read from `platform_secrets` (Vault) by the adapter at charge time.
--
-- SAFETY
--   - additive, idempotent;
--   - LIVE is never enabled by this file: rows are seeded DISABLED;
--   - RLS + REVOKE: born locked, `service_role` only.
--
-- POST-MIGRATION VERIFICATION: docs/VERIFY-admin-payment-gateways-01.sql
--   Post-migration verification query generated — PENDING HUMAN CONFIRMATION
--
-- ROLLBACK
--   DROP TABLE IF EXISTS public.platform_payment_gateways;
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_payment_gateways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL CHECK (provider IN ('STRIPE', 'PAYPAL', 'LOCAL')),
    environment TEXT NOT NULL CHECK (environment IN ('TEST', 'LIVE')),
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    display_name TEXT NOT NULL DEFAULT '',
    -- Public, non-secret configuration: merchant id, publishable key, currency
    -- list. The CHECK below refuses anything that looks like a secret so a
    -- helpful admin cannot paste one into a field the console renders.
    public_config JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (
        jsonb_typeof(public_config) = 'object'
        AND NOT (public_config ?| ARRAY[
            'secret', 'secret_key', 'api_key', 'apikey', 'password',
            'webhook_secret', 'client_secret', 'private_key', 'token'
        ])
    ),
    -- The NAMES of the Vault entries this adapter needs. Not values.
    secret_names TEXT[] NOT NULL DEFAULT '{}',
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, environment)
);

CREATE INDEX IF NOT EXISTS idx_platform_payment_gateways_provider
    ON public.platform_payment_gateways(provider, environment);

ALTER TABLE public.platform_payment_gateways ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON public.platform_payment_gateways FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON public.platform_payment_gateways FROM authenticated;
    END IF;

    REVOKE ALL ON public.platform_payment_gateways FROM PUBLIC;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT ALL ON public.platform_payment_gateways TO service_role;
    END IF;
END $$;

-- Seed every provider in both modes, DISABLED. `ON CONFLICT DO NOTHING` means
-- re-running never re-disables a gateway the owner turned on.
INSERT INTO public.platform_payment_gateways
    (provider, environment, is_enabled, display_name, secret_names)
VALUES
    ('STRIPE', 'TEST', false, 'Stripe (test)', ARRAY['stripe.secret_key', 'stripe.webhook_secret']),
    ('STRIPE', 'LIVE', false, 'Stripe', ARRAY['stripe.secret_key', 'stripe.webhook_secret']),
    ('PAYPAL', 'TEST', false, 'PayPal (sandbox)', ARRAY['paypal.client_id', 'paypal.client_secret', 'paypal.webhook_id']),
    ('PAYPAL', 'LIVE', false, 'PayPal', ARRAY['paypal.client_id', 'paypal.client_secret', 'paypal.webhook_id']),
    -- The local Afghan provider is not named yet (owner decision). The row
    -- exists so the console can say «not configured» instead of hiding it.
    ('LOCAL', 'LIVE', false, 'Local provider (not configured)', ARRAY[]::TEXT[])
ON CONFLICT (provider, environment) DO NOTHING;
