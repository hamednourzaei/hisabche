-- ═══════════════════════════════════════════════════════════════════════════
-- DB INTEGRITY 01 — the ledger, the cost chain and the references the
--                   database did not check (12 Oct 2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Run by a person, in the Supabase SQL Editor, as one script. Additive and
-- idempotent: running it twice changes nothing the second time.
--
-- WHAT IT IS BASED ON
--
-- docs/FINDING-db-integrity.sql was run on the live database on 11–12 Oct 2026.
-- Every rule below is one that NO existing row breaks, with two exceptions that
-- are handled on purpose:
--
--   C1  posted entries that do not balance ................ 0   → enforced
--   C2  negative / two-sided lines ........................ 0   → enforced
--   B2  lines with no entry or no account ................. 0   → NOT NULL
--   E3  layers over-drawn or negative ..................... 0   → enforced
--   D1  payments settling an invoice of another currency .. 0   → enforced
--   B1  rows pointing across workspaces ................... 0   (nothing to fix)
--   B2  payment_allocations pointing at a missing invoice . 15  → see §5
--   A1  invoice_items with no workspace ................... 15  → see §6
--
-- WHAT IT DOES NOT DO
--
--   * No row is deleted. The 15 orphan allocations stay exactly as they are;
--     the foreign key is added NOT VALID, so it refuses NEW orphans and leaves
--     the old ones to be looked at by a person.
--   * No currency default is dropped and no workspace_id is made NOT NULL
--     outside the ledger. Those need the application to send the value on every
--     path first (db-integrity-02).
--   * Nothing is renamed, retyped or dropped.
--
-- ROLLBACK / MITIGATION is at the bottom of the file.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. A journal line has a shape ──────────────────────────────────────────
-- Amounts are never negative, and a line is on one side only. Added NOT VALID
-- and validated in a second step, so the table is not locked while it is
-- scanned.

DO $shape$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'journal_lines_amounts_not_negative'
       AND conrelid = 'public.journal_lines'::regclass
  ) THEN
    ALTER TABLE public.journal_lines
      ADD CONSTRAINT journal_lines_amounts_not_negative
      CHECK (debit >= 0 AND credit >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'journal_lines_one_side'
       AND conrelid = 'public.journal_lines'::regclass
  ) THEN
    ALTER TABLE public.journal_lines
      ADD CONSTRAINT journal_lines_one_side
      CHECK (NOT (debit <> 0 AND credit <> 0)) NOT VALID;
  END IF;
END
$shape$;

ALTER TABLE public.journal_lines VALIDATE CONSTRAINT journal_lines_amounts_not_negative;
ALTER TABLE public.journal_lines VALIDATE CONSTRAINT journal_lines_one_side;

-- A line belongs to an entry and sits on an account. Both were nullable.
ALTER TABLE public.journal_lines ALTER COLUMN journal_id SET NOT NULL;
ALTER TABLE public.journal_lines ALTER COLUMN account_id SET NOT NULL;


-- ─── 2. A posted entry balances — whoever wrote it ──────────────────────────
-- The posting function already refuses an unbalanced entry. Nothing refused a
-- row written AROUND it. This is checked at COMMIT (deferred), so the function
-- can still insert the header and then the lines inside its one transaction.

