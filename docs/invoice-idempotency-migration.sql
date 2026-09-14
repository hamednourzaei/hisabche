-- ============================================================================
-- docs/invoice-idempotency-migration.sql
--
-- POST /api/invoices becomes idempotent per client request.
--
-- WHY. The mobile outbox replays a queued invoice with `Idempotency-Key:
-- <clientId>`, but the server never read that header. When a request reached
-- the server and only the RESPONSE was lost (timeout, tunnel, app killed), the
-- entry stayed pending and the next sync — or a pull-to-refresh — created the
-- same sale a second time: stock out twice, revenue booked twice.
--
-- MODEL. `invoices.client_request_id` holds the key; a partial unique index on
-- (workspace_id, client_request_id) makes a second insert with the same key
-- impossible. The service looks the key up first and returns the existing
-- invoice; a concurrent duplicate that slips past the lookup hits 23505 and is
-- answered the same way — before any item, stock or ledger write.
--
-- EXISTING DATA: untouched. The column is NULL for every existing invoice and
-- NULLs are outside the partial index.
--
-- ⚠️ CREATE INDEX takes a short write lock on `invoices`; run it at a quiet time.
--
-- ROLLBACK / MITIGATION
--   DROP INDEX IF EXISTS public.invoices_client_request_key;
--   ALTER TABLE public.invoices DROP COLUMN IF EXISTS client_request_id;
--   (the backend then answers keyed requests 503 INVOICE_IDEMPOTENCY_MIGRATION_REQUIRED
--    and the mobile outbox keeps them pending — it never creates unkeyed copies)
--
-- ADDITIVE / IDEMPOTENT. SAFE TO RE-RUN.
-- ============================================================================

BEGIN;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_client_request_key
  ON public.invoices (workspace_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
