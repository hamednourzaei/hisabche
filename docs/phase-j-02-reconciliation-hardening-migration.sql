-- ============================================================================
-- docs/phase-j-02-reconciliation-hardening-migration.sql
--
-- PHASE J · J2 — a reconciled statement line says WHAT it was matched to, and
-- stops being editable once it is.
--
-- ---------------------------------------------------------------------------
-- WHAT IS ALREADY RIGHT (J0 discovery — do not rebuild these)
--
--   J2.4 ✅ Reconciliation creates NO accounting entry. `banking.service.ts`
--           writes only to `bank_statement_lines`. The rule "reconciliation
--           must not invent a journal entry" is already held.
--
--   J2.5 ✅ Statement immutability. `reconcile()` writes only `matched_to`,
--           `matched_at`, `matched_by` and `difference_reason`. It never
--           touches `amount_minor`, `on_date` or `external_ref`.
--
--           There is also a real concurrency guard: the update carries
--           `.is('matched_to', null)`, so two people confirming the same line
--           at once means the second finds nothing to update rather than
--           overwriting the first.
--
-- ---------------------------------------------------------------------------
-- WHAT IS MISSING
--
-- 1. `matched_to` IS A BARE UUID WITH NO KIND.
--
--    `reconciliation.domain.ts` already models `kind: 'payment' | 'invoice' |
--    'journal'` and scores candidates from all three. The COLUMN cannot hold
--    that: given only a uuid, nothing can tell whether the line was matched to
--    a payment or a journal entry, and resolving the reference back means
--    guessing or querying every table in turn.
--
--    So `loadBookEntries` reads only `payments` — not because payments are the
--    right scope, but because they are the only thing the column can
--    unambiguously mean. J2.2 asks for the wider set; this column is what
--    blocks it.
--
-- 2. NO RECONCILE LOCK (J2.6).
--
--    Nothing stops a matched line being re-matched or edited. The application
--    is careful, but the rule is a financial control and belongs where it
--    cannot be bypassed.
--
-- 3. `reconciliation_sessions` / `reconciliation_matches` HAVE NO READERS.
--
--    Both exist and no code touches them. They are NOT dropped here — see the
--    note at the bottom — but nothing new is built on them either, because
--    matching already works through `bank_statement_lines` and a second model
--    of the same fact is the parallel architecture G2 forbids.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
-- Additive plus one trigger. To undo:
--
--   DROP TRIGGER IF EXISTS bank_statement_lines_immutable_trg ON bank_statement_lines;
--   DROP FUNCTION IF EXISTS bank_statement_lines_immutable();
--   ALTER TABLE bank_statement_lines DROP COLUMN IF EXISTS matched_kind;
--
-- Dropping the trigger removes a control; it destroys nothing. Dropping the
-- column loses the kind of every match recorded since the deploy, after which
-- `matched_to` is ambiguous again.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION VERIFICATION — run first, keep the output.
-- ============================================================================
--
-- P1. How many lines exist, and how many are already matched?
--
--   SELECT COUNT(*) AS lines, COUNT(matched_to) AS matched FROM bank_statement_lines;
--
-- P2. Every existing match — is it really a payment? Section 3 assumes so and
--     this is the evidence. Expect `orphan` to be 0: a matched_to that is not a
--     payment id means the assumption is wrong and section 3 must not run.
--
--   SELECT COUNT(*) FILTER (WHERE p.id IS NOT NULL) AS is_payment,
--          COUNT(*) FILTER (WHERE p.id IS NULL)     AS orphan
--   FROM   bank_statement_lines l
--   LEFT   JOIN payments p ON p.id = l.matched_to
--   WHERE  l.matched_to IS NOT NULL;
--
-- P3. Does the column already exist? A re-run reports 1.
--
--   SELECT COUNT(*) FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='bank_statement_lines'
--     AND column_name='matched_kind';
--
-- P4. Anything already reading the unused tables? Expect 0 rows in both.
--
--   SELECT 'sessions' AS t, COUNT(*) FROM reconciliation_sessions
--   UNION ALL
--   SELECT 'matches', COUNT(*) FROM reconciliation_matches;
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. What kind of thing was this line matched to?
-- ---------------------------------------------------------------------------

