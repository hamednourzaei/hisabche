-- ============================================
-- docs/warranty-claim-idempotency-migration.sql
--
-- WP-02 — a warranty claim submitted twice is ONE claim.
--
-- A device that submits a claim and loses the response retries. Without a key
-- stored beside the claim, the retry is a SECOND claim: the customer's phone
-- is booked in twice and two repair tickets can be opened for one fault.
-- The client already sends `Idempotency-Key` (`useIntentKey('warranty-claim')`
-- in packages/api/src/hooks/quality.ts); this is the column that remembers it
-- and the index that makes the second write impossible.
--
--   · additive and idempotent (safe to run twice)
--   · PARTIAL unique index: rows written before this migration keep
--     client_request_id = NULL — UNKNOWN, never backfilled (nothing invented)
--   · the key is scoped to the workspace, like every other row here
--
-- Rollback (bottom of this file):
--   ALTER TABLE public.warranty_claims DROP CONSTRAINT IF EXISTS
--     warranty_claims_client_request_not_blank;
--   DROP INDEX IF EXISTS public.warranty_claims_client_request_idx;
--   ALTER TABLE public.warranty_claims DROP COLUMN IF EXISTS client_request_id;
-- ============================================

ALTER TABLE public.warranty_claims
  ADD COLUMN IF NOT EXISTS client_request_id text;

-- One claim per key per workspace. A replay is refused by the DATABASE, not by
-- a read that two concurrent requests can both pass.
CREATE UNIQUE INDEX IF NOT EXISTS warranty_claims_client_request_idx
  ON public.warranty_claims (workspace_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- A blank key cannot be replayed and is not a key: refuse it rather than store
-- an empty string that would then collide with every other blank.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'warranty_claims_client_request_not_blank'
       AND conrelid = 'public.warranty_claims'::regclass
  ) THEN
    ALTER TABLE public.warranty_claims
      ADD CONSTRAINT warranty_claims_client_request_not_blank
      CHECK (client_request_id IS NULL OR length(btrim(client_request_id)) > 0) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.warranty_claims
  VALIDATE CONSTRAINT warranty_claims_client_request_not_blank;

-- ─── Rollback ───────────────────────────────────────────────────────────────
-- Run these three statements, in this order, only to undo this migration:
--
--   ALTER TABLE public.warranty_claims
--     DROP CONSTRAINT IF EXISTS warranty_claims_client_request_not_blank;
--   DROP INDEX IF EXISTS public.warranty_claims_client_request_idx;
--   ALTER TABLE public.warranty_claims
--     DROP COLUMN IF EXISTS client_request_id;
