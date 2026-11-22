-- ============================================================================
-- Hisabche Migration: Service Delivery — session subject, free-text type, participants (M4.5)
-- File: docs/service-delivery-05-session-subject-participants-migration.sql
-- Status: Post-migration verification query generated - PENDING HUMAN CONFIRMATION
--
-- Needs: docs/service-delivery-01-migration.sql, -02-, -03- and -04- already applied.
-- Safety classification: ADDITIVE + DATA_BACKFILL (deterministic, idempotent).
--   No column, table, index, constraint or policy is dropped except the NOT NULL
--   flag on customer_id, which is WIDENED (never narrowed) so an employee session
--   can exist. No row is rewritten or deleted. Every statement is re-runnable.
--
-- WHY
--   1. A session could only belong to a customer. Businesses also book sessions
--      for their own staff (training, internal meetings). `practitioner_id` is
--      the person who PERFORMS the service — a different fact — and is not
--      repurposed here.
--   2. One session could name only one customer. A group booking needs several
--      customers on ONE session, without duplicating the session.
--   3. The kind of session («کوتاهی», «رنگ», «مشاوره») was not stored at all.
--      It is free text: the business names its own services; no enum is invented.
--
-- MODEL
--   subject_type  'customer' (default, every historical row) | 'employee'
--   customer_id   the PRIMARY customer participant (kept for compatibility;
--                 NULL only for employee sessions)
--   employee_id   the PRIMARY employee subject (NULL for customer sessions)
--   session_type  free text, 1..120 chars after trim, NULL = not stated
--   service_delivery_session_participants
--                 normalized relation: one row per (session, person). The
--                 primary person ALWAYS has a row here too (trigger + backfill),
--                 so «who is in this session» has ONE answer.
--
--   An employee session cannot be delivered as package_credit: a package is a
--   CUSTOMER account and an employee has none. The check below refuses that row
--   state; the deliver RPC already refuses an invoice whose customer does not
--   match, so an employee session settles as complementary (a stated internal
--   service) — no new accounting policy is introduced.
--
-- DEPLOY ORDER
--   Backend first, or together. An old backend keeps writing customer sessions
--   with no subject_type (the default names them correctly) and no participants
--   (the insert trigger creates the primary row). This file alone changes no
--   behaviour of the old code.
-- ============================================================================

-- ─── 1. New columns on the session ─────────────────────────────────────────

ALTER TABLE public.service_delivery_sessions
  ADD COLUMN IF NOT EXISTS subject_type VARCHAR(20) NOT NULL DEFAULT 'customer';

ALTER TABLE public.service_delivery_sessions
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE RESTRICT;

ALTER TABLE public.service_delivery_sessions
  ADD COLUMN IF NOT EXISTS session_type VARCHAR(120);

-- Widening: an employee session has no customer. Existing rows keep their value.
ALTER TABLE public.service_delivery_sessions
  ALTER COLUMN customer_id DROP NOT NULL;

COMMENT ON COLUMN public.service_delivery_sessions.subject_type IS
  'customer = a session for customer participants; employee = a session for staff. practitioner_id remains the performer, never the subject.';
COMMENT ON COLUMN public.service_delivery_sessions.employee_id IS
  'The primary employee subject of an employee session. NULL for customer sessions. Never a customer id.';
COMMENT ON COLUMN public.service_delivery_sessions.session_type IS
  'Free-text kind of session as the business names it (fa/af/en). NULL = not stated. Trimmed, 1..120 chars, never an enum.';

-- ─── 2. Row-level invariants (DROP + ADD in one DO so a second run converges;
--        NOT VALID first, then VALIDATE — no constraint is trusted before the
--        rows are checked) ──────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_subject_type'
             AND conrelid = 'public.service_delivery_sessions'::regclass) THEN
    ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT chk_service_delivery_subject_type;
  END IF;
  ALTER TABLE public.service_delivery_sessions
    ADD CONSTRAINT chk_service_delivery_subject_type CHECK (
      subject_type IN ('customer', 'employee')
    ) NOT VALID;
