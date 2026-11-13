-- ==============================================================================
-- docs/admin-action-types-03-migration.sql
--
-- Owner request (12 Nov 2026): «تأیید دو نفره برای حذف‌ها» — a deletion in the
-- platform console needs a SECOND admin.
--
-- WHAT
--   Widens the maker-checker CHECK constraint with the two console deletions:
--     MEMBER_REMOVE        a member loses access to a business;
--     IP_ALLOWLIST_REMOVE  an address loses access to the console.
--   The proposer/approver rule, statuses and audit events are the ones the
--   table already has (admin-04, admin-action-types-02). No second mechanism.
--   Until this runs the console answers 503 ADMIN_ACTION_TYPE_NOT_INSTALLED
--   on those two deletions — it never falls back to deleting directly.
--
-- SAFETY
--   - additive; keeps every existing value valid (includes all of 02's types);
--   - `NOT VALID` then `VALIDATE`, so the lock is short;
--   - safe to run twice (drop-if-exists, then add).
--
-- POST-MIGRATION VERIFICATION: docs/VERIFY-admin-action-types-03.sql
--   Post-migration verification query generated — PENDING HUMAN CONFIRMATION
--
-- ROLLBACK
--   Re-run docs/admin-action-types-02-migration.sql (only safe when no row uses
--   MEMBER_REMOVE or IP_ALLOWLIST_REMOVE; reject or delete those requests first).
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
            'BULK_EXPORT',
            'MEMBER_REMOVE',
            'IP_ALLOWLIST_REMOVE'
        )) NOT VALID;

    ALTER TABLE public.admin_action_requests
        VALIDATE CONSTRAINT admin_action_requests_action_type_check;
END $$;
