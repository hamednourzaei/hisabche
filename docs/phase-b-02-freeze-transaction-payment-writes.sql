-- ============================================================================
-- docs/phase-b-02-freeze-transaction-payment-writes.sql
--
-- PHASE B · 2/2 — close the door that let a payment be recorded outside the
-- payments core.
--
-- ⚠️ APPLY THIS **AFTER** THE PHASE B CODE DEPLOY, NOT BEFORE.
--
--    Until the deploy lands, the web PaymentModal still writes
--    `transactions (type='payment')` for a customer payment. Applying this file
--    first turns that into a 500 on a screen a shopkeeper uses every day.
--    `phase-b-01` is safe to apply at any time; this one is not.
--
-- ---------------------------------------------------------------------------
-- WHAT IS FROZEN, AND WHAT DELIBERATELY IS NOT
--
-- FROZEN — 'payment' and 'receipt'. Money moving between the business and a
-- party now has exactly one home: `payments` + `payment_allocations`, which
-- allocates it against invoices and books the journal entry. A row here does
-- none of that: it moves a balance on one screen and is invisible to the
-- ledger, to `invoice_outstanding`, and to every financial statement.
--
-- NOT FROZEN — 'sale', 'purchase', 'return', and anything else. Not because
-- they are right, but because they still have legitimate users:
--
--   * `customer.service.create()` writes a 'sale' row for a credit customer's
--     OPENING BALANCE. An opening balance is genuinely not a document — there
--     is no invoice behind "this person already owed 3,000 when I started
--     using the app". It gets a proper home in Phase F; freezing it now would
--     break customer creation for no gain.
--   * manual adjustments entered before this phase.
--
-- Freezing what has a replacement, and leaving alone what does not, is the
-- whole discipline here. A guard that forces people to work around it is worse
-- than no guard.
--
-- ---------------------------------------------------------------------------
-- WHY A TRIGGER AND NOT A CHECK CONSTRAINT
--
-- A CHECK is validated against existing rows (or added NOT VALID and then
-- misleading). There ARE existing 'payment' rows — the mis-recorded ones the
-- report at the end of phase-b-01 lists. They must stay readable; only NEW ones
-- are refused. That is a trigger, not a constraint.
--
-- SAFE TO RE-RUN. Adds a trigger; writes no rows.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION transactions_reject_money_movement()
RETURNS trigger
LANGUAGE plpgsql
-- Pinned, per section 2 of linter-hardening-migration.sql. `pg_temp` is
-- deliberately absent: it resolves before `public`, so a caller with a temp
-- table of the same name could shadow a real one.
SET search_path = public
AS $reject$
BEGIN
  IF NEW.type IN ('payment', 'receipt') THEN
    RAISE EXCEPTION
      'transactions no longer accepts type=% (Phase B). Money moving between the business and a party is recorded through the payments core, which allocates it against invoices and books the journal entry.',
      NEW.type
      USING ERRCODE = '0A000',
            HINT = 'POST /api/payments with { direction: in|out, partyType, partyId, amount }. A row written here would settle no invoice and appear in no financial statement.';
  END IF;

  RETURN NEW;
END
$reject$;

DROP TRIGGER IF EXISTS transactions_reject_money_movement_trg ON transactions;
CREATE TRIGGER transactions_reject_money_movement_trg
  BEFORE INSERT OR UPDATE OF type ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_reject_money_movement();

COMMENT ON FUNCTION transactions_reject_money_movement() IS
  'Refuses new payment/receipt rows on transactions. Existing rows are untouched and still readable — see the mis-recorded-payments report in phase-b-01. Phase B.';

COMMIT;

-- ============================================================================
-- ROLLBACK — if the deploy is reverted, drop the trigger; nothing else changes.
--
--     DROP TRIGGER IF EXISTS transactions_reject_money_movement_trg ON transactions;
-- ============================================================================
