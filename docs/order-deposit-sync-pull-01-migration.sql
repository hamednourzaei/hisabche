-- ============================================================================
-- docs/order-deposit-sync-pull-01-migration.sql
--
-- WHY
--
-- A deposit taken at one counter was invisible at the next one. `order_deposits`
-- and its two movement tables were never in the sync change log, so a device
-- that pulled after the deposit was created received nothing: the customer's
-- advance simply did not exist there, and the next sale offered money the shop
-- had already taken — or refused to apply a deposit that was really there.
--
-- This migration puts the three tables on the canonical delta pull:
--
--   1. a `version` column, which `sync_record_change()` already expects (it
--      records `COALESCE(NEW.version, 1)`) and `sync_bump_version()` maintains;
--   2. change-log triggers, so every receipt, application and refund writes a
--      log row inside the SAME transaction that wrote the money;
--   3. a backfill, so rows that existed BEFORE the trigger are delivered to a
--      device that already holds a cursor — without this, a device would only
--      ever see deposits created after the migration;
--   4. comments, and a rollback block at the end.
--
-- WHAT IS DELIBERATELY ABSENT
--
-- No DELETE trigger. These rows are never deleted: a deposit is corrected by
-- refunding it, an application by cancelling the payment behind it (the balance
-- function already ignores a cancelled payment). A delete change would also
-- have nothing to delete on the device — the local movement tables carry no
-- `dirty` flag, which is what the pull uses to spare an unsent local edit.
--
-- The tables stay writable by `service_role` only (docs/order-deposit-apply-
-- refund-01-migration.sql revoked PUBLIC); adding a column does not change that.
--
-- Idempotent: every statement can run again. The migration is also run TWICE by
-- backend/src/__tests__/order-deposit-sync-pull-01.pg.test.ts on purpose.
--
-- VERIFY: docs/VERIFY-order-deposit-sync-pull-01.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Prerequisites — fail with a name, not in a random trigger later
-- ---------------------------------------------------------------------------

DO $guard$
BEGIN
  IF to_regclass('public.order_deposits') IS NULL
     OR to_regclass('public.order_deposit_applications') IS NULL
     OR to_regclass('public.order_deposit_refunds') IS NULL THEN
    RAISE EXCEPTION 'ORDER_DEPOSIT_SYNC: the deposit tables are missing (docs/universal-core-migration.sql and docs/order-deposit-apply-refund-01-migration.sql).';
  END IF;
  IF to_regclass('public.sync_change_log') IS NULL
     OR to_regprocedure('public.sync_record_change()') IS NULL
     OR to_regprocedure('public.sync_bump_version()') IS NULL THEN
    RAISE EXCEPTION 'ORDER_DEPOSIT_SYNC: the sync engine is missing (docs/sync-engine-migration.sql).';
  END IF;
END
$guard$;

-- ---------------------------------------------------------------------------
-- 1. The version the sync engine reads and bumps
-- ---------------------------------------------------------------------------

ALTER TABLE public.order_deposits            ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;
ALTER TABLE public.order_deposit_applications ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;
ALTER TABLE public.order_deposit_refunds      ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.order_deposits.version IS
  'Optimistic-concurrency token maintained by sync_bump_version(). Not written through /sync/push: a deposit is created by the domain route, never by a row insert.';
COMMENT ON COLUMN public.order_deposit_applications.version IS
  'Same token for an application. The row is move-only (insert), so the value exists to make the change log uniform.';
COMMENT ON COLUMN public.order_deposit_refunds.version IS
  'Same token for a refund. The row is move-only (insert).';

-- ---------------------------------------------------------------------------
-- 2. Triggers: version bump and change log, per table
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS order_deposits_bump_version_trg ON public.order_deposits;
CREATE TRIGGER order_deposits_bump_version_trg
  BEFORE UPDATE ON public.order_deposits
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS order_deposits_change_log_trg ON public.order_deposits;
CREATE TRIGGER order_deposits_change_log_trg
  AFTER INSERT OR UPDATE ON public.order_deposits
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('order_deposits');

