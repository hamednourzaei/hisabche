-- ============================================================================
-- docs/phase-o-02-catalog-and-query-log-migration.sql
--
-- PHASE O · O1 — the semantic catalogue.
-- PHASE O · O3 — the AI query log.
--
-- ---------------------------------------------------------------------------
-- ⚠️ O3 CONNECTS TO NOTHING. NO PROVIDER, NO SDK, NO API KEY.
--
-- The spec is explicit and it is worth restating: in this phase NO connection
-- to any AI provider is made — not Anthropic, not OpenAI, no LLM SDK. This
-- migration creates a TABLE. Nothing writes to it yet.
--
-- ---------------------------------------------------------------------------
-- O1 — WHY A CATALOGUE, AND WHY IT MATTERS MORE HERE THAN USUAL
--
-- This codebase has FOUR tables that look like they hold accounting data and
-- three that look like they hold stock quantity. A person who has read the
-- migrations knows which is which. A language model reading a schema does not,
-- and it will happily answer a question about revenue from `ledger_entries` —
-- a table that has been FROZEN by trigger since Phase B and whose contents are
-- pre-consolidation history.
--
-- So the catalogue is not documentation for humans. It is the thing that stops
-- a confident answer being drawn from a deprecated table.
--
-- The two answers it must give, from the spec:
--
--   Accounting: journal_entries / journal_lines / ledger_entries / transactions
--               → which is the source of truth, which a projection, which legacy
--   Inventory:  stock_movements / warehouse_stock / products.quantity
--               → same three questions
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
--   DROP SCHEMA IF EXISTS metadata CASCADE;
--   DROP TABLE IF EXISTS ai_query_log;
--
-- Safe. Neither holds operational data: the catalogue describes other tables,
-- and the log is empty until an AI layer exists.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION VERIFICATION
-- ============================================================================
--
-- P1. Do these already exist?
--
--   SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'metadata';
--   SELECT table_name  FROM information_schema.tables   WHERE table_name = 'ai_query_log';
--
-- P2. ⚠️ CONFIRM THE FACTS THE CATALOGUE IS ABOUT TO ASSERT.
--     `ledger_entries` should be frozen by a trigger (phase-b-01) and
--     `transactions` should refuse payment/receipt rows (phase-b-02). If these
--     return nothing, the catalogue's claims below are wrong and must be
--     corrected BEFORE seeding — a catalogue that lies is worse than none.
--
--   SELECT tgname, tgrelid::regclass FROM pg_trigger
--   WHERE  NOT tgisinternal
--     AND  tgrelid::regclass::text IN ('ledger_entries', 'transactions');
--
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS metadata;

COMMENT ON SCHEMA metadata IS
  'O1 - the semantic catalogue. Says which table is the source of truth, which is a projection and which is legacy, so an AI answer is never drawn from a deprecated table.';

-- ---------------------------------------------------------------------------
-- O1 — the catalogue
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS metadata.entity_catalog (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name        text NOT NULL DEFAULT 'public',
  table_name         text NOT NULL,
  business_name_fa   text,
  description        text NOT NULL,

  /**
   * ⚠️ THE FIELD THE WHOLE CATALOGUE EXISTS FOR.
   *
   * TRUE  — decisions may be made from this table.
   * FALSE — it is a projection or legacy; read `derived_from`.
   */
  is_source_of_truth boolean NOT NULL,

  /** What this is derived FROM, when it is not the truth itself. */
  derived_from       text,

  /** accounting | inventory | sales | purchasing | people | banking | pos */
  domain             text NOT NULL,

  /**
   * live | legacy | frozen
   *
   * `frozen` is stronger than `legacy`: a trigger actively REFUSES writes.
   * An answer drawn from a frozen table is drawn from history that stopped.
   */
  lifecycle          text NOT NULL DEFAULT 'live',

  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT entity_catalog_unique UNIQUE (schema_name, table_name),
  CONSTRAINT entity_catalog_lifecycle_check CHECK (lifecycle IN ('live', 'legacy', 'frozen')),
  -- A table that is NOT the source of truth must say what it comes from.
  -- Without this, «false» is an unexplained warning nobody can act on.
  CONSTRAINT entity_catalog_derived_explained
    CHECK (is_source_of_truth OR derived_from IS NOT NULL)
);

