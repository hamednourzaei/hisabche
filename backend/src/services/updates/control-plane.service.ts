import {
  compareSemVer,
  DEFAULT_ROLLOUT_THRESHOLDS,
  evaluateApiClientCompatibility,
  evaluateRolloutHealth,
  isDeviceInCohort,
  ROLLOUT_RING_ORDER,
  type RolloutRing,
} from '../../../../packages/updater-core/src'
import { supabase } from '../../db'

export interface RuntimeReleaseRow {
  id: string
  layer: 'core' | 'module' | 'data-pack' | 'bootstrap'
  component_id: string
  version: string
  channel: 'development' | 'internal' | 'beta' | 'stable'
  ring: RolloutRing
  rollout_percent: number
  platforms: string[]
  manifest_json: Record<string, unknown>
  signature_json: Record<string, unknown>
  sequence_no: number
  status: 'draft' | 'active' | 'halted' | 'revoked' | 'deprecated'
  halt_reason: string | null
  rollback_target_version: string | null
  min_supported_version: string
  created_at: string
}

export const CONTROL_PLANE_MIN_SUPPORTED_CLIENT = '1.0.0'
export const CONTROL_PLANE_SERVER_API_VERSION = '1.4.0'

export async function checkCompatibleUpdates(input: {
  platform: 'web' | 'windows' | 'android'
  channel: 'development' | 'internal' | 'beta' | 'stable'
  deviceId: string
  clientVersion: string
  clientRequiredApiRange: string
  workspaceId?: string | undefined
  workspaceCapabilities?: readonly string[] | undefined
}): Promise<{
  serverTimeMs: number
  apiCompatibility: ReturnType<typeof evaluateApiClientCompatibility>
  minSupportedClientVersion: string
  serverApiVersion: string
  coreUpdate: RuntimeReleaseRow | null
  moduleUpdates: RuntimeReleaseRow[]
  haltDirectives: Array<Record<string, unknown>>
}> {
  const apiCompatibility = evaluateApiClientCompatibility({
    clientVersion: input.clientVersion,
    minSupportedClientVersion: CONTROL_PLANE_MIN_SUPPORTED_CLIENT,
    serverApiVersion: CONTROL_PLANE_SERVER_API_VERSION,
    clientRequiredApiRange: input.clientRequiredApiRange,
  })

  const { data: releases, error: relErr } = await supabase
    .from('runtime_release_artifacts')
    .select(
      'id, layer, component_id, version, channel, ring, rollout_percent, platforms, manifest_json, signature_json, sequence_no, status, halt_reason, rollback_target_version, min_supported_version, created_at',
    )
    .eq('channel', input.channel)
    .eq('status', 'active')
    .order('sequence_no', { ascending: false })

  if (relErr) {
    if (relErr.code === '42P01' || relErr.code === 'PGRST205') {
      return {
        serverTimeMs: Date.now(),
        apiCompatibility,
        minSupportedClientVersion: CONTROL_PLANE_MIN_SUPPORTED_CLIENT,
        serverApiVersion: CONTROL_PLANE_SERVER_API_VERSION,
        coreUpdate: null,
        moduleUpdates: [],
        haltDirectives: [],
      }
    }
    throw relErr
  }

  const rows = (releases ?? []) as RuntimeReleaseRow[]
  const eligibleRows = rows.filter(
    (r) =>
      r.platforms.includes(input.platform) &&
      isDeviceInCohort({
        deviceId: input.deviceId,
        releaseId: r.id,
        rolloutPercent: r.rollout_percent,
      }),
  )

  let coreUpdate: RuntimeReleaseRow | null = null
  const modulesByComponent = new Map<string, RuntimeReleaseRow>()

  for (const row of eligibleRows) {
    if (row.layer === 'core') {
      if (!coreUpdate || compareSemVer(row.version, coreUpdate.version) > 0) {
        coreUpdate = row
      }
    } else if (row.layer === 'module') {
      // Never authorize module delivery unless workspaceId + entitlements were verified server-side
      if (!input.workspaceId) continue
      const requiredCaps = Array.isArray(row.manifest_json.requiredCapabilities)
        ? (row.manifest_json.requiredCapabilities as string[])
        : []
      const allowedCaps = new Set(input.workspaceCapabilities ?? [])
      if (requiredCaps.some((cap) => !allowedCaps.has(cap))) {
        continue
      }
      const existing = modulesByComponent.get(row.component_id)
      if (!existing || compareSemVer(row.version, existing.version) > 0) {
        modulesByComponent.set(row.component_id, row)
      }
    }
  }

  const { data: directives, error: dirErr } = await supabase
    .from('runtime_halt_directives')
    .select(
      'id, release_id, layer, component_id, target_version, rollback_target, reason, directive_json, signature_json, sequence_no',
    )
    .order('sequence_no', { ascending: false })
    .limit(25)

  if (dirErr && dirErr.code !== '42P01' && dirErr.code !== 'PGRST205') {
    throw dirErr
  }

  return {
    serverTimeMs: Date.now(),
    apiCompatibility,
    minSupportedClientVersion: CONTROL_PLANE_MIN_SUPPORTED_CLIENT,
    serverApiVersion: CONTROL_PLANE_SERVER_API_VERSION,
    coreUpdate,
    moduleUpdates: Array.from(modulesByComponent.values()),
    haltDirectives: (directives ?? []) as Array<Record<string, unknown>>,
  }
}

