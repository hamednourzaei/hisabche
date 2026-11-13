-- ==============================================================================
-- docs/admin-action-types-02-migration.sql
--
-- V63 · S-1 — the maker-checker table can now carry the actions V63 adds.
--
-- WHY
--   `admin_action_requests.action_type` was constrained to the five billing
--   actions from `admin-04`. A secret rotation, a live-gateway switch, a
--   server scale-up and an admin-role grant must go through the SAME
--   maker-checker flow, and the same table — a second approval mechanism
--   beside the first is exactly the duplication this repository refuses.
--
-- WHAT
--   Widens the CHECK constraint. Nothing else about the table changes: the
--   proposer/approver rule, the status column and the audit events stay.
--
-- SAFETY
--   - additive; keeps every existing value valid;
--   - `NOT VALID` then `VALIDATE`, so the lock is short;
--   - safe to run twice (drop-if-exists, then add).
--
-- POST-MIGRATION VERIFICATION: docs/VERIFY-admin-action-types-02.sql
--   Post-migration verification query generated — PENDING HUMAN CONFIRMATION
--
-- ROLLBACK
--   Re-run `admin-04-billing-migration.sql`'s CREATE TABLE statement is not
--   needed: the old constraint can be restored with
--     ALTER TABLE public.admin_action_requests
--       DROP CONSTRAINT IF EXISTS admin_action_requests_action_type_check;
--     ALTER TABLE public.admin_action_requests
--       ADD CONSTRAINT admin_action_requests_action_type_check
--       CHECK (action_type IN ('REFUND','LEDGER_ADJUSTMENT','PRICE_CHANGE',
--                              'DOWNGRADE','LICENSE_TRANSFER'));
--   (Only safe when no row uses a V63 action type.)
-- ==============================================================================

DO $$
BEGIN
    IF to_regclass('public.admin_action_requests') IS NULL THEN
        RAISE NOTICE 'admin_action_requests is absent — run admin-04-billing-migration.sql first';
        RETURN;
    END IF;

    ALTER TABLE public.admin_action_requests
        DROP CONSTRAINT IF EXISTS admin_action_requests_action_type_check;

    ALTER TABLE public.admin_action_requests
        ADD CONSTRAINT admin_action_requests_action_type_check
        CHECK (action_type IN (
            'REFUND',
            'LEDGER_ADJUSTMENT',
            'PRICE_CHANGE',
            'DOWNGRADE',
            'LICENSE_TRANSFER',
            'SECRET_ROTATE',
            'GATEWAY_ENABLE',
            'SERVER_SCALE_UP',
            'ADMIN_ROLE_GRANT',
            'BULK_EXPORT'
        )) NOT VALID;

    ALTER TABLE public.admin_action_requests
        VALIDATE CONSTRAINT admin_action_requests_action_type_check;
END $$;
