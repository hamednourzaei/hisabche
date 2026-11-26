-- ============================================================================
-- Migration: update-control-plane-01
-- Purpose: Authoritative self-updating Core/Module/Data-Pack release registry,
--          staged rollout rings, deterministic cohorts, telemetry & auto-halt,
--          and signed halt directives (Expand-only, idempotent).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.runtime_release_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layer text NOT NULL CHECK (layer IN ('core', 'module', 'data-pack', 'bootstrap')),
  component_id text NOT NULL,
  version text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('development', 'internal', 'beta', 'stable')),
  ring text NOT NULL DEFAULT 'development'
    CHECK (ring IN ('development', 'internal', 'canary', 'expanded', 'everyone')),
  rollout_percent integer NOT NULL DEFAULT 0 CHECK (rollout_percent >= 0 AND rollout_percent <= 100),
  platforms text[] NOT NULL DEFAULT ARRAY['windows', 'android', 'web']::text[],
  manifest_json jsonb NOT NULL,
  signature_json jsonb NOT NULL,
  sequence_no bigint NOT NULL CHECK (sequence_no >= 1),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'halted', 'revoked', 'deprecated')),
  halt_reason text,
  rollback_target_version text,
  min_supported_version text NOT NULL DEFAULT '1.0.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  halted_at timestamptz,
  CONSTRAINT uq_runtime_release_component_ver_chan UNIQUE (layer, component_id, version, channel)
);

CREATE INDEX IF NOT EXISTS idx_runtime_release_active_lookup
  ON public.runtime_release_artifacts (layer, channel, status, sequence_no DESC);

CREATE TABLE IF NOT EXISTS public.runtime_rollout_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  release_id uuid NOT NULL REFERENCES public.runtime_release_artifacts(id) ON DELETE CASCADE,
  ring text NOT NULL,
  event_kind text NOT NULL CHECK (
    event_kind IN (
      'activation_success',
      'startup_failure',
      'rollback_triggered',
      'signature_failure'
    )
  ),
  reason_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_rollout_telemetry_release
  ON public.runtime_rollout_telemetry (release_id, ring, event_kind);

CREATE INDEX IF NOT EXISTS idx_runtime_rollout_telemetry_ws
  ON public.runtime_rollout_telemetry (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.runtime_halt_directives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.runtime_release_artifacts(id) ON DELETE CASCADE,
  layer text NOT NULL,
  component_id text NOT NULL,
  target_version text NOT NULL,
  rollback_target text,
  reason text NOT NULL,
  directive_json jsonb NOT NULL,
  signature_json jsonb NOT NULL,
  sequence_no bigint NOT NULL CHECK (sequence_no >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.runtime_release_artifacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.runtime_rollout_telemetry FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.runtime_halt_directives FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.runtime_release_artifacts TO service_role;
GRANT SELECT, INSERT ON TABLE public.runtime_rollout_telemetry TO service_role;
GRANT SELECT, INSERT ON TABLE public.runtime_halt_directives TO service_role;

ALTER TABLE public.runtime_release_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runtime_rollout_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runtime_halt_directives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_rollout_telemetry_ws_isolation ON public.runtime_rollout_telemetry;
CREATE POLICY runtime_rollout_telemetry_ws_isolation
  ON public.runtime_rollout_telemetry
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.halt_runtime_release_atomic(
  p_release_id uuid,
  p_status text,
  p_reason text,
  p_rollback_target text,
  p_directive_json jsonb,
  p_signature_json jsonb,
  p_sequence_no bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rel public.runtime_release_artifacts%ROWTYPE;
BEGIN
  IF p_status NOT IN ('halted', 'revoked') THEN
    RAISE EXCEPTION 'INVALID_HALT_STATUS:%', p_status;
  END IF;

  SELECT * INTO v_rel
  FROM public.runtime_release_artifacts
  WHERE id = p_release_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RELEASE_NOT_FOUND');
  END IF;

  UPDATE public.runtime_release_artifacts
  SET status = p_status,
      halt_reason = p_reason,
      halted_at = now(),
      updated_at = now()
  WHERE id = p_release_id;

  INSERT INTO public.runtime_halt_directives (
    release_id, layer, component_id, target_version, rollback_target,
    reason, directive_json, signature_json, sequence_no
  ) VALUES (
    p_release_id, v_rel.layer, v_rel.component_id, v_rel.version, p_rollback_target,
    p_reason, p_directive_json, p_signature_json, p_sequence_no
  );

  RETURN jsonb_build_object(
    'ok', true,
    'releaseId', p_release_id,
    'status', p_status,
    'version', v_rel.version
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.halt_runtime_release_atomic(uuid, text, text, text, jsonb, jsonb, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.halt_runtime_release_atomic(uuid, text, text, text, jsonb, jsonb, bigint)
  TO service_role;

-- Rollback:
-- REVOKE EXECUTE ON FUNCTION public.halt_runtime_release_atomic(uuid, text, text, text, jsonb, jsonb, bigint) FROM service_role;
-- DROP FUNCTION IF EXISTS public.halt_runtime_release_atomic(uuid, text, text, text, jsonb, jsonb, bigint);
-- DROP TABLE IF EXISTS public.runtime_halt_directives;
-- DROP TABLE IF EXISTS public.runtime_rollout_telemetry;
-- DROP TABLE IF EXISTS public.runtime_release_artifacts;