END $$;
ALTER TABLE public.service_delivery_sessions VALIDATE CONSTRAINT chk_service_delivery_subject_type;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_subject'
             AND conrelid = 'public.service_delivery_sessions'::regclass) THEN
    ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT chk_service_delivery_subject;
  END IF;
  ALTER TABLE public.service_delivery_sessions
    ADD CONSTRAINT chk_service_delivery_subject CHECK (
      (subject_type = 'customer' AND customer_id IS NOT NULL AND employee_id IS NULL)
      OR
      (subject_type = 'employee' AND employee_id IS NOT NULL AND customer_id IS NULL)
    ) NOT VALID;
END $$;
ALTER TABLE public.service_delivery_sessions VALIDATE CONSTRAINT chk_service_delivery_subject;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_session_type'
             AND conrelid = 'public.service_delivery_sessions'::regclass) THEN
    ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT chk_service_delivery_session_type;
  END IF;
  ALTER TABLE public.service_delivery_sessions
    ADD CONSTRAINT chk_service_delivery_session_type CHECK (
      session_type IS NULL OR length(btrim(session_type)) >= 1
    ) NOT VALID;
END $$;
ALTER TABLE public.service_delivery_sessions VALIDATE CONSTRAINT chk_service_delivery_session_type;

-- A delivered employee session can never claim a customer's package credit.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_delivery_employee_settlement'
             AND conrelid = 'public.service_delivery_sessions'::regclass) THEN
    ALTER TABLE public.service_delivery_sessions DROP CONSTRAINT chk_service_delivery_employee_settlement;
  END IF;
  ALTER TABLE public.service_delivery_sessions
    ADD CONSTRAINT chk_service_delivery_employee_settlement CHECK (
      NOT (subject_type = 'employee' AND status = 'delivered' AND settlement_method = 'package_credit')
    ) NOT VALID;
END $$;
ALTER TABLE public.service_delivery_sessions VALIDATE CONSTRAINT chk_service_delivery_employee_settlement;

CREATE INDEX IF NOT EXISTS idx_service_delivery_employee
  ON public.service_delivery_sessions (workspace_id, employee_id)
  WHERE employee_id IS NOT NULL;

-- ─── 3. The participant relation ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.service_delivery_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.service_delivery_sessions(id) ON DELETE CASCADE,
  participant_type VARCHAR(20) NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
  employee_id UUID REFERENCES public.employees(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by UUID,
  CONSTRAINT chk_sd_participant_type CHECK (participant_type IN ('customer', 'employee')),
  CONSTRAINT chk_sd_participant_ref CHECK (
    (participant_type = 'customer' AND customer_id IS NOT NULL AND employee_id IS NULL)
    OR
    (participant_type = 'employee' AND employee_id IS NOT NULL AND customer_id IS NULL)
  )
);

COMMENT ON TABLE public.service_delivery_session_participants IS
  'Who is in a session. The primary customer/employee always has a row here too. RESTRICT on the person: archiving/deleting a customer never removes session history.';

-- One assignment per person per session (partial: a customer row and an
-- employee row are different facts).
CREATE UNIQUE INDEX IF NOT EXISTS uq_sd_participant_customer
  ON public.service_delivery_session_participants (session_id, customer_id)
  WHERE customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sd_participant_employee
  ON public.service_delivery_session_participants (session_id, employee_id)
  WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sd_participant_session
  ON public.service_delivery_session_participants (session_id);
CREATE INDEX IF NOT EXISTS idx_sd_participant_customer
  ON public.service_delivery_session_participants (workspace_id, customer_id)
  WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sd_participant_employee
  ON public.service_delivery_session_participants (workspace_id, employee_id)
  WHERE employee_id IS NOT NULL;

-- ─── 4. Tenant isolation (the same membership rule as every tenant table) ──

ALTER TABLE public.service_delivery_session_participants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.service_delivery_session_participants FROM PUBLIC;
REVOKE ALL ON public.service_delivery_session_participants FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_delivery_session_participants TO authenticated;
GRANT ALL ON public.service_delivery_session_participants TO service_role;

