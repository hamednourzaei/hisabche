-- ==============================================================================
-- docs/VERIFY-admin-action-types-03.sql
--
-- Read-only. Run AFTER docs/admin-action-types-03-migration.sql.
-- Every row must say `pass = true`.
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ==============================================================================

WITH expected(action_type) AS (
    VALUES
        ('REFUND'),
        ('LEDGER_ADJUSTMENT'),
        ('PRICE_CHANGE'),
        ('DOWNGRADE'),
        ('LICENSE_TRANSFER'),
        ('SECRET_ROTATE'),
        ('GATEWAY_ENABLE'),
        ('SERVER_SCALE_UP'),
        ('ADMIN_ROLE_GRANT'),
        ('BULK_EXPORT'),
        ('MEMBER_REMOVE'),
        ('IP_ALLOWLIST_REMOVE')
),
definition AS (
    SELECT pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'admin_action_requests'
       AND c.conname = 'admin_action_requests_action_type_check'
)
SELECT
    e.action_type,
    COALESCE((SELECT def FROM definition) LIKE '%' || e.action_type || '%', false) AS pass
FROM expected e
ORDER BY e.action_type;
