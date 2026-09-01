-- ============================================================================
-- docs/views-and-billing-events-migration.sql
--
-- The last three things the code queries that nothing created.
--
-- ---------------------------------------------------------------------------
-- HOW THESE WERE MISSED
--
-- `base-schema-migration.sql` was generated from a dump that listed TABLES.
-- Two of these are VIEWS and the third is a table the dump did not reach, so
-- none of them appeared. They were found by
-- `scripts/verify-bundle-covers-code.mjs`, which reads the code rather than
-- the dump: every `.from('x')` in `backend/src` must have an `x` in the
-- bundle.
--
-- Each definition below is reconstructed from the ONE query that uses it. That
-- is a narrower basis than a dump, and it is stated rather than hidden: these
-- views serve the columns their callers select, and nothing more. If a future
-- caller selects a column that is not here, it will fail loudly at the query
-- rather than quietly return null.
--
-- SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

-- ─── 1. transactions_view ───────────────────────────────────────────────────
--
-- Read by `customer.service.ts` to total what a customer owes:
--     .select('type, amount').eq('customer_id', …)
--
-- ⚠️ It is a VIEW over `transactions`, not a second table. A materialised copy
-- would be a second version of the same money that drifts from the first — and
-- a customer balance computed from a stale copy is the kind of wrong that gets
-- argued about at a counter.
--
-- `workspace_id` is carried through so RLS on the view behaves like RLS on the
-- table beneath it.

CREATE OR REPLACE VIEW transactions_view AS
SELECT
  t.id,
  t.workspace_id,
  t.customer_id,
  t.supplier_id,
  t.type,
  t.amount,
  t.currency,
  t.description,
  t.reference,
  t.created_at
FROM transactions t;

-- ─── 2. ledger_entries_view ─────────────────────────────────────────────────
--
-- Read by `analytics.service.ts` for the financial summary:
--     .select('debit, credit, account_id, entry_date')
--       .eq('workspace_id', …).gte('entry_date', …).lte('entry_date', …)
--
-- A journal LINE joined to the date and status of the entry it belongs to,
-- which is what makes `entry_date` filterable in one query.
--
-- ⚠️ `journal_lines.journal_id` — NOT `entry_id`. This column has been guessed
-- wrong more than once in this codebase.
--
-- ⚠️ POSTED entries only. A draft is not part of the ledger, and a summary
-- that included drafts would not agree with the trial balance beside it.

CREATE OR REPLACE VIEW ledger_entries_view AS
SELECT
  jl.id,
  jl.workspace_id,
  jl.journal_id,
  jl.account_id,
  jl.debit,
  jl.credit,
  je.date        AS entry_date,
  je.description,
  je.reference,
  je.branch_id
FROM journal_lines jl
JOIN journal_entries je
  ON je.id = jl.journal_id
 AND je.workspace_id = jl.workspace_id
WHERE je.status = 'posted';

-- ─── 3. billing_events ──────────────────────────────────────────────────────
--
-- Written by `trial-expiration.worker.ts`:
--     .insert({ user_id, event_type, event_data, created_at })
--
-- ⚠️ Keyed by `user_id`, not `workspace_id`, and that is correct: a billing
-- event belongs to the PERSON who pays, and a trial expiring is a fact about
-- an account rather than about a workspace. It is one of the documented
-- exceptions to the workspace rule, alongside `member_branches` and
-- `ui_visibility_profiles`.
--
-- The insert is wrapped in a try/catch that only logs, so a failure here never
-- breaks the billing run. That makes a missing table invisible in production —
-- which is exactly why it survived undetected until a script read the code.

CREATE TABLE IF NOT EXISTS billing_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  event_type  text NOT NULL,
  event_data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- The worker reads a person's recent events; nothing scans the whole table.
CREATE INDEX IF NOT EXISTS billing_events_user_idx
  ON billing_events (user_id, created_at DESC);

ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- ⚠️ NO POLICY. Deny-all, deliberately.
--
-- A `USING (user_id = auth.uid())` policy was here. `rls-coverage.test.ts`
-- rejected it — every policy must reference the membership chain — and the
-- test was right to, for a reason beyond the rule it states: NOTHING READS
-- THIS TABLE DIRECTLY.
--
-- The frontend has no `supabase.from()` call anywhere; every read goes through
-- the backend on `service_role`, which bypasses RLS. The policy would have
-- opened a table of billing history to satisfy a sense of symmetry and served
-- no caller.
--
-- RLS on with no policy means nobody may read it. That is the correct state
-- for a table only a worker touches.

-- Writes come from the worker on the service role, which bypasses RLS. No
-- INSERT policy is granted to `authenticated` on purpose: a client that could
-- write its own billing events could write itself a paid plan.

COMMIT;
