-- ============================================================================
-- docs/till-bank-transfer-migration.sql
--
-- Cash moved between the till and the bank, as a real accounting event.
--
-- A transfer is two facts, each with its own home:
--   * the ledger:  Dr bank / Cr cash (to bank) or Dr cash / Cr bank (from bank),
--                  posted when it happens, source_type 'till_transfer',
--                  source_id = the transfer id (journal_entries_source_key makes
--                  a retried transfer post nothing new);
--   * the drawer:  a pos_cash_movements row with the SAME id and a transfer
--                  kind, so the expected cash of the session includes it.
--
-- WHY NEW KINDS AND NOT cash_in / cash_out: a session close books ordinary cash
-- movements to the purchase account. A transfer stored as cash_out would be
-- booked TWICE — once as the transfer, once as an expense at close.
--
-- EXISTING DATA: untouched. Widening a CHECK accepts every row it accepted.
--
-- ROLLBACK / MITIGATION
--   ALTER TABLE public.pos_cash_movements DROP CONSTRAINT IF EXISTS pos_cash_movements_kind_check;
--   ALTER TABLE public.pos_cash_movements ADD CONSTRAINT pos_cash_movements_kind_check
--     CHECK (kind IN ('cash_in', 'cash_out'));
--   (only valid while no transfer rows exist)
--
-- ADDITIVE / IDEMPOTENT. SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

ALTER TABLE public.pos_cash_movements DROP CONSTRAINT IF EXISTS pos_cash_movements_kind_check;
ALTER TABLE public.pos_cash_movements ADD CONSTRAINT pos_cash_movements_kind_check
  CHECK (kind IN ('cash_in', 'cash_out', 'transfer_to_bank', 'transfer_from_bank'));

COMMIT;

NOTIFY pgrst, 'reload schema';
