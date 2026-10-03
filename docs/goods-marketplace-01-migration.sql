-- ============================================================================
-- docs/goods-marketplace-01-migration.sql                 (3 Oct 2026)
--
-- ⚠️ RUN AFTER docs/product-images-migration.sql (a listing shows its
--    product's images; the marketplace still works without them).
--
-- THE GOODS MARKETPLACE — INFRASTRUCTURE ONLY, OFF BY DEFAULT.
--
--   platform_settings      one row per platform-wide switch. This migration
--                          writes `goods_marketplace_enabled = false`. Only a
--                          platform admin turns it on. A MISSING row is read
--                          as false (G4: the default is explicit, twice).
--   seller_profiles        one per business (workspace): public slug, name,
--                          description, city/country, contact. `status` and
--                          `verified` are the PLATFORM's — a seller never
--                          writes them.
--   marketplace_listings   a product offered publicly: its own slug, title,
--                          description, and a price the SELLER states
--                          explicitly (price_minor + currency). Never derived
--                          from the product's prices — and buy_price / cost
--                          is not in this table at all.
--
-- WHAT IS PUBLIC: a listing is shown only when the switch is on AND the
-- seller is active AND the listing is active, not hidden, not suspended AND
-- its product is active. The backend applies that rule; nothing here is
-- readable by `anon`.
--
-- NOT IN THIS MIGRATION (designed in .claude/research/ecosystem-gap-analysis.md
-- §10): ordering and payment. There is no cart, no order, no money movement.
--
-- WHY NO FUNCTIONS: every write here is one row in one table (CLAUDE.md
-- rule 4 concerns multi-table writes). The one cross-table rule — a listing's
-- product belongs to the listing's business — is a trigger, so no path can
-- skip it.
--
-- SAFETY: additive, idempotent (IF NOT EXISTS, CREATE OR REPLACE, guarded DO).
-- No existing object is changed.
--
-- ROLLBACK
--   DROP TABLE IF EXISTS public.marketplace_listings;
--   DROP TABLE IF EXISTS public.seller_profiles;
--   DROP FUNCTION IF EXISTS public.marketplace_listing_guard();
--   DELETE FROM public.platform_settings WHERE key = 'goods_marketplace_enabled';
--   -- platform_settings itself may by then hold other switches: keep it.
--   The backend answers MARKET_NOT_CONFIGURED (503) while they are absent, and
--   the public pages 404.
-- ============================================================================

BEGIN;

-- ─── 1. Platform switches ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{2,62}$'),
  value      jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The default, stated: OFF. Re-running never turns a switch back off.
INSERT INTO public.platform_settings (key, value)
VALUES ('goods_marketplace_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─── 2. Sellers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seller_profiles (
  workspace_id     uuid PRIMARY KEY,
  slug             text NOT NULL UNIQUE
                     CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 60),
  name             text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  description      text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  city             text NOT NULL DEFAULT '' CHECK (length(city) <= 80),
  -- ISO 3166-1 alpha-2, or '' when the seller has not said.
  country          text NOT NULL DEFAULT '' CHECK (country ~ '^([A-Z]{2})?$'),
  contact          text NOT NULL DEFAULT '' CHECK (length(contact) <= 200),
  -- The platform's, never the seller's.
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  suspended_reason text,
  verified         boolean NOT NULL DEFAULT false,
  verified_at      timestamptz,
  verified_by      uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. Listings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.seller_profiles(workspace_id) ON DELETE CASCADE,
  product_id       uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  slug             text NOT NULL
                     CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 80),
  title            text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  description      text NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  -- The seller's stated price, in the currency's minor unit.
  price_minor      bigint NOT NULL CHECK (price_minor > 0),
  currency         text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  availability     text NOT NULL DEFAULT 'in_stock'
                     CHECK (availability IN ('in_stock', 'out_of_stock')),
  -- Shown only when the seller chooses to state it; NULL = not stated.
  quantity         integer CHECK (quantity IS NULL OR quantity >= 0),
  is_hidden        boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  -- The platform's: a suspended listing is not public whatever its status.
  suspended_at     timestamptz,
  suspended_reason text,
  seo_title        text NOT NULL DEFAULT '' CHECK (length(seo_title) <= 70),
  seo_description  text NOT NULL DEFAULT '' CHECK (length(seo_description) <= 160),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_listings_slug_key UNIQUE (workspace_id, slug),
  CONSTRAINT marketplace_listings_product_key UNIQUE (workspace_id, product_id)
);

CREATE INDEX IF NOT EXISTS marketplace_listings_public_idx
  ON public.marketplace_listings (updated_at DESC)
  WHERE status = 'active' AND NOT is_hidden AND suspended_at IS NULL;

-- ─── 4. A listing's product belongs to the listing's business ──────────────
CREATE OR REPLACE FUNCTION public.marketplace_listing_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM products p WHERE p.id = NEW.product_id AND p.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'MARKET_PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS marketplace_listings_guard ON public.marketplace_listings;
CREATE TRIGGER marketplace_listings_guard
  BEFORE INSERT OR UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_listing_guard();

-- ─── 5. Read access (RLS) ───────────────────────────────────────────────────
-- Members read their OWN business's profile and listings. The public reads
-- through the backend only. platform_settings: no client policy at all.
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS seller_profiles_workspace_read ON seller_profiles;
  DROP POLICY IF EXISTS marketplace_listings_workspace_read ON marketplace_listings;

  IF to_regprocedure('private.auth_workspace_ids()') IS NOT NULL THEN
    CREATE POLICY seller_profiles_workspace_read ON seller_profiles FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT private.auth_workspace_ids()));
    CREATE POLICY marketplace_listings_workspace_read ON marketplace_listings FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT private.auth_workspace_ids()));
  ELSIF to_regprocedure('public.auth_workspace_ids()') IS NOT NULL THEN
    CREATE POLICY seller_profiles_workspace_read ON seller_profiles FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT public.auth_workspace_ids()));
    CREATE POLICY marketplace_listings_workspace_read ON marketplace_listings FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT public.auth_workspace_ids()));
  ELSE
    RAISE NOTICE 'goods marketplace: auth_workspace_ids() not found — RLS on with no read policy (clients read nothing; the backend is unaffected).';
  END IF;
END
$$;

-- ─── 6. Grants ──────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.marketplace_listing_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marketplace_listing_guard() FROM anon, authenticated;

REVOKE ALL ON public.platform_settings FROM anon, authenticated;
REVOKE ALL ON public.seller_profiles FROM anon;
REVOKE ALL ON public.marketplace_listings FROM anon;
GRANT SELECT ON public.seller_profiles, public.marketplace_listings TO authenticated;
GRANT ALL ON public.platform_settings, public.seller_profiles, public.marketplace_listings TO service_role;

COMMIT;