ALTER TABLE bank_statement_lines ADD COLUMN IF NOT EXISTS matched_kind text;

ALTER TABLE bank_statement_lines
  DROP CONSTRAINT IF EXISTS bank_statement_lines_matched_kind_check;
ALTER TABLE bank_statement_lines
  ADD CONSTRAINT bank_statement_lines_matched_kind_check
  CHECK (matched_kind IS NULL OR matched_kind IN ('payment', 'invoice', 'journal'));

-- A match must name BOTH or NEITHER. A `matched_to` with no kind is the
-- ambiguity this column exists to remove, and a kind with no target is a match
-- to nothing.
ALTER TABLE bank_statement_lines
  DROP CONSTRAINT IF EXISTS bank_statement_lines_match_complete_check;
ALTER TABLE bank_statement_lines
  ADD CONSTRAINT bank_statement_lines_match_complete_check
  CHECK ((matched_to IS NULL) = (matched_kind IS NULL))
  NOT VALID;

COMMENT ON COLUMN bank_statement_lines.matched_kind IS
  'What matched_to points at: payment | invoice | journal. Without it a uuid cannot be resolved back to a row, which is why the matcher only ever offered payments. Phase J (J2).';

COMMENT ON COLUMN bank_statement_lines.matched_to IS
  'The book entry this line was reconciled against. Meaningless without matched_kind — read them together.';

COMMENT ON TABLE bank_statement_lines IS
  'What the BANK says happened. The amount, date and external reference are the bank''s record and are immutable once imported — reconciliation records a MATCH against them and never edits them. Enforced by bank_statement_lines_immutable(). Phase J (J2).';

CREATE INDEX IF NOT EXISTS bank_statement_lines_matched_idx
  ON bank_statement_lines (workspace_id, matched_kind, matched_to)
  WHERE matched_to IS NOT NULL;

-- Unmatched lines are what the reconciliation screen lists.
CREATE INDEX IF NOT EXISTS bank_statement_lines_unmatched_idx
  ON bank_statement_lines (workspace_id, statement_id, on_date)
  WHERE matched_to IS NULL;

-- ---------------------------------------------------------------------------
-- 2. The existing matches are payments
--
-- Every match written before this column existed came from `reconcile()`,
-- which resolved its candidates from `payments` and nothing else. Stamping
-- them is not a guess — it is the only value they could have had.
--
-- P2 above is the check. If it reported orphans, STOP and investigate rather
-- than running this.
-- ---------------------------------------------------------------------------

UPDATE bank_statement_lines
SET    matched_kind = 'payment'
WHERE  matched_to IS NOT NULL
  AND  matched_kind IS NULL;

-- Now that no row violates it, the completeness constraint can be validated.
ALTER TABLE bank_statement_lines
  VALIDATE CONSTRAINT bank_statement_lines_match_complete_check;