DROP POLICY IF EXISTS sd_session_participants_tenant_isolation ON public.service_delivery_session_participants;
CREATE POLICY sd_session_participants_tenant_isolation ON public.service_delivery_session_participants
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );

-- ─── 5. Integrity triggers ─────────────────────────────────────────────────
-- A participant must belong to the session's workspace, reference a person of
-- the SAME workspace, and match the session's subject type. An employee id can
-- therefore never land in a customer slot, or vice versa.

CREATE OR REPLACE FUNCTION public.trg_sd_participant_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_workspace UUID;
  v_subject VARCHAR(20);
  v_person_workspace UUID;
BEGIN
  SELECT workspace_id, subject_type INTO v_session_workspace, v_subject
    FROM public.service_delivery_sessions WHERE id = NEW.session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_SESSION_NOT_FOUND' USING ERRCODE = '23503';
  END IF;
  IF NEW.workspace_id <> v_session_workspace THEN
    RAISE EXCEPTION 'PARTICIPANT_WORKSPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF NEW.participant_type <> v_subject THEN
    RAISE EXCEPTION 'PARTICIPANT_TYPE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF NEW.participant_type = 'customer' THEN
    SELECT workspace_id INTO v_person_workspace FROM public.customers WHERE id = NEW.customer_id;
  ELSE
    SELECT workspace_id INTO v_person_workspace FROM public.employees WHERE id = NEW.employee_id;
  END IF;
  IF v_person_workspace IS NULL THEN
    RAISE EXCEPTION 'PARTICIPANT_PERSON_NOT_FOUND' USING ERRCODE = '23503';
  END IF;
  IF v_person_workspace <> NEW.workspace_id THEN
    RAISE EXCEPTION 'PARTICIPANT_WORKSPACE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.trg_sd_participant_integrity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sd_participant_integrity ON public.service_delivery_session_participants;
CREATE TRIGGER trg_sd_participant_integrity
  BEFORE INSERT OR UPDATE ON public.service_delivery_session_participants
  FOR EACH ROW EXECUTE FUNCTION public.trg_sd_participant_integrity();

-- Removing the PRIMARY participant promotes the oldest remaining one (the
-- session keeps a subject); removing the LAST one is refused — a session
-- without a subject is not a session. Financial/history rows are never touched.
CREATE OR REPLACE FUNCTION public.trg_sd_participant_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_primary UUID;
  v_subject VARCHAR(20);
  v_next RECORD;
BEGIN
  SELECT subject_type,
         CASE WHEN subject_type = 'customer' THEN customer_id ELSE employee_id END
    INTO v_subject, v_primary
    FROM public.service_delivery_sessions WHERE id = OLD.session_id;
  -- The session itself is gone (cascade): nothing to protect.
  IF NOT FOUND THEN RETURN OLD; END IF;

  IF v_primary IS DISTINCT FROM
     CASE WHEN OLD.participant_type = 'customer' THEN OLD.customer_id ELSE OLD.employee_id END THEN
    RETURN OLD; -- not the primary: an ordinary removal
  END IF;

  SELECT id, customer_id, employee_id INTO v_next
    FROM public.service_delivery_session_participants
   WHERE session_id = OLD.session_id AND id <> OLD.id
   ORDER BY created_at, id
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_PRIMARY_PARTICIPANT_REQUIRED' USING ERRCODE = '23514';
  END IF;

  IF v_subject = 'customer' THEN
    UPDATE public.service_delivery_sessions SET customer_id = v_next.customer_id WHERE id = OLD.session_id;
  ELSE
    UPDATE public.service_delivery_sessions SET employee_id = v_next.employee_id WHERE id = OLD.session_id;
  END IF;
  RETURN OLD;
END $$;

REVOKE EXECUTE ON FUNCTION public.trg_sd_participant_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sd_participant_delete ON public.service_delivery_session_participants;
CREATE TRIGGER trg_sd_participant_delete
  BEFORE DELETE ON public.service_delivery_session_participants
  FOR EACH ROW EXECUTE FUNCTION public.trg_sd_participant_delete();