export async function recordDeviceRolloutTelemetry(input: {
  workspaceId: string
  deviceId: string
  releaseId: string
  ring: RolloutRing
  eventKind: 'activation_success' | 'startup_failure' | 'rollback_triggered' | 'signature_failure'
  reasonCode?: string | undefined
}): Promise<{ autoHalted: boolean; reasons: readonly string[] }> {
  const { error: insErr } = await supabase.from('runtime_rollout_telemetry').insert({
    workspace_id: input.workspaceId,
    device_id: input.deviceId,
    release_id: input.releaseId,
    ring: input.ring,
    event_kind: input.eventKind,
    reason_code: input.reasonCode ?? null,
  })
  if (insErr) throw insErr

  const { data: rows, error: readErr } = await supabase
    .from('runtime_rollout_telemetry')
    .select('event_kind')
    .eq('release_id', input.releaseId)
    .eq('ring', input.ring)

  if (readErr) throw readErr
  const events = (rows ?? []) as Array<{ event_kind: string }>
  const decision = evaluateRolloutHealth(
    {
      sampleSize: events.length,
      activationSuccessCount: events.filter((e) => e.event_kind === 'activation_success').length,
      startupFailureCount: events.filter((e) => e.event_kind === 'startup_failure').length,
      rollbackCount: events.filter((e) => e.event_kind === 'rollback_triggered').length,
      signatureFailureCount: events.filter((e) => e.event_kind === 'signature_failure').length,
    },
    DEFAULT_ROLLOUT_THRESHOLDS,
  )

  if (decision.action === 'HALT_AND_ROLLBACK') {
    await supabase
      .from('runtime_release_artifacts')
      .update({
        status: 'halted',
        halt_reason: decision.reasons.join('; '),
        halted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.releaseId)
      .eq('status', 'active')
    return { autoHalted: true, reasons: decision.reasons }
  }

  return { autoHalted: false, reasons: [] }
}

export async function promoteReleaseRing(input: {
  releaseId: string
  targetRing: RolloutRing
  rolloutPercent: number
}): Promise<{ ok: true; ring: RolloutRing; rolloutPercent: number } | { ok: false; code: string }> {
  const { data: rel, error } = await supabase
    .from('runtime_release_artifacts')
    .select('id, status, ring, rollout_percent')
    .eq('id', input.releaseId)
    .maybeSingle()

  if (error) throw error
  if (!rel) return { ok: false, code: 'RELEASE_NOT_FOUND' }
  const row = rel as { id: string; status: string; ring: RolloutRing; rollout_percent: number }
  if (row.status === 'halted' || row.status === 'revoked') {
    return { ok: false, code: 'CANNOT_PROMOTE_HALTED_RELEASE' }
  }
  const curIdx = ROLLOUT_RING_ORDER.indexOf(row.ring)
  const nextIdx = ROLLOUT_RING_ORDER.indexOf(input.targetRing)
  if (nextIdx < curIdx || (nextIdx === curIdx && input.rolloutPercent < row.rollout_percent)) {
    return { ok: false, code: 'ROLLOUT_PERCENT_MUST_INCREASE_MONOTONICALLY' }
  }

  const { error: updErr } = await supabase
    .from('runtime_release_artifacts')
    .update({
      ring: input.targetRing,
      rollout_percent: input.rolloutPercent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.releaseId)

  if (updErr) throw updErr
  return { ok: true, ring: input.targetRing, rolloutPercent: input.rolloutPercent }
}
