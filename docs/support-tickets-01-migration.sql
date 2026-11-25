-- ============================================
-- docs/support-tickets-01-migration.sql
--
-- P0 / X08: Persistent Customer Support & Incident SLA Lifecycle
-- (ticket creation, priority SLA hours, escalation & post-incident RCA).
-- Additive, idempotent. Human-applied only.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ticket_code text NOT NULL,
  subject text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('billing', 'sync', 'accounting', 'pos', 'other')),
  description text NOT NULL,
  sla_hours integer NOT NULL CHECK (sla_hours > 0),
  response_due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'escalated', 'resolved', 'closed')),
  escalation_level integer NOT NULL DEFAULT 0 CHECK (escalation_level >= 0),
  rca_summary text,
  idempotency_key text,
  created_by uuid NOT NULL,
  escalated_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, ticket_code),
  UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_ws_status
  ON public.support_tickets (workspace_id, status, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.support_tickets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.support_tickets TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_tickets'
      AND policyname = 'support_tickets_workspace_isolation'
  ) THEN
    CREATE POLICY support_tickets_workspace_isolation ON public.support_tickets
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
-- DROP TABLE IF EXISTS public.support_tickets;
