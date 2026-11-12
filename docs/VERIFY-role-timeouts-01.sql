-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Verify V61 C.4.3 role timeouts

SELECT rolname, rolconfig
FROM pg_roles
WHERE rolname IN ('authenticated', 'anon', 'service_role')
ORDER BY rolname;
