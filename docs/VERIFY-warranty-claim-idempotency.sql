-- docs/VERIFY-warranty-claim-idempotency.sql — every row must say ok = true.
-- Read-only. Run AFTER docs/warranty-claim-idempotency-migration.sql.

-- ─── Structure ──────────────────────────────────────────────────────────────
SELECT 'warranty_claims.client_request_id exists' AS check_name,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'warranty_claims'
                  AND column_name = 'client_request_id') AS ok
UNION ALL
SELECT 'warranty_claims_client_request_idx is UNIQUE',
       EXISTS (SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname = 'warranty_claims_client_request_idx'
                  AND indexdef LIKE 'CREATE UNIQUE INDEX%')
UNION ALL
SELECT 'warranty_claims_client_request_idx is PARTIAL',
       EXISTS (SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname = 'warranty_claims_client_request_idx'
                  AND indexdef LIKE '%WHERE%client_request_id IS NOT NULL%')
UNION ALL
SELECT 'blank-key CHECK present and validated',
       EXISTS (SELECT 1 FROM pg_constraint
                WHERE conname = 'warranty_claims_client_request_not_blank'
                  AND conrelid = 'public.warranty_claims'::regclass
                  AND convalidated);

-- ─── The rule that matters ──────────────────────────────────────────────────
-- Every row must be 0: one key, one claim, inside one workspace.
SELECT 'duplicate (workspace_id, client_request_id) pairs' AS check_name,
       COUNT(*) AS bad_rows
  FROM (
    SELECT workspace_id, client_request_id
      FROM public.warranty_claims
     WHERE client_request_id IS NOT NULL
     GROUP BY workspace_id, client_request_id
    HAVING COUNT(*) > 1
  ) AS dupes
UNION ALL
SELECT 'rows with a blank client_request_id',
       COUNT(*)
  FROM public.warranty_claims
 WHERE client_request_id IS NOT NULL
   AND length(btrim(client_request_id)) = 0;

-- ─── The backlog, reported and not judged ───────────────────────────────────
-- Claims recorded before this migration have no key and stay that way. This is
-- a REPORT, not a failure: it says how many claims a replay cannot be matched
-- against, so nobody claims they are all deduplicated.
SELECT 'claims recorded without a client_request_id' AS report_name,
       COUNT(*) AS claims_without_key
  FROM public.warranty_claims
 WHERE client_request_id IS NULL;