CREATE OR REPLACE FUNCTION public.journal_entry_assert_balanced(p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $balanced$
DECLARE
  v_status text;
  v_debit  numeric;
  v_credit numeric;
BEGIN
  SELECT status INTO v_status FROM public.journal_entries WHERE id = p_entry_id;

  -- Gone (deleted with its lines), or not in the books yet: nothing to hold.
  IF NOT FOUND OR v_status NOT IN ('posted', 'reversed') THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO v_debit, v_credit
    FROM public.journal_lines
   WHERE journal_id = p_entry_id;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_UNBALANCED' USING ERRCODE = 'P0001';
  END IF;
END
$balanced$;

CREATE OR REPLACE FUNCTION public.journal_lines_keep_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $lines$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.journal_entry_assert_balanced(OLD.journal_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.journal_entry_assert_balanced(NEW.journal_id);
  END IF;
  RETURN NULL;
END
$lines$;

CREATE OR REPLACE FUNCTION public.journal_entries_keep_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $entries$
BEGIN
  PERFORM public.journal_entry_assert_balanced(NEW.id);
  RETURN NULL;
END
$entries$;

DROP TRIGGER IF EXISTS journal_lines_balance_trg ON public.journal_lines;
CREATE CONSTRAINT TRIGGER journal_lines_balance_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.journal_lines_keep_balance();

DROP TRIGGER IF EXISTS journal_entries_balance_trg ON public.journal_entries;
CREATE CONSTRAINT TRIGGER journal_entries_balance_trg
  AFTER INSERT OR UPDATE OF status ON public.journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.journal_entries_keep_balance();

REVOKE ALL ON FUNCTION public.journal_entry_assert_balanced(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journal_lines_keep_balance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.journal_entries_keep_balance() FROM PUBLIC, anon, authenticated;


-- ─── 3. A cost layer cannot hold more than it received, or less than nothing ─

DO $layers$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'cost_layers_remaining_in_range'
       AND conrelid = 'public.cost_layers'::regclass
  ) THEN
    ALTER TABLE public.cost_layers
      ADD CONSTRAINT cost_layers_remaining_in_range
      CHECK (remaining_qty >= 0 AND remaining_qty <= received_qty) NOT VALID;
  END IF;
END
$layers$;

ALTER TABLE public.cost_layers VALIDATE CONSTRAINT cost_layers_remaining_in_range;


-- ─── 4. A payment settles invoices of its own currency ──────────────────────
-- 100 afghani paid must not reduce a debt of 100 dollars. An invoice with no
-- currency of its own is in the workspace's books currency.

CREATE OR REPLACE FUNCTION public.payment_allocations_same_currency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $currency$
DECLARE
  v_payment_currency text;
  v_invoice_currency text;
  v_workspace        uuid;
  v_books            text;
BEGIN
  SELECT currency INTO v_payment_currency FROM public.payments WHERE id = NEW.payment_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT currency, workspace_id INTO v_invoice_currency, v_workspace
    FROM public.invoices WHERE id = NEW.invoice_id;
  -- A missing invoice is the foreign key's refusal to make, not this one's.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_invoice_currency IS NULL OR v_invoice_currency = '' THEN
    SELECT base_currency INTO v_books FROM public.workspaces WHERE id = v_workspace;
    v_invoice_currency := v_books;
  END IF;

  IF v_invoice_currency IS DISTINCT FROM v_payment_currency THEN
    RAISE EXCEPTION 'PAYMENT_ALLOCATION_CURRENCY_MISMATCH' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END
$currency$;

DROP TRIGGER IF EXISTS payment_allocations_same_currency_trg ON public.payment_allocations;
CREATE TRIGGER payment_allocations_same_currency_trg
  BEFORE INSERT OR UPDATE OF payment_id, invoice_id ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.payment_allocations_same_currency();

REVOKE ALL ON FUNCTION public.payment_allocations_same_currency() FROM PUBLIC, anon, authenticated;


-- ─── 5. References the database did not check ───────────────────────────────
-- Each is added NOT VALID — from this moment a NEW row cannot point at nothing —
-- and then validated if the existing rows allow it. A reference that cannot be
-- validated is left NOT VALID and named in a NOTICE; the VERIFY query lists it.
-- Nothing is deleted to make a constraint fit.
--
-- Known in advance: payment_allocations.invoice_id has 15 old rows whose
-- invoice is gone, so that one stays NOT VALID.

DO $references$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('payment_allocations', 'invoice_id',       'invoices',        'payment_allocations_invoice_id_fkey'),
      ('cost_layers',         'product_id',       'products',        'cost_layers_product_id_fkey'),
      ('cost_consumptions',   'layer_id',         'cost_layers',     'cost_consumptions_layer_id_fkey'),
      ('cost_consumptions',   'product_id',       'products',        'cost_consumptions_product_id_fkey'),
      ('journal_entries',     'reversal_of',      'journal_entries', 'journal_entries_reversal_of_fkey'),
      ('payments',            'journal_entry_id', 'journal_entries', 'payments_journal_entry_id_fkey'),
      ('accounts',            'workspace_id',     'workspaces',      'accounts_workspace_id_fkey'),
      ('journal_entries',     'workspace_id',     'workspaces',      'journal_entries_workspace_id_fkey'),
      ('journal_lines',       'workspace_id',     'workspaces',      'journal_lines_workspace_id_fkey'),
      ('invoice_items',       'workspace_id',     'workspaces',      'invoice_items_workspace_id_fkey'),
      ('stock_movements',     'workspace_id',     'workspaces',      'stock_movements_workspace_id_fkey'),
      ('warehouses',          'workspace_id',     'workspaces',      'warehouses_workspace_id_fkey'),
      ('warehouse_stock',     'workspace_id',     'workspaces',      'warehouse_stock_workspace_id_fkey'),
      ('suppliers',           'workspace_id',     'workspaces',      'suppliers_workspace_id_fkey'),
      ('payments',            'workspace_id',     'workspaces',      'payments_workspace_id_fkey'),
      ('payment_allocations', 'workspace_id',     'workspaces',      'payment_allocations_workspace_id_fkey'),
      ('cost_layers',         'workspace_id',     'workspaces',      'cost_layers_workspace_id_fkey'),
      ('cost_consumptions',   'workspace_id',     'workspaces',      'cost_consumptions_workspace_id_fkey')
    ) AS t (child, col, parent, name)
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_constraint k
        JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
       WHERE k.contype = 'f'
         AND k.conrelid = format('public.%I', r.child)::regclass
         AND k.confrelid = format('public.%I', r.parent)::regclass
         AND a.attname = r.col
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I (id) NOT VALID',
        r.child, r.name, r.col, r.parent
      );
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = r.name
         AND conrelid = format('public.%I', r.child)::regclass
         AND NOT convalidated
    ) THEN
      BEGIN
        EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', r.child, r.name);
      EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE 'left NOT VALID (existing rows break it): %.% -> %', r.child, r.col, r.parent;
      END;
    END IF;
  END LOOP;
