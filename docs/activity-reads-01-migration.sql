-- ============================================================================
-- docs/activity-reads-01-migration.sql
--
-- Activity reads per user: read state is per person, not shared across workspace.
-- An event is read by a person; reading it does not mark it read for other members.
--
-- ⚠️ NO BACKFILL from activities.is_read: the old flag is shared across the entire
-- workspace and does not say who read. Old events remain unread for each person
-- until they mark them. The activities.is_read column itself is left untouched;
-- nothing reads or writes it after this change.
--
-- THE FEED IS PERSONAL: a person's feed is the events THEY performed in this
-- workspace (activity.service.ts filters actor_id AND workspace_id; guard:
-- activity-feed-workspace-scoped.test.ts). Every function here counts and marks
-- inside that same set, so a badge can never count an event the list does not show.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 1. Table: activity_reads
CREATE TABLE IF NOT EXISTS public.activity_reads (
  workspace_id  uuid NOT NULL,
  activity_id   uuid NOT NULL,
  user_id       uuid NOT NULL,
  read_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, user_id),
  CONSTRAINT fk_activity_reads_workspace FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_reads_activity FOREIGN KEY (activity_id)
    REFERENCES public.activities(id) ON DELETE CASCADE
);

-- 2. Index to accelerate looking up unread activities for a user in a workspace
CREATE INDEX IF NOT EXISTS activity_reads_user_workspace_idx
  ON public.activity_reads (workspace_id, user_id, activity_id);

-- 3. RLS & Permissions
ALTER TABLE public.activity_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_reads FROM PUBLIC, anon, authenticated, service_role;
-- Rows are written only by the SECURITY DEFINER functions below.
GRANT SELECT ON public.activity_reads TO service_role;

-- 4. RPC: activity_mark_read
CREATE OR REPLACE FUNCTION public.activity_mark_read(
  p_workspace uuid,
  p_user uuid,
  p_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted integer;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL OR array_length(p_ids, 1) = 0 THEN
    RETURN 0;
  END IF;

  WITH valid_activities AS (
    SELECT a.id
    FROM public.activities a
    WHERE a.workspace_id = p_workspace
    AND a.actor_id = p_user
      AND a.id = ANY(p_ids)
  ),
  ins AS (
    INSERT INTO public.activity_reads (workspace_id, activity_id, user_id, read_at)
    SELECT p_workspace, va.id, p_user, now()
    FROM valid_activities va
    ON CONFLICT (activity_id, user_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_inserted FROM ins;

  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activity_mark_read(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activity_mark_read(uuid, uuid, uuid[]) TO service_role;

-- 5. RPC: activity_mark_all_read
CREATE OR REPLACE FUNCTION public.activity_mark_all_read(
  p_workspace uuid,
  p_user uuid,
  p_filter text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted integer;
BEGIN
  WITH target_activities AS (
    SELECT a.id
    FROM public.activities a
    WHERE a.workspace_id = p_workspace
    AND a.actor_id = p_user
      AND (
        p_filter IS NULL
        OR p_filter = 'all'
        OR p_filter = 'unread'
        OR (p_filter = 'invoices' AND a.entity_type = 'invoice')
        OR (p_filter = 'payments' AND a.entity_type = 'payment')
        OR (p_filter = 'customers' AND a.entity_type = 'customer')
        OR (a.entity_type = p_filter)
      )
  ),
  ins AS (
    INSERT INTO public.activity_reads (workspace_id, activity_id, user_id, read_at)
    SELECT p_workspace, ta.id, p_user, now()
    FROM target_activities ta
    ON CONFLICT (activity_id, user_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_inserted FROM ins;

  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activity_mark_all_read(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activity_mark_all_read(uuid, uuid, text) TO service_role;

-- 6. RPC: activity_get_unread_count
CREATE OR REPLACE FUNCTION public.activity_get_unread_count(
  p_workspace uuid,
  p_user uuid,
  p_filter text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)::integer INTO v_count
  FROM public.activities a
  WHERE a.workspace_id = p_workspace
    AND a.actor_id = p_user
    AND (
      p_filter IS NULL
      OR p_filter = 'all'
      OR p_filter = 'unread'
      OR (p_filter = 'invoices' AND a.entity_type = 'invoice')
      OR (p_filter = 'payments' AND a.entity_type = 'payment')
      OR (p_filter = 'customers' AND a.entity_type = 'customer')
      OR (a.entity_type = p_filter)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.activity_reads r
      WHERE r.activity_id = a.id
        AND r.user_id = p_user
    );

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activity_get_unread_count(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activity_get_unread_count(uuid, uuid, text) TO service_role;

-- 7. RPC: activity_get_filter_counts
CREATE OR REPLACE FUNCTION public.activity_get_filter_counts(
  p_workspace uuid,
  p_user uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'all', count(*)::integer,
    'unread', count(*) FILTER (WHERE r.activity_id IS NULL)::integer,
    'invoices', count(*) FILTER (WHERE a.entity_type = 'invoice')::integer,
    'payments', count(*) FILTER (WHERE a.entity_type = 'payment')::integer,
    'customers', count(*) FILTER (WHERE a.entity_type = 'customer')::integer,
    -- Unread per tab: «mark all as read» on the invoices tab is offered only
    -- while an invoice event is unread, not while any invoice event exists.
    'unreadBy', jsonb_build_object(
      'invoices', count(*) FILTER (WHERE r.activity_id IS NULL AND a.entity_type = 'invoice')::integer,
      'payments', count(*) FILTER (WHERE r.activity_id IS NULL AND a.entity_type = 'payment')::integer,
      'customers', count(*) FILTER (WHERE r.activity_id IS NULL AND a.entity_type = 'customer')::integer
    )
  ) INTO v_result
  FROM public.activities a
  LEFT JOIN public.activity_reads r
    ON r.activity_id = a.id AND r.user_id = p_user
  WHERE a.workspace_id = p_workspace
    AND a.actor_id = p_user;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activity_get_filter_counts(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activity_get_filter_counts(uuid, uuid) TO service_role;

-- 8. RPC: activity_get_unread_ids
CREATE OR REPLACE FUNCTION public.activity_get_unread_ids(
  p_workspace uuid,
  p_user uuid,
  p_type text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT a.id
  FROM public.activities a
  WHERE a.workspace_id = p_workspace
    AND a.actor_id = p_user
    AND (p_type IS NULL OR a.entity_type = p_type)
    AND NOT EXISTS (
      SELECT 1
      FROM public.activity_reads r
      WHERE r.activity_id = a.id
        AND r.user_id = p_user
    )
  ORDER BY a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activity_get_unread_ids(uuid, uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activity_get_unread_ids(uuid, uuid, text, integer, integer) TO service_role;

COMMIT;

-- ============================================================================
-- ROLLBACK:
--   BEGIN;
--   DROP FUNCTION IF EXISTS public.activity_get_unread_ids(uuid, uuid, text, integer, integer);
--   DROP FUNCTION IF EXISTS public.activity_get_filter_counts(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.activity_get_unread_count(uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.activity_mark_all_read(uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.activity_mark_read(uuid, uuid, uuid[]);
--   DROP TABLE IF EXISTS public.activity_reads CASCADE;
--   COMMIT;
--
-- VERIFY: docs/VERIFY-activity-reads-01.sql
-- ============================================================================