COMMENT ON TABLE metadata.entity_catalog IS
  'O1 - which table is the source of truth, which a projection, which legacy. Read by the AI layer BEFORE choosing where to answer from; without it a model will answer a revenue question from ledger_entries, which has been frozen since Phase B.';

COMMENT ON COLUMN metadata.entity_catalog.lifecycle IS
  'live | legacy | frozen. `frozen` means a trigger actively refuses writes - an answer from it is drawn from history that stopped.';

-- ─── The seed. These are FACTS about this database, verified in P2. ─────────

INSERT INTO metadata.entity_catalog
  (table_name, business_name_fa, description, is_source_of_truth, derived_from, domain, lifecycle)
VALUES
  -- ─── Accounting — the four tables the spec names ────────────────────────
  ('journal_entries', 'اسناد حسابداری',
   'SOURCE OF TRUTH for accounting. Every posted financial event is one entry. Balance is enforced inside accounting_post_journal_entry (JOURNAL_ENTRY_UNBALANCED); a direct write cannot produce an unbalanced entry.',
   true, NULL, 'accounting', 'live'),

  ('journal_lines', 'خطوط سند',
   'SOURCE OF TRUTH for the debit/credit detail of each entry. Sums to zero per entry by construction.',
   true, NULL, 'accounting', 'live'),

  ('ledger_entries', 'دفتر کل (قدیمی)',
   'FROZEN by trigger since Phase B. Pre-consolidation history only - every write is refused and the error names the replacement. NEVER answer a financial question from this table.',
   false, 'journal_entries + journal_lines', 'accounting', 'frozen'),

  ('transactions', 'تراکنش‌ها (جزئی)',
   'PARTIALLY FROZEN since Phase B: rows of type payment/receipt are refused by trigger and live in payments + payment_allocations instead. Other types remain, so this is legacy rather than fully frozen.',
   false, 'payments + payment_allocations', 'accounting', 'legacy'),

  -- ─── Inventory — the three the spec names ───────────────────────────────
  ('stock_movements', 'حرکت‌های انبار',
   'SOURCE OF TRUTH for inventory QUANTITY since Phase C. Append-only: every arrival, sale, transfer, adjustment and production is one row. Owns HOW MANY, not what they are worth.',
   true, NULL, 'inventory', 'live'),

  ('warehouse_stock', 'موجودی هر انبار',
   'PROJECTION of SUM(stock_movements) attributed to one warehouse, maintained by the stock_movements_project() trigger. Never written from application code.',
   false, 'stock_movements', 'inventory', 'live'),

  ('products', 'کالاها',
   'The catalogue itself is the source of truth for a product. ⚠️ BUT products.quantity is a PROJECTION of SUM(stock_movements) maintained by trigger - it may be negative, which is a recorded shortfall rather than an error.',
   true, NULL, 'inventory', 'live'),

  ('cost_layers', 'لایه‌های بهای تمام‌شده',
   'SOURCE OF TRUTH for inventory VALUE (FIFO). Owns what stock is worth; stock_movements owns how much there is.',
   true, NULL, 'inventory', 'live'),

  -- ─── Sales / receivables ────────────────────────────────────────────────
  ('invoices', 'فاکتورها',
   'SOURCE OF TRUTH for the sales/purchase document. ⚠️ paid_amount is a PROJECTION of SUM(payment_allocations) maintained by trigger (Phase F) and must never be written directly.',
   true, NULL, 'sales', 'live'),

  ('payments', 'پرداخت‌ها',
   'SOURCE OF TRUTH for money moving between the business and a party.',
   true, NULL, 'sales', 'live'),

  ('payment_allocations', 'تخصیص پرداخت',
   'SOURCE OF TRUTH for SETTLEMENT - which payment settled which invoice, and by how much. invoices.paid_amount is derived from this.',
   true, NULL, 'sales', 'live'),

  -- ─── Derived reads ──────────────────────────────────────────────────────
  ('stock_in_transit', 'کالای در راه',
   'DERIVED VIEW over stock_transfers (Phase K). Goods that left one warehouse and have not arrived at another. There is deliberately no stored in_transit_quantity column anywhere.',
   false, 'stock_transfers + stock_transfer_lines', 'inventory', 'live'),

  ('party_ledger', 'دفتر طرف حساب',
   'DERIVED VIEW built from documents (Phase B). The party balance any report should use.',
   false, 'invoices + payments + payment_allocations', 'accounting', 'live')