DROP TRIGGER IF EXISTS order_deposit_applications_bump_version_trg ON public.order_deposit_applications;
CREATE TRIGGER order_deposit_applications_bump_version_trg
  BEFORE UPDATE ON public.order_deposit_applications
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS order_deposit_applications_change_log_trg ON public.order_deposit_applications;
CREATE TRIGGER order_deposit_applications_change_log_trg
  AFTER INSERT OR UPDATE ON public.order_deposit_applications
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('order_deposit_applications');

DROP TRIGGER IF EXISTS order_deposit_refunds_bump_version_trg ON public.order_deposit_refunds;
CREATE TRIGGER order_deposit_refunds_bump_version_trg
  BEFORE UPDATE ON public.order_deposit_refunds
  FOR EACH ROW EXECUTE FUNCTION sync_bump_version();

DROP TRIGGER IF EXISTS order_deposit_refunds_change_log_trg ON public.order_deposit_refunds;
CREATE TRIGGER order_deposit_refunds_change_log_trg
  AFTER INSERT OR UPDATE ON public.order_deposit_refunds
  FOR EACH ROW EXECUTE FUNCTION sync_record_change('order_deposit_refunds');

-- ---------------------------------------------------------------------------
-- 3. Backfill: what existed before the trigger
--
-- A device that already holds a cursor only ever asks for changes AFTER it.
-- Without this, every deposit created before today would stay invisible on that
-- device until somebody touched the row. The NOT EXISTS makes a second run a
-- no-op instead of a second copy of the same change.
-- ---------------------------------------------------------------------------

INSERT INTO public.sync_change_log (workspace_id, entity_type, entity_id, operation, entity_version)
SELECT d.workspace_id, 'order_deposits', d.id, 'create', d.version
  FROM public.order_deposits d
 WHERE NOT EXISTS (
   SELECT 1 FROM public.sync_change_log l
    WHERE l.entity_type = 'order_deposits' AND l.entity_id = d.id
 );

INSERT INTO public.sync_change_log (workspace_id, entity_type, entity_id, operation, entity_version)
SELECT a.workspace_id, 'order_deposit_applications', a.id, 'create', a.version
  FROM public.order_deposit_applications a
 WHERE NOT EXISTS (
   SELECT 1 FROM public.sync_change_log l
    WHERE l.entity_type = 'order_deposit_applications' AND l.entity_id = a.id
 );

INSERT INTO public.sync_change_log (workspace_id, entity_type, entity_id, operation, entity_version)
SELECT r.workspace_id, 'order_deposit_refunds', r.id, 'create', r.version
  FROM public.order_deposit_refunds r
 WHERE NOT EXISTS (
   SELECT 1 FROM public.sync_change_log l
    WHERE l.entity_type = 'order_deposit_refunds' AND l.entity_id = r.id
 );

-- ---------------------------------------------------------------------------
-- 4. ROLLBACK — run by hand
-- ---------------------------------------------------------------------------
--
-- DROP TRIGGER IF EXISTS order_deposits_change_log_trg ON public.order_deposits;
-- DROP TRIGGER IF EXISTS order_deposits_bump_version_trg ON public.order_deposits;
-- DROP TRIGGER IF EXISTS order_deposit_applications_change_log_trg ON public.order_deposit_applications;
-- DROP TRIGGER IF EXISTS order_deposit_applications_bump_version_trg ON public.order_deposit_applications;
-- DROP TRIGGER IF EXISTS order_deposit_refunds_change_log_trg ON public.order_deposit_refunds;
-- DROP TRIGGER IF EXISTS order_deposit_refunds_bump_version_trg ON public.order_deposit_refunds;
-- DELETE FROM public.sync_change_log
--  WHERE entity_type IN ('order_deposits', 'order_deposit_applications', 'order_deposit_refunds');
-- ALTER TABLE public.order_deposits DROP COLUMN IF EXISTS version;
-- ALTER TABLE public.order_deposit_applications DROP COLUMN IF EXISTS version;
-- ALTER TABLE public.order_deposit_refunds DROP COLUMN IF EXISTS version;
-- ============================================================================