-- ---------------------------------------------------------------------------
-- 3. J2.5 + J2.6 — the bank's record is immutable, and a match is a lock
--
-- Two rules in one trigger, because they are the same idea: a statement line
-- is EVIDENCE, and evidence is not edited in place.
--
--   IMMUTABLE ALWAYS — amount_minor, on_date, external_ref and line_key are
--   what the bank said. Nothing in this product may change them, reconciled or
--   not. A reconciliation that "fixes" an amount to make it match is a
--   reconciliation that proves nothing.
--
--   LOCKED WHILE MATCHED — a matched line cannot be re-matched to something
--   else in one step. Un-match first, which is a separate, audited act.
--
-- ⚠️ Un-matching itself is allowed: setting `matched_to` to NULL is the
-- documented way out. What is refused is moving a match sideways, because that
-- leaves no trace that the first match ever existed.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION bank_statement_lines_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $immutable$
BEGIN
  -- The bank's own figures. Never editable, in any state.
  IF NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
     OR NEW.on_date IS DISTINCT FROM OLD.on_date
     OR NEW.external_ref IS DISTINCT FROM OLD.external_ref
     OR NEW.line_key IS DISTINCT FROM OLD.line_key
  THEN
    RAISE EXCEPTION
      'BANK_STATEMENT_LINE_IMMUTABLE: amount, date, external reference and line key are the bank''s record and cannot be changed.'
      USING ERRCODE = '0A000',
            HINT = 'If the imported figure is wrong, re-import the statement. Reconciliation records a match; it does not edit the bank.';
  END IF;

  -- A matched line must be un-matched before it can be matched to something
  -- else. Moving it directly would erase the first match with no record.
  IF OLD.matched_to IS NOT NULL
     AND NEW.matched_to IS NOT NULL
     AND NEW.matched_to IS DISTINCT FROM OLD.matched_to
  THEN
    RAISE EXCEPTION
      'BANK_STATEMENT_LINE_ALREADY_RECONCILED: this line is already matched.'
      USING ERRCODE = '0A000',
            HINT = 'Un-match it first — that is an audited action — then match it again.';
  END IF;

  RETURN NEW;
END
$immutable$;

COMMENT ON FUNCTION bank_statement_lines_immutable() IS
  'Keeps the bank''s figures un-editable and refuses a sideways re-match. Phase J (J2.5, J2.6).';

DROP TRIGGER IF EXISTS bank_statement_lines_immutable_trg ON bank_statement_lines;
CREATE TRIGGER bank_statement_lines_immutable_trg
  BEFORE UPDATE ON bank_statement_lines
  FOR EACH ROW EXECUTE FUNCTION bank_statement_lines_immutable();

COMMIT;

-- ============================================================================
-- NOT DONE HERE, AND WHY
--
-- `reconciliation_sessions` and `reconciliation_matches` exist with no readers
-- and no writers. They are NOT dropped:
--
--   · dropping a table is destructive and G3 forbids it without an explicit
--     strategy;
--   · they may hold rows from an earlier attempt, and those rows are evidence
--     of what someone once reconciled.
--
-- Nothing new is built on them either. Matching already works through
-- `bank_statement_lines.matched_to`, and a second model of the same fact is
-- exactly the parallel architecture G2 forbids. If a session model is wanted
-- later — "these forty lines were reconciled together on this date" — it
-- should be designed then, against these tables, as its own change.
-- ============================================================================

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================
--
-- V1. Shape. Expect `matched_kind`, two check constraints, two indexes.
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='bank_statement_lines'
--   ORDER BY ordinal_position;
--
--   SELECT conname, pg_get_constraintdef(oid), convalidated
--   FROM pg_constraint WHERE conrelid = 'bank_statement_lines'::regclass AND contype = 'c';
--
-- V2. Every match names a kind, and every kind names a match. MUST BE EMPTY.
--
--   SELECT id, matched_to, matched_kind FROM bank_statement_lines
--   WHERE (matched_to IS NULL) <> (matched_kind IS NULL);
--
-- V3. ⚠️ THE ONE THAT MATTERS — the bank's figures are refused.
--     Expect: ERROR BANK_STATEMENT_LINE_IMMUTABLE.
--
--   UPDATE bank_statement_lines SET amount_minor = amount_minor + 1
--   WHERE id = (SELECT id FROM bank_statement_lines LIMIT 1);
--
-- V4. A sideways re-match is refused.
--     Expect: ERROR BANK_STATEMENT_LINE_ALREADY_RECONCILED.
--
--   UPDATE bank_statement_lines SET matched_to = gen_random_uuid()
--   WHERE matched_to IS NOT NULL LIMIT 1;
--
-- V5. Un-matching is still allowed. Expect: UPDATE 1, then put it back.
--
--   BEGIN;
--   UPDATE bank_statement_lines SET matched_to = NULL, matched_kind = NULL
--   WHERE id = (SELECT id FROM bank_statement_lines WHERE matched_to IS NOT NULL LIMIT 1);
--   ROLLBACK;