END
$references$;


-- ─── 6. Invoice lines with no workspace take their invoice's ────────────────
-- A line belongs to exactly one invoice (a foreign key), and the invoice says
-- which workspace it is in: this is read, not guessed. Lines whose invoice has
-- no workspace either are left as they are.

UPDATE public.invoice_items AS i
   SET workspace_id = v.workspace_id
  FROM public.invoices AS v
 WHERE v.id = i.invoice_id
   AND i.workspace_id IS NULL
   AND v.workspace_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK / MITIGATION — only if a rule turns out to refuse a legitimate write.
-- Each line is independent; run the one that is needed, not the whole block.
--
--   DROP TRIGGER IF EXISTS journal_lines_balance_trg ON public.journal_lines;
--   DROP TRIGGER IF EXISTS journal_entries_balance_trg ON public.journal_entries;
--   DROP TRIGGER IF EXISTS payment_allocations_same_currency_trg ON public.payment_allocations;
--   ALTER TABLE public.journal_lines DROP CONSTRAINT IF EXISTS journal_lines_amounts_not_negative;
--   ALTER TABLE public.journal_lines DROP CONSTRAINT IF EXISTS journal_lines_one_side;
--   ALTER TABLE public.journal_lines ALTER COLUMN journal_id DROP NOT NULL;
--   ALTER TABLE public.journal_lines ALTER COLUMN account_id DROP NOT NULL;
--   ALTER TABLE public.cost_layers DROP CONSTRAINT IF EXISTS cost_layers_remaining_in_range;
--   ALTER TABLE public.payment_allocations DROP CONSTRAINT IF EXISTS payment_allocations_invoice_id_fkey;
--   (the other foreign keys: DROP CONSTRAINT IF EXISTS <name from §5>)
--
-- The backfill in §6 is not undone: it wrote the workspace the invoice already
-- carried.
-- ═══════════════════════════════════════════════════════════════════════════
