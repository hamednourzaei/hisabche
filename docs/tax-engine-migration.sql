-- ============================================================================
-- docs/tax-engine-migration.sql
--
-- A real tax engine, replacing the single flat `tax_rate` column on invoices.
--
-- WHAT THE FLAT COLUMN COULD NOT EXPRESS
--   * two components on one document (VAT plus a municipal charge)
--   * a different rate for one item than for the rest of the invoice
--   * a tax-inclusive retail price, which is how prices are quoted here
--   * withholding, which is deducted from the payment rather than added
--   * zero-rated vs exempt — both charge nothing and report differently
--   * what rate applied to an invoice written before the rate changed
--
-- MONEY IS STORED IN MINOR UNITS.
-- Every amount below is an integer number of pul (afghani ×100). A 15% rate on
-- 33.33 is 4.9995, and whether that becomes 5.00 or 4.99 decides whether a
-- hundred-line invoice foots. Integers make that a decision instead of an
-- accident.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. Settings ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tax_settings (
  workspace_id       uuid PRIMARY KEY,
  -- Bumped on EVERY configuration change. A document's snapshot records the
  -- version it was written under, which is the entire mechanism by which an
  -- offline device can later discover its figures are stale. Forgetting to
  -- bump it makes every drift check pass and the feature silently useless.
  config_version     integer NOT NULL DEFAULT 1,
  -- 'per_line'     the summed lines are the truth; each line foots alone
  -- 'per_document' the document figure is the truth; the residual is assigned
  rounding_policy    text NOT NULL DEFAULT 'per_line',
  prices_include_tax boolean NOT NULL DEFAULT false,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid,
  CONSTRAINT tax_settings_policy_check
    CHECK (rounding_policy IN ('per_line', 'per_document'))
);

-- ─── 2. Components ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tax_components (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL,
  -- A translation KEY, never a rendered sentence: the label appears on an
  -- invoice a customer reads in their own language.
  label_key         text NOT NULL,
  computation       text NOT NULL DEFAULT 'percent',
  -- 'standard' | 'zero_rated' | 'exempt' | 'not_applicable'
  -- The last three all charge nothing and all report differently. Collapsing
  -- them into a 0% rate makes the return wrong while the invoice looks right.
  treatment         text NOT NULL DEFAULT 'standard',
  rate              numeric(9, 4) NOT NULL DEFAULT 0,
  -- The stated price already contains this tax, so it is EXTRACTED rather than
  -- added:  included = gross × rate / (100 + rate).
  included_in_price boolean NOT NULL DEFAULT false,
  -- Tax on tax, naming the components it compounds over. Explicit rather than
  -- inferred from row order, because "the next one compounds" is a rule
  -- somebody has to be able to read.
  compounds_on      jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Deducted from the PAYMENT rather than added to the bill. The supplier is
  -- owed the gross; the buyer remits this part directly.
  is_withholding    boolean NOT NULL DEFAULT false,
  account_id        uuid,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_components_computation_check
    CHECK (computation IN ('percent', 'fixed_per_unit', 'fixed_per_line')),
  CONSTRAINT tax_components_treatment_check
    CHECK (treatment IN ('standard', 'zero_rated', 'exempt', 'not_applicable')),
  CONSTRAINT tax_components_rate_check CHECK (rate >= 0),
  -- Withholding is taken out of the payment; it cannot also be baked into the
  -- price, because the two say opposite things about the same money.
  CONSTRAINT tax_components_withholding_check
    CHECK (NOT (is_withholding AND included_in_price))
);

CREATE INDEX IF NOT EXISTS tax_components_workspace_idx
  ON tax_components (workspace_id) WHERE is_active = true;

-- ─── 3. Rules ───────────────────────────────────────────────────────────────
-- Which components apply, and to what. Resolution is most-specific-first:
-- product + party category, product, category + party category, category,
-- party category, default.

CREATE TABLE IF NOT EXISTS tax_rules (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL,
  component_ids      jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_id         uuid,
  category_id        uuid,
  -- The customer or supplier classification — a fiscal position, in effect.
  party_tax_category text,
  -- Validity is checked against the DOCUMENT's date, not today's: a backdated
  -- invoice is taxed at the rate of its own day.
  valid_from         date,
  valid_to           date,
  priority           integer NOT NULL DEFAULT 100,
  deleted_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tax_rules_lookup_idx
  ON tax_rules (workspace_id, product_id, category_id, party_tax_category)
  WHERE deleted_at IS NULL;

-- ─── 4. What each document actually charged ─────────────────────────────────
-- One row per component per document. This is what a return is filed from, and
-- it is written ONCE when the document is issued — never recomputed on read.

CREATE TABLE IF NOT EXISTS invoice_tax_lines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  invoice_id   uuid NOT NULL,
  component_id uuid,
  label_key    text NOT NULL,
  treatment    text NOT NULL,
  rate         numeric(9, 4) NOT NULL,
  base_minor   bigint NOT NULL,
  amount_minor bigint NOT NULL,
  -- Output tax (sales) and input tax (purchases) net off on a return and must
  -- never be summed together.
  direction    text NOT NULL,
  entry_date   date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_tax_lines_direction_check CHECK (direction IN ('sale', 'purchase'))
);

CREATE UNIQUE INDEX IF NOT EXISTS invoice_tax_lines_key
  ON invoice_tax_lines (workspace_id, invoice_id, component_id, rate);

CREATE INDEX IF NOT EXISTS invoice_tax_lines_return_idx
  ON invoice_tax_lines (workspace_id, entry_date);

-- ─── 5. The frozen snapshot ─────────────────────────────────────────────────
-- Everything the computation needed, copied onto the document.
--
-- A shopkeeper writes an invoice offline at 09:00; the rate changes at 11:00;
-- the phone syncs at 14:00. Re-resolving at sync would make the invoice in the
-- customer's hand disagree with the books. Trusting the device would let a
-- phone that never saw the change set the rate for everyone. So the document
-- keeps what it was written with, and the DIFFERENCE becomes something a
-- person is shown.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_snapshot jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_config_version integer;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS net_minor bigint;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_minor bigint;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS withholding_minor bigint;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_minor bigint;
-- Reported even when zero, so its absence is a fact rather than an omission.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rounding_residual_minor bigint DEFAULT 0;

-- ─── 6. Row level security ──────────────────────────────────────────────────

ALTER TABLE tax_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_components    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_tax_lines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'tax_settings', 'tax_components', 'tax_rules', 'invoice_tax_lines'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', v_table || '_workspace_members', v_table);
    EXECUTE format($p$
      CREATE POLICY %I ON %I
        FOR ALL TO authenticated
        USING (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        ))
        WITH CHECK (workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid() AND has_access = true AND suspended_at IS NULL
        ))
    $p$, v_table || '_workspace_members', v_table);
  END LOOP;
END $$;

COMMIT;
