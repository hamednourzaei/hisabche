-- ============================================================================
-- DEVELOPER PLATFORM — API keys and signed outbound webhooks.
-- Additive, idempotent, re-runnable.
--
-- ⚠️ NOT YET RUN. Run it in the SQL Editor, then docs/VERIFY-developer-platform.sql.
-- Status: PENDING HUMAN CONFIRMATION.
--
-- Until it runs, the backend answers the developer routes with 503
-- «not configured» and emits no webhooks; nothing else changes.
--
-- WHAT THIS ADDS
--
--   api_keys                   one row per key; the key itself is NEVER stored —
--                              only SHA-256(key) and a display prefix
--   webhook_endpoints          where a workspace wants events sent, and which
--   webhook_endpoint_secrets   the signing secret per endpoint — service role only,
--                              no workspace column, no client policy at all
--   webhook_deliveries         one row per (endpoint, event); the outbox the
--                              delivery worker drains
--
--   enqueue_webhook_event(...)      fan one event out to every subscribed,
--                                   active endpoint in ONE statement; a repeat
--                                   of the same event id is a no-op
--   claim_webhook_deliveries(...)   FOR UPDATE SKIP LOCKED, leased — the same
--                                   claim model as email_outbox
--   complete_webhook_delivery(...)  holder only
--   fail_webhook_delivery(...)      holder only; backoff, then 'failed'; an
--                                   endpoint that keeps failing is switched off
--
-- WHO SEES WHAT
--
--   Clients (authenticated) may SELECT keys, endpoints and deliveries of a
--   workspace they OWN or ADMINISTER — nothing else, and never write. Every
--   write goes through the backend, which checks `workspace.manage`. anon is
--   granted nothing. Secrets are readable by the service role only; the UI
--   shows a secret once, when it is created or rotated.
-- ============================================================================

BEGIN;

-- ─── API keys ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  prefix        text NOT NULL,
  key_hash      text NOT NULL UNIQUE CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  scopes        text[] NOT NULL CHECK (cardinality(scopes) > 0),
  expires_at    timestamptz,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  revoked_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_workspace_idx ON public.api_keys (workspace_id, created_at DESC);

-- ─── Webhook endpoints ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by           uuid NOT NULL,
  url                  text NOT NULL CHECK (url ~ '^https://' AND char_length(url) <= 2000),
  description          text CHECK (description IS NULL OR char_length(description) <= 200),
  events               text[] NOT NULL CHECK (cardinality(events) > 0),
  is_active            boolean NOT NULL DEFAULT true,
  disabled_reason      text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_endpoints_workspace_idx
  ON public.webhook_endpoints (workspace_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.webhook_endpoint_secrets (
  endpoint_id uuid PRIMARY KEY REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  secret      text NOT NULL CHECK (char_length(secret) >= 32),
  rotated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Deliveries (the outbox) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  endpoint_id      uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_id         uuid NOT NULL,
  event_type       text NOT NULL,
  payload          jsonb NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'delivering', 'succeeded', 'failed')),
  attempts         integer NOT NULL DEFAULT 0,
  max_attempts     integer NOT NULL DEFAULT 8,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  claimed_by       text,
  claim_expires_at timestamptz,
  last_status_code integer,
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  delivered_at     timestamptz,
  -- The same event is delivered to an endpoint at most once, however many
  -- times the emitter retries.
  CONSTRAINT webhook_deliveries_once UNIQUE (endpoint_id, event_id)
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_due_idx
  ON public.webhook_deliveries (next_attempt_at) WHERE status IN ('pending', 'delivering');
CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_idx
  ON public.webhook_deliveries (endpoint_id, created_at DESC);

-- ─── Row level security ──────────────────────────────────────────────────────

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoint_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.api_keys, public.webhook_endpoints, public.webhook_deliveries
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.webhook_endpoint_secrets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.api_keys, public.webhook_endpoints, public.webhook_deliveries TO authenticated;
GRANT ALL ON public.api_keys, public.webhook_endpoints, public.webhook_endpoint_secrets,
  public.webhook_deliveries TO service_role;

