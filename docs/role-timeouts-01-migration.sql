-- ============================================================================
-- docs/role-timeouts-01-migration.sql
--
-- V61 C.4.3 — Per-role statement_timeout & idle_in_transaction_session_timeout
--             for pooler-safe Postgres operation (human-applied).
--
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    ALTER ROLE authenticated SET statement_timeout = '15s';
    ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '10s';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    ALTER ROLE anon SET statement_timeout = '5s';
    ALTER ROLE anon SET idle_in_transaction_session_timeout = '5s';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    ALTER ROLE service_role SET statement_timeout = '30s';
    ALTER ROLE service_role SET idle_in_transaction_session_timeout = '15s';
  END IF;
END $$;

-- Rollback (manual reference):
-- ALTER ROLE authenticated RESET statement_timeout;
-- ALTER ROLE authenticated RESET idle_in_transaction_session_timeout;
