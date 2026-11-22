-- ============================================================================
-- VERIFY: docs/service-delivery-05-session-subject-participants-migration.sql
-- Read-only. Run after the migration; nothing here writes.
--
-- Expected:
--   1. subject_type default 'customer', NOT NULL; employee_id/session_type nullable;
--      customer_id nullable (widened for employee sessions)
--   2. the four new checks exist and are VALIDATED
--   3. zero rows break the subject invariant
--   4. every session with a primary person has exactly that person's participant
--      row (backfill complete), and no duplicate assignments exist
--   5. zero cross-workspace participants
--   6. zero blank session_type values; zero delivered employee package_credit rows
--   7. RLS enabled with the membership policy; anon has no grant
-- ============================================================================

-- 1. The columns as the database stores them.
SELECT column_name, column_default, is_nullable, data_type, character_maximum_length
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'service_delivery_sessions'
   AND column_name IN ('subject_type', 'employee_id', 'session_type', 'customer_id')
 ORDER BY column_name;

-- 2. The constraints (all must say convalidated = true).
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'public.service_delivery_sessions'::regclass
   AND conname IN (
     'chk_service_delivery_subject_type',
     'chk_service_delivery_subject',
     'chk_service_delivery_session_type',
     'chk_service_delivery_employee_settlement'
   )
 ORDER BY conname;

-- 3. Rows that would break the subject invariant (must be 0).
SELECT COUNT(*) AS rows_breaking_subject
  FROM public.service_delivery_sessions
 WHERE NOT (
   (subject_type = 'customer' AND customer_id IS NOT NULL AND employee_id IS NULL)
   OR
   (subject_type = 'employee' AND employee_id IS NOT NULL AND customer_id IS NULL)
 );

-- 4a. Sessions whose primary person has NO participant row (must be 0).
SELECT COUNT(*) AS sessions_missing_primary_participant
  FROM public.service_delivery_sessions s
 WHERE (s.subject_type = 'customer' AND s.customer_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.service_delivery_session_participants p
          WHERE p.session_id = s.id AND p.customer_id = s.customer_id))
    OR (s.subject_type = 'employee' AND s.employee_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.service_delivery_session_participants p
          WHERE p.session_id = s.id AND p.employee_id = s.employee_id));

-- 4b. Duplicate assignments (must be 0; the partial unique indexes enforce this).
SELECT session_id, customer_id, COUNT(*) AS n
  FROM public.service_delivery_session_participants
 WHERE customer_id IS NOT NULL
 GROUP BY session_id, customer_id HAVING COUNT(*) > 1;
SELECT session_id, employee_id, COUNT(*) AS n
  FROM public.service_delivery_session_participants
 WHERE employee_id IS NOT NULL
 GROUP BY session_id, employee_id HAVING COUNT(*) > 1;

-- 4c. Participant counts per subject type (the backfill summary).
SELECT participant_type, COUNT(*) AS rows
  FROM public.service_delivery_session_participants
 GROUP BY participant_type ORDER BY participant_type;

-- 5. Cross-workspace participants (must be 0): the person and the session must
--    live in the participant's workspace.
SELECT COUNT(*) AS cross_workspace_participants
  FROM public.service_delivery_session_participants p
  JOIN public.service_delivery_sessions s ON s.id = p.session_id
  LEFT JOIN public.customers c ON c.id = p.customer_id
  LEFT JOIN public.employees e ON e.id = p.employee_id
 WHERE s.workspace_id <> p.workspace_id
    OR (p.customer_id IS NOT NULL AND c.workspace_id <> p.workspace_id)
    OR (p.employee_id IS NOT NULL AND e.workspace_id <> p.workspace_id);

-- 6a. Blank or over-long session types (must be 0).
SELECT COUNT(*) AS invalid_session_types
  FROM public.service_delivery_sessions
 WHERE session_type IS NOT NULL
   AND (length(btrim(session_type)) = 0 OR length(session_type) > 120);

-- 6b. A delivered employee session on package credit (must be 0).
SELECT COUNT(*) AS employee_package_deliveries
  FROM public.service_delivery_sessions
 WHERE subject_type = 'employee' AND status = 'delivered' AND settlement_method = 'package_credit';

-- 7. RLS and grants.
SELECT relrowsecurity FROM pg_class WHERE oid = 'public.service_delivery_session_participants'::regclass;
SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr
  FROM pg_policy WHERE polrelid = 'public.service_delivery_session_participants'::regclass;
SELECT grantee, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'service_delivery_session_participants'
 ORDER BY grantee, privilege_type;