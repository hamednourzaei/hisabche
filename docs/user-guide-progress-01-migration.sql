-- ============================================================================
-- user-guide-progress-01 — which in-app guide steps each PERSON has seen
--
-- Owner request (8 Nov 2026): a guide that was read once must not come back,
-- not after a hard refresh, not on another browser, not on the desktop or the
-- phone. It used to live only in the browser's localStorage.
--
-- Per person, not per workspace: the guide teaches the product's screens,
-- which are the same in every business the person belongs to. user_id here is
-- the OWNER of the row (the person), read and written only by the backend for
-- `request.userId` itself — it is never a tenancy filter on business data.
--
-- Additive, idempotent. Rollback: DROP TABLE public.user_guide_progress;
-- (the client falls back to the device copy and simply shows guides again).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_guide_progress (
  user_id   uuid        NOT NULL,
  step_id   text        NOT NULL CHECK (length(step_id) BETWEEN 1 AND 120),
  route_id  text        NOT NULL CHECK (length(route_id) BETWEEN 1 AND 60),
  seen_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, step_id)
);

CREATE INDEX IF NOT EXISTS user_guide_progress_user_idx
  ON public.user_guide_progress (user_id);

-- auth.users exists on Supabase; the FK is added only where it can be.
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_guide_progress_user_fk') THEN
    ALTER TABLE public.user_guide_progress
      ADD CONSTRAINT user_guide_progress_user_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Only the backend (service_role) touches it. A new Supabase table is born
-- with ALL for anon / authenticated / service_role, so revoke first.
ALTER TABLE public.user_guide_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_guide_progress FROM anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.user_guide_progress TO service_role;