-- SELECT only, and only for the workspace's owners and managers — stored as
-- 'manager' or, in the older client vocabulary, 'admin' (tenancy.service.ts
-- CLIENT_ROLE_TO_SERVER). Sellers see nothing. No write policy exists: writes
-- are the backend's, behind `workspace.manage`.
DROP POLICY IF EXISTS api_keys_managers_read ON api_keys;
CREATE POLICY api_keys_managers_read ON api_keys
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspace_members m
     WHERE m.workspace_id = api_keys.workspace_id
       AND m.user_id = auth.uid()
       AND m.has_access = true
       AND m.suspended_at IS NULL
       AND m.role IN ('owner', 'admin', 'manager')
  ));

DROP POLICY IF EXISTS webhook_endpoints_managers_read ON webhook_endpoints;
CREATE POLICY webhook_endpoints_managers_read ON webhook_endpoints
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspace_members m
     WHERE m.workspace_id = webhook_endpoints.workspace_id
       AND m.user_id = auth.uid()
       AND m.has_access = true
       AND m.suspended_at IS NULL
       AND m.role IN ('owner', 'admin', 'manager')
  ));

DROP POLICY IF EXISTS webhook_deliveries_managers_read ON webhook_deliveries;
CREATE POLICY webhook_deliveries_managers_read ON webhook_deliveries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspace_members m
     WHERE m.workspace_id = webhook_deliveries.workspace_id
       AND m.user_id = auth.uid()
       AND m.has_access = true
       AND m.suspended_at IS NULL
       AND m.role IN ('owner', 'admin', 'manager')
  ));

-- webhook_endpoint_secrets: RLS on, NO policy — no client reads a secret, ever.

-- ─── Functions ───────────────────────────────────────────────────────────────

