-- ============================================
-- docs/support-tickets-02-lifecycle-migration.sql
--
-- V90 P0 / X08: Full Support Ticket Lifecycle Audit & Collaboration
--   - assignee tracking, closed/reopened timestamps on support_tickets
--   - append-only support_ticket_events (immutable status/assignee/SLA history)
--   - support_ticket_comments (external replies + internal manager notes)
-- Additive, idempotent. Human-applied only.
-- ============================================

BEGIN;

ALTER TABLE IF EXISTS public.support_tickets
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz;

CREATE TABLE IF NOT EXISTS public.support_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'created',
    'status_changed',
    'assigned',
    'reopened',
    'closed',
    'sla_breached',
    'comment_added'
  )),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_events_ws_ticket
  ON public.support_ticket_events (workspace_id, ticket_id, created_at ASC);

ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_ticket_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.support_ticket_events TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_ticket_events'
      AND policyname = 'support_ticket_events_workspace_isolation'
  ) THEN
    CREATE POLICY support_ticket_events_workspace_isolation ON public.support_ticket_events
      FOR ALL TO authenticated
      USING (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
          WHERE wm.user_id = auth.uid() AND wm.has_access = true AND wm.suspended_at IS NULL
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
          WHERE wm.user_id = auth.uid() AND wm.has_access = true AND wm.suspended_at IS NULL
        )
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.support_ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_comments_ws_ticket
  ON public.support_ticket_comments (workspace_id, ticket_id, created_at ASC);

ALTER TABLE public.support_ticket_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_ticket_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.support_ticket_comments TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_ticket_comments'
      AND policyname = 'support_ticket_comments_workspace_isolation'
  ) THEN
    CREATE POLICY support_ticket_comments_workspace_isolation ON public.support_ticket_comments
      FOR ALL TO authenticated
      USING (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
          WHERE wm.user_id = auth.uid() AND wm.has_access = true AND wm.suspended_at IS NULL
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT wm.workspace_id FROM public.workspace_members wm
          WHERE wm.user_id = auth.uid() AND wm.has_access = true AND wm.suspended_at IS NULL
        )
      );
  END IF;
END $$;

COMMIT;

-- Rollback:
-- DROP TABLE IF EXISTS public.support_ticket_comments;
-- DROP TABLE IF EXISTS public.support_ticket_events;
-- ALTER TABLE IF EXISTS public.support_tickets DROP COLUMN IF EXISTS reopened_at, DROP COLUMN IF EXISTS closed_at, DROP COLUMN IF EXISTS assigned_to;