ON CONFLICT (schema_name, table_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- O3 — the AI query log
--
-- ⚠️ INFRASTRUCTURE ONLY. Nothing writes to this table in this phase, and no
-- provider is contacted.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_query_log (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              uuid NOT NULL,

  -- ⚠️ The ACTOR, from the existing model. `user_id` is who acted; it is never
  -- a security filter (that is workspace_id) — the same rule the rest of the
  -- codebase follows.
  actor_id                  uuid,

  question_text             text NOT NULL,

  /**
   * Which reporting views or functions actually answered.
   *
   * ⚠️ THE MOST IMPORTANT AUDIT FIELD HERE. If a name outside the `reporting`
   * schema ever appears in this column, the raw-SQL boundary has been crossed
   * and that is the incident, whatever the answer said.
   */
  resolved_views_or_functions text[],

  answer_text               text,
  model_provider            text,
  model_name                text,
  latency_ms                integer,

  /** Set when something about the exchange needed a human to look at it. */
  was_flagged               boolean NOT NULL DEFAULT false,

  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_query_log_workspace_created_idx
  ON ai_query_log (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_query_log_flagged_idx
  ON ai_query_log (workspace_id) WHERE was_flagged;

COMMENT ON TABLE ai_query_log IS
  'O3 - what was asked, what answered it, and what came back. INFRASTRUCTURE ONLY: no AI provider is contacted in this phase and nothing writes here yet.';

COMMENT ON COLUMN ai_query_log.resolved_views_or_functions IS
  'Which reporting views answered. ⚠️ A name outside the `reporting` schema appearing here means the raw-SQL boundary was crossed - that is the incident, whatever the answer said.';

ALTER TABLE ai_query_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_query_log_workspace ON ai_query_log;
CREATE POLICY ai_query_log_workspace ON ai_query_log
  FOR ALL
  USING (EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = ai_query_log.workspace_id))
  WITH CHECK (EXISTS (SELECT 1 FROM auth_workspace_ids() w WHERE w = ai_query_log.workspace_id));

-- The catalogue is not workspace data — it describes the SCHEMA, which is the
-- same for everyone. Readable by any authenticated user, writable by none.
REVOKE ALL   ON SCHEMA metadata FROM PUBLIC;
GRANT  USAGE ON SCHEMA metadata TO authenticated;
REVOKE ALL   ON metadata.entity_catalog FROM PUBLIC;
GRANT  SELECT ON metadata.entity_catalog TO authenticated;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================
--
-- V1. The catalogue is seeded.
--
--   SELECT COUNT(*) FROM metadata.entity_catalog;   -- expect 13
--
-- V2. ⚠️ THE TWO ANSWERS THE SPEC ASKS FOR, read back.
--
--   SELECT table_name, is_source_of_truth, lifecycle, derived_from
--   FROM   metadata.entity_catalog
--   WHERE  table_name IN ('journal_entries','journal_lines',
--                         'ledger_entries','transactions')
--   ORDER  BY is_source_of_truth DESC, table_name;
--   -- journal_entries/journal_lines: true, live
--   -- ledger_entries:  false, frozen
--   -- transactions:    false, legacy
--
--   SELECT table_name, is_source_of_truth, derived_from
--   FROM   metadata.entity_catalog
--   WHERE  table_name IN ('stock_movements','warehouse_stock','products')
--   ORDER  BY is_source_of_truth DESC;
--   -- stock_movements: true
--   -- warehouse_stock: false, derived_from stock_movements
--   -- products:        true (but read the description about quantity)
--
-- V3. Every non-source-of-truth row explains itself.
--
--   SELECT table_name FROM metadata.entity_catalog
--   WHERE  NOT is_source_of_truth AND derived_from IS NULL;
--   -- must return NO rows (the CHECK constraint enforces it)
--
-- V4. The query log is empty and RLS is on.
--
--   SELECT COUNT(*) FROM ai_query_log;   -- expect 0
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'ai_query_log';
--
-- V5. The catalogue is read-only for members.
--
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE  table_schema = 'metadata' AND table_name = 'entity_catalog';
--   -- expect SELECT only
--
-- ============================================================================