-- Fan an event out. One statement, so the endpoints matched and the rows
-- written are one consistent picture; ON CONFLICT makes a repeated emit safe.
-- Returns how many deliveries were written.
CREATE OR REPLACE FUNCTION public.enqueue_webhook_event(
  p_workspace_id uuid,
  p_event_id     uuid,
  p_event_type   text,
  p_payload      jsonb
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.webhook_deliveries (workspace_id, endpoint_id, event_id, event_type, payload)
  SELECT e.workspace_id, e.id, p_event_id, p_event_type, p_payload
    FROM public.webhook_endpoints e
   WHERE e.workspace_id = p_workspace_id
     AND e.is_active
     AND p_event_type = ANY (e.events)
  ON CONFLICT ON CONSTRAINT webhook_deliveries_once DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Claim due deliveries (or the one with p_id). A 'delivering' row whose lease
-- expired is an attempt whose worker died: claimed again while attempts
-- remain, otherwise it ends as failed.
CREATE OR REPLACE FUNCTION public.claim_webhook_deliveries(
  p_worker        text,
  p_limit         integer DEFAULT 20,
  p_lease_seconds integer DEFAULT 60,
  p_id            uuid    DEFAULT NULL
)
RETURNS SETOF public.webhook_deliveries
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.webhook_deliveries d
     SET status = 'failed',
         last_error = COALESCE(d.last_error, 'CLAIM_EXPIRED: worker stopped before finishing'),
         claimed_by = NULL,
         claim_expires_at = NULL
   WHERE d.status = 'delivering'
     AND d.claim_expires_at < now()
     AND d.attempts >= d.max_attempts;

  RETURN QUERY
  WITH picked AS (
    SELECT d.id
      FROM public.webhook_deliveries d
      JOIN public.webhook_endpoints e ON e.id = d.endpoint_id
     WHERE (p_id IS NULL OR d.id = p_id)
       AND e.is_active
       AND d.attempts < d.max_attempts
       AND ((d.status = 'pending' AND d.next_attempt_at <= now())
            OR (d.status = 'delivering' AND d.claim_expires_at < now()))
     ORDER BY d.next_attempt_at
     FOR UPDATE OF d SKIP LOCKED
     LIMIT GREATEST(1, LEAST(p_limit, 100))
  )
  UPDATE public.webhook_deliveries d
     SET status = 'delivering',
         attempts = d.attempts + 1,
         claimed_by = p_worker,
         claim_expires_at = now() + make_interval(secs => p_lease_seconds)
    FROM picked
   WHERE d.id = picked.id
  RETURNING d.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_webhook_delivery(
  p_id          uuid,
  p_worker      text,
  p_status_code integer
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_endpoint uuid;
BEGIN
  UPDATE public.webhook_deliveries
     SET status = 'succeeded', delivered_at = now(), last_status_code = p_status_code,
         last_error = NULL, claimed_by = NULL, claim_expires_at = NULL
   WHERE id = p_id AND status = 'delivering' AND claimed_by = p_worker
  RETURNING endpoint_id INTO v_endpoint;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE public.webhook_endpoints SET consecutive_failures = 0 WHERE id = v_endpoint;
  RETURN true;
END;
$$;

-- A failed attempt: back to pending after the delay while attempts remain,
-- otherwise 'failed'. A delivery that fails for good counts against its
-- endpoint; 20 in a row switch the endpoint off with a stated reason rather
-- than retrying into a dead URL forever. Returns the new status, or NULL when
-- p_worker no longer held the row.
CREATE OR REPLACE FUNCTION public.fail_webhook_delivery(
  p_id                  uuid,
  p_worker              text,
  p_error               text,
  p_status_code         integer DEFAULT NULL,
  p_retry_delay_seconds integer DEFAULT 60
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status   text;
  v_endpoint uuid;
BEGIN
  UPDATE public.webhook_deliveries
     SET status = CASE WHEN attempts < max_attempts THEN 'pending' ELSE 'failed' END,
         next_attempt_at = now() + make_interval(secs => p_retry_delay_seconds),
         last_error = left(p_error, 1000),
         last_status_code = p_status_code,
         claimed_by = NULL,
         claim_expires_at = NULL
   WHERE id = p_id AND status = 'delivering' AND claimed_by = p_worker
  RETURNING status, endpoint_id INTO v_status, v_endpoint;

  IF v_status = 'failed' THEN
    UPDATE public.webhook_endpoints
       SET consecutive_failures = consecutive_failures + 1,
           is_active = CASE WHEN consecutive_failures + 1 >= 20 THEN false ELSE is_active END,
           disabled_reason = CASE WHEN consecutive_failures + 1 >= 20
                                  THEN 'TOO_MANY_FAILURES' ELSE disabled_reason END,
           updated_at = now()
     WHERE id = v_endpoint;
  END IF;
  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_webhook_event(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_webhook_deliveries(text, integer, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_webhook_delivery(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_webhook_delivery(uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_webhook_event(uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_webhook_deliveries(text, integer, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_webhook_delivery(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_webhook_delivery(uuid, text, text, integer, integer) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK / MITIGATION
--
-- Nothing else depends on these objects. To switch the platform off without
-- losing history, deactivate every endpoint and revoke every key:
--
--   UPDATE public.webhook_endpoints SET is_active = false, disabled_reason = 'PLATFORM_OFF';
--   UPDATE public.api_keys SET revoked_at = now() WHERE revoked_at IS NULL;
--
-- To remove it entirely (destroys keys, endpoints and delivery history):
--
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.fail_webhook_delivery(uuid, text, text, integer, integer);
--   DROP FUNCTION IF EXISTS public.complete_webhook_delivery(uuid, text, integer);
--   DROP FUNCTION IF EXISTS public.claim_webhook_deliveries(text, integer, integer, uuid);
--   DROP FUNCTION IF EXISTS public.enqueue_webhook_event(uuid, uuid, text, jsonb);
--   DROP TABLE IF EXISTS public.webhook_deliveries;
--   DROP TABLE IF EXISTS public.webhook_endpoint_secrets;
--   DROP TABLE IF EXISTS public.webhook_endpoints;
--   DROP TABLE IF EXISTS public.api_keys;
--   COMMIT;
-- ============================================================================