-- Every NEW session names its primary person in the relation too, so «who is
-- in this session» has one answer from the first write. The id is derived from
-- (session, person): a replay or the backfill below converges on the same row.
CREATE OR REPLACE FUNCTION public.trg_sd_session_primary_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.subject_type = 'customer' AND NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.service_delivery_session_participants
      (id, workspace_id, session_id, participant_type, customer_id, created_at)
    VALUES
      (md5(NEW.id::text || ':customer:' || NEW.customer_id::text)::uuid,
       NEW.workspace_id, NEW.id, 'customer', NEW.customer_id, NEW.created_at)
    ON CONFLICT (session_id, customer_id) WHERE customer_id IS NOT NULL DO NOTHING;
  ELSIF NEW.subject_type = 'employee' AND NEW.employee_id IS NOT NULL THEN
    INSERT INTO public.service_delivery_session_participants
      (id, workspace_id, session_id, participant_type, employee_id, created_at)
    VALUES
      (md5(NEW.id::text || ':employee:' || NEW.employee_id::text)::uuid,
       NEW.workspace_id, NEW.id, 'employee', NEW.employee_id, NEW.created_at)
    ON CONFLICT (session_id, employee_id) WHERE employee_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.trg_sd_session_primary_participant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sd_session_primary_participant ON public.service_delivery_sessions;
CREATE TRIGGER trg_sd_session_primary_participant
  AFTER INSERT ON public.service_delivery_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_sd_session_primary_participant();

-- ─── 6. Deterministic backfill: every historical session names its customer ─
-- Same derived id as the trigger, same conflict target: running this twice (or
-- running it after the trigger already wrote the row) changes nothing.

INSERT INTO public.service_delivery_session_participants
  (id, workspace_id, session_id, participant_type, customer_id, created_at)
SELECT md5(s.id::text || ':customer:' || s.customer_id::text)::uuid,
       s.workspace_id, s.id, 'customer', s.customer_id, s.created_at
  FROM public.service_delivery_sessions s
 WHERE s.customer_id IS NOT NULL
ON CONFLICT (session_id, customer_id) WHERE customer_id IS NOT NULL DO NOTHING;

-- ============================================================================
-- Rollback / recovery guidance (NOT executed here)
-- ============================================================================
/*
-- The participant relation and the new columns are additive: an old backend
-- simply ignores them. To reverse fully (only after the old backend is back):
--
-- 1. Employee sessions must be resolved first (they cannot satisfy the old
--    NOT NULL customer_id). Decide with the owner: cancel them or assign a
--    customer. NEVER guess a backfill.
-- 2. DROP TRIGGER IF EXISTS trg_sd_session_primary_participant ON public.service_delivery_sessions;
--    DROP FUNCTION IF EXISTS public.trg_sd_session_primary_participant();
--    DROP TRIGGER IF EXISTS trg_sd_participant_delete ON public.service_delivery_session_participants;
--    DROP TRIGGER IF EXISTS trg_sd_participant_integrity ON public.service_delivery_session_participants;
--    DROP FUNCTION IF EXISTS public.trg_sd_participant_delete();
--    DROP FUNCTION IF EXISTS public.trg_sd_participant_integrity();
--    DROP TABLE IF EXISTS public.service_delivery_session_participants;
-- 3. ALTER TABLE public.service_delivery_sessions ALTER COLUMN customer_id SET NOT NULL;
--    (refused while any employee session exists — step 1 first)
--    ALTER TABLE public.service_delivery_sessions DROP COLUMN IF EXISTS session_type;
--    ALTER TABLE public.service_delivery_sessions DROP COLUMN IF EXISTS employee_id;
--    ALTER TABLE public.service_delivery_sessions DROP COLUMN IF EXISTS subject_type;
--    (drop the four chk_service_delivery_subject*/session_type/employee_settlement
--     constraints first; keep chk_service_delivery_settlement from -04)
*/