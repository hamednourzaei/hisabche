import type { SupabaseClient } from '@supabase/supabase-js'
import { primaryDb } from './primary'
import { getReplicaClientOrPrimary } from './replica'

export const REPLICA_READ_ALLOWLIST = [
  'services/reporting/',
  'services/analytics',
  'services/analysis',
  'services/intelligence',
  'routes/analytics.routes.ts',
  'routes/analysis.routes.ts',
  'routes/custom-reports.routes.ts',
  'routes/dashboard-kpis.routes.ts',
  'routes/inventory-insights.routes.ts',
] as const

export function isReplicaAllowedCaller(relativePath: string): boolean {
  const norm = relativePath.replace(/\\/g, '/')
  return REPLICA_READ_ALLOWLIST.some((prefix) => norm.includes(prefix))
}

export const DEFAULT_MAX_REPLICA_LAG_MS = Number(process.env.MAX_REPLICA_LAG_MS ?? 5000)

export function selectReadClient(params: {
  callerPath: string
  replicaLagMs?: number | null | undefined
  maxLagMs?: number | undefined
}): { client: SupabaseClient; target: 'primary' | 'replica'; reason: string } {
  if (!isReplicaAllowedCaller(params.callerPath)) {
    return { client: primaryDb, target: 'primary', reason: 'caller_not_allowlisted' }
  }
  const maxLag = params.maxLagMs ?? DEFAULT_MAX_REPLICA_LAG_MS
  if (
    params.replicaLagMs !== null &&
    params.replicaLagMs !== undefined &&
    params.replicaLagMs > maxLag
  ) {
    return { client: primaryDb, target: 'primary', reason: 'replica_lag_exceeded' }
  }
  const { client, isReplica } = getReplicaClientOrPrimary()
  return {
    client,
    target: isReplica ? 'replica' : 'primary',
    reason: isReplica ? 'replica_healthy' : 'replica_unset_fallback',
  }
}
